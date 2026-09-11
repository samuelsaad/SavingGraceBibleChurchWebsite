import type { Pool, PoolClient } from "pg";
import { evaluateReviewSetIntegrity } from "../enrichment/review-set-integrity";
import { authorisedLocalDatabaseName, assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { canonicalReviewJson, contentHash, delegatedReviewerSubject, delegatedReviewResultSchema, reviewHash, sourceProvenanceHash, validateDelegatedReview, type AiContent, type DelegatedReviewResult } from "../domain/delegated-ai-review";

async function guardedClient(pool: Pool): Promise<PoolClient> {
  if (process.env.ALLOW_LOCAL_DB_WRITE!=="1") throw new Error("delegated_review_write_gate_required");
  let target: string;
  try {
    target=authorisedLocalDatabaseName();
    if (target==="savinggrace_sermons_test") assertDisposableLocalDatabase("postgresql://127.0.0.1:5432/savinggrace_sermons_test");
  } catch { throw new Error("delegated_review_target_mismatch"); }
  const c=await pool.connect().catch(() => { throw new Error("delegated_review_connection_failed"); });
  try {
    const {rows}=await c.query(`SELECT current_database()=$1 AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AS verified`,[target]);
    if (!rows[0]?.verified) throw new Error("delegated_review_target_mismatch");
    await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await c.query("SET LOCAL savinggrace.application_request='on'");
    return c;
  } catch {
    // Do not return an open transaction to the pool after a setup failure.
    try { await c.query("ROLLBACK"); c.release(); } catch { c.release(true); }
    throw new Error("delegated_review_target_or_transaction_failed");
  }
}

async function rollbackFailedReview(client: PoolClient): Promise<boolean> {
  try { await client.query("ROLLBACK"); return false; }
  catch { return true; } // Destroy an uncertain connection instead of pooling it.
}

export async function bindDelegatedReviewScope(pool:Pool,ids:string[],policySha256:string):Promise<{outcome:string;scopeSha256:string}> {
  if(!/^[a-f0-9]{64}$/u.test(policySha256) || new Set(ids).size!==ids.length || !ids.length) throw new Error("delegated_review_invalid_scope");
  if(process.env.RUN_POSTGRES_INTEGRATION!=="1" && ids.length!==155) throw new Error("delegated_review_exact_existing_collection_required");
  const scopeSha256=reviewHash(canonicalReviewJson(ids));
  const c=await guardedClient(pool);
  let discardClient = false;
  try {
    const existing=(await c.query("SELECT scope_sha256,policy_sha256,member_count FROM delegated_ai_review_scopes WHERE id='D-156' FOR UPDATE")).rows[0];
    if(existing){
      const members=(await c.query("SELECT sermon_id FROM delegated_ai_review_members WHERE scope_id='D-156' ORDER BY sequence")).rows.map(r=>r.sermon_id);
      if(existing.scope_sha256!==scopeSha256 || existing.policy_sha256!==policySha256 || existing.member_count!==ids.length || canonicalReviewJson(ids)!==canonicalReviewJson(members)) throw new Error("scope_conflict");
      await c.query("COMMIT");return {outcome:"unchanged",scopeSha256};
    }
    const actual=(await c.query("SELECT id FROM sermons WHERE deleted_at IS NULL ORDER BY id FOR SHARE")).rows.map(r=>r.id);
    if(canonicalReviewJson([...ids].sort())!==canonicalReviewJson(actual)) throw new Error("scope_conflict");
    await c.query("INSERT INTO delegated_ai_review_scopes(id,scope_sha256,policy_sha256,member_count) VALUES ('D-156',$1,$2,$3)",[scopeSha256,policySha256,ids.length]);
    for(const [i,id] of ids.entries()) await c.query("INSERT INTO delegated_ai_review_members(scope_id,sermon_id,sequence) VALUES ('D-156',$1,$2)",[id,i+1]);
    await c.query("COMMIT");return {outcome:"created",scopeSha256};
  } catch {discardClient=await rollbackFailedReview(c);throw new Error("delegated_review_scope_conflict");} finally {c.release(discardClient);}
}

export async function applyDelegatedReview(pool:Pool,raw:DelegatedReviewResult):Promise<"recorded"|"unchanged"> {
  // Reject malformed input before a database connection and keep private values
  // out of Zod/driver diagnostics exposed to callers.
  const parsed = delegatedReviewResultSchema.safeParse(raw);
  if (!parsed.success) throw new Error("delegated_review_validation_or_concurrency_conflict");
  raw = parsed.data;
  const c=await guardedClient(pool);
  let discardClient = false;
  try {
    const scope=(await c.query("SELECT s.scope_sha256,s.policy_sha256 FROM delegated_ai_review_scopes s JOIN delegated_ai_review_members m ON m.scope_id=s.id WHERE s.id='D-156' AND m.sermon_id=$1 FOR SHARE OF s,m",[raw.sermonId])).rows[0];
    if(!scope || scope.scope_sha256!==raw.scopeSha256 || scope.policy_sha256!==raw.policySha256) throw new Error("scope");
    const s=(await c.query("SELECT id,status,published_at,row_version,summary,summary_status,summary_row_version,summary_approved_at FROM sermons WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",[raw.sermonId])).rows[0];
    const t=(await c.query("SELECT body_text,grounding_revision_id,source_kind,source_reference FROM sermon_transcripts WHERE sermon_id=$1 FOR UPDATE",[raw.sermonId])).rows[0];
    const source=(await c.query("SELECT es.source_content_sha256,to_jsonb(es) AS provenance_snapshot FROM sermon_enrichment_sources es WHERE sermon_id=$1 FOR SHARE",[raw.sermonId])).rows[0];
    if(!s || !t || !source || s.status!=="draft" || s.published_at!==null || t.grounding_revision_id!==raw.groundingRevisionId || source.source_content_sha256!==raw.sourceSha256 || sourceProvenanceHash(source.provenance_snapshot)!==raw.sourceProvenanceSha256) throw new Error("source_or_privacy");
    const r=validateDelegatedReview(raw,t.body_text);
    let current:AiContent, version:number, human:boolean;
    if(r.artifactKey==="description") {
      current={description:s.summary};version=s.summary_row_version;human=s.summary_status==="approved" || s.summary_approved_at!==null;
    } else {
      const q=(await c.query("SELECT question_text,answer_text,row_version,status,approved_at,display_order FROM sermon_question_answers WHERE sermon_id=$1 AND id=$2 FOR UPDATE",[r.sermonId,r.artifactKey.slice(3)])).rows[0];
      if(!q || q.display_order!==r.displayOrder) throw new Error("qa_identity");
      current={question:q.question_text,answer:q.answer_text};version=q.row_version;human=q.status==="approved" || q.approved_at!==null;
    }
    const requestHash=reviewHash(canonicalReviewJson(r));
    const prior=(await c.query("SELECT output_sha256,output_version FROM sermon_ai_content_reviews WHERE scope_id='D-156' AND sermon_id=$1 AND artifact_key=$2 AND request_sha256=$3",[r.sermonId,r.artifactKey,requestHash])).rows[0];
    if(prior){
      if(contentHash(current)!==prior.output_sha256 || version!==prior.output_version) throw new Error("stale");
      await c.query("COMMIT");return "unchanged";
    }
    if(human || version!==r.inputVersion || s.row_version!==r.expectedSermonVersion || contentHash(current)!==r.inputSha256) throw new Error("human_or_concurrent");
    const history=(await c.query("SELECT correction_round FROM sermon_ai_content_reviews WHERE scope_id='D-156' AND sermon_id=$1 AND artifact_key=$2",[r.sermonId,r.artifactKey])).rows;
    if(r.correctionRound && history.some(h=>h.correction_round===1)) throw new Error("correction_allowance_consumed");
    if(r.outcome==="corrected_accepted") {
      if("description" in r.output) await c.query(`UPDATE sermons SET summary=$2,summary_row_version=summary_row_version+1,summary_updated_at=now(),row_version=row_version+1,updated_at=now(),updated_by_subject=$3 WHERE id=$1`,[r.sermonId,r.output.description,delegatedReviewerSubject]);
      else {
        await c.query("UPDATE sermon_question_answers SET question_text=$2,answer_text=$3,row_version=row_version+1,updated_at=now() WHERE id=$1",[r.artifactKey.slice(3),r.output.question,r.output.answer]);
        await c.query("UPDATE sermons SET row_version=row_version+1,updated_at=now(),updated_by_subject=$2 WHERE id=$1",[r.sermonId,delegatedReviewerSubject]);
      }
    }
    await c.query(`INSERT INTO sermon_ai_content_reviews(scope_id,sermon_id,artifact_key,request_sha256,policy_sha256,transcript_sha256,grounding_revision_id,source_sha256,input_sha256,output_sha256,input_version,output_version,outcome,correction_round,original_content,current_content,evidence,coverage,assessment,provenance,reviewer_subject,reviewed_at)
      VALUES ('D-156',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20,$21)`,[
        r.sermonId,r.artifactKey,requestHash,r.policySha256,r.transcriptSha256,r.groundingRevisionId,r.sourceSha256,r.inputSha256,r.outputSha256,r.inputVersion,r.inputVersion+(r.outcome==="corrected_accepted"?1:0),r.outcome,r.correctionRound,
        JSON.stringify(r.original),JSON.stringify(r.output),JSON.stringify(r.evidence),JSON.stringify(r.coverage),JSON.stringify({...r.assessment,artifactDisplayOrder:r.displayOrder}),JSON.stringify({...r.provenance,source_provenance_sha256:r.sourceProvenanceSha256}),delegatedReviewerSubject,r.reviewedAt]);
    await c.query(`INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id)
      VALUES ($1,'system',$2,'sermon',$3,'succeeded',$4::jsonb,$5)`,[delegatedReviewerSubject,`sermon.ai_review.${r.outcome}`,r.sermonId,JSON.stringify([r.artifactKey==="description"?"descriptionAiReview":"questionAnswerAiReview"]),requestHash]);
    await c.query("COMMIT");return "recorded";
  } catch {discardClient=await rollbackFailedReview(c);throw new Error("delegated_review_validation_or_concurrency_conflict");} finally {c.release(discardClient);}
}

export async function listDelegatedReviews(pool:Pool | PoolClient, sermonIds?: readonly string[]) {
  const rows=(await pool.query(`SELECT m.sequence,s.id AS sermon_id,s.title,a.artifact_key,r.id AS review_id,r.outcome,r.input_version,r.output_version,r.transcript_sha256,r.grounding_revision_id,r.source_sha256,r.policy_sha256,r.current_content,r.assessment,r.provenance,r.reviewed_at,
    t.body_text,t.grounding_revision_id AS current_grounding,es.source_content_sha256,to_jsonb(es) AS current_source_provenance,sc.policy_sha256 AS current_policy_sha256,
    s.summary,s.summary_row_version,s.summary_status,s.summary_approved_at,q.question_text,q.answer_text,q.row_version AS qa_version,q.status AS qa_status,q.approved_at AS qa_approved_at,q.display_order,
    r.output_sha256,r.reviewer_subject,s.speaker_id,to_char(s.service_date,'YYYY-MM-DD') AS service_date,to_jsonb(workflow) AS workflow,
    t.row_version AS transcript_version,
    (SELECT count(*)::int FROM sermon_enrichment_review_items i WHERE i.sermon_id=s.id) AS stored_item_count,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('identitySha256',i.item_identity_sha256,'sourceRecordKey',i.source_record_key,'displayOrder',i.display_order,'transcriptRowVersion',i.transcript_row_version,'decisionStatus',i.decision_status) ORDER BY i.display_order,i.id)
      FROM sermon_enrichment_review_items i WHERE i.sermon_id=s.id AND i.item_identity_sha256 IS NOT NULL),'[]') AS review_items
    FROM delegated_ai_review_members m JOIN delegated_ai_review_scopes sc ON sc.id=m.scope_id JOIN sermons s ON s.id=m.sermon_id
    LEFT JOIN sermon_transcripts t ON t.sermon_id=s.id LEFT JOIN sermon_enrichment_sources es ON es.sermon_id=s.id
    LEFT JOIN sermon_enrichment_reviews workflow ON workflow.sermon_id=s.id
    CROSS JOIN LATERAL (
      SELECT 'description'::text AS artifact_key,NULL::uuid AS qa_id
      UNION ALL SELECT 'qa:' || qa.id::text,qa.id FROM sermon_question_answers qa WHERE qa.sermon_id=s.id
    ) a
    LEFT JOIN LATERAL (SELECT * FROM sermon_ai_content_reviews WHERE sermon_id=s.id AND scope_id=m.scope_id AND artifact_key=a.artifact_key ORDER BY created_at DESC,id DESC LIMIT 1) r ON true
    LEFT JOIN sermon_question_answers q ON q.sermon_id=s.id AND q.id=a.qa_id
    WHERE m.scope_id='D-156' AND s.deleted_at IS NULL AND ($1::uuid[] IS NULL OR s.id=ANY($1::uuid[])) ORDER BY m.sequence,q.display_order NULLS FIRST,a.artifact_key`,[sermonIds ?? null])).rows;
  return rows.map(r=>{
    const description=r.artifact_key==="description";
    const current=description?{description:r.summary}:{question:r.question_text,answer:r.answer_text};
    const stale=!!r.review_id && (canonicalReviewJson(current)!==canonicalReviewJson(r.current_content) || contentHash(current)!==r.output_sha256 || r.reviewer_subject!==delegatedReviewerSubject || r.provenance?.reviewer_kind!=="ai" || (description?r.summary_row_version:r.qa_version)!==r.output_version || reviewHash(r.body_text??"")!==r.transcript_sha256 || r.current_grounding!==r.grounding_revision_id || r.source_content_sha256!==r.source_sha256 || sourceProvenanceHash(r.current_source_provenance)!==r.provenance?.source_provenance_sha256 || r.current_policy_sha256!==r.policy_sha256 || (description?null:r.display_order)!==r.assessment?.artifactDisplayOrder);
    const w=r.workflow;
    const integrity=evaluateReviewSetIntegrity({
      sourceRecordKey:w?.source_record_key??null,expectedItemCount:w?.expected_item_count??null,
      expectedItemSetSha256:w?.expected_item_set_sha256??null,
      databaseItemSetSha256:reviewHash(r.review_items.map((i:{identitySha256:string})=>i.identitySha256).join("\n")),
      expectedTranscriptSha256:w?.expected_transcript_sha256??null,expectedTranscriptRowVersion:w?.expected_transcript_row_version??null,
      storedItemCount:r.stored_item_count,atomicItemCount:r.review_items.length,items:r.review_items,
      transcriptBody:r.body_text??"",transcriptRowVersion:r.transcript_version??null,
      emptyItemSetAcknowledged:!!w?.empty_item_set_acknowledged_by_subject&&!!w?.empty_item_set_acknowledged_at
    });
    return {sequence:r.sequence,sermonId:r.sermon_id,title:r.title,artifactKey:r.artifact_key,displayOrder:r.display_order,
      outcome:stale?"stale":r.outcome??"incomplete",reviewedAt:r.reviewed_at,
      exceptionCode:r.assessment?.exceptionCode??null,informationNeeded:r.assessment?.informationNeeded??null,
      standingWarnings:r.assessment?.standingWarnings??[],reviewerKind:"ai",model:r.provenance?.model??null,
      identityConfirmed:w?.identity_status==="confirmed"&&r.speaker_id!==null&&String(r.service_date).slice(0,10)!=="1970-01-01",
      findingsComplete:integrity.findingsComplete,
      humanApprovalPreserved:(description?r.summary_status:r.qa_status)==="approved"&&!!(description?r.summary_approved_at:r.qa_approved_at)};
  });
}

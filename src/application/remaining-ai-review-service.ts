import type { Pool, PoolClient } from "pg";
import { withLegacyReviewTimezone } from "./legacy-review-timezone";
import { z } from "zod";
import { authorisedLocalDatabaseName } from "../migration/local-database-safety";
import { evaluateReviewSetIntegrity, reviewSetSha256 } from "../enrichment/review-set-integrity";
import { aggregateDelegatedReview } from "../domain/delegated-review-status";
import { canonicalReviewJson, reviewHash } from "../domain/delegated-ai-review";
import { listDelegatedReviews } from "./delegated-ai-review-service";
import { resolveYouTubeIdentity } from "../domain/youtube";
import { biblePassageParserVersion, formatBiblePassage } from "../domain/bible-passage";
import { primaryBookResolutionVersion } from "../domain/primary-book-resolution";
import { primaryPassageInputSchema } from "../api/contracts/admin-sermons";
import { PostgresAdminSermonTransaction } from "../server/repositories/postgres-admin-sermon-repository";
import { remainingReviewProvenanceSchema } from "../domain/remaining-ai-review";
import { remainingComponents, remainingDependencyHash, remainingReviewPacketSchema, remainingReviewScopeSha256,
  remainingReviewerSubject, validateRemainingComponent, type RemainingComponent, type RemainingReviewPacket,
  type RemainingReviewStatus, type RemainingReviewValidationContext } from "../domain/remaining-ai-review";

type Queryable = Pool | PoolClient;
type Row = Record<string, any>;
const iso = (v: Date | string | null | undefined): string | null => v instanceof Date ? v.toISOString() : v ?? null;
const pick = (v: Row | null, fields: string[]) => Object.fromEntries(fields.map(k => [k, v?.[k] ?? null]));
const hash = remainingDependencyHash;
function fail(): never { throw new Error("remaining_review_scope_evidence_or_concurrency_conflict"); }

export interface RemainingReviewSnapshot extends RemainingReviewValidationContext {
  sermonId: string; rowVersion: number; scopeSha256: string; policySha256: string;
  status: string; publishedAt: string | null;
  human: Record<RemainingComponent, boolean>;
  humanAttribution: Record<RemainingComponent, { subject: string | null; at: string | null }>;
  substantiveComplete: boolean; substantiveDependencySha256: string;
  existingHumanCompletedAt: string | null; existingHumanCompletedBy: string | null;
  metadata: Row; source: Row | null; workflow: Row | null; findingRows: Row[]; passageRows: Row[]; passageReview: Row | null; mediaRows: Row[];
}

async function installed(db: Queryable): Promise<boolean> {
  return (await db.query("SELECT to_regclass('public.remaining_ai_review_scopes') IS NOT NULL AS installed")).rows[0]?.installed === true;
}

async function consistentRead<T>(pool:Pool,read:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client=await pool.connect().catch(()=>fail());let discard=false;
  try{await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");const value=await read(client);await client.query("COMMIT");return value;}
  catch{discard=await rollback(client);return fail();}finally{client.release(discard);}
}

/** Returns private review context to the authorised worker; callers must not log it. */
export async function readRemainingReviewSnapshot(db: Queryable, sermonId: string): Promise<RemainingReviewSnapshot | null> {
  return withLegacyReviewTimezone(db, client => readRemainingReviewSnapshotLegacy(client, sermonId));
}
async function readRemainingReviewSnapshotLegacy(db: Queryable, sermonId: string): Promise<RemainingReviewSnapshot | null> {
  if(!("release" in db))return consistentRead(db,c=>readRemainingReviewSnapshot(c,sermonId));
  if (!z.uuid().safeParse(sermonId).success) fail();
  if (!await installed(db)) return null;
  const r = (await db.query(`SELECT to_jsonb(s) AS sermon, to_jsonb(t) AS transcript,
    to_jsonb(es) AS source, to_jsonb(w) AS workflow, to_jsonb(p) AS passage_review, to_jsonb(cr) AS readiness,
    sc.scope_sha256,sc.policy_sha256, to_jsonb(sp) AS speaker,
    COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.display_order,i.id) FROM sermon_enrichment_review_items i WHERE i.sermon_id=s.id),'[]') AS items,
    COALESCE((SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.display_order,pr.id) FROM scripture_references pr WHERE pr.sermon_id=s.id),'[]') AS passages,
    COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.display_order,m.id) FROM sermon_media m WHERE m.sermon_id=s.id),'[]') AS media,
    COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order,q.id) FROM sermon_question_answers q WHERE q.sermon_id=s.id),'[]') AS questions
    FROM remaining_ai_review_members member JOIN remaining_ai_review_scopes sc ON sc.id=member.scope_id
    JOIN sermons s ON s.id=member.sermon_id LEFT JOIN sermon_transcripts t ON t.sermon_id=s.id
    LEFT JOIN sermon_enrichment_sources es ON es.sermon_id=s.id LEFT JOIN sermon_enrichment_reviews w ON w.sermon_id=s.id
    LEFT JOIN sermon_primary_passage_reviews p ON p.sermon_id=s.id LEFT JOIN sermon_content_readiness cr ON cr.sermon_id=s.id
    LEFT JOIN speakers sp ON sp.id=s.speaker_id WHERE member.scope_id='D-157' AND s.id=$1 AND s.deleted_at IS NULL`, [sermonId])).rows[0];
  if (!r) return null;
  const s=r.sermon as Row, t=r.transcript as Row|null, es=r.source as Row|null, w=r.workflow as Row|null,
    p=r.passage_review as Row|null, cr=(r.readiness??{}) as Row, items=r.items as Row[], passages=r.passages as Row[];
  const body=String(t?.body_text??""), transcriptSha256=reviewHash(body);
  const atomic=items.filter(i=>typeof i.item_identity_sha256==="string");
  const integrity=evaluateReviewSetIntegrity({ sourceRecordKey:w?.source_record_key??null,
    expectedItemCount:w?.expected_item_count??null, expectedItemSetSha256:w?.expected_item_set_sha256??null,
    databaseItemSetSha256:reviewSetSha256(atomic.map(i=>i.item_identity_sha256)), expectedTranscriptSha256:w?.expected_transcript_sha256??null,
    expectedTranscriptRowVersion:w?.expected_transcript_row_version??null, storedItemCount:items.length, atomicItemCount:atomic.length,
    transcriptBody:body, transcriptRowVersion:t?.row_version??null,
    emptyItemSetAcknowledged:!!w?.empty_item_set_acknowledged_at&&!!w?.empty_item_set_acknowledged_by_subject,
    items:atomic.map(i=>({ identitySha256:i.item_identity_sha256,sourceRecordKey:i.source_record_key,displayOrder:i.display_order,
      transcriptRowVersion:i.transcript_row_version,decisionStatus:i.decision_status })) });
  const currentD156=await listDelegatedReviews(db,[sermonId]);
  const substantive=aggregateDelegatedReview(currentD156).get(sermonId);
  const reviews=(await db.query(`SELECT DISTINCT ON (artifact_key) id,artifact_key,coverage,to_jsonb(r) AS evidence
    FROM sermon_ai_content_reviews r WHERE scope_id='D-156' AND sermon_id=$1 ORDER BY artifact_key,created_at DESC,id DESC`,[sermonId])).rows;
  const priorEvidence=reviews.filter(pr=>currentD156.some(c=>c.artifactKey===pr.artifact_key&&["accepted","corrected_accepted"].includes(c.outcome)))
    .map(pr=>({ id:pr.id as string,sha256:hash(pr.evidence),ranges:pr.coverage as Array<{start:number;end:number}> }));
  const sourceDependency=pick(es,["provider","video_id","canonical_url","caption_language","caption_track_type","source_content_sha256","retrieval_attribution","processing_version","warnings","unresolved_passages","uncertainty_marker_count","apparent_completeness"]);
  const transcriptDependency={...pick(t,["grounding_revision_id","source_kind","source_reference","status","approved_at","approved_by_subject"]),sha256:transcriptSha256};
  const metadata={...pick(s,["id","source_wordpress_id","title","slug","service_date","speaker_id"]),source:sourceDependency,speaker:pick(r.speaker,["id","name","slug","source_term_id"]),passages};
  const identityAvailable=!!w&&!!s.title&&!!s.service_date&&!String(s.service_date).startsWith("1970-01-01")&&!!es?.video_id&&!!w.source_record_key;
  const speakerAvailable=!!s.speaker_id&&!!r.speaker?.id;
  const passageAvailable=passages.some(q=>q.relationship_role==="primary"&&q.canonical_book_id!==null&&["proposed","confirmed"].includes(q.review_status));
  const youtube=resolveYouTubeIdentity([
    ...(es?[{videoId:es.video_id??null,canonicalUrl:es.canonical_url??null}]:[]),
    ...(r.media as Row[]).filter(m=>m.provider==="youtube").map(m=>({videoId:m.external_id??null,canonicalUrl:m.canonical_url??null}))
  ]);
  const mediaAvailable=cr.has_valid_controlled_media===true&&youtube.status==="available";
  const human:Record<RemainingComponent,boolean>={identity:identityAvailable&&w?.identity_status==="confirmed",speaker:speakerAvailable&&w?.identity_status==="confirmed",
    findings:integrity.findingsComplete,transcript:cr.has_approved_transcript===true&&!!t?.approved_at,
    passage:cr.has_required_passage_decision===true&&!!p?.reviewed_at,media:mediaAvailable&&!!w?.completed_at};
  const attribution=(subject:unknown,at:unknown)=>({subject:typeof subject==="string"?subject:null,at:typeof at==="string"?at:null});
  const humanAttribution={ identity:attribution(w?.updated_by_subject,w?.updated_at),speaker:attribution(w?.updated_by_subject,w?.updated_at),
    findings:attribution(w?.empty_item_set_acknowledged_by_subject??w?.updated_by_subject,w?.empty_item_set_acknowledged_at??w?.updated_at),
    transcript:attribution(t?.approved_by_subject,t?.approved_at),passage:attribution(p?.reviewed_by_subject,p?.reviewed_at),media:attribution(w?.completed_by_subject,w?.completed_at) };
  // No generic sermon version, unrelated description update or navigation timestamp
  // is a dependency. Every current human decision affecting this component is.
  const dependencies:Record<RemainingComponent,string>={
    identity:hash({source:sourceDependency,fields:pick(s,["id","source_wordpress_id","title","slug","service_date"]),identity:w?.identity_status??null}),
    speaker:hash({source:sourceDependency,speaker:pick(r.speaker,["id","name","slug","source_term_id"]),identity:w?.identity_status??null}),
    transcript:hash({source:sourceDependency,transcript:transcriptDependency}),
    findings:hash({source:sourceDependency,transcript:transcriptDependency,expectations:pick(w,["source_record_key","expected_item_count","expected_item_set_sha256","expected_transcript_sha256","expected_transcript_row_version","empty_item_set_acknowledged_by_subject","empty_item_set_acknowledged_at"]),items}),
    passage:hash({source:sourceDependency,transcript:transcriptDependency,passages,review:p}),
    media:hash({source:sourceDependency,media:r.media})
  };
  const humanQuestions=(r.questions as Row[]).length>=5&&(r.questions as Row[]).length<=10&&(r.questions as Row[]).every((q,i)=>q.display_order===i+1&&q.status==="approved"&&!!q.approved_at);
  const substantiveComplete=substantive?.substantiveComplete??(cr.has_approved_description===true&&!!s.summary_approved_at&&humanQuestions);
  const substantiveDependencySha256=hash({description:pick(s,["summary","summary_row_version","summary_status","summary_approved_at"]),questions:r.questions,transcript:transcriptDependency,source:sourceDependency,decisions:currentD156.map(d=>({artifactKey:d.artifactKey,outcome:d.outcome,human:d.humanApprovalPreserved,order:d.displayOrder,at:iso(d.reviewedAt)}))});
  return {sermonId,rowVersion:s.row_version,scopeSha256:r.scope_sha256,policySha256:r.policy_sha256,status:s.status,publishedAt:s.published_at,
    dependencies,transcript:{body,sha256:transcriptSha256,humanApproved:human.transcript}, sourceSha256:es?.source_content_sha256??null,
    sourceProvenanceSha256:hash(es),metadataSha256:hash(metadata),priorEvidence,officialEvidenceHashes:[],
    identityAvailable,speakerAvailable,passageAvailable,mediaAvailable,findingsVerified:integrity.reviewSetVerified,
    findings:atomic.map(i=>({identitySha256:i.item_identity_sha256,humanStatus:i.decision_status})),
    humanConflicts:{identity:false,speaker:false,findings:items.some(i=>["left_unresolved","rejected"].includes(i.decision_status)),transcript:false,passage:p?.review_status==="rejected",media:false},
    human,humanAttribution,substantiveComplete,substantiveDependencySha256,
    existingHumanCompletedAt:w?.completed_at??null,existingHumanCompletedBy:w?.completed_by_subject??null,
    metadata,source:es,workflow:w,findingRows:items,passageRows:passages,passageReview:p,mediaRows:r.media};
}

function componentStatus(s:RemainingReviewSnapshot,key:RemainingComponent,r:Row|undefined):RemainingReviewStatus["components"][RemainingComponent] {
  const pending:RemainingReviewStatus["components"][RemainingComponent]={state:"pending",accepted:false,exceptionCode:null,informationNeeded:null,reviewerSubject:null,model:null,reviewedAt:null};
  if(s.human[key]) {
    let limitation:Row|null=null;
    if(r?.outcome==="accepted_source_limitation"&&r.dependency_sha256===s.dependencies[key]&&r.policy_sha256===s.policySha256&&r.reviewer_subject===remainingReviewerSubject&&r.provenance?.model==="gpt-6-astra"){
      try{validateRemainingComponent(r.assessment,s);limitation=r.assessment;}catch{ /* Preserve the human decision, never stale supplemental evidence. */ }
    }
    return {...pending,state:"human_approved",accepted:true,reviewerSubject:s.humanAttribution[key].subject,reviewedAt:s.humanAttribution[key].at,
      warnings:limitation?.warnings??[],sourceLimitation:limitation!==null};
  }
  if(!r)return pending;
  const stale=r.dependency_sha256!==s.dependencies[key]||r.policy_sha256!==s.policySha256||r.reviewer_subject!==remainingReviewerSubject||r.provenance?.model!=="gpt-6-astra";
  if(stale)return {...pending,state:"stale",exceptionCode:"relevant_dependency_changed"};
  try{validateRemainingComponent(r.assessment,s);}catch{return {...pending,state:"stale",exceptionCode:"current_evidence_invalid"};}
  return {state:r.outcome==="accepted"?"ai_accepted":r.outcome,accepted:r.outcome!=="needs_human",exceptionCode:r.assessment.exceptionCode??null,
    informationNeeded:r.assessment.informationNeeded??null,reviewerSubject:r.reviewer_subject,model:r.provenance.model,reviewedAt:iso(r.reviewed_at),
    warnings:r.assessment.warnings,sourceLimitation:r.outcome==="accepted_source_limitation"};
}

function completionHash(s:RemainingReviewSnapshot,components:RemainingReviewStatus["components"]):string {
  return hash({scope:s.scopeSha256,policy:s.policySha256,dependencies:s.dependencies,
    components:remainingComponents.map(k=>({component:k,accepted:components[k].accepted,state:components[k].state})),
    substantive:s.substantiveDependencySha256,status:s.status,publishedAt:s.publishedAt});
}

export async function listRemainingReviews(db:Queryable,sermonIds?:readonly string[]):Promise<Map<string,RemainingReviewStatus>> {
  return withLegacyReviewTimezone(db, client => listRemainingReviewsLegacy(client, sermonIds));
}
async function listRemainingReviewsLegacy(db:Queryable,sermonIds?:readonly string[]):Promise<Map<string,RemainingReviewStatus>> {
  if(!("release" in db))return consistentRead(db,c=>listRemainingReviews(c,sermonIds));
  if(!await installed(db))return new Map();
  const ids=(await db.query("SELECT sermon_id FROM remaining_ai_review_members WHERE scope_id='D-157' AND ($1::uuid[] IS NULL OR sermon_id=ANY($1::uuid[])) ORDER BY sequence",[sermonIds??null])).rows.map(r=>r.sermon_id as string);
  const result=new Map<string,RemainingReviewStatus>();
  for(const id of ids){
    const s=await readRemainingReviewSnapshot(db,id);if(!s)continue;
    const rows=(await db.query("SELECT DISTINCT ON (component) * FROM sermon_ai_component_reviews WHERE scope_id='D-157' AND sermon_id=$1 ORDER BY component,created_at DESC,id DESC",[id])).rows;
    const components=Object.fromEntries(remainingComponents.map(k=>[k,componentStatus(s,k,rows.find(r=>r.component===k))])) as RemainingReviewStatus["components"];
    const canComplete=s.status==="draft"&&s.publishedAt===null&&s.substantiveComplete&&remainingComponents.every(k=>components[k].accepted);
    const c=rows.find(r=>r.component==="completion"),currentHash=completionHash(s,components);
    const aiComplete=canComplete&&c?.outcome==="accepted"&&c.dependency_sha256===currentHash&&c.policy_sha256===s.policySha256&&c.reviewer_subject===remainingReviewerSubject&&c.provenance?.model==="gpt-6-astra";
    const humanComplete=canComplete&&!!s.existingHumanCompletedAt;
    const privateComplete=aiComplete||humanComplete;
    const passageBasis=!components.passage.accepted?null:s.human.passage
      ?s.passageReview?.review_status==="confirmed_none"?"no_single_primary":"primary_passage"
      :rows.find(r=>r.component==="passage")?.assessment.checks.noSinglePrimarySupported===true?"no_single_primary":"primary_passage";
    result.set(id,{decision:"D-157",components,canComplete,privateComplete,passageBasis,
      completedAt:humanComplete?s.existingHumanCompletedAt:aiComplete?iso(c.reviewed_at):null,
      completionReviewerSubject:humanComplete?s.existingHumanCompletedBy:aiComplete?remainingReviewerSubject:null,
      remaining:[...remainingComponents.filter(k=>!components[k].accepted),...(!s.substantiveComplete?["description_or_individual_questions"]:[]),
        ...(s.status!=="draft"||s.publishedAt!==null?["private_draft_status"]:[]),...(!privateComplete?["completion"]:[])]});
  }
  return result;
}

async function guardedClient(pool:Pool):Promise<PoolClient>{
  if(process.env.ALLOW_LOCAL_DB_WRITE!=="1")throw new Error("remaining_review_write_gate_required");
  let name:string;try{name=authorisedLocalDatabaseName();}catch{return fail();}
  const c=await pool.connect().catch(()=>fail());
  try{
    const verified=(await c.query("SELECT current_database()=$1 AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AS verified",[name])).rows[0]?.verified;
    if(!verified)fail();await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");await c.query("SET LOCAL savinggrace.application_request='on'");return c;
  }catch{try{await c.query("ROLLBACK");c.release();}catch{c.release(true);}return fail();}
}
async function rollback(c:PoolClient):Promise<boolean>{try{await c.query("ROLLBACK");return false;}catch{return true;}}

export async function bindRemainingReviewScope(pool:Pool,ids:string[],policySha256:string,frozenManifest?:unknown):Promise<{outcome:"created"|"unchanged";scopeSha256:string}>{
  if(!/^[a-f0-9]{64}$/u.test(policySha256)||!ids.length||ids.some(id=>!z.uuid().safeParse(id).success)||new Set(ids).size!==ids.length)fail();
  const test=process.env.RUN_POSTGRES_INTEGRATION==="1"&&authorisedLocalDatabaseName().startsWith("savinggrace_test_run_");
  const scopeSha256=frozenManifest===undefined?hash(ids):hash(frozenManifest);
  if(frozenManifest!==undefined){
    const manifest=frozenManifest as {schemaVersion?:unknown;decision?:unknown;memberCount?:unknown;members?:Array<{sequence?:unknown;sermonId?:unknown}>}|undefined;
    if(manifest?.schemaVersion!==1||manifest.decision!=="D-157"||manifest.memberCount!==ids.length||
      !Array.isArray(manifest.members)||manifest.members.length!==ids.length||manifest.members.some((m,i)=>m.sequence!==i+1||m.sermonId!==ids[i]))fail();
  }
  if(!test&&(ids.length!==155||scopeSha256!==remainingReviewScopeSha256||frozenManifest===undefined))fail();
  const c=await guardedClient(pool);let discard=false;
  try{
    await c.query("SELECT id FROM sermons WHERE deleted_at IS NULL ORDER BY id FOR SHARE");
    const prior=(await c.query("SELECT scope_sha256,policy_sha256,member_count FROM remaining_ai_review_scopes WHERE id='D-157' FOR UPDATE")).rows[0];
    if(prior){
      const members=(await c.query("SELECT sermon_id FROM remaining_ai_review_members WHERE scope_id='D-157' ORDER BY sequence")).rows.map(r=>r.sermon_id);
      if(prior.scope_sha256!==scopeSha256||prior.policy_sha256!==policySha256||prior.member_count!==ids.length||canonicalReviewJson(members)!==canonicalReviewJson(ids))fail();
      await c.query("COMMIT");return{outcome:"unchanged",scopeSha256};
    }
    const actual=(await c.query("SELECT id FROM sermons WHERE deleted_at IS NULL ORDER BY id")).rows.map(r=>r.id);
    if(canonicalReviewJson([...ids].sort())!==canonicalReviewJson(actual))fail();
    await c.query("INSERT INTO remaining_ai_review_scopes(id,scope_sha256,policy_sha256,member_count) VALUES('D-157',$1,$2,$3)",[scopeSha256,policySha256,ids.length]);
    for(const[i,id]of ids.entries())await c.query("INSERT INTO remaining_ai_review_members(scope_id,sermon_id,sequence)VALUES('D-157',$1,$2)",[id,i+1]);
    await c.query("COMMIT");return{outcome:"created",scopeSha256};
  }catch{discard=await rollback(c);return fail();}finally{c.release(discard);}
}

export async function applyRemainingReview(pool:Pool,raw:RemainingReviewPacket):Promise<{outcome:"recorded"|"unchanged";recordedComponents:number;privateComplete:boolean}>{
  const parsed=remainingReviewPacketSchema.safeParse(raw);if(!parsed.success)fail();const packet=parsed.data;
  if(new Set(packet.components.map(r=>r.component)).size!==packet.components.length)fail();
  const c=await guardedClient(pool);let discard=false;
  try{
    const locked=(await c.query("SELECT id FROM sermons WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",[packet.sermonId])).rows[0];if(!locked)fail();
    // All normal writers take the parent lock first; child share locks additionally
    // protect relevant approval/source evidence until this decision commits.
    for(const table of ["sermon_transcripts","sermon_enrichment_sources","sermon_enrichment_reviews","sermon_enrichment_review_items","sermon_primary_passage_reviews","scripture_references","sermon_media","sermon_question_answers"])
      await c.query(`SELECT sermon_id FROM ${table} WHERE sermon_id=$1 FOR SHARE`,[packet.sermonId]);
    const s=await readRemainingReviewSnapshot(c,packet.sermonId);
    if(!s||s.scopeSha256!==packet.scopeSha256||s.policySha256!==packet.policySha256||s.status!=="draft"||s.publishedAt!==null)fail();
    const validated=packet.components.map(r=>validateRemainingComponent(r,s));
    let count=0;
    for(const r of validated){
      const requestSha256=hash({decision:packet.decision,scopeSha256:packet.scopeSha256,policySha256:packet.policySha256,sermonId:packet.sermonId,
        component:r,reviewedAt:packet.reviewedAt,provenance:packet.provenance});
      const previous=(await c.query("SELECT dependency_sha256 FROM sermon_ai_component_reviews WHERE scope_id='D-157' AND sermon_id=$1 AND component=$2 AND request_sha256=$3",[packet.sermonId,r.component,requestSha256])).rows[0];
      // Replay precedes unrelated row-version checks, but never relevant staleness.
      if(previous){if(previous.dependency_sha256!==s.dependencies[r.component])fail();continue;}
      if(s.rowVersion!==packet.expectedSermonVersion)fail();
      if(s.human[r.component]&&r.outcome!=="accepted_source_limitation")continue;
      await c.query(`INSERT INTO sermon_ai_component_reviews(scope_id,sermon_id,component,request_sha256,dependency_sha256,policy_sha256,outcome,assessment,provenance,reviewer_subject,reviewed_at)
        VALUES('D-157',$1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)`,[packet.sermonId,r.component,requestSha256,r.dependencySha256,packet.policySha256,r.outcome,JSON.stringify(r),JSON.stringify(packet.provenance),remainingReviewerSubject,packet.reviewedAt]);
      await audit(c,packet.sermonId,r.component,requestSha256);count++;
    }
    let projection=(await listRemainingReviews(c,[packet.sermonId])).get(packet.sermonId);if(!projection)fail();
    if(packet.requestPrivateCompletion&&projection.canComplete&&!projection.privateComplete){
      const dependencySha256=completionHash(s,projection.components),requestSha256=hash({decision:"D-157",component:"completion",sermonId:packet.sermonId,dependencySha256});
      await c.query(`INSERT INTO sermon_ai_component_reviews(scope_id,sermon_id,component,request_sha256,dependency_sha256,policy_sha256,outcome,assessment,provenance,reviewer_subject,reviewed_at)
        VALUES('D-157',$1,'completion',$2,$3,$4,'accepted',$5::jsonb,$6::jsonb,$7,$8)`,[packet.sermonId,requestSha256,dependencySha256,packet.policySha256,
        JSON.stringify({allCurrentComponents:true,substantiveDependencySha256:s.substantiveDependencySha256,humanApproval:false,publicationAuthorized:false}),JSON.stringify(packet.provenance),remainingReviewerSubject,packet.reviewedAt]);
      await audit(c,packet.sermonId,"completion",requestSha256);count++;
      projection=(await listRemainingReviews(c,[packet.sermonId])).get(packet.sermonId);if(!projection?.privateComplete)fail();
    }
    await c.query("COMMIT");return{outcome:count?"recorded":"unchanged",recordedComponents:count,privateComplete:projection.privateComplete};
  }catch{discard=await rollback(c);return fail();}finally{c.release(discard);}
}
async function audit(c:PoolClient,id:string,component:string,requestHash:string):Promise<void>{
  await c.query(`INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id)
    VALUES($1,'system',$2,'sermon',$3,'succeeded',$4::jsonb,$5)`,[remainingReviewerSubject,`sermon.ai_remaining_review.${component}`,id,JSON.stringify([`aiRemainingReview.${component}`]),requestHash]);
}

const assignmentCommon = z.object({decision:z.literal("D-157"),scopeSha256:z.string().regex(/^[a-f0-9]{64}$/u),
  policySha256:z.string().regex(/^[a-f0-9]{64}$/u),sermonId:z.uuid(),expectedSermonVersion:z.number().int().positive(),
  sourceSha256:z.string().regex(/^[a-f0-9]{64}$/u),reviewedAt:z.iso.datetime(),provenance:remainingReviewProvenanceSchema,
  rationale:z.string().trim().min(1).max(3000).refine(v=>!/[<>\u0000]/u.test(v))});
export const remainingSpeakerAssignmentSchema=assignmentCommon.extend({component:z.literal("speaker"),speakerId:z.uuid(),
  mediaId:z.uuid(),mediaTitleSha256:z.string().regex(/^[a-f0-9]{64}$/u)}).strict();
export const remainingPassageProposalSchema=assignmentCommon.extend({component:z.literal("passage"),
  passage:primaryPassageInputSchema,transcriptSha256:z.string().regex(/^[a-f0-9]{64}$/u),
  replacePendingProposal:z.object({referenceId:z.uuid(),referenceVersion:z.number().int().positive(),
    metadataSha256:z.string().regex(/^[a-f0-9]{64}$/u)}).strict().optional(),
  support:z.array(z.object({start:z.number().int().nonnegative(),end:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/u)}).strict()).min(1).max(20),
  primaryRatherThanIncidental:z.literal(true),exactGranularitySupported:z.literal(true)}).strict();
export type RemainingSpeakerAssignment=z.infer<typeof remainingSpeakerAssignmentSchema>;
export type RemainingPassageProposal=z.infer<typeof remainingPassageProposalSchema>;
function assignmentMetadata(s:RemainingReviewSnapshot,kind:"speaker"|"passage"):unknown {
  return kind==="speaker"?s.metadata.speaker:{passages:s.passageRows,review:s.passageReview};
}

/** Missing metadata or an exact-bound machine-only pending proposal may be
 * supported/refined. This creates neither a human passage decision nor an AI
 * component acceptance; the latter needs fresh bound review. */
async function applyMissingMetadata(pool:Pool,raw:RemainingSpeakerAssignment|RemainingPassageProposal):Promise<"recorded"|"unchanged">{
  const parsed=z.union([remainingSpeakerAssignmentSchema,remainingPassageProposalSchema]).safeParse(raw);if(!parsed.success)fail();const p=parsed.data;
  const c=await guardedClient(pool);let discard=false;
  try{
    await c.query("SELECT id FROM sermons WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",[p.sermonId]);
    const s=await readRemainingReviewSnapshot(c,p.sermonId);
    if(!s||s.status!=="draft"||s.publishedAt!==null||s.scopeSha256!==p.scopeSha256||s.policySha256!==p.policySha256||s.sourceSha256!==p.sourceSha256)fail();
    const requestSha256=hash(p),prior=(await c.query("SELECT output_sha256 FROM sermon_ai_metadata_assignments WHERE scope_id='D-157' AND sermon_id=$1 AND component=$2 AND request_sha256=$3",[p.sermonId,p.component,requestSha256])).rows[0];
    if(prior){if(prior.output_sha256!==hash(assignmentMetadata(s,p.component)))fail();await c.query("COMMIT");return"unchanged";}
    if(s.rowVersion!==p.expectedSermonVersion)fail();
    const previous=assignmentMetadata(s,p.component);
    if(p.component==="speaker"){
      if(s.speakerAvailable||s.metadata.speaker_id!==null)fail();
      const speaker=(await c.query("SELECT id,name FROM speakers WHERE id=$1 FOR SHARE",[p.speakerId])).rows[0];
      const media=s.mediaRows.find(m=>m.id===p.mediaId);
      if(!speaker||!media||reviewHash(media.title??"")!==p.mediaTitleSha256)fail();
      // Explicit canonical full-name identification only; never typical speaker,
      // stylistic inference, aliases, or a new taxonomy identity.
      const words=(v:string)=>v.normalize("NFKC").toLocaleLowerCase("en-AU").replace(/[^\p{L}\p{N}]+/gu," ").trim();
      if(!(` ${words(media.title)} `).includes(` ${words(speaker.name)} `))fail();
      await c.query("UPDATE sermons SET speaker_id=$2,row_version=row_version+1,updated_at=now(),updated_by_subject=$3 WHERE id=$1",[p.sermonId,p.speakerId,remainingReviewerSubject]);
    }else{
      if(!s.passageReview||s.passageReview.review_status!=="pending"||s.passageReview.reviewed_at!==null||s.passageReview.reviewed_by_subject!==null||s.existingHumanCompletedAt)fail();
      const replacement=p.replacePendingProposal,old=s.passageRows[0];
      if(replacement){
        // A caller cannot relabel an existing human decision or an unrelated
        // relationship as a machine proposal. Bind the entire prior metadata,
        // not just its generic parent row version.
        if(s.passageRows.length!==1||!old||old.id!==replacement.referenceId||old.row_version!==replacement.referenceVersion||
          hash(previous)!==replacement.metadataSha256||old.provenance!=="title_proposal"||old.review_status!=="proposed"||
          old.reviewer_subject!==null||old.reviewed_at!==null||old.relationship_role!=="primary"||!old.is_lead||
          !old.original_reference_text||![biblePassageParserVersion,primaryBookResolutionVersion].includes(old.parser_version))fail();
      }else if(s.passageRows.length)fail();
      if(p.passage.relationshipRole!=="primary"||!p.passage.isLead||p.transcriptSha256!==s.transcript.sha256)fail();
      for(const range of p.support)if(range.start>=range.end||range.end>s.transcript.body.length||reviewHash(s.transcript.body.slice(range.start,range.end))!==range.sha256)fail();
      const text=formatBiblePassage(p.passage),parser="d157-context-supported-private-proposal-v1";
      if(replacement){
        // Retain the original source wording and row identity. The old parser,
        // coordinates and review evidence remain in immutable assignment history.
        await c.query(`UPDATE scripture_references SET display_text=$2,canonical_book_id=$3,start_chapter=$4,start_verse=$5,
          end_chapter=$6,end_verse=$7,parse_status='exact',parser_version=$8,row_version=row_version+1,updated_at=now() WHERE id=$1`,
        [replacement.referenceId,text,p.passage.canonicalBookId,p.passage.startChapter,p.passage.startVerse,p.passage.endChapter,p.passage.endVerse,parser]);
      }else await c.query(`INSERT INTO scripture_references(sermon_id,display_text,canonical_book_id,start_chapter,start_verse,end_chapter,end_verse,display_order,parse_status,relationship_role,is_lead,original_reference_text,provenance,review_status,parser_version)
        VALUES($1,$2,$3,$4,$5,$6,$7,0,'exact','primary',true,$2,'title_proposal','proposed',$8)`,[p.sermonId,text,p.passage.canonicalBookId,p.passage.startChapter,p.passage.startVerse,p.passage.endChapter,p.passage.endVerse,parser]);
      // The pending review retains its original source kind. Complete original
      // evidence and the contextual refinement are preserved in immutable history.
      await c.query("UPDATE sermon_primary_passage_reviews SET proposal_outcome='proposed',evidence_sha256=$2,parser_version=$3,row_version=row_version+1,updated_at=now() WHERE sermon_id=$1",[p.sermonId,requestSha256,parser]);
      await c.query("UPDATE sermons SET row_version=row_version+1,updated_at=now(),updated_by_subject=$2 WHERE id=$1",[p.sermonId,remainingReviewerSubject]);
    }
    const after=await readRemainingReviewSnapshot(c,p.sermonId);if(!after)fail();
    const current=assignmentMetadata(after,p.component);
    await c.query(`INSERT INTO sermon_ai_metadata_assignments(scope_id,sermon_id,component,request_sha256,policy_sha256,input_sha256,output_sha256,evidence,previous_metadata,current_metadata,reviewer_subject)
      VALUES('D-157',$1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10)`,[p.sermonId,p.component,requestSha256,p.policySha256,hash(previous),hash(current),JSON.stringify(p),JSON.stringify(previous),JSON.stringify(current),remainingReviewerSubject]);
    await audit(c,p.sermonId,`${p.component}_source_assignment`,requestSha256);
    await c.query("COMMIT");return"recorded";
  }catch{discard=await rollback(c);return fail();}finally{c.release(discard);}
}
export const applyRemainingSpeakerAssignment=(pool:Pool,packet:RemainingSpeakerAssignment)=>applyMissingMetadata(pool,packet);
export const applyRemainingPassageProposal=(pool:Pool,packet:RemainingPassageProposal)=>applyMissingMetadata(pool,packet);

export const remainingSourceTermSpeakerAssignmentSchema=assignmentCommon.extend({component:z.literal("speaker"),
  sourceTermId:z.number().int().positive().refine(Number.isSafeInteger),canonicalName:z.string().trim().min(3).max(240).refine(v=>!/[<>\u0000]/u.test(v)),
  inventoryContentSha256:z.string().regex(/^[a-f0-9]{64}$/u),
  anchor:z.object({sermonId:z.uuid(),sourceSha256:z.string().regex(/^[a-f0-9]{64}$/u),mediaId:z.uuid(),
    mediaTitleSha256:z.string().regex(/^[a-f0-9]{64}$/u)}).strict()
}).strict();
export type RemainingSourceTermSpeakerAssignment=z.infer<typeof remainingSourceTermSpeakerAssignmentSchema>;

/** Explicit names and shared source terms can resolve missing speakers without
 * inventing aliases. Inventory bytes are verified independently; neither a
 * caller-supplied term nor a bare hash assertion establishes that mapping. */
export async function applyRemainingSourceTermSpeakerAssignment(pool:Pool,raw:RemainingSourceTermSpeakerAssignment,inventoryBytes:string):Promise<"recorded"|"unchanged">{
  const parsed=remainingSourceTermSpeakerAssignmentSchema.safeParse(raw);if(!parsed.success)fail();const p=parsed.data;
  let inventory:Row;try{inventory=JSON.parse(inventoryBytes);}catch{return fail();}
  const {integrity,...payload}=inventory;
  if(!integrity||reviewHash(JSON.stringify(payload))!==integrity.contentSha256||integrity.contentSha256!==p.inventoryContentSha256||!Array.isArray(payload.rows))fail();
  const test=process.env.RUN_POSTGRES_INTEGRATION==="1"&&authorisedLocalDatabaseName().startsWith("savinggrace_test_run_");
  if(!test&&(p.inventoryContentSha256!=="52b544e0a1620eb536c37a6e5cc2344593ee76619ff1222ed0348d1183602ddc"||payload.rows.length!==454))fail();
  const c=await guardedClient(pool);let discard=false;
  try{
    // A fixed catalogue lock serializes competing D-157 creations. Ordinary
    // taxonomy paths retain their existing unique/conflict constraints.
    await c.query("SELECT pg_advisory_xact_lock(72419157)");
    await c.query("SELECT id FROM sermons WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE",[[p.sermonId,p.anchor.sermonId]]);
    const s=await readRemainingReviewSnapshot(c,p.sermonId),anchor=await readRemainingReviewSnapshot(c,p.anchor.sermonId);
    if(!s||!anchor||s.status!=="draft"||s.publishedAt!==null||anchor.status!=="draft"||anchor.publishedAt!==null||
      s.scopeSha256!==p.scopeSha256||anchor.scopeSha256!==p.scopeSha256||s.policySha256!==p.policySha256||anchor.policySha256!==p.policySha256||
      s.sourceSha256!==p.sourceSha256||anchor.sourceSha256!==p.anchor.sourceSha256)fail();
    // Local pilot-import IDs are not production WordPress identities.
    if([s,anchor].some(x=>["phase3b2-caption-v1","phase3b2b-punctuation-v2"].includes(x.source?.processing_version)))fail();
    const sourceRows=[s,anchor].map(x=>{
      const matches=payload.rows.filter((row:Row)=>String(row.sourceId)===String(x.metadata.source_wordpress_id));
      if(matches.length!==1)fail();const row=matches[0];
      if(row.speaker?.relationshipCount!==1||row.speaker.relationshipTermIds===null||String(row.speaker.relationshipTermIds)!==String(p.sourceTermId))fail();
      return row;
    });
    const media=anchor.mediaRows.find(m=>m.id===p.anchor.mediaId&&m.provider==="youtube");
    if(!media||anchor.source?.retrieval_attribution!=="authorised_youtube_data_api"||reviewHash(media.title??"")!==p.anchor.mediaTitleSha256||!anchor.mediaAvailable)fail();
    const words=(v:string)=>v.normalize("NFKC").toLocaleLowerCase("en-AU").replace(/[^\p{L}\p{N}]+/gu," ").trim();
    if(words(p.canonicalName).split(" ").length<2||!(` ${words(media.title)} `).includes(` ${words(p.canonicalName)} `))fail();
    const requestSha256=hash(p),prior=(await c.query("SELECT output_sha256 FROM sermon_ai_metadata_assignments WHERE scope_id='D-157' AND sermon_id=$1 AND component='speaker' AND request_sha256=$2",[p.sermonId,requestSha256])).rows[0];
    if(prior){if(prior.output_sha256!==hash(assignmentMetadata(s,"speaker")))fail();await c.query("COMMIT");return"unchanged";}
    if(s.rowVersion!==p.expectedSermonVersion||s.metadata.speaker_id!==null||s.speakerAvailable)fail();
    // Current metadata saves emit the dedicated event only for a real speaker
    // change. Generic sermon.update lists submitted fields even when unchanged,
    // so it alone cannot fabricate a human clearing. Preserve older explicit
    // metadata-update speaker decisions as well.
    if((await c.query(`SELECT EXISTS(SELECT 1 FROM audit_events WHERE entity_id=$1 AND actor_role='admin' AND outcome='succeeded'
      AND (action='sermon.speaker_assignment_updated' OR action='sermon.metadata_updated' AND changed_fields @> '["speakerId"]'::jsonb)) AS present`,[p.sermonId])).rows[0]?.present)fail();
    const slug=p.canonicalName.normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    if(!slug||slug.length>240)fail();
    const catalogue=(await c.query("SELECT id,name,slug,source_term_id FROM speakers ORDER BY id FOR SHARE")).rows;
    const matches=catalogue.filter(v=>words(v.name)===words(p.canonicalName)||v.slug===slug||String(v.source_term_id)===String(p.sourceTermId));
    let speaker=matches[0];
    if(matches.length>1||speaker&&(speaker.name!==p.canonicalName||speaker.slug!==slug||speaker.source_term_id!==null&&String(speaker.source_term_id)!==String(p.sourceTermId)))fail();
    const transaction=new PostgresAdminSermonTransaction(c),previous=assignmentMetadata(s,"speaker");
    if(!speaker){
      const created=await transaction.insertTaxonomy("speakers",{name:p.canonicalName,slug,description:null,canonicalBookId:null});
      await c.query("UPDATE speakers SET source_term_id=$2 WHERE id=$1",[created.id,p.sourceTermId]);
      speaker={id:created.id,name:p.canonicalName,slug,source_term_id:String(p.sourceTermId)};
      await transaction.appendAudit({actorSubject:remainingReviewerSubject,actorRole:"system",action:"speaker.d157_source_reference_created",entityType:"speaker",entityId:created.id,
        changedFields:["name","slug","sourceTermId"],requestCorrelationId:requestSha256,outcome:"succeeded"});
    }
    await c.query("UPDATE sermons SET speaker_id=$2,row_version=row_version+1,updated_at=now(),updated_by_subject=$3 WHERE id=$1",[p.sermonId,speaker.id,remainingReviewerSubject]);
    const after=await readRemainingReviewSnapshot(c,p.sermonId);if(!after)fail();const current=assignmentMetadata(after,"speaker");
    const evidence={packet:p,inventoryFileSha256:reviewHash(inventoryBytes),sourceRowHashes:sourceRows.map(hash)};
    await c.query(`INSERT INTO sermon_ai_metadata_assignments(scope_id,sermon_id,component,request_sha256,policy_sha256,input_sha256,output_sha256,evidence,previous_metadata,current_metadata,reviewer_subject)
      VALUES('D-157',$1,'speaker',$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)`,[p.sermonId,requestSha256,p.policySha256,hash(previous),hash(current),JSON.stringify(evidence),JSON.stringify(previous),JSON.stringify(current),remainingReviewerSubject]);
    await audit(c,p.sermonId,"speaker_source_assignment",requestSha256);
    await c.query("COMMIT");return"recorded";
  }catch{discard=await rollback(c);return fail();}finally{c.release(discard);}
}

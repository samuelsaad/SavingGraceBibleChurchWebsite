import type {Pool,PoolClient} from "pg";
import {z} from "zod";
import {authorisedLocalDatabaseName} from "../migration/local-database-safety";
import {evaluateReviewSetIntegrity,reviewSetSha256} from "../enrichment/review-set-integrity";
import {contentHash,reviewHash,sourceProvenanceHash,type AiContent} from "../domain/delegated-ai-review";
import {remainingComponents,type RemainingComponent,type RemainingReviewValidationContext} from "../domain/remaining-ai-review";
import {d167CanonicalSpeakerInMediaTitle,d167ComponentPacketSchema,d167ContentReviewSchema,d167Decision,d167Hash,
  d167ReviewerSubject,d167SourceManifest,d167SpeakerAssignmentSchema,validateD167ComponentPacket,validateD167ContentReview,
  type D167ComponentPacket,type D167ContentReview,type D167SpeakerAssignment} from "../domain/d167-review";

type Row=Record<string,any>;
const fail=(code="d167_review_evidence_or_concurrency_conflict"):never=>{throw new Error(code);};
async function guarded(pool:Pool):Promise<PoolClient>{
  if(process.env.ALLOW_LOCAL_DB_WRITE!=="1")fail("d167_review_write_gate_required");
  let name:string;try{name=authorisedLocalDatabaseName();}catch{return fail("d167_review_target_mismatch");}
  const c=await pool.connect().catch(()=>fail("d167_review_connection_failed"));
  try{const ok=(await c.query("SELECT current_database()=$1 AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AS ok",[name])).rows[0]?.ok;
    if(!ok)fail("d167_review_target_mismatch");await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");await c.query("SET LOCAL savinggrace.application_request='on'");return c;
  }catch{try{await c.query("ROLLBACK");c.release();}catch{c.release(true);}return fail("d167_review_target_mismatch");}
}
async function rollback(c:PoolClient):Promise<boolean>{try{await c.query("ROLLBACK");return false;}catch{return true;}}

export async function bindD167Scope(pool:Pool,members:Array<{sequence:number;sermonId:string}>,policySha256:string):Promise<"created"|"unchanged">{
  const ids=members.map(member=>member.sermonId);
  if(members.length<1||members.length>36||new Set(ids).size!==members.length||new Set(members.map(member=>member.sequence)).size!==members.length||
    members.some((member,index)=>member.sequence<1||member.sequence>36||
      (index>0&&member.sequence<=members[index-1]!.sequence)||!z.uuid().safeParse(member.sermonId).success)||
    !/^[a-f0-9]{64}$/u.test(policySha256))fail();
  const c=await guarded(pool);let discard=false;
  try{
    const rows=(await c.query(`SELECT s.id FROM sermons s JOIN sermon_enrichment_sources es ON es.sermon_id=s.id
      WHERE s.id=ANY($1::uuid[]) AND s.deleted_at IS NULL AND s.source_status='phase3b2c_evaluation_36_batch_8_private'
      AND es.processing_version='phase3b2c-evaluation-36-d167-v1' ORDER BY array_position($1::uuid[],s.id) FOR SHARE OF s,es`,[ids])).rows;
    if(rows.length!==members.length||rows.some((r,i)=>r.id!==ids[i]))fail();
    const existing=(await c.query("SELECT id,scope_sha256,policy_sha256,member_count FROM delegated_ai_review_scopes WHERE id='D-167' FOR UPDATE")).rows[0];
    if(existing){
      const stored=(await c.query("SELECT sequence,sermon_id AS \"sermonId\" FROM delegated_ai_review_members WHERE scope_id='D-167' ORDER BY sequence")).rows;
      if(existing.scope_sha256!==d167SourceManifest||existing.policy_sha256!==policySha256||existing.member_count!==members.length||d167Hash(stored)!==d167Hash(members))fail();
      const component=(await c.query("SELECT scope_sha256,policy_sha256,member_count FROM remaining_ai_review_scopes WHERE id='D-167' FOR UPDATE")).rows[0];
      if(!component||component.scope_sha256!==d167SourceManifest||component.policy_sha256!==policySha256||component.member_count!==members.length)fail();
      await c.query("COMMIT");return"unchanged";
    }
    await c.query("INSERT INTO delegated_ai_review_scopes(id,scope_sha256,policy_sha256,member_count) VALUES('D-167',$1,$2,$3)",[d167SourceManifest,policySha256,members.length]);
    await c.query("INSERT INTO remaining_ai_review_scopes(id,scope_sha256,policy_sha256,member_count) VALUES('D-167',$1,$2,$3)",[d167SourceManifest,policySha256,members.length]);
    for(const member of members){
      await c.query("INSERT INTO delegated_ai_review_members(scope_id,sermon_id,sequence) VALUES('D-167',$1,$2)",[member.sermonId,member.sequence]);
      await c.query("INSERT INTO remaining_ai_review_members(scope_id,sermon_id,sequence) VALUES('D-167',$1,$2)",[member.sermonId,member.sequence]);
    }
    await c.query("COMMIT");return"created";
  }catch{discard=await rollback(c);return fail();}finally{c.release(discard);}
}

export async function applyD167ContentReview(pool:Pool,raw:D167ContentReview):Promise<"recorded"|"unchanged">{
  const parsed=d167ContentReviewSchema.safeParse(raw);if(!parsed.success)return fail();const review=parsed.data;
  const c=await guarded(pool);let discard=false;
  try{
    const scope=(await c.query(`SELECT sc.policy_sha256 FROM delegated_ai_review_members m JOIN delegated_ai_review_scopes sc ON sc.id=m.scope_id
      WHERE m.scope_id='D-167' AND m.sermon_id=$1 FOR SHARE OF sc,m`,[review.sermonId])).rows[0];
    if(!scope||scope.policy_sha256!==review.policySha256)fail();
    const s=(await c.query("SELECT * FROM sermons WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",[review.sermonId])).rows[0];
    const t=(await c.query("SELECT body_text,grounding_revision_id FROM sermon_transcripts WHERE sermon_id=$1 FOR UPDATE",[review.sermonId])).rows[0];
    const source=(await c.query("SELECT source_content_sha256,to_jsonb(es) provenance FROM sermon_enrichment_sources es WHERE sermon_id=$1 FOR SHARE",[review.sermonId])).rows[0];
    if(!s||!t||!source||s.status!=="draft"||s.published_at!==null||s.row_version!==review.expectedSermonVersion||t.grounding_revision_id!==review.groundingRevisionId||source.source_content_sha256!==review.sourceSha256||sourceProvenanceHash(source.provenance)!==review.sourceProvenanceSha256)fail();
    const r=validateD167ContentReview(review,t.body_text);let current:AiContent,version:number,human:boolean;
    if(r.artifactKey==="description"){current={description:s.summary};version=s.summary_row_version;human=s.summary_status==="approved"||s.summary_approved_at!==null;}
    else{const q=(await c.query("SELECT * FROM sermon_question_answers WHERE sermon_id=$1 AND id=$2 FOR UPDATE",[r.sermonId,r.artifactKey.slice(3)])).rows[0];
      if(!q||q.display_order!==r.displayOrder)fail();current={question:q.question_text,answer:q.answer_text};version=q.row_version;human=q.status==="approved"||q.approved_at!==null;}
    const request=d167Hash(r),prior=(await c.query("SELECT output_sha256,output_version FROM sermon_ai_content_reviews WHERE scope_id='D-167' AND sermon_id=$1 AND artifact_key=$2 AND request_sha256=$3",[r.sermonId,r.artifactKey,request])).rows[0];
    if(prior){if(contentHash(current)!==prior.output_sha256||version!==prior.output_version)fail();await c.query("COMMIT");return"unchanged";}
    if(human||version!==r.inputVersion||contentHash(current)!==r.inputSha256)fail();
    const used=(await c.query("SELECT correction_round FROM sermon_ai_content_reviews WHERE scope_id='D-167' AND sermon_id=$1 AND artifact_key=$2",[r.sermonId,r.artifactKey])).rows.some(q=>q.correction_round===1);
    if(r.correctionRound===1&&used)fail();
    if(r.outcome==="corrected_accepted"){
      if('description'in r.output)await c.query("UPDATE sermons SET summary=$2,summary_row_version=summary_row_version+1,row_version=row_version+1,summary_updated_at=now(),updated_at=now(),updated_by_subject=$3 WHERE id=$1",[r.sermonId,r.output.description,d167ReviewerSubject]);
      else{await c.query("UPDATE sermon_question_answers SET question_text=$2,answer_text=$3,row_version=row_version+1,updated_at=now() WHERE id=$1",[r.artifactKey.slice(3),r.output.question,r.output.answer]);
        await c.query("UPDATE sermons SET row_version=row_version+1,updated_at=now(),updated_by_subject=$2 WHERE id=$1",[r.sermonId,d167ReviewerSubject]);}
    }
    const outputVersion=r.inputVersion+(r.outcome==="corrected_accepted"?1:0);
    await c.query(`INSERT INTO sermon_ai_content_reviews(scope_id,sermon_id,artifact_key,request_sha256,policy_sha256,transcript_sha256,grounding_revision_id,source_sha256,input_sha256,output_sha256,input_version,output_version,outcome,correction_round,original_content,current_content,evidence,coverage,assessment,provenance,reviewer_subject,reviewed_at)
      VALUES('D-167',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20,$21)`,[r.sermonId,r.artifactKey,request,r.policySha256,r.transcriptSha256,r.groundingRevisionId,r.sourceSha256,r.inputSha256,r.outputSha256,r.inputVersion,outputVersion,r.outcome,r.correctionRound,JSON.stringify(r.original),JSON.stringify(r.output),JSON.stringify(r.evidence),JSON.stringify(r.coverage),JSON.stringify({...r.assessment,artifactDisplayOrder:r.displayOrder}),JSON.stringify({...r.provenance,source_provenance_sha256:r.sourceProvenanceSha256}),d167ReviewerSubject,r.reviewedAt]);
    await c.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id) VALUES($1,'system',$2,'sermon',$3,'succeeded',$4::jsonb,$5)",[d167ReviewerSubject,`sermon.d167.content.${r.outcome}`,r.sermonId,JSON.stringify([r.artifactKey]),request]);
    await c.query("COMMIT");return"recorded";
  }catch{discard=await rollback(c);return fail();}finally{c.release(discard);}
}

/** Assigns a missing D-167 speaker only from an existing canonical full name
 * explicitly present in the retained media title. This creates no human
 * decision and requires a fresh component review after the row-version change. */
export async function applyD167SpeakerAssignment(pool:Pool,raw:D167SpeakerAssignment):Promise<"recorded"|"unchanged">{
  const parsed=d167SpeakerAssignmentSchema.safeParse(raw);if(!parsed.success)return fail();const request=parsed.data;
  const c=await guarded(pool);let discard=false;
  try{
    const s=await readD167Snapshot(c,request.sermonId);if(!s||s.policySha256!==request.policySha256||
      s.status!=="draft"||s.publishedAt!==null||s.sourceSha256!==request.sourceSha256)return fail();
    const requestSha256=d167Hash(request),prior=(await c.query("SELECT output_sha256 FROM sermon_ai_metadata_assignments WHERE scope_id='D-167' AND sermon_id=$1 AND component='speaker' AND request_sha256=$2",[request.sermonId,requestSha256])).rows[0];
    if(prior){const current=d167Hash({speaker:s.metadata.speaker});if(prior.output_sha256!==current)fail();await c.query("COMMIT");return"unchanged";}
    if(s.rowVersion!==request.expectedSermonVersion||s.speakerAvailable||s.metadata.speaker!==null)fail();
    const speaker=(await c.query("SELECT id,name FROM speakers WHERE id=$1 FOR SHARE",[request.speakerId])).rows[0],media=s.media.find(m=>m.id===request.mediaId);
    if(!speaker||!media||reviewHash(media.title??"")!==request.mediaTitleSha256||!d167CanonicalSpeakerInMediaTitle(media.title??"",speaker.name))fail();
    const previous={speaker:s.metadata.speaker};
    await c.query("UPDATE sermons SET speaker_id=$2,row_version=row_version+1,updated_at=now(),updated_by_subject=$3 WHERE id=$1",[request.sermonId,request.speakerId,d167ReviewerSubject]);
    const after=await readD167Snapshot(c,request.sermonId);if(!after||!after.speakerAvailable)return fail();const current={speaker:after.metadata.speaker};
    await c.query(`INSERT INTO sermon_ai_metadata_assignments(scope_id,sermon_id,component,request_sha256,policy_sha256,input_sha256,output_sha256,evidence,previous_metadata,current_metadata,reviewer_subject)
      VALUES('D-167',$1,'speaker',$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)`,[request.sermonId,requestSha256,request.policySha256,d167Hash(previous),d167Hash(current),JSON.stringify(request),JSON.stringify(previous),JSON.stringify(current),d167ReviewerSubject]);
    await c.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id) VALUES($1,'system','sermon.d167.speaker_source_assignment','sermon',$2,'succeeded','[\"speakerId\"]'::jsonb,$3)",[d167ReviewerSubject,request.sermonId,requestSha256]);
    await c.query("COMMIT");return"recorded";
  }catch{discard=await rollback(c);return fail();}finally{c.release(discard);}
}

export interface D167Snapshot extends RemainingReviewValidationContext{
  sermonId:string;rowVersion:number;policySha256:string;status:string;publishedAt:string|null;substantiveComplete:boolean;
  metadata:Row;source:Row;workflow:Row;questions:Row[];findingsRows:Row[];passages:Row[];passageReview:Row|null;media:Row[];
}
export async function readD167Snapshot(db:Pool|PoolClient,sermonId:string):Promise<D167Snapshot|null>{
  if(!z.uuid().safeParse(sermonId).success)fail();
  const r=(await db.query(`SELECT to_jsonb(s) sermon,to_jsonb(t) transcript,to_jsonb(es) source,to_jsonb(w) workflow,to_jsonb(p) passage_review,to_jsonb(cr) readiness,to_jsonb(sp) speaker,sc.policy_sha256,
    COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.display_order,i.id) FROM sermon_enrichment_review_items i WHERE i.sermon_id=s.id),'[]') items,
    COALESCE((SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.display_order,pr.id) FROM scripture_references pr WHERE pr.sermon_id=s.id),'[]') passages,
    COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.display_order,m.id) FROM sermon_media m WHERE m.sermon_id=s.id),'[]') media,
    COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order,q.id) FROM sermon_question_answers q WHERE q.sermon_id=s.id),'[]') questions
    FROM remaining_ai_review_members member JOIN remaining_ai_review_scopes sc ON sc.id=member.scope_id JOIN sermons s ON s.id=member.sermon_id
    LEFT JOIN sermon_transcripts t ON t.sermon_id=s.id LEFT JOIN sermon_enrichment_sources es ON es.sermon_id=s.id LEFT JOIN sermon_enrichment_reviews w ON w.sermon_id=s.id
    LEFT JOIN sermon_primary_passage_reviews p ON p.sermon_id=s.id LEFT JOIN sermon_content_readiness cr ON cr.sermon_id=s.id LEFT JOIN speakers sp ON sp.id=s.speaker_id
    WHERE member.scope_id='D-167' AND s.id=$1 AND s.deleted_at IS NULL`,[sermonId])).rows[0];if(!r)return null;
  const s=r.sermon,t=r.transcript,source=r.source,w=r.workflow,items=r.items as Row[],questions=r.questions as Row[],passages=r.passages as Row[],media=r.media as Row[],body=String(t?.body_text??"");
  const atomic=items.filter(i=>typeof i.item_identity_sha256==="string"),integrity=evaluateReviewSetIntegrity({sourceRecordKey:w?.source_record_key??null,expectedItemCount:w?.expected_item_count??null,
    expectedItemSetSha256:w?.expected_item_set_sha256??null,databaseItemSetSha256:reviewSetSha256(atomic.map(i=>i.item_identity_sha256)),expectedTranscriptSha256:w?.expected_transcript_sha256??null,
    expectedTranscriptRowVersion:w?.expected_transcript_row_version??null,storedItemCount:items.length,atomicItemCount:atomic.length,transcriptBody:body,transcriptRowVersion:t?.row_version??null,
    emptyItemSetAcknowledged:!!w?.empty_item_set_acknowledged_at&&!!w?.empty_item_set_acknowledged_by_subject,items:atomic.map(i=>({identitySha256:i.item_identity_sha256,sourceRecordKey:i.source_record_key,displayOrder:i.display_order,transcriptRowVersion:i.transcript_row_version,decisionStatus:i.decision_status}))});
  const transcriptSha256=reviewHash(body),sourceDependency={provider:source?.provider,video_id:source?.video_id,canonical_url:source?.canonical_url,caption_language:source?.caption_language,caption_track_type:source?.caption_track_type,source_content_sha256:source?.source_content_sha256,retrieval_attribution:source?.retrieval_attribution,processing_version:source?.processing_version,warnings:source?.warnings,unresolved_passages:source?.unresolved_passages,uncertainty_marker_count:source?.uncertainty_marker_count,apparent_completeness:source?.apparent_completeness};
  const transcriptDependency={grounding_revision_id:t?.grounding_revision_id,source_kind:t?.source_kind,source_reference:t?.source_reference,status:t?.status,sha256:transcriptSha256};
  const metadata={id:s.id,source_wordpress_id:s.source_wordpress_id,title:s.title,slug:s.slug,service_date:s.service_date,speaker:r.speaker,source:sourceDependency,passages};
  const identityAvailable=!!w&&!!s.title&&!!s.service_date&&!!source?.video_id&&!!w.source_record_key,speakerAvailable=!!s.speaker_id&&!!r.speaker?.id;
  const passageAvailable=passages.some(q=>q.relationship_role==="primary"&&q.canonical_book_id!==null&&["proposed","confirmed"].includes(q.review_status));
  const mediaAvailable=media.some(m=>m.provider==="youtube"&&m.external_id===source?.video_id&&m.canonical_url);
  const dependencies:Record<RemainingComponent,string>={identity:d167Hash({source:sourceDependency,fields:{id:s.id,source_wordpress_id:s.source_wordpress_id,title:s.title,slug:s.slug,service_date:s.service_date}}),
    speaker:d167Hash({source:sourceDependency,speaker:r.speaker}),transcript:d167Hash({source:sourceDependency,transcript:transcriptDependency}),findings:d167Hash({source:sourceDependency,transcript:transcriptDependency,workflow:w,items}),
    passage:d167Hash({source:sourceDependency,transcript:transcriptDependency,passages,review:r.passage_review}),media:d167Hash({source:sourceDependency,media})};
  const reviews=(await db.query("SELECT DISTINCT ON (artifact_key) artifact_key,output_sha256,output_version,outcome,transcript_sha256,grounding_revision_id FROM sermon_ai_content_reviews WHERE scope_id='D-167' AND sermon_id=$1 ORDER BY artifact_key,created_at DESC,id DESC",[sermonId])).rows;
  const description=reviews.find(q=>q.artifact_key==="description"),descriptionCurrent=description&&["accepted","corrected_accepted"].includes(description.outcome)&&description.output_sha256===contentHash({description:s.summary})&&description.output_version===s.summary_row_version&&description.transcript_sha256===transcriptSha256&&description.grounding_revision_id===t?.grounding_revision_id;
  const qaCurrent=questions.length>=5&&questions.length<=10&&questions.every((q,i)=>{const review=reviews.find(x=>x.artifact_key===`qa:${q.id}`);return q.display_order===i+1&&review&&["accepted","corrected_accepted"].includes(review.outcome)&&review.output_sha256===contentHash({question:q.question_text,answer:q.answer_text})&&review.output_version===q.row_version&&review.transcript_sha256===transcriptSha256&&review.grounding_revision_id===t?.grounding_revision_id;});
  return{sermonId:s.id,rowVersion:s.row_version,policySha256:r.policy_sha256,status:s.status,publishedAt:s.published_at,substantiveComplete:!!descriptionCurrent&&qaCurrent,dependencies,
    transcript:{body,sha256:transcriptSha256,humanApproved:t?.status==="approved"},sourceSha256:source?.source_content_sha256??null,sourceProvenanceSha256:d167Hash(source),metadataSha256:d167Hash(metadata),priorEvidence:[],officialEvidenceHashes:[],identityAvailable,speakerAvailable,passageAvailable,mediaAvailable,findingsVerified:integrity.reviewSetVerified,
    findings:atomic.map(i=>({identitySha256:i.item_identity_sha256,humanStatus:i.decision_status})),humanConflicts:{identity:false,speaker:false,findings:items.some(i=>["left_unresolved","rejected"].includes(i.decision_status)),transcript:false,passage:r.passage_review?.review_status==="rejected",media:false},metadata,source,workflow:w,questions,findingsRows:items,passages,passageReview:r.passage_review,media};
}

export async function applyD167Components(pool:Pool,raw:D167ComponentPacket):Promise<"recorded"|"unchanged">{
  const parsed=d167ComponentPacketSchema.safeParse(raw);if(!parsed.success)return fail();const requested=parsed.data;
  const c=await guarded(pool);let discard=false;
  try{
    const loaded=await readD167Snapshot(c,requested.sermonId);if(loaded===null)return fail();
    const s:D167Snapshot=loaded;
    if(s.policySha256!==requested.policySha256||s.rowVersion!==requested.expectedSermonVersion||s.status!=="draft"||s.publishedAt!==null)return fail();
    const packet=validateD167ComponentPacket(requested,s);let changed=false;
    for(const component of packet.components){const request=d167Hash({decision:d167Decision,sermonId:packet.sermonId,policySha256:packet.policySha256,component,provenance:packet.provenance,reviewedAt:packet.reviewedAt});
      const prior=(await c.query("SELECT dependency_sha256 FROM sermon_ai_component_reviews WHERE scope_id='D-167' AND sermon_id=$1 AND component=$2 AND request_sha256=$3",[packet.sermonId,component.component,request])).rows[0];
      if(prior){if(prior.dependency_sha256!==component.dependencySha256)fail();continue;}
      await c.query(`INSERT INTO sermon_ai_component_reviews(scope_id,sermon_id,component,request_sha256,dependency_sha256,policy_sha256,outcome,assessment,provenance,reviewer_subject,reviewed_at)
        VALUES('D-167',$1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)`,[packet.sermonId,component.component,request,component.dependencySha256,packet.policySha256,component.outcome,JSON.stringify(component),JSON.stringify(packet.provenance),d167ReviewerSubject,packet.reviewedAt]);changed=true;}
    if(packet.requestPrivateCompletion){
      if(!s.substantiveComplete||packet.components.length!==6||packet.components.some(q=>q.outcome==="needs_human"))fail();
      const dependency=d167Hash({scope:d167SourceManifest,policy:s.policySha256,components:remainingComponents.map(key=>{const q=packet.components.find(v=>v.component===key)!;return{component:key,dependency:q.dependencySha256,outcome:q.outcome};}),substantive:true,status:s.status,publishedAt:s.publishedAt});
      const request=d167Hash({decision:d167Decision,component:"completion",sermonId:packet.sermonId,dependency});
      const prior=(await c.query("SELECT dependency_sha256 FROM sermon_ai_component_reviews WHERE scope_id='D-167' AND sermon_id=$1 AND component='completion' AND request_sha256=$2",[packet.sermonId,request])).rows[0];
      if(prior){if(prior.dependency_sha256!==dependency)fail();}
      else{await c.query(`INSERT INTO sermon_ai_component_reviews(scope_id,sermon_id,component,request_sha256,dependency_sha256,policy_sha256,outcome,assessment,provenance,reviewer_subject,reviewed_at)
        VALUES('D-167',$1,'completion',$2,$3,$4,'accepted',$5::jsonb,$6::jsonb,$7,$8)`,[packet.sermonId,request,dependency,packet.policySha256,JSON.stringify({decision:d167Decision,allRequirementsSatisfied:true}),JSON.stringify(packet.provenance),d167ReviewerSubject,packet.reviewedAt]);changed=true;}
    }
    if(changed)await c.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id) VALUES($1,'system','sermon.d167.private_review_recorded','sermon',$2,'succeeded',$3::jsonb,$4)",[d167ReviewerSubject,packet.sermonId,JSON.stringify(packet.components.map(q=>q.component)),d167Hash(packet)]);
    await c.query("COMMIT");return changed?"recorded":"unchanged";
  }catch{discard=await rollback(c);return fail();}finally{c.release(discard);}
}

export async function listD167Completion(db:Pool|PoolClient){
  return(await db.query(`SELECT m.sequence,m.sermon_id,
    EXISTS(SELECT 1 FROM sermon_ai_component_reviews r WHERE r.scope_id='D-167' AND r.sermon_id=m.sermon_id AND r.component='completion' AND r.outcome='accepted') AS complete,
    (SELECT count(*)::int FROM sermon_ai_content_reviews r WHERE r.scope_id='D-167' AND r.sermon_id=m.sermon_id AND r.outcome IN ('accepted','corrected_accepted')) AS accepted_content,
    (SELECT count(*)::int FROM sermon_ai_content_reviews r WHERE r.scope_id='D-167' AND r.sermon_id=m.sermon_id AND r.outcome='needs_human') AS content_exceptions,
    (SELECT count(*)::int FROM sermon_ai_component_reviews r WHERE r.scope_id='D-167' AND r.sermon_id=m.sermon_id AND r.component<>'completion' AND r.outcome='needs_human') AS component_exceptions
    FROM remaining_ai_review_members m WHERE m.scope_id='D-167' ORDER BY m.sequence`)).rows;
}

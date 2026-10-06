import type {Pool,PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {localWordingReviewSchema,localWordingScopeSha256,localWordingNamespace,localWordingActor,localWordingAction,localWordingDependencySql,validateLocalWordingScope} from '../domain/local-wording-completion';
import {authorisedLocalDatabaseName} from '../migration/local-database-safety';
import {compareRetainedCaptionTranscript} from '../enrichment/remaining-caption-comparison';
import {inspectGeneratedText} from '../enrichment/generated-text-mechanical-qa';
import {groundedSermonEnrichmentSourceReference} from '../enrichment/sermon-enrichment-policy';
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
export async function readLocalWordingDependency(db:PoolClient,id:string){return (await db.query(`SELECT ${localWordingDependencySql('s')} hash FROM sermons s WHERE id=$1`,[id])).rows[0]?.hash as string|undefined;}
export async function applyLocalWordingCompletion(pool:Pool,ids:string[],raw:unknown,captionBytes?:Uint8Array){
 const input=localWordingReviewSchema.parse(raw);
 const test=process.env.RUN_POSTGRES_INTEGRATION==='1';
 const dbName=authorisedLocalDatabaseName();
 if(process.env.ALLOW_LOCAL_DB_WRITE!=='1')throw Error('local_write_gate_required');
 if(!test)validateLocalWordingScope(ids);
 if(input.scopeSha256!==localWordingScopeSha256||!ids.includes(input.sermonId))throw Error('local_wording_scope_refused');
 const db=await pool.connect();try{
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query("SET LOCAL TIME ZONE 'UTC'");await db.query("SET LOCAL savinggrace.application_request='on'");
  const target=(await db.query("SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port,current_setting('server_version_num')::int version")).rows[0];
  if(target.db!==dbName||target.host!=='127.0.0.1'||target.port!==5432||target.version<160000||target.version>=170000)throw Error('local_target_refused');
  const sermon=(await db.query('SELECT * FROM sermons WHERE id=$1 FOR UPDATE',[input.sermonId])).rows[0];
  if(!sermon||sermon.status!=='draft'||sermon.published_at!==null||sermon.deleted_at!==null)throw Error('private_draft_required');
  const prior=(await db.query('SELECT payload FROM sermon_extensions WHERE sermon_id=$1 AND namespace=$2 FOR UPDATE',[input.sermonId,localWordingNamespace])).rows[0];
  const originalReviewHash=(await db.query("SELECT encode(digest($1::jsonb::text,'sha256'),'hex') hash",[JSON.stringify(input)])).rows[0].hash;
  const dependency=await readLocalWordingDependency(db,input.sermonId);
  if(prior){
   if(prior.payload.reviewHash!==originalReviewHash||prior.payload.dependencySha256!==dependency)throw Error('existing_local_completion_conflict');
   const audit=(await db.query("SELECT count(*)::int n FROM audit_events WHERE entity_id=$1 AND entity_type='sermon' AND action=$2 AND actor_subject=$3 AND actor_role='system' AND outcome='succeeded' AND request_correlation_id=$4",[input.sermonId,localWordingAction,localWordingActor,localWordingScopeSha256+':'+(await db.query("SELECT encode(digest($1::jsonb::text,'sha256'),'hex') hash",[JSON.stringify(prior.payload)])).rows[0].hash])).rows[0].n;
   if(audit!==1)throw Error('completion_audit_missing');await db.query('COMMIT');return {outcome:'unchanged' as const,corrected:false};
  }
  if(sermon.row_version!==input.expectedRowVersion||dependency!==input.expectedDependencySha256)throw Error('concurrent_record_change');
  const transcript=(await db.query('SELECT * FROM sermon_transcripts WHERE sermon_id=$1 FOR UPDATE',[input.sermonId])).rows[0];
  const source=(await db.query('SELECT * FROM sermon_enrichment_sources WHERE sermon_id=$1 FOR UPDATE',[input.sermonId])).rows[0];
  const questions=(await db.query('SELECT * FROM sermon_question_answers WHERE sermon_id=$1 ORDER BY display_order FOR UPDATE',[input.sermonId])).rows;
  if(!transcript||!source||hash(sermon.summary??'')!==input.descriptionSha256||hash(JSON.stringify(questions.map(q=>({question:q.question_text,answer:q.answer_text,order:q.display_order}))))!==(input.originalQuestionsSha256??input.questionsSha256)||source.source_content_sha256!==input.sourceSha256||input.questionAnswersRead!==questions.length||input.transcriptCharactersRead!==transcript.body_text.length)throw Error('reading_evidence_mismatch');
  if(input.sourceAvailable&&(!captionBytes||hash(captionBytes)!==source.source_content_sha256))throw Error('retained_source_integrity_required');
  let correctionLineage:unknown=null;
  if(input.correction){
   const fix=input.correction;
   if(transcript.status==='approved'||sermon.summary_status==='approved'||questions.some(q=>q.status==='approved'))throw Error('human_approval_preservation_required');
   if(!captionBytes||hash(captionBytes)!==source.source_content_sha256||fix.captionSha256!==source.source_content_sha256||hash(transcript.body_text)!==fix.originalTranscriptSha256||hash(fix.correctedTranscript)!==input.transcriptSha256)throw Error('correction_source_mismatch');
   const preservation=compareRetainedCaptionTranscript({sourceBytes:captionBytes,transcript:fix.correctedTranscript,expectedSourceSha256:source.source_content_sha256,expectedTranscriptSha256:input.transcriptSha256});
   if(preservation.receipt.outcome!=='exact_word_sequence')throw Error('unsupported_wording_correction');
   correctionLineage={kind:fix.kind,originalBody:transcript.body_text,originalSha256:fix.originalTranscriptSha256,correctedSha256:input.transcriptSha256,originalGroundingRevision:transcript.grounding_revision_id,originalRowVersion:transcript.row_version,sourceSha256:source.source_content_sha256};
   await db.query('UPDATE sermon_transcripts SET body_text=$2,row_version=row_version+1,updated_at=now() WHERE sermon_id=$1',[input.sermonId,fix.correctedTranscript]);
  }else if(hash(transcript.body_text)!==input.transcriptSha256)throw Error('transcript_evidence_mismatch');
  const questionCorrectionLineage:unknown[]=[];
  const finalTranscript=input.correction?.correctedTranscript??transcript.body_text;
  if(new Set(input.questionCorrections.map(q=>q.id)).size!==input.questionCorrections.length)throw Error('duplicate_correction_refused');
  for(const fix of input.questionCorrections){
   const original=questions.find(q=>q.id===fix.id);
   if(!original||original.status==='approved')throw Error('human_approval_preservation_required');
   if(hash(JSON.stringify({question:original.question_text,answer:original.answer_text,order:original.display_order}))!==fix.originalSha256)throw Error('concurrent_question_change');
   if(/[<>]/u.test(fix.question+fix.answer)||inspectGeneratedText('',[{question:fix.question,answer:fix.answer}]).blockingIssueCount>0)throw Error('corrected_text_invalid');
   for(const support of fix.support){if(support.start>=support.end||support.end>finalTranscript.length||hash(finalTranscript.slice(support.start,support.end))!==support.sha256)throw Error('correction_support_invalid');}
   questionCorrectionLineage.push({original,correctedQuestion:fix.question,correctedAnswer:fix.answer,support:fix.support,reviewer:input.reviewer});
   const grounding=(await db.query('SELECT grounding_revision_id FROM sermon_transcripts WHERE sermon_id=$1',[input.sermonId])).rows[0].grounding_revision_id;
   await db.query('UPDATE sermon_question_answers SET question_text=$2,answer_text=$3,source_reference=$4,row_version=row_version+1,updated_at=now() WHERE id=$1',[fix.id,fix.question,fix.answer,groundedSermonEnrichmentSourceReference(input.transcriptSha256,grounding,originalReviewHash)]);
  }
  const finalQuestions=(await db.query('SELECT * FROM sermon_question_answers WHERE sermon_id=$1 ORDER BY display_order',[input.sermonId])).rows;
  if(hash(JSON.stringify(finalQuestions.map(q=>({question:q.question_text,answer:q.answer_text,order:q.display_order}))))!==input.questionsSha256)throw Error('corrected_question_hash_mismatch');
  if(input.correction||input.questionCorrections.length)await db.query('UPDATE sermons SET row_version=row_version+1,updated_at=now() WHERE id=$1',[input.sermonId]);
  const current=(await db.query('SELECT row_version FROM sermons WHERE id=$1',[input.sermonId])).rows[0];
  const payload={decision:'D-172',schemaVersion:1,environment:'local_loopback',scopeSha256:localWordingScopeSha256,outcome:'complete',authorizedBy:'Samuel',humanApprovalClaimed:false,publicationAuthority:false,sourceAccuracyVerified:false,rowVersion:current.row_version,dependencySha256:await readLocalWordingDependency(db,input.sermonId),reviewHash:originalReviewHash,review:input,correctionLineage,questionCorrectionLineage};
  const payloadHash=(await db.query("SELECT encode(digest($1::jsonb::text,'sha256'),'hex') hash",[JSON.stringify(payload)])).rows[0].hash;
  await db.query('INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload) VALUES($1,$2,1,$3::jsonb)',[input.sermonId,localWordingNamespace,JSON.stringify(payload)]);
  await db.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id,outcome) VALUES($1,'system',$2,'sermon',$3,$4::jsonb,$5,'succeeded')",[localWordingActor,localWordingAction,input.sermonId,JSON.stringify(['localCompletion',...(input.correction?['transcript.bodyText','preservedCorrectionLineage']:[]),...(input.questionCorrections.length?['questionAnswers','preservedQuestionCorrectionLineage']:[])]),localWordingScopeSha256+':'+payloadHash]);
  await db.query('COMMIT');return {outcome:'completed' as const,corrected:input.correction!==null||input.questionCorrections.length>0};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}

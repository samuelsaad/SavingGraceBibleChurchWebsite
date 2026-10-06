import type {Pool,PoolClient} from 'pg';
import {authorisedLocalDatabaseName} from '../migration/local-database-safety';
import {prepareCaptionTranscript} from '../enrichment/caption-transcript-preparation';
import {compareRetainedCaptionTranscript} from '../enrichment/remaining-caption-comparison';
import {inspectGeneratedText} from '../enrichment/generated-text-mechanical-qa';
import {groundedSermonEnrichmentSourceReference} from '../enrichment/sermon-enrichment-policy';
import {localWordingDependencySql} from '../domain/local-wording-completion';
import {applyFocusedEdits,correctiveHash as hash,correctiveReviewSchema,validateCorrectiveScope,validateCorrectiveSupport,correctiveDependencySql,correctiveManifestSha256,correctiveMembershipSha256,correctiveActor,correctiveCompletionAction,correctiveAcceptanceAction,correctiveCompletionNamespace,correctiveAcceptanceNamespace} from '../domain/local-corrective-review';

export async function readCorrectiveDependency(db:PoolClient,id:string) {
 // Frozen manifest preconditions use the already captured base fingerprint.
 return (await db.query(`SELECT ${localWordingDependencySql('s')} hash FROM sermons s WHERE id=$1`,[id])).rows[0]?.hash as string|undefined;
}
async function readReceiptDependency(db:PoolClient,id:string) {return (await db.query(`SELECT ${correctiveDependencySql('s')} hash FROM sermons s WHERE id=$1`,[id])).rows[0]?.hash as string|undefined;}
/** No HTTP route: manifest-bound, serializable local command only. Caption bytes
 * remain immutable. Inference is a correction class, NEVER source verification. */
export async function applyLocalCorrectiveReview(pool:Pool,ids:string[],raw:unknown,captionBytes:Uint8Array) {
 const input=correctiveReviewSchema.parse(raw),dbName=authorisedLocalDatabaseName();
 const test=process.env.RUN_POSTGRES_INTEGRATION==='1';
 if(process.env.ALLOW_LOCAL_DB_WRITE!=='1')throw Error('local_write_gate_required');
 if(!test)validateCorrectiveScope(ids);
 if(!ids.includes(input.sermonId))throw Error('corrective_scope_refused');
 const db=await pool.connect();
 try {
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query("SET LOCAL TIME ZONE 'UTC'");await db.query("SET LOCAL savinggrace.application_request='on'");
  const target=(await db.query("SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port,current_setting('server_version_num')::int version")).rows[0];
  if(target.db!==dbName||target.host!=='127.0.0.1'||target.port!==5432||target.version<160000||target.version>=170000)throw Error('local_target_refused');
  const sermon=(await db.query('SELECT * FROM sermons WHERE id=$1 FOR UPDATE',[input.sermonId])).rows[0];
  if(!sermon||sermon.status!=='draft'||sermon.published_at!==null||sermon.deleted_at!==null)throw Error('private_draft_required');
  const jsonHash=async(value:unknown)=>(await db.query("SELECT encode(digest($1::jsonb::text,'sha256'),'hex') hash",[JSON.stringify(value)])).rows[0].hash as string;
  const auditExists=async(action:string,payload:unknown)=>(await db.query("SELECT count(*)::int n FROM audit_events WHERE entity_id=$1 AND entity_type='sermon' AND actor_subject=$2 AND actor_role='system' AND action=$3 AND outcome='succeeded' AND request_correlation_id=$4",[input.sermonId,correctiveActor,action,correctiveManifestSha256+':'+await jsonHash(payload)])).rows[0].n===1;
  const prior=(await db.query('SELECT namespace,payload FROM sermon_extensions WHERE sermon_id=$1 AND namespace=ANY($2::text[]) ORDER BY namespace FOR UPDATE',[input.sermonId,[correctiveCompletionNamespace,correctiveAcceptanceNamespace]])).rows;
  const priorCompletion=prior.find(r=>r.namespace===correctiveCompletionNamespace)?.payload;
  const priorAcceptance=prior.find(r=>r.namespace===correctiveAcceptanceNamespace)?.payload;
  const reviewHash=await jsonHash(input),dependency=await readCorrectiveDependency(db,input.sermonId);
  if(priorCompletion?.reviewHash===reviewHash) {
   if(priorCompletion.dependencySha256!==await readReceiptDependency(db,input.sermonId)||!priorAcceptance||priorAcceptance.completionSha256!==await jsonHash(priorCompletion)||!await auditExists(correctiveCompletionAction,priorCompletion)||!await auditExists(correctiveAcceptanceAction,priorAcceptance))throw Error('existing_corrective_receipt_conflict');
   await db.query('COMMIT');return {outcome:'unchanged' as const,contentCorrected:false,metadataCorrected:false};
  }
  if(priorCompletion && (input.transcriptEdits.length||input.descriptionEdit))throw Error('d173_correction_round_consumed');
  if(sermon.row_version!==input.expectedRowVersion||dependency!==input.expectedDependencySha256)throw Error('concurrent_record_change');
  const transcript=(await db.query('SELECT * FROM sermon_transcripts WHERE sermon_id=$1 FOR UPDATE',[input.sermonId])).rows[0];
  const source=(await db.query('SELECT * FROM sermon_enrichment_sources WHERE sermon_id=$1 FOR UPDATE',[input.sermonId])).rows[0];
  const questions=(await db.query('SELECT * FROM sermon_question_answers WHERE sermon_id=$1 ORDER BY display_order FOR UPDATE',[input.sermonId])).rows;
  const qaHash=hash(JSON.stringify(questions.map(q=>({question:q.question_text,answer:q.answer_text,order:q.display_order}))));
  if(!transcript||!source||hash(transcript.body_text)!==input.originalTranscriptSha256||hash(sermon.summary??'')!==input.originalDescriptionSha256||qaHash!==input.questionsSha256||input.questionAnswersRead!==questions.length||input.questionAssessments.length!==questions.length||input.questionSupport.length!==questions.length||input.transcriptCharactersRead!==transcript.body_text.length)throw Error('reading_evidence_mismatch');
  if(hash(captionBytes)!==source.source_content_sha256||input.sourceSha256!==source.source_content_sha256)throw Error('retained_source_integrity_required');
  // PostgreSQL DATE is a service date, never a timezone-shifted JS instant.
  const date=(await db.query("SELECT to_char(service_date,'YYYY-MM-DD') date FROM sermons WHERE id=$1",[input.sermonId])).rows[0].date;
  if(String(input.sourceEvidence.wordpressId)!==String(sermon.source_wordpress_id)||input.sourceEvidence.videoId!==source.video_id||input.sourceEvidence.serviceDate!==date||input.identityTitleReplacement!==null&&input.identityTitleReplacement!==input.sourceEvidence.originalTitle)throw Error('source_identity_evidence_conflict');
  const comparison=compareRetainedCaptionTranscript({sourceBytes:captionBytes,transcript:transcript.body_text,expectedSourceSha256:source.source_content_sha256,expectedTranscriptSha256:input.originalTranscriptSha256}).receipt;
  if(comparison.outcome!=='exact_word_sequence'||prepareCaptionTranscript(captionBytes).text!==transcript.body_text)throw Error('original_source_comparison_failed');
  const finalTranscript=applyFocusedEdits(transcript.body_text,input.transcriptEdits);
  const finalDescription=applyFocusedEdits(sermon.summary??'',input.descriptionEdit?[input.descriptionEdit]:[]);
  const markers=(text:string)=>JSON.stringify(text.match(/\[[^\[\]]*\]|\?{2,}/gu)??[]);
  if(markers(finalTranscript)!==markers(transcript.body_text))throw Error('uncertainty_marker_change_refused');
  if(hash(finalTranscript)!==input.transcriptSha256||hash(finalDescription)!==input.descriptionSha256)throw Error('corrected_hash_mismatch');
  if(input.descriptionSupport.length!==finalDescription.split(/\n\s*\n/u).filter(Boolean).length)throw Error('paragraph_evidence_incomplete');
  validateCorrectiveSupport(finalTranscript,input.descriptionSupport);validateCorrectiveSupport(finalTranscript,input.questionSupport);
  const mechanical=inspectGeneratedText(finalDescription,questions.map(q=>({question:q.question_text,answer:q.answer_text})));
  if(mechanical.blockingIssueCount||/[<>]/u.test(finalDescription)||questions.some(q=>/[<>]/u.test(q.question_text+q.answer_text)))throw Error('corrective_content_validation_failed');
  const descriptionWords=finalDescription.trim().split(/\s+/u).length;
  if(descriptionWords<180||descriptionWords>220)throw Error('description_length_invalid');
  let speakerId=sermon.speaker_id;
  if(input.speakerAssignment){
   if(sermon.speaker_id!==null||String(sermon.source_wordpress_id)!==String(input.speakerAssignment.expectedSourceWordPressId))throw Error('speaker_assignment_conflict');
   if(input.speakerAssignment.canonicalName!==input.sourceEvidence.canonicalSpeaker)throw Error('source_speaker_evidence_conflict');
   const speakers=(await db.query('SELECT id FROM speakers WHERE name=$1',[input.speakerAssignment.canonicalName])).rows;
   if(speakers.length!==1)throw Error('canonical_speaker_not_unique');speakerId=speakers[0].id;
  }
  if(!speakerId)throw Error('supported_speaker_required');
  if((await db.query('SELECT name FROM speakers WHERE id=$1',[speakerId])).rows[0]?.name!==input.sourceEvidence.canonicalSpeaker)throw Error('source_speaker_evidence_conflict');
  const transcriptChanged=finalTranscript!==transcript.body_text,descriptionChanged=finalDescription!==sermon.summary;
  const titleChanged=input.identityTitleReplacement!==null&&input.identityTitleReplacement!==sermon.title;
  const speakerChanged=speakerId!==sermon.speaker_id;
  // Preserve the complete approved original version BEFORE any corrected version
  // becomes draft. Older AI decisions, review progress and source bytes are untouched.
  const originals=(await db.query(`SELECT to_jsonb(s) sermon,
   (SELECT to_jsonb(t) FROM sermon_transcripts t WHERE t.sermon_id=s.id) transcript,
   (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order) FROM sermon_question_answers q WHERE q.sermon_id=s.id) questions,
   (SELECT to_jsonb(e) FROM sermon_enrichment_sources e WHERE e.sermon_id=s.id) source FROM sermons s WHERE id=$1`,[input.sermonId])).rows[0];
  const lineage={originalSermon:originals.sermon,originalTranscript:originals.transcript,originalQuestions:originals.questions,originalSource:originals.source,comparison,transcriptEdits:input.transcriptEdits,descriptionEdit:input.descriptionEdit,roundDecision:'D-173',historicalAllowancesUnchanged:true};
  if(transcriptChanged)await db.query("UPDATE sermon_transcripts SET body_text=$2,status='draft',approved_at=NULL,approved_by_subject=NULL,row_version=row_version+1,updated_at=now() WHERE sermon_id=$1",[input.sermonId,finalTranscript]);
  const grounding=(await db.query('SELECT grounding_revision_id FROM sermon_transcripts WHERE sermon_id=$1',[input.sermonId])).rows[0].grounding_revision_id;
  const sourceReference=groundedSermonEnrichmentSourceReference(input.transcriptSha256,grounding,reviewHash);
  if(transcriptChanged)await db.query("UPDATE sermon_question_answers SET source_reference=$2,status='draft',approved_at=NULL,approved_by_subject=NULL,row_version=row_version+1,updated_at=now() WHERE sermon_id=$1",[input.sermonId,sourceReference]);
  if(transcriptChanged||descriptionChanged||titleChanged||speakerChanged) {
   await db.query(`UPDATE sermons SET title=$2,speaker_id=$3,summary=$4,
    summary_source_reference=CASE WHEN $5 THEN $6 ELSE summary_source_reference END,
    summary_status=CASE WHEN $5 THEN 'draft' ELSE summary_status END,
    summary_approved_at=CASE WHEN $5 THEN NULL ELSE summary_approved_at END,
    summary_approved_by_subject=CASE WHEN $5 THEN NULL ELSE summary_approved_by_subject END,
    summary_row_version=CASE WHEN $5 THEN summary_row_version+1 ELSE summary_row_version END,
    summary_updated_at=CASE WHEN $5 THEN now() ELSE summary_updated_at END,
    seo_description=CASE WHEN $5 THEN NULL ELSE seo_description END,
    row_version=row_version+1,updated_at=now() WHERE id=$1`,[input.sermonId,input.identityTitleReplacement??sermon.title,speakerId,finalDescription,transcriptChanged||descriptionChanged,sourceReference]);
  }
  const current=(await db.query('SELECT row_version FROM sermons WHERE id=$1',[input.sermonId])).rows[0];
  const common={decision:'D-173',schemaVersion:1,environment:'local_loopback',manifestSha256:correctiveManifestSha256,membershipSha256:correctiveMembershipSha256,authorizedBy:'Samuel',humanApprovalClaimed:false,publicationAuthority:false,audioVerified:false,rowVersion:current.row_version,dependencySha256:await readReceiptDependency(db,input.sermonId)};
  const completion={...common,outcome:'complete',reviewHash,review:input,lineage,mechanical,sourceAccuracyVerified:false,previousReceipts:priorCompletion?[...(priorCompletion.previousReceipts??[]),{completion:priorCompletion,acceptance:priorAcceptance??null}]:[]};
  const acceptance={...common,outcome:'accepted',completionSha256:await jsonHash(completion),scope:'authenticated_local_frontend_only',semanticAuthority:false};
  for(const [namespace,payload,action] of [[correctiveCompletionNamespace,completion,correctiveCompletionAction],[correctiveAcceptanceNamespace,acceptance,correctiveAcceptanceAction]] as const){
   await db.query('INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload) VALUES($1,$2,1,$3::jsonb) ON CONFLICT(sermon_id,namespace) DO UPDATE SET payload=EXCLUDED.payload',[input.sermonId,namespace,JSON.stringify(payload)]);
   const fields=['localCompletion','localFrontendAcceptance','preservedReviewEvidence',...(transcriptChanged?['transcript.bodyText','transcript.approvalVersion','dependentGrounding']:[]),...(descriptionChanged?['summary']:[]),...(titleChanged?['title']:[]),...(speakerChanged?['speakerId']:[])];
   await db.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id,outcome) VALUES($1,'system',$2,'sermon',$3,$4::jsonb,$5,'succeeded')",[correctiveActor,action,input.sermonId,JSON.stringify(fields),correctiveManifestSha256+':'+await jsonHash(payload)]);
  }
  await db.query('COMMIT');return {outcome:'completed' as const,contentCorrected:transcriptChanged||descriptionChanged,metadataCorrected:titleChanged||speakerChanged};
 } catch(e){await db.query('ROLLBACK');throw e;} finally{db.release();}
}

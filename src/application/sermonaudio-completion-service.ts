import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {authorisedLocalDatabaseName} from '../migration/local-database-safety';
import {deterministicSourceUuid} from '../migration/identity';
import {importEnrichmentDraftBundle} from '../enrichment/postgres-enrichment';
import {hash,validateCandidate,substantiveReviewInputSchema,type FrozenInventory} from '../sermonaudio/completion';
import {assertD175SourceMembership,d175ManifestSha256,d175SourceMembershipSha256,d175SourceNamespace,d175ReviewNamespace,d175AcceptanceNamespace,d175Actor,d175AcceptanceAction,d175DependencySql,d175AcceptanceSql} from '../domain/sermonaudio-completion';
import {canonicalSermonAudioUrl} from '../domain/sermonaudio';
import {assessSermonTitle} from '../domain/sermon-title';
import {resolveExplicitPassage} from '../domain/primary-book-resolution';
import {validateLegacySlug} from '../domain/slug';

const sha=z.string().regex(/^[a-f0-9]{64}$/u);
const inputSchema=z.object({
 decision:z.literal('D-175'),manifestSha256:z.literal(d175ManifestSha256),sequence:z.number().int().min(1).max(119),sourceWordPressId:z.number().int().positive(),
 title:z.string().min(1).max(240),slug:z.string().min(1).max(200),serviceDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),sourceStatus:z.enum(['publish','pending']),
 canonicalSpeaker:z.string().min(1).max(200),series:z.array(z.object({name:z.string().min(1).max(240),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)}).strict()).max(30),
 passageTexts:z.array(z.string().min(1).max(500)).max(20),sermonAudioId:z.string().regex(/^\d+$/u),broadcaster:z.literal('savinggrace'),language:z.enum(['en','ar']),
 sourceSha256:sha,metadataSha256:sha,sourceCaptureSha256:sha,transcript:z.string().min(1).max(500000),transcriptSha256:sha,
 candidate:z.unknown(),candidateArtifact:z.unknown(),candidateHash:sha,review:z.unknown(),reviewHash:sha,expectedRowVersion:z.number().int().positive().nullable(),
 sourceRetrievedAt:z.iso.datetime(),sourceVersion:z.record(z.string(),z.unknown()),governanceCommit:z.string().regex(/^[a-f0-9]{40}$/u)
}).strict();
export type SermonAudioCompletionInput=z.infer<typeof inputSchema>;
async function jsonHash(db:PoolClient,value:unknown){return (await db.query("SELECT encode(digest($1::jsonb::text,'sha256'),'hex') hash",[JSON.stringify(value)])).rows[0].hash as string;}
async function audit(db:PoolClient,id:string,action:string,payload:unknown,fields:string[]){
 await db.query(`INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id,outcome)
 VALUES($1,'system',$2,'sermon',$3,$4::jsonb,$5,'succeeded')`,[d175Actor,action,id,JSON.stringify(fields),d175ManifestSha256+':'+await jsonHash(db,payload)]);
}
/** No HTTP route. Metadata, draft content, provenance, actual AI review and
 * separate Samuel-authorized acceptance commit or roll back together. */
export async function applySermonAudioCompletion(pool:Pool,scope:FrozenInventory|number[],raw:unknown){
 const input=inputSchema.parse(raw),dbName=authorisedLocalDatabaseName();
 if(process.env.ALLOW_LOCAL_DB_WRITE!=='1')throw Error('d175_local_write_gate_required');
 const disposable=process.env.RUN_POSTGRES_INTEGRATION==='1';
 const sourceIds=Array.isArray(scope)?scope:scope.targets.map(t=>t.source.sourceWordPressId);
 if(!disposable)assertD175SourceMembership(sourceIds);
 if(!disposable){
  if(Array.isArray(scope))throw Error('d175_verified_inventory_required');
  const selected=scope.targets.find(t=>t.sequence===input.sequence);
  if(!selected||selected.source.sourceWordPressId!==input.sourceWordPressId||selected.source.title!==input.title||selected.source.serviceDate!==input.serviceDate||selected.recording.sermonID!==input.sermonAudioId||selected.metadataSha256!==input.metadataSha256||selected.source.speakerNames.length!==1||selected.source.speakerNames[0]!==input.canonicalSpeaker)throw Error('d175_frozen_metadata_conflict');
 }
 if(!sourceIds.includes(input.sourceWordPressId))throw Error('d175_source_out_of_scope');
 const slug=validateLegacySlug(input.slug);if(!slug)throw Error('d175_slug_refused');
 if(hash(input.transcript)!==input.transcriptSha256)throw Error('d175_transcript_hash_mismatch');
 const validated=validateCandidate(input.transcript,input.candidate,input.language);
 const artifact=input.candidateArtifact as Record<string,any>;
 const {candidateHash,version,previousOriginalHash,correctionCode,...artifactBody}=artifact;
 const pairs=(qs:any[])=>qs.map((q:any,i)=>({displayOrder:i+1,question:q.question,answer:q.answer}));
 if(candidateHash!==input.candidateHash||hash(JSON.stringify(artifactBody))!==input.candidateHash||artifact.description!==validated.candidate.description||hash(JSON.stringify(pairs(artifact.questionAnswers)))!==hash(JSON.stringify(pairs(validated.candidate.questionAnswers)))||artifact.preparation.transcriptSha256!==input.transcriptSha256||artifact.sourceSha256!==input.sourceSha256)throw Error('d175_candidate_artifact_mismatch');
 const reviewRaw=input.review as Record<string,unknown>;
 const {reviewHash:storedReviewHash,...reviewBody}=reviewRaw;
 if(storedReviewHash!==input.reviewHash||hash(JSON.stringify(reviewBody))!==input.reviewHash)throw Error('d175_review_hash_mismatch');
 const keys=Object.keys(substantiveReviewInputSchema.shape),review=substantiveReviewInputSchema.parse(Object.fromEntries(keys.map(k=>[k,reviewBody[k]])));
 if(review.outcome!=='accepted'||review.sequence!==input.sequence||review.candidateHash!==input.candidateHash||review.transcriptCharactersRead!==input.transcript.length||review.questionAssessments.length!==validated.candidate.questionAnswers.length||reviewBody.transcriptSha256!==input.transcriptSha256||reviewBody.descriptionSha256!==hash(validated.candidate.description)||reviewBody.questionAnswersSha256!==hash(JSON.stringify(pairs(validated.candidate.questionAnswers)))||reviewBody.sourceSha256!==input.sourceSha256)throw Error('d175_review_stale_or_failed');
 const id=deterministicSourceUuid('wordpress-sermon',input.sourceWordPressId),db=await pool.connect();
 try{
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query("SET LOCAL TIME ZONE 'UTC'");await db.query("SET LOCAL savinggrace.application_request='on'");
  const target=(await db.query("SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port,current_setting('server_version_num')::int version")).rows[0];
  if(target.db!==dbName||target.host!=='127.0.0.1'||target.port!==5432||target.version<160000||target.version>=170000)throw Error('d175_local_target_refused');
  await db.query('SELECT pg_advisory_xact_lock(175,$1::int)',[input.sourceWordPressId]);
  const existing=(await db.query('SELECT * FROM sermons WHERE source_wordpress_id=$1 OR id=$2 FOR UPDATE',[input.sourceWordPressId,id])).rows;
  if(existing.length>1||existing.some(r=>r.id!==id||Number(r.source_wordpress_id)!==input.sourceWordPressId))throw Error('d175_existing_identity_conflict');
  const prior=existing[0];if(prior&&(prior.status!=='draft'||prior.published_at||prior.deleted_at))throw Error('d175_private_status_required');
  const acceptance=(await db.query('SELECT payload FROM sermon_extensions WHERE sermon_id=$1 AND namespace=$2',[id,d175AcceptanceNamespace])).rows[0]?.payload;
  if(acceptance){
   const current=(await db.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[id])).rows[0]?.accepted;
   if(!current||acceptance.reviewArtifactHash!==input.reviewHash||acceptance.candidateHash!==input.candidateHash)throw Error('d175_existing_receipt_conflict');
   await db.query('COMMIT');return {outcome:'unchanged' as const,sermonId:id,sourceWordPressId:input.sourceWordPressId};
  }
  if(prior&&(input.expectedRowVersion===null||prior.row_version!==input.expectedRowVersion))throw Error('d175_concurrent_record_conflict');
  if(prior)throw Error('d175_existing_record_requires_preserved_update_plan');
  const speaker=(await db.query('SELECT id FROM speakers WHERE lower(trim(name))=lower(trim($1))',[input.canonicalSpeaker])).rows;
  if(speaker.length!==1)throw Error('d175_canonical_speaker_unavailable_or_ambiguous');
  const title=assessSermonTitle(input.title,{passageTexts:input.passageTexts}).title;
  await db.query(`INSERT INTO sermons(id,title,slug,status,service_date,speaker_id,source_wordpress_id,source_status,summary_status,historical_backfill_required)
 VALUES($1,$2,$3,'draft',$4::date,$5,$6,$7,'missing',true)`,[id,title,slug,input.serviceDate,speaker[0].id,input.sourceWordPressId,input.sourceStatus]);
  for(const [i,series] of input.series.entries()){
   const choices=(await db.query('SELECT id,name,slug FROM series WHERE slug=$1 OR lower(trim(name))=lower(trim($2))',[series.slug,series.name])).rows;
   let seriesId:string;if(choices.length===1&&choices[0].name===series.name&&choices[0].slug===series.slug)seriesId=choices[0].id;
   else if(choices.length)throw Error('d175_series_identity_conflict');
   else{seriesId=deterministicSourceUuid('wordpress-series-slug',series.slug);await db.query('INSERT INTO series(id,name,slug)VALUES($1,$2,$3)',[seriesId,series.name,series.slug]);}
   await db.query('INSERT INTO sermon_series_map(sermon_id,series_id,display_order,is_primary)VALUES($1,$2,$3,$4)',[id,seriesId,i,i===0]);
  }
  for(const [i,text] of input.passageTexts.entries()){
   const parsed=resolveExplicitPassage(text);if(!parsed)continue;const p=parsed.passage;
   await db.query(`INSERT INTO scripture_references(sermon_id,display_text,canonical_book_id,start_chapter,start_verse,end_chapter,end_verse,parse_status,relationship_role,is_lead,original_reference_text,provenance,review_status)
 VALUES($1,$2,$3,$4,$5,$6,$7,'exact','primary',$8,$2,'legacy_import','unreviewed')`,[id,text,p.canonicalBookId,p.startChapter,p.startVerse,p.endChapter,p.endVerse,i===0]);
   const classification=(await db.query("SELECT id FROM book_classifications WHERE canonical_book_id=$1 AND classification_type='canonical' AND review_status='approved'",[p.canonicalBookId])).rows;
   if(classification.length!==1)throw Error('d175_canonical_book_missing');
   await db.query('INSERT INTO sermon_book_classifications(sermon_id,book_classification_id,display_order)VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,classification[0].id,i]);
  }
  const url=canonicalSermonAudioUrl(input.sermonAudioId);if(!url)throw Error('d175_media_id_refused');
  await db.query("INSERT INTO sermon_media(id,sermon_id,provider,media_type,external_id,canonical_url,title,is_primary,display_order)VALUES($1,$2,'sermonaudio','audio',$3,$4,$5,true,0)",[deterministicSourceUuid('wordpress-sermonaudio',input.sourceWordPressId),id,input.sermonAudioId,url,'Audio: '+title]);
  const sourcePayload={decision:'D-175',manifestSha256:d175ManifestSha256,sourceMembershipSha256:d175SourceMembershipSha256,sourceWordPressId:input.sourceWordPressId,sermonAudioId:input.sermonAudioId,broadcaster:input.broadcaster,sourceSha256:input.sourceSha256,metadataSha256:input.metadataSha256,sourceCaptureSha256:input.sourceCaptureSha256,sourceCaptureDate:'2026-10-04T07:17:50.567Z',sourceRetrievedAt:input.sourceRetrievedAt,sourceVersion:input.sourceVersion,language:input.language,transcriptSha256:input.transcriptSha256,originalTitle:input.title,governanceCommit:input.governanceCommit,audioVerified:false,providerApprovalClaimed:false};
  await db.query('INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload)VALUES($1,$2,1,$3::jsonb)',[id,d175SourceNamespace,JSON.stringify(sourcePayload)]);
  const provenance={sourceKind:'generated_draft',sourceReference:'d175:'+input.transcriptSha256+':'+input.candidateHash};
  const content={schemaVersion:2,sourceWordPressId:input.sourceWordPressId,targetSermonId:id,expectedRowVersion:1,description:{bodyText:validated.candidate.description,provenance},transcript:{bodyText:input.transcript,provenance:{sourceKind:'imported',sourceReference:'sermonaudio:'+input.sermonAudioId+':'+input.sourceSha256}},questionAnswers:validated.candidate.questionAnswers.map(q=>({question:q.question,answer:q.answer,provenance}))};
  await importEnrichmentDraftBundle(pool,content,d175Actor,db);
  await db.query('INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload)VALUES($1,$2,1,$3::jsonb)',[id,d175ReviewNamespace,JSON.stringify(reviewRaw)]);
  await audit(db,id,'sermon.d175_source_import',sourcePayload,['identity','speaker','passage','media','source']);
  await audit(db,id,'sermon.d175_ai_review',reviewRaw,['aiReview']);
  const current=(await db.query('SELECT row_version,'+d175DependencySql('s')+' dependency FROM sermons s WHERE id=$1',[id])).rows[0];
  const receipt={decision:'D-175',manifestSha256:d175ManifestSha256,sourceMembershipSha256:d175SourceMembershipSha256,outcome:'accepted',authorizedBy:'Samuel',humanApprovalClaimed:false,publicationAuthority:false,audioVerified:false,rowVersion:current.row_version,dependencySha256:current.dependency,reviewSha256:await jsonHash(db,reviewRaw),reviewArtifactHash:input.reviewHash,candidateHash:input.candidateHash};
  await db.query('INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload)VALUES($1,$2,1,$3::jsonb)',[id,d175AcceptanceNamespace,JSON.stringify(receipt)]);await audit(db,id,d175AcceptanceAction,receipt,['privateCompletion','restrictedAcceptance']);
  if(!(await db.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[id])).rows[0]?.accepted)throw Error('d175_acceptance_verification_failed');
  await db.query('COMMIT');return {outcome:'imported_and_ai_accepted' as const,sermonId:id,sourceWordPressId:input.sourceWordPressId};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
}

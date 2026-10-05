import type {PoolClient} from 'pg';
import {audioAssessmentSchema,audioCohorts,audioReviewNamespace,audioAcceptanceNamespace,
 audioReviewPlanSha256,audioReviewer,audioReviewAction,audioAcceptanceAction,type AudioCohort} from '../domain/sermonaudio-review';
import {canonicalSermonAudioUrl} from '../domain/sermonaudio';
import {sermonAudioLinkSchema,mediaSnapshotHash,insertVerifiedSermonAudioLink} from './sermonaudio-linking';
import {PostgresAdminSermonTransaction} from '../server/repositories/postgres-admin-sermon-repository';

/** Caller owns BEGIN/COMMIT and target authorization. No review is inferred from
 * a link or hash: the separately performed bounded media assessment is required.
 * Existing acceptance is reused only when its entire original dependency is
 * current before the media-only update. Historical reviews are never rewritten. */
export async function applyReviewedSermonAudioLink(client:PoolClient,raw:unknown,assessmentRaw:unknown){
 const p=sermonAudioLinkSchema.parse(raw),assessment=audioAssessmentSchema.parse(assessmentRaw);
 if(p.planSha256!==audioReviewPlanSha256)throw Error('audio_review_plan_refused');
 await client.query("SELECT pg_advisory_xact_lock(hashtextextended('sermonaudio:'||$1,0))",[p.sermonAudioId]);
 const s=(await client.query('SELECT * FROM sermons WHERE id=$1 FOR UPDATE',[p.sermonId])).rows[0];
 if(!s||Number(s.source_wordpress_id)!==p.sourceWordPressId)return{outcome:'conflicting',reason:'source_identity_changed'};
 const media=(await client.query('SELECT * FROM sermon_media WHERE sermon_id=$1 ORDER BY display_order,id FOR UPDATE',[p.sermonId])).rows;
 const audio=media.filter(m=>m.provider==='sermonaudio');
 const existing=(await client.query('SELECT namespace,payload FROM sermon_extensions WHERE sermon_id=$1 AND namespace=ANY($2::text[]) FOR UPDATE',[p.sermonId,[audioReviewNamespace,audioAcceptanceNamespace]])).rows;
 if(audio.length){
  if(audio.length===1&&audio[0].external_id===p.sermonAudioId&&audio[0].canonical_url===canonicalSermonAudioUrl(p.sermonAudioId)
   &&existing.some(e=>e.namespace===audioReviewNamespace&&e.payload.assessment?.evidenceSha256===assessment.evidenceSha256))return{outcome:'unchanged',reason:'already_reviewed_link'};
  return{outcome:'conflicting',reason:'existing_audio_mapping_differs_or_review_missing'};
 }
 if(s.row_version!==p.expectedVersion||mediaSnapshotHash(media)!==p.mediaBeforeSha256||existing.length)return{outcome:'conflicting',reason:'concurrent_metadata_change'};
 if(s.deleted_at||!['draft','published'].includes(s.status))return{outcome:'pending',reason:'record_status_prohibits_update'};
 if((await client.query("SELECT 1 FROM sermon_media WHERE provider='sermonaudio' AND external_id=$1 AND sermon_id<>$2 LIMIT 1",[p.sermonAudioId,p.sermonId])).rows.length)return{outcome:'conflicting',reason:'recording_already_assigned_to_different_sermon'};
 const present=new Set((await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(r=>r.tablename));
 let original:{cohort:AudioCohort;sha256:string;dependency:string}|undefined;
 for(const [name,c] of Object.entries(audioCohorts)){
  if(!present.has(c.table))continue;
  const r=(await client.query(`SELECT encode(digest(to_jsonb(a)::text,'sha256'),'hex') sha256,
   a.content_dependency_sha256 dependency, a.${c.version}=s.row_version AND a.content_dependency_sha256=${c.dependency}(s.id)
   AND s.status=$2 AND s.deleted_at IS NULL AND ${name==='d158'?'s.published_at=a.accepted_at':'s.published_at IS NULL'}
   AND NOT EXISTS(SELECT 1 FROM ${c.withdrawals} w WHERE w.sermon_id=s.id) fresh
   FROM ${c.table} a JOIN sermons s ON s.id=a.sermon_id WHERE s.id=$1`,[p.sermonId,c.status])).rows[0];
  if(r?.fresh){if(original)throw Error('audio_acceptance_cohort_ambiguous');original={cohort:name as AudioCohort,sha256:r.sha256,dependency:r.dependency};}
 }
 // Locking the parent serializes all application writers; dependency functions
 // include current source/content/reviews. Only media and technical row version
 // are written below, so no unrelated decision is promoted or re-approved.
 const inserted=await insertVerifiedSermonAudioLink(client,p,media);
 const mr={version:1,outcome:'accepted',reviewer:audioReviewer,assessment,recordingId:p.sermonAudioId,
  sourceSha256:p.sourceSha256,previousMediaSha256:p.mediaBeforeSha256,previousRowVersion:p.expectedVersion,
  currentRowVersion:p.expectedVersion+1,reviewedAt:new Date().toISOString(),
  preservedIndependentEvidence:original?{cohort:original.cohort,dependencySha256:original.dependency,originalAcceptanceSha256:original.sha256}:null};
 const reviewHash=await appendReceipt(client,p.sermonId,audioReviewNamespace,mr,audioReviewAction);
 if(original){
  const c=audioCohorts[original.cohort];
  const dependency=(await client.query(`SELECT ${c.dependency}($1) hash`,[p.sermonId])).rows[0].hash;
  await appendReceipt(client,p.sermonId,audioAcceptanceNamespace,{version:1,outcome:'accepted',planSha256:audioReviewPlanSha256,
   cohort:original.cohort,originalAcceptanceSha256:original.sha256,previousDependencySha256:original.dependency,
   dependencySha256:dependency,previousRowVersion:p.expectedVersion,currentRowVersion:p.expectedVersion+1,
   mediaReviewSha256:reviewHash,humanApprovalClaimed:false,publicationAuthorityGranted:false,
   rationale:'current_prior_acceptance_plus_separately_verified_media_only_change'},audioAcceptanceAction);
 }
 return{...inserted,reviewed:true,acceptanceRefreshed:!!original,cohort:original?.cohort??null};
}

async function appendReceipt(client:PoolClient,id:string,namespace:string,payload:unknown,action:string){
 const digest=(await client.query(`INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload)
  VALUES($1,$2,1,$3::jsonb) RETURNING encode(digest(payload::text,'sha256'),'hex') hash`,[id,namespace,JSON.stringify(payload)])).rows[0].hash;
 await new PostgresAdminSermonTransaction(client).appendAudit({actorSubject:audioReviewer,actorRole:'system',action,
  entityType:'sermon',entityId:id,outcome:'succeeded',changedFields:['sermonaudio_review_evidence'],
  requestCorrelationId:audioReviewPlanSha256+':'+digest});
 return digest as string;
}

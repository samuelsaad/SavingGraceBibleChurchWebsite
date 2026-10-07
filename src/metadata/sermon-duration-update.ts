import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {canonicalSermonAudioUrl,sermonAudioIdPattern} from '../domain/sermonaudio';
import {mediaSnapshotHash} from './sermonaudio-linking';
import {audioCohorts,type AudioCohort} from '../domain/sermonaudio-review';
import {workbenchEligibilitySql} from '../server/queries/admin-workbench';
import {localWordingCompletionSql,localWordingDependencySql} from '../domain/local-wording-completion';
import {correctiveCompletionSql,correctiveAcceptanceSql,correctiveDependencySql} from '../domain/local-corrective-review';
import {d175AcceptanceSql,d175DependencySql} from '../domain/sermonaudio-completion';
import {durationCohorts,durationOriginalReceiptSql,durationReceiptNamespace,durationReceiptActor,durationReceiptAction,durationUpdateAction,durationPolicy,type DurationCohort} from '../domain/recording-duration-receipt';
import {authorisedLocalDatabaseName} from '../migration/local-database-safety';
import {stagingConfiguration,verifyStagingIdentity} from '../staging/guard';

const sha=z.string().regex(/^[a-f0-9]{64}$/u);
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
/** Provider values, never transcript length or final cue time. The unit is
 * explicit so an API unit change cannot silently create a false recording time. */
export function normalizedRecordingDuration(value:unknown,units:unknown):number|null {
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0)return null;
 const seconds=units==='seconds'?value:units==='milliseconds'?value/1000:NaN;
 return Number.isSafeInteger(seconds)&&seconds>0&&seconds<=2147483647?seconds:null;
}
const audioDurationEvidenceSchema=z.object({
 provider:z.literal('sermonaudio'),recordingId:z.string().regex(sermonAudioIdPattern),
 broadcasterId:z.literal('savinggrace'),originalValue:z.number().int().positive().max(2147483647),originalUnits:z.literal('seconds'),
 durationSeconds:z.number().int().positive().max(2147483647),field:z.enum(['audioDurationSeconds','media.audio.duration','official_audio_player.duration']),
 retrievedAt:z.iso.datetime(),metadataSha256:sha,
 retrievalTimeBasis:z.enum(['recorded_metadata','retained_transcript_receipt_upper_bound']).default('recorded_metadata'),
 identityVerified:z.literal(true),broadcasterVerified:z.literal(true),
 sourceKind:z.enum(['cached_official_api','official_api','cached_official_player']),pageSha256:sha.optional(),
 renditionDifferences:z.object({classification:z.literal('variant_difference_observed'),canonicalField:z.literal('audioDurationSeconds'),canonicalBitrate:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  renditions:z.array(z.object({durationSeconds:z.number().int().positive().max(2147483647),bitrate:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)}).strict()).min(2).max(32)}).strict().optional()
}).strict().superRefine((e,ctx)=>{
 if(normalizedRecordingDuration(e.originalValue,e.originalUnits)!==e.durationSeconds)ctx.addIssue({code:'custom',message:'duration_provider_units_mismatch'});
 if(e.sourceKind==='cached_official_player'?(e.field!=='official_audio_player.duration'||!e.pageSha256):(!['audioDurationSeconds','media.audio.duration'].includes(e.field)||e.pageSha256!==undefined))ctx.addIssue({code:'custom',message:'duration_evidence_kind_mismatch'});
 if(e.renditionDifferences){
  const variants=e.renditionDifferences,highest=Math.max(...variants.renditions.map(r=>r.bitrate));
  if(e.sourceKind==='cached_official_player'||e.field!=='audioDurationSeconds'||variants.canonicalBitrate!==highest
   ||variants.renditions.some(r=>Math.abs(r.durationSeconds-e.durationSeconds)>1)
   ||Math.max(...variants.renditions.map(r=>r.durationSeconds))-Math.min(...variants.renditions.map(r=>r.durationSeconds))>1
   ||variants.renditions.filter(r=>r.bitrate===highest).some(r=>r.durationSeconds!==e.durationSeconds)
   ||!variants.renditions.some(r=>r.durationSeconds!==e.durationSeconds))ctx.addIssue({code:'custom',message:'duration_rendition_evidence_conflict'});
 }
});
const cachedYoutubeDurationEvidenceSchema=z.object({
 provider:z.literal('youtube'),recordingId:z.string().regex(/^[A-Za-z0-9_-]{11}$/u),expectedChannelId:z.string().regex(/^UC[A-Za-z0-9_-]{22}$/u),
 originalValue:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),originalUnits:z.literal('milliseconds'),
 durationSeconds:z.number().int().positive().max(2147483647),field:z.literal('contentDetails.duration(normalized_cache)'),
 retrievedAt:z.iso.datetime(),metadataSha256:sha,retrievalTimeBasis:z.enum(['recorded_metadata','retained_transcript_receipt_upper_bound']).default('recorded_metadata'),
 identityVerified:z.literal(true),channelVerified:z.literal(true),sourceKind:z.literal('cached_official_youtube')
}).strict().superRefine((e,ctx)=>{if(normalizedRecordingDuration(e.originalValue,e.originalUnits)!==e.durationSeconds)ctx.addIssue({code:'custom',message:'duration_provider_units_mismatch'});});
export const verifiedDurationEvidenceSchema=z.discriminatedUnion('provider',[audioDurationEvidenceSchema,cachedYoutubeDurationEvidenceSchema]);
export type VerifiedDurationEvidence=z.infer<typeof verifiedDurationEvidenceSchema>;
export const sermonDurationUpdateSchema=z.object({
 sermonId:z.uuid(),sourceWordPressId:z.number().int().positive(),expectedVersion:z.number().int().positive(),
 mediaId:z.uuid(),mediaBeforeSha256:sha,planSha256:sha,evidence:verifiedDurationEvidenceSchema
}).strict();
export type SermonDurationUpdate=z.infer<typeof sermonDurationUpdateSchema>;
export const sermonDurationRecoverySchema=sermonDurationUpdateSchema.omit({evidence:true}).extend({updateAuditSha256:sha}).strict();
export type SermonDurationRecovery=z.infer<typeof sermonDurationRecoverySchema>;

export async function assertDurationWriteTarget(client:PoolClient,target:'local'|'staging'='local') {
 if(target==='staging'){
  if(process.env.ALLOW_STAGING_SERMON_DURATION_SYNC!=='1')throw Error('duration_staging_write_gate_refused');
  stagingConfiguration(process.env,true);await verifyStagingIdentity(client,true);
 }else{
  if(process.env.ALLOW_LOCAL_DB_WRITE!=='1')throw Error('duration_local_write_gate_refused');
  const expected=authorisedLocalDatabaseName(),r=(await client.query("SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port,current_setting('server_version_num')::int version")).rows[0];
  if(!r||r.db!==expected||r.host!=='127.0.0.1'||r.port!==5432||r.version<160000||r.version>=170000)throw Error('duration_local_target_refused');
 }
 const state=(await client.query("SELECT current_setting('transaction_isolation') isolation,current_setting('transaction_read_only') read_only,current_setting('savinggrace.application_request',true) application_request")).rows[0];
 if(state.isolation!=='serializable'||state.read_only!=='off'||state.application_request!=='on')throw Error('duration_guarded_transaction_required');
}
export function durationCohortDependencySql(cohort:DurationCohort,alias='s'):string {
 if(!/^[a-z][a-z_]*$/u.test(alias)||!durationCohorts.includes(cohort))throw Error('duration_sql_alias_refused');
 if(cohort in audioCohorts)return `${audioCohorts[cohort as AudioCohort].dependency}(${alias}.id)`;
 if(cohort==='d172')return localWordingDependencySql(alias);
 if(cohort==='d175')return d175DependencySql(alias);
 return correctiveDependencySql(alias);
}
export function durationCohortEligibilitySql(cohort:DurationCohort,alias='s',testDatabaseName?:string):string {
 if(!/^[a-z][a-z_]*$/u.test(alias)||!durationCohorts.includes(cohort))throw Error('duration_sql_alias_refused');
 if(cohort in audioCohorts)return workbenchEligibilitySql(cohort as AudioCohort,alias);
 if(cohort==='d172')return localWordingCompletionSql(alias,testDatabaseName);
 if(cohort==='d173_completion')return correctiveCompletionSql(alias,testDatabaseName);
 if(cohort==='d173_acceptance')return correctiveAcceptanceSql(alias,testDatabaseName);
 return d175AcceptanceSql(alias);
}
async function installedCohorts(client:PoolClient,ids:string[]):Promise<DurationCohort[]>{
 const tables=new Set((await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(r=>r.tablename));
 const candidates=durationCohorts.filter(cohort=>!(cohort in audioCohorts)||tables.has(audioCohorts[cohort as AudioCohort].table));
 const source=(cohort:DurationCohort)=>cohort in audioCohorts?`SELECT 1 FROM ${audioCohorts[cohort as AudioCohort].table} WHERE sermon_id=ANY($1::uuid[])`:`SELECT 1 FROM sermon_extensions WHERE sermon_id=ANY($1::uuid[]) AND namespace='${cohort==='d172'?'website.d172-local-completion':cohort==='d175'?'website.d175-frontend-acceptance':cohort==='d173_completion'?'website.d173-local-completion':'website.d173-local-acceptance'}'`;
 const present=(await client.query('SELECT '+candidates.map(c=>`EXISTS(${source(c)}) AS "${c}"`).join(','),[ids])).rows[0];
 return candidates.filter(c=>present[c]);
}
export async function readDurationAcceptanceState(client:PoolClient,ids:string[],testDatabaseName?:string){
 const cohorts=await installedCohorts(client,ids);
 const projections=cohorts.map(c=>`jsonb_build_object('eligible',${durationCohortEligibilitySql(c,'s',testDatabaseName)},'dependencySha256',${durationCohortDependencySql(c)},'originalReceiptSha256',${durationOriginalReceiptSql('s',c)}) AS "${c}"`);
 const rows=(await client.query(`SELECT s.id,s.row_version${projections.length?',':''}${projections.join(',')} FROM sermons s WHERE s.id=ANY($1::uuid[]) ORDER BY s.id`,[ids])).rows;
 return {cohorts,rows};
}
async function jsonHash(client:PoolClient,value:unknown){return (await client.query("SELECT encode(digest($1::jsonb::text,'sha256'),'hex') hash",[JSON.stringify(value)])).rows[0].hash as string;}
async function audit(client:PoolClient,id:string,action:string,planSha256:string,payload:unknown,fields:string[]){
 await client.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id,outcome) VALUES($1,'system',$2,'sermon',$3,$4::jsonb,$5,'succeeded')",[durationReceiptActor,action,id,JSON.stringify(fields),planSha256+':'+await jsonHash(client,payload)]);
}

/** Caller owns one SERIALIZABLE transaction with the verified destination and
 * explicit application write gate. No provider calls, imports or content writes.
 * Records referring to this media as canonical-speaker evidence are locked and
 * receive the same strictly metadata-only refresh where already eligible. */
export async function applyVerifiedSermonDuration(client:PoolClient,raw:unknown,options:{target?:'local'|'staging'}={}) {
 return changeVerifiedSermonDuration(client,sermonDurationUpdateSchema.parse(raw),options);
}
/** Compensation is allowed only for the exact unchanged result of our prior
 * update, proven by its immutable source audit. It never deletes audit history. */
export async function rollbackVerifiedSermonDuration(client:PoolClient,raw:unknown,options:{target?:'local'|'staging'}={}) {
 const p=sermonDurationRecoverySchema.parse(raw);await assertDurationWriteTarget(client,options.target??'local');
 const audits=(await client.query("SELECT original_value,source_value_sha256 FROM sermon_media_source_audit WHERE sermon_media_id=$1 AND source_meta_key='verified_recording_duration' AND source_value_sha256=$2",[p.mediaId,p.updateAuditSha256])).rows;
 if(audits.length!==1||hash(audits[0].original_value)!==p.updateAuditSha256)throw Error('duration_recovery_audit_refused');
 const original=JSON.parse(audits[0].original_value);
 if(original.policy!==durationPolicy||original.planSha256!==p.planSha256||original.mediaId!==p.mediaId||original.sourceWordPressId!==p.sourceWordPressId||original.previousMedia?.id!==p.mediaId||original.previousMedia?.duration_seconds!==null)throw Error('duration_recovery_scope_refused');
 const {updateAuditSha256,...base}=p;
 const update=sermonDurationUpdateSchema.parse({...base,evidence:original.evidence});
 return changeVerifiedSermonDuration(client,update,options,p.updateAuditSha256);
}
async function changeVerifiedSermonDuration(client:PoolClient,p:SermonDurationUpdate,options:{target?:'local'|'staging'},rollbackAuditSha256?:string) {
 await assertDurationWriteTarget(client,options.target??'local');
 await client.query("SET LOCAL TIME ZONE 'UTC'");
 await client.query("SELECT pg_advisory_xact_lock(hashtextextended('recording-duration:'||$1,0))",[p.mediaId]);
 const dependentIds=(await client.query("SELECT DISTINCT sermon_id FROM sermon_ai_metadata_assignments WHERE component='speaker' AND COALESCE(evidence->>'mediaId',evidence->'packet'->'anchor'->>'mediaId')=$1",[p.mediaId])).rows.map(r=>r.sermon_id as string);
 const affectedIds=[...new Set([p.sermonId,...dependentIds])].sort();
 const locked=(await client.query('SELECT id,source_wordpress_id,row_version,status,published_at,deleted_at FROM sermons WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[affectedIds])).rows;
 const s=locked.find(r=>r.id===p.sermonId);
 if(!s||Number(s.source_wordpress_id)!==p.sourceWordPressId)return{outcome:'conflicting' as const,reason:'source_identity_changed'};
 const media=(await client.query('SELECT to_jsonb(m) row FROM sermon_media m WHERE sermon_id=$1 ORDER BY display_order,id FOR UPDATE',[p.sermonId])).rows.map(r=>r.row);
 const m=media.find(m=>m.id===p.mediaId);
 if(!m||m.provider!==p.evidence.provider||m.external_id!==p.evidence.recordingId||p.evidence.provider==='sermonaudio'&&(m.media_type!=='audio'||m.canonical_url!==canonicalSermonAudioUrl(p.evidence.recordingId))||p.evidence.provider==='youtube'&&(m.media_type!=='video'||m.canonical_url!==`https://www.youtube.com/watch?v=${p.evidence.recordingId}`))return{outcome:'conflicting' as const,reason:'recording_identity_changed'};
 const desiredDuration=rollbackAuditSha256?null:p.evidence.durationSeconds;
 if(m.duration_seconds===desiredDuration){
  if(rollbackAuditSha256&&!(await client.query("SELECT 1 FROM sermon_media_source_audit WHERE sermon_media_id=$1 AND source_meta_key='verified_recording_duration_rollback' AND original_value::jsonb->>'rollbackAuditSha256'=$2",[p.mediaId,rollbackAuditSha256])).rows.length)throw Error('duration_recovery_already_missing_without_receipt');
  return{outcome:'unchanged' as const,reason:rollbackAuditSha256?'duration_rollback_already_applied':'verified_duration_already_present',acceptanceRefreshed:0};
 }
 if(rollbackAuditSha256?m.duration_seconds!==p.evidence.durationSeconds:m.duration_seconds!==null)return{outcome:'conflicting' as const,reason:'existing_recording_duration_differs'};
 if(s.row_version!==p.expectedVersion||mediaSnapshotHash(media)!==p.mediaBeforeSha256)return{outcome:'conflicting' as const,reason:'concurrent_metadata_change'};
 if(s.deleted_at||!['draft','published'].includes(s.status))return{outcome:'pending' as const,reason:'record_status_prohibits_update'};
 const testName=options.target==='staging'?undefined:authorisedLocalDatabaseName();
 const before=await readDurationAcceptanceState(client,affectedIds,testName);
 const prior=(await client.query('SELECT sermon_id,payload FROM sermon_extensions WHERE sermon_id=ANY($1::uuid[]) AND namespace=$2 ORDER BY sermon_id FOR UPDATE',[affectedIds,durationReceiptNamespace])).rows;
 const evidence={policy:durationPolicy,planSha256:p.planSha256,mediaId:p.mediaId,sourceWordPressId:p.sourceWordPressId,previousMedia:m,previousMediaSha256:p.mediaBeforeSha256,sourceUrl:p.evidence.provider==='youtube'?'https://www.googleapis.com/youtube/v3/videos':p.evidence.sourceKind==='cached_official_player'?`https://embed.sermonaudio.com/player/a/${p.evidence.recordingId}/`:`https://api.sermonaudio.com/v2/node/sermons/${p.evidence.recordingId}`,evidence:p.evidence,...(rollbackAuditSha256?{rollbackAuditSha256}:{} )};
 const update=await client.query('UPDATE sermon_media SET duration_seconds=$2,updated_at=now() WHERE id=$1 AND duration_seconds IS NOT DISTINCT FROM $3::int',[p.mediaId,desiredDuration,m.duration_seconds]);
 if(update.rowCount!==1)throw Error('duration_atomic_media_conflict');
 const original=JSON.stringify(evidence);
 await client.query('INSERT INTO sermon_media_source_audit(sermon_media_id,source_meta_key,original_value,source_value_sha256) VALUES($1,$2,$3,$4)',[p.mediaId,rollbackAuditSha256?'verified_recording_duration_rollback':'verified_recording_duration',original,hash(original)]);
 const version=await client.query('UPDATE sermons SET row_version=row_version+1,updated_at=now(),updated_by_subject=$2 WHERE id=$1 AND row_version=$3',[p.sermonId,durationReceiptActor,p.expectedVersion]);
 if(version.rowCount!==1)throw Error('duration_atomic_version_conflict');
 await audit(client,p.sermonId,rollbackAuditSha256?'sermon.verified_recording_duration_rollback':durationUpdateAction,p.planSha256,evidence,['sermon_media.duration_seconds','sermon_media_source_audit']);
 const after=await readDurationAcceptanceState(client,affectedIds,testName);
 let refreshed=0;
 for(const old of before.rows){
  const current=after.rows.find(r=>r.id===old.id)!;
  const eligible=before.cohorts.filter(c=>old[c]?.eligible);
  if(!eligible.length)continue;
  if(eligible.every(c=>current[c]?.eligible))continue;
  const grants=Object.fromEntries(eligible.map(c=>[c,{previouslyEligible:true,previousDependencySha256:old[c].dependencySha256,dependencySha256:current[c].dependencySha256,originalReceiptSha256:old[c].originalReceiptSha256}]));
  if(eligible.some(c=>current[c].originalReceiptSha256!==old[c].originalReceiptSha256))throw Error('duration_original_acceptance_changed');
  const previous=prior.find(r=>r.sermon_id===old.id)?.payload;
  const previousReceipts=previous?[...(previous.previousReceipts??[]),Object.fromEntries(Object.entries(previous).filter(([k])=>k!=='previousReceipts'))]:[];
  const payload={policy:durationPolicy,outcome:'verified_metadata',authorizedBy:'Samuel',humanApprovalClaimed:false,publicationAuthorityGranted:false,eligibilityExpanded:false,
   planSha256:p.planSha256,previousRowVersion:old.row_version,currentRowVersion:current.row_version,preservedAcceptances:grants,
   affectedMedia:{sermonId:p.sermonId,mediaId:p.mediaId,provider:p.evidence.provider,recordingId:p.evidence.recordingId,durationSeconds:desiredDuration,evidenceSha256:await jsonHash(client,evidence)},previousReceipts};
  await client.query('INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload) VALUES($1,$2,1,$3::jsonb) ON CONFLICT(sermon_id,namespace) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()',[old.id,durationReceiptNamespace,JSON.stringify(payload)]);
  await audit(client,old.id,durationReceiptAction,p.planSha256,payload,['durationMetadataReceipt','preservedAcceptanceFreshness']);refreshed++;
 }
 const final=await readDurationAcceptanceState(client,affectedIds,testName);
 for(const old of before.rows){const now=final.rows.find(r=>r.id===old.id);for(const c of before.cohorts)if(Boolean(old[c]?.eligible)!==Boolean(now?.[c]?.eligible))throw Error('duration_acceptance_membership_changed');}
 const mediaAfter=(await client.query('SELECT to_jsonb(m) row FROM sermon_media m WHERE sermon_id=$1 ORDER BY display_order,id',[p.sermonId])).rows.map(r=>r.row);
 return{outcome:rollbackAuditSha256?'rolled_back' as const:'updated' as const,reason:rollbackAuditSha256?'duration_compensation_saved':'verified_duration_saved',acceptanceRefreshed:refreshed,affectedSermonIds:affectedIds,durationSeconds:desiredDuration,
  recovery:rollbackAuditSha256?null:{sermonId:p.sermonId,sourceWordPressId:p.sourceWordPressId,expectedVersion:p.expectedVersion+1,mediaId:p.mediaId,mediaBeforeSha256:mediaSnapshotHash(mediaAfter),planSha256:p.planSha256,updateAuditSha256:hash(original)}};
}

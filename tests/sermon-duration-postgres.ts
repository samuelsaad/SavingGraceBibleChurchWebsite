import {randomUUID} from 'node:crypto';
import {it,expect} from 'vitest';
import type {Pool,PoolClient} from 'pg';
import {applyVerifiedSermonDuration,rollbackVerifiedSermonDuration,readDurationAcceptanceState,type SermonDurationUpdate} from '../src/metadata/sermon-duration-update';
import {mediaSnapshotHash} from '../src/metadata/sermonaudio-linking';
import {assertDisposableIntegrationTestDatabase} from '../src/migration/local-database-safety';
import {d161RestrictedEligibilitySql,d161SourceManifest} from '../src/domain/restricted-acceptance';
import {durationReceiptNamespace} from '../src/domain/recording-duration-receipt';
import {d175AcceptanceSql,d175AcceptanceNamespace,d175SourceNamespace,d175ReviewNamespace,d175ManifestSha256,d175SourceMembershipSha256,d175DependencySql,d175Actor,d175AcceptanceAction} from '../src/domain/sermonaudio-completion';
import {localWordingCompletionSql,localWordingNamespace,localWordingScopeSha256,localWordingDependencySql,localWordingActor,localWordingAction} from '../src/domain/local-wording-completion';
import {correctiveAcceptanceSql,correctiveCompletionSql,correctiveCompletionNamespace,correctiveAcceptanceNamespace,correctiveManifestSha256,correctiveMembershipSha256,correctiveDependencySql,correctiveActor,correctiveCompletionAction,correctiveAcceptanceAction} from '../src/domain/local-corrective-review';
import {PostgresSermonRepository} from '../src/server/repositories/postgres-sermon-repository';
import {publicSermonListQuerySchema} from '../src/api/contracts/public-sermons';
import {completedSchemaMigrations} from '../src/staging/completed-schema';
import {workbenchEligibilitySql} from '../src/server/queries/admin-workbench';

const evidence=(recordingId:string)=>({provider:'sermonaudio' as const,recordingId,broadcasterId:'savinggrace' as const,originalValue:4328,originalUnits:'seconds' as const,durationSeconds:4328,field:'audioDurationSeconds' as const,retrievedAt:'2026-10-07T00:00:00.000Z',retrievalTimeBasis:'recorded_metadata' as const,metadataSha256:'a'.repeat(64),identityVerified:true as const,broadcasterVerified:true as const,sourceKind:'official_api' as const});
const jsonHash=async(c:PoolClient,p:unknown)=>(await c.query("SELECT encode(digest($1::jsonb::text,'sha256'),'hex') h",[JSON.stringify(p)])).rows[0].h;
async function extension(c:PoolClient,id:string,namespace:string,payload:unknown,actor:string,action:string,manifest:string){
 await c.query('INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload) VALUES($1,$2,1,$3::jsonb)',[id,namespace,JSON.stringify(payload)]);
 await c.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id,outcome)VALUES($1,'system',$2,'sermon',$3,'[]',$4,'succeeded')",[actor,action,id,manifest+':'+await jsonHash(c,payload)]);
}
async function fixture(c:PoolClient,sourceId:number){
 const id=randomUUID(),speaker=randomUUID(),mediaId=randomUUID(),recordingId=String(sourceId)+'12345';
 await c.query("INSERT INTO speakers(id,name,slug)VALUES($1,'Synthetic Duration Speaker',$2)",[speaker,'duration-speaker-'+speaker]);
 await c.query("INSERT INTO sermons(id,title,slug,status,service_date,source_wordpress_id,speaker_id,summary,summary_status)VALUES($1,'Synthetic duration fixture',$2,'draft','2026-01-04',$3,$4,'This anonymous fixture describes synthetic supporting evidence while testing recording duration metadata without any real sermon content.','draft')",[id,'duration-'+id,sourceId,speaker]);
 await c.query("INSERT INTO sermon_transcripts(sermon_id,body_text,status,source_kind)VALUES($1,'Synthetic transcript remains unchanged.','draft','manual')",[id]);
 for(let i=1;i<=5;i++)await c.query("INSERT INTO sermon_question_answers(sermon_id,question_text,answer_text,display_order,status,source_kind)VALUES($1,$2,$3,$4,'draft','manual')",[id,'Synthetic question '+i+'?','Synthetic answer '+i+'.',i]);
 await c.query("INSERT INTO sermon_media(sermon_id,media_type,provider,external_id,canonical_url,title,availability_status,is_primary,display_order)VALUES($1,'video','youtube','abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk','Synthetic video recording','available',true,0)",[id]);
 await c.query("INSERT INTO sermon_media(id,sermon_id,media_type,provider,external_id,canonical_url,title,availability_status,is_primary,display_order)VALUES($1,$2,'audio','sermonaudio',$3,$4,'Synthetic audio recording','available',false,1)",[mediaId,id,recordingId,'https://www.sermonaudio.com/sermons/'+recordingId]);
 return{id,speaker,mediaId,recordingId,sourceId};
}
async function plan(c:PoolClient,f:Awaited<ReturnType<typeof fixture>>):Promise<SermonDurationUpdate>{
 const version=(await c.query('SELECT row_version FROM sermons WHERE id=$1',[f.id])).rows[0].row_version;
 const media=(await c.query('SELECT to_jsonb(m) row FROM sermon_media m WHERE sermon_id=$1 ORDER BY display_order,id',[f.id])).rows.map(r=>r.row);
 return{sermonId:f.id,sourceWordPressId:f.sourceId,expectedVersion:version,mediaId:f.mediaId,mediaBeforeSha256:mediaSnapshotHash(media),planSha256:'b'.repeat(64),evidence:evidence(f.recordingId)};
}
async function acceptedD161(c:PoolClient,id:string){
 const dep=(await c.query('SELECT d161_restricted_acceptance_dependency($1) h',[id])).rows[0].h;
 await c.query(`INSERT INTO sermon_d161_restricted_acceptances(sermon_id,decision,source_manifest_sha256,acceptance_manifest_sha256,evidence_sha256,content_dependency_sha256,fingerprint_format,accepted_row_version,authorized_by,executed_by,manual_review_claimed,passage_basis,environment)
 VALUES($1,'D-161',$2,$2,$2,$3,'d161-utc-jsonb-v1',1,'samuel-saad-d161-authorization','codex-d161-d160-private-review',false,'no_single_primary','local_loopback')`,[id,d161SourceManifest,dep]);
}
const snapshot=async(c:PoolClient,ids:string[])=>(await c.query(`SELECT s.id,to_jsonb(s) sermon,
 (SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM sermon_media m WHERE m.sermon_id=s.id) media,
 (SELECT to_jsonb(t) FROM sermon_transcripts t WHERE t.sermon_id=s.id) transcript,
 (SELECT jsonb_agg(to_jsonb(q) ORDER BY display_order) FROM sermon_question_answers q WHERE q.sermon_id=s.id) questions,
 (SELECT jsonb_agg(to_jsonb(e) ORDER BY namespace) FROM sermon_extensions e WHERE e.sermon_id=s.id) extensions,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM audit_events a WHERE a.entity_id=s.id) audits,
 (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM sermon_media_source_audit a JOIN sermon_media m ON m.id=a.sermon_media_id WHERE m.sermon_id=s.id) media_audits
 FROM sermons s WHERE s.id=ANY($1::uuid[]) ORDER BY s.id`,[ids])).rows;
async function transaction(getPool:()=>Pool,fn:(c:PoolClient,name:string)=>Promise<void>){
 const name=assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE),c=await getPool().connect();
 try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await c.query("SET LOCAL TIME ZONE 'UTC'");await c.query("SET LOCAL savinggrace.application_request='on'");await fn(c,name);}finally{await c.query('ROLLBACK');c.release();}
}
export function registerSermonDurationPostgresTests(getPool:()=>Pool){
 it('atomically updates duration, preserves media/content/acceptance, enforces concurrency, and compensates idempotently',()=>transaction(getPool,async(c)=>{
  const f=await fixture(c,987657001);await acceptedD161(c,f.id);const p=await plan(c,f),before=(await snapshot(c,[f.id]))[0];
  const oldReceipt=(await c.query('SELECT to_jsonb(a) a FROM sermon_d161_restricted_acceptances a WHERE sermon_id=$1',[f.id])).rows[0].a;
  expect((await applyVerifiedSermonDuration(c,{...p,expectedVersion:2})).reason).toBe('concurrent_metadata_change');
  expect((await applyVerifiedSermonDuration(c,{...p,sourceWordPressId:9})).reason).toBe('source_identity_changed');
  expect((await snapshot(c,[f.id]))[0]).toEqual(before);
  await c.query('SAVEPOINT duration_atomic');
  const result=await applyVerifiedSermonDuration(c,p);expect(result).toMatchObject({outcome:'updated',acceptanceRefreshed:1});
  const current=(await snapshot(c,[f.id]))[0];expect(current.sermon.row_version).toBe(2);expect(current.sermon.status).toBe('draft');expect(current.sermon.published_at).toBeNull();expect(current.transcript).toEqual(before.transcript);expect(current.questions).toEqual(before.questions);expect(current.sermon.summary).toBe(before.sermon.summary);
  expect(current.media.find((m:any)=>m.provider==='youtube')).toEqual(before.media.find((m:any)=>m.provider==='youtube'));
  expect(current.media.find((m:any)=>m.provider==='sermonaudio').duration_seconds).toBe(4328);
  const eligible=async()=>(await c.query('SELECT '+d161RestrictedEligibilitySql('s')+' accepted FROM sermons s WHERE id=$1',[f.id])).rows[0].accepted;
  expect(await eligible()).toBe(true);expect((await applyVerifiedSermonDuration(c,p)).outcome).toBe('unchanged');expect((await snapshot(c,[f.id]))[0]).toEqual(current);
  expect((await c.query('SELECT to_jsonb(a) a FROM sermon_d161_restricted_acceptances a WHERE sermon_id=$1',[f.id])).rows[0].a).toEqual(oldReceipt);
  const repository=new PostgresSermonRepository(c,'d161_restricted_accepted');
  const list=await repository.listPublished(publicSermonListQuerySchema.parse({})),item=list.data.find(s=>s.id===f.id)!;
  expect(item.primaryMedia?.provider).toBe('youtube');expect(item.primaryMedia?.durationSeconds).toBeNull();
  expect(item.recordingDuration).toMatchObject({provider:'sermonaudio',externalId:f.recordingId,durationSeconds:4328});
  const detail=await repository.findPublishedBySlug('duration-'+f.id);expect(detail?.primaryMedia?.provider).toBe('youtube');expect(detail?.recordingDuration).toEqual(item.recordingDuration);
  await c.query('SAVEPOINT stale');await c.query("UPDATE sermon_transcripts SET body_text='Concurrent synthetic change.' WHERE sermon_id=$1",[f.id]);expect(await eligible()).toBe(false);await c.query('ROLLBACK TO stale');
  await c.query('SAVEPOINT forged');await c.query("UPDATE sermon_extensions SET payload=payload||'{\"humanApprovalClaimed\":true}'::jsonb WHERE sermon_id=$1 AND namespace=$2",[f.id,durationReceiptNamespace]);expect(await eligible()).toBe(false);await c.query('ROLLBACK TO forged');
  await c.query('SAVEPOINT status');await c.query("UPDATE sermons SET status='archived' WHERE id=$1",[f.id]);expect(await eligible()).toBe(false);await c.query('ROLLBACK TO status');
  await c.query('SAVEPOINT withdrawn');await c.query("INSERT INTO sermon_d161_restricted_acceptance_withdrawals(sermon_id,authorization_reference,reason,executed_by)VALUES($1,'synthetic-withdrawal','Synthetic reason','codex-d161-d160-private-review')",[f.id]);expect(await eligible()).toBe(false);await c.query('ROLLBACK TO withdrawn');
  if(!('recovery' in result)||!result.recovery)throw Error('fixture_recovery_missing');
  expect((await rollbackVerifiedSermonDuration(c,{...result.recovery,expectedVersion:99})).reason).toBe('concurrent_metadata_change');
  expect((await rollbackVerifiedSermonDuration(c,result.recovery)).outcome).toBe('rolled_back');expect(await eligible()).toBe(true);
  const compensated=(await snapshot(c,[f.id]))[0];expect(compensated.media.find((m:any)=>m.provider==='sermonaudio').duration_seconds).toBeNull();expect(compensated.audits.length).toBe(current.audits.length+2);expect(compensated.media_audits.length).toBe(2);expect(compensated.extensions[0].payload.previousReceipts.length).toBe(1);
  expect((await rollbackVerifiedSermonDuration(c,result.recovery)).outcome).toBe('unchanged');expect((await snapshot(c,[f.id]))[0]).toEqual(compensated);
  await c.query('ROLLBACK TO duration_atomic');expect((await snapshot(c,[f.id]))[0]).toEqual(before);
 }));
 it('keeps held sermons held and preserves conflicting existing recording lengths and write gates',()=>transaction(getPool,async(c,name)=>{
  const f=await fixture(c,987657002),p=await plan(c,f),before=await snapshot(c,[f.id]);
  const gate=process.env.ALLOW_LOCAL_DB_WRITE;process.env.ALLOW_LOCAL_DB_WRITE='0';try{await expect(applyVerifiedSermonDuration(c,p)).rejects.toThrow('write_gate');}finally{process.env.ALLOW_LOCAL_DB_WRITE=gate;}
  expect(await snapshot(c,[f.id])).toEqual(before);
  expect(await applyVerifiedSermonDuration(c,p)).toMatchObject({outcome:'updated',acceptanceRefreshed:0});
  expect((await readDurationAcceptanceState(c,[f.id],name)).cohorts).toEqual([]);
  expect((await c.query('SELECT count(*)::int n FROM sermon_extensions WHERE sermon_id=$1',[f.id])).rows[0].n).toBe(0);
  const after=await snapshot(c,[f.id]);expect((await applyVerifiedSermonDuration(c,{...p,evidence:{...p.evidence,originalValue:999,durationSeconds:999}})).reason).toBe('existing_recording_duration_differs');expect(await snapshot(c,[f.id])).toEqual(after);
  const youtubeFixture=await fixture(c,987657003),youtubePlan=await plan(c,youtubeFixture),youtubeMedia=(await c.query("SELECT id FROM sermon_media WHERE sermon_id=$1 AND provider='youtube'",[youtubeFixture.id])).rows[0];
  const cachedYoutube={...youtubePlan,mediaId:youtubeMedia.id,evidence:{provider:'youtube',recordingId:'abcdefghijk',expectedChannelId:'UCabcdefghijklmnopqrstuv',originalValue:4328000,originalUnits:'milliseconds',durationSeconds:4328,field:'contentDetails.duration(normalized_cache)',retrievedAt:'2026-10-07T00:00:00.000Z',retrievalTimeBasis:'retained_transcript_receipt_upper_bound',metadataSha256:'a'.repeat(64),identityVerified:true,channelVerified:true,sourceKind:'cached_official_youtube'}};
  expect(await applyVerifiedSermonDuration(c,cachedYoutube)).toMatchObject({outcome:'updated',acceptanceRefreshed:0});
  expect((await c.query('SELECT provider,external_id,duration_seconds FROM sermon_media WHERE id=$1',[youtubeMedia.id])).rows[0]).toEqual({provider:'youtube',external_id:'abcdefghijk',duration_seconds:4328});
  expect((await c.query('SELECT duration_seconds FROM sermon_media WHERE id=$1',[youtubeFixture.mediaId])).rows[0].duration_seconds).toBeNull();
  expect((await applyVerifiedSermonDuration(c,cachedYoutube)).outcome).toBe('unchanged');
 }));
 it('preserves D172 local completion, D173 local acceptance and D175 original-review receipts without new public authority',()=>transaction(getPool,async(c,name)=>{
  for(const [index,cohort] of ['d172','d173','d175'].entries()){
   const f=await fixture(c,987657010+index);
   if(cohort==='d172'){
    const dep=(await c.query('SELECT '+localWordingDependencySql('s')+' h FROM sermons s WHERE id=$1',[f.id])).rows[0].h;
    await extension(c,f.id,localWordingNamespace,{decision:'D-172',environment:'local_loopback',scopeSha256:localWordingScopeSha256,outcome:'complete',authorizedBy:'Samuel',humanApprovalClaimed:false,publicationAuthority:false,rowVersion:1,dependencySha256:dep},localWordingActor,localWordingAction,localWordingScopeSha256);
   }else if(cohort==='d173'){
    const dep=(await c.query('SELECT '+correctiveDependencySql('s')+' h FROM sermons s WHERE id=$1',[f.id])).rows[0].h,common={decision:'D-173',environment:'local_loopback',manifestSha256:correctiveManifestSha256,membershipSha256:correctiveMembershipSha256,authorizedBy:'Samuel',humanApprovalClaimed:false,publicationAuthority:false,audioVerified:false,rowVersion:1,dependencySha256:dep};
    const complete={...common,outcome:'complete'};await extension(c,f.id,correctiveCompletionNamespace,complete,correctiveActor,correctiveCompletionAction,correctiveManifestSha256);
    await extension(c,f.id,correctiveAcceptanceNamespace,{...common,outcome:'accepted',completionSha256:await jsonHash(c,complete)},correctiveActor,correctiveAcceptanceAction,correctiveManifestSha256);
   }else{
    const review={manifestSha256:d175ManifestSha256,outcome:'accepted',completeSourceRead:true,completeTranscriptRead:true,completeDescriptionRead:true,everyOrderedQuestionAnswerRead:true,humanApprovalClaimed:false,audioVerified:false};
    await c.query('INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload)VALUES($1,$2,1,$3::jsonb),($1,$4,1,$5::jsonb)',[f.id,d175ReviewNamespace,JSON.stringify(review),d175SourceNamespace,JSON.stringify({manifestSha256:d175ManifestSha256,broadcaster:'savinggrace',sourceWordPressId:f.sourceId,audioVerified:false,sermonAudioId:f.recordingId})]);
    const dep=(await c.query('SELECT '+d175DependencySql('s')+' h FROM sermons s WHERE id=$1',[f.id])).rows[0].h;
    await extension(c,f.id,d175AcceptanceNamespace,{decision:'D-175',manifestSha256:d175ManifestSha256,sourceMembershipSha256:d175SourceMembershipSha256,outcome:'accepted',authorizedBy:'Samuel',humanApprovalClaimed:false,publicationAuthority:false,rowVersion:1,dependencySha256:dep,reviewSha256:await jsonHash(c,review)},d175Actor,d175AcceptanceAction,d175ManifestSha256);
   }
   const predicate=cohort==='d172'?localWordingCompletionSql('s',name):cohort==='d173'?correctiveAcceptanceSql('s',name):d175AcceptanceSql('s');
   expect((await c.query('SELECT '+predicate+' accepted FROM sermons s WHERE id=$1',[f.id])).rows[0].accepted).toBe(true);
   if(cohort==='d175'){await c.query("SET LOCAL TIME ZONE 'Australia/Melbourne'");expect((await c.query('SELECT '+predicate+' accepted FROM sermons s WHERE id=$1',[f.id])).rows[0].accepted).toBe(true);await c.query("SET LOCAL TIME ZONE 'UTC'");}
   const old=(await snapshot(c,[f.id]))[0],p=await plan(c,f);expect((await applyVerifiedSermonDuration(c,p)).outcome).toBe('updated');
   expect((await c.query('SELECT '+predicate+' accepted FROM sermons s WHERE id=$1',[f.id])).rows[0].accepted).toBe(true);
   if(cohort==='d175'){await c.query("SET LOCAL TIME ZONE 'Australia/Melbourne'");expect((await c.query('SELECT '+predicate+' accepted FROM sermons s WHERE id=$1',[f.id])).rows[0].accepted).toBe(true);await c.query("SET LOCAL TIME ZONE 'UTC'");}
   const current=(await snapshot(c,[f.id]))[0];expect(current.extensions.filter((e:any)=>e.namespace!==durationReceiptNamespace)).toEqual(old.extensions);expect(current.audits.filter((a:any)=>!a.action.includes('duration'))).toEqual(old.audits);
   expect(current.sermon.status).toBe('draft');expect(current.sermon.published_at).toBeNull();expect(current.transcript).toEqual(old.transcript);expect(current.questions).toEqual(old.questions);
   if(cohort==='d173')expect((await c.query('SELECT '+correctiveCompletionSql('s',name)+' complete FROM sermons s WHERE id=$1',[f.id])).rows[0].complete).toBe(true);
   if(cohort!=='d175'){const productionPredicate=cohort==='d172'?localWordingCompletionSql('s'):correctiveAcceptanceSql('s');expect((await c.query('SELECT '+productionPredicate+' accepted FROM sermons s WHERE id=$1',[f.id])).rows[0].accepted).toBe(false);}
   expect((await applyVerifiedSermonDuration(c,p)).outcome).toBe('unchanged');expect((await snapshot(c,[f.id]))[0]).toEqual(current);
  }
 }));
 it('refreshes a distinct current D169 receipt that references the updated recording as speaker evidence',()=>transaction(getPool,async(c,name)=>{
  for(const migration of (await completedSchemaMigrations()).slice(22))await c.query(migration.upBody);
  const source=await fixture(c,987657030),dependent=await fixture(c,987657031);await acceptedD161(c,source.id);
  const manifest='0ce1014db9d2b25e27280d48d9e76d9f8c2d0d9999e56730df4d06bf558066c8';
  await c.query("INSERT INTO remaining_ai_review_scopes(id,scope_sha256,policy_sha256,member_count)VALUES('D-169',$1,$1,163) ON CONFLICT DO NOTHING",[manifest]);
  const sequence=(await c.query("SELECT COALESCE(max(sequence),0)+1 n FROM remaining_ai_review_members WHERE scope_id='D-169'")).rows[0].n;
  await c.query("INSERT INTO remaining_ai_review_members(scope_id,sermon_id,sequence)VALUES('D-169',$1,$2)",[dependent.id,sequence]);
  await c.query("INSERT INTO sermon_ai_metadata_assignments(scope_id,sermon_id,component,request_sha256,policy_sha256,input_sha256,output_sha256,evidence,previous_metadata,current_metadata,reviewer_subject)VALUES('D-169',$1,'speaker',$2,$2,$2,$2,$3::jsonb,'{}','{}','codex-d169-private-review')",[dependent.id,'a'.repeat(64),JSON.stringify({mediaId:source.mediaId})]);
  const dependency=(await c.query('SELECT d169_restricted_acceptance_dependency($1) h',[dependent.id])).rows[0].h;
  await c.query(`INSERT INTO sermon_d169_restricted_acceptances(sermon_id,decision,source_manifest_sha256,acceptance_manifest_sha256,evidence_sha256,content_dependency_sha256,fingerprint_format,accepted_row_version,authorized_by,executed_by,manual_review_claimed,passage_basis,environment)
  VALUES($1,'D-169',$2,$2,$2,$3,'d169-utc-jsonb-v1',1,'samuel-saad-d169-authorization','codex-d169-private-review',false,'no_single_primary','local_loopback')`,[dependent.id,manifest,dependency]);
  const before=await readDurationAcceptanceState(c,[source.id,dependent.id],name);expect(before.rows.find(r=>r.id===dependent.id)?.d169.eligible).toBe(true);
  const result=await applyVerifiedSermonDuration(c,await plan(c,source));expect(result).toMatchObject({outcome:'updated',acceptanceRefreshed:2});
  expect((await c.query('SELECT '+workbenchEligibilitySql('d169','s')+' accepted,row_version FROM sermons s WHERE id=$1',[dependent.id])).rows[0]).toEqual({accepted:true,row_version:1});
  expect((await c.query('SELECT duration_seconds FROM sermon_media WHERE id=$1',[dependent.mediaId])).rows[0].duration_seconds).toBeNull();
  const after=await snapshot(c,[source.id,dependent.id]);expect((await applyVerifiedSermonDuration(c,await plan(c,source))).outcome).toBe('unchanged');expect(await snapshot(c,[source.id,dependent.id])).toEqual(after);
 }));
}

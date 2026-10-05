import type {Pool} from 'pg';
import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {applyVerifiedSermonAudioLink,mediaSnapshotHash} from '../src/metadata/sermonaudio-linking';
import {assertDisposableIntegrationTestDatabase} from '../src/migration/local-database-safety';
import {applyReviewedSermonAudioLink} from '../src/metadata/sermonaudio-review-refresh';
import {audioReviewPlanSha256,audioRefreshedEligibilitySql} from '../src/domain/sermonaudio-review';
export function registerSermonAudioPostgresTests(getPool:()=>Pool){
 it('refreshes current media acceptance atomically; retains history, stale/withdrawn/held gates, audits and idempotency',async()=>{
  const c=await getPool().connect();try{await c.query('BEGIN');await c.query("SET LOCAL savinggrace.application_request='on'");
   const id=randomUUID();await c.query("INSERT INTO sermons(id,title,slug,status,service_date,source_wordpress_id,summary,summary_status) VALUES($1,'Synthetic accepted media fixture',$2,'draft','2024-01-07',987653001,'Preserved fixture','draft')",[id,'review-audio-'+id]);
   await c.query("INSERT INTO sermon_media(sermon_id,media_type,provider,external_id,canonical_url,title,is_primary,display_order,availability_status) VALUES($1,'video','youtube','abcdefghijk','https://www.youtube.com/watch?v=abcdefghijk','Synthetic existing video',true,0,'available')",[id]);
   const mediaBefore=(await c.query('SELECT to_jsonb(m) row FROM sermon_media m WHERE sermon_id=$1 ORDER BY display_order,id',[id])).rows.map(r=>r.row);
   const dep=(await c.query('SELECT d161_restricted_acceptance_dependency($1) hash',[id])).rows[0].hash;
   await c.query(`INSERT INTO sermon_d161_restricted_acceptances(sermon_id,decision,source_manifest_sha256,acceptance_manifest_sha256,evidence_sha256,content_dependency_sha256,fingerprint_format,accepted_row_version,authorized_by,executed_by,manual_review_claimed,passage_basis,environment)
    VALUES($1,'D-161',$2,$2,$2,$3,'d161-utc-jsonb-v1',1,'samuel-saad-d161-authorization','codex-d161-d160-private-review',false,'primary_passage','local_loopback')`,[id,'0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94',dep]);
   const old=(await c.query('SELECT * FROM sermon_d161_restricted_acceptances WHERE sermon_id=$1',[id])).rows[0];
   const p={sermonId:id,sourceWordPressId:987653001,expectedVersion:1,sermonAudioId:'101012345679',sourceSha256:'a'.repeat(64),planSha256:audioReviewPlanSha256,evidence:['explicit_source_identity','official_broadcaster_verified'],mediaBeforeSha256:mediaSnapshotHash(mediaBefore)};
   const assessment={planSha256:audioReviewPlanSha256,evidenceSha256:'c'.repeat(64),sourceIdentityVerified:true,explicitRecordingReferenceVerified:true,officialBroadcaster:'savinggrace',serviceDateVerified:true,titleCorroborated:true,speakerCorroborated:true,singleRecordingVerified:true,audioAvailable:true,audioQualityVerified:false,humanApprovalClaimed:false,provider:'OpenAI',executionSurface:'Codex',model:'not_exposed_by_runtime',immutableRevision:'not_exposed_by_runtime',reviewMethod:'explicit-source-reference-and-official-recording-metadata'};
   await expect(applyReviewedSermonAudioLink(c,p,{...assessment,humanApprovalClaimed:true})).rejects.toThrow();
   expect((await applyReviewedSermonAudioLink(c,{...p,expectedVersion:2},assessment)).reason).toBe('concurrent_metadata_change');
   await c.query('SAVEPOINT atomic_audio');
   expect(await applyReviewedSermonAudioLink(c,p,assessment)).toMatchObject({acceptanceRefreshed:true});
   const eligible=async()=>(await c.query(`SELECT ${audioRefreshedEligibilitySql('s','d161')} ok FROM sermons s WHERE s.id=$1`,[id])).rows[0].ok;
   expect(await eligible()).toBe(true);
   const snapshot=async()=>(await c.query("SELECT row_version,updated_at,(SELECT count(*) FROM audit_events WHERE entity_id=s.id) audits,(SELECT count(*) FROM sermon_extensions WHERE sermon_id=s.id) receipts FROM sermons s WHERE id=$1",[id])).rows[0];
   const before=await snapshot();expect((await applyReviewedSermonAudioLink(c,p,assessment)).outcome).toBe('unchanged');expect(await snapshot()).toEqual(before);
   expect((await c.query('SELECT * FROM sermon_d161_restricted_acceptances WHERE sermon_id=$1',[id])).rows[0]).toEqual(old);
   await c.query('SAVEPOINT stale');await c.query("UPDATE sermons SET summary='Changed fixture',row_version=row_version+1 WHERE id=$1",[id]);expect(await eligible()).toBe(false);await c.query('ROLLBACK TO stale');
   await c.query('SAVEPOINT altered_media');await c.query("UPDATE sermon_media SET external_id='999' WHERE sermon_id=$1 AND provider='sermonaudio'",[id]);expect(await eligible()).toBe(false);await c.query('ROLLBACK TO altered_media');
   await c.query('SAVEPOINT altered_receipt');await c.query("UPDATE sermon_extensions SET payload=payload||'{\"humanApprovalClaimed\":true}'::jsonb WHERE sermon_id=$1 AND namespace='website.sermonaudio-acceptance'",[id]);expect(await eligible()).toBe(false);await c.query('ROLLBACK TO altered_receipt');
   await c.query('SAVEPOINT status');await c.query("UPDATE sermons SET status='archived' WHERE id=$1",[id]);expect(await eligible()).toBe(false);await c.query('ROLLBACK TO status');
   await c.query('SAVEPOINT withdrawn');await c.query("INSERT INTO sermon_d161_restricted_acceptance_withdrawals(sermon_id,authorization_reference,reason,executed_by) VALUES($1,'synthetic-withdrawal','Synthetic withdrawal','codex-d161-d160-private-review')",[id]);expect(await eligible()).toBe(false);await c.query('ROLLBACK TO withdrawn');
   await c.query('ROLLBACK TO atomic_audio');expect((await c.query("SELECT count(*)::int n FROM sermon_media WHERE sermon_id=$1 AND provider='sermonaudio'",[id])).rows[0].n).toBe(0);
   expect((await c.query('SELECT count(*)::int n FROM sermon_extensions WHERE sermon_id=$1',[id])).rows[0].n).toBe(0);
   // A stale original receipt permits attachment, never a replacement acceptance.
   await c.query("UPDATE sermons SET summary='Intervening fixture change' WHERE id=$1",[id]);
   expect(await applyReviewedSermonAudioLink(c,p,assessment)).toMatchObject({acceptanceRefreshed:false});
   expect(await eligible()).toBe(false);
   await c.query('ROLLBACK');
  }finally{await c.query('ROLLBACK');c.release();}
 });
 it('adds verified audio atomically, preserves content, audits once, protects concurrent edits and completed review dependencies',async()=>{
 assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE);
 const c=await getPool().connect();try{await c.query('BEGIN');await c.query("SET LOCAL savinggrace.application_request='on'");
 const id=randomUUID();await c.query("INSERT INTO sermons(id,title,slug,status,service_date,source_wordpress_id,summary,summary_status) VALUES($1,'Synthetic media fixture',$2,'draft','2024-01-07',987654321,'Unchanged anonymised content','draft')",[id,'media-'+id]);
 const p={sermonId:id,sourceWordPressId:987654321,expectedVersion:1,sermonAudioId:'101012345678',sourceSha256:'a'.repeat(64),planSha256:'b'.repeat(64),evidence:['explicit_source_identity','official_broadcaster_verified'],mediaBeforeSha256:mediaSnapshotHash([])};
 expect((await applyVerifiedSermonAudioLink(c,{...p,expectedVersion:2})).reason).toBe('concurrent_metadata_change');
 expect((await applyVerifiedSermonAudioLink(c,{...p,sourceWordPressId:987654320})).reason).toBe('source_identity_changed');
 const before=(await c.query('SELECT summary,title,slug,status,published_at FROM sermons WHERE id=$1',[id])).rows[0];
 expect((await applyVerifiedSermonAudioLink(c,p)).outcome).toBe('linked');
 const first=(await c.query("SELECT s.row_version,s.updated_at,(SELECT count(*)::int FROM sermon_media WHERE sermon_id=s.id) media,(SELECT count(*)::int FROM audit_events WHERE entity_id=s.id) audits,(SELECT count(*)::int FROM sermon_media_source_audit a JOIN sermon_media m ON a.sermon_media_id=m.id WHERE m.sermon_id=s.id) provenance FROM sermons s WHERE id=$1",[id])).rows[0];
 expect(first).toMatchObject({row_version:2,media:1,audits:1,provenance:1});
 expect((await applyVerifiedSermonAudioLink(c,p)).outcome).toBe('unchanged');
 expect((await c.query("SELECT s.row_version,s.updated_at,(SELECT count(*)::int FROM sermon_media WHERE sermon_id=s.id) media,(SELECT count(*)::int FROM audit_events WHERE entity_id=s.id) audits,(SELECT count(*)::int FROM sermon_media_source_audit a JOIN sermon_media m ON a.sermon_media_id=m.id WHERE m.sermon_id=s.id) provenance FROM sermons s WHERE id=$1",[id])).rows[0]).toEqual(first);
 expect((await c.query('SELECT summary,title,slug,status,published_at FROM sermons WHERE id=$1',[id])).rows[0]).toEqual(before);
 expect((await applyVerifiedSermonAudioLink(c,{...p,sermonAudioId:'999'})).outcome).toBe('conflicting');
 const protectedId=randomUUID();await c.query("INSERT INTO sermons(id,title,slug,status,service_date,source_wordpress_id) VALUES($1,'Synthetic completed fixture',$2,'draft','2024-01-07',987654322)",[protectedId,'media-'+protectedId]);
 await c.query(`INSERT INTO sermon_restricted_acceptances(sermon_id,decision,manifest_sha256,evidence_sha256,content_dependency_sha256,fingerprint_format,previous_row_version,published_row_version,authorized_by,executed_by,manual_review_claimed,passage_basis,environment)
 VALUES($1,'D-158',$2,$2,$2,'d158-utc-jsonb-v1',1,2,'samuel-saad-bulk-authorization','codex-d158-restricted-acceptance',false,'primary_passage','local_loopback')`,[protectedId,'a'.repeat(64)]);
 expect((await applyVerifiedSermonAudioLink(c,{...p,sermonId:protectedId,sourceWordPressId:987654322})).reason).toBe('immutable_media_review_dependency');
 expect((await c.query('SELECT count(*)::int n FROM sermon_media WHERE sermon_id=$1',[protectedId])).rows[0].n).toBe(0);
 await c.query('ROLLBACK');
 }finally{await c.query('ROLLBACK');c.release();}
 });
}

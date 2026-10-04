import type {Pool} from 'pg';
import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {applyVerifiedSermonAudioLink,mediaSnapshotHash} from '../src/metadata/sermonaudio-linking';
import {assertDisposableIntegrationTestDatabase} from '../src/migration/local-database-safety';
export function registerSermonAudioPostgresTests(getPool:()=>Pool){
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

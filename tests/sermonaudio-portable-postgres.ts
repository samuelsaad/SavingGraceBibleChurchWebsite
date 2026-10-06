import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {assertDisposableIntegrationTestDatabase} from '../src/migration/local-database-safety';
import {importProjectSnapshotProjection} from '../src/development-data/import-project-sermon-snapshot';
import {portableReviewSummary,portableSummaryNamespace} from '../src/development-data/sermonaudio-portable-dataset';
import {projectSermonSnapshotVersion,sha256,deriveProjectSnapshotHashes,snapshotCounts,serializeProjectSnapshot,type ProjectSermonSnapshot} from '../src/development-data/project-sermon-snapshot';
import {d175AcceptanceSql} from '../src/domain/sermonaudio-completion';
import {publicRelationshipProjection} from '../src/server/queries/public-sermons';
export function registerSermonAudioPortablePostgresTests(getPool:()=>Pool){
 it('imports display-only Unicode data atomically, restores no acceptance, protects concurrent edits and replays unchanged',async()=>{
  const connectionString=process.env.TEST_DATABASE_URL!,token=process.env.DISPOSABLE_TEST_DATABASE_TOKEN!;
  assertDisposableIntegrationTestDatabase(connectionString,token,process.env.ALLOW_LOCAL_DB_WRITE);
  const pool=getPool(),id=randomUUID(),now='2026-01-04T00:00:00.000Z',h='a'.repeat(64),body='هذا نص تجريبي كامل وليس نص عظة حقيقية.',description='وصف تجريبي لا يحتوي على مادة خاصة.';
  const tables=Object.fromEntries(['speakers','series','bookClassifications','sourceTaxonomyTerms','sermons','sermonSeries','sermonBooks','sermonSourceTerms','scriptureReferences','media','extensions','transcripts','questionAnswers','enrichmentSources','guidedReviews','guidedReviewItems','primaryPassageReviews','aiContentReviews','aiComponentReviews','aiMetadataAssignments','restrictedAcceptances'].map(k=>[k,[]])) as unknown as ProjectSermonSnapshot['tables'];
  tables.sermons=[{id,title:'Synthetic portable projection',slug:'synthetic-portable-'+id,service_date:'2026-01-04',summary:description,summary_sha256:sha256(description),status:'draft',summary_status:'draft',published_at:null,scheduled_for:null,summary_reviewed_at:null,summary_approved_at:null,source_wordpress_id:887752001,created_at:now,updated_at:now}];
  tables.transcripts=[{sermon_id:id,body_text:body,content_sha256:sha256(body),status:'draft',reviewed_at:null,approved_at:null,created_at:now,updated_at:now,grounding_revision_id:randomUUID()}];
  tables.questionAnswers=Array.from({length:7},(_,i)=>{const question='سؤال تجريبي رقم '+(i+1)+'؟',answer='إجابة تجريبية غير مقتبسة من أي عظة.';return{id:randomUUID(),sermon_id:id,question_text:question,answer_text:answer,display_order:i+1,status:'draft',reviewed_at:null,approved_at:null,created_at:now,updated_at:now,content_sha256:sha256(question+'\n'+answer)};});
  tables.extensions=[{sermon_id:id,namespace:portableSummaryNamespace,schema_version:1,created_at:now,updated_at:now,payload:portableReviewSummary({language:'ar',sourceSha256:h,transcriptSha256:sha256(body),metadataSha256:h,sourceCaptureDate:now,sourceRetrievedAt:now,broadcaster:'savinggrace',sermonAudioId:'1234567890123'},{candidateHash:h,reviewArtifactHash:h})}];
  const snapshot:ProjectSermonSnapshot={schemaVersion:projectSermonSnapshotVersion,source:{databaseClass:'local-disposable-postgresql',snapshotIsolation:'repeatable-read-read-only',exportedAt:now},tables};
  const manifest={schemaVersion:projectSermonSnapshotVersion,contentFile:'sermons.json' as const,contentSha256:sha256(serializeProjectSnapshot(snapshot)),counts:snapshotCounts(snapshot),...deriveProjectSnapshotHashes(snapshot),operationalDataExcluded:['accounts','sessions','review authority'],importMode:'private-development-projection' as const};
  const tracked={snapshot,manifest,contentSha256:manifest.contentSha256,manifestSha256:sha256(serializeProjectSnapshot(manifest))},options={connectionString,testRunToken:token,writeOptIn:'1',datasetKind:'sermonaudio119' as const};
  const state=async()=>(await pool.query('SELECT to_jsonb(s) sermon,(SELECT to_jsonb(t) FROM sermon_transcripts t WHERE t.sermon_id=s.id) transcript,(SELECT jsonb_agg(to_jsonb(q) ORDER BY display_order) FROM sermon_question_answers q WHERE q.sermon_id=s.id) questions,(SELECT jsonb_agg(to_jsonb(e) ORDER BY namespace) FROM sermon_extensions e WHERE e.sermon_id=s.id) extensions FROM sermons s WHERE id=$1',[id])).rows[0];
  try{
   const {testRunToken:omittedToken,...noToken}=options;void omittedToken;
   await expect(importProjectSnapshotProjection(pool,noToken,tracked)).rejects.toThrow('disposable');
   const first=await importProjectSnapshotProjection(pool,options,tracked);expect(first.outcome).toBe('imported');expect(first.publicEligible).toBe(0);expect(first.previewEligible).toBe(0);expect(first.semanticEligible).toBe(0);
   const before=await state();expect(before.transcript.body_text).toBe(body);expect(before.sermon.summary).toBe(description);expect(before.questions).toHaveLength(7);expect(before.questions.every((q:any)=>q.status==='draft'&&q.approved_by_subject===null)).toBe(true);
   expect((await pool.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[id])).rows[0].accepted).toBe(false);
   expect((await pool.query('SELECT '+publicRelationshipProjection('s','public')+' FROM sermons s WHERE id=$1',[id])).rows[0].language).toBe('ar');
   expect((await importProjectSnapshotProjection(pool,options,tracked)).outcome).toBe('unchanged');expect(await state()).toEqual(before);
   await pool.query("UPDATE sermon_transcripts SET body_text='Synthetic concurrent edit' WHERE sermon_id=$1",[id]);const edited=await state();
   await expect(importProjectSnapshotProjection(pool,options,tracked)).rejects.toThrow('content hashes');expect(await state()).toEqual(edited);
  }finally{await pool.query('DELETE FROM sermons WHERE id=$1',[id]);}
 });
}

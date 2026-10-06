import {describe,it,expect} from 'vitest';
import {portableReviewSummary,portableSummaryNamespace,portableSummarySchema,validatePortableSermonAudioProjection} from '../src/development-data/sermonaudio-portable-dataset';
import {projectSermonSnapshotVersion,sha256,type ProjectSermonSnapshot} from '../src/development-data/project-sermon-snapshot';
const h='a'.repeat(64),id='00000000-0000-4000-8000-000000000001';
const summary=()=>portableReviewSummary({language:'ar',sourceSha256:h,transcriptSha256:h,metadataSha256:h,sourceCaptureDate:'2026-10-04T00:00:00Z',sourceRetrievedAt:'2026-10-06T00:00:00Z',broadcaster:'savinggrace',sermonAudioId:'1234567890',credential:'synthetic-excluded-value',originalFile:'synthetic-private-file'}, {candidateHash:h,reviewArtifactHash:h,authorizedBy:'synthetic-excluded-person'});
function fixture():ProjectSermonSnapshot{
 const tables=Object.fromEntries(['speakers','series','bookClassifications','sourceTaxonomyTerms','sermons','sermonSeries','sermonBooks','sermonSourceTerms','scriptureReferences','media','extensions','transcripts','questionAnswers','enrichmentSources','guidedReviews','guidedReviewItems','primaryPassageReviews','aiContentReviews','aiComponentReviews','aiMetadataAssignments','restrictedAcceptances'].map(k=>[k,[]])) as unknown as ProjectSermonSnapshot['tables'];
 tables.sermons=[{id,source_wordpress_id:1,title:'Synthetic language fixture',slug:'synthetic-language-fixture',status:'draft',summary_status:'draft',summary:'An anonymized description.',summary_sha256:sha256('An anonymized description.'),published_at:null,scheduled_for:null,summary_reviewed_at:null,summary_approved_at:null}];
 tables.transcripts=[{sermon_id:id,body_text:'نص تجريبي فقط.',content_sha256:sha256('نص تجريبي فقط.'),status:'draft',reviewed_at:null,approved_at:null}];
 tables.questionAnswers=Array.from({length:7},(_,i)=>({sermon_id:id,display_order:i+1,question_text:`Synthetic question ${i+1}?`,answer_text:'Anonymized answer.',content_sha256:sha256(`Synthetic question ${i+1}?\nAnonymized answer.`),status:'draft',reviewed_at:null,approved_at:null}));
 tables.extensions=[{sermon_id:id,namespace:portableSummaryNamespace,payload:summary()}];
 return {schemaVersion:projectSermonSnapshotVersion,source:{databaseClass:'local-disposable-postgresql',snapshotIsolation:'repeatable-read-read-only',exportedAt:'2026-10-06T00:00:00Z'},tables};
}
describe('D-175 portable information is not acceptance authority',()=>{
 it('uses a strict whitelist and excludes private operational values',()=>{
  const p=summary();expect(p.portableAcceptanceAuthority).toBe(false);expect(p.humanApprovalClaimed).toBe(false);expect(p.audioVerified).toBe(false);
  expect(JSON.stringify(p)).not.toContain('synthetic-excluded');expect(JSON.stringify(p)).not.toContain('synthetic-private');
  expect(()=>portableSummarySchema.parse({...p,authorizedBy:'synthetic-excluded-person'})).toThrow();
 });
 it('preserves Unicode, ordered content hashes and informational AI attribution',()=>{
  const p=validatePortableSermonAudioProjection(fixture(),[1]);expect(p.tables.transcripts[0]!.body_text).toBe('نص تجريبي فقط.');
  expect(p.tables.questionAnswers.map(q=>q.display_order)).toEqual([1,2,3,4,5,6,7]);
  expect(p.tables.extensions[0]!.namespace).not.toBe('website.d175-frontend-acceptance');
 });
 it('rejects another source identity and stale content',()=>{
  expect(()=>validatePortableSermonAudioProjection(fixture(),[2])).toThrow('d175_dataset_source_scope');
  const f=fixture();f.tables.transcripts[0]!.body_text='Changed synthetic text';expect(()=>validatePortableSermonAudioProjection(f,[1])).toThrow('Transcript content hash mismatch');
 });
 it('rejects operational acceptance namespaces, review tables and lifecycle authority',()=>{
  const a=fixture();a.tables.extensions[0]!.namespace='website.d175-frontend-acceptance';expect(()=>validatePortableSermonAudioProjection(a,[1])).toThrow();
  const b=fixture();b.tables.restrictedAcceptances=[{sermon_id:id}];expect(()=>validatePortableSermonAudioProjection(b,[1])).toThrow('d175_dataset_contains_operational_authority');
  const c=fixture();c.tables.sermons[0]!.status='published';expect(()=>validatePortableSermonAudioProjection(c,[1])).toThrow('d175_dataset_lifecycle');
  const d=fixture();d.tables.transcripts[0]!.status='approved';expect(()=>validatePortableSermonAudioProjection(d,[1])).toThrow('d175_dataset_content_authority');
 });
});

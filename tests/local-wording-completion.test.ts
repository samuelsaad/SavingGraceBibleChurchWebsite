import {describe,it,expect} from 'vitest';
import {validateLocalWordingScope,localWordingCompletionSql,localWordingDependencySql} from '../src/domain/local-wording-completion';
import {renderCompletedSermon} from '../src/admin/completed-sermon';
import {protectedTables,protectedPacketHash,validateProtectedPacket,type ProtectedPacket} from '../deployment/d167-protected-sync';
import {d167SourceManifest} from '../src/domain/d167-review';
import {canonicalReviewJson,reviewHash} from '../src/domain/delegated-ai-review';
import {scriptureReferenceProvenanceResponseSchema,primaryPassageEvidenceResponseSchema,scriptureReferenceInputSchema,primaryPassageDecisionInputSchema} from '../src/api/contracts/admin-sermons';
describe('bounded local source-wording completion',()=>{
 it('reads existing AI passage provenance honestly without permitting forged provenance in human write inputs',()=>{
  expect(scriptureReferenceProvenanceResponseSchema.parse('ai_transcript_proposal')).toBe('ai_transcript_proposal');
  expect(primaryPassageEvidenceResponseSchema.parse('retained_transcript')).toBe('retained_transcript');
  expect(scriptureReferenceProvenanceResponseSchema.safeParse('human_approved_by_ai').success).toBe(false);
  expect(primaryPassageEvidenceResponseSchema.safeParse('unverified_guess').success).toBe(false);
  expect(scriptureReferenceInputSchema.safeParse({displayText:'Romans 8',provenance:'ai_transcript_proposal'}).success).toBe(false);
  expect(primaryPassageDecisionInputSchema.safeParse({sermonRowVersion:1,reviewRowVersion:1,action:'confirm_no_primary_passage',evidenceSource:'retained_transcript'}).success).toBe(false);
 });
 it('excludes local completion evidence from protected staging transfer',()=>{
  const id='10000000-0000-4000-8000-000000000001';
  const tables={} as ProtectedPacket['tables'];
  for(const table of protectedTables)tables[table]={primaryKey:['id'],rows:table==='sermons'?[{id}]:[]};
  const packet:ProtectedPacket={schemaVersion:1,decision:'D-167',processingManifestSha256:d167SourceManifest,exportedAt:'2026-10-06T00:00:00.000Z',eligibleIds:[id],membershipSha256:reviewHash(canonicalReviewJson([id])),tables,packageSha256:''};
  packet.packageSha256=protectedPacketHash(packet);expect(()=>validateProtectedPacket(packet)).not.toThrow();
  packet.tables.sermon_extensions.rows=[{id,sermon_id:id,namespace:'website.d172-local-completion'}];packet.packageSha256=protectedPacketHash(packet);
  expect(()=>validateProtectedPacket(packet)).toThrow('local_completion_refused');
  packet.tables.sermon_extensions.rows=[];packet.tables.audit_events.rows=[{id,entity_id:id,action:'sermon.d172_local_completion'}];packet.packageSha256=protectedPacketHash(packet);
  expect(()=>validateProtectedPacket(packet)).toThrow('local_completion_refused');
 });
 it('refuses another identity set and binds current local content, exact target and system audit without a public receipt',()=>{
  expect(()=>validateLocalWordingScope([])).toThrow('scope_refused');
  const sql=localWordingCompletionSql();expect(sql).toContain("current_database()='savinggrace_sermons_test'");expect(sql).toContain("host(inet_server_addr())='127.0.0.1'");
  expect(sql).toContain('row_version');expect(sql).toContain('audit_events');expect(sql).toContain("published_at IS NULL");expect(sql).toContain("humanApprovalClaimed'='false'");
  expect(sql).not.toContain('restricted_acceptances');expect(localWordingDependencySql()).toContain('sermon_question_answers');expect(localWordingDependencySql()).toContain('sermon_enrichment_review_items');
  expect(()=>localWordingCompletionSql('s; DROP TABLE sermons')).toThrow();
 });
 it('normally presents current content and ordered Q&A without warning or approval claims, escaping input and rejecting uncontrolled media',()=>{
  const html=renderCompletedSermon({title:'Synthetic <title>',serviceDate:'2026-01-04',speaker:{name:'Example Speaker'},summary:'A synthetic description.',transcript:{bodyText:'A complete [ __ ] synthetic transcript.'},questionAnswers:[{displayOrder:2,question:'Second question?',answer:'Second answer.'},{displayOrder:1,question:'First question?',answer:'First answer.'}],media:[{provider:'youtube',canonicalUrl:'https://www.youtube.com/watch?v=abcdefghijk'},{provider:'sermonaudio',canonicalUrl:'https://www.sermonaudio.com/sermons/101012345678'},{provider:'sermonaudio',canonicalUrl:'javascript:alert(1)'}]});
  expect(html).toContain('<strong>Complete</strong>');expect(html).toContain('&lt;title&gt;');expect(html).toContain('Watch on YouTube');expect(html).toContain('Listen on SermonAudio');expect(html.indexOf('First question?')).toBeLessThan(html.indexOf('Second question?'));
  expect(html).not.toMatch(/warning|unresolved|needs attention|review gate|human.approved|<iframe|javascript:/iu);
  expect(html).toContain('noopener noreferrer');
  expect(html).not.toContain('[ __ ]');expect(html).toContain('A complete synthetic transcript.');
 });
});

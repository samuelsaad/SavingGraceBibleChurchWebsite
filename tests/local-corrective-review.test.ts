import {describe,it,expect} from 'vitest';
import {applyFocusedEdits,correctiveHash,validateCorrectiveScope,validateCorrectiveSupport,correctiveCompletionSql,correctiveAcceptanceSql} from '../src/domain/local-corrective-review';
import {frontendSermonEligibilitySql,buildPublishedSermonDetailQuery} from '../src/server/queries/public-sermons';
import {localFrontendPreviewScope} from '../src/server/restricted-preview-scope';
import {workbenchEligibilitySql} from '../src/server/queries/admin-workbench';
describe('bounded local corrective review',()=>{
 it('rejects any substituted or expanded identity scope',()=>{
  expect(()=>validateCorrectiveScope([])).toThrow('scope_refused');
  expect(()=>validateCorrectiveScope(Array(9).fill('10000000-0000-4000-8000-000000000001'))).toThrow('scope_refused');
 });
 it('changes only one uniquely identified supported clause',()=>{
  const e={original:'Synthetic original.',replacement:'Synthetic supported replacement.',kind:'context_supported_inference' as const,reason:'Synthetic contextual reason.'};
  expect(applyFocusedEdits('Before. Synthetic original. After.',[e])).toBe('Before. Synthetic supported replacement. After.');
  expect(()=>applyFocusedEdits('Different.',[e])).toThrow('not_unique');
  expect(()=>applyFocusedEdits('Synthetic original. Synthetic original.',[e])).toThrow('not_unique');
 });
 it('validates exact bounds and hashes rather than accepting free-floating evidence',()=>{
  const text='Synthetic support.';const r={start:0,end:text.length,sha256:correctiveHash(text),purpose:'synthetic'};
  expect(()=>validateCorrectiveSupport(text,[r])).not.toThrow();
  for(const fix of [{start:2},{end:0},{end:500},{sha256:'a'.repeat(64)}])expect(()=>validateCorrectiveSupport(text,[{...r,...fix}])).toThrow('support_invalid');
 });
 it('requires private draft status, exact loopback target, current dependencies and both audited receipts',()=>{
  const sql=correctiveAcceptanceSql();
  for(const part of ["current_database()='savinggrace_sermons_test'","inet_server_port()=5432","s.status='draft'","s.published_at IS NULL","s.deleted_at IS NULL","s.speaker_id IS NOT NULL","dependencySha256","completionSha256","actor_role='system'","humanApprovalClaimed","publicationAuthority"])expect(sql).toContain(part);
  expect(()=>correctiveCompletionSql('unsafe;')).toThrow();
 });
 it('never inserts local receipts into ordinary public or existing staging selectors',()=>{
  for(const scope of ['public','completed_preview','restricted_accepted','d161_restricted_accepted','d162_restricted_accepted','d167_restricted_accepted','d160_draft_preview'] as const)expect(frontendSermonEligibilitySql('s',scope)).not.toContain('d173');
  expect(frontendSermonEligibilitySql('s','local_corrective_accepted')).toContain('d173-local-acceptance');
  expect(frontendSermonEligibilitySql('s','local_corrective_accepted')).not.toContain('d172');
 });
 it('requires an explicit protected-preview opt in and keeps normal defaults unchanged',()=>{
  expect(localFrontendPreviewScope({})).toBe('completed_preview');
  expect(localFrontendPreviewScope({D173_LOCAL_FRONTEND_ENABLED:'1'})).toBe('local_corrective_accepted');
  expect(()=>localFrontendPreviewScope({D173_LOCAL_FRONTEND_ENABLED:'0'})).toThrow('configuration_refused');
 });
 it('uses the current cohort predicates with correct aliases and retains normal media/content projection',()=>{
  const sql=workbenchEligibilitySql('d169','candidate');expect(sql).toContain('candidate.id');expect(sql).not.toMatch(/\bs\./u);
  const detail=buildPublishedSermonDetailQuery('synthetic','local_corrective_accepted').text;
  expect(detail).toContain('transcript.body_text');expect(detail).toContain('qa.display_order');expect(detail).toContain('primary_ref.review_status');
 });
});

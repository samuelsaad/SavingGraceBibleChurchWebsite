import {describe,it,expect} from 'vitest';
import {stagingFrontendScope} from '../src/staging/frontend-scope';
import {frontendSermonEligibilitySql} from '../src/server/queries/public-sermons';
import {configureCompletedCohort} from '../src/domain/completed-staging';
import {loadTrackedProjectSermonSnapshot} from '../src/development-data/project-sermon-snapshot';
describe('D-175 explicit staged delivery scope',()=>{
 it('preserves every incumbent scope without the new opt-in',()=>{
  expect(stagingFrontendScope({})).toBe('restricted_accepted');
  expect(stagingFrontendScope({D171_COMPLETED_ENABLED:'1'})).toBe('d171_completed');
  expect(stagingFrontendScope({D167_RESTRICTED_ACCEPTANCE_ENABLED:'1'})).toBe('d167_restricted_accepted');
  expect(stagingFrontendScope({D162_RESTRICTED_ACCEPTANCE_ENABLED:'1'})).toBe('d162_restricted_accepted');
  expect(stagingFrontendScope({D161_RESTRICTED_ACCEPTANCE_ENABLED:'1'})).toBe('d161_restricted_accepted');
 });
 it('requires both explicit gates',()=>{
  expect(()=>stagingFrontendScope({D175_COMPLETED_ENABLED:'1'})).toThrow('d175_staging_scope_refused');
  expect(()=>stagingFrontendScope({D175_COMPLETED_ENABLED:'true',D171_COMPLETED_ENABLED:'1'})).toThrow();
  expect(stagingFrontendScope({D175_COMPLETED_ENABLED:'1',D171_COMPLETED_ENABLED:'1'})).toBe('d175_completed');
 });
 it('retains original cohort and current audited dependency gates only on the opted-in scope',async()=>{
  expect(()=>frontendSermonEligibilitySql('s','d175_completed')).toThrow('d171_cohort_not_configured');
  const {snapshot}=await loadTrackedProjectSermonSnapshot();
  configureCompletedCohort(snapshot.tables.sermons.map(row=>row.id));
  const scoped=frontendSermonEligibilitySql('s','d175_completed');
  expect(scoped).toContain('website.d175-frontend-acceptance');
  expect(scoped).toContain('dependencySha256');expect(scoped).toContain("actor_role='system'");
  expect(frontendSermonEligibilitySql('s','public')).not.toContain('website.d175');
  expect(frontendSermonEligibilitySql('s','completed_preview')).not.toContain('website.d175');
 });
});

import {describe,it,expect} from 'vitest';
import {audioAssessmentSchema,audioReviewPlanSha256,audioRefreshedEligibilitySql} from '../src/domain/sermonaudio-review';
import {mediaSnapshotHash} from '../src/metadata/sermonaudio-linking';
describe('bounded audio review',()=>{
 it('compares complete media values independent of driver/JSONB key order, preserving array order and actual changes',()=>{
  const a=[{id:'synthetic-a',created_at:new Date('2024-01-01T00:00:00.000Z'),external_id:'123',display_order:0}];
  const b=[{display_order:0,external_id:'123',created_at:'2024-01-01T00:00:00.000Z',id:'synthetic-a'}];
  expect(mediaSnapshotHash(a)).toBe(mediaSnapshotHash(b));
  expect(mediaSnapshotHash(a)).not.toBe(mediaSnapshotHash([{...b[0],external_id:'456'}]));
  expect(mediaSnapshotHash([a[0],b[0]])).not.toBe(mediaSnapshotHash([b[0],{...a[0],id:'synthetic-b'}]));
 });
 const a={planSha256:audioReviewPlanSha256,evidenceSha256:'a'.repeat(64),sourceIdentityVerified:true,explicitRecordingReferenceVerified:true,officialBroadcaster:'savinggrace',serviceDateVerified:true,titleCorroborated:true,speakerCorroborated:true,singleRecordingVerified:true,audioAvailable:true,audioQualityVerified:false,humanApprovalClaimed:false,provider:'OpenAI',executionSurface:'Codex',model:'not_exposed_by_runtime',immutableRevision:'not_exposed_by_runtime',reviewMethod:'explicit-source-reference-and-official-recording-metadata'};
 it('requires positive exact-source and recording review; cannot claim human/audio quality review',()=>{
  expect(audioAssessmentSchema.safeParse(a).success).toBe(true);
  for(const bad of [{officialBroadcaster:'other'},{sourceIdentityVerified:false},{explicitRecordingReferenceVerified:false},{serviceDateVerified:false},{titleCorroborated:false,speakerCorroborated:false},{humanApprovalClaimed:true},{audioQualityVerified:true},{planSha256:'b'.repeat(64)}])expect(audioAssessmentSchema.safeParse({...a,...bad}).success).toBe(false);
 });
 it('keeps current version/full dependency/withdrawal/state/original receipt/audited media receipt mandatory',()=>{
  const s=audioRefreshedEligibilitySql('s','d161');
  for(const guard of ['published_at IS NULL','deleted_at IS NULL',"status='draft'",'row_version::text','d161_restricted_acceptance_dependency','sermon_d161_restricted_acceptance_withdrawals','originalAcceptanceSha256','mediaReviewSha256','audit_events'])expect(s).toContain(guard);
  expect(()=>audioRefreshedEligibilitySql('s;drop','d161')).toThrow();
 });
});

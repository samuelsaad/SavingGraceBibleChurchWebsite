import {describe,it,expect} from 'vitest';
import {audioAssessmentSchema,audioReviewPlanSha256,audioRefreshedEligibilitySql} from '../src/domain/sermonaudio-review';
describe('bounded audio review',()=>{
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

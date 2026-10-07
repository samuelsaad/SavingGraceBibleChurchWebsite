import {z} from 'zod';
import {durationRefreshedEligibilitySql} from './recording-duration-receipt';

/** One bounded recording reconciliation, not a general acceptance override. */
export const audioReviewPlanSha256='778d7935819f395936eeabf142da2defdc32e59fc45f7162de5676c89bfa7927';
export const audioReviewNamespace='website.sermonaudio-review';
export const audioAcceptanceNamespace='website.sermonaudio-acceptance';
export const audioReviewer='codex-sermonaudio-media-review';
export const audioReviewAction='sermon.sermonaudio_media_review';
export const audioAcceptanceAction='sermon.sermonaudio_acceptance_refresh';
const digest=z.string().regex(/^[a-f0-9]{64}$/u);
export const audioAssessmentSchema=z.object({
 planSha256:z.literal(audioReviewPlanSha256), evidenceSha256:digest,
 sourceIdentityVerified:z.literal(true), explicitRecordingReferenceVerified:z.literal(true),
 officialBroadcaster:z.literal('savinggrace'), serviceDateVerified:z.literal(true),
 titleCorroborated:z.boolean(), speakerCorroborated:z.boolean(),
 singleRecordingVerified:z.literal(true), audioAvailable:z.literal(true),
 audioQualityVerified:z.literal(false), humanApprovalClaimed:z.literal(false),
 provider:z.literal('OpenAI'), executionSurface:z.literal('Codex'),
 model:z.literal('not_exposed_by_runtime'), immutableRevision:z.literal('not_exposed_by_runtime'),
 reviewMethod:z.literal('explicit-source-reference-and-official-recording-metadata'),
}).strict().refine(a=>a.titleCorroborated||a.speakerCorroborated,'recording_corroboration_required');
export type AudioAssessment=z.infer<typeof audioAssessmentSchema>;

export const audioCohorts={
 d158:{table:'sermon_restricted_acceptances',withdrawals:'sermon_restricted_acceptance_withdrawals',dependency:'restricted_acceptance_dependency',version:'published_row_version',status:'published'},
 d161:{table:'sermon_d161_restricted_acceptances',withdrawals:'sermon_d161_restricted_acceptance_withdrawals',dependency:'d161_restricted_acceptance_dependency',version:'accepted_row_version',status:'draft'},
 d162:{table:'sermon_d162_restricted_acceptances',withdrawals:'sermon_d162_restricted_acceptance_withdrawals',dependency:'d162_restricted_acceptance_dependency',version:'accepted_row_version',status:'draft'},
 d167:{table:'sermon_d167_restricted_acceptances',withdrawals:'sermon_d167_restricted_acceptance_withdrawals',dependency:'d167_restricted_acceptance_dependency',version:'accepted_row_version',status:'draft'},
 d168:{table:'sermon_d168_restricted_acceptances',withdrawals:'sermon_d168_restricted_acceptance_withdrawals',dependency:'d168_restricted_acceptance_dependency',version:'accepted_row_version',status:'draft'},
 d169:{table:'sermon_d169_restricted_acceptances',withdrawals:'sermon_d169_restricted_acceptance_withdrawals',dependency:'d169_restricted_acceptance_dependency',version:'accepted_row_version',status:'draft'},
} as const;
export type AudioCohort=keyof typeof audioCohorts;

/** Restricted callers only. Original immutable acceptance must still exist;
 * withdrawal, publication state, current complete dependency and version remain
 * mandatory. Both new payloads are bound to append-only system audit events. */
export function audioRefreshedEligibilitySql(alias:string,cohort:AudioCohort):string{
 if(!/^[a-z][a-z_]*$/u.test(alias))throw Error('invalid_sql_alias');
 const c=audioCohorts[cohort];
 if(!c)throw Error('invalid_audio_cohort');
 const original=`(${alias}.status='${c.status}' AND ${alias}.deleted_at IS NULL
 AND EXISTS(SELECT 1 FROM sermon_extensions ar
 JOIN sermon_extensions mr ON mr.sermon_id=ar.sermon_id
 JOIN ${c.table} old ON old.sermon_id=ar.sermon_id
 WHERE ar.sermon_id=${alias}.id AND ar.namespace='${audioAcceptanceNamespace}' AND ar.schema_version=1
 AND ${cohort==='d158' ? `${alias}.published_at=old.accepted_at` : `${alias}.published_at IS NULL`}
 AND mr.namespace='${audioReviewNamespace}' AND mr.schema_version=1
 AND ar.payload->>'planSha256'='${audioReviewPlanSha256}'
 AND mr.payload->'assessment'->>'planSha256'='${audioReviewPlanSha256}'
 AND ar.payload->>'cohort'='${cohort}' AND ar.payload->>'outcome'='accepted'
 AND ar.payload->>'currentRowVersion'=${alias}.row_version::text
 AND ar.payload->>'previousRowVersion'=old.${c.version}::text
 AND ar.payload->>'originalAcceptanceSha256'=encode(digest(to_jsonb(old)::text,'sha256'),'hex')
 AND ar.payload->>'dependencySha256'=${c.dependency}(${alias}.id)
 AND ar.payload->>'mediaReviewSha256'=encode(digest(mr.payload::text,'sha256'),'hex')
 AND NOT EXISTS(SELECT 1 FROM ${c.withdrawals} w WHERE w.sermon_id=${alias}.id)
 AND EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_id=${alias}.id AND a.entity_type='sermon'
 AND a.action='${audioReviewAction}' AND a.actor_subject='${audioReviewer}' AND a.actor_role='system' AND a.outcome='succeeded'
 AND a.request_correlation_id='${audioReviewPlanSha256}:'||encode(digest(mr.payload::text,'sha256'),'hex'))
 AND EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_id=${alias}.id AND a.entity_type='sermon'
 AND a.action='${audioAcceptanceAction}' AND a.actor_subject='${audioReviewer}' AND a.actor_role='system' AND a.outcome='succeeded'
 AND a.request_correlation_id='${audioReviewPlanSha256}:'||encode(digest(ar.payload::text,'sha256'),'hex'))))`;
 const guard=`${alias}.status='${c.status}' AND ${alias}.deleted_at IS NULL
 AND ${cohort==='d158'?`${alias}.published_at=(SELECT old.accepted_at FROM ${c.table} old WHERE old.sermon_id=${alias}.id)`:`${alias}.published_at IS NULL`}
 AND NOT EXISTS(SELECT 1 FROM ${c.withdrawals} w WHERE w.sermon_id=${alias}.id)`;
 return `(${original} OR ${durationRefreshedEligibilitySql(alias,cohort,`${c.dependency}(${alias}.id)`,guard)})`;
}

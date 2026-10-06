import { createHash } from 'node:crypto';
import { z } from 'zod';
import { localWordingDependencySql } from './local-wording-completion';

export const correctiveManifestSha256 = '97e682024a9a7aec9bb727d7c75ac8992f86672383c4a649289eaa2c5889e21e';
export const correctiveMembershipSha256 = '2640b3e2015b30ef854cd451e05edde0c20377e64d8691d8a161181f34979f1f';
export const correctiveCompletionNamespace = 'website.d173-local-completion';
export const correctiveAcceptanceNamespace = 'website.d173-local-acceptance';
export const correctiveActor = 'codex-d173-local-corrective-review';
export const correctiveCompletionAction = 'sermon.d173_local_completion';
export const correctiveAcceptanceAction = 'sermon.d173_local_frontend_acceptance';
const sha = z.string().regex(/^[a-f0-9]{64}$/u);
const note = z.string().min(1).max(2000);
const support = z.object({ start:z.number().int().nonnegative(), end:z.number().int().positive(), sha256:sha, purpose:note }).strict();
const edit = z.object({ original:note, replacement:note, kind:z.enum(['context_supported_inference','supported_editorial_clarification']), reason:note }).strict();
export const correctiveReviewSchema = z.object({
 decision:z.literal('D-173'), manifestSha256:z.literal(correctiveManifestSha256), membershipSha256:z.literal(correctiveMembershipSha256),
 sermonId:z.uuid(), expectedRowVersion:z.number().int().positive(), expectedDependencySha256:sha,
 reviewedAt:z.iso.datetime(), originalTranscriptSha256:sha, originalDescriptionSha256:sha, questionsSha256:sha, sourceSha256:sha,
 transcriptSha256:sha, descriptionSha256:sha, transcriptCharactersRead:z.number().int().positive(), questionAnswersRead:z.number().int().min(5).max(10),
 completeTranscriptRead:z.literal(true), completeAvailableSourceRead:z.literal(true), completeDescriptionRead:z.literal(true), everyOrderedQuestionAnswerRead:z.literal(true),
 captionReadingBasis:note, audioVerified:z.literal(false), humanApprovalClaimed:z.literal(false), authorizedBy:z.literal('Samuel'),
 transcriptEdits:z.array(edit).max(5), descriptionEdit:edit.nullable(),
 identityTitleReplacement:z.string().min(1).max(300).nullable(),
 speakerAssignment:z.object({canonicalName:z.string().min(1).max(200),suppliedName:z.string().min(1).max(200),suppliedBy:z.literal('Samuel'),expectedSourceWordPressId:z.number().int().positive(),reason:note}).strict().nullable(),
 sourceMetadataSha256:sha,
 sourceEvidence:z.object({wordpressId:z.number().int().positive(),serviceDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),videoId:z.string().regex(/^[A-Za-z0-9_-]{11}$/u),originalTitle:z.string().min(1).max(300),canonicalSpeaker:z.string().min(1).max(200)}).strict(),
 identityAssessment:note, speakerAssessment:note, passageAssessment:note, mediaAssessment:note,
 descriptionAssessment:note, questionAssessments:z.array(note).min(5).max(10),
 descriptionSupport:z.array(support).min(1).max(10), questionSupport:z.array(support).min(5).max(10),
 residualUncertainty:note, reviewArtifactSha256:sha,
 reviewer:z.object({provider:z.literal('OpenAI'),runtime:z.literal('current interactive Codex session'),model:z.literal('not_exposed_by_runtime'),immutableRevision:z.literal('not_exposed_by_runtime'),sessionIdentifier:z.literal('not_exposed_by_runtime'),separatelyBilledApiUsed:z.literal(false)}).strict()
}).strict();
export type CorrectiveReview = z.infer<typeof correctiveReviewSchema>;
export const correctiveHash = (value:string|Uint8Array) => createHash('sha256').update(value).digest('hex');
export function validateCorrectiveScope(ids:string[]) {
 if(ids.length!==9 || new Set(ids).size!==9 || !ids.every(id=>z.uuid().safeParse(id).success) ||
 correctiveHash([...ids].sort().join('\n')+'\n')!==correctiveMembershipSha256) throw Error('corrective_scope_refused');
}
export function applyFocusedEdits(text:string, edits:CorrectiveReview['transcriptEdits']):string {
 let result=text;
 for(const e of edits){const start=result.indexOf(e.original);if(start<0||result.indexOf(e.original,start+1)>=0)throw Error('focused_edit_not_unique');result=result.slice(0,start)+e.replacement+result.slice(start+e.original.length);}
 return result;
}
export function validateCorrectiveSupport(text:string, ranges:CorrectiveReview['descriptionSupport']) {
 for(const r of ranges) if(r.start>=r.end || r.end>text.length || correctiveHash(text.slice(r.start,r.end))!==r.sha256)throw Error('corrective_support_invalid');
}
/** Full current dependencies; neither receipt nor audit is self-referential. */
export function correctiveDependencySql(alias='s') {
 if(!/^[a-z][a-z_]*$/u.test(alias))throw Error('sql_alias_refused');
 const items=(table:string)=>`COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text) FROM ${table} r WHERE r.sermon_id=${alias}.id),'[]'::jsonb)`;
 return `encode(digest(jsonb_build_object('base',${localWordingDependencySql(alias)},'sourceTerms',${items('sermon_source_terms')},'series',${items('sermon_series_map')},'bookClassifications',${items('sermon_book_classifications')},'aiContent',${items('sermon_ai_content_reviews')},'aiComponents',${items('sermon_ai_component_reviews')},'speaker',(SELECT to_jsonb(sp) FROM speakers sp WHERE sp.id=${alias}.speaker_id))::text,'sha256'),'hex')`;
}
function targetName(testDatabaseName?:string) {
 return testDatabaseName&&/^savinggrace_test_run_[a-z0-9]{24,48}$/u.test(testDatabaseName)?testDatabaseName:'savinggrace_sermons_test';
}
export function correctiveCompletionSql(alias='s',testDatabaseName?:string):string {
 if(!/^[a-z][a-z_]*$/u.test(alias))throw Error('sql_alias_refused');
 return `(current_database()='${targetName(testDatabaseName)}' AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432
 AND ${alias}.status='draft' AND ${alias}.published_at IS NULL AND ${alias}.deleted_at IS NULL AND ${alias}.speaker_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM sermon_extensions lc WHERE lc.sermon_id=${alias}.id AND lc.namespace='${correctiveCompletionNamespace}' AND lc.schema_version=1
 AND lc.payload->>'decision'='D-173' AND lc.payload->>'environment'='local_loopback' AND lc.payload->>'manifestSha256'='${correctiveManifestSha256}'
 AND lc.payload->>'membershipSha256'='${correctiveMembershipSha256}' AND lc.payload->>'outcome'='complete' AND lc.payload->>'authorizedBy'='Samuel'
 AND lc.payload->>'humanApprovalClaimed'='false' AND lc.payload->>'publicationAuthority'='false' AND lc.payload->>'audioVerified'='false'
 AND lc.payload->>'rowVersion'=${alias}.row_version::text AND lc.payload->>'dependencySha256'=${correctiveDependencySql(alias)}
 AND EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_id=${alias}.id AND a.entity_type='sermon' AND a.action='${correctiveCompletionAction}'
 AND a.actor_subject='${correctiveActor}' AND a.actor_role='system' AND a.outcome='succeeded'
 AND a.request_correlation_id='${correctiveManifestSha256}:'||encode(digest(lc.payload::text,'sha256'),'hex'))))`;
}
/** Used ONLY by the explicitly opted-in authenticated loopback frontend. */
export function correctiveAcceptanceSql(alias='s',testDatabaseName?:string):string {
 return `(${correctiveCompletionSql(alias,testDatabaseName)} AND EXISTS(SELECT 1 FROM sermon_extensions la
 JOIN sermon_extensions lc ON lc.sermon_id=la.sermon_id AND lc.namespace='${correctiveCompletionNamespace}'
 WHERE la.sermon_id=${alias}.id AND la.namespace='${correctiveAcceptanceNamespace}' AND la.schema_version=1
 AND la.payload->>'decision'='D-173' AND la.payload->>'environment'='local_loopback' AND la.payload->>'manifestSha256'='${correctiveManifestSha256}'
 AND la.payload->>'membershipSha256'='${correctiveMembershipSha256}' AND la.payload->>'outcome'='accepted' AND la.payload->>'authorizedBy'='Samuel'
 AND la.payload->>'publicationAuthority'='false' AND la.payload->>'rowVersion'=${alias}.row_version::text
 AND la.payload->>'dependencySha256'=${correctiveDependencySql(alias)}
 AND la.payload->>'completionSha256'=encode(digest(lc.payload::text,'sha256'),'hex')
 AND EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_id=${alias}.id AND a.entity_type='sermon' AND a.action='${correctiveAcceptanceAction}'
 AND a.actor_subject='${correctiveActor}' AND a.actor_role='system' AND a.outcome='succeeded'
 AND a.request_correlation_id='${correctiveManifestSha256}:'||encode(digest(la.payload::text,'sha256'),'hex'))))`;
}

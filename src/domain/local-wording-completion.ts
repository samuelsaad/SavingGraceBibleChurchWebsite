import {createHash} from 'node:crypto';
import {z} from 'zod';
export const localWordingScopeSha256='1d04a65dad79c2f5b0489382a94423f7e2341ce8cd9433e8c81ffdea73573259';
export const localWordingNamespace='website.d172-local-completion';
export const localWordingActor='codex-d172-local-wording-review';
export const localWordingAction='sermon.d172_local_completion';
const hash=z.string().regex(/^[a-f0-9]{64}$/u);
export const localWordingReviewSchema=z.object({
 decision:z.literal('D-172'),scopeSha256:hash,sermonId:z.uuid(),expectedRowVersion:z.number().int().positive(),expectedDependencySha256:hash,
 reviewedAt:z.iso.datetime(),transcriptSha256:hash,descriptionSha256:hash,questionsSha256:hash,sourceSha256:hash,
 originalQuestionsSha256:hash.optional(),
 questionCorrections:z.array(z.object({id:z.uuid(),originalSha256:hash,question:z.string().min(1).max(1000),answer:z.string().min(1).max(10000),support:z.array(z.object({start:z.number().int().nonnegative(),end:z.number().int().positive(),sha256:hash}).strict()).min(1)}).strict()).max(10).default([]),
 completeTranscriptRead:z.literal(true),completeDescriptionRead:z.literal(true),everyOrderedQuestionAnswerRead:z.literal(true),
 sourceAvailable:z.boolean(),completeAvailableSourceRead:z.literal(true),audioVerified:z.literal(false),humanApprovalClaimed:z.literal(false),
 transcriptCharactersRead:z.number().int().positive(),questionAnswersRead:z.number().int().min(1),
 descriptionGrounded:z.boolean(),questionsGrounded:z.boolean(),sourceWordingResolved:z.boolean(),
 uncertaintyAcceptedBy:z.literal('Samuel'),localCompletionAuthorized:z.literal(true),
 internalFindings:z.array(z.object({code:z.string().min(1).max(120),outcome:z.enum(['supported_correction','source_limitation_retained','source_unavailable','no_correction_needed','content_concern_retained']),note:z.string().min(1).max(1000)}).strict()),
 reviewer:z.object({provider:z.literal('OpenAI'),product:z.literal('Codex'),mode:z.literal('interactive Codex session'),model:z.literal('not_exposed_by_runtime'),immutableRevision:z.literal('not_exposed_by_runtime'),sessionIdentifier:z.literal('not_exposed_by_runtime')}).strict(),
 correction:z.object({kind:z.literal('restore_retained_source_text'),originalTranscriptSha256:hash,correctedTranscript:z.string().min(1),captionSha256:hash}).strict().nullable()
}).strict();
export type LocalWordingReview=z.infer<typeof localWordingReviewSchema>;
export const wordingScopeHash=(ids:string[])=>createHash('sha256').update([...ids].sort().join('\n')+'\n').digest('hex');
export function validateLocalWordingScope(ids:string[]){
 if(ids.length!==23||new Set(ids).size!==23||!ids.every(id=>z.uuid().safeParse(id).success)||wordingScopeHash(ids)!==localWordingScopeSha256)throw Error('local_wording_scope_refused');
}
/** Current content/source/human-state dependency only; never includes this receipt
 * or its audit, so an identical application cannot invalidate its own result. */
export function localWordingDependencySql(alias='s'){
 if(!/^[a-z][a-z_]*$/u.test(alias))throw Error('sql_alias_refused');
 const items=(table:string)=>`COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text) FROM ${table} r WHERE r.sermon_id=${alias}.id),'[]'::jsonb)`;
 return `encode(digest(jsonb_build_object('sermon',to_jsonb(${alias}),'transcript',${items('sermon_transcripts')},'source',${items('sermon_enrichment_sources')},'questions',${items('sermon_question_answers')},'findings',${items('sermon_enrichment_review_items')},'guided',${items('sermon_enrichment_reviews')},'passages',${items('scripture_references')},'passageReview',${items('sermon_primary_passage_reviews')},'media',${items('sermon_media')})::text,'sha256'),'hex')`;
}
/** Authenticated admin/workbench callers only. No public or staging selector
 * imports this predicate. Exact database coordinates are an additional boundary. */
export function localWordingCompletionSql(alias='s',testDatabaseName?:string){
 const target=testDatabaseName&&/^savinggrace_test_run_[a-z0-9]{24,48}$/u.test(testDatabaseName)?testDatabaseName:'savinggrace_sermons_test';
 return `(current_database()='${target}' AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432
 AND ${alias}.status='draft' AND ${alias}.published_at IS NULL AND ${alias}.deleted_at IS NULL
 AND EXISTS(SELECT 1 FROM sermon_extensions lc WHERE lc.sermon_id=${alias}.id
 AND lc.namespace='${localWordingNamespace}' AND lc.schema_version=1
 AND lc.payload->>'decision'='D-172' AND lc.payload->>'environment'='local_loopback'
 AND lc.payload->>'scopeSha256'='${localWordingScopeSha256}'
 AND lc.payload->>'outcome'='complete' AND lc.payload->>'authorizedBy'='Samuel'
 AND lc.payload->>'humanApprovalClaimed'='false' AND lc.payload->>'publicationAuthority'='false'
 AND lc.payload->>'rowVersion'=${alias}.row_version::text
 AND lc.payload->>'dependencySha256'=${localWordingDependencySql(alias)}
 AND EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_id=${alias}.id AND a.entity_type='sermon'
 AND a.action='${localWordingAction}' AND a.actor_subject='${localWordingActor}' AND a.actor_role='system' AND a.outcome='succeeded'
 AND a.request_correlation_id='${localWordingScopeSha256}:'||encode(digest(lc.payload::text,'sha256'),'hex'))))`;
}

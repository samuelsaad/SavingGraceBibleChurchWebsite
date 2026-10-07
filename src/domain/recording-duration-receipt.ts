/** Duration-only receipt refresh. Original content/review/acceptance records and
 * their audits remain immutable. A refresh is useful only to the selector that
 * already admitted that particular cohort before the metadata write. */
export const durationReceiptNamespace = 'website.recording-duration-refresh';
export const durationReceiptActor = 'requested-verified-recording-duration';
export const durationReceiptAction = 'sermon.recording_duration_acceptance_refresh';
export const durationUpdateAction = 'sermon.verified_recording_duration';
export const durationPolicy = 'verified-recording-duration-v1';
export const durationCohorts = ['d158','d161','d162','d167','d168','d169','d172','d173_completion','d173_acceptance','d175'] as const;
export type DurationCohort = typeof durationCohorts[number];
const legacyTables = {
 d158:'sermon_restricted_acceptances',d161:'sermon_d161_restricted_acceptances',
 d162:'sermon_d162_restricted_acceptances',d167:'sermon_d167_restricted_acceptances',
 d168:'sermon_d168_restricted_acceptances',d169:'sermon_d169_restricted_acceptances'
} as const;
function safeAlias(alias:string){if(!/^[a-z][a-z_]*$/u.test(alias))throw Error('duration_sql_alias_refused');return alias;}
/** The original authoritative receipt plus any earlier media-only refresh.
 * This anchor is distinct from the newly appended duration receipt. */
export function durationOriginalReceiptSql(alias:string,cohort:DurationCohort):string {
 safeAlias(alias);if(!durationCohorts.includes(cohort))throw Error('duration_cohort_refused');
 const ext=(names:string[])=>`COALESCE((SELECT jsonb_agg(jsonb_build_object('namespace',e.namespace,'schema',e.schema_version,'payload',e.payload) ORDER BY e.namespace) FROM sermon_extensions e WHERE e.sermon_id=${alias}.id AND e.namespace IN (${names.map(n=>`'${n}'`).join(',')})),'[]'::jsonb)`;
 const audits=(actions:string[])=>`COALESCE((SELECT jsonb_agg((to_jsonb(a)-'created_at')||jsonb_build_object('created_at_epoch',extract(epoch from a.created_at)) ORDER BY a.id) FROM audit_events a WHERE a.entity_id=${alias}.id AND a.entity_type='sermon' AND a.action IN (${actions.map(a=>`'${a}'`).join(',')})),'[]'::jsonb)`;
 if(cohort in legacyTables){const table=legacyTables[cohort as keyof typeof legacyTables];return `encode(digest(jsonb_build_object('original',(SELECT (to_jsonb(a)-'accepted_at')||jsonb_build_object('accepted_at_epoch',extract(epoch from a.accepted_at)) FROM ${table} a WHERE a.sermon_id=${alias}.id),'mediaRefresh',${ext(['website.sermonaudio-review','website.sermonaudio-acceptance'])},'originalAudit',${audits(['sermon.sermonaudio_media_review','sermon.sermonaudio_acceptance_refresh'])})::text,'sha256'),'hex')`;}
 const namespaces=cohort==='d172'?['website.d172-local-completion']:cohort==='d175'?['website.d175-frontend-acceptance','website.d175-ai-review','website.d175-sermonaudio-source']:['website.d173-local-completion','website.d173-local-acceptance'];
 const actions=cohort==='d172'?['sermon.d172_local_completion']:cohort==='d175'?['sermon.d175_frontend_acceptance']:['sermon.d173_local_completion','sermon.d173_local_frontend_acceptance'];
 return `encode(digest(jsonb_build_object('original',${ext(namespaces)},'originalAudit',${audits(actions)})::text,'sha256'),'hex')`;
}
/** Caller supplies its unchanged complete dependency and status/local/withdrawal
 * gates. The audit binds every grant and original-receipt hash, so importing a
 * sanitized dataset or adding a media field cannot manufacture acceptance. */
export function durationRefreshedEligibilitySql(alias:string,cohort:DurationCohort,dependencySql:string,guardSql:string):string {
 safeAlias(alias);if(!durationCohorts.includes(cohort)||!dependencySql||!guardSql)throw Error('duration_selector_refused');
 return `((${guardSql}) AND EXISTS(SELECT 1 FROM sermon_extensions dr
 WHERE dr.sermon_id=${alias}.id AND dr.namespace='${durationReceiptNamespace}' AND dr.schema_version=1
 AND dr.payload->>'policy'='${durationPolicy}' AND dr.payload->>'outcome'='verified_metadata'
 AND dr.payload->>'authorizedBy'='Samuel' AND dr.payload->>'humanApprovalClaimed'='false'
 AND dr.payload->>'publicationAuthorityGranted'='false' AND dr.payload->>'eligibilityExpanded'='false'
 AND dr.payload->>'currentRowVersion'=${alias}.row_version::text
 AND dr.payload->'preservedAcceptances'->'${cohort}'->>'previouslyEligible'='true'
 AND dr.payload->'preservedAcceptances'->'${cohort}'->>'originalReceiptSha256'=${durationOriginalReceiptSql(alias,cohort)}
 AND dr.payload->'preservedAcceptances'->'${cohort}'->>'dependencySha256'=${dependencySql}
 AND EXISTS(SELECT 1 FROM audit_events da WHERE da.entity_id=${alias}.id AND da.entity_type='sermon'
 AND da.action='${durationReceiptAction}' AND da.actor_subject='${durationReceiptActor}' AND da.actor_role='system' AND da.outcome='succeeded'
 AND da.request_correlation_id=dr.payload->>'planSha256'||':'||encode(digest(dr.payload::text,'sha256'),'hex'))))`;
}

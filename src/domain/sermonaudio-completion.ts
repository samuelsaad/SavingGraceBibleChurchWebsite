import {createHash} from 'node:crypto';

export const d175ManifestSha256='a4fa3627682043c4b06aa65ddbebdab75f1fc29aec93e2d250bda537d9b0cd2b';
export const d175SourceMembershipSha256='00dcc94e2ffff5db065ab83060fe7d79a4d8787310b120479446c9563f9eb818';
export const d175SourceNamespace='website.d175-sermonaudio-source';
export const d175ReviewNamespace='website.d175-ai-review';
export const d175AcceptanceNamespace='website.d175-frontend-acceptance';
export const d175Actor='codex-d175-sermonaudio-review';
export const d175AcceptanceAction='sermon.d175_frontend_acceptance';
export function assertD175SourceMembership(ids:number[]){
 if(ids.length!==119||new Set(ids).size!==119||ids.some(id=>!Number.isSafeInteger(id)||id<1)||createHash('sha256').update([...ids].sort((a,b)=>a-b).join('\n')+'\n').digest('hex')!==d175SourceMembershipSha256)throw Error('d175_source_membership_refused');
}
function aliasName(alias:string){if(!/^[a-z][a-z_]*$/u.test(alias))throw Error('d175_sql_alias_refused');return alias;}
export function d175DependencySql(alias='s'){
 aliasName(alias);
 // The installed base function canonicalizes relational timestamps in UTC.
 // Raw to_jsonb(row) in the caller's timezone would incorrectly make a valid
 // receipt look stale after leaving the writer's UTC transaction.
 return `encode(digest(jsonb_build_object('base',restricted_acceptance_dependency(${alias}.id),'d175Source',(SELECT payload FROM sermon_extensions WHERE sermon_id=${alias}.id AND namespace='${d175SourceNamespace}'),'d175Review',(SELECT payload FROM sermon_extensions WHERE sermon_id=${alias}.id AND namespace='${d175ReviewNamespace}'))::text,'sha256'),'hex')`;
}
/** Explicit restricted/staging/admin callers only; never ordinary public or
 * semantic eligibility. A portable dataset cannot reproduce system audit authority. */
export function d175AcceptanceSql(alias='s'){
 aliasName(alias);
 return `(${alias}.status='draft' AND ${alias}.published_at IS NULL AND ${alias}.deleted_at IS NULL AND ${alias}.speaker_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM sermon_extensions a
 JOIN sermon_extensions r ON r.sermon_id=a.sermon_id AND r.namespace='${d175ReviewNamespace}'
 JOIN sermon_extensions p ON p.sermon_id=a.sermon_id AND p.namespace='${d175SourceNamespace}'
 WHERE a.sermon_id=${alias}.id AND a.namespace='${d175AcceptanceNamespace}' AND a.schema_version=1 AND r.schema_version=1 AND p.schema_version=1
 AND a.payload->>'decision'='D-175' AND a.payload->>'manifestSha256'='${d175ManifestSha256}'
 AND a.payload->>'sourceMembershipSha256'='${d175SourceMembershipSha256}' AND a.payload->>'outcome'='accepted'
 AND a.payload->>'authorizedBy'='Samuel' AND a.payload->>'humanApprovalClaimed'='false' AND a.payload->>'publicationAuthority'='false'
 AND a.payload->>'rowVersion'=${alias}.row_version::text AND a.payload->>'dependencySha256'=${d175DependencySql(alias)}
 AND a.payload->>'reviewSha256'=encode(digest(r.payload::text,'sha256'),'hex')
 AND r.payload->>'manifestSha256'='${d175ManifestSha256}' AND r.payload->>'outcome'='accepted'
 AND r.payload->>'completeSourceRead'='true' AND r.payload->>'completeTranscriptRead'='true'
 AND r.payload->>'completeDescriptionRead'='true' AND r.payload->>'everyOrderedQuestionAnswerRead'='true'
 AND r.payload->>'humanApprovalClaimed'='false' AND r.payload->>'audioVerified'='false'
 AND p.payload->>'manifestSha256'='${d175ManifestSha256}' AND p.payload->>'broadcaster'='savinggrace'
 AND p.payload->>'sourceWordPressId'=${alias}.source_wordpress_id::text AND p.payload->>'audioVerified'='false'
 AND EXISTS(SELECT 1 FROM sermon_media m WHERE m.sermon_id=${alias}.id AND m.provider='sermonaudio' AND m.media_type='audio' AND m.external_id=p.payload->>'sermonAudioId')
 AND EXISTS(SELECT 1 FROM audit_events e WHERE e.entity_id=${alias}.id AND e.entity_type='sermon' AND e.action='${d175AcceptanceAction}'
 AND e.actor_subject='${d175Actor}' AND e.actor_role='system' AND e.outcome='succeeded'
 AND e.request_correlation_id='${d175ManifestSha256}:'||encode(digest(a.payload::text,'sha256'),'hex'))))`;
}

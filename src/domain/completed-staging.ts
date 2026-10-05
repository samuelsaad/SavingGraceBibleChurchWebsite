import {createHash} from 'node:crypto';
import {d161CombinedRestrictedEligibilitySql} from './restricted-acceptance';
import {audioRefreshedEligibilitySql} from './sermonaudio-review';

export const completedMembershipSha256='4e3455c92d604f4e44999e56922e15359dc7bfa8a6d912c6d36e2a39a9f048c3';
export const completedCount=279;
export function membershipHash(ids:readonly string[]){return createHash('sha256').update([...ids].sort().join('\n')+'\n').digest('hex');}
export function validateCompletedIds(value:unknown):string[]{
 if(!Array.isArray(value)||value.length!==completedCount||value.some(v=>typeof v!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(v))||new Set(value).size!==value.length||membershipHash(value)!==completedMembershipSha256)throw Error('d171_membership_mismatch');
 return [...value].sort();
}
let fixedIds:readonly string[]|undefined;
export function configureCompletedCohort(ids:unknown){const next=validateCompletedIds(ids);if(fixedIds&&fixedIds.join()!==next.join())throw Error('d171_reconfiguration_refused');fixedIds=Object.freeze(next);}
/** Source D-169 receipts keep their truthful original local execution environment.
 * D-171 supplies separate staging display authority, not a relabelled AI review. */
export function currentCompletedEligibilitySql(alias:string){
 if(!/^[a-z][a-z_]*$/u.test(alias))throw Error('invalid_sql_alias');
 return `(${d161CombinedRestrictedEligibilitySql(alias)} OR ((${alias}.status='draft' AND ${alias}.published_at IS NULL AND ${alias}.deleted_at IS NULL AND EXISTS(
 SELECT 1 FROM sermon_d169_restricted_acceptances a WHERE a.sermon_id=${alias}.id AND a.decision='D-169'
 AND a.source_manifest_sha256='0ce1014db9d2b25e27280d48d9e76d9f8c2d0d9999e56730df4d06bf558066c8'
 AND a.environment='local_loopback' AND a.fingerprint_format='d169-utc-jsonb-v1' AND a.accepted_row_version=${alias}.row_version
 AND a.content_dependency_sha256=d169_restricted_acceptance_dependency(${alias}.id)
 AND NOT EXISTS(SELECT 1 FROM sermon_d169_restricted_acceptance_withdrawals w WHERE w.sermon_id=${alias}.id))) OR ${audioRefreshedEligibilitySql(alias,'d169')}))`;
}
export function completedEligibilitySql(alias:string){
 if(!fixedIds)throw Error('d171_cohort_not_configured');
 return `(${currentCompletedEligibilitySql(alias)} AND ${alias}.id IN (${fixedIds.map(id=>`'${id}'::uuid`).join(',')}))`;
}
export function completedPassageAcceptanceSql(expression:string){
 if(!/^[a-z][a-z_]*\.(?:id|sermon_id)$/u.test(expression))throw Error('invalid_sql_sermon_expression');
 return `(EXISTS(SELECT 1 FROM sermon_d169_restricted_acceptances a WHERE a.sermon_id=${expression} AND a.passage_basis='primary_passage'))`;
}

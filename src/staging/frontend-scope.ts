import type {FrontendSermonScope} from '../server/queries/public-sermons';

/** Existing boundaries are unchanged unless both the completed-cohort gate
 * and the exact D-175 delivery gate are explicitly enabled. */
export function stagingFrontendScope(env:NodeJS.ProcessEnv):FrontendSermonScope {
 const d175=env.D175_COMPLETED_ENABLED;
 if(d175!==undefined){
  if(d175!=='1'||env.D171_COMPLETED_ENABLED!=='1')throw Error('d175_staging_scope_refused');
  return 'd175_completed';
 }
 return env.D171_COMPLETED_ENABLED==='1'?'d171_completed'
  :env.D167_RESTRICTED_ACCEPTANCE_ENABLED==='1'?'d167_restricted_accepted'
  :env.D162_RESTRICTED_ACCEPTANCE_ENABLED==='1'?'d162_restricted_accepted'
  :env.D161_RESTRICTED_ACCEPTANCE_ENABLED==='1'?'d161_restricted_accepted':'restricted_accepted';
}

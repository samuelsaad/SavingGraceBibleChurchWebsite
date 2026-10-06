import type { FrontendSermonScope } from "./queries/public-sermons";

export function localFrontendPreviewScope(env: NodeJS.ProcessEnv): FrontendSermonScope {
  const corrective=env.D173_LOCAL_FRONTEND_ENABLED;
  if(corrective!==undefined){if(corrective==='1')return 'local_corrective_accepted';throw Error('d173_local_preview_configuration_refused');}
  const d167 = env.D167_RESTRICTED_ACCEPTANCE_ENABLED;
  if (d167 !== undefined) {
    if (d167 === "1") return "d167_restricted_accepted";
    throw new Error("d167_restricted_preview_configuration_refused");
  }
  const d162 = env.D162_RESTRICTED_ACCEPTANCE_ENABLED;
  if (d162 !== undefined) {
    if (d162 === "1") return "d162_restricted_accepted";
    throw new Error("d162_restricted_preview_configuration_refused");
  }
  const enabled = env.D161_RESTRICTED_ACCEPTANCE_ENABLED;
  if (enabled === undefined) return "completed_preview";
  if (enabled === "1") return "d161_restricted_accepted";
  throw new Error("d161_restricted_preview_configuration_refused");
}

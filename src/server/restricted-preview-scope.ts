import type { FrontendSermonScope } from "./queries/public-sermons";

export function localFrontendPreviewScope(env: NodeJS.ProcessEnv): FrontendSermonScope {
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

/** Explicit origin configuration; never derive canonical identity from request headers. */
export interface SeoHttpPolicyInput {
  environment: "production" | "staging" | "local";
  canonicalOrigin: string;
  /** Exact old HTTP(S) origins approved to redirect to canonicalOrigin. */
  redirectOrigins?: readonly string[];
  /** Exact listener origins for an isolated local/staging rehearsal. */
  rehearsalOrigins?: readonly string[];
}
export interface SeoHttpPolicy {
  environment: SeoHttpPolicyInput["environment"];
  canonicalOrigin: string;
  indexable: boolean;
  acceptedOrigins: readonly string[];
}
function origin(value: string, requireHttps = false): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("seo_origin_invalid"); }
  if (!["https:", "http:"].includes(parsed.protocol) || (requireHttps && parsed.protocol !== "https:")
    || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash
    || parsed.origin !== value || parsed.hostname.endsWith(".")) throw new Error("seo_origin_invalid");
  return parsed.origin;
}
export function createSeoHttpPolicy(input: SeoHttpPolicyInput): SeoHttpPolicy {
  if (!["production", "staging", "local"].includes(input.environment)) throw new Error("seo_environment_invalid");
  const canonical = origin(input.canonicalOrigin, true);
  const host = new URL(canonical).hostname;
  if (host === "localhost" || host === "[::1]" || /^\d+(?:\.\d+){3}$/.test(host)
    || !host.includes(".")) throw new Error("seo_canonical_origin_invalid");
  const production = input.environment === "production";
  if (production && input.rehearsalOrigins?.length) throw new Error("seo_production_rehearsal_origin_refused");
  const aliases = (input.redirectOrigins ?? []).map(value => origin(value));
  const rehearsal = (input.rehearsalOrigins ?? []).map(value => origin(value));
  if (!production && rehearsal.length === 0) throw new Error("seo_rehearsal_origin_required");
  return Object.freeze({
    environment: input.environment, canonicalOrigin: canonical, indexable: production,
    acceptedOrigins: Object.freeze([...new Set(production ? [canonical, ...aliases] : rehearsal)])
  });
}

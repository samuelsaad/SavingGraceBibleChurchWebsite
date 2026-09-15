import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const reasons = ["quotaExceeded", "dailyLimitExceeded", "forbidden", "insufficientPermissions",
  "authError", "invalidCredentials", "accessNotConfigured", "youtubeSignupRequired",
  "notFound", "videoNotFound", "captionNotFound", "unrecognized_or_unavailable"] as const;
const reasonSet = new Set<string>(reasons);
export const youtubeMethodSchema = z.enum(["channels.list", "videos.list", "captions.list", "captions.download"]);
export const safeYouTubeDiagnosticSchema = z.object({
  sequence: z.number().int().min(1).max(36),
  apiMethod: youtubeMethodSchema,
  timestamp: z.iso.datetime(),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  reason: z.enum(reasons),
  classification: z.enum(["quota_blocked", "access_restricted", "authentication_restricted",
    "resource_unavailable", "unresolved_provider_error"])
}).strict();
export type SafeYouTubeDiagnostic = z.infer<typeof safeYouTubeDiagnosticSchema>;
export type YouTubeDiagnosticContext = Pick<SafeYouTubeDiagnostic, "sequence" | "apiMethod" | "timestamp">;

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

// Read only Google's structured envelope, never Error.message, request config, headers or URLs.
// Downloads request arraybuffer: their JSON error envelope must be decoded before inspecting reasons.
function decodeBody(input: unknown): Record<string, unknown> | undefined {
  try {
    let value = input;
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value)
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      if (bytes.byteLength > 65_536) return undefined;
      value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    if (typeof value === "string") {
      if (value.length > 65_536) return undefined;
      value = JSON.parse(value);
    }
    return object(value);
  } catch { return undefined; }
}

function status(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value < 600 ? value : null;
}

export function sanitizeYouTubeError(error: unknown, context: YouTubeDiagnosticContext): SafeYouTubeDiagnostic {
  let httpStatus: number | null = null;
  let reason: SafeYouTubeDiagnostic["reason"] = "unrecognized_or_unavailable";
  try {
    const outer = object(error);
    const response = object(outer?.response);
    const body = decodeBody(response?.data);
    const envelope = object(body?.error);
    httpStatus = status(response?.status) ?? status(outer?.status) ?? status(outer?.code) ?? status(envelope?.code);
    const entries = envelope?.errors;
    // Conflicting or unrecognized reason arrays remain unresolved; never guess from free text.
    if (Array.isArray(entries) && entries.length > 0 && entries.length <= 20) {
      const found = entries.map(entry => object(entry)?.reason);
      if (found.every(item => typeof item === "string" && reasonSet.has(item)) && new Set(found).size === 1) {
        reason = found[0] as SafeYouTubeDiagnostic["reason"];
      }
    }
  } catch { reason = "unrecognized_or_unavailable"; }
  const classification: SafeYouTubeDiagnostic["classification"] =
    reason === "quotaExceeded" || reason === "dailyLimitExceeded" ? "quota_blocked"
      : reason === "authError" || reason === "invalidCredentials" ? "authentication_restricted"
        : ["forbidden", "insufficientPermissions", "accessNotConfigured", "youtubeSignupRequired"].includes(reason) ? "access_restricted"
          : ["notFound", "videoNotFound", "captionNotFound"].includes(reason) ? "resource_unavailable"
            : "unresolved_provider_error";
  return safeYouTubeDiagnosticSchema.parse({ sequence: context.sequence, apiMethod: context.apiMethod,
    timestamp: context.timestamp, httpStatus, reason, classification });
}

export const noYouTubeRetryOptions = Object.freeze({ retry: false as const,
  retryConfig: Object.freeze({ retry: 0 }) });

// Google OAuth's separate 401/403 reauthentication retry also needs to remain disabled.
export function assertNoOAuthFailureRetry(client: {
  credentials: { expiry_date?: number | null }; forceRefreshOnFailure?: boolean;
}): void {
  if (client.forceRefreshOnFailure !== false || !Number.isFinite(client.credentials.expiry_date) ||
    (client.credentials.expiry_date ?? 0) <= 0) throw new Error("oauth_no_retry_guard_failed");
}

export async function runYouTubeRequestOnce<T>(context: YouTubeDiagnosticContext,
  request: (options: typeof noYouTubeRetryOptions) => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; diagnostic: SafeYouTubeDiagnostic }> {
  // Deliberately one invocation: no loops, sleep, refresh-on-failure or recursive retry.
  try { return { ok: true, value: await request(noYouTubeRetryOptions) }; }
  catch (error) { return { ok: false, diagnostic: sanitizeYouTubeError(error, context) }; }
}

export async function persistYouTubeDiagnostic(directory: string, input: SafeYouTubeDiagnostic): Promise<void> {
  const diagnostic = safeYouTubeDiagnosticSchema.parse(input);
  const stamp = diagnostic.timestamp.replace(/[-:.]/gu, "");
  const name = `${String(diagnostic.sequence).padStart(2, "0")}-${stamp}.private.json`;
  // Exclusive creation never overwrites a previous diagnostic or any checkpoint history.
  await writeFile(join(directory, name), JSON.stringify(diagnostic) + "\n", { flag: "wx", mode: 0o600 });
}

// An opt-in access diagnostic. Keep the historical six-field diagnostic contract intact.
const oauthCodes = ["invalid_grant", "invalid_client", "invalid_request", "unauthorized_client",
  "invalid_scope", "unsupported_grant_type", "access_denied", "temporarily_unavailable",
  "invalid_dpop_proof", "use_dpop_nonce", "unrecognized_or_unavailable"] as const;
const apiCodes = [...reasons, "invalidCriteria", "badRequest", "channelForbidden", "channelNotFound"] as const;
const endpointPaths = ["/token", "/oauth2/v4/token", "/youtube/v3/channels", "/youtube/v3/videos",
  "/youtube/v3/captions", "unrecognized_or_unavailable"] as const;
export const googleAccessDiagnosticSchema = safeYouTubeDiagnosticSchema.extend({
  endpointHost: z.enum(["oauth2.googleapis.com", "www.googleapis.com", "youtube.googleapis.com", "unrecognized_or_unavailable"]),
  endpointPath: z.enum(endpointPaths),
  operation: z.enum(["oauth_token_refresh", "oauth_token_exchange", "youtube_api", "unrecognized_or_unavailable"]),
  googleErrorCode: z.enum(oauthCodes),
  googleErrorReason: z.enum(apiCodes),
  explanation: z.enum(["refresh_grant_rejected_expired_or_revoked", "refresh_grant_rejected", "authorization_grant_rejected",
    "oauth_client_rejected", "request_parameters_rejected", "structured_provider_error", "unrecognized_or_unavailable"])
}).strict();
export type GoogleAccessDiagnostic = z.infer<typeof googleAccessDiagnosticSchema>;

export function sanitizeGoogleAccessError(error: unknown, context: YouTubeDiagnosticContext,
  observedGrant?: "refresh_token" | "authorization_code"): GoogleAccessDiagnostic {
  const result: GoogleAccessDiagnostic = { ...sanitizeYouTubeError(error, context),
    endpointHost: "unrecognized_or_unavailable", endpointPath: "unrecognized_or_unavailable",
    operation: "unrecognized_or_unavailable", googleErrorCode: "unrecognized_or_unavailable",
    googleErrorReason: "unrecognized_or_unavailable", explanation: "unrecognized_or_unavailable" };
  try {
    const outer = object(error);
    const response = object(outer?.response);
    const config = object(response?.config) ?? object(outer?.config);
    const rawUrl = config?.url;
    const url = rawUrl instanceof URL ? rawUrl : typeof rawUrl === "string" ? new URL(rawUrl) : null;
    // Return only exact known endpoints. Never include query, userinfo, arbitrary path or fragments.
    if (url?.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443")) {
      const tokenEndpoint = (url.hostname === "oauth2.googleapis.com" && url.pathname === "/token") ||
        (url.hostname === "www.googleapis.com" && url.pathname === "/oauth2/v4/token");
      const apiEndpoint = ["www.googleapis.com", "youtube.googleapis.com"].includes(url.hostname) &&
        ["/youtube/v3/channels", "/youtube/v3/videos", "/youtube/v3/captions"].includes(url.pathname);
      if (tokenEndpoint || apiEndpoint) {
        result.endpointHost = url.hostname as GoogleAccessDiagnostic["endpointHost"];
        result.endpointPath = url.pathname as GoogleAccessDiagnostic["endpointPath"];
        if (apiEndpoint) result.operation = "youtube_api";
        else {
          const data = config?.data;
          const grant = observedGrant ?? (data instanceof URLSearchParams ? data.get("grant_type")
            : typeof data === "string" && data.length <= 65_536 ? new URLSearchParams(data).get("grant_type")
              : object(data)?.grant_type);
          if (grant === "refresh_token") result.operation = "oauth_token_refresh";
          if (grant === "authorization_code") result.operation = "oauth_token_exchange";
        }
      }
    }
    const body = decodeBody(response?.data);
    if (["/token", "/oauth2/v4/token"].includes(result.endpointPath) && typeof body?.error === "string" &&
      (oauthCodes as readonly string[]).includes(body.error)) {
      result.googleErrorCode = body.error as GoogleAccessDiagnostic["googleErrorCode"];
      if (body.error === "invalid_grant") {
        result.classification = "authentication_restricted";
        result.explanation = result.operation === "oauth_token_refresh" &&
          body.error_description === "Token has been expired or revoked."
          ? "refresh_grant_rejected_expired_or_revoked" : result.operation === "oauth_token_refresh"
            ? "refresh_grant_rejected" : result.operation === "oauth_token_exchange"
              ? "authorization_grant_rejected" : "structured_provider_error";
      } else if (body.error === "invalid_client" || body.error === "unauthorized_client") {
        result.classification = "authentication_restricted";
        result.explanation = "oauth_client_rejected";
      } else result.explanation = "structured_provider_error";
    }
    if (result.operation === "youtube_api") {
      const entries = object(body?.error)?.errors;
      if (Array.isArray(entries) && entries.length > 0 && entries.length <= 20) {
        const values = entries.map(entry => object(entry)?.reason);
        if (values.every(value => typeof value === "string" && (apiCodes as readonly string[]).includes(value)) &&
          new Set(values).size === 1) {
          result.googleErrorReason = values[0] as GoogleAccessDiagnostic["googleErrorReason"];
          result.explanation = ["invalidCriteria", "badRequest"].includes(result.googleErrorReason)
            ? "request_parameters_rejected" : "structured_provider_error";
        }
      }
    }
  } catch { /* Do not expose errors raised by malformed provider objects. */ }
  return googleAccessDiagnosticSchema.parse(result);
}

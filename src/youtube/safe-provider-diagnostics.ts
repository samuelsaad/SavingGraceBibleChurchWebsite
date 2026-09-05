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

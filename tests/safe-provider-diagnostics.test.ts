import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { google } from "googleapis";
import { assertNoOAuthFailureRetry, noYouTubeRetryOptions, persistYouTubeDiagnostic,
  runYouTubeRequestOnce, sanitizeYouTubeError } from "../src/youtube/safe-provider-diagnostics";

const context = { sequence: 4, apiMethod: "captions.download" as const, timestamp: "2026-09-06T00:00:00.000Z" };
const body = (reason: string) => ({ error: { code: 403, message: "synthetic private message", errors: [{ reason }] } });

describe("private official YouTube diagnostics", () => {
  it.each([
    ["quotaExceeded", "quota_blocked"], ["forbidden", "access_restricted"],
    ["insufficientPermissions", "access_restricted"], ["authError", "authentication_restricted"]
  ])("recognizes %s without retaining provider messages", (reason, classification) => {
    expect(sanitizeYouTubeError({ response: { status: 403, data: body(reason) } }, context))
      .toEqual({ ...context, httpStatus: 403, reason, classification });
  });

  it.each(["object", "string", "buffer", "arraybuffer", "uint8array"])("decodes the %s error representation", form => {
    const data = body("quotaExceeded");
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    const encoded = form === "object" ? data : form === "string" ? JSON.stringify(data)
      : form === "buffer" ? Buffer.from(bytes) : form === "arraybuffer" ? bytes.buffer : bytes;
    expect(sanitizeYouTubeError({ response: { status: 403, data: encoded } }, context).reason).toBe("quotaExceeded");
  });

  it.each([undefined, null, "not json", Buffer.from([0xff]), new Uint8Array(65_537),
    { error: { errors: [] } }, body("private unknown words"),
    { error: { errors: [{ reason: "quotaExceeded" }, { reason: "forbidden" }] } },
    { error: { message: "quotaExceeded" } }])("does not guess from malformed or unknown bodies", data => {
    expect(sanitizeYouTubeError({ response: { status: 403, data }, message: "quotaExceeded" }, context))
      .toEqual({ ...context, httpStatus: 403, reason: "unrecognized_or_unavailable", classification: "unresolved_provider_error" });
  });

  it("excludes synthetic secrets, identities, prose, requests and unrestricted error text", () => {
    const sentinel = "SYNTHETIC_SENSITIVE_SENTINEL";
    const error = { message: sentinel, stack: sentinel, config: { url: sentinel, headers: { Authorization: sentinel } },
      response: { status: 403, headers: { cookie: sentinel }, data: {
        error: { code: 403, message: sentinel, errors: [{ reason: "forbidden", location: sentinel, domain: sentinel }] },
        videoId: sentinel, captionId: sentinel, transcript: sentinel } } };
    const result = sanitizeYouTubeError(error, context);
    expect(Object.keys(result).sort()).toEqual(["apiMethod", "classification", "httpStatus", "reason", "sequence", "timestamp"]);
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("preserves prior history and refuses overwriting a diagnostic", async () => {
    const directory = await mkdtemp(join(tmpdir(), "savinggrace-safe-diagnostic-test-"));
    try {
      const history = Buffer.from('{"anonymised":true,"attempts":[1,2,3]}');
      const prior = join(directory, "checkpoint.private.json");
      await writeFile(prior, history, { flag: "wx" });
      const diagnostic = sanitizeYouTubeError({ response: { status: 403, data: body("quotaExceeded") } }, context);
      await persistYouTubeDiagnostic(directory, diagnostic);
      await expect(persistYouTubeDiagnostic(directory, diagnostic)).rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(prior)).toEqual(history);
      expect((await readdir(directory)).length).toBe(2);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("makes one request and never automatically retries HTTP 403", async () => {
    const request = vi.fn().mockRejectedValue({ response: { status: 403, data: Buffer.from(JSON.stringify(body("quotaExceeded"))) } });
    const result = await runYouTubeRequestOnce(context, request);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(noYouTubeRetryOptions);
    expect(result).toMatchObject({ ok: false, diagnostic: { reason: "quotaExceeded" } });
  });

  it("guards Google's independent OAuth failure retry without exposing authentication material", async () => {
    const client = new google.auth.OAuth2({ forceRefreshOnFailure: false });
    client.setCredentials({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", expiry_date: Date.now() + 3_600_000 });
    assertNoOAuthFailureRetry(client);
    const request = vi.spyOn(client.transporter, "request").mockRejectedValue({ response: {
      status: 403, config: {}, data: body("forbidden") } });
    await expect(client.request({ url: "https://invalid.example/anonymous", ...noYouTubeRetryOptions })).rejects.toBeDefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(() => assertNoOAuthFailureRetry({ credentials: {}, forceRefreshOnFailure: false })).toThrow("oauth_no_retry_guard_failed");
    expect(() => assertNoOAuthFailureRetry({ credentials: { expiry_date: 1 }, forceRefreshOnFailure: true })).toThrow("oauth_no_retry_guard_failed");
  });
});

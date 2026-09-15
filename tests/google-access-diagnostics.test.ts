import { describe, expect, it } from "vitest";
import { sanitizeGoogleAccessError, sanitizeYouTubeError } from "../src/youtube/safe-provider-diagnostics";

const context = { sequence: 1, apiMethod: "channels.list" as const, timestamp: "2026-09-15T01:00:00.000Z" };
const secret = "SYNTHETIC_PRIVATE_SENTINEL";
const oauth = (data: unknown) => ({ message: secret, response: { status: 400, data,
  config: { url: `https://oauth2.googleapis.com/token?secret=${secret}`,
    headers: { Authorization: secret }, data: new URLSearchParams({ grant_type: "refresh_token", refresh_token: secret }) } } });

describe("bounded Google access diagnosis", () => {
  it("retains only a pre-request grant enum when the SDK redacts grant_type", () => {
    const error = oauth({ error: "invalid_grant", error_description: "Token has been expired or revoked." });
    error.response.config.data.set("grant_type", "SDK_REDACTED");
    expect(sanitizeGoogleAccessError(error, context, "refresh_token")).toMatchObject({
      operation: "oauth_token_refresh", googleErrorCode: "invalid_grant", explanation: "refresh_grant_rejected_expired_or_revoked" });
    expect(sanitizeGoogleAccessError(error, context).googleErrorCode).toBe("invalid_grant");
  });
  it.each(["object", "string", "buffer", "arraybuffer"])("identifies OAuth refresh in %s form without guessing the channel endpoint", form => {
    const body = { error: "invalid_grant", error_description: "Token has been expired or revoked.", token: secret };
    const bytes = new TextEncoder().encode(JSON.stringify(body));
    const data = form === "object" ? body : form === "string" ? JSON.stringify(body) : form === "buffer" ? Buffer.from(bytes) : bytes.buffer;
    const result = sanitizeGoogleAccessError(oauth(data), context);
    expect(result).toMatchObject({ endpointHost: "oauth2.googleapis.com", endpointPath: "/token",
      httpStatus: 400, operation: "oauth_token_refresh", googleErrorCode: "invalid_grant",
      explanation: "refresh_grant_rejected_expired_or_revoked", classification: "authentication_restricted" });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(sanitizeYouTubeError(oauth(data), context).reason).toBe("unrecognized_or_unavailable");
  });
  it("reports valid structured channel errors separately from refresh errors", () => {
    expect(sanitizeGoogleAccessError({ response: { status: 400, config: {
      url: "https://www.googleapis.com/youtube/v3/channels?mine=true" },
    data: { error: { errors: [{ reason: "invalidCriteria", message: secret }] } } } }, context))
      .toMatchObject({ operation: "youtube_api", googleErrorReason: "invalidCriteria", explanation: "request_parameters_rejected" });
  });
  it("does not label a rejected authorization-code exchange as a refresh failure", () => {
    expect(sanitizeGoogleAccessError(oauth({ error: "invalid_grant" }), context, "authorization_code"))
      .toMatchObject({ operation: "oauth_token_exchange", explanation: "authorization_grant_rejected" });
  });
  it.each([undefined, "broken", Buffer.from([255]), { error: secret }, { error: "invalid_grant", error_description: secret }])(
    "never exposes unknown or unrestricted provider messages", data => {
      expect(JSON.stringify(sanitizeGoogleAccessError(oauth(data), context))).not.toContain(secret);
    });
  it.each([`https://evil.invalid/${secret}`, `https://www.googleapis.com/youtube/v3/captions/${secret}`,
    `https://${secret}@oauth2.googleapis.com/token`, "http://oauth2.googleapis.com/token"])(
    "does not disclose or trust an unexpected endpoint", url => {
      const error = oauth({ error: "invalid_grant" });
      error.response.config.url = url;
      const result = sanitizeGoogleAccessError(error, context);
      expect(result.operation).toBe("unrecognized_or_unavailable");
      expect(result.endpointHost).toBe("unrecognized_or_unavailable");
      expect(JSON.stringify(result)).not.toContain(secret);
    });
});

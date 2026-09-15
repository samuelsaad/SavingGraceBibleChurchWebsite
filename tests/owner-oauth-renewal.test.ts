import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile, rename, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "node:http";
import { createHash } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { createRenewalClient, OwnerRenewalError, parseRenewalAnchor, receiveRenewalConsent,
  renewOwnerToken, validateFreshCredentials, verifyRenewedOwner } from "../src/youtube/owner-oauth-renewal";
import { protectReplacementFile, replaceVerifiedToken, withTokenRenewalLock } from "../src/youtube/protected-token-replacement";
import { expectedYouTubeChannelTitle, youtubeForceSslScope } from "../src/youtube/pilot-caption-proof";

const configuration = { clientId: "synthetic-client", clientSecret: "synthetic-secret" };
const channel = "UC" + "A".repeat(22);
const credentials = () => ({ access_token: "synthetic-new-access", refresh_token: "synthetic-new-refresh",
  token_type: "Bearer", scope: youtubeForceSslScope, expiry_date: Date.now() + 3_600_000 });
const original = Buffer.from(JSON.stringify({ schemaVersion: 1, verifiedAt: "2026-01-01T00:00:00.000Z",
  scope: youtubeForceSslScope, channel: { id: channel, title: expectedYouTubeChannelTitle },
  credentials: { refresh_token: "synthetic-invalid-old", expiry_date: 1 } }));
const directories: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const directory of directories.splice(0)) await rm(directory, { recursive: true }); });
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "sg-oauth-anonymous-")); directories.push(directory);
  const path = join(directory, "token.json"); await writeFile(path, original, { mode: 0o600 }); return { directory, path };
}
function fakeClient() {
  const client = createRenewalClient(configuration, "http://127.0.0.1:1/oauth2callback");
  const exchange = vi.spyOn(client, "getToken").mockImplementation((async () => ({ tokens: credentials(), res: null })) as typeof client.getToken);
  const generateAuthUrl = client.generateAuthUrl.bind(client);
  return { client, exchange, createClient: (_configuration: typeof configuration, redirectUri: string) => {
    vi.spyOn(client, "generateAuthUrl").mockImplementation(options => generateAuthUrl({ ...options, redirect_uri: redirectUri }));
    return client;
  } };
}
async function callback(auth: string, mutate?: (url: URL) => void) {
  const authUrl = new URL(auth);
  const url = new URL(authUrl.searchParams.get("redirect_uri")!);
  url.searchParams.set("state", authUrl.searchParams.get("state")!);
  url.searchParams.set("code", "synthetic-authorization-code");
  mutate?.(url);
  return new Promise<{ status: number; body: string; headers: import("node:http").IncomingHttpHeaders }>((done, fail) => {
    get(url, response => { let body = ""; response.on("data", chunk => body += String(chunk));
      response.on("end", () => done({ status: response.statusCode!, body, headers: response.headers })); }).on("error", fail);
  });
}

describe("explicit owner renewal", () => {
  it("uses fresh consent, offline access, loopback state and S256 PKCE with no saving listeners", async () => {
    const mock = fakeClient(); let challenge = "";
    const result = await receiveRenewalConsent(configuration, async auth => {
      const url = new URL(auth);
      expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url.searchParams.get("prompt")).toBe("select_account consent");
      expect(url.searchParams.get("access_type")).toBe("offline");
      expect(url.searchParams.get("scope")).toBe(youtubeForceSslScope);
      expect(url.searchParams.has("include_granted_scopes")).toBe(false);
      expect(url.searchParams.get("state")).toMatch(/^[a-f0-9]{64}$/u);
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      challenge = url.searchParams.get("code_challenge")!;
      const response = await callback(auth);
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).not.toContain("synthetic-authorization-code");
    }, mock);
    expect(mock.exchange).toHaveBeenCalledTimes(1);
    const argument = mock.exchange.mock.calls[0]![0] as { code: string; codeVerifier: string; redirect_uri: string };
    expect(createHash("sha256").update(argument.codeVerifier).digest("base64url")).toBe(challenge);
    expect(argument.redirect_uri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/oauth2callback$/u);
    expect(result.client.listenerCount("tokens")).toBe(0);
    expect(result.credentials.refresh_token).toBe("synthetic-new-refresh");
    await expect(callback(new URL("https://example.invalid/?redirect_uri=" + encodeURIComponent(argument.redirect_uri)).href)).rejects.toThrow();
  });

  it.each(["state", "duplicate", "missing", "denied"])("rejects %s callbacks without exchange", async kind => {
    const mock = fakeClient();
    await expect(receiveRenewalConsent(configuration, async auth => {
      await callback(auth, url => {
        if (kind === "state") url.searchParams.set("state", "wrong");
        if (kind === "duplicate") url.searchParams.append("code", "second");
        if (kind === "missing") url.searchParams.delete("code");
        if (kind === "denied") { url.searchParams.delete("code"); url.searchParams.set("error", "access_denied"); }
      });
    }, mock)).rejects.toMatchObject({ code: kind === "denied" ? "oauth_denied" : "oauth_callback_invalid" });
    expect(mock.exchange).not.toHaveBeenCalled();
  });

  it("closes on timeout without exchange", async () => {
    const mock = fakeClient(); let auth = "";
    await expect(receiveRenewalConsent(configuration, async url => { auth = url; }, { ...mock, timeoutMs: 10 }))
      .rejects.toMatchObject({ code: "oauth_timeout" });
    expect(mock.exchange).not.toHaveBeenCalled(); await expect(callback(auth)).rejects.toThrow();
  });
  it("closes on cancellation or browser failure", async () => {
    const mock = fakeClient(); const controller = new AbortController();
    await expect(receiveRenewalConsent(configuration, async () => { controller.abort(); }, { ...mock, signal: controller.signal }))
      .rejects.toMatchObject({ code: "oauth_cancelled" });
    await expect(receiveRenewalConsent(configuration, async () => { throw new Error("private browser detail"); }, mock))
      .rejects.toMatchObject({ code: "browser_open_failed" });
    expect(mock.exchange).not.toHaveBeenCalled();
  });
  it("requires a fresh refresh token and exact scope", () => {
    expect(() => validateFreshCredentials({ ...credentials(), refresh_token: null })).toThrow("fresh_credentials_missing");
    expect(() => validateFreshCredentials({ ...credentials(), scope: youtubeForceSslScope + " extra" })).toThrow("scope_missing");
    expect(() => validateFreshCredentials({ ...credentials(), expiry_date: 1 })).toThrow("fresh_credentials_missing");
    expect(() => parseRenewalAnchor(Buffer.from("malformed private input"))).toThrow("renewal_token_invalid");
  });

  it("sanitizes failed exchanges and performs no retry", async () => {
    const mock = fakeClient(); mock.exchange.mockRejectedValue({ response: { status: 400,
      config: { url: "https://oauth2.googleapis.com/token?secret=PRIVATE" },
      data: { error: "invalid_grant", error_description: "PRIVATE transcript token secret" } }, message: "PRIVATE" });
    const error = await receiveRenewalConsent(configuration, async auth => { await callback(auth); }, mock).catch(value => value);
    expect(error.code).toBe("oauth_exchange_failed");
    expect(error.diagnostic.googleErrorCode).toBe("invalid_grant");
    expect(error.diagnostic.operation).toBe("oauth_token_exchange");
    expect(JSON.stringify(error)).not.toContain("PRIVATE"); expect(mock.exchange).toHaveBeenCalledTimes(1);
  });

  it("disables SDK transport retries, redirects and auth-failure retry", async () => {
    const underlying = vi.spyOn(OAuth2Client.prototype, "getToken");
    const client = createRenewalClient(configuration, "http://127.0.0.1:1/oauth2callback");
    expect(client.forceRefreshOnFailure).toBe(false);
    // Network-free source assertion complements the real wrapped transport's bounded options.
    const source = await readFile(new URL("../src/youtube/owner-oauth-renewal.ts", import.meta.url), "utf8");
    expect(source).toContain("...noYouTubeRetryOptions"); expect(source).toContain("maxRedirects: 0");
    expect(source).not.toContain('on("tokens"'); expect(underlying).not.toHaveBeenCalled();
  });
  it("forces one transport attempt even when the SDK requests retries", async () => {
    const client = createRenewalClient(configuration, "http://127.0.0.1:1/oauth2callback");
    const adapter = vi.fn(async (options: { retry?: boolean; retryConfig?: { retry?: number }; maxRedirects?: number }) => {
      expect(options.retry).toBe(false); expect(options.retryConfig?.retry).toBe(0); expect(options.maxRedirects).toBe(0);
      throw new Error("synthetic transport failure");
    });
    await expect(client.transporter.request({ url: "https://example.invalid/never-contacted", retry: true,
      retryConfig: { retry: 5 }, adapter: adapter as never })).rejects.toThrow();
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it.each(["valid", "wrong", "missing", "multiple", "nextPage", "failure"])("checks authenticated exact ID: %s", async kind => {
    const client = createRenewalClient(configuration, "http://127.0.0.1:1/oauth2callback"); client.setCredentials(credentials());
    const list = vi.fn().mockResolvedValue({ data: { items: kind === "missing" ? [] :
      kind === "multiple" ? [{ id: channel }, { id: "different" }] : [{ id: kind === "wrong" ? "different" : channel }],
      ...(kind === "nextPage" ? { nextPageToken: "opaque" } : {}) } });
    if (kind === "failure") list.mockRejectedValue(new Error("private SDK response"));
    vi.spyOn(google, "youtube").mockReturnValue({ channels: { list } } as never);
    if (kind === "valid") await verifyRenewedOwner(client, channel);
    else await expect(verifyRenewedOwner(client, channel)).rejects.toMatchObject({ code: kind === "failure" ? "channel_verification_failed" : "wrong_channel" });
    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]).toEqual([{ part: ["id"], mine: true, maxResults: 50, fields: "items(id),nextPageToken" },
      { retry: false, retryConfig: { retry: 0 } }]);
  });

  it("replaces only after verified fresh credentials and preserves the established channel", async () => {
    const { path, directory } = await fixture(); const mock = fakeClient();
    const verify = vi.fn(async (_client: OAuth2Client, expected: string) => {
      expect(expected).toBe(channel); expect((await readFile(path)).equals(original)).toBe(true);
    });
    const result = await renewOwnerToken({ tokenPath: path, configuration, openBrowser: async () => {} }, {
      consent: async () => ({ client: mock.client, credentials: credentials() }), verify, replace: replaceVerifiedToken
    });
    expect(result).toEqual({ outcome: "renewed", channelVerified: true, tokenReplaced: true });
    const stored = JSON.parse(await readFile(path, "utf8"));
    expect(stored.channel.id).toBe(channel); expect(stored.credentials.refresh_token).toBe("synthetic-new-refresh");
    expect(await readdir(directory)).toEqual(["token.json"]);
    if (process.platform !== "win32") expect((await lstat(path)).mode & 0o777).toBe(0o600);
  });

  it.each(["oauth_timeout", "oauth_denied", "oauth_callback_invalid", "fresh_credentials_missing", "wrong_channel", "channel_verification_failed", "replacement", "cancel_after_verify"])
  ("preserves previous bytes and removes temporary material on %s", async failure => {
    const { path, directory } = await fixture(); const controller = new AbortController(); const mock = fakeClient();
    await expect(renewOwnerToken({ tokenPath: path, configuration, openBrowser: async () => {}, signal: controller.signal }, {
      consent: async () => {
        if (["oauth_timeout", "oauth_denied", "oauth_callback_invalid"].includes(failure)) throw new OwnerRenewalError(failure as "oauth_timeout");
        return { client: mock.client, credentials: { ...credentials(), ...(failure === "fresh_credentials_missing" ? { refresh_token: null } : {}) } };
      },
      verify: async () => {
        if (failure === "wrong_channel" || failure === "channel_verification_failed") throw new OwnerRenewalError(failure);
        if (failure === "cancel_after_verify") controller.abort();
      },
      replace: (target, old, next) => replaceVerifiedToken(target, old, next, { protect: protectReplacementFile,
        rename: async () => { throw new Error("PRIVATE inaccessible target"); } })
    })).rejects.toThrow();
    expect((await readFile(path)).equals(original)).toBe(true);
    expect(await readdir(directory)).toEqual(["token.json"]);
  });

  it("fails closed before writing secrets if permissions cannot be protected", async () => {
    const { path, directory } = await fixture();
    await expect(replaceVerifiedToken(path, original, Buffer.from("synthetic-new-secret"), {
      protect: async (_old, temp) => { expect((await readFile(temp)).length).toBe(0); throw new Error("permission denied"); }, rename
    })).rejects.toThrow("token_replacement_failed");
    expect((await readFile(path)).equals(original)).toBe(true); expect(await readdir(directory)).toEqual(["token.json"]);
  });
  it("preserves intervening token changes and refuses concurrent renewal", async () => {
    const { path, directory } = await fixture();
    await withTokenRenewalLock(path, async () => {
      await expect(withTokenRenewalLock(path, async () => {})).rejects.toThrow("renewal_already_running");
    });
    await expect(replaceVerifiedToken(path, original, Buffer.from("new"), { protect: async (_old, temp) => {
      await protectReplacementFile(path, temp); await writeFile(path, "intervening-synthetic-token");
    }, rename })).rejects.toThrow("token_changed");
    expect(await readFile(path, "utf8")).toBe("intervening-synthetic-token"); expect(await readdir(directory)).toEqual(["token.json"]);
  });
  it("cancellation during replacement leaves the old token intact", async () => {
    const { path, directory } = await fixture(); const controller = new AbortController();
    await expect(replaceVerifiedToken(path, original, Buffer.from("synthetic replacement"), {
      protect: async (old, temp) => { await protectReplacementFile(old, temp); controller.abort(); }, rename
    }, controller.signal)).rejects.toThrow("renewal_cancelled");
    expect((await readFile(path)).equals(original)).toBe(true); expect(await readdir(directory)).toEqual(["token.json"]);
  });
  it("keeps the renewal flag explicit and ordinary authentication intact", async () => {
    const source = await readFile(new URL("../src/youtube/pilot-caption-cli.ts", import.meta.url), "utf8");
    expect(source).toContain('command === "auth" && unexpected.length === 1 && unexpected[0] === "--renew"');
    expect(source).toContain('if (command === "auth") await authenticateCommand()');
    expect(source).not.toContain("revokeCredentials");
  });
});

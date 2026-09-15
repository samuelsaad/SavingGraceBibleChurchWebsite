import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { OAuth2Client, CodeChallengeMethod, type Credentials } from "google-auth-library";
import { google } from "googleapis";
import { expectedYouTubeChannelTitle, youtubeForceSslScope } from "./pilot-caption-proof";
import { assertNoOAuthFailureRetry, noYouTubeRetryOptions, sanitizeGoogleAccessError,
  type GoogleAccessDiagnostic } from "./safe-provider-diagnostics";
import { readExistingToken, replaceVerifiedToken, withTokenRenewalLock } from "./protected-token-replacement";

type RenewalCode = "renewal_token_invalid" | "oauth_callback_invalid" | "oauth_denied" | "oauth_timeout" |
  "oauth_cancelled" | "oauth_callback_failed" | "oauth_pkce_failed" | "browser_open_failed" |
  "oauth_exchange_failed" | "fresh_credentials_missing" | "scope_missing" | "wrong_channel" |
  "channel_verification_failed" | "renewal_failed";
export class OwnerRenewalError extends Error {
  constructor(readonly code: RenewalCode, readonly diagnostic?: GoogleAccessDiagnostic) { super(code); }
}
interface Configuration { clientId: string; clientSecret: string }
interface StoredToken {
  schemaVersion: 1;
  scope: typeof youtubeForceSslScope;
  verifiedAt: string;
  channel: { id: string; title: typeof expectedYouTubeChannelTitle };
  credentials: Credentials;
}

export function parseRenewalAnchor(bytes: Buffer): StoredToken {
  try {
    const value = JSON.parse(bytes.toString("utf8")) as StoredToken;
    if (value.schemaVersion !== 1 || value.scope !== youtubeForceSslScope ||
      value.channel?.title !== expectedYouTubeChannelTitle || !/^UC[\w-]{22}$/u.test(value.channel.id) ||
      !Number.isFinite(Date.parse(value.verifiedAt)) || !value.credentials?.refresh_token) throw new Error();
    return value;
  } catch { throw new OwnerRenewalError("renewal_token_invalid"); }
}

export function createRenewalClient(configuration: Configuration, redirectUri: string): OAuth2Client {
  const client = new OAuth2Client({ clientId: configuration.clientId, clientSecret: configuration.clientSecret,
    redirectUri, forceRefreshOnFailure: false });
  const request = client.transporter.request.bind(client.transporter);
  // Override the SDK's own RETRY_CONFIG as well as per-API request options.
  client.transporter.request = ((options) => request({ ...options, ...noYouTubeRetryOptions,
    maxRedirects: 0, timeout: 30_000 })) as typeof client.transporter.request;
  return client;
}

export function validateFreshCredentials(credentials: Credentials): void {
  if (typeof credentials.refresh_token !== "string" || !credentials.refresh_token.trim() ||
    typeof credentials.access_token !== "string" || !credentials.access_token.trim() ||
    credentials.token_type?.toLowerCase() !== "bearer" ||
    !Number.isFinite(credentials.expiry_date) || (credentials.expiry_date ?? 0) < Date.now() + 60_000) {
    throw new OwnerRenewalError("fresh_credentials_missing");
  }
  const scopes = (credentials.scope ?? "").split(/\s+/u).filter(Boolean);
  if (scopes.length !== 1 || scopes[0] !== youtubeForceSslScope) throw new OwnerRenewalError("scope_missing");
}

export async function receiveRenewalConsent(configuration: Configuration, openBrowser: (url: string) => Promise<void>,
  options: { timeoutMs?: number; signal?: AbortSignal; createClient?: typeof createRenewalClient } = {}
): Promise<{ client: OAuth2Client; credentials: Credentials }> {
  const state = randomBytes(32).toString("hex");
  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: OwnerRenewalError) => void;
  let settled = false;
  const codePromise = new Promise<string>((done, fail) => { resolveCode = done; rejectCode = fail; });
  // A callback can arrive while the browser opener is still pending.
  void codePromise.catch(() => undefined);
  const reject = (code: RenewalCode) => { if (!settled) { settled = true; rejectCode(new OwnerRenewalError(code)); } };
  let expectedHost = "";
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Connection", "close");
    try {
      const url = new URL(request.url ?? "/", `http://${expectedHost}`);
      if (url.pathname !== "/oauth2callback") { response.writeHead(404).end("Not found."); return; }
      const received = Buffer.from(url.searchParams.get("state") ?? "");
      const expected = Buffer.from(state);
      if (settled || request.method !== "GET" || request.headers.host !== expectedHost ||
        url.origin !== `http://${expectedHost}` || url.searchParams.getAll("state").length !== 1 ||
        received.length !== expected.length || !timingSafeEqual(received, expected) ||
        url.searchParams.getAll("code").length > 1 || url.searchParams.getAll("error").length > 1) {
        reject("oauth_callback_invalid"); response.writeHead(400).end("Authorization callback rejected. Return to the application."); return;
      }
      if (url.searchParams.has("error")) {
        reject("oauth_denied"); response.writeHead(400).end("Authorization was not completed. Return to the application."); return;
      }
      const code = url.searchParams.get("code");
      if (!code || code.length > 4096) {
        reject("oauth_callback_invalid"); response.writeHead(400).end("Authorization callback rejected. Return to the application."); return;
      }
      settled = true;
      resolveCode(code);
      response.end("Authorization received. Channel verification is pending. You may return to the application.");
    } catch { reject("oauth_callback_invalid"); response.writeHead(400).end("Authorization callback rejected."); }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  const cancelled = () => reject("oauth_cancelled");
  let timer: NodeJS.Timeout | undefined;
  try {
    await new Promise<void>((done, fail) => {
      server.once("error", () => fail(new OwnerRenewalError("oauth_callback_failed")));
      server.listen(0, "127.0.0.1", done);
    });
    const address = server.address();
    if (!address || typeof address === "string" || address.address !== "127.0.0.1") throw new OwnerRenewalError("oauth_callback_failed");
    expectedHost = `127.0.0.1:${address.port}`;
    const redirectUri = `http://${expectedHost}/oauth2callback`;
    const client = (options.createClient ?? createRenewalClient)(configuration, redirectUri);
    if (client.listenerCount("tokens") !== 0) throw new OwnerRenewalError("renewal_failed");
    const verifier = await client.generateCodeVerifierAsync();
    if (!verifier.codeChallenge) throw new OwnerRenewalError("oauth_pkce_failed");
    const authorizationUrl = client.generateAuthUrl({ access_type: "offline", prompt: "select_account consent",
      scope: [youtubeForceSslScope], state, code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: verifier.codeChallenge });
    timer = setTimeout(() => reject("oauth_timeout"), options.timeoutMs ?? 600_000);
    options.signal?.addEventListener("abort", cancelled, { once: true });
    if (options.signal?.aborted) cancelled();
    if (!settled) await openBrowser(authorizationUrl).catch(() => { throw new OwnerRenewalError("browser_open_failed"); });
    const code = await codePromise;
    const response = await client.getToken({ code, redirect_uri: redirectUri, codeVerifier: verifier.codeVerifier })
      .catch((error: unknown) => { throw new OwnerRenewalError("oauth_exchange_failed", sanitizeGoogleAccessError(error,
        { sequence: 1, apiMethod: "channels.list", timestamp: new Date().toISOString() }, "authorization_code")); });
    if (options.signal?.aborted) throw new OwnerRenewalError("oauth_cancelled");
    validateFreshCredentials(response.tokens);
    client.setCredentials(response.tokens);
    return { client, credentials: response.tokens };
  } catch (error) { throw error instanceof OwnerRenewalError ? error : new OwnerRenewalError("renewal_failed"); }
  finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancelled);
    server.closeAllConnections();
    if (server.listening) await new Promise<void>(done => server.close(() => done()));
  }
}

export async function verifyRenewedOwner(client: OAuth2Client, expectedChannelId: string): Promise<void> {
  assertNoOAuthFailureRetry(client);
  const response = await google.youtube({ version: "v3", auth: client }).channels.list({
    part: ["id"], mine: true, maxResults: 50, fields: "items(id),nextPageToken"
  }, noYouTubeRetryOptions).catch((error: unknown) => {
    throw new OwnerRenewalError("channel_verification_failed", sanitizeGoogleAccessError(error,
      { sequence: 1, apiMethod: "channels.list", timestamp: new Date().toISOString() }));
  });
  if (response.data.nextPageToken || response.data.items?.length !== 1 || response.data.items[0]?.id !== expectedChannelId) {
    throw new OwnerRenewalError("wrong_channel");
  }
}

export async function renewOwnerToken(input: { tokenPath: string; configuration: Configuration;
  openBrowser: (url: string) => Promise<void>; signal?: AbortSignal },
  operations = { consent: receiveRenewalConsent, verify: verifyRenewedOwner, replace: replaceVerifiedToken }
): Promise<{ outcome: "renewed"; channelVerified: true; tokenReplaced: true }> {
  return withTokenRenewalLock(input.tokenPath, async () => {
    const original = await readExistingToken(input.tokenPath);
    const anchor = parseRenewalAnchor(original);
    // Never give the known-invalid credentials to an OAuth client or token listener.
    const fresh = await operations.consent(input.configuration, input.openBrowser, input.signal ? { signal: input.signal } : {});
    if (input.signal?.aborted) throw new OwnerRenewalError("oauth_cancelled");
    validateFreshCredentials(fresh.credentials);
    await operations.verify(fresh.client, anchor.channel.id);
    if (input.signal?.aborted) throw new OwnerRenewalError("oauth_cancelled");
    const replacement: StoredToken = { schemaVersion: 1, scope: youtubeForceSslScope,
      verifiedAt: new Date().toISOString(), channel: anchor.channel, credentials: fresh.credentials };
    await operations.replace(input.tokenPath, original, Buffer.from(JSON.stringify(replacement, null, 2) + "\n"), undefined, input.signal);
    return { outcome: "renewed", channelVerified: true, tokenReplaced: true };
  });
}

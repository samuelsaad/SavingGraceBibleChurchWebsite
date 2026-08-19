import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { homedir } from "node:os";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  stat,
  unlink
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { google, type youtube_v3 } from "googleapis";
import { CodeChallengeMethod, type Credentials, type OAuth2Client } from "google-auth-library";
import {
  analyzeStudioExport,
  assertExactVideoScope,
  captionAudioAssociationProvenance,
  captionParseFailureCode,
  compareCaptionAnalyses,
  expectedYouTubeChannelTitle,
  parseVttBytes,
  persistExactCaptionBytes,
  pilotYouTubeVideoIds,
  requireCommonPilotOwner,
  selectCaptionTrack,
  sha256,
  youtubeCaptionProofVersion,
  youtubeForceSslScope,
  type CaptionAnalysis,
  type CaptionTrackMetadata,
  type CaptionTrackSelection
} from "./pilot-caption-proof";

type YouTubeClient = youtube_v3.Youtube;

interface OAuthClientConfiguration {
  clientId: string;
  clientSecret: string;
}

interface StoredToken {
  schemaVersion: 1;
  scope: typeof youtubeForceSslScope;
  verifiedAt: string;
  channel: { id: string; title: typeof expectedYouTubeChannelTitle };
  credentials: Credentials;
}

interface VerifiedVideo {
  videoId: string;
  channelId: string;
  durationMs: number | null;
}

interface VerifiedAccount {
  channel: { id: string; title: typeof expectedYouTubeChannelTitle };
  videos: Map<string, VerifiedVideo>;
}

interface StudioSource {
  videoId: string;
  captionPath: string;
  language: string;
  trackType: "manual" | "automatic" | "unknown";
}

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(sourceDirectory, "..", "..");
const oauthConfigurationDirectory = join(repositoryRoot, "youtube-oath");
const privatePilotRoot = join(repositoryRoot, "phase-3b2-pilot");
const privateProofRoot = join(privatePilotRoot, "youtube-api-caption-proof");
const studioManifestPath = join(privatePilotRoot, "phase3b2-manifest.private.json");
const tokenPath = join(homedir(), "AppData", "Local", "SavingGraceBibleChurch", "youtube-oauth", "token.json");
const oauthTimeoutMs = 10 * 60 * 1_000;

class SafeProofError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new SafeProofError("configuration_invalid", `OAuth configuration is missing ${field}`);
  }
  return value;
}

async function loadOAuthClientConfiguration(): Promise<OAuthClientConfiguration> {
  const directory = await lstat(oauthConfigurationDirectory).catch(() => null);
  if (!directory?.isDirectory() || directory.isSymbolicLink()) {
    throw new SafeProofError("configuration_missing", "The protected desktop OAuth directory is unavailable");
  }
  const entries = await readdir(oauthConfigurationDirectory, { withFileTypes: true });
  const jsonEntries = entries.filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase("en-AU").endsWith(".json"));
  if (entries.some((entry) => entry.isSymbolicLink()) || jsonEntries.length !== 1 || entries.length !== 1) {
    throw new SafeProofError("configuration_invalid", "Expected exactly one regular desktop OAuth JSON file");
  }
  const parsed = JSON.parse(await readFile(join(oauthConfigurationDirectory, jsonEntries[0]!.name), "utf8")) as {
    installed?: { client_id?: unknown; client_secret?: unknown };
  };
  if (!parsed.installed) {
    throw new SafeProofError("configuration_invalid", "The OAuth client must be a desktop installed-app configuration");
  }
  return {
    clientId: requireString(parsed.installed.client_id, "client_id"),
    clientSecret: requireString(parsed.installed.client_secret, "client_secret")
  };
}

function createOAuthClient(configuration: OAuthClientConfiguration, redirectUri?: string): OAuth2Client {
  return new google.auth.OAuth2(configuration.clientId, configuration.clientSecret, redirectUri);
}

async function openSystemBrowser(url: string): Promise<void> {
  if (process.platform !== "win32") {
    throw new SafeProofError("browser_unavailable", "This bounded OAuth command requires the approved Windows workstation");
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.once("spawn", () => {
      child.unref();
      resolvePromise();
    });
    child.once("error", () => rejectPromise(new SafeProofError("browser_open_failed", "Could not open the system browser safely")));
  });
}

async function receiveOwnerAuthorization(
  configuration: OAuthClientConfiguration
): Promise<{ client: OAuth2Client; credentials: Credentials }> {
  const state = randomBytes(32).toString("hex");
  let resolveCode: ((value: string) => void) | null = null;
  let rejectCode: ((reason: Error) => void) | null = null;
  const codePromise = new Promise<string>((resolvePromise, rejectPromise) => {
    resolveCode = resolvePromise;
    rejectCode = rejectPromise;
  });
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    response.setHeader("Referrer-Policy", "no-referrer");
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname !== "/oauth2callback") {
      response.statusCode = 404;
      response.end("Not found.");
      return;
    }
    if (requestUrl.pathname !== "/oauth2callback") {
      response.statusCode = 404;
      response.end("Not found.");
      return;
    }
    if (requestUrl.searchParams.get("state") !== state) {
      response.statusCode = 400;
      response.end("Authorization state did not match. Return to the command line.");
      rejectCode?.(new SafeProofError("oauth_state_mismatch", "OAuth state validation failed"));
      return;
    }
    const code = requestUrl.searchParams.get("code");
    if (!code || requestUrl.searchParams.has("error")) {
      response.statusCode = 400;
      response.end("Authorization was not completed. Return to the command line.");
      rejectCode?.(new SafeProofError("oauth_denied", "The channel owner did not complete authorization"));
      return;
    }
    response.end("Authorization received. You may close this tab and return to the command line.");
    resolveCode?.(code);
  });
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => resolvePromise());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new SafeProofError("oauth_callback_failed", "Could not create the loopback OAuth callback");
  }
  const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
  const client = createOAuthClient(configuration, redirectUri);
  const verifier = await client.generateCodeVerifierAsync();
  if (!verifier.codeChallenge) {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    throw new SafeProofError("oauth_pkce_failed", "Could not create the protected OAuth challenge");
  }
  const authorizationUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account consent",
    include_granted_scopes: true,
    scope: [youtubeForceSslScope],
    state,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: verifier.codeChallenge
  });
  process.stdout.write("Opening Google consent in the system browser. The channel owner must sign in personally.\n");
  let timeout: NodeJS.Timeout | null = null;
  try {
    await openSystemBrowser(authorizationUrl);
    timeout = setTimeout(() => {
      rejectCode?.(new SafeProofError("oauth_timeout", "Owner authorization timed out without retaining a token"));
    }, oauthTimeoutMs);
    timeout.unref();
    const code = await codePromise;
    const tokenResponse = await client.getToken({ code, redirect_uri: redirectUri, codeVerifier: verifier.codeVerifier })
      .catch(() => {
        throw new SafeProofError("oauth_exchange_failed", "Google OAuth token exchange failed safely");
      });
    const credentials = tokenResponse.tokens;
    if (!credentials.refresh_token) {
      throw new SafeProofError("offline_access_missing", "Offline access was not granted; no token was retained");
    }
    const scopes = new Set((credentials.scope ?? "").split(/\s+/u).filter(Boolean));
    if (!scopes.has(youtubeForceSslScope)) {
      throw new SafeProofError("scope_missing", "The required YouTube force-SSL scope was not granted");
    }
    client.setCredentials(credentials);
    return { client, credentials };
  } finally {
    if (timeout) clearTimeout(timeout);
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
}

function parseIsoDuration(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/u);
  if (!match) return null;
  return Math.round(((Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) * 60 + Number(match[3] ?? 0)) * 1_000);
}

async function verifyExpectedChannelAndVideos(client: OAuth2Client): Promise<VerifiedAccount> {
  const youtube = google.youtube({ version: "v3", auth: client });
  const videosResponse = await youtube.videos.list({
    part: ["snippet", "contentDetails"],
    id: [...pilotYouTubeVideoIds],
    maxResults: pilotYouTubeVideoIds.length
  }, { retry: false }).catch(() => {
    throw new SafeProofError("video_verification_failed", "The official API could not verify the pilot videos");
  });
  const returnedVideos = (videosResponse.data.items ?? [])
    .filter((item) => item.id && pilotYouTubeVideoIds.includes(item.id as typeof pilotYouTubeVideoIds[number]))
    .map((item) => ({ videoId: item.id!, channelId: item.snippet?.channelId ?? "" }));
  let channelId: string;
  try {
    channelId = requireCommonPilotOwner(pilotYouTubeVideoIds, returnedVideos);
  } catch {
    throw new SafeProofError("pilot_owner_mismatch", "The three pilot videos did not resolve to one common owner channel");
  }
  const channelResponse = await youtube.channels.list({ part: ["id", "snippet"], mine: true, maxResults: 50 }, { retry: false })
    .catch(() => {
      throw new SafeProofError("channel_verification_failed", "The official API could not verify the signed-in channel");
    });
  const authenticatedChannels = (channelResponse.data.items ?? []).filter((item) => item.id);
  if (
    authenticatedChannels.length !== 1 || authenticatedChannels[0]!.id !== channelId ||
    authenticatedChannels[0]!.snippet?.title?.trim() !== expectedYouTubeChannelTitle
  ) {
    throw new SafeProofError("wrong_channel", "The authenticated YouTube channel did not match the common owner channel of all three pilots");
  }
  const videos = new Map<string, VerifiedVideo>();
  for (const item of videosResponse.data.items ?? []) {
    if (!item.id || !pilotYouTubeVideoIds.includes(item.id as typeof pilotYouTubeVideoIds[number])) continue;
    videos.set(item.id, {
      videoId: item.id,
      channelId,
      durationMs: parseIsoDuration(item.contentDetails?.duration)
    });
  }
  if (videos.size !== pilotYouTubeVideoIds.length) {
    throw new SafeProofError("video_missing", "The verified church channel did not return all three allowlisted pilot videos");
  }
  return { channel: { id: channelId, title: expectedYouTubeChannelTitle }, videos };
}

async function persistVerifiedToken(token: StoredToken): Promise<void> {
  const directory = dirname(tokenPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const existing = await stat(tokenPath).catch(() => null);
  if (existing) throw new SafeProofError("token_exists", "A token already exists; refusing to overwrite it automatically");
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  let createdTokenFile = false;
  try {
    handle = await open(tokenPath, "wx", 0o600);
    createdTokenFile = true;
    try {
      await handle.writeFile(`${JSON.stringify(token, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
      handle = null;
    }
    await chmod(tokenPath, 0o600);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    if (createdTokenFile) await unlink(tokenPath).catch(() => undefined);
    throw error;
  }
}

function parseStoredToken(value: unknown): StoredToken {
  if (!value || typeof value !== "object") throw new SafeProofError("token_invalid", "Stored token is invalid");
  const token = value as Partial<StoredToken>;
  if (
    token.schemaVersion !== 1 || token.scope !== youtubeForceSslScope ||
    token.channel?.title !== expectedYouTubeChannelTitle || typeof token.channel.id !== "string" ||
    !token.credentials || typeof token.credentials !== "object" || !token.credentials.refresh_token
  ) throw new SafeProofError("token_invalid", "Stored token did not satisfy the bounded proof contract");
  return token as StoredToken;
}

async function loadAuthenticatedClient(): Promise<{ client: OAuth2Client; token: StoredToken }> {
  const configuration = await loadOAuthClientConfiguration();
  const tokenFile = await lstat(tokenPath).catch(() => null);
  if (!tokenFile?.isFile() || tokenFile.isSymbolicLink()) {
    throw new SafeProofError("authentication_required", "Run the pilot authentication command first");
  }
  const token = parseStoredToken(JSON.parse(await readFile(tokenPath, "utf8")) as unknown);
  const client = createOAuthClient(configuration);
  client.setCredentials(token.credentials);
  return { client, token };
}

function trackMetadata(item: youtube_v3.Schema$Caption, expectedVideoId: string): CaptionTrackMetadata {
  const id = item.id;
  const snippet = item.snippet;
  if (!id || !snippet || !snippet.videoId || !snippet.language) {
    throw new SafeProofError("caption_metadata_invalid", "YouTube returned incomplete caption-track metadata");
  }
  if (snippet.videoId !== expectedVideoId) {
    throw new SafeProofError("caption_video_mismatch", "YouTube returned a caption track for an unexpected video");
  }
  return {
    id,
    videoId: snippet.videoId,
    language: snippet.language,
    trackKind: snippet.trackKind ?? "",
    audioTrackType: snippet.audioTrackType ?? "",
    status: snippet.status ?? "",
    isDraft: snippet.isDraft === true,
    lastUpdated: snippet.lastUpdated ?? null
  };
}

async function inspectTracks(
  youtube: YouTubeClient,
  videoId: string
): Promise<{ tracks: CaptionTrackMetadata[]; selection: CaptionTrackSelection }> {
  const response = await youtube.captions.list({ part: ["snippet"], videoId }, { retry: false }).catch(() => {
    throw new SafeProofError("caption_list_failed", "The official captions.list request failed safely");
  });
  const tracks = (response.data.items ?? []).map((item) => trackMetadata(item, videoId));
  return { tracks, selection: selectCaptionTrack(videoId, tracks) };
}

async function verifyStoredChannel(client: OAuth2Client, token: StoredToken): Promise<VerifiedAccount> {
  const verified = await verifyExpectedChannelAndVideos(client);
  if (verified.channel.id !== token.channel.id) {
    throw new SafeProofError("channel_changed", "The stored token no longer resolves to the verified church channel");
  }
  return verified;
}

function safeTrackView(track: CaptionTrackMetadata, selectedId: string | null) {
  return {
    captionId: track.id,
    language: track.language,
    trackKind: track.trackKind,
    audioTrackType: track.audioTrackType,
    status: track.status,
    isDraft: track.isDraft,
    selected: selectedId === track.id
  };
}

async function authenticateCommand(): Promise<void> {
  assertExactVideoScope(pilotYouTubeVideoIds, pilotYouTubeVideoIds);
  const existingToken = await lstat(tokenPath).catch(() => null);
  if (existingToken) {
    if (!existingToken.isFile() || existingToken.isSymbolicLink()) {
      throw new SafeProofError("token_invalid", "The existing token path is not a safe regular file");
    }
    const { client, token } = await loadAuthenticatedClient();
    await verifyStoredChannel(client, token);
    process.stdout.write(`${JSON.stringify({ outcome: "already_authenticated", expectedChannelVerified: true, pilotVideoOwnershipVerified: 3, tokenChanged: false })}\n`);
    return;
  }
  const configuration = await loadOAuthClientConfiguration();
  const authorization = await receiveOwnerAuthorization(configuration);
  const verified = await verifyExpectedChannelAndVideos(authorization.client);
  await persistVerifiedToken({
    schemaVersion: 1,
    scope: youtubeForceSslScope,
    verifiedAt: new Date().toISOString(),
    channel: verified.channel,
    credentials: authorization.credentials
  });
  process.stdout.write(`${JSON.stringify({ outcome: "authenticated", expectedChannelVerified: true, pilotVideoOwnershipVerified: 3, offlineAccessRetained: true })}\n`);
}

async function inspectCommand(): Promise<void> {
  assertExactVideoScope(pilotYouTubeVideoIds, pilotYouTubeVideoIds);
  const { client, token } = await loadAuthenticatedClient();
  await verifyStoredChannel(client, token);
  const youtube = google.youtube({ version: "v3", auth: client });
  const results = [];
  for (const videoId of pilotYouTubeVideoIds) {
    const inspection = await inspectTracks(youtube, videoId);
    const selectedId = inspection.selection.outcome === "selected" ? inspection.selection.track.id : null;
    results.push({
      videoId,
      outcome: inspection.selection.outcome,
      warnings: inspection.selection.outcome === "selected" ? inspection.selection.warnings : [],
      tracks: inspection.tracks.map((track) => safeTrackView(track, selectedId))
    });
  }
  process.stdout.write(`${JSON.stringify({ outcome: "pilot_tracks_inspected", downloaded: 0, results }, null, 2)}\n`);
}

function safeDirectPilotChild(filename: string): string {
  if (!filename || filename !== filename.trim() || /[\\/]/u.test(filename)) {
    throw new SafeProofError("studio_mapping_invalid", "Studio caption filename is unsafe");
  }
  const path = resolve(privatePilotRoot, filename);
  if (resolve(path, "..") !== resolve(privatePilotRoot)) {
    throw new SafeProofError("studio_mapping_invalid", "Studio caption path escaped the private pilot directory");
  }
  return path;
}

async function loadStudioSources(): Promise<Map<string, StudioSource>> {
  const parsed = JSON.parse(await readFile(studioManifestPath, "utf8")) as {
    allowlistedVideoIds?: unknown;
    records?: unknown;
  };
  if (!Array.isArray(parsed.allowlistedVideoIds) || !parsed.allowlistedVideoIds.every((id) => typeof id === "string")) {
    throw new SafeProofError("studio_mapping_invalid", "Private pilot allowlist is invalid");
  }
  assertExactVideoScope(parsed.allowlistedVideoIds, pilotYouTubeVideoIds);
  if (!Array.isArray(parsed.records)) throw new SafeProofError("studio_mapping_invalid", "Private pilot records are invalid");
  const sources = new Map<string, StudioSource>();
  for (const rawRecord of parsed.records) {
    if (!rawRecord || typeof rawRecord !== "object") throw new SafeProofError("studio_mapping_invalid", "Private pilot record is invalid");
    const record = rawRecord as Record<string, unknown>;
    const videoId = requireString(record.videoId, "videoId");
    const captionFilename = requireString(record.captionFilename, "captionFilename");
    const language = requireString(record.captionLanguage, "captionLanguage");
    const trackType = requireString(record.captionTrackType, "captionTrackType");
    if (!pilotYouTubeVideoIds.includes(videoId as typeof pilotYouTubeVideoIds[number]) ||
      !new Set(["manual", "automatic", "unknown"]).has(trackType)) {
      throw new SafeProofError("studio_mapping_invalid", "Private pilot record is outside the exact proof scope");
    }
    const captionPath = safeDirectPilotChild(captionFilename);
    const captionFile = await lstat(captionPath).catch(() => null);
    if (!captionFile?.isFile() || captionFile.isSymbolicLink()) {
      throw new SafeProofError("studio_source_missing", "A mapped private Studio export is unavailable");
    }
    sources.set(videoId, { videoId, captionPath, language, trackType: trackType as StudioSource["trackType"] });
  }
  if (sources.size !== pilotYouTubeVideoIds.length) {
    throw new SafeProofError("studio_mapping_invalid", "Private Studio mappings did not cover exactly three pilots");
  }
  return sources;
}

function coverageMetrics(analysis: CaptionAnalysis, videoDurationMs: number | null) {
  const coveredSpanMs = analysis.firstCueTimeMs === null || analysis.finalCueTimeMs === null
    ? null
    : Math.max(0, analysis.finalCueTimeMs - analysis.firstCueTimeMs);
  return {
    videoDurationMs,
    firstCueTimeMs: analysis.firstCueTimeMs,
    finalCueTimeMs: analysis.finalCueTimeMs,
    coveredSpanMs,
    finalCuePercentOfVideo: videoDurationMs && analysis.finalCueTimeMs !== null
      ? Number(((analysis.finalCueTimeMs / videoDurationMs) * 100).toFixed(2))
      : null,
    spanPercentOfVideo: videoDurationMs && coveredSpanMs !== null
      ? Number(((coveredSpanMs / videoDurationMs) * 100).toFixed(2))
      : null
  };
}

async function downloadCaptionBytes(youtube: YouTubeClient, captionId: string): Promise<Buffer> {
  const response = await youtube.captions.download({ id: captionId, tfmt: "vtt" }, {
    responseType: "arraybuffer",
    retry: false
  }).catch(() => {
    throw new SafeProofError("caption_download_failed", "The official captions.download request failed safely");
  });
  const data = response.data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (Buffer.isBuffer(data)) return data;
  throw new SafeProofError("caption_download_invalid", "The official caption response was not binary VTT data");
}

async function writeProvenanceNoClobber(path: string, value: unknown): Promise<"created" | "unchanged"> {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  try {
    const handle = await open(path, "wx", 0o600);
    try {
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return "created";
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    const existing = await readFile(path, "utf8");
    if (existing !== serialized) {
      const parsed = JSON.parse(existing) as { videoId?: unknown; captionId?: unknown; sha256?: unknown };
      const requested = value as { videoId?: unknown; captionId?: unknown; sha256?: unknown };
      if (parsed.videoId !== requested.videoId || parsed.captionId !== requested.captionId || parsed.sha256 !== requested.sha256) {
        throw new SafeProofError("provenance_conflict", "Existing private provenance conflicts with the official caption bytes");
      }
    }
    return "unchanged";
  }
}

async function retrieveCommand(): Promise<void> {
  assertExactVideoScope(pilotYouTubeVideoIds, pilotYouTubeVideoIds);
  const { client, token } = await loadAuthenticatedClient();
  const verified = await verifyStoredChannel(client, token);
  const studioSources = await loadStudioSources();
  const youtube = google.youtube({ version: "v3", auth: client });
  const results = [];
  for (const videoId of pilotYouTubeVideoIds) {
    const inspection = await inspectTracks(youtube, videoId);
    if (inspection.selection.outcome !== "selected") {
      results.push({ videoId, outcome: inspection.selection.outcome, downloaded: false });
      process.stdout.write(`${JSON.stringify({ outcome: "pilot_caption_retrieval_stopped", results }, null, 2)}\n`);
      return;
    }
    const track = inspection.selection.track;
    const bytes = await downloadCaptionBytes(youtube, track.id);
    const persisted = await persistExactCaptionBytes(privateProofRoot, videoId, track.id, bytes);
    let officialAnalysis: CaptionAnalysis;
    try {
      officialAnalysis = parseVttBytes(bytes);
    } catch (error) {
      results.push({
        videoId,
        outcome: "malformed_vtt",
        downloaded: true,
        persistence: persisted.persistence,
        byteCount: persisted.byteCount,
        sha256: persisted.sha256,
        parseFailure: captionParseFailureCode(error),
        requiresManualReview: true
      });
      process.stdout.write(`${JSON.stringify({ outcome: "pilot_caption_retrieval_stopped", results }, null, 2)}\n`);
      return;
    }
    const studio = studioSources.get(videoId)!;
    const studioSource = await readFile(studio.captionPath, "utf8");
    const studioAnalysis = analyzeStudioExport(studioSource);
    const comparison = compareCaptionAnalyses(officialAnalysis, studioAnalysis);
    const video = verified.videos.get(videoId)!;
    const provenanceKey = sha256(`${track.lastUpdated ?? "unknown"}\n${youtubeCaptionProofVersion}`).slice(0, 16);
    const provenancePath = persisted.path.replace(/\.vtt$/u, `.${provenanceKey}.provenance.private.json`);
    const retrievedAt = new Date().toISOString();
    const provenance = {
      schemaVersion: 1,
      processingVersion: youtubeCaptionProofVersion,
      provider: "official_youtube_data_api_v3",
      videoId,
      channelId: video.channelId,
      captionId: track.id,
      language: track.language,
      trackKind: track.trackKind,
      ...captionAudioAssociationProvenance(inspection.selection),
      captionLastUpdatedAt: track.lastUpdated,
      retrievedAt,
      byteCount: persisted.byteCount,
      cueCount: officialAnalysis.cueCount,
      sha256: persisted.sha256,
      sourceRelativePath: relative(privatePilotRoot, persisted.path).replaceAll("\\", "/"),
      vtt: {
        parsed: true,
        characterCount: officialAnalysis.characterCount,
        visibleCharacterCount: officialAnalysis.visibleCharacterCount,
        wordCount: officialAnalysis.wordCount,
        normalizedWordSequenceSha256: officialAnalysis.normalizedWordSequenceSha256,
        firstCueTimeMs: officialAnalysis.firstCueTimeMs,
        finalCueTimeMs: officialAnalysis.finalCueTimeMs,
        apparentDurationCoverage: coverageMetrics(officialAnalysis, video.durationMs)
      },
      studioComparison: {
        videoIdentityMatches: studio.videoId === videoId,
        officialLanguage: track.language,
        studioLanguage: studio.language,
        bothEnglish: /^en(?:-|$)/iu.test(track.language) && /^en(?:-|$)/iu.test(studio.language),
        exactLanguageTagMatches: track.language.toLocaleLowerCase("en-AU") === studio.language.toLocaleLowerCase("en-AU"),
        officialTrackKind: track.trackKind,
        studioTrackType: studio.trackType,
        trackTypeMatches: studio.trackType === "unknown" ? null :
          (studio.trackType === "automatic" ? track.trackKind.toLocaleLowerCase("en-AU") === "asr" : track.trackKind.toLocaleLowerCase("en-AU") === "standard"),
        studioNormalizedWordSequenceSha256: studioAnalysis.normalizedWordSequenceSha256,
        studioApparentDurationCoverage: coverageMetrics(studioAnalysis, video.durationMs),
        ...comparison
      }
    };
    const provenancePersistence = await writeProvenanceNoClobber(provenancePath, provenance);
    results.push({
      videoId,
      outcome: comparison.requiresManualReview ? "retrieved_manual_review_required" : "retrieved_agrees_with_studio",
      downloaded: true,
      persistence: persisted.persistence,
      provenancePersistence,
      language: track.language,
      trackKind: track.trackKind,
      warnings: inspection.selection.warnings,
      byteCount: persisted.byteCount,
      cueCount: officialAnalysis.cueCount,
      sha256: persisted.sha256,
      normalizedWordSequenceMatches: comparison.normalizedWordSequenceMatches,
      meaningfulWordingDifference: comparison.meaningfulWordingDifference,
      requiresManualReview: comparison.requiresManualReview
    });
    if (comparison.requiresManualReview) {
      process.stdout.write(`${JSON.stringify({ outcome: "pilot_caption_retrieval_stopped_manual_review", results }, null, 2)}\n`);
      return;
    }
  }
  process.stdout.write(`${JSON.stringify({ outcome: "pilot_caption_retrieval_complete", results }, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [command, ...unexpected] = process.argv.slice(2);
  if (unexpected.length > 0 || !new Set(["auth", "inspect", "retrieve"]).has(command ?? "")) {
    throw new SafeProofError("command_invalid", "Use exactly one command: auth, inspect, or retrieve");
  }
  if (command === "auth") await authenticateCommand();
  if (command === "inspect") await inspectCommand();
  if (command === "retrieve") await retrieveCommand();
}

main().catch((error: unknown) => {
  const safe = error instanceof SafeProofError
    ? { code: error.code, message: error.message }
    : { code: "unexpected_failure", message: "The pilot caption command failed safely without exposing provider details" };
  process.stderr.write(`${JSON.stringify({ outcome: "failed", error: safe })}\n`);
  process.exitCode = 1;
});

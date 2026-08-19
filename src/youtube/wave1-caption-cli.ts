import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { lstat, mkdir, open, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { google, type youtube_v3 } from "googleapis";
import type { Credentials, OAuth2Client } from "google-auth-library";
import {
  captionAudioAssociationProvenance,
  captionParseFailureCode,
  expectedYouTubeChannelTitle,
  parseVttBytes,
  persistExactCaptionBytes,
  selectCaptionTrack,
  youtubeForceSslScope,
  type CaptionTrackMetadata
} from "./pilot-caption-proof";
import {
  buildPrivateMappings,
  expectedAlternateCount,
  expectedPrimaryCount,
  expectedSelectionContentSha256,
  expectedInventoryContentSha256,
  productionMappingQueryVersion,
  resolveInitialWaveOne,
  safeAggregateMappingCounts,
  sha256,
  structuralCaptionMetrics,
  verifyPrivateSelection,
  wave1CaptionProcessingVersion,
  youtubeMetadataKey,
  type CaptionInspectionRecord,
  type PrivateVideoMappingRecord,
  type RawMappingRow,
  type ResolvedWavePosition,
  type VerifiedSelection
} from "./wave1-caption-proof";

type YouTubeClient = youtube_v3.Youtube;

interface StoredToken {
  schemaVersion: 1;
  scope: typeof youtubeForceSslScope;
  verifiedAt: string;
  channel: { id: string; title: typeof expectedYouTubeChannelTitle };
  credentials: Credentials;
}

interface PrivateMappingArtifact {
  schemaVersion: 1;
  privateContent: true;
  queryVersion: typeof productionMappingQueryVersion;
  extractedAt: string;
  source: {
    expectedDatabaseNameSha256: string;
    expectedTablePrefix: "wp_";
    metadataKey: typeof youtubeMetadataKey;
    transactionIsolation: "REPEATABLE READ";
    transactionAccess: "READ ONLY";
  };
  selection: {
    inventoryContentSha256: typeof expectedInventoryContentSha256;
    selectionContentSha256: typeof expectedSelectionContentSha256;
    primaryCount: typeof expectedPrimaryCount;
    alternateCount: typeof expectedAlternateCount;
  };
  querySha256: string;
  returnedRowCount: number;
  records: PrivateVideoMappingRecord[];
  integrity: { recordSetSha256: string };
}

interface PrivateInspectionArtifact {
  schemaVersion: 1;
  privateContent: true;
  processingVersion: typeof wave1CaptionProcessingVersion;
  inspectedAt: string;
  expectedChannelId: string;
  mappingRecordSetSha256: string;
  records: Array<CaptionInspectionRecord & { tracks: CaptionTrackMetadata[] }>;
  integrity: { recordSetSha256: string };
}

interface PrivateRetrievalRecord {
  waveOrder: number;
  primarySourceId: number;
  resolvedSourceId: number | null;
  resolution: "primary" | "alternate" | "unavailable";
  replacementReason: string | null;
  outcome: "retrieved" | "unavailable";
  failureCode: string | null;
  videoId: string | null;
  channelId: string | null;
  captionId: string | null;
  language: string | null;
  trackKind: string | null;
  audioTrackType: string | null;
  primaryAudioAssociationConfirmed: boolean | null;
  provenanceWarnings: string[];
  captionLastUpdatedAt: string | null;
  retrievedAt: string | null;
  sourceRelativePath: string | null;
  byteCount: number | null;
  cueCount: number | null;
  sourceContentSha256: string | null;
  structuralMetrics: ReturnType<typeof structuralCaptionMetrics> | null;
}

interface PrivateRetrievalArtifact {
  schemaVersion: 1;
  privateContent: true;
  processingVersion: typeof wave1CaptionProcessingVersion;
  completedAt: string;
  records: PrivateRetrievalRecord[];
  integrity: { recordSetSha256: string };
}

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(sourceDirectory, "..", "..");
const metadataRoot = join(repositoryRoot, "private", "phase-3b2c-metadata");
const inventoryPath = join(metadataRoot, "phase3b2c-production-metadata.private.json");
const selectionPath = join(metadataRoot, "phase3b2c-representative-selection.private.json");
const mappingPath = join(metadataRoot, "phase3b2c-selected-youtube-mapping.private.json");
const waveOneRoot = join(repositoryRoot, "private", "phase-3b2c-wave1");
const inspectionPath = join(waveOneRoot, "caption-inspection.private.json");
const retrievalPath = join(waveOneRoot, "caption-retrieval.private.json");
const captionRoot = join(waveOneRoot, "source-captions");
const oauthConfigurationDirectory = join(repositoryRoot, "youtube-oath");
const tokenPath = join(homedir(), "AppData", "Local", "SavingGraceBibleChurch", "youtube-oauth", "token.json");
const mysqlShellExecutable = "C:\\Program Files\\MySQL\\MySQL Shell 26.7\\bin\\mysqlsh.exe";

class SafeWaveError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function safeJson(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new SafeWaveError("configuration_invalid", `${label} is unavailable`);
  return value;
}

async function loadJson(path: string): Promise<unknown> {
  const file = await lstat(path).catch(() => null);
  if (!file?.isFile() || file.isSymbolicLink()) throw new SafeWaveError("private_input_invalid", "A required private input is unavailable");
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function loadSelection(): Promise<VerifiedSelection> {
  return verifyPrivateSelection(await loadJson(inventoryPath), await loadJson(selectionPath));
}

async function ensurePrivateRoot(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const state = await lstat(path);
  if (!state.isDirectory() || state.isSymbolicLink()) throw new SafeWaveError("private_storage_failed", "Private storage is unsafe");
}

async function persistJsonNoClobber(path: string, value: unknown, stableValue: unknown): Promise<"created" | "unchanged"> {
  await ensurePrivateRoot(dirname(path));
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
    const existing = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    const requestedStableHash = sha256(JSON.stringify(stableValue));
    const existingStable = { ...existing };
    delete existingStable.extractedAt;
    delete existingStable.inspectedAt;
    delete existingStable.completedAt;
    if (sha256(JSON.stringify(existingStable)) !== requestedStableHash) {
      throw new SafeWaveError("private_artifact_conflict", "Existing private evidence differs from the repeatable operation");
    }
    return "unchanged";
  }
}

function sqlString(value: string): string {
  if (!/^[A-Za-z0-9_]+$/u.test(value)) throw new SafeWaveError("configuration_invalid", "Production database identity is unsafe");
  return `'${value}'`;
}

function mappingQuery(sourceIds: readonly number[], databaseName: string): string {
  const scopedRows = sourceIds.map((sourceId, index) =>
    `${index === 0 ? "SELECT" : "UNION ALL SELECT"} ${sourceId} AS source_id`
  ).join("\n");
  return [
    "SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;",
    "START TRANSACTION READ ONLY;",
    "SELECT scoped.source_id, metadata.meta_value AS youtube_metadata_value",
    `FROM (${scopedRows}) AS scoped`,
    "JOIN (",
    "  SELECT CASE WHEN",
    `    DATABASE() = ${sqlString(databaseName)}`,
    "    AND @@version LIKE '%MariaDB%'",
    "    AND (SELECT COUNT(*) FROM information_schema.tables",
    "         WHERE table_schema = DATABASE() AND table_name IN ('wp_posts', 'wp_postmeta')) = 2",
    "  THEN 1 ELSE 0 END AS identity_ok",
    ") AS verified ON verified.identity_ok = 1",
    "LEFT JOIN wp_postmeta AS metadata",
    `  ON metadata.post_id = scoped.source_id AND metadata.meta_key = '${youtubeMetadataKey}'`,
    "ORDER BY scoped.source_id, metadata.meta_id;",
    "COMMIT;"
  ].join("\n");
}

async function runMysqlShell(query: string): Promise<RawMappingRow[]> {
  const host = requireString(process.env.SG_LEGACY_DB_HOST, "Protected production host");
  const database = requireString(process.env.SG_LEGACY_DB_NAME, "Protected production database");
  const user = requireString(process.env.SG_LEGACY_DB_USER, "Protected production user");
  const port = requireString(process.env.SG_LEGACY_DB_PORT, "Protected production port");
  if (!/^\d{1,5}$/u.test(port)) throw new SafeWaveError("configuration_invalid", "Protected production port is invalid");
  return await new Promise<RawMappingRow[]>((resolvePromise, rejectPromise) => {
    const child = spawn(mysqlShellExecutable, [
      "--sql",
      `--host=${host}`,
      `--port=${port}`,
      `--user=${user}`,
      `--schema=${database}`,
      "--result-format=json/raw",
      "--execute",
      query
    ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderrSeen = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", () => { stderrSeen = true; });
    child.once("error", () => rejectPromise(new SafeWaveError("production_connection_failed", "The protected read-only production connection could not start")));
    child.once("close", (code) => {
      if (code !== 0 || stderrSeen) {
        rejectPromise(new SafeWaveError("production_query_failed", "The production read-only mapping query failed safely"));
        return;
      }
      try {
        const rows: RawMappingRow[] = [];
        const append = (value: unknown): void => {
          if (Array.isArray(value)) {
            for (const item of value) append(item);
            return;
          }
          if (!value || typeof value !== "object") return;
          const object = value as Record<string, unknown>;
          if (Object.hasOwn(object, "source_id")) {
            rows.push(object as unknown as RawMappingRow);
            return;
          }
          if (Array.isArray(object.rows)) append(object.rows);
        };
        try {
          append(JSON.parse(stdout));
        } catch {
          for (const line of stdout.split(/\r?\n/u)) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) continue;
            try { append(JSON.parse(trimmed)); } catch { /* Ignore non-result shell text. */ }
          }
        }
        resolvePromise(rows);
      } catch {
        rejectPromise(new SafeWaveError("production_result_invalid", "The protected mapping result could not be parsed safely"));
      }
    });
  });
}

async function mappingCommand(): Promise<void> {
  const selection = await loadSelection();
  const databaseName = requireString(process.env.SG_LEGACY_DB_NAME, "Protected production database");
  const query = mappingQuery(selection.selectedSourceIds, databaseName);
  const rows = await runMysqlShell(query);
  const returnedIds = new Set(rows.map((row) => Number(row.source_id)));
  if (returnedIds.size !== selection.selectedSourceIds.length ||
    selection.selectedSourceIds.some((sourceId) => !returnedIds.has(sourceId))) {
    throw new SafeWaveError(
      "production_identity_or_scope_mismatch",
      `The production mapping result did not cover exactly the approved 48-record scope (parsed rows: ${rows.length}; distinct selected identities: ${returnedIds.size})`
    );
  }
  const records = buildPrivateMappings(selection.selectedSourceIds, rows);
  const stable = {
    schemaVersion: 1 as const,
    privateContent: true as const,
    queryVersion: productionMappingQueryVersion,
    source: {
      expectedDatabaseNameSha256: sha256(databaseName),
      expectedTablePrefix: "wp_" as const,
      metadataKey: youtubeMetadataKey as typeof youtubeMetadataKey,
      transactionIsolation: "REPEATABLE READ" as const,
      transactionAccess: "READ ONLY" as const
    },
    selection: {
      inventoryContentSha256: expectedInventoryContentSha256 as typeof expectedInventoryContentSha256,
      selectionContentSha256: expectedSelectionContentSha256 as typeof expectedSelectionContentSha256,
      primaryCount: expectedPrimaryCount as typeof expectedPrimaryCount,
      alternateCount: expectedAlternateCount as typeof expectedAlternateCount
    },
    querySha256: sha256(query),
    returnedRowCount: rows.length,
    records,
    integrity: { recordSetSha256: sha256(JSON.stringify(records)) }
  };
  const artifact: PrivateMappingArtifact = { ...stable, extractedAt: new Date().toISOString() };
  const persistence = await persistJsonNoClobber(mappingPath, artifact, stable);
  process.stdout.write(safeJson({
    outcome: "mapping_complete",
    inspectedSelectionRecords: records.length,
    returnedMetadataRows: rows.length,
    statusCounts: safeAggregateMappingCounts(records),
    privatePersistence: persistence,
    credentialsDisplayed: false,
    identifiersDisplayed: false
  }));
}

async function loadOAuthClientConfiguration(): Promise<{ clientId: string; clientSecret: string }> {
  const directory = await lstat(oauthConfigurationDirectory).catch(() => null);
  if (!directory?.isDirectory() || directory.isSymbolicLink()) throw new SafeWaveError("oauth_configuration_missing", "Protected OAuth configuration is unavailable");
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(oauthConfigurationDirectory, { withFileTypes: true });
  const json = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"));
  if (entries.some((entry) => entry.isSymbolicLink()) || json.length !== 1 || entries.length !== 1) {
    throw new SafeWaveError("oauth_configuration_invalid", "Protected OAuth configuration is invalid");
  }
  const value = JSON.parse(await readFile(join(oauthConfigurationDirectory, json[0]!.name), "utf8")) as {
    installed?: { client_id?: unknown; client_secret?: unknown };
  };
  return {
    clientId: requireString(value.installed?.client_id, "OAuth client ID"),
    clientSecret: requireString(value.installed?.client_secret, "OAuth client secret")
  };
}

function parseStoredToken(input: unknown): StoredToken {
  if (!input || typeof input !== "object") throw new SafeWaveError("token_invalid", "Stored owner token is invalid");
  const token = input as Partial<StoredToken>;
  if (token.schemaVersion !== 1 || token.scope !== youtubeForceSslScope ||
    token.channel?.title !== expectedYouTubeChannelTitle || !token.channel.id ||
    !token.credentials?.refresh_token) {
    throw new SafeWaveError("token_invalid", "Stored owner token does not satisfy the approved contract");
  }
  return token as StoredToken;
}

async function loadAuthenticatedClient(): Promise<{ client: OAuth2Client; token: StoredToken }> {
  const tokenFile = await lstat(tokenPath).catch(() => null);
  if (!tokenFile?.isFile() || tokenFile.isSymbolicLink()) throw new SafeWaveError("reauthentication_required", "The verified owner token is unavailable");
  const token = parseStoredToken(JSON.parse(await readFile(tokenPath, "utf8")) as unknown);
  const configuration = await loadOAuthClientConfiguration();
  const client = new google.auth.OAuth2(configuration.clientId, configuration.clientSecret);
  client.setCredentials(token.credentials);
  const youtube = google.youtube({ version: "v3", auth: client });
  const response = await youtube.channels.list({ part: ["id", "snippet"], mine: true, maxResults: 50 }, { retry: false })
    .catch(() => { throw new SafeWaveError("reauthentication_required", "The official API could not verify the owner token"); });
  const channels = (response.data.items ?? []).filter((item) => item.id);
  if (channels.length !== 1 || channels[0]!.id !== token.channel.id ||
    channels[0]!.snippet?.title?.trim() !== expectedYouTubeChannelTitle) {
    throw new SafeWaveError("wrong_channel", "The authenticated channel no longer matches the verified church channel");
  }
  return { client, token };
}

function parseIsoDuration(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/u);
  if (!match) return null;
  return Math.round(((Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) * 60 + Number(match[3] ?? 0)) * 1_000);
}

function trackMetadata(item: youtube_v3.Schema$Caption, expectedVideoId: string): CaptionTrackMetadata {
  const snippet = item.snippet;
  if (!item.id || !snippet?.videoId || !snippet.language || snippet.videoId !== expectedVideoId) {
    throw new SafeWaveError("caption_metadata_invalid", "The official API returned invalid caption metadata");
  }
  return {
    id: item.id,
    videoId: snippet.videoId,
    language: snippet.language,
    trackKind: snippet.trackKind ?? "",
    audioTrackType: snippet.audioTrackType ?? "",
    status: snippet.status ?? "",
    isDraft: snippet.isDraft === true,
    lastUpdated: snippet.lastUpdated ?? null
  };
}

async function inspectOne(youtube: YouTubeClient, sourceId: number, videoId: string, durationMs: number | null): Promise<PrivateInspectionArtifact["records"][number]> {
  try {
    const response = await youtube.captions.list({ part: ["snippet"], videoId }, { retry: false });
    const tracks = (response.data.items ?? []).map((item) => trackMetadata(item, videoId));
    const selection = selectCaptionTrack(videoId, tracks);
    return {
      sourceId,
      videoId,
      outcome: selection.outcome,
      selection,
      tracks,
      durationMs
    };
  } catch (error) {
    if (error instanceof SafeWaveError && error.code === "caption_metadata_invalid") throw error;
    return { sourceId, videoId, outcome: "caption_list_failed", selection: null, tracks: [], durationMs };
  }
}

async function loadMapping(): Promise<PrivateMappingArtifact> {
  const value = await loadJson(mappingPath) as PrivateMappingArtifact;
  if (value.schemaVersion !== 1 || value.privateContent !== true || value.queryVersion !== productionMappingQueryVersion ||
    value.integrity?.recordSetSha256 !== sha256(JSON.stringify(value.records))) {
    throw new SafeWaveError("private_mapping_invalid", "Private mapping evidence failed integrity verification");
  }
  return value;
}

async function inspectionCommand(): Promise<void> {
  const selection = await loadSelection();
  const mapping = await loadMapping();
  if (mapping.records.length !== selection.selectedSourceIds.length ||
    mapping.records.some((record, index) => record.sourceId !== selection.selectedSourceIds[index])) {
    throw new SafeWaveError("private_mapping_scope_mismatch", "Private mapping evidence does not match the approved selection");
  }
  const { client, token } = await loadAuthenticatedClient();
  const youtube = google.youtube({ version: "v3", auth: client });
  const usableMappings = mapping.records.filter((record) => record.status === "mapped" && record.videoId);
  const response = usableMappings.length === 0 ? { data: { items: [] } } : await youtube.videos.list({
    part: ["snippet", "contentDetails"],
    id: usableMappings.map((record) => record.videoId!),
    maxResults: 50
  }, { retry: false }).catch(() => { throw new SafeWaveError("youtube_video_inspection_failed", "The official API video inspection failed safely"); });
  const videos = new Map((response.data.items ?? []).filter((item) => item.id).map((item) => [item.id!, item]));
  const records: PrivateInspectionArtifact["records"] = [];
  for (const mappingRecord of mapping.records) {
    if (mappingRecord.status !== "mapped" || !mappingRecord.videoId) {
      records.push({
        sourceId: mappingRecord.sourceId,
        videoId: null,
        outcome: "mapping_unavailable",
        selection: null,
        tracks: [],
        durationMs: null
      });
      continue;
    }
    const video = videos.get(mappingRecord.videoId);
    if (!video) {
      records.push({ sourceId: mappingRecord.sourceId, videoId: mappingRecord.videoId, outcome: "video_missing", selection: null, tracks: [], durationMs: null });
      continue;
    }
    if (video.snippet?.channelId !== token.channel.id) {
      records.push({ sourceId: mappingRecord.sourceId, videoId: mappingRecord.videoId, outcome: "wrong_channel", selection: null, tracks: [], durationMs: parseIsoDuration(video.contentDetails?.duration) });
      continue;
    }
    records.push(await inspectOne(youtube, mappingRecord.sourceId, mappingRecord.videoId, parseIsoDuration(video.contentDetails?.duration)));
  }
  const stable = {
    schemaVersion: 1 as const,
    privateContent: true as const,
    processingVersion: wave1CaptionProcessingVersion,
    expectedChannelId: token.channel.id,
    mappingRecordSetSha256: mapping.integrity.recordSetSha256,
    records,
    integrity: { recordSetSha256: sha256(JSON.stringify(records)) }
  };
  const artifact: PrivateInspectionArtifact = { ...stable, inspectedAt: new Date().toISOString() };
  const persistence = await persistJsonNoClobber(inspectionPath, artifact, stable);
  const outcomeCounts = records.reduce<Record<string, number>>((counts, record) => {
    counts[record.outcome] = (counts[record.outcome] ?? 0) + 1;
    return counts;
  }, {});
  process.stdout.write(safeJson({
    outcome: "caption_metadata_inspection_complete",
    inspectedRecords: records.length,
    downloadedRecords: 0,
    outcomeCounts,
    privatePersistence: persistence,
    identifiersDisplayed: false
  }));
}

async function loadInspection(): Promise<PrivateInspectionArtifact> {
  const value = await loadJson(inspectionPath) as PrivateInspectionArtifact;
  if (value.schemaVersion !== 1 || value.privateContent !== true || value.processingVersion !== wave1CaptionProcessingVersion ||
    value.integrity?.recordSetSha256 !== sha256(JSON.stringify(value.records))) {
    throw new SafeWaveError("private_inspection_invalid", "Private inspection evidence failed integrity verification");
  }
  return value;
}

async function downloadCaption(youtube: YouTubeClient, captionId: string): Promise<Buffer> {
  try {
    const response = await youtube.captions.download({ id: captionId, tfmt: "vtt" }, {
      responseType: "arraybuffer",
      retry: false
    });
    const data = response.data;
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    if (Buffer.isBuffer(data)) return data;
  } catch {
    throw new SafeWaveError("caption_download_failed", "Official caption retrieval failed for one Wave 1 record");
  }
  throw new SafeWaveError("caption_download_invalid", "Official caption retrieval returned an invalid binary response");
}

function parseTimestamp(value: string): number {
  const match = value.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})/u);
  if (!match) throw new SafeWaveError("caption_parse_failed", "A VTT timestamp was invalid");
  return (((Number(match[1] ?? 0) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1_000) + Number(match[4]);
}

function cueRecords(bytes: Buffer): Array<{ startMs: number; endMs: number; visibleText: string }> {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  const records: Array<{ startMs: number; endMs: number; visibleText: string }> = [];
  for (const block of source.split(/\n{2,}/u).slice(1)) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [start, endWithSettings] = lines[timingIndex]!.split(/\s*-->\s*/u);
    const end = endWithSettings?.split(/\s+/u)[0];
    if (!start || !end) continue;
    const visibleText = lines.slice(timingIndex + 1).join(" ")
      .replace(/<[^>]*>/gu, " ")
      .replace(/&nbsp;/giu, " ")
      .replace(/[\t ]+/gu, " ")
      .trim();
    records.push({ startMs: parseTimestamp(start), endMs: parseTimestamp(end), visibleText });
  }
  return records;
}

function unavailableRecord(position: ResolvedWavePosition, failureCode: string): PrivateRetrievalRecord {
  return {
    waveOrder: position.waveOrder,
    primarySourceId: position.primarySourceId,
    resolvedSourceId: null,
    resolution: "unavailable",
    replacementReason: position.reason,
    outcome: "unavailable",
    failureCode,
    videoId: null,
    channelId: null,
    captionId: null,
    language: null,
    trackKind: null,
    audioTrackType: null,
    primaryAudioAssociationConfirmed: null,
    provenanceWarnings: [],
    captionLastUpdatedAt: null,
    retrievedAt: null,
    sourceRelativePath: null,
    byteCount: null,
    cueCount: null,
    sourceContentSha256: null,
    structuralMetrics: null
  };
}

async function retrieveOne(input: {
  youtube: YouTubeClient;
  expectedChannelId: string;
  position: ResolvedWavePosition;
  inspection: PrivateInspectionArtifact["records"][number];
}): Promise<PrivateRetrievalRecord> {
  const { position, inspection, youtube } = input;
  if (!position.resolvedSourceId || inspection.outcome !== "selected" ||
    inspection.selection?.outcome !== "selected" || !inspection.videoId) {
    return unavailableRecord(position, "resolved_source_unavailable");
  }
  const videoResponse = await youtube.videos.list({ part: ["snippet", "contentDetails"], id: [inspection.videoId], maxResults: 1 }, { retry: false });
  const video = videoResponse.data.items?.[0];
  if (!video?.id) throw new SafeWaveError("video_missing", "A resolved Wave 1 video is no longer available");
  if (video.snippet?.channelId !== input.expectedChannelId) throw new SafeWaveError("wrong_channel", "A resolved Wave 1 video no longer belongs to the verified church channel");
  const reconfirmed = await inspectOne(youtube, inspection.sourceId, inspection.videoId, parseIsoDuration(video.contentDetails?.duration));
  if (reconfirmed.outcome !== "selected" || reconfirmed.selection?.outcome !== "selected" ||
    reconfirmed.selection.track.id !== inspection.selection.track.id) {
    throw new SafeWaveError("caption_selection_changed", "Caption-track selection changed after the approved inspection");
  }
  const track = reconfirmed.selection.track;
  const bytes = await downloadCaption(youtube, track.id);
  let analysis: ReturnType<typeof parseVttBytes>;
  try {
    analysis = parseVttBytes(bytes);
  } catch (error) {
    throw new SafeWaveError(captionParseFailureCode(error), "Downloaded VTT parsing failed for one Wave 1 record");
  }
  const cues = cueRecords(bytes);
  if (cues.length !== analysis.cueCount || analysis.wordCount < 500 || analysis.finalCueTimeMs === null) {
    throw new SafeWaveError("caption_structurally_unusable", "A downloaded caption was structurally incomplete or too short");
  }
  const persisted = await persistExactCaptionBytes(captionRoot, inspection.videoId, track.id, bytes);
  const audio = captionAudioAssociationProvenance(reconfirmed.selection);
  const retrievedAt = new Date().toISOString();
  return {
    waveOrder: position.waveOrder,
    primarySourceId: position.primarySourceId,
    resolvedSourceId: position.resolvedSourceId,
    resolution: position.resolution,
    replacementReason: position.reason,
    outcome: "retrieved",
    failureCode: null,
    videoId: inspection.videoId,
    channelId: input.expectedChannelId,
    captionId: track.id,
    language: track.language,
    trackKind: track.trackKind,
    audioTrackType: audio.audioTrackType,
    primaryAudioAssociationConfirmed: audio.primaryAudioAssociationConfirmed,
    provenanceWarnings: audio.warnings,
    captionLastUpdatedAt: track.lastUpdated,
    retrievedAt,
    sourceRelativePath: relative(repositoryRoot, persisted.path).replaceAll("\\", "/"),
    byteCount: persisted.byteCount,
    cueCount: analysis.cueCount,
    sourceContentSha256: persisted.sha256,
    structuralMetrics: structuralCaptionMetrics({ analysis, cueTimes: cues, durationMs: reconfirmed.durationMs })
  };
}

async function retrievalCommand(): Promise<void> {
  const selection = await loadSelection();
  const inspection = await loadInspection();
  const { client, token } = await loadAuthenticatedClient();
  if (inspection.expectedChannelId !== token.channel.id) throw new SafeWaveError("wrong_channel", "Private inspection evidence belongs to a different channel");
  const youtube = google.youtube({ version: "v3", auth: client });
  const inspectionBySource = new Map(inspection.records.map((record) => [record.sourceId, record]));
  const initial = resolveInitialWaveOne(selection, inspection.records);
  const records: PrivateRetrievalRecord[] = [];
  for (const position of initial) {
    if (!position.resolvedSourceId) {
      records.push(unavailableRecord(position, "no_eligible_primary_or_mapped_alternate"));
      continue;
    }
    const selectedInspection = inspectionBySource.get(position.resolvedSourceId)!;
    try {
      records.push(await retrieveOne({ youtube, expectedChannelId: token.channel.id, position, inspection: selectedInspection }));
      continue;
    } catch (error) {
      if (position.resolution !== "primary") {
        records.push(unavailableRecord(position, error instanceof SafeWaveError ? error.code : "retrieval_failed"));
        continue;
      }
      const replacementReason = "unavailable_source_file";
      const alternate = selection.alternates
        .filter((item) => item.replacementForPrimarySourceId === position.primarySourceId && item.replacementPrimaryWave === 1)
        .sort((a, b) => a.alternateOrder - b.alternateOrder)
        .find((item) => item.allowedReplacementReasons.includes(replacementReason) && inspectionBySource.get(item.sourceId)?.outcome === "selected");
      if (!alternate) {
        records.push(unavailableRecord({ ...position, reason: replacementReason }, error instanceof SafeWaveError ? error.code : "retrieval_failed"));
        continue;
      }
      const alternatePosition: ResolvedWavePosition = {
        waveOrder: position.waveOrder,
        primarySourceId: position.primarySourceId,
        resolvedSourceId: alternate.sourceId,
        resolution: "alternate",
        reason: replacementReason
      };
      try {
        records.push(await retrieveOne({
          youtube,
          expectedChannelId: token.channel.id,
          position: alternatePosition,
          inspection: inspectionBySource.get(alternate.sourceId)!
        }));
      } catch (alternateError) {
        records.push(unavailableRecord(alternatePosition, alternateError instanceof SafeWaveError ? alternateError.code : "retrieval_failed"));
      }
    }
  }
  const stable = {
    schemaVersion: 1 as const,
    privateContent: true as const,
    processingVersion: wave1CaptionProcessingVersion,
    records,
    integrity: { recordSetSha256: sha256(JSON.stringify(records)) }
  };
  const artifact: PrivateRetrievalArtifact = { ...stable, completedAt: new Date().toISOString() };
  const persistence = await persistJsonNoClobber(retrievalPath, artifact, stable);
  const retrieved = records.filter((record) => record.outcome === "retrieved");
  process.stdout.write(safeJson({
    outcome: "wave_1_caption_retrieval_complete",
    wavePositions: records.length,
    retrievedRecords: retrieved.length,
    unavailableRecords: records.length - retrieved.length,
    primaryRecords: retrieved.filter((record) => record.resolution === "primary").length,
    replacementRecords: retrieved.filter((record) => record.resolution === "alternate").length,
    warningCounts: retrieved.flatMap((record) => record.structuralMetrics?.warnings ?? []).reduce<Record<string, number>>((counts, warning) => {
      counts[warning] = (counts[warning] ?? 0) + 1;
      return counts;
    }, {}),
    privatePersistence: persistence,
    identifiersDisplayed: false,
    captionTextDisplayed: false
  }));
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (rest.length > 0 || !new Set(["map", "inspect", "retrieve"]).has(command ?? "")) {
    throw new SafeWaveError("command_invalid", "Use exactly one bounded command: map, inspect, or retrieve");
  }
  if (command === "map") await mappingCommand();
  if (command === "inspect") await inspectionCommand();
  if (command === "retrieve") await retrievalCommand();
}

main().catch((error: unknown) => {
  const safe = error instanceof SafeWaveError
    ? { code: error.code, message: error.message }
    : { code: "unexpected_failure", message: "The bounded Wave 1 operation failed safely" };
  process.stderr.write(safeJson({ outcome: "failed", error: safe }));
  process.exitCode = 1;
});

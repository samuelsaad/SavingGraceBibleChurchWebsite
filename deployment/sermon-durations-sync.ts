/** D-177 duration-only synchronization. No sermons, content, users or publication
 * state are imported. Protected recovery artifacts stay outside Git/images. */
import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import { canonicalReviewJson } from "../src/domain/delegated-ai-review";
import { canonicalSermonAudioUrl } from "../src/domain/sermonaudio";
import { resolveYouTubeIdentity } from "../src/domain/youtube";
import { durationReceiptNamespace } from "../src/domain/recording-duration-receipt";
import { mediaSnapshotHash } from "../src/metadata/sermonaudio-linking";
import { applyVerifiedSermonDuration, verifiedDurationEvidenceSchema } from "../src/metadata/sermon-duration-update";
import * as durationUpdates from "../src/metadata/sermon-duration-update";
import { assertReadOnlyLocalDatabase } from "../src/migration/local-database-safety";
import { frontendSermonEligibilitySql } from "../src/server/queries/public-sermons";
import { verifyCompletedSchema } from "../src/staging/completed-schema";
import { loadCompletedCohort } from "../src/staging/completed-cohort";
import { protectedMarker } from "../src/staging/completed-sync";
import { databaseFingerprint } from "../src/staging/database-verification";
import { stagingConfiguration, stagingPassword, verifyStagingIdentity } from "../src/staging/guard";

const sha = z.string().regex(/^[a-f0-9]{64}$/u);
const hash = (value: unknown): string => createHash("sha256").update(canonicalReviewJson(value)).digest("hex");
const fail = (reason: string): never => { throw Error(`duration_sync_${reason}`); };
export const durationSourceBaselineSha256 = "7c412fdb8d6d579bd5f9c03d17c5320d14efc75bf01c14648dd15848f9c833c3";
const sourceId = z.union([z.number().int().positive().max(Number.MAX_SAFE_INTEGER), z.string().regex(/^[1-9][0-9]*$/u)])
  .transform(value => Number(value)).refine(value => Number.isSafeInteger(value) && value > 0);
export const durationPacketSchema = z.object({
  schemaVersion: z.literal(1), decision: z.literal("D-177"), baselineHash: z.literal(durationSourceBaselineSha256),
  records: z.array(z.object({ sermonId: z.uuid(), sourceWordPressId: sourceId, mediaId: z.uuid(),
    expectedRowVersion: z.number().int().positive(), expectedMediaHash: sha, evidence: verifiedDurationEvidenceSchema
  }).strict()).min(1).max(2_000)
}).strict().superRefine((value, ctx) => {
  for (const key of ["sermonId", "sourceWordPressId", "mediaId"] as const) {
    if (new Set(value.records.map(record => record[key])).size !== value.records.length) ctx.addIssue({ code: "custom", message: `duration_duplicate_${key}` });
  }
});
export type DurationPacket = z.infer<typeof durationPacketSchema>;
export type DurationSyncTarget = "local" | "staging";
export type DurationSyncMode = "baseline" | "plan" | "apply" | "verify" | "rollback-data";

export function validateDurationPacket(value: unknown): DurationPacket {
  const parsed = durationPacketSchema.safeParse(value);
  if (!parsed.success) return fail("packet_invalid");
  return parsed.data;
}
export function durationPacketHash(packet: DurationPacket): string { return hash(packet); }

type IdentityRow = { id: string; sourceWordPressId: number; rowVersion: number; status: string; deleted: boolean };
type Mapping = { sequence: number; outcome: "mapped"; sermonId: string; sourceWordPressId: number; mediaId: string;
  rowVersion: number; mediaHash: string; durationSeconds: number | null; status: string; deleted: boolean }
  | { sequence: number; outcome: "unavailable" | "conflicting"; reason: string };
type HashRow = { key: string; hash: string };
type State = { fingerprint: Awaited<ReturnType<typeof databaseFingerprint>>; membership: string[]; eligible: string[]; publicEligible: string[];
  sermons: Array<{ key: string; hash: string; preservedHash: string }>;
  media: Array<{ key: string; hash: string; preservedHash: string; sermonId: string; durationSeconds: number | null }>;
  audits: HashRow[]; mediaAudits: HashRow[]; extensions: HashRow[]; durationReceipts: HashRow[] };
type Baseline = { schemaVersion: 1; decision: "D-177"; target: DurationSyncTarget; packetSha256: string; mappings: Mapping[]; state: State; sha256: string };
type Result = { sequence: number; outcome: string; reason?: string; acceptanceRefreshed?: number; recovery?: unknown; affectedSermonIds?: string[] };
type Receipt = { schemaVersion: 1; decision: "D-177"; mode: "apply" | "rollback-data"; target: DurationSyncTarget; packetSha256: string;
  baselineSha256: string; beforeFingerprint: string; afterFingerprint: string; results: Result[]; recovery: unknown[];
  sourceReceiptSha256?: string; sha256: string };

/** Source joins may map a different staging UUID, but contradictory UUID/source
 * joins or a duplicate source identity fail closed. Display names are irrelevant. */
export function resolveDurationSourceIdentity(record: DurationPacket["records"][number], candidates: IdentityRow[]) {
  if (!candidates.length) return { outcome: "unavailable" as const, reason: "source_record_not_present" };
  if (candidates.length !== 1 || candidates[0]!.sourceWordPressId !== record.sourceWordPressId) {
    return { outcome: "conflicting" as const, reason: "source_identity_conflict" };
  }
  return { outcome: "mapped" as const, record: candidates[0]! };
}

export function matchesDurationRecording(evidence: DurationPacket["records"][number]["evidence"],
  media: { provider: string; media_type: string; external_id: string | null; canonical_url: string | null }): boolean {
  if (media.provider !== evidence.provider || media.external_id !== evidence.recordingId || !media.canonical_url) return false;
  return evidence.provider === "sermonaudio"
    ? media.media_type === "audio" && media.canonical_url === canonicalSermonAudioUrl(evidence.recordingId)
    : media.media_type === "video" && resolveYouTubeIdentity([{ videoId: media.external_id, canonicalUrl: media.canonical_url }]).status === "available";
}

async function mapTarget(c: PoolClient, record: DurationPacket["records"][number], sequence: number): Promise<Mapping> {
  const rows = (await c.query("SELECT id,source_wordpress_id,row_version,status,deleted_at FROM sermons WHERE id=$1 OR source_wordpress_id=$2 ORDER BY id", [record.sermonId, record.sourceWordPressId])).rows;
  const match = resolveDurationSourceIdentity(record, rows.map(row => ({ id: String(row.id), sourceWordPressId: Number(row.source_wordpress_id),
    rowVersion: Number(row.row_version), status: String(row.status), deleted: row.deleted_at !== null })));
  if (match.outcome !== "mapped") return { sequence, ...match };
  const media = (await c.query("SELECT to_jsonb(m) row FROM sermon_media m WHERE sermon_id=$1 ORDER BY display_order,id", [match.record.id])).rows.map(row => row.row);
  const recordings = media.filter(row => row.provider === record.evidence.provider && row.external_id === record.evidence.recordingId);
  const mediaMatches = recordings.length === 1 && matchesDurationRecording(record.evidence, recordings[0]);
  if (!mediaMatches) {
    return { sequence, outcome: recordings.length ? "conflicting" : "unavailable", reason: "verified_recording_not_present" };
  }
  const audio = recordings[0];
  return { sequence, outcome: "mapped", sermonId: match.record.id, sourceWordPressId: match.record.sourceWordPressId,
    mediaId: String(audio.id), rowVersion: match.record.rowVersion, mediaHash: mediaSnapshotHash(media),
    durationSeconds: audio.duration_seconds, status: match.record.status, deleted: match.record.deleted };
}

export function planDurationRecord(record: DurationPacket["records"][number], saved: Mapping, current: Mapping, target: DurationSyncTarget): Result {
  const sequence = saved.sequence;
  if (current.outcome !== "mapped") return { sequence, outcome: current.outcome, reason: current.reason };
  if (saved.outcome !== "mapped") return { sequence, outcome: saved.outcome, reason: saved.reason };
  if (current.sermonId !== saved.sermonId || current.mediaId !== saved.mediaId) return { sequence, outcome: "conflicting", reason: "destination_mapping_changed" };
  if (target === "local" && (current.sermonId !== record.sermonId || current.mediaId !== record.mediaId)) return { sequence, outcome: "conflicting", reason: "source_identity_conflict" };
  if (current.durationSeconds === record.evidence.durationSeconds) return { sequence, outcome: "unchanged", reason: "verified_duration_already_present" };
  if (current.durationSeconds !== null) return { sequence, outcome: "conflicting", reason: "existing_recording_duration_differs" };
  const expectedVersion = target === "local" ? record.expectedRowVersion : saved.rowVersion;
  const expectedHash = target === "local" ? record.expectedMediaHash : saved.mediaHash;
  if (current.rowVersion !== expectedVersion || current.mediaHash !== expectedHash) return { sequence, outcome: "conflicting", reason: "concurrent_metadata_change" };
  if (current.deleted || !["draft", "published"].includes(current.status)) return { sequence, outcome: "pending", reason: "record_status_prohibits_update" };
  return { sequence, outcome: "ready" };
}

async function captureState(c: PoolClient, target: DurationSyncTarget): Promise<State> {
  const fingerprint = await databaseFingerprint(c);
  const rows = (await c.query("SELECT id key,encode(digest(to_jsonb(s)::text,'sha256'),'hex') hash,encode(digest((to_jsonb(s)-'row_version'-'updated_at'-'updated_by_subject')::text,'sha256'),'hex') \"preservedHash\" FROM sermons s ORDER BY id")).rows as State["sermons"];
  const media = (await c.query("SELECT id key,sermon_id \"sermonId\",duration_seconds \"durationSeconds\",encode(digest(to_jsonb(m)::text,'sha256'),'hex') hash,encode(digest((to_jsonb(m)-'duration_seconds'-'updated_at')::text,'sha256'),'hex') \"preservedHash\" FROM sermon_media m ORDER BY id")).rows as State["media"];
  const rowHashes = async (table: "audit_events" | "sermon_media_source_audit") => (await c.query(`SELECT id::text key,encode(digest(to_jsonb(t)::text,'sha256'),'hex') hash FROM ${table} t ORDER BY id`)).rows as HashRow[];
  const extensions = (await c.query("SELECT sermon_id::text||':'||namespace key,namespace,encode(digest(to_jsonb(e)::text,'sha256'),'hex') hash FROM sermon_extensions e ORDER BY sermon_id,namespace")).rows;
  const eligible = async (scope: "d175_completed" | "d175_local_completed" | "public") => (await c.query(`SELECT s.id FROM sermons s WHERE ${frontendSermonEligibilitySql("s", scope)} ORDER BY s.id`)).rows.map(row => String(row.id));
  return { fingerprint, membership: rows.map(row => row.key), eligible: await eligible(target === "local" ? "d175_local_completed" : "d175_completed"),
    publicEligible: await eligible("public"), sermons: rows, media, audits: await rowHashes("audit_events"), mediaAudits: await rowHashes("sermon_media_source_audit"),
    extensions: extensions.filter(row => row.namespace !== durationReceiptNamespace).map(({ key, hash }) => ({ key, hash })),
    durationReceipts: extensions.filter(row => row.namespace === durationReceiptNamespace).map(({ key, hash }) => ({ key, hash })) };
}

function assertOldRows(before: HashRow[], after: HashRow[]) {
  const current = new Map(after.map(row => [row.key, row.hash]));
  if (before.some(row => current.get(row.key) !== row.hash)) fail("historical_row_changed");
}
/** Only recording seconds, their row versions and new audited refresh records
 * may differ. Existing sermon bodies, media identities and old audits cannot. */
export function assertDurationStatePreserved(before: State, after: State, changedSermons: Set<string>, changedMedia: Set<string>) {
  for (const field of ["membership", "eligible", "publicEligible"] as const) if (hash(before[field]) !== hash(after[field])) fail(`${field}_changed`);
  if (before.fingerprint.sequenceHash !== after.fingerprint.sequenceHash) fail("sequences_changed");
  for (const field of ["sermons", "media"] as const) {
    const rows = new Map(after[field].map(row => [row.key, row]));
    if (rows.size !== before[field].length) fail("record_membership_changed");
    for (const previous of before[field]) {
      const current = rows.get(previous.key);
      if (!current || current.preservedHash !== previous.preservedHash) return fail("content_or_media_identity_changed");
      if (!(field === "sermons" ? changedSermons : changedMedia).has(previous.key) && previous.hash !== current.hash) fail("unrelated_record_changed");
    }
  }
  const mutable = new Set(["sermons", "sermon_media", "sermon_media_source_audit", "sermon_extensions", "audit_events"]);
  if (before.fingerprint.tables.length !== after.fingerprint.tables.length) fail("schema_changed");
  for (const previous of before.fingerprint.tables) if (!mutable.has(previous.table)) {
    if (hash(previous) !== hash(after.fingerprint.tables.find(table => table.table === previous.table))) fail("unrelated_table_changed");
  }
  assertOldRows(before.audits, after.audits); assertOldRows(before.mediaAudits, after.mediaAudits);
  if (hash(before.extensions) !== hash(after.extensions)) fail("original_acceptance_or_extension_changed");
  const untouched = before.durationReceipts.filter(row => !changedSermons.has(row.key.split(":")[0]!));
  const afterUntouched = after.durationReceipts.filter(row => !changedSermons.has(row.key.split(":")[0]!));
  if (hash(untouched) !== hash(afterUntouched)) fail("unrelated_duration_receipt_changed");
}

async function protectedDirectory(path: string) {
  if (!isAbsolute(path)) fail("private_path_required");
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path); if (!info.isDirectory() || info.isSymbolicLink()) fail("private_directory_refused");
}
async function readPrivate(path: string): Promise<unknown> {
  if (!isAbsolute(path) || !path.endsWith(".private.json")) fail("private_path_required");
  const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink()) fail("private_file_refused");
  return JSON.parse(await readFile(path, "utf8"));
}
async function writePrivate(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value), { flag: "wx", mode: 0o600 });
}
function validateBaseline(raw: unknown, packet: DurationPacket, target: DurationSyncTarget): Baseline {
  const b = raw as Baseline;
  if (!b || b.schemaVersion !== 1 || b.decision !== "D-177" || b.target !== target || b.packetSha256 !== durationPacketHash(packet)
    || b.sha256 !== hash({ ...b, sha256: "" }) || b.mappings.length !== packet.records.length
    || b.mappings.some((mapping, index) => mapping.sequence !== index + 1)) fail("baseline_invalid");
  return b;
}
function validateReceipt(raw: unknown, packet: DurationPacket, baseline: Baseline): Receipt {
  const receipt = raw as Receipt;
  if (!receipt || receipt.schemaVersion !== 1 || receipt.decision !== "D-177" || receipt.mode !== "apply"
    || receipt.target !== baseline.target || receipt.packetSha256 !== durationPacketHash(packet) || receipt.baselineSha256 !== baseline.sha256
    || receipt.sha256 !== hash({ ...receipt, sha256: "" }) || !Array.isArray(receipt.recovery)) fail("rollback_receipt_invalid");
  return receipt;
}

async function verifyTarget(c: PoolClient, target: DurationSyncTarget) {
  if (target === "staging") {
    await verifyStagingIdentity(c, true);
    const marker = (await c.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0]?.marker;
    if (marker !== protectedMarker) fail("staging_marker_mismatch");
  } else {
    const r = (await c.query("SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port,current_setting('server_version_num')::int version")).rows[0];
    if (!r || r.db !== "savinggrace_sermons_test" || r.host !== "127.0.0.1" || r.port !== 5432 || r.version < 160000 || r.version >= 170000) fail("local_target_refused");
  }
  await verifyCompletedSchema(c);
}
function summary(results: Result[]) {
  const counts: Record<string, number> = { updated: 0, unchanged: 0, ready: 0, unavailable: 0, conflicting: 0, pending: 0, failed: 0 };
  for (const result of results) counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;
  return counts;
}

/** No credentials accepted in the packet. A local caller may supply its existing
 * protected PoolClient; stage uses the established owner-secret mount. */
export async function runDurationSync(c: PoolClient, mode: DurationSyncMode, packet: DurationPacket,
  options: { target: DurationSyncTarget; outputDirectory: string; rollbackReceipt?: string; cohortPath?: string }) {
  packet = validateDurationPacket(packet);
  const { target, outputDirectory } = options;
  if (!["baseline", "plan", "apply", "verify", "rollback-data"].includes(mode)) fail("operation_refused");
  // Existing D-171 cohort integrity stays mandatory on staging. The local
  // selector instead uses its existing guarded local completion contracts.
  if (target === "staging") await loadCompletedCohort(options.cohortPath ?? "/verification/cohort.private.json");
  await protectedDirectory(outputDirectory);
  const baselinePath = join(outputDirectory, "baseline.private.json"), packetSha256 = durationPacketHash(packet);
  const writing = mode === "apply" || mode === "rollback-data";
  await c.query(writing ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await verifyTarget(c, target); await c.query("SET LOCAL TIME ZONE 'UTC'");
    if (writing) { await c.query("SET LOCAL savinggrace.application_request='on'"); await c.query("SELECT pg_advisory_xact_lock(177,1)"); }
    if (mode === "baseline") {
      let existing: unknown;
      try { existing = await readPrivate(baselinePath); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (existing) {
        const b = validateBaseline(existing, packet, target); await c.query("ROLLBACK");
        return { outcome: "baseline_reused", targets: packet.records.length, sermons: b.state.membership.length, eligible: b.state.eligible.length, packetSha256, baselineSha256: b.sha256 };
      }
      const state = await captureState(c, target), mappings: Mapping[] = [];
      for (const [index, record] of packet.records.entries()) mappings.push(await mapTarget(c, record, index + 1));
      const b: Baseline = { schemaVersion: 1, decision: "D-177", target, packetSha256, mappings, state, sha256: "" };
      b.sha256 = hash({ ...b, sha256: "" }); await writePrivate(baselinePath, b); await c.query("ROLLBACK");
      return { outcome: "baseline", targets: packet.records.length, sermons: state.membership.length, eligible: state.eligible.length, packetSha256, baselineSha256: b.sha256 };
    }
    const baseline = validateBaseline(await readPrivate(baselinePath), packet, target), before = await captureState(c, target);
    const results: Result[] = [], recoveries: unknown[] = [], changedSermons = new Set<string>(), changedMedia = new Set<string>();
    let sourceReceiptSha256: string | undefined;
    if (mode === "rollback-data") {
      let path = options.rollbackReceipt;
      if (!path) {
        const paths = (await readdir(outputDirectory)).filter(name => /^apply-[a-f0-9-]+\.(?:prepared|completed)\.private\.json$/u.test(name));
        const candidates = new Map<string, { path: string; receipt: Receipt }>();
        for (const name of paths) {
          const candidate = validateReceipt(await readPrivate(join(outputDirectory, name)), packet, baseline);
          // A crash can happen after COMMIT but before the completed-file write.
          // Retained prepared evidence is recoverable only when the database
          // independently matches its exact committed post-state.
          if (candidate.recovery.length && (name.includes(".completed.") || candidate.afterFingerprint === before.fingerprint.sha256)) {
            candidates.set(candidate.sha256, { path: join(outputDirectory, name), receipt: candidate });
          }
        }
        if (candidates.size !== 1) fail("explicit_rollback_receipt_required");
        path = [...candidates.values()][0]!.path;
      }
      if (!path) return fail("explicit_rollback_receipt_required");
      const receipt = validateReceipt(await readPrivate(resolve(path)), packet, baseline); sourceReceiptSha256 = receipt.sha256;
      for (const [index, raw] of [...receipt.recovery].reverse().entries()) {
        const result = await durationUpdates.rollbackVerifiedSermonDuration(c, raw, { target });
        if (!["rolled_back", "unchanged"].includes(result.outcome)) fail("rollback_current_state_conflict");
        results.push({ sequence: index + 1, ...result });
        const recovery = raw as { sermonId: string; mediaId: string };
        changedSermons.add(recovery.sermonId); changedMedia.add(recovery.mediaId);
        if ("affectedSermonIds" in result) for (const id of result.affectedSermonIds ?? []) changedSermons.add(id);
      }
    } else {
      for (const [index, record] of packet.records.entries()) {
        const saved = baseline.mappings[index]!, current = await mapTarget(c, record, index + 1);
        const planned = planDurationRecord(record, saved, current, target);
        if (mode !== "apply" || planned.outcome !== "ready" || current.outcome !== "mapped" || saved.outcome !== "mapped") {
          results.push(mode === "verify" && planned.outcome === "ready" ? { ...planned, outcome: "failed", reason: "duration_not_persisted" } : planned); continue;
        }
        await c.query("SAVEPOINT duration_record");
        try {
          const result = await applyVerifiedSermonDuration(c, { sermonId: current.sermonId, sourceWordPressId: current.sourceWordPressId,
            expectedVersion: target === "local" ? record.expectedRowVersion : saved.rowVersion, mediaId: current.mediaId,
            mediaBeforeSha256: target === "local" ? record.expectedMediaHash : saved.mediaHash, planSha256: packetSha256, evidence: record.evidence }, { target });
          if (result.outcome === "updated" && !result.recovery) fail("recovery_missing");
          results.push({ sequence: index + 1, ...result });
          if (result.outcome === "updated") {
            changedSermons.add(current.sermonId); changedMedia.add(current.mediaId);
            for (const id of result.affectedSermonIds ?? []) changedSermons.add(id);
            recoveries.push(result.recovery);
          }
          await c.query("RELEASE SAVEPOINT duration_record");
        } catch (error) {
          await c.query("ROLLBACK TO SAVEPOINT duration_record");
          results.push({ sequence: index + 1, outcome: "failed", reason: error instanceof Error && /^duration_[a-z_]+$/u.test(error.message) ? error.message : "guarded_duration_update_failed" });
        }
      }
    }
    const after = await captureState(c, target);
    assertDurationStatePreserved(before, after, changedSermons, changedMedia);
    if (!writing && before.fingerprint.sha256 !== after.fingerprint.sha256) fail("read_only_state_changed");
    const allUnchanged = results.every(result => ["unchanged", "unavailable", "conflicting", "pending"].includes(result.outcome));
    if (mode === "apply" && allUnchanged && before.fingerprint.sha256 !== after.fingerprint.sha256) fail("identical_run_changed_database");
    const receipt: Receipt = { schemaVersion: 1, decision: "D-177", mode: mode === "rollback-data" ? mode : "apply", target, packetSha256,
      baselineSha256: baseline.sha256, beforeFingerprint: before.fingerprint.sha256, afterFingerprint: after.fingerprint.sha256,
      results, recovery: recoveries, ...(sourceReceiptSha256 ? { sourceReceiptSha256 } : {}), sha256: "" };
    receipt.sha256 = hash({ ...receipt, sha256: "" });
    const run = `${mode}-${randomUUID()}`;
    if (writing) {
      await writePrivate(join(outputDirectory, `${run}.prepared.private.json`), receipt);
      await c.query("COMMIT");
      await writePrivate(join(outputDirectory, `${run}.completed.private.json`), receipt);
    } else { await c.query("ROLLBACK"); await writePrivate(join(outputDirectory, `${run}.private.json`), receipt); }
    return { outcome: results.some(result => ["failed", "conflicting"].includes(result.outcome)) ? "partial" : "verified", targets: results.length,
      ...summary(results), sermons: after.membership.length, eligible: after.eligible.length, packetSha256,
      beforeFingerprint: before.fingerprint.sha256, afterFingerprint: after.fingerprint.sha256, contentPreserved: true, eligibilityPreserved: true,
      idempotent: before.fingerprint.sha256 === after.fingerprint.sha256, receiptSha256: receipt.sha256 };
  } catch (error) { await c.query("ROLLBACK"); throw error; }
}

async function main() {
  const mode = process.argv[2] as DurationSyncMode;
  const local = process.env.DURATION_TARGET === "local";
  const target: DurationSyncTarget = local ? "local" : "staging";
  if (!local && (process.env.DURATION_TARGET !== "existing-protected" || process.env.ALLOW_STAGING_DURATION_SYNC !== "1" || process.env.ALLOW_STAGING_SERMON_DURATION_SYNC !== "1")) fail("staging_gate_required");
  if (local && ["apply", "rollback-data"].includes(mode) && process.env.ALLOW_LOCAL_DB_WRITE !== "1") fail("local_gate_required");
  const input = local ? process.env.DURATION_PACKET : "/verification/durations.private.json";
  const outputDirectory = local ? process.env.DURATION_OUTPUT_DIRECTORY : "/verification/output";
  if (!input || !outputDirectory) return fail("configuration_required");
  const packet = validateDurationPacket(await readPrivate(input));
  let pool: Pool;
  if (local) {
    const connectionString = process.env.DATABASE_URL ?? "postgresql://127.0.0.1:5432/savinggrace_sermons_test";
    assertReadOnlyLocalDatabase(connectionString);
    const url = new URL(connectionString); if (url.username || url.password || url.hostname !== "127.0.0.1") fail("local_connection_refused");
    pool = new Pool({ connectionString, user: process.env.PGUSER, password: process.env.PGPASSWORD, max: 1, statement_timeout: 120_000 });
  } else {
    const config = stagingConfiguration(process.env, true);
    pool = new Pool({ ...config, password: stagingPassword(config.passwordFile), max: 1, statement_timeout: 120_000 });
  }
  const c = await pool.connect();
  try {
    const result = await runDurationSync(c, mode, packet, { target, outputDirectory,
      ...(process.env.DURATION_ROLLBACK_RECEIPT ? { rollbackReceipt: process.env.DURATION_ROLLBACK_RECEIPT } : {}) });
    console.log(JSON.stringify(result)); if (result.outcome === "partial") process.exitCode = 1;
  } finally { c.release(); await pool.end(); }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/sermon-durations-sync.ts") || process.argv[1]?.endsWith("sermon-durations-sync.cjs")) {
  main().catch(error => { console.log(JSON.stringify({ outcome: "stopped_safely", code: error instanceof Error && /^(duration|staging|d171)_[a-z_]+$/u.test(error.message) ? error.message : "duration_sync_failed", detailsSuppressed: true })); process.exitCode = 1; });
}

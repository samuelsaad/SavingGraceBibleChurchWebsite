import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { assertReadOnlyLocalDatabase } from "../src/migration/local-database-safety";
import { databaseFingerprint, verifyReleaseSchema } from "../src/staging/database-verification";
import { stagingConfiguration, stagingPassword, verifyStagingIdentity } from "../src/staging/guard";
import { d160DraftProcessingVersion, d160DraftSourceStatus } from "../src/server/queries/public-sermons";

export const d160ManifestSha256 = "0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94" as const;
const manifestSize = 36;
const packageSchemaVersion = 1;

const sermonTables = [
  "sermon_enrichment_sources",
  "sermon_transcripts",
  "sermon_media",
  "sermon_primary_passage_reviews",
  "scripture_references",
  "scripture_reference_sources",
  "sermon_question_answers",
  "sermon_enrichment_draft_imports",
  "sermon_enrichment_reviews",
  "sermon_enrichment_review_items"
] as const;
const packageTables = ["sermons", ...sermonTables, "sermon_media_source_audit", "audit_events"] as const;
type PackageTable = typeof packageTables[number];

interface ManifestRecord {
  sequence: number;
  sourceWordPressId: number;
  videoId: string;
}
interface Manifest {
  records: ManifestRecord[];
  integrity: { canonicalSha256: string };
}
interface TablePacket {
  primaryKey: string[];
  rows: Array<Record<string, unknown>>;
}
interface SyncPackage {
  schemaVersion: 1;
  manifestSha256: typeof d160ManifestSha256;
  exportedAt: string;
  sourceFingerprintSha256: string;
  candidateLineage: Array<{
    sequence: number;
    correctionCount: number;
    artifactSha256: string;
    validationSha256: string;
    selectedModelLabel: string;
    runtimeModel: string;
  }>;
  tables: Record<PackageTable, TablePacket>;
  packageSha256: string;
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "integrity" && key !== "packageSha256")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalise(nested)]));
  }
  return value;
}
function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalise(value))).digest("hex");
}
function safeName(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/u.test(value)) throw new Error("unsafe_database_identifier");
  return `"${value}"`;
}

async function jsonFiles(root: string): Promise<unknown[]> {
  const values: unknown[] = [];
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop()!;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) {
        try { values.push(JSON.parse(await readFile(path, "utf8"))); } catch { /* unrelated private artifact */ }
      }
    }
  }
  return values;
}

async function privateEvidence(root: string): Promise<{ manifest: Manifest; lineage: SyncPackage["candidateLineage"] }> {
  const values = await jsonFiles(root);
  const candidates = values.filter((value): value is Manifest => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<Manifest>;
    return candidate.integrity?.canonicalSha256 === d160ManifestSha256
      && Array.isArray(candidate.records) && candidate.records.length === manifestSize;
  });
  if (candidates.length !== 1) throw new Error("d160_manifest_not_unique");
  const manifest = candidates[0]!;
  if (sha256(manifest) !== d160ManifestSha256
    || manifest.records.some((record, index) => record.sequence !== index + 1)
    || new Set(manifest.records.map(record => record.sourceWordPressId)).size !== manifestSize
    || new Set(manifest.records.map(record => record.videoId)).size !== manifestSize) {
    throw new Error("d160_manifest_integrity_refused");
  }
  const ledgers = values.filter((value): value is { manifestSha256: string; entries: SyncPackage["candidateLineage"] } => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as { manifestSha256?: unknown; entries?: unknown };
    return candidate.manifestSha256 === d160ManifestSha256
      && Array.isArray(candidate.entries) && candidate.entries.length === manifestSize
      && candidate.entries.every((entry: unknown) => Boolean(entry && typeof entry === "object" && "artifactSha256" in entry));
  });
  if (ledgers.length !== 1) throw new Error("d160_validation_ledger_not_unique");
  const lineage = ledgers[0]!.entries.map((entry) => ({
    sequence: Number(entry.sequence),
    correctionCount: Number(entry.correctionCount),
    artifactSha256: String(entry.artifactSha256),
    validationSha256: String(entry.validationSha256),
    selectedModelLabel: String(entry.selectedModelLabel),
    runtimeModel: String(entry.runtimeModel)
  }));
  if (lineage.some((entry, index) => entry.sequence !== index + 1
    || !/^[0-9a-f]{64}$/u.test(entry.artifactSha256)
    || !/^[0-9a-f]{64}$/u.test(entry.validationSha256)
    || entry.correctionCount < 0 || entry.correctionCount > 1)) {
    throw new Error("d160_validation_ledger_invalid");
  }
  return { manifest, lineage };
}

async function primaryKey(client: PoolClient, table: string): Promise<string[]> {
  const result = await client.query(`SELECT a.attname AS column_name
    FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
    WHERE i.indrelid=('public.' || $1)::regclass AND i.indisprimary
    ORDER BY array_position(i.indkey,a.attnum)`, [table]);
  const columns = result.rows.map(row => String(row.column_name));
  if (!columns.length) throw new Error("sync_table_requires_primary_key");
  return columns;
}

async function exportRows(
  client: PoolClient,
  table: PackageTable,
  sermonIds: string[]
): Promise<TablePacket> {
  const pk = await primaryKey(client, table);
  const order = pk.map(safeName).join(",");
  let condition = "sermon_id=ANY($1::uuid[])";
  if (table === "sermons") condition = "id=ANY($1::uuid[])";
  if (table === "audit_events") condition = "entity_id=ANY($1::uuid[])";
  if (table === "sermon_media_source_audit") {
    condition = "sermon_media_id IN (SELECT id FROM sermon_media WHERE sermon_id=ANY($1::uuid[]))";
  }
  const result = await client.query(
    `SELECT to_jsonb(row_data) AS row FROM public.${safeName(table)} row_data WHERE ${condition} ORDER BY ${order}`,
    [sermonIds]
  );
  return { primaryKey: pk, rows: result.rows.map(row => row.row as Record<string, unknown>) };
}

async function exportPackage(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  const privateRoot = process.env.D160_PRIVATE_ROOT;
  const outputPath = process.env.D160_SYNC_PACKAGE;
  if (!connectionString || !privateRoot || !outputPath || !isAbsolute(privateRoot) || !isAbsolute(outputPath)
    || !outputPath.endsWith(".private.json")) throw new Error("d160_export_configuration_refused");
  assertReadOnlyLocalDatabase(connectionString);
  const { manifest, lineage } = await privateEvidence(privateRoot);
  const pool = new Pool({ connectionString, max: 1, options: "-c default_transaction_read_only=on -c timezone=UTC" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const identity = await client.query(`SELECT current_database()=$1 AS database_ok,
      inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet) AS loopback_ok,
      inet_server_port()=5432 AS port_ok,
      current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS version_ok`,
      ["savinggrace_sermons_test"]);
    if (!Object.values(identity.rows[0] ?? {}).every(Boolean)) throw new Error("d160_source_database_refused");
    const sourceIds = manifest.records.map(record => record.sourceWordPressId);
    const sermons = await client.query(`SELECT id,source_wordpress_id FROM sermons
      WHERE source_wordpress_id=ANY($1::bigint[]) AND source_status=$2 ORDER BY source_wordpress_id`,
      [sourceIds, d160DraftSourceStatus]);
    if (sermons.rowCount !== manifestSize) throw new Error("d160_source_identity_count_mismatch");
    const bySource = new Map(sermons.rows.map(row => [Number(row.source_wordpress_id), String(row.id)]));
    const sermonIds = manifest.records.map(record => bySource.get(record.sourceWordPressId));
    if (sermonIds.some(id => !id)) throw new Error("d160_source_identity_missing");
    const media = await client.query(`SELECT s.source_wordpress_id,m.external_id
      FROM sermons s JOIN sermon_media m ON m.sermon_id=s.id AND m.provider='youtube'
      WHERE s.id=ANY($1::uuid[]) AND m.is_primary`, [sermonIds]);
    const videoBySource = new Map(media.rows.map(row => [Number(row.source_wordpress_id), String(row.external_id)]));
    if (media.rowCount !== manifestSize || manifest.records.some(record => videoBySource.get(record.sourceWordPressId) !== record.videoId)) {
      throw new Error("d160_source_video_binding_mismatch");
    }
    const provenance = await client.query(`SELECT count(*)::integer AS records,
      count(*) FILTER (WHERE processing_version=$2)::integer AS processing,
      count(*) FILTER (WHERE jsonb_path_exists(warnings,'$[*] ? (@.code == "CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION")'))::integer AS audio_warnings
      FROM sermon_enrichment_sources WHERE sermon_id=ANY($1::uuid[])`,
      [sermonIds, d160DraftProcessingVersion]);
    if (provenance.rows[0]?.records !== manifestSize || provenance.rows[0]?.processing !== manifestSize
      || provenance.rows[0]?.audio_warnings !== manifestSize) throw new Error("d160_source_provenance_mismatch");
    const prohibited = await client.query(`SELECT
      (SELECT count(*) FROM sermon_restricted_acceptances WHERE sermon_id=ANY($1::uuid[]))
      +(SELECT count(*) FROM sermon_ai_content_reviews WHERE sermon_id=ANY($1::uuid[]))
      +(SELECT count(*) FROM sermon_ai_component_reviews WHERE sermon_id=ANY($1::uuid[]))
      +(SELECT count(*) FROM sermon_description_semantic_eligibility WHERE sermon_id=ANY($1::uuid[]))
      +(SELECT count(*) FROM description_semantic_relationships WHERE source_sermon_id=ANY($1::uuid[]) OR neighbour_sermon_id=ANY($1::uuid[])) AS records`,
      [sermonIds]);
    if (Number(prohibited.rows[0]?.records) !== 0) throw new Error("d160_source_public_or_semantic_state_refused");
    const tables = {} as Record<PackageTable, TablePacket>;
    for (const table of packageTables) tables[table] = await exportRows(client, table, sermonIds as string[]);
    const fingerprint = await databaseFingerprint(client);
    const packet: SyncPackage = {
      schemaVersion: packageSchemaVersion,
      manifestSha256: d160ManifestSha256,
      exportedAt: new Date().toISOString(),
      sourceFingerprintSha256: fingerprint.sha256,
      candidateLineage: lineage,
      tables,
      packageSha256: ""
    };
    packet.packageSha256 = sha256(packet);
    await mkdir(resolve(outputPath, ".."), { recursive: true });
    await writeFile(outputPath, JSON.stringify(packet), { encoding: "utf8", mode: 0o600, flag: "wx" });
    await client.query("ROLLBACK");
    process.stdout.write(JSON.stringify({
      outcome: "exported", manifestSha256: d160ManifestSha256, records: manifestSize,
      packageSha256: packet.packageSha256,
      rows: Object.fromEntries(packageTables.map(table => [table, tables[table].rows.length]))
    }) + "\n");
  } finally {
    client.release();
    await pool.end();
  }
}

function readPacket(value: unknown): SyncPackage {
  if (!value || typeof value !== "object") throw new Error("d160_package_invalid");
  const packet = value as SyncPackage;
  if (packet.schemaVersion !== packageSchemaVersion || packet.manifestSha256 !== d160ManifestSha256
    || packet.tables.sermons.rows.length !== manifestSize || packet.candidateLineage.length !== manifestSize
    || packet.packageSha256 !== sha256(packet)) throw new Error("d160_package_integrity_refused");
  for (const table of packageTables) {
    if (!packet.tables[table] || !Array.isArray(packet.tables[table].rows)) throw new Error("d160_package_table_missing");
  }
  return packet;
}

async function insertableColumns(client: PoolClient, table: string): Promise<string[]> {
  const result = await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'
      AND identity_generation IS NULL ORDER BY ordinal_position`, [table]);
  return result.rows.map(row => String(row.column_name));
}

async function insertPacketRow(
  client: PoolClient,
  table: PackageTable,
  packet: TablePacket,
  row: Record<string, unknown>
): Promise<"inserted" | "unchanged"> {
  const where = packet.primaryKey.map((column, index) => `${safeName(column)}=$${index + 1}`).join(" AND ");
  const values = packet.primaryKey.map(column => row[column]);
  const existing = await client.query(
    `SELECT to_jsonb(existing_row) AS row FROM public.${safeName(table)} existing_row WHERE ${where}`,
    values
  );
  if (existing.rowCount) {
    if (sha256(existing.rows[0].row) !== sha256(row)) throw new Error(`d160_conflict_${table}`);
    return "unchanged";
  }
  const columns = await insertableColumns(client, table);
  const names = columns.map(safeName).join(",");
  await client.query(`WITH candidate AS (
      SELECT * FROM jsonb_populate_record(NULL::public.${safeName(table)}, $1::jsonb)
    ) INSERT INTO public.${safeName(table)} (${names}) SELECT ${names} FROM candidate`,
    [JSON.stringify(row)]);
  return "inserted";
}

async function unrelatedFingerprint(client: PoolClient, sermonIds: string[]): Promise<string> {
  const evidence: Array<{ table: string; count: number; sha256: string }> = [];
  for (const table of packageTables) {
    let condition = "sermon_id<>ALL($1::uuid[])";
    if (table === "sermons") condition = "id<>ALL($1::uuid[])";
    if (table === "audit_events") condition = "entity_id<>ALL($1::uuid[])";
    if (table === "sermon_media_source_audit") {
      condition = "sermon_media_id NOT IN (SELECT id FROM sermon_media WHERE sermon_id=ANY($1::uuid[]))";
    }
    const result = await client.query(`SELECT count(*)::integer AS count,
      encode(digest(COALESCE(string_agg(row_hash,'' ORDER BY row_hash COLLATE "C"),''),'sha256'),'hex') AS sha256
      FROM (SELECT encode(digest(to_jsonb(t)::text,'sha256'),'hex') row_hash
        FROM public.${safeName(table)} t WHERE ${condition}) rows`, [sermonIds]);
    evidence.push({ table, ...result.rows[0] });
  }
  return sha256(evidence);
}

async function importPackage(): Promise<void> {
  const inputPath = process.env.D160_SYNC_PACKAGE;
  if (!inputPath || !isAbsolute(inputPath) || !inputPath.endsWith(".private.json")
    || process.env.ALLOW_STAGING_D160_SYNC !== "1") throw new Error("d160_import_configuration_refused");
  const packet = readPacket(JSON.parse(await readFile(inputPath, "utf8")));
  const config = stagingConfiguration(process.env, true);
  const pool = new Pool({ ...config, password: stagingPassword(config.passwordFile), max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await verifyStagingIdentity(client, true);
    await verifyReleaseSchema(client, 19);
    const sermonRows = packet.tables.sermons.rows;
    const sermonIds = sermonRows.map(row => String(row.id));
    const sourceIds = sermonRows.map(row => String(row.source_wordpress_id));
    const slugs = sermonRows.map(row => String(row.slug));
    const baseline = await client.query("SELECT count(*)::integer AS sermons FROM sermons");
    const existing = await client.query(`SELECT count(*)::integer AS records FROM sermons
      WHERE id=ANY($1::uuid[]) OR source_wordpress_id=ANY($2::bigint[]) OR slug=ANY($3::text[])`,
      [sermonIds, sourceIds, slugs]);
    const existingCount = Number(existing.rows[0]?.records);
    if (!([0, manifestSize].includes(existingCount))
      || (existingCount === 0 && Number(baseline.rows[0]?.sermons) !== 155)
      || (existingCount === manifestSize && Number(baseline.rows[0]?.sermons) !== 191)) {
      throw new Error("d160_staging_baseline_or_identity_conflict");
    }
    const before = await unrelatedFingerprint(client, sermonIds);
    const totals: Record<string, { inserted: number; unchanged: number }> = {};
    const apply = async (table: PackageTable) => {
      totals[table] = { inserted: 0, unchanged: 0 };
      for (const row of packet.tables[table].rows) {
        totals[table]![await insertPacketRow(client, table, packet.tables[table], row)]++;
      }
    };
    await apply("sermons");
    await apply("sermon_enrichment_sources");
    await apply("sermon_transcripts");
    if (existingCount === 0) {
      await client.query("DELETE FROM sermon_enrichment_reviews WHERE sermon_id=ANY($1::uuid[])", [sermonIds]);
    }
    for (const table of [
      "sermon_media", "sermon_primary_passage_reviews", "scripture_references",
      "scripture_reference_sources", "sermon_question_answers", "sermon_enrichment_draft_imports",
      "sermon_enrichment_reviews", "sermon_enrichment_review_items", "sermon_media_source_audit", "audit_events"
    ] as PackageTable[]) await apply(table);
    const after = await unrelatedFingerprint(client, sermonIds);
    if (before !== after) throw new Error("d160_unrelated_staging_state_changed");
    const state = await client.query(`SELECT
      (SELECT count(*)::integer FROM sermons) AS sermons,
      (SELECT count(*)::integer FROM sermons WHERE id=ANY($1::uuid[]) AND status='draft' AND published_at IS NULL) AS drafts,
      (SELECT count(*)::integer FROM sermon_enrichment_reviews WHERE sermon_id=ANY($1::uuid[]) AND completed_at IS NULL) AS pending,
      (SELECT count(*)::integer FROM sermon_restricted_acceptances WHERE sermon_id=ANY($1::uuid[])) AS accepted,
      (SELECT count(*)::integer FROM sermon_ai_content_reviews WHERE sermon_id=ANY($1::uuid[])) AS ai_reviews,
      (SELECT count(*)::integer FROM sermon_description_semantic_eligibility WHERE sermon_id=ANY($1::uuid[])) AS semantic`, [sermonIds]);
    const verified = state.rows[0];
    if (verified.sermons !== 191 || verified.drafts !== manifestSize || verified.pending !== manifestSize
      || verified.accepted !== 0 || verified.ai_reviews !== 0 || verified.semantic !== 0) {
      throw new Error("d160_staging_state_verification_failed");
    }
    await client.query("COMMIT");
    process.stdout.write(JSON.stringify({
      outcome: existingCount === 0 ? "inserted" : "unchanged",
      manifestSha256: d160ManifestSha256, packageSha256: packet.packageSha256,
      records: manifestSize, totals, stagingSermons: verified.sermons
    }) + "\n");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "export") await exportPackage();
  else if (mode === "import") await importPackage();
  else throw new Error("Expected export or import");
}

void main().catch((error: unknown) => {
  const code = error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)
    ? error.message
    : "unrecognized_or_unavailable";
  const errorType = error instanceof Error && /^[A-Za-z]+Error$/u.test(error.name)
    ? error.name
    : "UnknownError";
  const databaseCode = error && typeof error === "object" && "code" in error
    && typeof error.code === "string" && /^[0-9A-Z]{5}$/u.test(error.code)
      ? error.code
      : "none";
  process.stderr.write(`d160_sync_refused:${code}:${errorType}:${databaseCode}\n`);
  process.exitCode = 1;
});

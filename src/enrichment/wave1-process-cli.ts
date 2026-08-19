import { spawn } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lstat, mkdir, open, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { runMigrationDryRun } from "../migration/importer";
import { loadMigrationResult } from "../migration/postgres-loader";
import type { LegacySermonRecord, LegacyTerm } from "../migration/types";
import { enrichmentDraftBundleSchema, type EnrichmentDraftBundle } from "./contracts";
import { importEnrichmentDraftBundle } from "./postgres-enrichment";
import { existingOrWriteBundle } from "./phase3b2-pilot";
import { ensureSafeDirectory } from "./pilot-punctuation";
import { prepareWaveOneContent, wave1EnrichmentProcessingVersion } from "./wave1-enrichment";
import { sha256 } from "../youtube/pilot-caption-proof";

const metadataQueryVersion = "phase3b2c-wave1-required-metadata-v1" as const;
const actorSubject = "local-phase3b2c-wave1-importer";
const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(sourceDirectory, "..", "..");
const waveOneRoot = join(repositoryRoot, "private", "phase-3b2c-wave1");
const retrievalPath = join(waveOneRoot, "caption-retrieval.private.json");
const metadataPath = join(waveOneRoot, "required-source-metadata.private.json");
const processingPath = join(waveOneRoot, "processing-outcomes.completed.private.json");
const preparedRoot = join(waveOneRoot, "prepared-private");
const mysqlShellExecutable = "C:\\Program Files\\MySQL\\MySQL Shell 26.7\\bin\\mysqlsh.exe";
let safeFailureStage = "startup";

interface RetrievalRecord {
  waveOrder: number;
  primarySourceId: number;
  resolvedSourceId: number | null;
  resolution: "primary" | "alternate" | "unavailable";
  outcome: "retrieved" | "unavailable";
  videoId: string | null;
  language: string | null;
  trackKind: string | null;
  audioTrackType: string | null;
  primaryAudioAssociationConfirmed: boolean | null;
  provenanceWarnings: string[];
  sourceRelativePath: string | null;
  sourceContentSha256: string | null;
  structuralMetrics: { warnings: string[]; apparentDurationCoveragePercent: number | null } | null;
}

interface RetrievalArtifact {
  schemaVersion: 1;
  privateContent: true;
  records: RetrievalRecord[];
  integrity: { recordSetSha256: string };
}

interface MetadataQueryRow {
  record_kind: "post" | "term" | "passage";
  source_id: number | string;
  post_type: string | null;
  post_status: string | null;
  title: string | null;
  slug: string | null;
  post_date_local: string | null;
  post_date_gmt: string | null;
  post_modified_local: string | null;
  post_modified_gmt: string | null;
  taxonomy: string | null;
  term_id: number | string | null;
  term_taxonomy_id: number | string | null;
  term_name: string | null;
  term_slug: string | null;
  term_order: number | string | null;
  passage_value: string | null;
}

interface MetadataArtifact {
  schemaVersion: 1;
  privateContent: true;
  queryVersion: typeof metadataQueryVersion;
  extractedAt: string;
  querySha256: string;
  returnedRowCount: number;
  records: LegacySermonRecord[];
  failures: Array<{ sourceId: number; code: string }>;
  integrity: { recordSetSha256: string };
}

class SafeWaveProcessError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

async function loadJson<T>(path: string): Promise<T> {
  const file = await lstat(path).catch(() => null);
  if (!file?.isFile() || file.isSymbolicLink()) throw new SafeWaveProcessError("private_input_invalid", "A required private Wave 1 artifact is unavailable");
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function loadRetrieval(): Promise<RetrievalArtifact> {
  const value = await loadJson<RetrievalArtifact>(retrievalPath);
  if (value.schemaVersion !== 1 || value.privateContent !== true || value.records.length !== 12 ||
    value.integrity?.recordSetSha256 !== sha256(JSON.stringify(value.records))) {
    throw new SafeWaveProcessError("retrieval_integrity_failure", "Wave 1 retrieval evidence failed integrity verification");
  }
  return value;
}

async function persistNoClobber(path: string, value: unknown, stable: unknown): Promise<"created" | "unchanged"> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    const handle = await open(path, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return "created";
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    const existing = await loadJson<Record<string, unknown>>(path);
    const stableExisting = { ...existing };
    delete stableExisting.extractedAt;
    delete stableExisting.completedAt;
    if (sha256(JSON.stringify(stableExisting)) !== sha256(JSON.stringify(stable))) {
      throw new SafeWaveProcessError("private_artifact_conflict", "Existing private Wave 1 artifact differs from this repeatable operation");
    }
    return "unchanged";
  }
}

function sqlDatabaseName(value: string): string {
  if (!/^[A-Za-z0-9_]+$/u.test(value)) throw new SafeWaveProcessError("production_configuration_invalid", "Production database identity is unsafe");
  return `'${value}'`;
}

function selectedRows(sourceIds: readonly number[]): string {
  return sourceIds.map((sourceId, index) => `${index === 0 ? "SELECT" : "UNION ALL SELECT"} ${sourceId} AS source_id`).join("\n");
}

function metadataQuery(sourceIds: readonly number[], databaseName: string): string {
  const scope = selectedRows(sourceIds);
  const guard = [
    "SELECT CASE WHEN",
    `  DATABASE() = ${sqlDatabaseName(databaseName)}`,
    "  AND @@version LIKE '%MariaDB%'",
    "  AND (SELECT COUNT(*) FROM information_schema.tables",
    "       WHERE table_schema = DATABASE()",
    "         AND table_name IN ('wp_posts','wp_postmeta','wp_terms','wp_term_taxonomy','wp_term_relationships')) = 5",
    "THEN 1 ELSE 0 END AS identity_ok"
  ].join("\n");
  const emptyTermColumns = "NULL AS taxonomy, NULL AS term_id, NULL AS term_taxonomy_id, NULL AS term_name, NULL AS term_slug, NULL AS term_order";
  const emptyPostColumns = "NULL AS post_type, NULL AS post_status, NULL AS title, NULL AS slug, NULL AS post_date_local, NULL AS post_date_gmt, NULL AS post_modified_local, NULL AS post_modified_gmt";
  return [
    "SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;",
    "START TRANSACTION READ ONLY;",
    "SELECT 'post' AS record_kind, scoped.source_id,",
    "       post.post_type, post.post_status, post.post_title AS title, post.post_name AS slug,",
    "       DATE_FORMAT(post.post_date, '%Y-%m-%d %H:%i:%s') AS post_date_local,",
    "       NULLIF(DATE_FORMAT(post.post_date_gmt, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00') AS post_date_gmt,",
    "       DATE_FORMAT(post.post_modified, '%Y-%m-%d %H:%i:%s') AS post_modified_local,",
    "       NULLIF(DATE_FORMAT(post.post_modified_gmt, '%Y-%m-%d %H:%i:%s'), '0000-00-00 00:00:00') AS post_modified_gmt,",
    `       ${emptyTermColumns}, NULL AS passage_value`,
    `FROM (${scope}) scoped`,
    `JOIN (${guard}) verified ON verified.identity_ok = 1`,
    "LEFT JOIN wp_posts post ON post.ID = scoped.source_id",
    "UNION ALL",
    "SELECT 'term' AS record_kind, scoped.source_id,",
    `       ${emptyPostColumns},`,
    "       taxonomy.taxonomy, term.term_id, taxonomy.term_taxonomy_id, term.name, term.slug, relationship.term_order,",
    "       NULL AS passage_value",
    `FROM (${scope}) scoped`,
    `JOIN (${guard}) verified ON verified.identity_ok = 1`,
    "JOIN wp_term_relationships relationship ON relationship.object_id = scoped.source_id",
    "JOIN wp_term_taxonomy taxonomy ON taxonomy.term_taxonomy_id = relationship.term_taxonomy_id",
    "JOIN wp_terms term ON term.term_id = taxonomy.term_id",
    "WHERE taxonomy.taxonomy IN ('sermon_speaker','sermon_series','sermon_book','sermon_topics')",
    "UNION ALL",
    "SELECT 'passage' AS record_kind, scoped.source_id,",
    `       ${emptyPostColumns}, ${emptyTermColumns}, metadata.meta_value AS passage_value`,
    `FROM (${scope}) scoped`,
    `JOIN (${guard}) verified ON verified.identity_ok = 1`,
    "LEFT JOIN wp_postmeta metadata",
    "  ON metadata.post_id = scoped.source_id AND metadata.meta_key = 'asp_sermon_bible_passage'",
    "ORDER BY source_id, record_kind, term_order, term_taxonomy_id;",
    "COMMIT;"
  ].join("\n");
}

async function runMysqlShell(query: string): Promise<MetadataQueryRow[]> {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new SafeWaveProcessError("production_configuration_invalid", "Protected production connection configuration is incomplete");
    return value;
  };
  const host = required("SG_LEGACY_DB_HOST");
  const port = required("SG_LEGACY_DB_PORT");
  const user = required("SG_LEGACY_DB_USER");
  const database = required("SG_LEGACY_DB_NAME");
  return await new Promise<MetadataQueryRow[]>((resolvePromise, rejectPromise) => {
    const child = spawn(mysqlShellExecutable, [
      "--sql", `--host=${host}`, `--port=${port}`, `--user=${user}`, `--schema=${database}`,
      "--result-format=json/raw", "--execute", query
    ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = false;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.on("data", () => { stderr = true; });
    child.once("error", () => rejectPromise(new SafeWaveProcessError("production_connection_failed", "Protected production metadata connection could not start")));
    child.once("close", (code) => {
      if (code !== 0 || stderr) {
        rejectPromise(new SafeWaveProcessError("production_metadata_query_failed", "Protected production metadata query failed safely"));
        return;
      }
      const rows: MetadataQueryRow[] = [];
      const append = (value: unknown): void => {
        if (Array.isArray(value)) { for (const item of value) append(item); return; }
        if (!value || typeof value !== "object") return;
        const object = value as Record<string, unknown>;
        if (Object.hasOwn(object, "record_kind")) rows.push(object as unknown as MetadataQueryRow);
        else if (Array.isArray(object.rows)) append(object.rows);
      };
      try {
        try { append(JSON.parse(stdout)); } catch {
          for (const line of stdout.split(/\r?\n/u)) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) continue;
            try { append(JSON.parse(trimmed)); } catch { /* Ignore shell framing text. */ }
          }
        }
        resolvePromise(rows);
      } catch {
        rejectPromise(new SafeWaveProcessError("production_metadata_result_invalid", "Protected production metadata result could not be parsed"));
      }
    });
  });
}

function term(row: MetadataQueryRow): LegacyTerm {
  if (!row.term_id || !row.term_taxonomy_id || !row.term_name || !row.term_slug) {
    throw new SafeWaveProcessError("production_metadata_result_invalid", "A required source taxonomy relationship is incomplete");
  }
  return {
    termId: Number(row.term_id),
    termTaxonomyId: Number(row.term_taxonomy_id),
    name: row.term_name,
    slug: row.term_slug,
    order: Number(row.term_order ?? 0)
  };
}

function buildLegacyRecords(retrieval: RetrievalArtifact, rows: readonly MetadataQueryRow[]): {
  records: LegacySermonRecord[];
  failures: Array<{ sourceId: number; code: string }>;
} {
  const records: LegacySermonRecord[] = [];
  const failures: Array<{ sourceId: number; code: string }> = [];
  for (const retrieved of retrieval.records.filter((item) => item.outcome === "retrieved")) {
    const sourceId = retrieved.resolvedSourceId!;
    const sourceRows = rows.filter((row) => Number(row.source_id) === sourceId);
    const posts = sourceRows.filter((row) => row.record_kind === "post");
    const passages = sourceRows.filter((row) => row.record_kind === "passage" && row.passage_value?.trim());
    if (posts.length !== 1 || !posts[0]!.title?.trim() || !posts[0]!.slug?.trim() ||
      !posts[0]!.post_date_local || !retrieved.videoId || passages.length > 1) {
      failures.push({ sourceId, code: "required_source_metadata_missing_or_ambiguous" });
      continue;
    }
    const post = posts[0]!;
    const terms = sourceRows.filter((row) => row.record_kind === "term");
    records.push({
      sourceTable: "wp_posts",
      sourceId,
      postType: post.post_type,
      postStatus: post.post_status,
      title: post.title,
      slug: post.slug,
      postDateLocal: post.post_date_local,
      postDateGmt: post.post_date_gmt,
      postModifiedLocal: post.post_modified_local,
      postModifiedGmt: post.post_modified_gmt,
      body: null,
      summary: null,
      legacyViewCount: null,
      speakers: terms.filter((row) => row.taxonomy === "sermon_speaker").map(term),
      series: terms.filter((row) => row.taxonomy === "sermon_series").map(term),
      books: terms.filter((row) => row.taxonomy === "sermon_book").map(term),
      passageTerms: terms.filter((row) => row.taxonomy === "sermon_topics").map(term),
      meta: {
        biblePassage: passages[0]?.passage_value ?? null,
        youtube: `https://www.youtube.com/watch?v=${retrieved.videoId}`,
        audioEmbed: null
      }
    });
  }
  return { records, failures };
}

async function metadataCommand(): Promise<void> {
  const retrieval = await loadRetrieval();
  const resolved = retrieval.records.filter((record) => record.outcome === "retrieved");
  const sourceIds = resolved.map((record) => record.resolvedSourceId!);
  if (sourceIds.length === 0 || new Set(sourceIds).size !== sourceIds.length) {
    throw new SafeWaveProcessError("wave1_scope_invalid", "Resolved Wave 1 scope is empty or duplicated");
  }
  const database = process.env.SG_LEGACY_DB_NAME;
  if (!database) throw new SafeWaveProcessError("production_configuration_invalid", "Protected production database identity is unavailable");
  const query = metadataQuery(sourceIds, database);
  const queryRows = await runMysqlShell(query);
  const returnedIds = new Set(queryRows.map((row) => Number(row.source_id)));
  if (sourceIds.some((sourceId) => !returnedIds.has(sourceId))) {
    throw new SafeWaveProcessError("production_identity_or_scope_mismatch", "Required metadata query did not cover every resolved Wave 1 identity");
  }
  const built = buildLegacyRecords(retrieval, queryRows);
  const stable = {
    schemaVersion: 1 as const,
    privateContent: true as const,
    queryVersion: metadataQueryVersion,
    querySha256: sha256(query),
    returnedRowCount: queryRows.length,
    records: built.records,
    failures: built.failures,
    integrity: { recordSetSha256: sha256(JSON.stringify({ records: built.records, failures: built.failures })) }
  };
  const artifact: MetadataArtifact = { ...stable, extractedAt: new Date().toISOString() };
  const persistence = await persistNoClobber(metadataPath, artifact, stable);
  process.stdout.write(`${JSON.stringify({
    outcome: "required_wave1_metadata_complete",
    resolvedRecords: sourceIds.length,
    usableMetadataRecords: built.records.length,
    perRecordFailures: built.failures.length,
    returnedMetadataRows: queryRows.length,
    privatePersistence: persistence,
    contentDisplayed: false,
    identifiersDisplayed: false
  })}\n`);
}

async function loadMetadata(): Promise<MetadataArtifact> {
  const value = await loadJson<MetadataArtifact>(metadataPath);
  if (value.schemaVersion !== 1 || value.privateContent !== true || value.queryVersion !== metadataQueryVersion ||
    value.integrity?.recordSetSha256 !== sha256(JSON.stringify({ records: value.records, failures: value.failures }))) {
    throw new SafeWaveProcessError("required_metadata_integrity_failure", "Required Wave 1 metadata failed integrity verification");
  }
  return value;
}

function safeWarnings(record: RetrievalRecord, prepared: ReturnType<typeof prepareWaveOneContent>) {
  const warnings = [...prepared.warnings];
  for (const code of record.provenanceWarnings) warnings.push({
    code,
    safeDetail: "YouTube did not confirm primary-audio association for the sole eligible caption track."
  });
  for (const code of record.structuralMetrics?.warnings ?? []) warnings.push({
    code,
    safeDetail: "The private structural caption assessment recorded this objective warning."
  });
  return [...new Map(warnings.map((warning) => [warning.code, warning])).values()];
}

async function verifyDatabase(pool: Pool): Promise<void> {
  const result = await pool.query<{ database_ok: boolean; version_ok: boolean; migrations_ok: boolean }>(
    `SELECT current_database() = 'savinggrace_sermons_test' AS database_ok,
            current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS version_ok,
            (SELECT count(*) FROM schema_migrations WHERE migration_id IN (
              '0004_sermon_enrichment_readiness','0007_guided_sermon_review',
              '0008_atomic_sermon_review_items','0009_pilot_completion_safeguards','0010_zero_finding_guided_review',
              '0013_official_youtube_caption_provenance'
            )) = 6 AS migrations_ok`
  );
  if (!result.rows[0]?.database_ok || !result.rows[0]?.version_ok || !result.rows[0]?.migrations_ok) {
    throw new SafeWaveProcessError("postgres_target_mismatch", "Local PostgreSQL target or required migration state did not match");
  }
}

async function verifyCommand(): Promise<void> {
  safeFailureStage = "verify_private_database_state";
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new SafeWaveProcessError("postgres_configuration_missing", "DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const pool = new Pool({ connectionString, max: 1, application_name: "saving-grace-wave1-readonly-verification" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await client.query<{
      database_ok: boolean;
      version_ok: boolean;
      migration_count: number;
      migration_max_order: number;
      migrations_after_0013: number;
      wave_records: number;
      private_description_drafts: number;
      private_transcript_drafts: number;
      private_qa_drafts: number;
      approval_markers: number;
      provenance_complete: number;
      audio_track_warnings: number;
      guided_review_records: number;
      completed_review_records: number;
      ready_records: number;
      public_search_candidates: number;
      semantic_eligible: number;
      semantic_builds: number;
      semantic_relationships: number;
    }>(
      `WITH wave AS (
         SELECT sermon.id
         FROM sermons sermon
         JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
         WHERE source.processing_version = $1
       )
       SELECT
         current_database() = 'savinggrace_sermons_test' AS database_ok,
         current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS version_ok,
         (SELECT count(*)::integer FROM schema_migrations) AS migration_count,
         (SELECT max(migration_order)::integer FROM schema_migrations) AS migration_max_order,
         (SELECT count(*)::integer FROM schema_migrations WHERE migration_order > 13) AS migrations_after_0013,
         (SELECT count(*)::integer FROM wave) AS wave_records,
         (SELECT count(*)::integer FROM sermons sermon JOIN wave ON wave.id = sermon.id
           WHERE sermon.status = 'draft' AND sermon.published_at IS NULL AND sermon.summary_status = 'draft') AS private_description_drafts,
         (SELECT count(*)::integer FROM sermon_transcripts transcript JOIN wave ON wave.id = transcript.sermon_id
           WHERE transcript.status = 'draft' AND transcript.approved_at IS NULL AND transcript.approved_by_subject IS NULL) AS private_transcript_drafts,
         (SELECT count(*)::integer FROM sermon_question_answers qa JOIN wave ON wave.id = qa.sermon_id
           WHERE qa.status = 'draft' AND qa.approved_at IS NULL AND qa.approved_by_subject IS NULL) AS private_qa_drafts,
         ((SELECT count(*) FROM sermons sermon JOIN wave ON wave.id = sermon.id
             WHERE sermon.summary_approved_at IS NOT NULL OR sermon.summary_approved_by_subject IS NOT NULL)
           + (SELECT count(*) FROM sermon_transcripts transcript JOIN wave ON wave.id = transcript.sermon_id
             WHERE transcript.approved_at IS NOT NULL OR transcript.approved_by_subject IS NOT NULL)
           + (SELECT count(*) FROM sermon_question_answers qa JOIN wave ON wave.id = qa.sermon_id
             WHERE qa.approved_at IS NOT NULL OR qa.approved_by_subject IS NOT NULL))::integer AS approval_markers,
         (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN wave ON wave.id = source.sermon_id
           WHERE source.retrieval_attribution = 'authorised_youtube_data_api'
             AND source.source_content_sha256 ~ '^[a-f0-9]{64}$'
             AND source.warnings <> '[]'::jsonb
             AND source.manual_attention_required
             AND source.accuracy_review_status = 'required') AS provenance_complete,
         (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN wave ON wave.id = source.sermon_id
           CROSS JOIN LATERAL jsonb_array_elements(source.warnings) warning
           WHERE warning->>'code' = 'audio_track_type_unverified') AS audio_track_warnings,
         (SELECT count(*)::integer FROM sermon_enrichment_reviews review JOIN wave ON wave.id = review.sermon_id) AS guided_review_records,
         (SELECT count(*)::integer FROM sermon_enrichment_reviews review JOIN wave ON wave.id = review.sermon_id
           WHERE review.completed_at IS NOT NULL) AS completed_review_records,
         (SELECT count(*)::integer FROM sermon_content_readiness readiness JOIN wave ON wave.id = readiness.sermon_id
           WHERE readiness.is_complete) AS ready_records,
         (SELECT count(*)::integer FROM sermons sermon JOIN wave ON wave.id = sermon.id
           WHERE sermon.status = 'published' AND sermon.deleted_at IS NULL) AS public_search_candidates,
         (SELECT count(*)::integer FROM sermon_description_semantic_eligibility) AS semantic_eligible,
         (SELECT count(*)::integer FROM description_semantic_builds) AS semantic_builds,
         (SELECT count(*)::integer FROM description_semantic_relationships) AS semantic_relationships`,
      [wave1EnrichmentProcessingVersion]
    );
    const verified = result.rows[0]!;
    const expected = verified.database_ok && verified.version_ok && verified.migration_count === 13 &&
      verified.migration_max_order === 13 && verified.migrations_after_0013 === 0 && verified.wave_records === 12 &&
      verified.private_description_drafts === 12 && verified.private_transcript_drafts === 12 &&
      verified.private_qa_drafts === 84 && verified.approval_markers === 0 && verified.provenance_complete === 12 &&
      verified.audio_track_warnings === 12 && verified.guided_review_records === 12 &&
      verified.completed_review_records === 0 && verified.ready_records === 0 && verified.public_search_candidates === 0 &&
      verified.semantic_eligible === 0 && verified.semantic_builds === 0 && verified.semantic_relationships === 0;
    if (!expected) {
      throw new SafeWaveProcessError("private_draft_verification_failed", "Wave 1 migration, draft, provenance, privacy or semantic-state verification failed");
    }
    await client.query("COMMIT");
    process.stdout.write(`${JSON.stringify({
      outcome: "wave1_private_verification_complete",
      migrationCount: verified.migration_count,
      latestMigrationOrder: verified.migration_max_order,
      migrationsAfter0013: verified.migrations_after_0013,
      waveDrafts: verified.wave_records,
      transcriptDrafts: verified.private_transcript_drafts,
      descriptionDrafts: verified.private_description_drafts,
      questionAnswerDrafts: verified.private_qa_drafts,
      approvalMarkers: verified.approval_markers,
      provenanceRecords: verified.provenance_complete,
      audioTrackTypeUnverifiedWarnings: verified.audio_track_warnings,
      guidedReviewRecords: verified.guided_review_records,
      completedReviewRecords: verified.completed_review_records,
      administratorReadyRecords: verified.ready_records,
      publicSearchCandidates: verified.public_search_candidates,
      semanticEligibleRecords: verified.semantic_eligible,
      semanticBuilds: verified.semantic_builds,
      semanticRelationships: verified.semantic_relationships,
      contentDisplayed: false,
      identifiersDisplayed: false
    })}\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function processCommand(): Promise<void> {
  safeFailureStage = "load_private_inputs";
  const started = performance.now();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new SafeWaveProcessError("postgres_configuration_missing", "DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const retrieval = await loadRetrieval();
  const metadata = await loadMetadata();
  const dryRun = runMigrationDryRun(metadata.records);
  if (dryRun.summary.included !== metadata.records.length || dryRun.summary.excluded !== 0 || dryRun.summary.rejected !== 0) {
    throw new SafeWaveProcessError("metadata_transform_failed", "One or more required Wave 1 metadata records failed the approved migration contract");
  }
  const pool = new Pool({ connectionString, max: 2, application_name: "saving-grace-wave1-private-import" });
  const outcomes: Array<{
    waveOrder: number;
    sourceId: number;
    outcome: "imported_as_draft" | "unchanged" | "failed";
    failureCode: string | null;
    sourceWordCount: number | null;
    cleanedWordCount: number | null;
    questionAnswerCount: number;
    estimatedReviewMinutes: number;
    warningCodes: string[];
  }> = [];
  try {
    safeFailureStage = "verify_postgres_target";
    await verifyDatabase(pool);
    safeFailureStage = "protect_existing_review_state";
    const selectedSourceIds = metadata.records.map((record) => record.sourceId);
    const protectedState = await pool.query<{ protected_count: number }>(
      `SELECT count(*)::integer AS protected_count
       FROM sermons sermon
       WHERE sermon.source_wordpress_id = ANY($1::bigint[])
         AND (
           sermon.status <> 'draft'
           OR (sermon.updated_by_subject IS NOT NULL AND sermon.updated_by_subject <> $2)
           OR sermon.summary_status NOT IN ('missing', 'draft')
           OR sermon.summary_reviewed_at IS NOT NULL OR sermon.summary_approved_at IS NOT NULL
           OR EXISTS (
             SELECT 1 FROM sermon_transcripts transcript
             WHERE transcript.sermon_id = sermon.id
               AND (transcript.status NOT IN ('missing', 'draft') OR transcript.reviewed_at IS NOT NULL OR transcript.approved_at IS NOT NULL)
           )
           OR EXISTS (
             SELECT 1 FROM sermon_question_answers qa
             WHERE qa.sermon_id = sermon.id
               AND (qa.status <> 'draft' OR qa.reviewed_at IS NOT NULL OR qa.approved_at IS NOT NULL)
           )
           OR EXISTS (
             SELECT 1 FROM sermon_enrichment_reviews review
             WHERE review.sermon_id = sermon.id AND (review.current_stage > 1 OR review.completed_at IS NOT NULL)
           )
           OR EXISTS (
             SELECT 1 FROM sermon_enrichment_review_items item
             WHERE item.sermon_id = sermon.id AND item.decision_status <> 'pending'
           )
         )`,
      [selectedSourceIds, actorSubject]
    );
    if (protectedState.rows[0]!.protected_count > 0) {
      throw new SafeWaveProcessError(
        "existing_reviewed_content",
        "Wave 1 processing refused to overwrite administrator-edited, reviewed or approved state"
      );
    }
    safeFailureStage = "import_private_metadata_shells";
    await loadMigrationResult(
      pool,
      dryRun,
      `phase3b2c-wave1:${metadata.integrity.recordSetSha256}`,
      { forcePrivateDraft: true }
    );
    await ensureSafeDirectory(preparedRoot);
    safeFailureStage = "prepare_and_import_drafts";
    for (const record of retrieval.records.filter((item) => item.outcome === "retrieved")) {
      const sourceId = record.resolvedSourceId!;
      let recordStage = "read_private_caption";
      try {
        const sourcePath = resolve(repositoryRoot, record.sourceRelativePath!);
        if (!sourcePath.startsWith(resolve(waveOneRoot, "source-captions"))) throw new Error("Private caption path escaped Wave 1 storage");
        const bytes = await readFile(sourcePath);
        if (sha256(bytes) !== record.sourceContentSha256) throw new Error("Private caption bytes failed their provenance hash");
        recordStage = "prepare_content";
        const prepared = prepareWaveOneContent(bytes);
        if (prepared.sourceWordSequenceSha256 !== prepared.cleanedWordSequenceSha256) {
          throw new Error("Prepared transcript failed accepted lexical source-word preservation");
        }
        recordStage = "resolve_private_target";
        const candidate = dryRun.candidates.find((item) => item.sourceWordPressId === sourceId);
        if (!candidate) throw new Error("Resolved source metadata did not produce a target sermon");
        const current = await pool.query<{ row_version: number; status: string }>(
          "SELECT row_version, status FROM sermons WHERE id = $1 AND source_wordpress_id = $2",
          [candidate.id, sourceId]
        );
        if (current.rows.length !== 1 || current.rows[0]!.status !== "draft") throw new Error("Wave 1 target is not a unique private draft");
        const now = new Date().toISOString();
        const warnings = safeWarnings(record, prepared);
        const estimatedReviewMinutes = Math.max(35, Math.ceil(prepared.cleanedWordCount / 180) + 25);
        const sourceReference = `youtube-api:${record.videoId}:${record.sourceContentSha256}:${wave1EnrichmentProcessingVersion}`;
        recordStage = "validate_draft_bundle";
        const bundle: EnrichmentDraftBundle = enrichmentDraftBundleSchema.parse({
          schemaVersion: 3,
          sourceWordPressId: sourceId,
          targetSermonId: candidate.id,
          expectedRowVersion: current.rows[0]!.row_version,
          description: {
            bodyText: prepared.description,
            provenance: { sourceKind: "generated_draft", sourceReference }
          },
          transcript: {
            bodyText: prepared.transcript,
            provenance: { sourceKind: "caption", sourceReference }
          },
          questionAnswers: prepared.questionAnswers.map((item) => ({
            ...item,
            provenance: { sourceKind: "generated_draft", sourceReference }
          })),
          sourceProvenance: {
            provider: "youtube",
            videoId: record.videoId,
            canonicalUrl: `https://www.youtube.com/watch?v=${record.videoId}`,
            captionLanguage: record.language,
            captionTrackType: record.trackKind?.toLowerCase() === "asr" ? "automatic" : "manual",
            originalFilename: basename(sourcePath),
            sourceContentSha256: record.sourceContentSha256,
            retrievalAttribution: "authorised_youtube_data_api",
            sourceCharacterCount: new TextDecoder("utf-8", { fatal: true }).decode(bytes).length,
            cleanedCharacterCount: prepared.transcript.length,
            apparentCompleteness: record.structuralMetrics?.apparentDurationCoveragePercent !== null &&
              record.structuralMetrics!.apparentDurationCoveragePercent! >= 85
              ? "apparently_complete"
              : "requires_manual_review",
            uncertaintyMarkerCount: prepared.uncertaintyMarkers.length,
            warnings,
            unresolvedPassages: prepared.uncertaintyMarkers,
            processingVersion: wave1EnrichmentProcessingVersion,
            importedAt: now,
            processedAt: now,
            processingDurationMs: Math.max(0, Math.round(performance.now() - started)),
            estimatedReviewMinutes,
            manualAttentionRequired: true,
            accuracyReviewStatus: "required"
          }
        });
        recordStage = "persist_private_bundle";
        const bundlePath = join(preparedRoot, `wave-${String(record.waveOrder).padStart(2, "0")}.private.json`);
        const persistedBundle = await existingOrWriteBundle(bundlePath, bundle);
        recordStage = "import_draft_bundle";
        const imported = await importEnrichmentDraftBundle(pool, persistedBundle, actorSubject);
        outcomes.push({
          waveOrder: record.waveOrder,
          sourceId,
          outcome: imported.outcome,
          failureCode: null,
          sourceWordCount: prepared.sourceWordCount,
          cleanedWordCount: prepared.cleanedWordCount,
          questionAnswerCount: prepared.questionAnswers.length,
          estimatedReviewMinutes,
          warningCodes: warnings.map((warning) => warning.code)
        });
      } catch {
        outcomes.push({
          waveOrder: record.waveOrder,
          sourceId,
          outcome: "failed",
          failureCode: `failed_${recordStage}`,
          sourceWordCount: null,
          cleanedWordCount: null,
          questionAnswerCount: 0,
          estimatedReviewMinutes: 0,
          warningCodes: []
        });
      }
    }
    const successful = outcomes.filter((outcome) => outcome.outcome !== "failed");
    safeFailureStage = "verify_idempotent_rerun";
    let idempotentUnchanged = 0;
    for (const outcome of successful) {
      const record = retrieval.records.find((item) => item.resolvedSourceId === outcome.sourceId)!;
      const bundle = await loadJson<unknown>(join(preparedRoot, `wave-${String(record.waveOrder).padStart(2, "0")}.private.json`));
      const rerun = await importEnrichmentDraftBundle(pool, bundle, actorSubject);
      if (rerun.outcome === "unchanged") idempotentUnchanged += 1;
    }
    const sourceIds = successful.map((outcome) => outcome.sourceId);
    safeFailureStage = "verify_private_database_state";
    const verification = await pool.query<{
      sermon_count: number;
      private_draft_count: number;
      description_draft_count: number;
      transcript_draft_count: number;
      qa_count: number;
      qa_draft_count: number;
      approval_marker_count: number;
      public_eligible_count: number;
    }>(
      `SELECT
         count(DISTINCT sermon.id)::integer AS sermon_count,
         count(DISTINCT sermon.id) FILTER (WHERE sermon.status = 'draft' AND sermon.published_at IS NULL)::integer AS private_draft_count,
         count(DISTINCT sermon.id) FILTER (WHERE sermon.summary_status = 'draft')::integer AS description_draft_count,
         count(DISTINCT transcript.sermon_id) FILTER (WHERE transcript.status = 'draft')::integer AS transcript_draft_count,
         count(qa.id)::integer AS qa_count,
         count(qa.id) FILTER (WHERE qa.status = 'draft')::integer AS qa_draft_count,
         (count(DISTINCT sermon.id) FILTER (WHERE sermon.summary_approved_at IS NOT NULL OR sermon.summary_approved_by_subject IS NOT NULL)
          + count(DISTINCT transcript.sermon_id) FILTER (WHERE transcript.approved_at IS NOT NULL OR transcript.approved_by_subject IS NOT NULL)
          + count(qa.id) FILTER (WHERE qa.approved_at IS NOT NULL OR qa.approved_by_subject IS NOT NULL))::integer AS approval_marker_count,
         count(DISTINCT sermon.id) FILTER (WHERE sermon.status = 'published')::integer AS public_eligible_count
       FROM sermons sermon
       LEFT JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
       LEFT JOIN sermon_question_answers qa ON qa.sermon_id = sermon.id
       WHERE sermon.source_wordpress_id = ANY($1::bigint[])`,
      [sourceIds]
    );
    const verified = verification.rows[0]!;
    if (verified.sermon_count !== successful.length || verified.private_draft_count !== successful.length ||
      verified.description_draft_count !== successful.length || verified.transcript_draft_count !== successful.length ||
      verified.qa_count !== successful.reduce((sum, outcome) => sum + outcome.questionAnswerCount, 0) ||
      verified.qa_draft_count !== verified.qa_count || verified.approval_marker_count !== 0 || verified.public_eligible_count !== 0 ||
      idempotentUnchanged !== successful.length) {
      throw new SafeWaveProcessError("private_draft_verification_failed", "Wave 1 draft, privacy or idempotency verification failed");
    }
    const stable = {
      schemaVersion: 1,
      privateContent: true,
      processingVersion: wave1EnrichmentProcessingVersion,
      outcomes,
      metadataImportCount: dryRun.candidates.length,
      idempotentUnchanged,
      privacyVerification: verified,
      integrity: { outcomeSetSha256: sha256(JSON.stringify(outcomes)) }
    };
    const artifact = { ...stable, completedAt: new Date().toISOString() };
    safeFailureStage = "persist_private_outcomes";
    const persistence = await persistNoClobber(processingPath, artifact, stable);
    process.stdout.write(`${JSON.stringify({
      outcome: "wave1_private_processing_complete",
      wavePositions: retrieval.records.length,
      processedDrafts: successful.length,
      failedDrafts: outcomes.length - successful.length,
      failureStageCounts: outcomes.filter((outcome) => outcome.failureCode).reduce<Record<string, number>>((counts, outcome) => {
        counts[outcome.failureCode!] = (counts[outcome.failureCode!] ?? 0) + 1;
        return counts;
      }, {}),
      descriptionsProduced: successful.length,
      transcriptsProduced: successful.length,
      questionAnswersProduced: successful.reduce((sum, outcome) => sum + outcome.questionAnswerCount, 0),
      idempotentUnchanged,
      approvalMarkers: verified.approval_marker_count,
      publicEligibleRecords: verified.public_eligible_count,
      estimatedAdministratorReviewMinutes: successful.reduce((sum, outcome) => sum + outcome.estimatedReviewMinutes, 0),
      processingDurationMs: Math.round(performance.now() - started),
      privatePersistence: persistence,
      contentDisplayed: false,
      identifiersDisplayed: false
    })}\n`);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (rest.length > 0 || !new Set(["metadata", "process", "verify"]).has(command ?? "")) {
    throw new SafeWaveProcessError("command_invalid", "Use exactly one Wave 1 command: metadata, process or verify");
  }
  if (command === "metadata") await metadataCommand();
  if (command === "process") {
    const retired: boolean = true;
    if (retired) {
      throw new SafeWaveProcessError(
        "mechanical_generation_retired",
        "Wave 1 extractive description and Q&A generation is retired; use the sermon-enrichment skill workflow"
      );
    }
    await processCommand();
  }
  if (command === "verify") await verifyCommand();
}

main().catch((error: unknown) => {
  const databaseCode = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : null;
  const errorName = error instanceof Error ? error.name.replace(/[^A-Za-z0-9_-]/g, "") : null;
  const safe = error instanceof SafeWaveProcessError
    ? { code: error.code, message: error.message }
    : {
        code: `unexpected_failure_${safeFailureStage}${databaseCode ? `_${databaseCode}` : ""}${errorName ? `_${errorName}` : ""}`,
        message: "The Wave 1 private processing command failed safely"
      };
  process.stderr.write(`${JSON.stringify({ outcome: "failed", error: safe })}\n`);
  process.exitCode = 1;
});

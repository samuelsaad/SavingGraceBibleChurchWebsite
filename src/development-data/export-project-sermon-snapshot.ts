import { mkdir, writeFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { assertReadOnlyLocalDatabase } from "../migration/local-database-safety";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import {
  deriveProjectSnapshotHashes,
  projectSermonSnapshotContentPath,
  projectSermonSnapshotDirectory,
  projectSermonSnapshotManifestPath,
  projectSermonSnapshotVersion,
  serializeProjectSnapshot,
  sha256,
  snapshotCounts,
  validateProjectSermonSnapshot,
  type JsonRow,
  type ProjectSermonSnapshot,
  type ProjectSermonSnapshotManifest
} from "./project-sermon-snapshot";

const sourceConnectionString = "postgresql://127.0.0.1:5432/savinggrace_sermons_test";
const excludedOperationalKeys = new Set([
  "password", "password_hash", "token", "secret", "private_key", "session", "cookie",
  "reviewer_subject", "reviewed_by_subject", "approved_by_subject", "created_by_subject",
  "updated_by_subject", "authorized_by", "executed_by", "original_filename"
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && /^[A-Za-z]:\\/u.test(value)) return "[redacted-local-path]";
    return value;
  }
  const output: JsonRow = {};
  for (const [key, child] of Object.entries(value)) {
    if (excludedOperationalKeys.has(key.toLowerCase()) || /(?:password|secret|token|private.?key|session|cookie|credential|oauth|authorization.?code|reviewer.?subject|authorized.?by|executed.?by|created.?by.?subject|updated.?by.?subject|approved.?by.?subject|reviewed.?by.?subject|actor.?subject|admin.?subject|original.?filename)/iu.test(key)) continue;
    output[key] = sanitize(child);
  }
  return output;
}

async function projectedRows(client: PoolClient, sql: string): Promise<JsonRow[]> {
  const result = await client.query<{ row: JsonRow }>(sql);
  return result.rows.map(({ row }) => sanitize(row) as JsonRow);
}

async function verifySource(client: PoolClient): Promise<void> {
  const result = await client.query<{ database_name: string; server_16: boolean; loopback: boolean; port_5432: boolean; read_only: boolean }>(`SELECT
    current_database() AS database_name,
    current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
    inet_server_addr() = '127.0.0.1'::inet AS loopback,
    inet_server_port() = 5432 AS port_5432,
    current_setting('transaction_read_only') = 'on' AS read_only`);
  const row = result.rows[0];
  if (!row || row.database_name !== "savinggrace_sermons_test" || !row.server_16 || !row.loopback || !row.port_5432 || !row.read_only) {
    throw new Error("Project snapshot exporter refused the PostgreSQL source identity");
  }
}

async function readSnapshot(client: PoolClient): Promise<ProjectSermonSnapshot> {
  const speakers = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['image_asset_id'] AS row FROM speakers item ORDER BY item.id`);
  const series = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['image_asset_id'] AS row FROM series item ORDER BY item.id`);
  const bookClassifications = await projectedRows(client, `SELECT to_jsonb(item) AS row FROM book_classifications item ORDER BY item.id`);
  const sourceTaxonomyTerms = await projectedRows(client, `SELECT to_jsonb(item) AS row FROM source_taxonomy_terms item ORDER BY item.id`);
  const sermons = (await projectedRows(client, `SELECT (
      to_jsonb(item) - ARRAY[
        'featured_asset_id','transcript_search_document','question_answer_search_document',
        'summary_search_document','search_vector','created_by_subject','updated_by_subject',
        'summary_reviewed_by_subject','summary_approved_by_subject'
      ]
      || jsonb_build_object('summary_sha256', CASE WHEN item.summary IS NULL THEN NULL ELSE encode(digest(item.summary, 'sha256'), 'hex') END)
    ) AS row FROM sermons item ORDER BY item.service_date, item.id`));
  const sermonSeries = await projectedRows(client, `SELECT to_jsonb(item) AS row FROM sermon_series_map item ORDER BY item.sermon_id, item.display_order, item.series_id`);
  const sermonBooks = await projectedRows(client, `SELECT to_jsonb(item) AS row FROM sermon_book_classifications item ORDER BY item.sermon_id, item.display_order, item.book_classification_id`);
  const sermonSourceTerms = await projectedRows(client, `SELECT to_jsonb(item) AS row FROM sermon_source_terms item ORDER BY item.sermon_id, item.source_relationship_order, item.source_taxonomy_term_id`);
  const scriptureReferences = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['reviewer_subject'] AS row FROM scripture_references item ORDER BY item.sermon_id, item.display_order, item.id`);
  const media = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['thumbnail_asset_id'] AS row FROM sermon_media item ORDER BY item.sermon_id, item.display_order, item.id`);
  const extensions = await projectedRows(client, `SELECT to_jsonb(item) AS row FROM sermon_extensions item WHERE item.namespace = 'website.topical-classification' ORDER BY item.sermon_id, item.namespace`);
  const transcripts = await projectedRows(client, `SELECT (
      to_jsonb(item) - ARRAY['reviewed_by_subject','approved_by_subject']
      || jsonb_build_object('content_sha256', encode(digest(item.body_text, 'sha256'), 'hex'))
    ) AS row FROM sermon_transcripts item ORDER BY item.sermon_id`);
  const questionAnswers = await projectedRows(client, `SELECT (
      to_jsonb(item) - ARRAY['reviewed_by_subject','approved_by_subject']
      || jsonb_build_object('content_sha256', encode(digest(item.question_text || E'\\n' || item.answer_text, 'sha256'), 'hex'))
    ) AS row FROM sermon_question_answers item ORDER BY item.sermon_id, item.display_order, item.id`);
  const enrichmentSources = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['original_filename'] AS row FROM sermon_enrichment_sources item ORDER BY item.sermon_id`);
  const guidedReviews = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['created_by_subject','updated_by_subject'] AS row FROM sermon_enrichment_reviews item ORDER BY item.sermon_id`);
  const guidedReviewItems = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['created_by_subject','updated_by_subject'] AS row FROM sermon_enrichment_review_items item ORDER BY item.sermon_id, item.item_key`);
  const primaryPassageReviews = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['reviewed_by_subject'] AS row FROM sermon_primary_passage_reviews item ORDER BY item.sermon_id`);
  const aiContentReviews = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['reviewer_subject','original_content','current_content'] AS row FROM sermon_ai_content_reviews item ORDER BY item.sermon_id, item.artifact_key, item.reviewed_at, item.id`);
  const aiComponentReviews = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['reviewer_subject'] AS row FROM sermon_ai_component_reviews item ORDER BY item.sermon_id, item.component, item.reviewed_at, item.id`);
  const aiMetadataAssignments = await projectedRows(client, `SELECT to_jsonb(item) - ARRAY['reviewer_subject'] AS row FROM sermon_ai_metadata_assignments item ORDER BY item.sermon_id, item.component, item.created_at, item.id`);
  const restrictedAcceptances = await projectedRows(client, `
    SELECT jsonb_build_object('acceptance_scope', 'd158') || (to_jsonb(item) - ARRAY['authorized_by','executed_by']) AS row
      FROM sermon_restricted_acceptances item
    UNION ALL
    SELECT jsonb_build_object('acceptance_scope', 'd161') || (to_jsonb(item) - ARRAY['authorized_by','executed_by']) AS row
      FROM sermon_d161_restricted_acceptances item
    UNION ALL
    SELECT jsonb_build_object('acceptance_scope', 'd162') || (to_jsonb(item) - ARRAY['authorized_by','executed_by']) AS row
      FROM sermon_d162_restricted_acceptances item
    ORDER BY 1`);
  return validateProjectSermonSnapshot({
    schemaVersion: projectSermonSnapshotVersion,
    source: {
      databaseClass: "local-disposable-postgresql",
      snapshotIsolation: "repeatable-read-read-only",
      exportedAt: new Date().toISOString()
    },
    tables: {
      speakers, series, bookClassifications, sourceTaxonomyTerms, sermons, sermonSeries,
      sermonBooks, sermonSourceTerms, scriptureReferences, media, extensions, transcripts,
      questionAnswers, enrichmentSources, guidedReviews, guidedReviewItems,
      primaryPassageReviews, aiContentReviews, aiComponentReviews, aiMetadataAssignments,
      restrictedAcceptances
    }
  });
}

export async function exportProjectSermonSnapshot(): Promise<void> {
  assertReadOnlyLocalDatabase(sourceConnectionString);
  const pool = new Pool({
    host: "127.0.0.1", port: 5432, database: "savinggrace_sermons_test",
    user: protectedLocalPostgresUser, password: protectedLocalPostgresPassword,
    max: 1, application_name: "saving-grace-project-sermon-snapshot-export",
    options: "-c default_transaction_read_only=on"
  });
  const client = await pool.connect();
  let snapshot: ProjectSermonSnapshot;
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await verifySource(client);
    snapshot = await readSnapshot(client);
    await client.query("ROLLBACK");
  } finally {
    client.release();
    await pool.end();
  }
  const content = serializeProjectSnapshot(snapshot);
  const manifest: ProjectSermonSnapshotManifest = {
    schemaVersion: projectSermonSnapshotVersion,
    contentFile: "sermons.json",
    contentSha256: sha256(content),
    counts: snapshotCounts(snapshot),
    ...deriveProjectSnapshotHashes(snapshot),
    operationalDataExcluded: [
      "accounts", "sessions", "credentials", "oauth material", "raw caption exports",
      "administrator subjects", "audit events", "local filenames", "search-vector derivatives"
    ],
    importMode: "private-development-projection"
  };
  await mkdir(projectSermonSnapshotDirectory, { recursive: true });
  await writeFile(projectSermonSnapshotContentPath, content, { encoding: "utf8", flag: "w" });
  await writeFile(projectSermonSnapshotManifestPath, serializeProjectSnapshot(manifest), { encoding: "utf8", flag: "w" });
  process.stdout.write(`${JSON.stringify({ outcome: "exported", counts: manifest.counts, contentSha256: manifest.contentSha256 })}\n`);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/gu, "/")}`) {
  exportProjectSermonSnapshot().catch((error: unknown) => {
    process.stderr.write(`Project sermon snapshot export failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}

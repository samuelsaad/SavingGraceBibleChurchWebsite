import type { Pool, PoolClient } from "pg";
import {loadSermonAudioPortableDataset,validatePortableSermonAudioProjection} from './sermonaudio-portable-dataset';
import {completedSchemaMigrations} from '../staging/completed-schema';
import {validateCompletedIds} from '../domain/completed-staging';
import { assertDisposableIntegrationTestDatabase } from "../migration/local-database-safety";
import { loadSchemaMigrations, validateSchemaMigrationJournal, type SchemaMigrationJournalRow } from "../migration/schema-migrations";
import { frontendSermonEligibilitySql } from "../server/queries/public-sermons";
import {
  loadTrackedProjectSermonSnapshot,
  projectSermonSnapshotSourceStatus,
  projectSermonSnapshotSyntheticSubject,
  sha256,
  type JsonRow,
  type ProjectSermonSnapshot,
  type ProjectSermonSnapshotManifest
} from "./project-sermon-snapshot";

export interface ProjectSnapshotImportOptions {
  connectionString: string;
  writeOptIn?: string;
  testRunToken?: string;
  datasetKind?: 'sermonaudio119';
}

/** D-171's Git export is display data, not portable administrator authority.
 * Only the fresh disposable development projection is demoted; source records
 * and the actual staging synchronization preserve every original decision. */
export function completedDevelopmentProjection(snapshot: ProjectSermonSnapshot): ProjectSermonSnapshot {
  validateCompletedIds(snapshot.tables.sermons.map(r=>r.id));
  const copy=structuredClone(snapshot);
  for(const r of copy.tables.sermons)Object.assign(r,{summary_status:'draft',summary_reviewed_at:null,summary_approved_at:null});
  for(const r of [...copy.tables.transcripts,...copy.tables.questionAnswers])Object.assign(r,{status:'draft',reviewed_at:null,approved_at:null});
  for(const r of copy.tables.scriptureReferences)Object.assign(r,{review_status:r.review_status==='confirmed'?'unreviewed':r.review_status,reviewed_at:null});
  for(const k of ['guidedReviews','guidedReviewItems','primaryPassageReviews','aiContentReviews','aiComponentReviews','aiMetadataAssignments','restrictedAcceptances'] as const)if(copy.tables[k].length)throw new Error('d171_export_contains_review_authority');
  return copy;
}

const tableColumns = {
  speakers: ["id", "name", "slug", "biography", "source_term_id", "source_term_taxonomy_id", "created_at", "updated_at", "row_version"],
  series: ["id", "name", "slug", "description", "source_term_id", "source_term_taxonomy_id", "created_at", "updated_at", "row_version"],
  book_classifications: ["id", "name", "slug", "canonical_book_id", "classification_type", "review_status", "source_term_id", "source_term_taxonomy_id", "created_at", "updated_at", "row_version"],
  source_taxonomy_terms: ["id", "source_system", "taxonomy", "source_term_id", "source_term_taxonomy_id", "name", "slug", "description", "source_parent_id", "source_order", "source_stored_count", "created_at", "updated_at"],
  sermon_series_map: ["sermon_id", "series_id", "display_order", "is_primary", "created_at"],
  sermon_book_classifications: ["sermon_id", "book_classification_id", "display_order", "created_at"],
  sermon_source_terms: ["sermon_id", "source_taxonomy_term_id", "source_relationship_order", "created_at"],
  scripture_references: ["id", "sermon_id", "display_text", "canonical_book_id", "start_chapter", "start_verse", "end_chapter", "end_verse", "display_order", "parse_status", "created_at", "updated_at", "relationship_role", "is_lead", "original_reference_text", "provenance", "review_status", "reviewer_subject", "reviewed_at", "parser_version", "row_version"],
  sermon_media: ["id", "sermon_id", "media_type", "provider", "external_id", "canonical_url", "title", "duration_seconds", "is_primary", "display_order", "availability_status", "created_at", "updated_at"],
  sermon_extensions: ["sermon_id", "namespace", "schema_version", "payload", "created_at", "updated_at"]
} as const;

function picked(row: JsonRow, columns: readonly string[]): JsonRow {
  return Object.fromEntries(columns.filter((key) => key in row).map((key) => [key, row[key]]));
}

async function insertRow(client: PoolClient, table: keyof typeof tableColumns, input: JsonRow): Promise<void> {
  const row = picked(input, tableColumns[table]);
  const columns = Object.keys(row);
  if (columns.length === 0) throw new Error(`No importable columns for ${table}`);
  const quoted = columns.map((column) => `"${column}"`).join(", ");
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
  await client.query(`INSERT INTO ${table} (${quoted}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, columns.map((column) => row[column]));
}

async function verifyTarget(client: PoolClient, expectedDatabase: string): Promise<void> {
  const identity = await client.query<{ server_16: boolean; loopback: boolean; port_5432: boolean; target_database: boolean }>(`SELECT
    current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
    inet_server_addr() = '127.0.0.1'::inet AS loopback,
    inet_server_port() = 5432 AS port_5432,
    current_database() = $1 AS target_database`, [expectedDatabase]);
  if (!Object.values(identity.rows[0] ?? {}).every(Boolean)) throw new Error("Project snapshot importer refused the PostgreSQL target identity");
  const journal = await client.query<SchemaMigrationJournalRow>("SELECT migration_order, migration_id, checksum_sha256, applied_at FROM schema_migrations ORDER BY migration_order");
  const migrations = journal.rows.length === 25 ? await completedSchemaMigrations() : await loadSchemaMigrations();
  if (validateSchemaMigrationJournal(migrations, journal.rows) !== migrations.length) throw new Error("Project snapshot importer requires every current schema migration");
}

function lifecycleSubject(status: unknown): string | null {
  return status === "approved" || status === "in_review" ? projectSermonSnapshotSyntheticSubject : null;
}

async function insertSermons(client: PoolClient, snapshot: ProjectSermonSnapshot): Promise<void> {
  for (const row of snapshot.tables.sermons) {
    const summaryStatus = String(row.summary_status ?? "draft");
    const reviewedSubject = lifecycleSubject(summaryStatus);
    await client.query(`INSERT INTO sermons (
      id, title, slug, summary, body, status, service_date, published_at, scheduled_for,
      source_wordpress_id, source_status, source_created_local, source_created_gmt,
      source_modified_local, source_modified_gmt, search_terms, deleted_at, created_at,
      updated_at, speaker_id, historical_backfill_required, summary_status,
      summary_source_kind, summary_source_reference, summary_created_at, summary_updated_at,
      summary_reviewed_by_subject, summary_approved_by_subject, summary_reviewed_at,
      summary_approved_at, seo_description
    ) VALUES (
      $1,$2,$3,$4,$5,'draft',$6,NULL,NULL,$7,$8,$9,$10,$11,$12,$13,NULL,$14,$15,$16,$17,
      $18,$19,$20,$21,$22,$23,$24,$25,$26,$27
    )`, [
      row.id, row.title, row.slug, row.summary ?? null, row.body ?? null, row.service_date,
      row.source_wordpress_id ?? null, projectSermonSnapshotSourceStatus,
      row.source_created_local ?? null, row.source_created_gmt ?? null,
      row.source_modified_local ?? null, row.source_modified_gmt ?? null,
      row.search_terms ?? "", row.created_at, row.updated_at, row.speaker_id ?? null,
      row.historical_backfill_required ?? false, summaryStatus, row.summary_source_kind ?? "imported",
      row.summary_source_reference ?? null, row.summary_created_at ?? null,
      row.summary_updated_at ?? null, reviewedSubject,
      summaryStatus === "approved" ? reviewedSubject : null,
      row.summary_reviewed_at ?? null, row.summary_approved_at ?? null, row.seo_description ?? null
    ]);
  }
}

async function insertTranscripts(client: PoolClient, rows: JsonRow[]): Promise<void> {
  for (const row of rows) {
    const status = String(row.status ?? "draft");
    const subject = lifecycleSubject(status);
    await client.query(`INSERT INTO sermon_transcripts (
      sermon_id, body_text, status, source_kind, source_reference, reviewed_by_subject,
      approved_by_subject, created_at, updated_at, reviewed_at, approved_at, grounding_revision_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [
      row.sermon_id, row.body_text, status, row.source_kind ?? "imported", row.source_reference ?? null,
      subject, status === "approved" ? subject : null, row.created_at, row.updated_at,
      row.reviewed_at ?? null, row.approved_at ?? null, row.grounding_revision_id
    ]);
  }
}

async function insertQuestionAnswers(client: PoolClient, rows: JsonRow[]): Promise<void> {
  for (const row of rows) {
    const status = String(row.status ?? "draft");
    const subject = lifecycleSubject(status);
    await client.query(`INSERT INTO sermon_question_answers (
      id, sermon_id, question_text, answer_text, display_order, status, source_kind,
      source_reference, reviewed_by_subject, approved_by_subject, created_at, updated_at,
      reviewed_at, approved_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [
      row.id, row.sermon_id, row.question_text, row.answer_text, row.display_order, status,
      row.source_kind ?? "imported", row.source_reference ?? null, subject,
      status === "approved" ? subject : null, row.created_at, row.updated_at,
      row.reviewed_at ?? null, row.approved_at ?? null
    ]);
  }
}

async function insertPrimaryPassageReviews(client: PoolClient, rows: JsonRow[]): Promise<void> {
  for (const row of rows) {
    const reviewed = row.review_status === "confirmed_passage" || row.review_status === "confirmed_none";
    await client.query(`INSERT INTO sermon_primary_passage_reviews (
      sermon_id, proposal_outcome, evidence_source, evidence_sha256, parser_version,
      review_status, reviewed_by_subject, reviewed_at, proposed_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
      row.sermon_id, row.proposal_outcome, row.evidence_source, row.evidence_sha256,
      row.parser_version, row.review_status, reviewed ? projectSermonSnapshotSyntheticSubject : null,
      row.reviewed_at ?? null, row.proposed_at, row.updated_at
    ]);
  }
}

async function importRows(client: PoolClient, snapshot: ProjectSermonSnapshot): Promise<void> {
  for (const row of snapshot.tables.speakers) await insertRow(client, "speakers", row);
  for (const row of snapshot.tables.series) await insertRow(client, "series", row);
  for (const row of snapshot.tables.bookClassifications) await insertRow(client, "book_classifications", row);
  for (const row of snapshot.tables.sourceTaxonomyTerms) await insertRow(client, "source_taxonomy_terms", row);
  await insertSermons(client, snapshot);
  for (const row of snapshot.tables.sermonSeries) await insertRow(client, "sermon_series_map", row);
  for (const row of snapshot.tables.sermonBooks) await insertRow(client, "sermon_book_classifications", row);
  for (const row of snapshot.tables.sermonSourceTerms) await insertRow(client, "sermon_source_terms", row);
  for (const raw of snapshot.tables.scriptureReferences) {
    const row = { ...raw, reviewer_subject: raw.review_status === "confirmed" ? projectSermonSnapshotSyntheticSubject : null };
    await insertRow(client, "scripture_references", row);
    if (raw.review_status === "confirmed") {
      await client.query("UPDATE scripture_references SET reviewer_subject = $2 WHERE id = $1", [raw.id, projectSermonSnapshotSyntheticSubject]);
    }
  }
  for (const row of snapshot.tables.media) await insertRow(client, "sermon_media", row);
  for (const row of snapshot.tables.extensions) await insertRow(client, "sermon_extensions", row);
  await insertTranscripts(client, snapshot.tables.transcripts);
  await insertQuestionAnswers(client, snapshot.tables.questionAnswers);
  await insertPrimaryPassageReviews(client, snapshot.tables.primaryPassageReviews);
  for (const sermon of snapshot.tables.sermons) await client.query("SELECT refresh_sermon_enrichment($1)", [sermon.id]);
}

async function verifyImported(client: PoolClient, snapshot: ProjectSermonSnapshot) {
  const ids = snapshot.tables.sermons.map((row) => String(row.id));
  const counts = await client.query<{ sermons: number; transcripts: number; question_answers: number; restricted_acceptances: number; ai_reviews: number; guided_reviews: number; public_eligible: number; preview_eligible: number; semantic_eligible: number }>(`SELECT
    (SELECT count(*)::integer FROM sermons WHERE id = ANY($1::uuid[])) AS sermons,
    (SELECT count(*)::integer FROM sermon_transcripts WHERE sermon_id = ANY($1::uuid[])) AS transcripts,
    (SELECT count(*)::integer FROM sermon_question_answers WHERE sermon_id = ANY($1::uuid[])) AS question_answers,
    ((SELECT count(*) FROM sermon_restricted_acceptances WHERE sermon_id = ANY($1::uuid[])) +
     (SELECT count(*) FROM sermon_d161_restricted_acceptances WHERE sermon_id = ANY($1::uuid[])) +
     (SELECT count(*) FROM sermon_d162_restricted_acceptances WHERE sermon_id = ANY($1::uuid[])))::integer AS restricted_acceptances,
    ((SELECT count(*) FROM sermon_ai_content_reviews WHERE sermon_id = ANY($1::uuid[])) +
     (SELECT count(*) FROM sermon_ai_component_reviews WHERE sermon_id = ANY($1::uuid[])))::integer AS ai_reviews,
    (SELECT count(*)::integer FROM sermon_enrichment_reviews WHERE sermon_id = ANY($1::uuid[])) AS guided_reviews,
    (SELECT count(*)::integer FROM sermons s WHERE s.id = ANY($1::uuid[]) AND ${frontendSermonEligibilitySql("s", "public")}) AS public_eligible,
    (SELECT count(*)::integer FROM sermons s WHERE s.id = ANY($1::uuid[]) AND ${frontendSermonEligibilitySql("s", "completed_preview")}) AS preview_eligible,
    (SELECT count(*)::integer FROM sermon_description_semantic_eligibility WHERE sermon_id = ANY($1::uuid[])) AS semantic_eligible`, [ids]);
  const row = counts.rows[0];
  if (!row || row.sermons !== ids.length || row.transcripts !== snapshot.tables.transcripts.length ||
      row.question_answers !== snapshot.tables.questionAnswers.length || row.restricted_acceptances !== 0 ||
      row.ai_reviews !== 0 || row.guided_reviews !== 0 || row.public_eligible !== 0 ||
      row.preview_eligible !== 0 || row.semantic_eligible !== 0) {
    throw new Error("Imported project snapshot failed its scope or privacy verification");
  }
  const content = await client.query<{ transcript_hash: string; qa_hash: string }>(`SELECT
    encode(digest(string_agg(encode(digest(body_text, 'sha256'), 'hex'), E'\\n' ORDER BY sermon_id), 'sha256'), 'hex') AS transcript_hash,
    (SELECT encode(digest(string_agg(encode(digest(question_text || E'\\n' || answer_text, 'sha256'), 'hex'), E'\\n' ORDER BY sermon_id, display_order, id), 'sha256'), 'hex')
     FROM sermon_question_answers WHERE sermon_id = ANY($1::uuid[])) AS qa_hash
    FROM sermon_transcripts WHERE sermon_id = ANY($1::uuid[])`, [ids]);
  const expectedTranscript = sha256(snapshot.tables.transcripts.map((item) => String(item.content_sha256)).join("\n"));
  const expectedQa = sha256(snapshot.tables.questionAnswers.map((item) => String(item.content_sha256)).join("\n"));
  if (content.rows[0]?.transcript_hash !== expectedTranscript || content.rows[0]?.qa_hash !== expectedQa) {
    throw new Error("Imported project snapshot content hashes do not match the tracked snapshot");
  }
  return row;
}

export async function importTrackedProjectSermonSnapshot(pool: Pool, options: ProjectSnapshotImportOptions) {
  if (!options.testRunToken) throw new Error("Project snapshot import is restricted to guarded disposable PostgreSQL databases");
  assertDisposableIntegrationTestDatabase(options.connectionString,options.testRunToken,options.writeOptIn);
  const tracked = options.datasetKind==='sermonaudio119' ? await loadSermonAudioPortableDataset() : await loadTrackedProjectSermonSnapshot();
  return importProjectSnapshotProjection(pool,options,tracked);
}

/** Shared transport for verified display data and anonymized integration
 * fixtures. Every caller is restricted to an authorized disposable database;
 * the tracked D-175 loader independently enforces the exact 119-source scope. */
export async function importProjectSnapshotProjection(pool:Pool,options:ProjectSnapshotImportOptions,tracked:{snapshot:ProjectSermonSnapshot;manifest:ProjectSermonSnapshotManifest;contentSha256:string;manifestSha256:string}) {
  if (!options.testRunToken) throw new Error("Project snapshot import is restricted to guarded disposable PostgreSQL databases");
  const expectedDatabase = assertDisposableIntegrationTestDatabase(options.connectionString, options.testRunToken, options.writeOptIn);
  if(options.datasetKind==='sermonaudio119')validatePortableSermonAudioProjection(tracked.snapshot,tracked.snapshot.tables.sermons.map(r=>Number(r.source_wordpress_id)));
  const client = await pool.connect();
  let outcome: "imported" | "unchanged" = "unchanged";
  try {
    await client.query("BEGIN");
    await verifyTarget(client, expectedDatabase);
    await client.query("SELECT pg_advisory_xact_lock($1)", [1_397_047_178]);
    const ids = tracked.snapshot.tables.sermons.map((row) => String(row.id));
    const existing = await client.query<{ id: string }>("SELECT id FROM sermons WHERE id = ANY($1::uuid[]) ORDER BY id", [ids]);
    if (existing.rows.length !== 0 && existing.rows.length !== ids.length) throw new Error("Project snapshot importer refused a partial existing dataset");
    if (existing.rows.length === 0) {
      const displayOnly=(tracked.manifest as {decision?:string}).decision==='D-171';
      await importRows(client, displayOnly?completedDevelopmentProjection(tracked.snapshot):tracked.snapshot);
      outcome = "imported";
    }
    const state = await verifyImported(client, tracked.snapshot);
    await client.query("COMMIT");
    return { outcome, sermons: ids.length, transcripts: state.transcripts, questionAnswers: state.question_answers, publicEligible: state.public_eligible, previewEligible: state.preview_eligible, semanticEligible: state.semantic_eligible, contentSha256: tracked.contentSha256, manifestSha256: tracked.manifestSha256 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

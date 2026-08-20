import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lstat, mkdir, open, readFile } from "node:fs/promises";
import type { Pool, PoolClient } from "pg";
import {
  biblePassageParserVersion,
  extractPrimaryPassageFromTitle,
  type TitlePassageExtraction
} from "../domain/bible-passage";

export const primaryPassagePreparationVersion = "phase3b2c-current15-primary-passage-v1" as const;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const primaryPassagePrivateArtifactPath = join(
  repositoryRoot,
  "private",
  "primary-passages",
  "current-15.private.json"
);

const scopedVersions = [
  "phase3b2-caption-v1",
  "phase3b2b-punctuation-v2",
  "phase3b2c-wave1-extractive-drafts-v2"
] as const;
const expectedCounts = new Map<string, number>([
  [scopedVersions[0], 1],
  [scopedVersions[1], 2],
  [scopedVersions[2], 12]
]);

interface ScopedSermonRow {
  id: string;
  title: string;
  processing_version: string;
}

interface ReviewRow {
  proposal_outcome: "proposed" | "no_reference" | "manual_review_required" | "administrator_entered";
  evidence_sha256: string;
  parser_version: string;
  review_status: "pending" | "confirmed_passage" | "confirmed_none" | "rejected";
}

interface PrivatePreparationRecord {
  sermonId: string;
  processingVersion: string;
  sourceTitle: string;
  evidenceSha256: string;
  extraction: TitlePassageExtraction;
}

interface PrivatePreparationArtifact {
  schemaVersion: 1;
  privateContent: true;
  preparationVersion: typeof primaryPassagePreparationVersion;
  parserVersion: typeof biblePassageParserVersion;
  preparedAt: string;
  records: PrivatePreparationRecord[];
  integrity: { recordSetSha256: string };
}

export interface PrimaryPassagePreparationResult {
  outcome: "primary_passage_proposals_prepared";
  scopedRecords: 15;
  pilotRecords: 3;
  waveOneRecords: 12;
  proposedReferences: number;
  noReference: number;
  manualReviewRequired: number;
  createdReviewRecords: number;
  preservedReviewRecords: number;
  privateArtifact: "created" | "unchanged";
  privateArtifactSha256: string;
  administratorDecisionsCreated: 0;
  sermonContentChanged: false;
  publiclySearchableProposals: 0;
}

export class PrimaryPassagePreparationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "PrimaryPassagePreparationError";
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableRecordSet(records: readonly PrivatePreparationRecord[]): string {
  return JSON.stringify(records.map((record) => ({
    ...record,
    extraction: record.extraction.outcome === "one_valid_reference"
      ? { outcome: record.extraction.outcome, passage: record.extraction.passage }
      : record.extraction
  })));
}

async function persistPrivateArtifact(
  records: PrivatePreparationRecord[]
): Promise<{ outcome: "created" | "unchanged"; bytesSha256: string }> {
  const integrity = { recordSetSha256: sha256(stableRecordSet(records)) };
  const artifact: PrivatePreparationArtifact = {
    schemaVersion: 1,
    privateContent: true,
    preparationVersion: primaryPassagePreparationVersion,
    parserVersion: biblePassageParserVersion,
    preparedAt: new Date().toISOString(),
    records,
    integrity
  };
  const privateRoot = join(repositoryRoot, "private");
  const artifactRoot = dirname(primaryPassagePrivateArtifactPath);
  await mkdir(artifactRoot, { recursive: true, mode: 0o700 });
  for (const directory of [privateRoot, artifactRoot]) {
    const state = await lstat(directory);
    if (!state.isDirectory() || state.isSymbolicLink()) {
      throw new PrimaryPassagePreparationError("private_directory_invalid", "Private passage evidence directory is not a safe local directory");
    }
  }
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  try {
    const handle = await open(primaryPassagePrivateArtifactPath, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return { outcome: "created", bytesSha256: sha256(bytes) };
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    const file = await lstat(primaryPassagePrivateArtifactPath);
    if (!file.isFile() || file.isSymbolicLink()) {
      throw new PrimaryPassagePreparationError("private_artifact_invalid", "Private preparation evidence is not a regular file");
    }
    const existingBytes = await readFile(primaryPassagePrivateArtifactPath);
    const existing = JSON.parse(existingBytes.toString("utf8")) as PrivatePreparationArtifact;
    if (existing.schemaVersion !== 1 || existing.privateContent !== true ||
      existing.preparationVersion !== primaryPassagePreparationVersion ||
      existing.parserVersion !== biblePassageParserVersion ||
      existing.integrity?.recordSetSha256 !== integrity.recordSetSha256 ||
      sha256(stableRecordSet(existing.records)) !== integrity.recordSetSha256) {
      throw new PrimaryPassagePreparationError("private_artifact_conflict", "Existing private passage evidence differs from the current bounded scope");
    }
    return { outcome: "unchanged", bytesSha256: sha256(existingBytes) };
  }
}

async function verifyTarget(client: PoolClient): Promise<void> {
  const result = await client.query<{
    database_ok: boolean;
    version_ok: boolean;
    migration_count: number;
    migration_max_order: number;
    migration_0014: number;
    later_migrations: number;
  }>(`SELECT
       current_database() = 'savinggrace_sermons_test' AS database_ok,
       current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS version_ok,
       (SELECT count(*)::integer FROM schema_migrations) AS migration_count,
       (SELECT COALESCE(max(migration_order), 0)::integer FROM schema_migrations) AS migration_max_order,
       (SELECT count(*)::integer FROM schema_migrations WHERE migration_id = '0014_primary_preaching_passages') AS migration_0014,
       (SELECT count(*)::integer FROM schema_migrations WHERE migration_order > 14) AS later_migrations`);
  const row = result.rows[0];
  if (!row?.database_ok || !row.version_ok || row.migration_count !== 14 || row.migration_max_order !== 14 ||
    row.migration_0014 !== 1 || row.later_migrations !== 0) {
    throw new PrimaryPassagePreparationError("postgres_target_mismatch", "Local PostgreSQL identity or migration checkpoint did not match exactly through 0014");
  }
}

async function readScopedSermons(client: PoolClient): Promise<ScopedSermonRow[]> {
  const result = await client.query<ScopedSermonRow>(
    `SELECT sermon.id, sermon.title, source.processing_version
     FROM sermons sermon
     JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
     WHERE source.processing_version = ANY($1::text[])
     ORDER BY source.processing_version, sermon.id
     FOR SHARE OF sermon, source`,
    [[...scopedVersions]]
  );
  if (result.rowCount !== 15 || new Set(result.rows.map((row) => row.id)).size !== 15 ||
    result.rows.some((row) => !row.title.trim())) {
    throw new PrimaryPassagePreparationError("current_15_scope_mismatch", "The exact three-pilot and twelve-Wave-1 scope was not present with one local title each");
  }
  for (const [version, expected] of expectedCounts) {
    if (result.rows.filter((row) => row.processing_version === version).length !== expected) {
      throw new PrimaryPassagePreparationError("current_15_scope_mismatch", "The exact pilot and Wave 1 processing-version counts did not match");
    }
  }
  return result.rows;
}

function reviewOutcome(extraction: TitlePassageExtraction): ReviewRow["proposal_outcome"] {
  return extraction.outcome === "one_valid_reference" ? "proposed" : extraction.outcome;
}

async function verifyExistingProposal(
  client: PoolClient,
  record: PrivatePreparationRecord,
  review: ReviewRow
): Promise<void> {
  if (review.evidence_sha256 !== record.evidenceSha256 || review.parser_version !== biblePassageParserVersion ||
    review.proposal_outcome !== reviewOutcome(record.extraction)) {
    throw new PrimaryPassagePreparationError("existing_review_conflict", "Existing passage review provenance differs; no state was changed");
  }
  if (review.review_status !== "pending") return;
  const proposal = await client.query<{
    canonical_book_id: number;
    start_chapter: number;
    start_verse: number | null;
    end_chapter: number;
    end_verse: number | null;
  }>(`SELECT canonical_book_id, start_chapter, start_verse, end_chapter, end_verse
      FROM scripture_references
      WHERE sermon_id = $1 AND provenance = 'title_proposal' AND review_status = 'proposed'`, [record.sermonId]);
  if (record.extraction.outcome !== "one_valid_reference") {
    if (proposal.rowCount !== 0) throw new PrimaryPassagePreparationError("existing_proposal_conflict", "Unexpected title proposal exists for a no-proposal outcome");
    return;
  }
  const row = proposal.rows[0];
  const expected = record.extraction.passage;
  if (proposal.rowCount !== 1 || !row || row.canonical_book_id !== expected.canonicalBookId ||
    row.start_chapter !== expected.startChapter || row.start_verse !== expected.startVerse ||
    row.end_chapter !== expected.endChapter || row.end_verse !== expected.endVerse) {
    throw new PrimaryPassagePreparationError("existing_proposal_conflict", "Existing title proposal coordinates differ; no state was changed");
  }
}

async function insertProposal(client: PoolClient, record: PrivatePreparationRecord): Promise<void> {
  const outcome = reviewOutcome(record.extraction);
  await client.query(
    `INSERT INTO sermon_primary_passage_reviews (
       sermon_id, proposal_outcome, evidence_source, evidence_sha256, parser_version
     ) VALUES ($1, $2, 'local_youtube_title', $3, $4)`,
    [record.sermonId, outcome, record.evidenceSha256, biblePassageParserVersion]
  );
  if (record.extraction.outcome === "one_valid_reference") {
    const passage = record.extraction.passage;
    const inserted = await client.query<{ id: string }>(
    `INSERT INTO scripture_references (
       sermon_id, display_text, canonical_book_id, start_chapter, start_verse,
       end_chapter, end_verse, display_order, parse_status, relationship_role,
       is_lead, original_reference_text, provenance, review_status, parser_version
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       (SELECT COALESCE(max(display_order), -1) + 1 FROM scripture_references WHERE sermon_id = $1),
       'exact', 'primary', true, $8, 'title_proposal', 'proposed', $9
     ) RETURNING id`,
    [
      record.sermonId,
      passage.displayText,
      passage.canonicalBookId,
      passage.startChapter,
      passage.startVerse,
      passage.endChapter,
      passage.endVerse,
      passage.originalReferenceText,
      biblePassageParserVersion
    ]
    );
    await client.query(
      `INSERT INTO scripture_reference_sources (
         scripture_reference_id, sermon_id, source_kind, original_value
       ) VALUES ($1, $2, 'curated', $3)`,
      [inserted.rows[0]!.id, record.sermonId, passage.originalReferenceText]
    );
  }
  await client.query(
    `INSERT INTO audit_events (
       actor_subject, actor_role, action, entity_type, entity_id, changed_fields,
       request_correlation_id, outcome
     ) VALUES (
       'local-primary-passage-preparer', 'system', $2, 'sermon', $1,
       '["primaryPassageReview","scriptureReferences"]'::jsonb, $3, 'succeeded'
     )`,
    [
      record.sermonId,
      record.extraction.outcome === "one_valid_reference"
        ? "sermon.primary_passage_title_proposal_prepared"
        : "sermon.primary_passage_manual_review_prepared",
      `${primaryPassagePreparationVersion}:${record.sermonId}`
    ]
  );
}

export async function prepareCurrent15PrimaryPassages(pool: Pool): Promise<PrimaryPassagePreparationResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await verifyTarget(client);
    await client.query("SELECT pg_advisory_xact_lock($1::integer, $2::integer)", [1_397_176_899, 1_397_112_014]);
    const scoped = await readScopedSermons(client);
    const records: PrivatePreparationRecord[] = scoped.map((row) => ({
      sermonId: row.id,
      processingVersion: row.processing_version,
      sourceTitle: row.title,
      evidenceSha256: sha256(row.title),
      extraction: extractPrimaryPassageFromTitle(row.title)
    }));
    const artifact = await persistPrivateArtifact(records);
    let createdReviewRecords = 0;
    let preservedReviewRecords = 0;
    for (const record of records) {
      const current = await client.query<ReviewRow>(
        `SELECT proposal_outcome, evidence_sha256, parser_version, review_status
         FROM sermon_primary_passage_reviews WHERE sermon_id = $1 FOR UPDATE`,
        [record.sermonId]
      );
      if (current.rowCount === 1) {
        await verifyExistingProposal(client, record, current.rows[0]!);
        preservedReviewRecords += 1;
      } else if (current.rowCount === 0) {
        await insertProposal(client, record);
        createdReviewRecords += 1;
      } else {
        throw new PrimaryPassagePreparationError("existing_review_conflict", "Multiple review records exist for a scoped sermon");
      }
    }
    await client.query("COMMIT");
    return {
      outcome: "primary_passage_proposals_prepared",
      scopedRecords: 15,
      pilotRecords: 3,
      waveOneRecords: 12,
      proposedReferences: records.filter((record) => record.extraction.outcome === "one_valid_reference").length,
      noReference: records.filter((record) => record.extraction.outcome === "no_reference").length,
      manualReviewRequired: records.filter((record) => record.extraction.outcome === "manual_review_required").length,
      createdReviewRecords,
      preservedReviewRecords,
      privateArtifact: artifact.outcome,
      privateArtifactSha256: artifact.bytesSha256,
      administratorDecisionsCreated: 0,
      sermonContentChanged: false,
      publiclySearchableProposals: 0
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function anonymisedPreparationFixture(titles: readonly string[]): Array<{
  evidenceSha256: string;
  extraction: TitlePassageExtraction;
}> {
  return titles.map((title) => ({ evidenceSha256: sha256(title), extraction: extractPrimaryPassageFromTitle(title) }));
}

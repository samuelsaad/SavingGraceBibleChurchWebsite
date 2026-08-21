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
import {
  exactWaveOneVideoAllowlist,
  verifyPrivateOfficialTitleArtifact,
  type WaveOneRetrievalIdentity
} from "../youtube/wave1-title-proof";
import { wave1CaptionProcessingVersion } from "../youtube/wave1-caption-proof";

export const officialTitlePassageRepairVersion = "phase3b2c-current15-official-title-passage-repair-v1" as const;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const waveOneRoot = join(repositoryRoot, "private", "phase-3b2c-wave1");
const retrievalPath = join(waveOneRoot, "caption-retrieval.private.json");
const officialTitlePath = join(waveOneRoot, "official-youtube-titles.private.json");
export const officialTitlePassageRepairArtifactPath = join(
  repositoryRoot,
  "private",
  "primary-passages",
  "current-15-official-title-repair.private.json"
);

const pilotVersions = ["phase3b2-caption-v1", "phase3b2b-punctuation-v2"] as const;
const waveOneVersion = "phase3b2c-wave1-extractive-drafts-v2" as const;

interface PrivateRetrievalArtifact {
  schemaVersion: 1;
  privateContent: true;
  processingVersion: typeof wave1CaptionProcessingVersion;
  records: WaveOneRetrievalIdentity[];
  integrity: { recordSetSha256: string };
}

interface ScopedRow {
  id: string;
  title: string;
  processing_version: string;
  source_wordpress_id: string;
}

interface RepairRecord {
  sermonId: string;
  privateSourceId: string;
  videoId: string;
  sourceTitle: string;
  evidenceSha256: string;
  extraction: TitlePassageExtraction;
}

interface RepairArtifact {
  schemaVersion: 1;
  privateContent: true;
  repairVersion: typeof officialTitlePassageRepairVersion;
  parserVersion: typeof biblePassageParserVersion;
  preparedAt: string;
  records: RepairRecord[];
  integrity: { recordSetSha256: string };
}

interface ReviewRow {
  proposal_outcome: "proposed" | "no_reference" | "manual_review_required" | "administrator_entered";
  evidence_source: "local_youtube_title" | "administrator";
  evidence_sha256: string;
  parser_version: string;
  review_status: "pending" | "confirmed_passage" | "confirmed_none" | "rejected";
  reviewed_by_subject: string | null;
  reviewed_at: Date | null;
}

export interface OfficialTitlePassageRepairResult {
  outcome: "official_youtube_title_passage_repair_complete";
  scopedRecords: 15;
  preservedPilotRecords: 3;
  waveOneRecords: 12;
  proposedReferences: number;
  noReference: number;
  manualReviewRequired: number;
  repairedReviewRecords: number;
  preservedReviewRecords: number;
  privateArtifact: "created" | "unchanged";
  privateArtifactSha256: string;
  administratorDecisionsCreated: 0;
  confirmedPrimaryPassages: 0;
  sermonContentChanged: false;
  displayTitlesChanged: false;
  publiclySearchableProposals: 0;
}

export class OfficialTitlePassageRepairError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "OfficialTitlePassageRepairError";
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function loadPrivateJson(path: string): Promise<unknown> {
  const state = await lstat(path).catch(() => null);
  if (!state?.isFile() || state.isSymbolicLink()) {
    throw new OfficialTitlePassageRepairError("private_evidence_missing", "Required private official-title evidence is unavailable");
  }
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function stableRecords(records: readonly RepairRecord[]): string {
  return JSON.stringify(records.map((record) => ({
    ...record,
    extraction: record.extraction.outcome === "one_valid_reference"
      ? { outcome: record.extraction.outcome, passage: record.extraction.passage }
      : record.extraction
  })));
}

async function persistRepairArtifact(records: RepairRecord[]): Promise<{ outcome: "created" | "unchanged"; bytesSha256: string }> {
  const integrity = { recordSetSha256: sha256(stableRecords(records)) };
  const artifact: RepairArtifact = {
    schemaVersion: 1,
    privateContent: true,
    repairVersion: officialTitlePassageRepairVersion,
    parserVersion: biblePassageParserVersion,
    preparedAt: new Date().toISOString(),
    records,
    integrity
  };
  const root = dirname(officialTitlePassageRepairArtifactPath);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const rootState = await lstat(root);
  if (!rootState.isDirectory() || rootState.isSymbolicLink()) {
    throw new OfficialTitlePassageRepairError("private_directory_invalid", "Private passage repair storage is unsafe");
  }
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  try {
    const handle = await open(officialTitlePassageRepairArtifactPath, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return { outcome: "created", bytesSha256: sha256(bytes) };
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    const state = await lstat(officialTitlePassageRepairArtifactPath);
    if (!state.isFile() || state.isSymbolicLink()) {
      throw new OfficialTitlePassageRepairError("private_artifact_invalid", "Private passage repair evidence is unsafe");
    }
    const existingBytes = await readFile(officialTitlePassageRepairArtifactPath);
    const existing = JSON.parse(existingBytes.toString("utf8")) as RepairArtifact;
    if (existing.schemaVersion !== 1 || existing.privateContent !== true ||
      existing.repairVersion !== officialTitlePassageRepairVersion ||
      existing.parserVersion !== biblePassageParserVersion ||
      existing.integrity?.recordSetSha256 !== integrity.recordSetSha256 ||
      sha256(stableRecords(existing.records)) !== integrity.recordSetSha256) {
      throw new OfficialTitlePassageRepairError("private_artifact_conflict", "Existing private passage repair evidence differs");
    }
    return { outcome: "unchanged", bytesSha256: sha256(existingBytes) };
  }
}

async function loadVerifiedTitleMapping(): Promise<Map<string, { videoId: string; title: string }>> {
  const retrieval = await loadPrivateJson(retrievalPath) as PrivateRetrievalArtifact;
  if (retrieval.schemaVersion !== 1 || retrieval.privateContent !== true ||
    retrieval.processingVersion !== wave1CaptionProcessingVersion || !Array.isArray(retrieval.records) ||
    retrieval.integrity?.recordSetSha256 !== sha256(JSON.stringify(retrieval.records))) {
    throw new OfficialTitlePassageRepairError("private_retrieval_invalid", "Private Wave 1 retrieval evidence failed integrity verification");
  }
  let allowlist: string[];
  try {
    allowlist = exactWaveOneVideoAllowlist(retrieval.records);
  } catch {
    throw new OfficialTitlePassageRepairError("private_retrieval_scope_mismatch", "Private Wave 1 retrieval evidence did not preserve the exact scope");
  }
  let titles;
  try {
    titles = verifyPrivateOfficialTitleArtifact(await loadPrivateJson(officialTitlePath));
  } catch (error) {
    if (error instanceof OfficialTitlePassageRepairError) throw error;
    throw new OfficialTitlePassageRepairError("private_title_invalid", "Private official-title evidence failed integrity verification");
  }
  if (titles.records.some((record) => record.outcome !== "retrieved" || record.title === null) ||
    new Set(titles.records.map((record) => record.videoId)).size !== 12 ||
    allowlist.some((videoId) => !titles.records.some((record) => record.videoId === videoId))) {
    throw new OfficialTitlePassageRepairError("private_title_incomplete", "All 12 official source titles are required before passage repair");
  }
  const byVideo = new Map(titles.records.map((record) => [record.videoId, record]));
  const mapped = new Map<string, { videoId: string; title: string }>();
  for (const record of retrieval.records) {
    if (record.resolvedSourceId === null || !record.videoId || record.channelId !== titles.expectedChannelId) {
      throw new OfficialTitlePassageRepairError("private_title_scope_mismatch", "Official-title and Wave 1 provenance do not match");
    }
    const title = byVideo.get(record.videoId);
    if (!title?.title) throw new OfficialTitlePassageRepairError("private_title_scope_mismatch", "A Wave 1 source title is missing");
    mapped.set(String(record.resolvedSourceId), { videoId: record.videoId, title: title.title });
  }
  if (mapped.size !== 12) throw new OfficialTitlePassageRepairError("private_title_scope_mismatch", "The private source-title mapping is not exactly 12 records");
  return mapped;
}

async function verifyDatabaseTarget(client: PoolClient): Promise<void> {
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
    throw new OfficialTitlePassageRepairError("postgres_target_mismatch", "Local PostgreSQL identity or migration checkpoint changed");
  }
}

async function readExactScope(client: PoolClient): Promise<ScopedRow[]> {
  const versions = [...pilotVersions, waveOneVersion];
  const result = await client.query<ScopedRow>(
    `SELECT sermon.id, sermon.title, source.processing_version, sermon.source_wordpress_id::text
     FROM sermons sermon
     JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
     WHERE source.processing_version = ANY($1::text[])
     ORDER BY source.processing_version, sermon.id
     FOR SHARE OF sermon, source`,
    [versions]
  );
  if (result.rowCount !== 15 || new Set(result.rows.map((row) => row.id)).size !== 15 ||
    result.rows.filter((row) => pilotVersions.includes(row.processing_version as typeof pilotVersions[number])).length !== 3 ||
    result.rows.filter((row) => row.processing_version === waveOneVersion).length !== 12) {
    throw new OfficialTitlePassageRepairError("current_15_scope_mismatch", "The exact three-pilot and 12-Wave-1 scope changed");
  }
  return result.rows;
}

function proposalOutcome(extraction: TitlePassageExtraction): ReviewRow["proposal_outcome"] {
  return extraction.outcome === "one_valid_reference" ? "proposed" : extraction.outcome;
}

export function classifyOfficialTitleReviewRepair(input: {
  review: ReviewRow;
  auditCount: number;
  previousEvidenceSha256: string;
  expectedEvidenceSha256: string;
  expectedProposalOutcome: ReviewRow["proposal_outcome"];
}): "repair" | "preserve" | "conflict" {
  const { review } = input;
  if (review.review_status !== "pending" || review.reviewed_by_subject !== null || review.reviewed_at !== null ||
    review.evidence_source !== "local_youtube_title") {
    return "conflict";
  }
  if (input.auditCount === 1) {
    return review.evidence_sha256 === input.expectedEvidenceSha256 &&
      review.parser_version === biblePassageParserVersion &&
      review.proposal_outcome === input.expectedProposalOutcome
      ? "preserve"
      : "conflict";
  }
  if (input.auditCount === 0) {
    return review.proposal_outcome === "no_reference" &&
      review.evidence_sha256 === input.previousEvidenceSha256 &&
      review.parser_version === biblePassageParserVersion
      ? "repair"
      : "conflict";
  }
  return "conflict";
}

async function verifyProposal(client: PoolClient, record: RepairRecord): Promise<void> {
  const proposals = await client.query<{
    canonical_book_id: number;
    start_chapter: number;
    start_verse: number | null;
    end_chapter: number;
    end_verse: number | null;
  }>(`SELECT canonical_book_id, start_chapter, start_verse, end_chapter, end_verse
      FROM scripture_references
      WHERE sermon_id = $1 AND provenance = 'title_proposal' AND review_status = 'proposed'`, [record.sermonId]);
  if (record.extraction.outcome !== "one_valid_reference") {
    if (proposals.rowCount !== 0) throw new OfficialTitlePassageRepairError("existing_proposal_conflict", "Unexpected title proposal exists");
    return;
  }
  const row = proposals.rows[0];
  const passage = record.extraction.passage;
  if (proposals.rowCount !== 1 || !row || row.canonical_book_id !== passage.canonicalBookId ||
    row.start_chapter !== passage.startChapter || row.start_verse !== passage.startVerse ||
    row.end_chapter !== passage.endChapter || row.end_verse !== passage.endVerse) {
    throw new OfficialTitlePassageRepairError("existing_proposal_conflict", "Stored title proposal does not match verified official-title evidence");
  }
}

async function insertTitleProposal(client: PoolClient, record: RepairRecord): Promise<void> {
  if (record.extraction.outcome !== "one_valid_reference") return;
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
    [record.sermonId, passage.displayText, passage.canonicalBookId, passage.startChapter, passage.startVerse,
      passage.endChapter, passage.endVerse, passage.originalReferenceText, biblePassageParserVersion]
  );
  await client.query(
    `INSERT INTO scripture_reference_sources (scripture_reference_id, sermon_id, source_kind, original_value)
     VALUES ($1, $2, 'curated', $3)`,
    [inserted.rows[0]!.id, record.sermonId, passage.originalReferenceText]
  );
}

export async function repairCurrent15FromOfficialTitles(pool: Pool): Promise<OfficialTitlePassageRepairResult> {
  const titleBySource = await loadVerifiedTitleMapping();
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await verifyDatabaseTarget(client);
    await client.query("SELECT pg_advisory_xact_lock($1::integer, $2::integer)", [1_397_176_899, 1_397_112_014]);
    const scope = await readExactScope(client);
    const pilots = scope.filter((row) => row.processing_version !== waveOneVersion);
    const waveOne = scope.filter((row) => row.processing_version === waveOneVersion);
    const pilotState = await client.query<{ review_count: number; proposal_count: number; decided_count: number }>(
      `SELECT count(*)::integer AS review_count,
              count(*) FILTER (WHERE review.proposal_outcome = 'proposed')::integer AS proposal_count,
              count(*) FILTER (WHERE review.review_status <> 'pending')::integer AS decided_count
       FROM sermon_primary_passage_reviews review
       WHERE review.sermon_id = ANY($1::uuid[])`,
      [pilots.map((row) => row.id)]
    );
    const pilotProposals = await client.query<{ total: number }>(
      `SELECT count(*)::integer AS total FROM scripture_references
       WHERE sermon_id = ANY($1::uuid[]) AND provenance = 'title_proposal' AND review_status = 'proposed'`,
      [pilots.map((row) => row.id)]
    );
    if (pilotState.rows[0]?.review_count !== 3 || pilotState.rows[0]?.proposal_count !== 3 ||
      pilotState.rows[0]?.decided_count !== 0 || pilotProposals.rows[0]?.total !== 3) {
      throw new OfficialTitlePassageRepairError("pilot_proposal_state_mismatch", "The three pilot proposals are no longer in the expected preserved state");
    }
    const records = waveOne.map((row): RepairRecord => {
      const evidence = titleBySource.get(row.source_wordpress_id);
      if (!evidence) throw new OfficialTitlePassageRepairError("private_title_scope_mismatch", "A Wave 1 database record lacks verified official-title evidence");
      return {
        sermonId: row.id,
        privateSourceId: row.source_wordpress_id,
        videoId: evidence.videoId,
        sourceTitle: evidence.title,
        evidenceSha256: sha256(evidence.title),
        extraction: extractPrimaryPassageFromTitle(evidence.title)
      };
    });
    const artifact = await persistRepairArtifact(records);
    let repairedReviewRecords = 0;
    let preservedReviewRecords = 0;
    for (const record of records) {
      const sourceRow = waveOne.find((row) => row.id === record.sermonId)!;
      const correlationId = `${officialTitlePassageRepairVersion}:${record.sermonId}`;
      const [reviewResult, auditResult] = await Promise.all([
        client.query<ReviewRow>(
          `SELECT proposal_outcome, evidence_source, evidence_sha256, parser_version, review_status,
                  reviewed_by_subject, reviewed_at
           FROM sermon_primary_passage_reviews WHERE sermon_id = $1 FOR UPDATE`,
          [record.sermonId]
        ),
        client.query<{ total: number }>(
          `SELECT count(*)::integer AS total FROM audit_events
           WHERE request_correlation_id = $1 AND action = 'sermon.primary_passage_official_title_reprepared'`,
          [correlationId]
        )
      ]);
      const review = reviewResult.rows[0];
      if (reviewResult.rowCount !== 1 || !review) {
        throw new OfficialTitlePassageRepairError("existing_review_conflict", "Wave 1 passage review state contains an administrator decision or unexpected provenance");
      }
      const auditCount = auditResult.rows[0]?.total ?? 0;
      const repairState = classifyOfficialTitleReviewRepair({
        review,
        auditCount,
        previousEvidenceSha256: sha256(sourceRow.title),
        expectedEvidenceSha256: record.evidenceSha256,
        expectedProposalOutcome: proposalOutcome(record.extraction)
      });
      if (repairState === "preserve") {
        await verifyProposal(client, record);
        preservedReviewRecords += 1;
        continue;
      }
      if (repairState === "conflict") {
        throw new OfficialTitlePassageRepairError("existing_review_conflict", "Wave 1 passage review state is not the expected pre-repair no-reference outcome");
      }
      const currentProposals = await client.query(
        `SELECT id FROM scripture_references
         WHERE sermon_id = $1 AND provenance = 'title_proposal' AND review_status = 'proposed'`,
        [record.sermonId]
      );
      if (currentProposals.rowCount !== 0) throw new OfficialTitlePassageRepairError("existing_proposal_conflict", "A Wave 1 no-reference record already has a title proposal");
      await client.query(
        `UPDATE sermon_primary_passage_reviews
         SET proposal_outcome = $2, evidence_sha256 = $3, parser_version = $4,
             updated_at = now(), row_version = row_version + 1
         WHERE sermon_id = $1`,
        [record.sermonId, proposalOutcome(record.extraction), record.evidenceSha256, biblePassageParserVersion]
      );
      await insertTitleProposal(client, record);
      await client.query(
        `INSERT INTO audit_events (
           actor_subject, actor_role, action, entity_type, entity_id, changed_fields,
           request_correlation_id, outcome
         ) VALUES (
           'local-primary-passage-preparer', 'system', 'sermon.primary_passage_official_title_reprepared',
           'sermon', $1, '["primaryPassageReview","scriptureReferences"]'::jsonb, $2, 'succeeded'
         )`,
        [record.sermonId, correlationId]
      );
      repairedReviewRecords += 1;
    }
    const final = await client.query<{
      confirmed: number;
      public_candidates: number;
      decisions: number;
    }>(`SELECT
         (SELECT count(*)::integer FROM scripture_references
          WHERE sermon_id = ANY($1::uuid[]) AND relationship_role = 'primary' AND review_status = 'confirmed') AS confirmed,
         (SELECT count(*)::integer FROM sermons sermon
          WHERE sermon.id = ANY($1::uuid[]) AND sermon.status = 'published' AND EXISTS (
            SELECT 1 FROM scripture_references ref WHERE ref.sermon_id = sermon.id
              AND ref.relationship_role = 'primary' AND ref.review_status = 'confirmed'
          )) AS public_candidates,
         (SELECT count(*)::integer FROM sermon_primary_passage_reviews review
          WHERE review.sermon_id = ANY($1::uuid[]) AND review.review_status <> 'pending') AS decisions`,
      [scope.map((row) => row.id)]
    );
    if (final.rows[0]?.confirmed !== 0 || final.rows[0]?.public_candidates !== 0 || final.rows[0]?.decisions !== 0) {
      throw new OfficialTitlePassageRepairError("automatic_decision_detected", "Passage repair would not leave every decision pending and private");
    }
    await client.query("COMMIT");
    return {
      outcome: "official_youtube_title_passage_repair_complete",
      scopedRecords: 15,
      preservedPilotRecords: 3,
      waveOneRecords: 12,
      proposedReferences: records.filter((record) => record.extraction.outcome === "one_valid_reference").length,
      noReference: records.filter((record) => record.extraction.outcome === "no_reference").length,
      manualReviewRequired: records.filter((record) => record.extraction.outcome === "manual_review_required").length,
      repairedReviewRecords,
      preservedReviewRecords,
      privateArtifact: artifact.outcome,
      privateArtifactSha256: artifact.bytesSha256,
      administratorDecisionsCreated: 0,
      confirmedPrimaryPassages: 0,
      sermonContentChanged: false,
      displayTitlesChanged: false,
      publiclySearchableProposals: 0
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

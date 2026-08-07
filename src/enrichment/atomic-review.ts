import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import type { Pool, PoolClient } from "pg";
import { z, type ZodType } from "zod";
import { containsHtmlTag } from "../domain/content-readiness";
import {
  atomicReviewItemSetSha256,
  buildAtomicReviewItems,
  phase3b2AtomicReviewManifestSchema,
  type Phase3b2AtomicReviewManifest
} from "./atomic-review-contracts";
import { phase3b2EnrichmentDraftBundleSchema } from "./contracts";
import { deterministicPilotUuid } from "./phase3b2-pilot";
import { importEnrichmentDraftBundle } from "./postgres-enrichment";
import { phase3b2PunctuationCompletionManifestSchema } from "./pilot-punctuation-contracts";
import {
  PunctuationWorkflowError,
  assertSafeDirectory,
  lexicalTokenSequenceSha256,
  persistNoClobber,
  readSafeFile,
  resolveSafeDirectChild
} from "./pilot-punctuation";

const atomicReviewImporterSubject = "local-phase3b2b-atomic-review-importer";
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const safeText = (maximum: number) => z.string().max(maximum).refine(
  (value) => !containsHtmlTag(value),
  "Use plain text; HTML tags are not accepted"
);
const privateFindingSchema = z.object({
  detail: safeText(1_000).trim().min(1),
  supportingParagraphs: z.array(z.number().int().positive()).min(1).max(100)
}).strict();

const privateReviewReportSchema = z.looseObject({
  schemaVersion: z.literal(2),
  recordKey: z.enum(["authorised-record-2", "authorised-record-3"]),
  tokenSequenceComparison: z.looseObject({
    sourceSha256: sha256Schema,
    cleanedSha256: sha256Schema,
    match: z.literal(true)
  }),
  preservation: z.looseObject({
    zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens: z.literal(true),
    whitespaceBoundariesPreserved: z.literal(true),
    sourceSegmentsCompleteAndUnique: z.literal(true),
    chunkReassemblyComplete: z.literal(true),
    sourceTokenCount: z.number().int().positive(),
    cleanedTokenCount: z.number().int().positive()
  }),
  possibleCaptionErrors: z.array(privateFindingSchema).max(100),
  apparentNamesAndScriptureReferences: z.array(privateFindingSchema).max(100)
});

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function parsePrivateJson<T>(path: string, schema: ZodType<T>, label: string): Promise<T> {
  const bytes = await readSafeFile(path);
  try {
    return schema.parse(JSON.parse(bytes.toString("utf8")));
  } catch (error) {
    throw new PunctuationWorkflowError(
      "schema_failure",
      `${label} is invalid or no longer matches its trusted contract.`,
      { cause: error }
    );
  }
}

async function verifyAtomicDatabase(client: PoolClient): Promise<void> {
  const result = await client.query<{
    server_16: boolean;
    loopback: boolean;
    port_5432: boolean;
    target_database: boolean;
    postgres_server: boolean;
    atomic_columns: boolean;
  }>(
    `SELECT
       current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
       inet_server_addr() = '127.0.0.1'::inet AS loopback,
       inet_server_port() = 5432 AS port_5432,
       current_database() = 'savinggrace_sermons_test' AS target_database,
       version() LIKE 'PostgreSQL%' AS postgres_server,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'sermon_enrichment_review_items'
           AND column_name = 'item_identity_sha256'
       ) AS atomic_columns`
  );
  if (!Object.values(result.rows[0] ?? {}).every(Boolean)) {
    throw new PunctuationWorkflowError(
      "database_verification_failure",
      "Atomic review import refused an unverified database or missing migration 0008."
    );
  }
}

interface AssemblyTargetRow {
  title: string;
  slug: string;
  service_date: string;
  status: string;
  source_status: string | null;
  summary: string | null;
  summary_status: string;
  transcript_body: string;
  transcript_status: string;
  transcript_row_version: number;
  media_title: string;
  media_external_id: string | null;
  media_canonical_url: string | null;
  question_count: number;
  draft_question_count: number;
}

async function assemblyTarget(
  client: PoolClient,
  bundle: z.infer<typeof phase3b2EnrichmentDraftBundleSchema>
): Promise<AssemblyTargetRow> {
  const result = await client.query<AssemblyTargetRow>(
    `SELECT
       sermon.title,
       sermon.slug,
       to_char(sermon.service_date, 'YYYY-MM-DD') AS service_date,
       sermon.status,
       sermon.source_status,
       sermon.summary,
       sermon.summary_status,
       transcript.body_text AS transcript_body,
       transcript.status AS transcript_status,
       transcript.row_version AS transcript_row_version,
       media.title AS media_title,
       media.external_id AS media_external_id,
       media.canonical_url AS media_canonical_url,
       (SELECT count(*)::integer FROM sermon_question_answers qa
        WHERE qa.sermon_id = sermon.id) AS question_count,
       (SELECT count(*)::integer FROM sermon_question_answers qa
        WHERE qa.sermon_id = sermon.id AND qa.status = 'draft') AS draft_question_count
     FROM sermons sermon
     JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
     JOIN sermon_media media ON media.sermon_id = sermon.id
       AND media.provider = 'youtube' AND media.is_primary = true
     WHERE sermon.id = $1 AND sermon.source_wordpress_id = $2`,
    [bundle.targetSermonId, bundle.sourceWordPressId]
  );
  const row = result.rows[0];
  if (
    !row ||
    row.status !== "draft" ||
    row.source_status !== "phase3b2_pilot" ||
    row.summary_status !== "draft" ||
    row.transcript_status !== "draft" ||
    row.summary !== bundle.description.bodyText ||
    row.transcript_body !== bundle.transcript.bodyText ||
    row.media_external_id !== bundle.sourceProvenance.videoId ||
    row.media_canonical_url !== bundle.sourceProvenance.canonicalUrl ||
    row.question_count !== bundle.questionAnswers.length ||
    row.draft_question_count !== bundle.questionAnswers.length
  ) {
    throw new PunctuationWorkflowError(
      "persistence_conflict",
      "A private draft no longer matches the trusted exact-two restoration inputs."
    );
  }
  const questionRows = await client.query<{
    question_text: string;
    answer_text: string;
    display_order: number;
    status: string;
  }>(
    `SELECT question_text, answer_text, display_order, status
     FROM sermon_question_answers WHERE sermon_id = $1 ORDER BY display_order`,
    [bundle.targetSermonId]
  );
  if (questionRows.rows.some((question, index) => {
    const expected = bundle.questionAnswers[index];
    return !expected || question.display_order !== index + 1 || question.status !== "draft" ||
      question.question_text !== expected.question || question.answer_text !== expected.answer;
  })) {
    throw new PunctuationWorkflowError(
      "persistence_conflict",
      "Private draft Q&A no longer matches the trusted restoration bundle."
    );
  }
  return row;
}

export async function assemblePhase3b2AtomicReviewManifest(
  pool: Pool,
  completionManifestPathInput: string,
  outputFilename: string
): Promise<{ persistence: "created" | "unchanged"; recordCounts: number[]; totalItemCount: number }> {
  const completionPath = resolve(completionManifestPathInput);
  const pilotRoot = dirname(completionPath);
  await assertSafeDirectory(pilotRoot);
  if (
    completionPath !== resolveSafeDirectChild(pilotRoot, basename(completionPath), "file", ".private.json")
  ) {
    throw new PunctuationWorkflowError(
      "path_safety_failure",
      "The exact-two completion manifest must be a direct private JSON child."
    );
  }
  const completion = await parsePrivateJson(
    completionPath,
    phase3b2PunctuationCompletionManifestSchema,
    "The trusted exact-two completion manifest"
  );
  const preparedRoot = resolveSafeDirectChild(pilotRoot, "prepared-private", "directory");
  await assertSafeDirectory(preparedRoot);

  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await verifyAtomicDatabase(client);
    const records = [];
    for (const completionRecord of completion.records) {
      const bundle = await parsePrivateJson(
        resolveSafeDirectChild(
          preparedRoot,
          `${completionRecord.videoId}.phase3b2b-v2.private.json`,
          "file",
          ".private.json"
        ),
        phase3b2EnrichmentDraftBundleSchema,
        "A trusted private draft bundle"
      );
      const report = await parsePrivateJson(
        resolveSafeDirectChild(
          preparedRoot,
          `${completionRecord.videoId}.phase3b2b-v2.review.private.json`,
          "file",
          ".private.json"
        ),
        privateReviewReportSchema,
        "A trusted private review report"
      );
      if (
        JSON.stringify(completionRecord.possibleCaptionErrors) !==
          JSON.stringify(report.possibleCaptionErrors) ||
        JSON.stringify(completionRecord.apparentNamesAndScriptureReferences) !==
          JSON.stringify(report.apparentNamesAndScriptureReferences) ||
        bundle.sourceProvenance.videoId !== completionRecord.videoId ||
        bundle.targetSermonId !== deterministicPilotUuid(completionRecord.videoId)
      ) {
        throw new PunctuationWorkflowError(
          "persistence_conflict",
          "Trusted atomic review inputs do not agree on exact source identity or findings."
        );
      }
      const target = await assemblyTarget(client, bundle);
      const transcriptContentSha256 = sha256(bundle.transcript.bodyText);
      if (
        lexicalTokenSequenceSha256(bundle.transcript.bodyText) !== report.tokenSequenceComparison.cleanedSha256 ||
        report.tokenSequenceComparison.sourceSha256 !== report.tokenSequenceComparison.cleanedSha256 ||
        report.preservation.sourceTokenCount !== report.preservation.cleanedTokenCount
      ) {
        throw new PunctuationWorkflowError(
          "lexical_preservation_failure",
          "The restored transcript does not match the trusted lexical-token evidence."
        );
      }
      const reviewItems = buildAtomicReviewItems({
        sourceRecordKey: report.recordKey,
        transcriptSermonId: bundle.targetSermonId,
        sourceTranscriptSha256: transcriptContentSha256,
        expectedTranscriptRowVersion: target.transcript_row_version,
        captionErrors: report.possibleCaptionErrors,
        namesOrScriptureReferences: report.apparentNamesAndScriptureReferences
      });
      records.push({
        recordKey: report.recordKey,
        restorationTarget: {
          title: target.title,
          slug: target.slug,
          serviceDate: target.service_date,
          mediaTitle: target.media_title
        },
        draftBundle: bundle,
        transcriptEvidence: {
          contentSha256: transcriptContentSha256,
          sourceTokenSequenceSha256: report.tokenSequenceComparison.sourceSha256,
          cleanedTokenSequenceSha256: report.tokenSequenceComparison.cleanedSha256,
          sourceTokenCount: report.preservation.sourceTokenCount,
          cleanedTokenCount: report.preservation.cleanedTokenCount,
          expectedRowVersion: target.transcript_row_version,
          zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens:
            report.preservation.zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens,
          whitespaceBoundariesPreserved: report.preservation.whitespaceBoundariesPreserved,
          sourceSegmentsCompleteAndUnique: report.preservation.sourceSegmentsCompleteAndUnique,
          chunkReassemblyComplete: report.preservation.chunkReassemblyComplete
        },
        reviewItemSetSha256: atomicReviewItemSetSha256(reviewItems),
        reviewItems
      });
    }
    await client.query("ROLLBACK");
    const manifest = phase3b2AtomicReviewManifestSchema.parse({
      schemaVersion: 1,
      sourceSnapshotId: completion.sourceSnapshotId,
      records: records.sort((left, right) => left.recordKey.localeCompare(right.recordKey))
    });
    const persistence = await persistNoClobber(
      resolveSafeDirectChild(pilotRoot, outputFilename, "file", ".private.json"),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    return {
      persistence,
      recordCounts: manifest.records.map((record) => record.reviewItems.length),
      totalItemCount: manifest.records.reduce((count, record) => count + record.reviewItems.length, 0)
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function ensureMigrationRecord(
  client: PoolClient,
  manifest: Phase3b2AtomicReviewManifest,
  record: Phase3b2AtomicReviewManifest["records"][number]
): Promise<void> {
  const bundle = record.draftBundle;
  const existingRun = await client.query<{ id: string }>(
    `SELECT id FROM migration_runs
     WHERE migration_version = 'phase3b2-pilot-v1' AND source_snapshot_id = $1
       AND dry_run = false AND status = 'succeeded'
     ORDER BY started_at LIMIT 1`,
    [manifest.sourceSnapshotId]
  );
  let runId = existingRun.rows[0]?.id;
  if (!runId) {
    runId = (await client.query<{ id: string }>(
      `INSERT INTO migration_runs (
       migration_version, source_snapshot_id, dry_run, status, completed_at, summary
       ) VALUES ('phase3b2-pilot-v1', $1, false, 'succeeded', now(),
         '{"scope":"private_exact_two_atomic_restoration"}'::jsonb)
       RETURNING id`,
      [manifest.sourceSnapshotId]
    )).rows[0]!.id;
  }
  await client.query(
    `INSERT INTO migration_records (
       migration_run_id, source_system, source_entity_type, source_id,
       source_status, source_url, source_checksum_sha256,
       target_entity_type, target_id, outcome, reason_code
     ) VALUES ($1, 'phase3b2_pilot', 'private_caption', $2, 'draft', $3, $4,
       'sermon', $5, 'included', 'authorised_private_pilot')
     ON CONFLICT (migration_run_id, source_system, source_entity_type, source_id)
     DO NOTHING`,
    [
      runId,
      String(bundle.sourceWordPressId),
      bundle.sourceProvenance.canonicalUrl,
      bundle.sourceProvenance.sourceContentSha256,
      bundle.targetSermonId
    ]
  );
  const exact = await client.query<{ matches: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM migration_records
       WHERE migration_run_id = $1 AND source_system = 'phase3b2_pilot'
         AND source_entity_type = 'private_caption' AND source_id = $2
         AND source_status = 'draft' AND source_url = $3
         AND source_checksum_sha256 = $4 AND target_entity_type = 'sermon'
         AND target_id = $5 AND outcome = 'included'
         AND reason_code = 'authorised_private_pilot'
     ) AS matches`,
    [
      runId,
      String(bundle.sourceWordPressId),
      bundle.sourceProvenance.canonicalUrl,
      bundle.sourceProvenance.sourceContentSha256,
      bundle.targetSermonId
    ]
  );
  if (!exact.rows[0]?.matches) {
    throw new PunctuationWorkflowError(
      "persistence_conflict",
      "The private restoration migration identity conflicts with existing state."
    );
  }
}

async function ensureRestorationTarget(
  pool: Pool,
  manifest: Phase3b2AtomicReviewManifest,
  record: Phase3b2AtomicReviewManifest["records"][number]
): Promise<{ rowVersion: number }> {
  const bundle = record.draftBundle;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await verifyAtomicDatabase(client);
    if (bundle.targetSermonId !== deterministicPilotUuid(bundle.sourceProvenance.videoId)) {
      throw new PunctuationWorkflowError(
        "unauthorised_record",
        "The atomic restoration target is not the deterministic trusted pilot identity."
      );
    }
    const existing = await client.query<{
      id: string;
      title: string;
      slug: string;
      service_date: string;
      status: string;
      source_status: string | null;
      row_version: number;
    }>(
      `SELECT id, title, slug, to_char(service_date, 'YYYY-MM-DD') AS service_date,
              status, source_status, row_version
       FROM sermons WHERE source_wordpress_id = $1 FOR UPDATE`,
      [bundle.sourceWordPressId]
    );
    const found = existing.rows[0];
    if (!found) {
      await client.query(
        `INSERT INTO sermons (
           id, title, slug, status, service_date, source_wordpress_id, source_status,
           historical_backfill_required, created_by_subject, updated_by_subject
         ) VALUES ($1, $2, $3, 'draft', $4::date, $5, 'phase3b2_pilot', true, $6, $6)`,
        [
          bundle.targetSermonId,
          record.restorationTarget.title,
          record.restorationTarget.slug,
          record.restorationTarget.serviceDate,
          bundle.sourceWordPressId,
          atomicReviewImporterSubject
        ]
      );
      await client.query(
        `INSERT INTO sermon_media (
           sermon_id, media_type, provider, external_id, canonical_url,
           title, is_primary, display_order, availability_status
         ) VALUES ($1, 'video', 'youtube', $2, $3, $4, true, 0, 'available')`,
        [
          bundle.targetSermonId,
          bundle.sourceProvenance.videoId,
          bundle.sourceProvenance.canonicalUrl,
          record.restorationTarget.mediaTitle
        ]
      );
    } else if (
      found.id !== bundle.targetSermonId ||
      found.title !== record.restorationTarget.title ||
      found.slug !== record.restorationTarget.slug ||
      found.service_date !== record.restorationTarget.serviceDate ||
      found.status !== "draft" ||
      found.source_status !== "phase3b2_pilot"
    ) {
      throw new PunctuationWorkflowError(
        "persistence_conflict",
        "An existing sermon conflicts with the trusted exact-two restoration target."
      );
    }
    const media = await client.query<{ matches: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM sermon_media
         WHERE sermon_id = $1 AND provider = 'youtube' AND media_type = 'video'
           AND external_id = $2 AND canonical_url = $3 AND title = $4
           AND is_primary = true AND availability_status = 'available'
       ) AS matches`,
      [
        bundle.targetSermonId,
        bundle.sourceProvenance.videoId,
        bundle.sourceProvenance.canonicalUrl,
        record.restorationTarget.mediaTitle
      ]
    );
    if (!media.rows[0]?.matches) {
      throw new PunctuationWorkflowError(
        "persistence_conflict",
        "The restored sermon media identity is missing or conflicting."
      );
    }
    await ensureMigrationRecord(client, manifest, record);
    const current = await client.query<{ row_version: number }>(
      "SELECT row_version FROM sermons WHERE id = $1",
      [bundle.targetSermonId]
    );
    await client.query("COMMIT");
    return { rowVersion: current.rows[0]!.row_version };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function importAtomicSets(
  pool: Pool,
  manifest: Phase3b2AtomicReviewManifest
): Promise<Array<"imported_atomic_items" | "unchanged">> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await verifyAtomicDatabase(client);
    const outcomes: Array<"imported_atomic_items" | "unchanged"> = [];
    for (const record of manifest.records) {
      const bundle = record.draftBundle;
      const state = await client.query<{
        sermon_status: string;
        summary_status: string;
        transcript_status: string;
        transcript_body: string;
        transcript_row_version: number;
        identity_status: string;
        current_stage: number;
        completed_at: Date | null;
        completed_by_subject: string | null;
        source_record_key: string | null;
        expected_item_count: number | null;
        expected_item_set_sha256: string | null;
        expected_transcript_sha256: string | null;
        expected_transcript_row_version: number | null;
      }>(
        `SELECT sermon.status AS sermon_status,
                sermon.summary_status,
                transcript.status AS transcript_status,
                transcript.body_text AS transcript_body,
                transcript.row_version AS transcript_row_version,
                review.identity_status,
                review.current_stage,
                review.completed_at,
                review.completed_by_subject,
                review.source_record_key,
                review.expected_item_count,
                review.expected_item_set_sha256,
                review.expected_transcript_sha256,
                review.expected_transcript_row_version
         FROM sermons sermon
         JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
         JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
         WHERE sermon.id = $1 FOR UPDATE OF sermon, transcript, review`,
        [bundle.targetSermonId]
      );
      const current = state.rows[0];
      if (
        !current ||
        current.sermon_status !== "draft" ||
        current.summary_status !== "draft" ||
        current.transcript_status !== "draft" ||
        current.transcript_body !== bundle.transcript.bodyText ||
        sha256(current.transcript_body) !== record.transcriptEvidence.contentSha256 ||
        current.transcript_row_version !== record.transcriptEvidence.expectedRowVersion ||
        current.identity_status !== "pending" ||
        current.current_stage !== 1 ||
        current.completed_at !== null ||
        current.completed_by_subject !== null
      ) {
        throw new PunctuationWorkflowError(
          "database_verification_failure",
          "Atomic review import refused changed transcript, review, approval or draft state."
        );
      }
      const relevantAudit = await client.query<{ count: string }>(
        `SELECT count(*) FROM audit_events
         WHERE entity_id = $1 AND (
           action LIKE 'sermon.enrichment_review_item_%'
           OR action = 'sermon.enrichment_review_finished'
           OR actor_subject = 'local-admin-0001'
         )`,
        [bundle.targetSermonId]
      );
      if (Number(relevantAudit.rows[0]?.count ?? 0) !== 0) {
        throw new PunctuationWorkflowError(
          "database_verification_failure",
          "Atomic review import refused existing administrator or review-decision audit state."
        );
      }
      const items = await client.query<{
        id: string;
        item_key: string;
        category: string;
        display_order: number;
        decision_status: string;
        correction_text: string | null;
        decided_by_subject: string | null;
        decided_at: Date | null;
        item_identity_sha256: string | null;
        source_record_key: string | null;
        category_ordinal: number | null;
        finding_detail: string | null;
        supporting_paragraphs: number[] | null;
        source_transcript_sha256: string | null;
        transcript_row_version: number;
      }>(
        `SELECT id, item_key, category, display_order, decision_status,
                correction_text, decided_by_subject, decided_at,
                item_identity_sha256, source_record_key, category_ordinal,
                finding_detail, supporting_paragraphs, source_transcript_sha256,
                transcript_row_version
         FROM sermon_enrichment_review_items
         WHERE sermon_id = $1 ORDER BY display_order, id FOR UPDATE`,
        [bundle.targetSermonId]
      );
      const expectedByIdentity = new Map(
        record.reviewItems.map((item) => [item.identitySha256, item])
      );
      const exactAtomic =
        current.source_record_key === record.recordKey &&
        current.expected_item_count === record.reviewItems.length &&
        current.expected_item_set_sha256 === record.reviewItemSetSha256 &&
        current.expected_transcript_sha256 === record.transcriptEvidence.contentSha256 &&
        current.expected_transcript_row_version === record.transcriptEvidence.expectedRowVersion &&
        items.rows.length === record.reviewItems.length &&
        items.rows.every((item, index) => {
          const expected = item.item_identity_sha256
            ? expectedByIdentity.get(item.item_identity_sha256)
            : undefined;
          return Boolean(
            expected &&
            item.id === expected.id &&
            item.item_key === expected.itemKey &&
            item.category === expected.category &&
            item.display_order === expected.displayOrder &&
            item.category_ordinal === expected.categoryOrdinal &&
            item.finding_detail === expected.detail &&
            JSON.stringify(item.supporting_paragraphs) === JSON.stringify(expected.supportingParagraphs) &&
            item.source_record_key === expected.sourceRecordKey &&
            item.source_transcript_sha256 === expected.sourceTranscriptSha256 &&
            item.transcript_row_version === expected.expectedTranscriptRowVersion &&
            item.decision_status === "pending" &&
            item.correction_text === null &&
            item.decided_by_subject === null &&
            item.decided_at === null &&
            index === expected.displayOrder - 1
          );
        });
      if (exactAtomic) {
        outcomes.push("unchanged");
        continue;
      }
      const expectationAbsent =
        current.source_record_key === null &&
        current.expected_item_count === null &&
        current.expected_item_set_sha256 === null &&
        current.expected_transcript_sha256 === null &&
        current.expected_transcript_row_version === null;
      const allowedLegacyKeys = new Set([
        "caption-general",
        "name-verification",
        "scripture-verification"
      ]);
      const untouchedLegacy =
        expectationAbsent &&
        (items.rows.length === 0 || (
          items.rows.length === 3 &&
          items.rows.every((item) =>
            allowedLegacyKeys.has(item.item_key) &&
            item.item_identity_sha256 === null &&
            item.decision_status === "pending" &&
            item.correction_text === null &&
            item.decided_by_subject === null &&
            item.decided_at === null
          )
        ));
      if (!untouchedLegacy) {
        throw new PunctuationWorkflowError(
          "database_verification_failure",
          "Atomic review import found missing, extra, changed, duplicated or unexpected review identities."
        );
      }
      await client.query(
        "DELETE FROM sermon_enrichment_review_items WHERE sermon_id = $1",
        [bundle.targetSermonId]
      );
      for (const item of record.reviewItems) {
        await client.query(
          `INSERT INTO sermon_enrichment_review_items (
             id, sermon_id, item_key, category, display_order, label, guidance,
             source_marker, decision_status, correction_text, transcript_row_version,
             decided_by_subject, decided_at, item_identity_sha256, source_record_key,
             category_ordinal, finding_detail, supporting_paragraphs,
             source_transcript_sha256, atomic_schema_version
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, 'pending', NULL, $9,
             NULL, NULL, $10, $11, $12, $13, $14::integer[], $15, 1
           )`,
          [
            item.id,
            bundle.targetSermonId,
            item.itemKey,
            item.category,
            item.displayOrder,
            item.category === "caption_error"
              ? `Caption finding ${item.categoryOrdinal}`
              : `Name or Scripture-reference finding ${item.categoryOrdinal}`,
            item.detail,
            item.sourceMarker,
            item.expectedTranscriptRowVersion,
            item.identitySha256,
            item.sourceRecordKey,
            item.categoryOrdinal,
            item.detail,
            item.supportingParagraphs,
            item.sourceTranscriptSha256
          ]
        );
      }
      await client.query(
        `UPDATE sermon_enrichment_reviews
         SET source_record_key = $2,
             expected_item_count = $3,
             expected_item_set_sha256 = $4,
             expected_transcript_sha256 = $5,
             expected_transcript_row_version = $6,
             atomic_schema_version = 1,
             updated_at = now(),
             updated_by_subject = $7,
             row_version = row_version + 1
         WHERE sermon_id = $1`,
        [
          bundle.targetSermonId,
          record.recordKey,
          record.reviewItems.length,
          record.reviewItemSetSha256,
          record.transcriptEvidence.contentSha256,
          record.transcriptEvidence.expectedRowVersion,
          atomicReviewImporterSubject
        ]
      );
      outcomes.push("imported_atomic_items");
    }
    await client.query("COMMIT");
    return outcomes;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function importPhase3b2AtomicReviewManifest(
  pool: Pool,
  input: unknown
): Promise<{ contentOutcomes: string[]; atomicOutcomes: string[]; totalItemCount: number }> {
  const manifest = phase3b2AtomicReviewManifestSchema.parse(input);
  const contentOutcomes: string[] = [];
  for (const record of manifest.records) {
    const target = await ensureRestorationTarget(pool, manifest, record);
    const imported = await importEnrichmentDraftBundle(
      pool,
      { ...record.draftBundle, expectedRowVersion: target.rowVersion },
      atomicReviewImporterSubject
    );
    contentOutcomes.push(imported.outcome);
  }
  const atomicOutcomes = await importAtomicSets(pool, manifest);
  return {
    contentOutcomes,
    atomicOutcomes,
    totalItemCount: manifest.records.reduce((count, record) => count + record.reviewItems.length, 0)
  };
}

export async function verifyPhase3b2AtomicReviewManifest(
  pool: Pool,
  input: unknown
): Promise<{
  recordCounts: number[];
  totalItemCount: number;
  pendingItemCount: number;
  decisionCount: number;
  approvalCount: number;
  publicSearchCharacters: number;
  exactIdentitySets: boolean;
}> {
  const manifest = phase3b2AtomicReviewManifestSchema.parse(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    await verifyAtomicDatabase(client);
    let pendingItemCount = 0;
    let decisionCount = 0;
    let approvalCount = 0;
    let publicSearchCharacters = 0;
    for (const record of manifest.records) {
      const bundle = record.draftBundle;
      await assemblyTarget(client, bundle);
      const source = bundle.sourceProvenance;
      const provenance = await client.query<{ exact: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM sermons sermon
           JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
           JOIN sermon_enrichment_sources provenance ON provenance.sermon_id = sermon.id
           WHERE sermon.id = $1
             AND sermon.summary = $2
             AND sermon.summary_source_kind = $3
             AND sermon.summary_source_reference = $4
             AND transcript.body_text = $5
             AND transcript.source_kind = $6
             AND transcript.source_reference = $7
             AND provenance.provider = $8
             AND provenance.video_id = $9
             AND provenance.canonical_url = $10
             AND provenance.caption_language = $11
             AND provenance.caption_track_type = $12
             AND provenance.original_filename = $13
             AND provenance.source_content_sha256 = $14
             AND provenance.retrieval_attribution = $15
             AND provenance.source_character_count = $16
             AND provenance.cleaned_character_count = $17
             AND provenance.apparent_completeness = $18
             AND provenance.uncertainty_marker_count = $19
             AND provenance.warnings = $20::jsonb
             AND provenance.unresolved_passages = $21::jsonb
             AND provenance.processing_version = $22
             AND provenance.imported_at = $23::timestamptz
             AND provenance.processed_at = $24::timestamptz
             AND provenance.processing_duration_ms = $25
             AND provenance.estimated_review_minutes = $26
             AND provenance.manual_attention_required = $27
             AND provenance.accuracy_review_status = $28
             AND (SELECT count(*) FROM sermon_media media
                  WHERE media.sermon_id = sermon.id) = 1
             AND (SELECT count(*) FROM sermon_media media
                  WHERE media.sermon_id = sermon.id
                    AND media.provider = 'youtube'
                    AND media.media_type = 'video'
                    AND media.external_id = $9
                    AND media.canonical_url = $10
                    AND media.title = $29
                    AND media.is_primary = true
                    AND media.availability_status = 'available') = 1
             AND (SELECT count(*) FROM migration_records receipt
                  WHERE receipt.target_id = sermon.id
                    AND receipt.source_system = 'phase3b2_pilot'
                    AND receipt.source_entity_type = 'private_caption'
                    AND receipt.source_id = $30
                    AND receipt.source_status = 'draft'
                    AND receipt.source_url = $10
                    AND receipt.source_checksum_sha256 = $14
                    AND receipt.target_entity_type = 'sermon'
                    AND receipt.outcome = 'included'
                    AND receipt.reason_code = 'authorised_private_pilot') = 1
         ) AS exact`,
        [
          bundle.targetSermonId,
          bundle.description.bodyText,
          bundle.description.provenance.sourceKind,
          bundle.description.provenance.sourceReference,
          bundle.transcript.bodyText,
          bundle.transcript.provenance.sourceKind,
          bundle.transcript.provenance.sourceReference,
          source.provider,
          source.videoId,
          source.canonicalUrl,
          source.captionLanguage,
          source.captionTrackType,
          source.originalFilename,
          source.sourceContentSha256,
          source.retrievalAttribution,
          source.sourceCharacterCount,
          source.cleanedCharacterCount,
          source.apparentCompleteness,
          source.uncertaintyMarkerCount,
          JSON.stringify(source.warnings),
          JSON.stringify(source.unresolvedPassages),
          source.processingVersion,
          source.importedAt,
          source.processedAt,
          source.processingDurationMs,
          source.estimatedReviewMinutes,
          source.manualAttentionRequired,
          source.accuracyReviewStatus,
          record.restorationTarget.mediaTitle,
          String(bundle.sourceWordPressId)
        ]
      );
      if (!provenance.rows[0]?.exact) {
        throw new PunctuationWorkflowError(
          "database_verification_failure",
          "The restored exact-two provenance, media or migration identity differs."
        );
      }
      const state = await client.query<{
        sermon_status: string;
        summary_status: string;
        transcript_status: string;
        transcript_body: string;
        transcript_row_version: number;
        identity_status: string;
        completed_at: Date | null;
        expected_item_count: number;
        expected_item_set_sha256: string;
        expected_transcript_sha256: string;
        expected_transcript_row_version: number;
        qa_count: number;
        draft_qa_count: number;
        search_characters: number;
      }>(
        `SELECT sermon.status AS sermon_status,
                sermon.summary_status,
                transcript.status AS transcript_status,
                transcript.body_text AS transcript_body,
                transcript.row_version AS transcript_row_version,
                review.identity_status,
                review.completed_at,
                review.expected_item_count,
                review.expected_item_set_sha256,
                review.expected_transcript_sha256,
                review.expected_transcript_row_version,
                (SELECT count(*)::integer FROM sermon_question_answers qa
                 WHERE qa.sermon_id = sermon.id) AS qa_count,
                (SELECT count(*)::integer FROM sermon_question_answers qa
                 WHERE qa.sermon_id = sermon.id AND qa.status = 'draft') AS draft_qa_count,
                char_length(sermon.summary_search_document) +
                char_length(sermon.transcript_search_document) +
                char_length(sermon.question_answer_search_document) AS search_characters
         FROM sermons sermon
         JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
         JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
         WHERE sermon.id = $1`,
        [bundle.targetSermonId]
      );
      const current = state.rows[0];
      if (
        !current ||
        current.sermon_status !== "draft" ||
        current.summary_status !== "draft" ||
        current.transcript_status !== "draft" ||
        current.transcript_body !== bundle.transcript.bodyText ||
        sha256(current.transcript_body) !== record.transcriptEvidence.contentSha256 ||
        lexicalTokenSequenceSha256(current.transcript_body) !==
          record.transcriptEvidence.cleanedTokenSequenceSha256 ||
        current.transcript_row_version !== record.transcriptEvidence.expectedRowVersion ||
        current.identity_status !== "pending" ||
        current.completed_at !== null ||
        current.expected_item_count !== record.reviewItems.length ||
        current.expected_item_set_sha256 !== record.reviewItemSetSha256 ||
        current.expected_transcript_sha256 !== record.transcriptEvidence.contentSha256 ||
        current.expected_transcript_row_version !== record.transcriptEvidence.expectedRowVersion ||
        current.qa_count !== bundle.questionAnswers.length ||
        current.draft_qa_count !== bundle.questionAnswers.length
      ) {
        throw new PunctuationWorkflowError(
          "database_verification_failure",
          "The restored exact-two draft, transcript evidence or atomic expectation differs."
        );
      }
      publicSearchCharacters += current.search_characters;
      const items = await client.query<{
        id: string;
        item_key: string;
        category: string;
        display_order: number;
        category_ordinal: number | null;
        finding_detail: string | null;
        guidance: string;
        supporting_paragraphs: number[] | null;
        source_marker: string | null;
        source_record_key: string | null;
        source_transcript_sha256: string | null;
        item_identity_sha256: string | null;
        decision_status: string;
        decided_by_subject: string | null;
        decided_at: Date | null;
        correction_text: string | null;
        transcript_row_version: number;
      }>(
        `SELECT id, item_key, category, display_order, category_ordinal,
                finding_detail, guidance, supporting_paragraphs, source_marker,
                source_record_key, source_transcript_sha256, item_identity_sha256,
                decision_status, decided_by_subject, decided_at, correction_text,
                transcript_row_version
         FROM sermon_enrichment_review_items
         WHERE sermon_id = $1
         ORDER BY display_order`,
        [bundle.targetSermonId]
      );
      const actualSet = atomicReviewItemSetSha256(
        items.rows.map((item) => ({ identitySha256: item.item_identity_sha256 ?? "" }))
      );
      if (
        items.rows.length !== record.reviewItems.length ||
        actualSet !== record.reviewItemSetSha256 ||
        items.rows.some((item, index) => {
          const expected = record.reviewItems[index];
          return !expected ||
            item.id !== expected.id ||
            item.item_key !== expected.itemKey ||
            item.category !== expected.category ||
            item.display_order !== expected.displayOrder ||
            item.category_ordinal !== expected.categoryOrdinal ||
            item.finding_detail !== expected.detail ||
            item.guidance !== expected.detail ||
            JSON.stringify(item.supporting_paragraphs) !==
              JSON.stringify(expected.supportingParagraphs) ||
            item.source_marker !== expected.sourceMarker ||
            item.source_record_key !== expected.sourceRecordKey ||
            item.source_transcript_sha256 !== expected.sourceTranscriptSha256 ||
            item.item_identity_sha256 !== expected.identitySha256 ||
            item.transcript_row_version !== current.transcript_row_version ||
            item.decision_status !== "pending" ||
            item.decided_by_subject !== null ||
            item.decided_at !== null ||
            item.correction_text !== null;
        })
      ) {
        throw new PunctuationWorkflowError(
          "database_verification_failure",
          "Atomic review identities are missing, extra, reordered, duplicated or stale."
        );
      }
      const decisionAudit = await client.query<{ count: string }>(
        `SELECT count(*) FROM audit_events
         WHERE entity_id = $1 AND (
           action LIKE 'sermon.enrichment_review_item_%'
           OR action = 'sermon.enrichment_review_finished'
           OR actor_subject = 'local-admin-0001'
         )`,
        [bundle.targetSermonId]
      );
      if (Number(decisionAudit.rows[0]?.count ?? 0) !== 0) {
        throw new PunctuationWorkflowError(
          "database_verification_failure",
          "Unexpected administrator or review-decision audit state is present."
        );
      }
      pendingItemCount += items.rows.filter((item) => item.decision_status === "pending").length;
      decisionCount += items.rows.filter((item) =>
        item.decision_status !== "pending" || item.decided_by_subject || item.decided_at || item.correction_text
      ).length;
      approvalCount += await client.query<{ count: string }>(
        `SELECT
           (CASE WHEN sermon.summary_status = 'approved' THEN 1 ELSE 0 END +
            CASE WHEN transcript.status = 'approved' THEN 1 ELSE 0 END +
            (SELECT count(*) FROM sermon_question_answers qa
             WHERE qa.sermon_id = sermon.id AND qa.status = 'approved'))::text AS count
         FROM sermons sermon
         JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
         WHERE sermon.id = $1`,
        [bundle.targetSermonId]
      ).then((result) => Number(result.rows[0]?.count ?? 0));
    }
    await client.query("ROLLBACK");
    const recordCounts = manifest.records.map((record) => record.reviewItems.length);
    return {
      recordCounts,
      totalItemCount: recordCounts.reduce((sum, count) => sum + count, 0),
      pendingItemCount,
      decisionCount,
      approvalCount,
      publicSearchCharacters,
      exactIdentitySets: true
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function readPhase3b2AtomicReviewManifest(
  pathInput: string
): Promise<Phase3b2AtomicReviewManifest> {
  const path = resolve(pathInput);
  const root = dirname(path);
  await assertSafeDirectory(root);
  if (path !== resolveSafeDirectChild(root, basename(path), "file", ".private.json")) {
    throw new PunctuationWorkflowError(
      "path_safety_failure",
      "The atomic review manifest must be a direct private JSON child."
    );
  }
  return parsePrivateJson(path, phase3b2AtomicReviewManifestSchema, "The atomic review manifest");
}

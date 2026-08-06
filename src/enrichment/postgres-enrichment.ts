import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  deterministicEnrichmentQueue,
  enrichmentDraftBundleSchema,
  type EnrichmentDraftBundle,
  type EnrichmentQueueManifest
} from "./contracts";

export interface EnrichmentImportResult {
  sourceWordPressId: number;
  targetSermonId: string;
  outcome: "imported_as_draft" | "unchanged";
  descriptionStatus: "draft" | "approved";
  transcriptStatus: "draft" | "approved";
  questionAnswerCount: number;
  warnings: Array<{ code: string; safeDetail: string }>;
}

interface QueueRow {
  source_wordpress_id: string;
  target_sermon_id: string;
  slug: string;
  row_version: number;
  has_one_speaker: boolean;
  summary_status: "missing" | "draft" | "in_review" | "approved";
  transcript_status: "missing" | "draft" | "in_review" | "approved" | null;
  total_question_count: number;
  approved_question_count: number;
  all_questions_approved: boolean;
  has_valid_controlled_media: boolean;
  is_complete: boolean;
}

function needsFromRow(row: QueueRow): EnrichmentQueueManifest["records"][number]["needs"] {
  const needs: EnrichmentQueueManifest["records"][number]["needs"] = [];
  if (!row.has_one_speaker) needs.push("missing_speaker");
  if (row.summary_status === "missing") {
    needs.push("missing_description");
  } else if (row.summary_status !== "approved") {
    needs.push("description_awaiting_review");
  }
  if (!row.transcript_status || row.transcript_status === "missing") {
    needs.push("missing_transcript");
  } else if (row.transcript_status !== "approved") {
    needs.push("transcript_awaiting_review");
  }
  if (row.total_question_count < 5 || row.total_question_count > 10) {
    needs.push("insufficient_questions");
  } else if (
    !row.all_questions_approved ||
    row.approved_question_count !== row.total_question_count
  ) {
    needs.push("questions_awaiting_review");
  }
  if (!row.has_valid_controlled_media) needs.push("missing_media");
  return needs;
}

export async function buildEnrichmentQueue(
  pool: Pool,
  sourceSnapshotId: string
): Promise<EnrichmentQueueManifest> {
  const result = await pool.query<QueueRow>(
    `SELECT
       s.source_wordpress_id,
       s.id AS target_sermon_id,
       s.slug,
       s.row_version,
       readiness.has_one_speaker,
       s.summary_status,
       transcript.status AS transcript_status,
       readiness.total_question_count,
       readiness.approved_question_count,
       readiness.all_questions_approved,
       readiness.has_valid_controlled_media,
       readiness.is_complete
     FROM sermons s
     JOIN sermon_content_readiness readiness ON readiness.sermon_id = s.id
     LEFT JOIN sermon_transcripts transcript ON transcript.sermon_id = s.id
     WHERE s.source_wordpress_id IS NOT NULL
       AND NOT readiness.is_complete
       AND EXISTS (
         SELECT 1
         FROM migration_records record
         WHERE record.target_id = s.id
           AND record.outcome = 'included'
           AND record.source_system = 'wordpress'
       )
     ORDER BY s.source_wordpress_id, s.id`
  );
  return deterministicEnrichmentQueue(
    sourceSnapshotId,
    result.rows.map((row) => ({
      sourceWordPressId: Number(row.source_wordpress_id),
      targetSermonId: row.target_sermon_id,
      slug: row.slug,
      rowVersion: row.row_version,
      needs: needsFromRow(row)
    }))
  );
}

function bundleChecksum(bundle: EnrichmentDraftBundle): string {
  const { expectedRowVersion: _expectedRowVersion, ...content } = bundle;
  const checksumContent = bundle.schemaVersion === 3
    ? {
        ...content,
        sourceProvenance: {
          ...bundle.sourceProvenance,
          importedAt: undefined,
          processedAt: undefined,
          processingDurationMs: undefined
        }
      }
    : content;
  return createHash("sha256").update(JSON.stringify(checksumContent), "utf8").digest("hex");
}

async function currentImportReceipt(
  client: PoolClient,
  sermonId: string
): Promise<{ content_checksum: string } | undefined> {
  const result = await client.query<{ content_checksum: string }>(
    "SELECT content_checksum FROM sermon_enrichment_draft_imports WHERE sermon_id = $1",
    [sermonId]
  );
  return result.rows[0];
}

export async function importEnrichmentDraftBundle(
  pool: Pool,
  input: unknown,
  actorSubject = "local-enrichment-importer"
): Promise<EnrichmentImportResult> {
  const bundle = enrichmentDraftBundleSchema.parse(input);
  const checksum = bundleChecksum(bundle);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sermonResult = await client.query<{
      id: string;
      source_wordpress_id: string | null;
      row_version: number;
      summary: string | null;
      summary_status: "missing" | "draft" | "in_review" | "approved";
    }>(
      `SELECT id, source_wordpress_id, row_version, summary, summary_status
       FROM sermons
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [bundle.targetSermonId]
    );
    const sermon = sermonResult.rows[0];
    if (!sermon || Number(sermon.source_wordpress_id) !== bundle.sourceWordPressId) {
      throw new Error("Enrichment target does not match the supplied source WordPress ID");
    }

    const transcriptResult = await client.query<{
      body_text: string;
      status: "missing" | "draft" | "in_review" | "approved";
    }>(
      "SELECT body_text, status FROM sermon_transcripts WHERE sermon_id = $1",
      [bundle.targetSermonId]
    );
    const existingTranscript = transcriptResult.rows[0];
    const questionResult = await client.query<{
      question_text: string;
      answer_text: string;
      display_order: number;
      status: "draft" | "in_review" | "approved";
    }>(
      `SELECT question_text, answer_text, display_order, status
       FROM sermon_question_answers
       WHERE sermon_id = $1
       ORDER BY display_order`,
      [bundle.targetSermonId]
    );
    const existingQuestions = questionResult.rows;

    const receipt = await currentImportReceipt(client, bundle.targetSermonId);
    if (receipt?.content_checksum === checksum) {
      await client.query("COMMIT");
      return {
        sourceWordPressId: bundle.sourceWordPressId,
        targetSermonId: bundle.targetSermonId,
        outcome: "unchanged",
        descriptionStatus: sermon.summary_status === "approved" ? "approved" : "draft",
        transcriptStatus: existingTranscript?.status === "approved" ? "approved" : "draft",
        questionAnswerCount: bundle.questionAnswers.length,
        warnings: []
      };
    }
    if (sermon.row_version !== bundle.expectedRowVersion) {
      throw new Error(
        `Enrichment import refused stale row version for source WordPress ID ${bundle.sourceWordPressId}`
      );
    }
    if (
      sermon.summary_status === "approved" &&
      sermon.summary !== bundle.description.bodyText
    ) {
      throw new Error(
        `approved_description_conflict for source WordPress ID ${bundle.sourceWordPressId}`
      );
    }
    if (
      existingTranscript?.status === "approved" &&
      existingTranscript.body_text !== bundle.transcript.bodyText
    ) {
      throw new Error(
        `approved_transcript_conflict for source WordPress ID ${bundle.sourceWordPressId}`
      );
    }
    const questionsMatch =
      existingQuestions.length === bundle.questionAnswers.length &&
      existingQuestions.every((existing, index) => {
        const proposed = bundle.questionAnswers[index];
        return Boolean(
          proposed &&
          existing.display_order === index + 1 &&
          existing.question_text === proposed.question &&
          existing.answer_text === proposed.answer
        );
      });
    const hasApprovedQuestions = existingQuestions.some((item) => item.status === "approved");
    if (hasApprovedQuestions && !questionsMatch) {
      throw new Error(
        `approved_question_answers_conflict for source WordPress ID ${bundle.sourceWordPressId}`
      );
    }

    if (sermon.summary_status !== "approved") {
      await client.query(
        `UPDATE sermons
         SET summary = $2,
             summary_status = 'draft',
             summary_source_kind = $3,
             summary_source_reference = $4,
             summary_created_at = COALESCE(summary_created_at, now()),
             summary_updated_at = now(),
             summary_reviewed_by_subject = NULL,
             summary_approved_by_subject = NULL,
             summary_reviewed_at = NULL,
             summary_approved_at = NULL,
             summary_row_version = summary_row_version + 1
         WHERE id = $1`,
        [
          bundle.targetSermonId,
          bundle.description.bodyText,
          bundle.description.provenance.sourceKind,
          bundle.description.provenance.sourceReference
        ]
      );
    }

    if (existingTranscript?.status !== "approved") {
      await client.query(
        `INSERT INTO sermon_transcripts (
           sermon_id, body_text, status, source_kind, source_reference
         ) VALUES ($1, $2, 'draft', $3, $4)
         ON CONFLICT (sermon_id) DO UPDATE SET
           body_text = EXCLUDED.body_text,
           status = 'draft',
           source_kind = EXCLUDED.source_kind,
           source_reference = EXCLUDED.source_reference,
           reviewed_by_subject = NULL,
           approved_by_subject = NULL,
           reviewed_at = NULL,
           approved_at = NULL,
           updated_at = now(),
           row_version = sermon_transcripts.row_version + 1`,
        [
          bundle.targetSermonId,
          bundle.transcript.bodyText,
          bundle.transcript.provenance.sourceKind,
          bundle.transcript.provenance.sourceReference
        ]
      );
    }
    if (!hasApprovedQuestions) {
      await client.query("DELETE FROM sermon_question_answers WHERE sermon_id = $1", [
        bundle.targetSermonId
      ]);
      for (const [index, item] of bundle.questionAnswers.entries()) {
        await client.query(
          `INSERT INTO sermon_question_answers (
             sermon_id, question_text, answer_text, display_order, status,
             source_kind, source_reference
           ) VALUES ($1, $2, $3, $4, 'draft', $5, $6)`,
          [
            bundle.targetSermonId,
            item.question,
            item.answer,
            index + 1,
            item.provenance.sourceKind,
            item.provenance.sourceReference
          ]
        );
      }
    }
    await client.query(
      `UPDATE sermons
       SET updated_at = now(), updated_by_subject = $2, row_version = row_version + 1
       WHERE id = $1`,
      [bundle.targetSermonId, actorSubject]
    );
    await client.query("SELECT refresh_sermon_enrichment($1)", [bundle.targetSermonId]);
    await client.query(
      `INSERT INTO sermon_enrichment_draft_imports (
         sermon_id, source_wordpress_id, content_checksum, imported_by_subject
       ) VALUES ($1, $2, $3, $4)
       ON CONFLICT (sermon_id) DO UPDATE SET
         source_wordpress_id = EXCLUDED.source_wordpress_id,
         content_checksum = EXCLUDED.content_checksum,
         imported_by_subject = EXCLUDED.imported_by_subject,
         imported_at = now()`,
      [bundle.targetSermonId, bundle.sourceWordPressId, checksum, actorSubject]
    );
    if (bundle.schemaVersion === 3) {
      const source = bundle.sourceProvenance;
      await client.query(
        `INSERT INTO sermon_enrichment_sources (
           sermon_id, provider, video_id, canonical_url, caption_language,
           caption_track_type, original_filename, source_content_sha256,
           retrieval_attribution, source_character_count, cleaned_character_count,
           apparent_completeness, uncertainty_marker_count, warnings,
           unresolved_passages, processing_version, imported_at, processed_at,
           processing_duration_ms, estimated_review_minutes,
           manual_attention_required, accuracy_review_status
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
           $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20, $21, $22
         )
         ON CONFLICT (sermon_id) DO UPDATE SET
           provider = EXCLUDED.provider,
           video_id = EXCLUDED.video_id,
           canonical_url = EXCLUDED.canonical_url,
           caption_language = EXCLUDED.caption_language,
           caption_track_type = EXCLUDED.caption_track_type,
           original_filename = EXCLUDED.original_filename,
           source_content_sha256 = EXCLUDED.source_content_sha256,
           retrieval_attribution = EXCLUDED.retrieval_attribution,
           source_character_count = EXCLUDED.source_character_count,
           cleaned_character_count = EXCLUDED.cleaned_character_count,
           apparent_completeness = EXCLUDED.apparent_completeness,
           uncertainty_marker_count = EXCLUDED.uncertainty_marker_count,
           warnings = EXCLUDED.warnings,
           unresolved_passages = EXCLUDED.unresolved_passages,
           processing_version = EXCLUDED.processing_version,
           imported_at = EXCLUDED.imported_at,
           processed_at = EXCLUDED.processed_at,
           processing_duration_ms = EXCLUDED.processing_duration_ms,
           estimated_review_minutes = EXCLUDED.estimated_review_minutes,
           manual_attention_required = EXCLUDED.manual_attention_required,
           accuracy_review_status = EXCLUDED.accuracy_review_status,
           updated_at = now()`,
        [
          bundle.targetSermonId,
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
          source.accuracyReviewStatus
        ]
      );
    }
    await client.query(
      `INSERT INTO audit_events (
         actor_subject, actor_role, action, entity_type, entity_id,
         changed_fields, request_correlation_id, outcome
       ) VALUES ($1, 'system', 'sermon.enrichment_draft_imported', 'sermon', $2,
         '["summary","transcript","questionAnswers"]'::jsonb, $3, 'succeeded')`,
      [actorSubject, bundle.targetSermonId, `enrichment-${checksum.slice(0, 16)}`]
    );
    await client.query("COMMIT");
    return {
      sourceWordPressId: bundle.sourceWordPressId,
      targetSermonId: bundle.targetSermonId,
      outcome: "imported_as_draft",
      descriptionStatus: sermon.summary_status === "approved" ? "approved" : "draft",
      transcriptStatus: existingTranscript?.status === "approved" ? "approved" : "draft",
      questionAnswerCount: bundle.questionAnswers.length,
      warnings: [
        ...(bundle.schemaVersion === 3 ? bundle.sourceProvenance.warnings : []),
        {
          code: "human_approval_required",
          safeDetail: "Imported content remains a draft until an administrator reviews and approves it."
        }
      ]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

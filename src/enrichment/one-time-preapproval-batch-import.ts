import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  inspectOneTimePreapprovalValidationRetry,
  oneTimePreapprovalDraftArtifactSchema,
  validateOneTimePreapprovalDraftArtifact,
  type OneTimePreapprovalBatchAuthorization,
  type OneTimePreapprovalDraftArtifact
} from "./one-time-preapproval-batch";
import { groundedSermonEnrichmentSourceReference } from "./sermon-enrichment-policy";
import {
  secondFixedBatchAudioWarning,
  secondFixedBatchDecisionId,
  secondFixedBatchDraftArtifactSchema,
  secondFixedBatchProcessingVersion,
  toD151ValidationCompatibilityArtifact,
  validateSecondFixedBatchDraftArtifact,
  type SecondFixedBatchAuthorization
} from "./second-fixed-batch";
import {
  thirdFixedBatchAudioWarning,
  thirdFixedBatchDecisionId,
  thirdFixedBatchDraftArtifactSchema,
  thirdFixedBatchProcessingVersion,
  toD151ValidationCompatibilityArtifact as toD154ValidationCompatibilityArtifact,
  validateThirdFixedBatchDraftArtifact,
  type ThirdFixedBatchAuthorization
} from "./third-fixed-batch";

export const oneTimePreapprovalImportActor = "local-d151-private-batch-importer" as const;
export const oneTimePreapprovalImportProcessingVersion = "phase3b2c-evaluation-36-d151-d152-v1" as const;
export const secondFixedBatchImportActor = "local-d153-private-batch-importer" as const;
export const thirdFixedBatchImportActor = "local-d154-private-batch-importer" as const;

interface PrivateBatchImportProfile {
  exceptionId: string;
  actor: string;
  processingVersion: string;
  sourceStatus: string;
  migrationSourceSystem: string;
  migrationReasonCode: string;
  auditAction: string;
  correlationPrefix: string;
  slugPrefix: string;
  sermonIdNamespace: string;
  sourceRecordKeyPrefix: string;
  audioWarningCode: string;
  warnings: ReadonlyArray<{ code: string; safeDetail: string }>;
}

const d151ImportProfile: PrivateBatchImportProfile = {
  exceptionId: "D-151",
  actor: oneTimePreapprovalImportActor,
  processingVersion: oneTimePreapprovalImportProcessingVersion,
  sourceStatus: "phase3b2c_evaluation_36_private",
  migrationSourceSystem: "phase3b2c_evaluation_36",
  migrationReasonCode: "authorised_d151_d152_private_batch",
  auditAction: "sermon.d151_private_draft_imported",
  correlationPrefix: "d151",
  slugPrefix: "evaluation-36",
  sermonIdNamespace: "saving-grace-d151-private-sermon",
  sourceRecordKeyPrefix: "authorised-record",
  audioWarningCode: "audio_track_type_unverified",
  warnings: [
    { code: "audio_track_type_unverified", safeDetail: "The official API reported an unknown audio-track type under the bounded D-152 fallback." },
    { code: "primary_audio_association_unconfirmed", safeDetail: "YouTube did not confirm primary-audio association; administrator verification remains required." },
    { code: "source_transcript_unapproved", safeDetail: "D-151 permits private draft generation before transcript approval for this fixed manifest only." },
    { code: "administrator_accuracy_review_required", safeDetail: "The transcript and all dependent generated content require administrator review." },
    { code: "model_revision_unavailable_limited_reproducibility", safeDetail: "The interactive runtime did not expose an immutable model revision." }
  ]
};

export const secondFixedBatchImportProfile = Object.freeze({
  exceptionId: secondFixedBatchDecisionId,
  actor: secondFixedBatchImportActor,
  processingVersion: secondFixedBatchProcessingVersion,
  sourceStatus: "phase3b2c_evaluation_36_batch_2_private",
  migrationSourceSystem: "phase3b2c_evaluation_36_batch_2",
  migrationReasonCode: "authorised_d153_private_batch",
  auditAction: "sermon.d153_private_draft_imported",
  correlationPrefix: "d153",
  slugPrefix: "evaluation-36-batch-2",
  sermonIdNamespace: "saving-grace-d153-private-sermon",
  sourceRecordKeyPrefix: "authorised-record",
  audioWarningCode: secondFixedBatchAudioWarning,
  warnings: [
    { code: secondFixedBatchAudioWarning, safeDetail: "D-153 accepted an otherwise eligible caption whose audio-track association was reported as unknown; primary audio was not confirmed." },
    { code: "primary_audio_association_unconfirmed", safeDetail: "YouTube did not confirm primary-audio association; administrator verification remains required." },
    { code: "source_transcript_unapproved", safeDetail: "D-153 permits private draft generation before transcript approval for this exact fixed manifest only." },
    { code: "automated_punctuation_and_paragraphing_requires_review", safeDetail: "Automated punctuation and paragraphing require administrator accuracy review." },
    { code: "administrator_accuracy_review_required", safeDetail: "The transcript and all dependent generated content require administrator review." },
    { code: "model_revision_unavailable_limited_reproducibility", safeDetail: "The interactive runtime did not expose an immutable model revision." }
  ]
} satisfies PrivateBatchImportProfile);

export const thirdFixedBatchImportProfile = Object.freeze({
  exceptionId: thirdFixedBatchDecisionId,
  actor: thirdFixedBatchImportActor,
  processingVersion: thirdFixedBatchProcessingVersion,
  sourceStatus: "phase3b2c_evaluation_36_batch_3_private",
  migrationSourceSystem: "phase3b2c_evaluation_36_batch_3",
  migrationReasonCode: "authorised_d154_private_batch",
  auditAction: "sermon.d154_private_draft_imported",
  correlationPrefix: "d154",
  slugPrefix: "evaluation-36-batch-3",
  sermonIdNamespace: "saving-grace-d154-private-sermon",
  sourceRecordKeyPrefix: "authorised-record",
  audioWarningCode: thirdFixedBatchAudioWarning,
  warnings: [
    { code: thirdFixedBatchAudioWarning, safeDetail: "D-154 accepted an otherwise eligible caption whose audio-track association was reported as unknown; primary audio was not confirmed." },
    { code: "primary_audio_association_unconfirmed", safeDetail: "YouTube did not confirm primary-audio association; administrator verification remains required." },
    { code: "source_transcript_unapproved", safeDetail: "D-154 permits private draft generation before transcript approval for this exact fixed manifest only." },
    { code: "automated_punctuation_and_paragraphing_requires_review", safeDetail: "Automated punctuation and paragraphing require administrator accuracy review." },
    { code: "administrator_accuracy_review_required", safeDetail: "The transcript and all dependent generated content require administrator review." },
    { code: "model_revision_unavailable_limited_reproducibility", safeDetail: "The interactive runtime did not expose an immutable model revision." }
  ]
} satisfies PrivateBatchImportProfile);

export interface OneTimePreapprovalImportMetadata {
  title: string;
  serviceDate: string;
  captionId: string;
  captionLanguage: "en";
  captionTrackKind: "standard" | "asr";
  captionSourceSha256: string;
  captionFilename: string;
  captionCharacterCount: number;
  transcriptCharacterCount: number;
  transcriptWordCount: number;
  apparentCompleteness: "apparently_complete" | "requires_manual_review";
  importedAt: string;
  processedAt: string;
}

export interface OneTimePreapprovalImportResult {
  sourceWordPressId: number;
  sermonId: string;
  outcome: "imported_as_private_draft" | "repaired_after_validation_retry" | "unchanged";
  questionAnswerCount: number;
}

export interface OneTimePreapprovalValidationRetry {
  previousArtifact: unknown;
}

interface PrivateBatchImportOptions {
  profile?: PrivateBatchImportProfile;
  contentChecksum?: string;
}

function uuidFrom(value: string): string {
  const bytes = Buffer.from(createHash("sha256").update(value).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function deterministicPrivateBatchSermonId(videoId: string, namespace: string): string {
  if (!/^[A-Za-z0-9_-]{11}$/u.test(videoId)) throw new Error("one_time_batch_video_identity_invalid");
  return uuidFrom(`${namespace}\n${videoId}`);
}

export function deterministicOneTimePreapprovalSermonId(videoId: string): string {
  return deterministicPrivateBatchSermonId(videoId, d151ImportProfile.sermonIdNamespace);
}

export function deterministicSecondFixedBatchSermonId(videoId: string): string {
  return deterministicPrivateBatchSermonId(videoId, secondFixedBatchImportProfile.sermonIdNamespace);
}

export function deterministicThirdFixedBatchSermonId(videoId: string): string {
  return deterministicPrivateBatchSermonId(videoId, thirdFixedBatchImportProfile.sermonIdNamespace);
}

export function oneTimePreapprovalGroundedSourceReference(artifact: OneTimePreapprovalDraftArtifact): string {
  return groundedSermonEnrichmentSourceReference(
    artifact.transcript.sourceTranscriptSha256,
    artifact.transcript.groundingRevisionId,
    artifact.generator.outputSha256
  );
}

function transcriptSourceReference(
  artifact: OneTimePreapprovalDraftArtifact,
  metadata: OneTimePreapprovalImportMetadata,
  profile: PrivateBatchImportProfile = d151ImportProfile
): string {
  return `youtube-api:${artifact.target.videoId}:${metadata.captionSourceSha256}:${profile.processingVersion}`;
}

async function ensureMigrationReceipt(
  client: PoolClient,
  authorization: OneTimePreapprovalBatchAuthorization,
  artifact: OneTimePreapprovalDraftArtifact,
  sermonId: string,
  metadata: OneTimePreapprovalImportMetadata,
  profile: PrivateBatchImportProfile = d151ImportProfile
): Promise<void> {
  const existingRun = await client.query<{ id: string }>(
    `SELECT id FROM migration_runs
     WHERE migration_version = $1 AND source_snapshot_id = $2 AND dry_run = false AND status = 'succeeded'
     ORDER BY started_at LIMIT 1`,
    [profile.processingVersion, authorization.manifestSha256]
  );
  let runId = existingRun.rows[0]?.id;
  if (!runId) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO migration_runs (
         migration_version, source_snapshot_id, dry_run, status, completed_at, summary
       ) VALUES ($1, $2, false, 'succeeded', now(), $3::jsonb)
       RETURNING id`,
      [
        profile.processingVersion,
        authorization.manifestSha256,
        JSON.stringify({ scope: "private_manifest_bound_36", exceptionId: profile.exceptionId })
      ]
    );
    runId = inserted.rows[0]?.id;
  }
  if (!runId) throw new Error("one_time_batch_migration_run_missing");
  const canonicalUrl = `https://www.youtube.com/watch?v=${artifact.target.videoId}`;
  await client.query(
    `INSERT INTO migration_records (
       migration_run_id, source_system, source_entity_type, source_id, source_status,
       source_url, source_checksum_sha256, target_entity_type, target_id, outcome, reason_code
     ) VALUES ($1, $2, 'official_caption', $3, 'draft', $4, $5,
       'sermon', $6, 'included', $7)
     ON CONFLICT (migration_run_id, source_system, source_entity_type, source_id) DO NOTHING`,
    [
      runId,
      profile.migrationSourceSystem,
      String(artifact.target.sourceWordPressId),
      canonicalUrl,
      metadata.captionSourceSha256,
      sermonId,
      profile.migrationReasonCode
    ]
  );
  const exact = await client.query<{ matches: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM migration_records
       WHERE migration_run_id = $1 AND source_system = $2
         AND source_entity_type = 'official_caption' AND source_id = $3
         AND source_status = 'draft' AND source_url = $4 AND source_checksum_sha256 = $5
         AND target_entity_type = 'sermon' AND target_id = $6 AND outcome = 'included'
         AND reason_code = $7
     ) AS matches`,
    [
      runId,
      profile.migrationSourceSystem,
      String(artifact.target.sourceWordPressId),
      canonicalUrl,
      metadata.captionSourceSha256,
      sermonId,
      profile.migrationReasonCode
    ]
  );
  if (!exact.rows[0]?.matches) throw new Error("one_time_batch_migration_receipt_conflict");
}

async function verifyExisting(
  client: PoolClient,
  artifact: OneTimePreapprovalDraftArtifact,
  sermonId: string,
  transcript: string,
  groundedReference: string,
  metadata: OneTimePreapprovalImportMetadata,
  profile: PrivateBatchImportProfile = d151ImportProfile,
  contentChecksum: string = artifact.integrity.canonicalSha256
): Promise<boolean> {
  const result = await client.query<{ matches: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM sermons sermon
       JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
       JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
       JOIN sermon_enrichment_draft_imports receipt ON receipt.sermon_id = sermon.id
       JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
       WHERE sermon.id = $1 AND sermon.source_wordpress_id = $2
         AND sermon.status = 'draft' AND sermon.published_at IS NULL
         AND sermon.source_status = $17
         AND sermon.title = $12 AND sermon.service_date = $13::date
         AND sermon.summary = $3 AND sermon.summary_status = 'draft'
         AND sermon.summary_source_kind = 'generated_draft'
         AND sermon.summary_source_reference = $4
         AND transcript.body_text = $5 AND transcript.status = 'draft'
         AND transcript.source_kind = 'caption' AND transcript.source_reference = $14
         AND transcript.grounding_revision_id = $6
         AND encode(digest(convert_to(transcript.body_text, 'UTF8'), 'sha256'), 'hex') = $7
         AND source.video_id = $8 AND source.retrieval_attribution = 'authorised_youtube_data_api'
         AND source.processing_version = $9
         AND source.source_content_sha256 = $15
         AND source.caption_language = 'en' AND source.caption_track_type = $16
         AND source.manual_attention_required AND source.accuracy_review_status = 'required'
         AND EXISTS (SELECT 1 FROM jsonb_array_elements(source.warnings) warning
           WHERE warning->>'code' = $18)
         AND receipt.content_checksum = $10
         AND review.identity_status = 'pending' AND review.current_stage = 1
         AND review.completed_at IS NULL AND review.expected_item_count = 0
         AND review.expected_transcript_sha256 = $7 AND review.expected_transcript_row_version = transcript.row_version
         AND review.empty_item_set_acknowledged_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM sermon_enrichment_review_items item WHERE item.sermon_id = sermon.id)
         AND EXISTS (SELECT 1 FROM sermon_media media WHERE media.sermon_id = sermon.id
           AND media.provider = 'youtube' AND media.external_id = $8
           AND media.canonical_url = 'https://www.youtube.com/watch?v=' || $8
           AND media.is_primary AND media.availability_status = 'available')
         AND NOT EXISTS (
           SELECT 1 FROM sermon_question_answers qa
           WHERE qa.sermon_id = sermon.id AND (
             qa.status <> 'draft' OR qa.source_kind <> 'generated_draft' OR qa.source_reference <> $4
           )
         )
         AND (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = sermon.id) = $11
     ) AS matches`,
    [
      sermonId,
      artifact.target.sourceWordPressId,
      artifact.content.description.bodyText,
      groundedReference,
      transcript,
      artifact.transcript.groundingRevisionId,
      artifact.transcript.sourceTranscriptSha256,
      artifact.target.videoId,
      profile.processingVersion,
      contentChecksum,
      artifact.content.questionAnswers.length,
      metadata.title,
      metadata.serviceDate,
      transcriptSourceReference(artifact, metadata),
      metadata.captionSourceSha256,
      metadata.captionTrackKind === "asr" ? "automatic" : "manual",
      profile.sourceStatus,
      profile.audioWarningCode
    ]
  );
  if (result.rows[0]?.matches !== true) return false;
  const questions = await client.query<{ question_text: string; answer_text: string; display_order: number }>(
    `SELECT question_text, answer_text, display_order
     FROM sermon_question_answers WHERE sermon_id = $1 ORDER BY display_order`,
    [sermonId]
  );
  return questions.rows.length === artifact.content.questionAnswers.length &&
    questions.rows.every((row, index) => {
      const expected = artifact.content.questionAnswers[index];
      return expected !== undefined && row.display_order === expected.displayOrder &&
        row.question_text === expected.question && row.answer_text === expected.answer;
    });
}

async function diagnosePrivateBatchPostcondition(
  client: PoolClient,
  artifact: OneTimePreapprovalDraftArtifact,
  sermonId: string,
  transcript: string,
  groundedReference: string,
  metadata: OneTimePreapprovalImportMetadata,
  profile: PrivateBatchImportProfile,
  contentChecksum: string
): Promise<string[]> {
  const result = await client.query<Record<string, boolean>>(
    `SELECT
       sermon.status = 'draft' AND sermon.published_at IS NULL AND sermon.source_status = $13 AS sermon_private,
       sermon.source_wordpress_id = $18 AS sermon_source_identity,
       sermon.title = $8 AND sermon.service_date = $9::date AS sermon_identity,
       sermon.summary = $2 AND sermon.summary_status = 'draft' AND sermon.summary_source_kind = 'generated_draft'
         AND sermon.summary_source_reference = $3 AS description,
       transcript.body_text = $4 AND transcript.status = 'draft' AND transcript.source_kind = 'caption'
         AND transcript.source_reference = $10 AND transcript.grounding_revision_id = $5 AS transcript_shape,
       encode(digest(convert_to(transcript.body_text, 'UTF8'), 'sha256'), 'hex') = $6 AS transcript_hash,
       source.video_id = $7 AND source.retrieval_attribution = 'authorised_youtube_data_api'
         AND source.processing_version = $11 AND source.source_content_sha256 = $12
         AND source.caption_language = 'en' AND source.caption_track_type = $14
         AND source.manual_attention_required AND source.accuracy_review_status = 'required' AS source_provenance,
       EXISTS (SELECT 1 FROM jsonb_array_elements(source.warnings) warning WHERE warning->>'code' = $15) AS source_warning,
       receipt.content_checksum = $16 AS import_receipt,
       review.identity_status = 'pending' AND review.current_stage = 1 AND review.completed_at IS NULL
         AND review.expected_item_count = 0 AND review.expected_transcript_sha256 = $6
         AND review.expected_transcript_row_version = transcript.row_version
         AND review.empty_item_set_acknowledged_at IS NULL AS review_gate,
       NOT EXISTS (SELECT 1 FROM sermon_enrichment_review_items item WHERE item.sermon_id = sermon.id) AS no_review_items,
       EXISTS (SELECT 1 FROM sermon_media media WHERE media.sermon_id = sermon.id AND media.provider = 'youtube'
         AND media.external_id = $7 AND media.canonical_url = 'https://www.youtube.com/watch?v=' || $7
         AND media.is_primary AND media.availability_status = 'available') AS media,
       NOT EXISTS (SELECT 1 FROM sermon_question_answers qa WHERE qa.sermon_id = sermon.id AND
         (qa.status <> 'draft' OR qa.source_kind <> 'generated_draft' OR qa.source_reference <> $3)) AS qa_shape,
       (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = sermon.id) = $17 AS qa_count
     FROM sermons sermon
     LEFT JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
     LEFT JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
     LEFT JOIN sermon_enrichment_draft_imports receipt ON receipt.sermon_id = sermon.id
     LEFT JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
     WHERE sermon.id = $1`,
    [
      sermonId,
      artifact.content.description.bodyText,
      groundedReference,
      transcript,
      artifact.transcript.groundingRevisionId,
      artifact.transcript.sourceTranscriptSha256,
      artifact.target.videoId,
      metadata.title,
      metadata.serviceDate,
      transcriptSourceReference(artifact, metadata, profile),
      profile.processingVersion,
      metadata.captionSourceSha256,
      profile.sourceStatus,
      metadata.captionTrackKind === "asr" ? "automatic" : "manual",
      profile.audioWarningCode,
      contentChecksum,
      artifact.content.questionAnswers.length,
      artifact.target.sourceWordPressId
    ]
  );
  const row = result.rows[0];
  if (!row) return ["sermon_row_missing"];
  const issues = Object.entries(row).filter(([, passed]) => passed !== true).map(([name]) => name);
  const questions = await client.query<{ question_text: string; answer_text: string; display_order: number }>(
    `SELECT question_text, answer_text, display_order
     FROM sermon_question_answers WHERE sermon_id = $1 ORDER BY display_order`,
    [sermonId]
  );
  if (questions.rows.length !== artifact.content.questionAnswers.length) issues.push("qa_exact_count");
  questions.rows.forEach((question, index) => {
    const expected = artifact.content.questionAnswers[index];
    if (!expected || question.display_order !== expected.displayOrder) issues.push(`qa_order_${index + 1}`);
    if (!expected || question.question_text !== expected.question) issues.push(`qa_question_${index + 1}`);
    if (!expected || question.answer_text !== expected.answer) issues.push(`qa_answer_${index + 1}`);
  });
  return issues;
}

async function verifyPrivateBatchExisting(
  client: PoolClient,
  artifact: OneTimePreapprovalDraftArtifact,
  sermonId: string,
  transcript: string,
  groundedReference: string,
  metadata: OneTimePreapprovalImportMetadata,
  profile: PrivateBatchImportProfile,
  contentChecksum: string
): Promise<boolean> {
  if (await verifyExisting(client, artifact, sermonId, transcript, groundedReference, metadata, profile, contentChecksum)) {
    return true;
  }
  if (profile.exceptionId !== secondFixedBatchDecisionId && profile.exceptionId !== thirdFixedBatchDecisionId) return false;
  return (await diagnosePrivateBatchPostcondition(
    client, artifact, sermonId, transcript, groundedReference, metadata, profile, contentChecksum
  )).length === 0;
}

async function applyAuthorisedValidationRetry(
  client: PoolClient,
  artifact: OneTimePreapprovalDraftArtifact,
  previousInput: unknown,
  sermonId: string,
  transcript: string,
  groundedReference: string,
  metadata: OneTimePreapprovalImportMetadata
): Promise<boolean> {
  const previous = oneTimePreapprovalDraftArtifactSchema.parse(previousInput);
  const inspection = inspectOneTimePreapprovalValidationRetry(previous, artifact);
  if (!inspection.valid) {
    throw new Error(`one_time_batch_validation_retry_not_authorised:${inspection.issues.join(",")}`);
  }
  const previousReference = oneTimePreapprovalGroundedSourceReference(previous);
  if (!(await verifyExisting(client, previous, sermonId, transcript, previousReference, metadata))) {
    throw new Error("one_time_batch_validation_retry_previous_state_mismatch");
  }
  const untouched = await client.query<{ safe: boolean }>(
    `SELECT
       sermon.summary_status = 'draft'
       AND sermon.summary_reviewed_by_subject IS NULL AND sermon.summary_reviewed_at IS NULL
       AND sermon.summary_approved_by_subject IS NULL AND sermon.summary_approved_at IS NULL
       AND transcript.status = 'draft'
       AND transcript.reviewed_by_subject IS NULL AND transcript.reviewed_at IS NULL
       AND transcript.approved_by_subject IS NULL AND transcript.approved_at IS NULL
       AND review.identity_status = 'pending' AND review.current_stage = 1
       AND review.completed_by_subject IS NULL AND review.completed_at IS NULL
       AND review.empty_item_set_acknowledged_by_subject IS NULL
       AND review.empty_item_set_acknowledged_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM sermon_question_answers qa
         WHERE qa.sermon_id = sermon.id AND (
           qa.status <> 'draft' OR qa.reviewed_by_subject IS NOT NULL OR qa.reviewed_at IS NOT NULL
           OR qa.approved_by_subject IS NOT NULL OR qa.approved_at IS NOT NULL
         )
       )
       AND NOT EXISTS (
         SELECT 1 FROM sermon_enrichment_review_items item WHERE item.sermon_id = sermon.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM audit_events event
         WHERE event.entity_id = sermon.id AND event.actor_role IN ('administrator', 'content_manager')
       ) AS safe
     FROM sermons sermon
     JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
     JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
     WHERE sermon.id = $1`,
    [sermonId]
  );
  if (untouched.rows.length !== 1 || untouched.rows[0]?.safe !== true) {
    throw new Error("one_time_batch_validation_retry_administrator_progress_detected");
  }
  const summary = await client.query(
    `UPDATE sermons
     SET summary_source_reference = $2, summary_updated_at = now(), updated_at = now(),
         updated_by_subject = $3, row_version = row_version + 1
     WHERE id = $1 AND summary_source_reference = $4`,
    [sermonId, groundedReference, oneTimePreapprovalImportActor, previousReference]
  );
  if (summary.rowCount !== 1) throw new Error("one_time_batch_validation_retry_summary_update_mismatch");
  for (const item of artifact.content.questionAnswers) {
    const changed = inspection.changedQuestionOrders.includes(item.displayOrder);
    const result = await client.query(
      `UPDATE sermon_question_answers
       SET question_text = CASE WHEN $4 THEN $2 ELSE question_text END,
           source_reference = $3, updated_at = now(), row_version = row_version + 1
       WHERE sermon_id = $1 AND display_order = $5 AND source_reference = $6`,
      [sermonId, item.question, groundedReference, changed, item.displayOrder, previousReference]
    );
    if (result.rowCount !== 1) throw new Error("one_time_batch_validation_retry_question_update_mismatch");
  }
  const receipt = await client.query(
    `UPDATE sermon_enrichment_draft_imports
     SET content_checksum = $2, imported_at = now(), imported_by_subject = $3
     WHERE sermon_id = $1 AND content_checksum = $4`,
    [sermonId, artifact.integrity.canonicalSha256, oneTimePreapprovalImportActor, previous.integrity.canonicalSha256]
  );
  if (receipt.rowCount !== 1) throw new Error("one_time_batch_validation_retry_receipt_update_mismatch");
  await client.query("SELECT refresh_sermon_enrichment($1)", [sermonId]);
  await client.query(
    `INSERT INTO audit_events (
       actor_subject, actor_role, action, entity_type, entity_id,
       changed_fields, request_correlation_id, outcome
     ) VALUES ($1, 'system', 'sermon.d151_validation_retry_repaired', 'sermon', $2,
       '["questionOpenings","groundedSourceReference","supportEvidence","contentChecksum"]'::jsonb,
       $3, 'succeeded')`,
    [oneTimePreapprovalImportActor, sermonId, `d151-validation-${artifact.integrity.canonicalSha256.slice(0, 16)}`]
  );
  return verifyExisting(client, artifact, sermonId, transcript, groundedReference, metadata);
}

export async function importOneTimePreapprovalPrivateDraft(
  pool: Pool,
  input: unknown,
  authorization: OneTimePreapprovalBatchAuthorization,
  transcript: string,
  metadata: OneTimePreapprovalImportMetadata,
  validationRetry?: OneTimePreapprovalValidationRetry,
  options: PrivateBatchImportOptions = {}
): Promise<OneTimePreapprovalImportResult> {
  const artifact = oneTimePreapprovalDraftArtifactSchema.parse(input);
  const profile = options.profile ?? d151ImportProfile;
  const contentChecksum = options.contentChecksum ?? artifact.integrity.canonicalSha256;
  if (validationRetry && profile.exceptionId !== d151ImportProfile.exceptionId) {
    throw new Error("one_time_batch_validation_retry_profile_not_authorised");
  }
  const record = authorization.orderedRecords[artifact.target.sequence - 1];
  if (!record || record.sourceWordPressId !== artifact.target.sourceWordPressId || record.videoId !== artifact.target.videoId) {
    throw new Error("one_time_batch_import_target_out_of_scope");
  }
  const validation = validateOneTimePreapprovalDraftArtifact(
    artifact,
    authorization,
    { bodyText: transcript, sha256: artifact.transcript.sourceTranscriptSha256 }
  );
  if (!validation.valid || validation.stale) throw new Error(`one_time_batch_import_validation_failed:${validation.issues.join(",")}`);
  const sermonId = deterministicPrivateBatchSermonId(artifact.target.videoId, profile.sermonIdNamespace);
  const groundedReference = oneTimePreapprovalGroundedSourceReference(artifact);
  const captionReference = transcriptSourceReference(artifact, metadata, profile);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const collision = await client.query<{ id: string; source_wordpress_id: string }>(
      `SELECT sermon.id, sermon.source_wordpress_id
       FROM sermons sermon
       WHERE sermon.id = $1 OR sermon.source_wordpress_id = $2
          OR EXISTS (SELECT 1 FROM sermon_media media WHERE media.sermon_id = sermon.id AND media.provider = 'youtube' AND media.external_id = $3)
       FOR UPDATE`,
      [sermonId, artifact.target.sourceWordPressId, artifact.target.videoId]
    );
    if (collision.rows.length > 0) {
      if (collision.rows.length !== 1 || collision.rows[0]!.id !== sermonId ||
        Number(collision.rows[0]!.source_wordpress_id) !== artifact.target.sourceWordPressId) {
        throw new Error("one_time_batch_existing_identity_or_content_conflict");
      }
      if (await verifyPrivateBatchExisting(client, artifact, sermonId, transcript, groundedReference, metadata, profile, contentChecksum)) {
        await client.query("COMMIT");
        return { sourceWordPressId: artifact.target.sourceWordPressId, sermonId, outcome: "unchanged", questionAnswerCount: artifact.content.questionAnswers.length };
      }
      if (!validationRetry || !(await applyAuthorisedValidationRetry(
        client,
        artifact,
        validationRetry.previousArtifact,
        sermonId,
        transcript,
        groundedReference,
        metadata
      ))) {
        throw new Error("one_time_batch_existing_identity_or_content_conflict");
      }
      await client.query("COMMIT");
      return { sourceWordPressId: artifact.target.sourceWordPressId, sermonId, outcome: "repaired_after_validation_retry", questionAnswerCount: artifact.content.questionAnswers.length };
    }
    await client.query(
      `INSERT INTO sermons (
         id, title, slug, summary, status, service_date, source_wordpress_id, source_status,
         historical_backfill_required, summary_status, summary_source_kind, summary_source_reference,
         summary_created_at, summary_updated_at, created_by_subject, updated_by_subject
       ) VALUES ($1, $2, $3, $4, 'draft', $5::date, $6, $9,
         true, 'draft', 'generated_draft', $7, now(), now(), $8, $8)`,
      [
        sermonId,
        metadata.title,
        `${profile.slugPrefix}-${artifact.target.sourceWordPressId}`,
        artifact.content.description.bodyText,
        metadata.serviceDate,
        artifact.target.sourceWordPressId,
        groundedReference,
        profile.actor,
        profile.sourceStatus
      ]
    );
    await client.query(
      `INSERT INTO sermon_media (
         sermon_id, media_type, provider, external_id, canonical_url, title,
         is_primary, display_order, availability_status
       ) VALUES ($1, 'video', 'youtube', $2, $3, $4, true, 0, 'available')`,
      [sermonId, artifact.target.videoId, `https://www.youtube.com/watch?v=${artifact.target.videoId}`, `${metadata.title} — private evaluation source`]
    );
    await client.query(
      `INSERT INTO sermon_transcripts (
         sermon_id, body_text, status, source_kind, source_reference, grounding_revision_id
       ) VALUES ($1, $2, 'draft', 'caption', $3, $4)`,
      [sermonId, transcript, captionReference, artifact.transcript.groundingRevisionId]
    );
    for (const item of artifact.content.questionAnswers) {
      await client.query(
        `INSERT INTO sermon_question_answers (
           sermon_id, question_text, answer_text, display_order, status, source_kind, source_reference
         ) VALUES ($1, $2, $3, $4, 'draft', 'generated_draft', $5)`,
        [sermonId, item.question, item.answer, item.displayOrder, groundedReference]
      );
    }
    const warnings = profile.warnings;
    await client.query(
      `INSERT INTO sermon_enrichment_sources (
         sermon_id, provider, video_id, canonical_url, caption_language, caption_track_type,
         original_filename, source_content_sha256, retrieval_attribution, source_character_count,
         cleaned_character_count, apparent_completeness, uncertainty_marker_count, warnings,
         unresolved_passages, processing_version, imported_at, processed_at, processing_duration_ms,
         estimated_review_minutes, manual_attention_required, accuracy_review_status
       ) VALUES ($1, 'youtube', $2, $3, $4, $5, $6, $7, 'authorised_youtube_data_api', $8,
         $9, $10, 0, $11::jsonb, '[]'::jsonb, $12, $13, $14, 0, $15, true, 'required')`,
      [
        sermonId,
        artifact.target.videoId,
        `https://www.youtube.com/watch?v=${artifact.target.videoId}`,
        metadata.captionLanguage,
        metadata.captionTrackKind === "asr" ? "automatic" : "manual",
        metadata.captionFilename,
        metadata.captionSourceSha256,
        metadata.captionCharacterCount,
        metadata.transcriptCharacterCount,
        metadata.apparentCompleteness,
        JSON.stringify(warnings),
        profile.processingVersion,
        metadata.importedAt,
        metadata.processedAt,
        Math.max(35, Math.ceil(metadata.transcriptWordCount / 180) + 25)
      ]
    );
    await ensureMigrationReceipt(client, authorization, artifact, sermonId, metadata, profile);
    await client.query(
      `INSERT INTO sermon_enrichment_draft_imports (
         sermon_id, source_wordpress_id, content_checksum, imported_by_subject
       ) VALUES ($1, $2, $3, $4)`,
      [sermonId, artifact.target.sourceWordPressId, contentChecksum, profile.actor]
    );
    await client.query("SELECT refresh_sermon_enrichment($1)", [sermonId]);
    await client.query(
      `UPDATE sermon_enrichment_reviews review
       SET source_record_key = $2,
           expected_item_count = 0,
           expected_item_set_sha256 = encode(digest(convert_to('', 'UTF8'), 'sha256'), 'hex'),
           expected_transcript_sha256 = $3,
           expected_transcript_row_version = 1,
           atomic_schema_version = 1,
           updated_at = now(),
           updated_by_subject = $4,
           row_version = review.row_version + 1
       WHERE review.sermon_id = $1
         AND review.identity_status = 'pending'
         AND review.current_stage = 1
         AND review.completed_at IS NULL`,
      [sermonId, `${profile.sourceRecordKeyPrefix}-${artifact.target.sourceWordPressId}`, artifact.transcript.sourceTranscriptSha256, profile.actor]
    );
    await client.query(
      `INSERT INTO audit_events (
         actor_subject, actor_role, action, entity_type, entity_id,
         changed_fields, request_correlation_id, outcome
       ) VALUES ($1, 'system', $4, 'sermon', $2,
         '["summary","transcript","questionAnswers","privateProvenance"]'::jsonb, $3, 'succeeded')`,
      [profile.actor, sermonId, `${profile.correlationPrefix}-${contentChecksum.slice(0, 16)}`, profile.auditAction]
    );
    const complete = await verifyPrivateBatchExisting(client, artifact, sermonId, transcript, groundedReference, metadata, profile, contentChecksum);
    if (!complete) {
      const detail = profile.exceptionId === secondFixedBatchDecisionId || profile.exceptionId === thirdFixedBatchDecisionId
        ? await diagnosePrivateBatchPostcondition(client, artifact, sermonId, transcript, groundedReference, metadata, profile, contentChecksum)
        : [];
      throw new Error(`one_time_batch_import_postcondition_failed${detail.length > 0 ? `:${detail.join(",")}` : ""}`);
    }
    await client.query("COMMIT");
    return { sourceWordPressId: artifact.target.sourceWordPressId, sermonId, outcome: "imported_as_private_draft", questionAnswerCount: artifact.content.questionAnswers.length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function importSecondFixedBatchPrivateDraft(
  pool: Pool,
  input: unknown,
  authorization: SecondFixedBatchAuthorization,
  transcript: string,
  metadata: OneTimePreapprovalImportMetadata
): Promise<OneTimePreapprovalImportResult> {
  const artifact = secondFixedBatchDraftArtifactSchema.parse(input);
  const record = authorization.orderedRecords[artifact.target.sequence - 1];
  if (!record || record.sourceWordPressId !== artifact.target.sourceWordPressId ||
    record.videoId !== artifact.target.videoId || metadata.serviceDate !== record.serviceDate) {
    throw new Error("d153_import_target_or_metadata_out_of_scope");
  }
  const validation = validateSecondFixedBatchDraftArtifact(
    artifact,
    authorization,
    { bodyText: transcript, sha256: artifact.transcript.sourceTranscriptSha256 }
  );
  if (!validation.valid || validation.stale) {
    throw new Error(`d153_import_validation_failed:${validation.issues.join(",")}`);
  }
  const compatibilityArtifact = toD151ValidationCompatibilityArtifact(artifact);
  const compatibilityAuthorization: OneTimePreapprovalBatchAuthorization = {
    exceptionId: "D-151",
    manifestSha256: authorization.manifestSha256,
    governanceCommitHash: authorization.governanceCommitHash,
    orderedRecords: authorization.orderedRecords.map((item) => ({
      sequence: item.sequence,
      sourceWordPressId: item.sourceWordPressId,
      videoId: item.videoId,
      priorInspectionSha256: item.inventoryRowSha256,
      selectedCaption: { captionId: `d153-${item.sequence}`, language: "en", trackKind: "standard" },
      sourceSnapshot: {
        publicationStatus: item.publicationStatus,
        serviceDate: item.serviceDate,
        serviceDateAnomaly: "not_applicable",
        speakerTermIds: [],
        seriesTermIds: [],
        bibleBookTermIds: [],
        passageMetadataPresent: false,
        metadataAnomalyFlags: []
      }
    }))
  };
  return importOneTimePreapprovalPrivateDraft(
    pool,
    compatibilityArtifact,
    compatibilityAuthorization,
    transcript,
    metadata,
    undefined,
    { profile: secondFixedBatchImportProfile, contentChecksum: artifact.integrity.canonicalSha256 }
  );
}

export async function importThirdFixedBatchPrivateDraft(
  pool: Pool,
  input: unknown,
  authorization: ThirdFixedBatchAuthorization,
  transcript: string,
  metadata: OneTimePreapprovalImportMetadata
): Promise<OneTimePreapprovalImportResult> {
  const artifact = thirdFixedBatchDraftArtifactSchema.parse(input);
  const record = authorization.orderedRecords[artifact.target.sequence - 1];
  if (!record || record.sourceWordPressId !== artifact.target.sourceWordPressId ||
    record.videoId !== artifact.target.videoId || metadata.serviceDate !== record.serviceDate) {
    throw new Error("d154_import_target_or_metadata_out_of_scope");
  }
  const validation = validateThirdFixedBatchDraftArtifact(
    artifact,
    authorization,
    { bodyText: transcript, sha256: artifact.transcript.sourceTranscriptSha256 }
  );
  if (!validation.valid || validation.stale) {
    throw new Error(`d154_import_validation_failed:${validation.issues.join(",")}`);
  }
  const compatibilityArtifact = toD154ValidationCompatibilityArtifact(artifact);
  const compatibilityAuthorization: OneTimePreapprovalBatchAuthorization = {
    exceptionId: "D-151",
    manifestSha256: authorization.manifestSha256,
    governanceCommitHash: authorization.governanceCommitHash,
    orderedRecords: authorization.orderedRecords.map((item) => ({
      sequence: item.sequence,
      sourceWordPressId: item.sourceWordPressId,
      videoId: item.videoId,
      priorInspectionSha256: item.inventoryRowSha256,
      selectedCaption: { captionId: `d154-${item.sequence}`, language: "en", trackKind: "standard" },
      sourceSnapshot: {
        publicationStatus: item.publicationStatus,
        serviceDate: item.serviceDate,
        serviceDateAnomaly: "not_applicable",
        speakerTermIds: [],
        seriesTermIds: [],
        bibleBookTermIds: [],
        passageMetadataPresent: false,
        metadataAnomalyFlags: []
      }
    }))
  };
  return importOneTimePreapprovalPrivateDraft(
    pool,
    compatibilityArtifact,
    compatibilityAuthorization,
    transcript,
    metadata,
    undefined,
    { profile: thirdFixedBatchImportProfile, contentChecksum: artifact.integrity.canonicalSha256 }
  );
}

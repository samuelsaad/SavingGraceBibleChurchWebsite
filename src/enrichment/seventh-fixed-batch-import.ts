import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  seventhFixedBatchAudioWarning,
  seventhFixedBatchDecisionId,
  seventhFixedBatchDraftArtifactSchema,
  seventhFixedBatchProcessingVersion,
  toD151ValidationCompatibilityArtifact,
  validateSeventhFixedBatchDraftArtifact,
  type SeventhFixedBatchAuthorization,
} from "./seventh-fixed-batch";
import { type OneTimePreapprovalBatchAuthorization } from "./one-time-preapproval-batch";
import {
  importOneTimePreapprovalPrivateDraft,
  type OneTimePreapprovalImportMetadata,
  type OneTimePreapprovalImportResult,
} from "./one-time-preapproval-batch-import";
import { authorisedLocalDatabaseName } from "../migration/local-database-safety";

export const seventhFixedBatchImportActor =
  "local-d162-private-batch-importer" as const;

export const seventhFixedBatchImportProfile = Object.freeze({
  exceptionId: seventhFixedBatchDecisionId,
  actor: seventhFixedBatchImportActor,
  processingVersion: seventhFixedBatchProcessingVersion,
  sourceStatus: "phase3b2c_evaluation_36_batch_7_private",
  migrationSourceSystem: "phase3b2c_evaluation_36_batch_7",
  migrationReasonCode: "authorised_d162_private_batch",
  auditAction: "sermon.d162_private_draft_imported",
  correlationPrefix: "d162",
  slugPrefix: "evaluation-36-batch-7",
  sermonIdNamespace: "saving-grace-d162-private-sermon",
  sourceRecordKeyPrefix: "authorised-record",
  audioWarningCode: seventhFixedBatchAudioWarning,
  warnings: [
    {
      code: seventhFixedBatchAudioWarning,
      safeDetail:
        "D-162 accepted an otherwise eligible caption whose audio-track association was reported as unknown; primary audio was not confirmed.",
    },
    {
      code: "primary_audio_association_unconfirmed",
      safeDetail:
        "YouTube did not confirm primary-audio association; administrator verification remains required.",
    },
    {
      code: "source_transcript_unapproved",
      safeDetail:
        "D-162 permits private draft generation before transcript approval for this exact fixed manifest only.",
    },
    {
      code: "automated_punctuation_and_paragraphing_requires_review",
      safeDetail:
        "Automated punctuation and paragraphing require administrator accuracy review.",
    },
    {
      code: "administrator_accuracy_review_required",
      safeDetail:
        "The transcript and all dependent generated content require administrator review.",
    },
    {
      code: "model_revision_unavailable_limited_reproducibility",
      safeDetail:
        "The interactive runtime did not expose an immutable model revision.",
    },
  ],
});

export function deterministicSeventhFixedBatchSermonId(
  videoId: string,
): string {
  if (!/^[A-Za-z0-9_-]{11}$/u.test(videoId))
    throw new Error("d162_video_identity_invalid");
  const bytes = Buffer.from(
    createHash("sha256")
      .update(`${seventhFixedBatchImportProfile.sermonIdNamespace}\n${videoId}`)
      .digest()
      .subarray(0, 16),
  );
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function importSeventhFixedBatchPrivateDraft(
  pool: Pool,
  input: unknown,
  authorization: SeventhFixedBatchAuthorization,
  transcript: string,
  metadata: OneTimePreapprovalImportMetadata,
): Promise<OneTimePreapprovalImportResult> {
  const artifact = seventhFixedBatchDraftArtifactSchema.parse(input);
  if (
    process.env.ALLOW_LOCAL_DB_WRITE !== "1" ||
    pool.options.host !== "127.0.0.1" ||
    Number(pool.options.port) !== 5432
  )
    throw new Error("d162_local_write_gate_required");
  const expectedDatabase = authorisedLocalDatabaseName();
  const guard = await pool.query<{ safe: boolean }>(
    `SELECT current_database()=$1
    AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5432
    AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AS safe`,
    [expectedDatabase],
  );
  if (guard.rows[0]?.safe !== true)
    throw new Error("d162_database_target_mismatch");
  // This importer never discards unresolved transcript markers to populate a zero-finding review set.
  if (/\[\[(?:uncertain|unclear)|\[uncertain/iu.test(transcript)) {
    throw new Error(
      "d162_transcript_findings_require_structured_manual_review",
    );
  }
  const record = authorization.orderedRecords[artifact.target.sequence - 1];
  if (
    !record ||
    record.sourceWordPressId !== artifact.target.sourceWordPressId ||
    record.videoId !== artifact.target.videoId ||
    metadata.serviceDate !== record.serviceDate
  ) {
    throw new Error("d162_import_target_or_metadata_out_of_scope");
  }
  const validation = validateSeventhFixedBatchDraftArtifact(
    artifact,
    authorization,
    {
      bodyText: transcript,
      sha256: artifact.transcript.sourceTranscriptSha256,
    },
  );
  if (!validation.valid || validation.stale) {
    throw new Error(
      `d162_import_validation_failed:${validation.issues.join(",")}`,
    );
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
      selectedCaption: {
        captionId: `d162-${item.sequence}`,
        language: "en",
        trackKind: "standard",
      },
      sourceSnapshot: {
        publicationStatus: item.publicationStatus,
        serviceDate: item.serviceDate,
        serviceDateAnomaly: "not_applicable",
        speakerTermIds: [],
        seriesTermIds: [],
        bibleBookTermIds: [],
        passageMetadataPresent: false,
        metadataAnomalyFlags: [],
      },
    })),
  };
  return importOneTimePreapprovalPrivateDraft(
    pool,
    compatibilityArtifact,
    compatibilityAuthorization,
    transcript,
    metadata,
    undefined,
    {
      profile:
        artifact.captionAudioAssociation.audioTrackType === "unknown"
          ? seventhFixedBatchImportProfile
          : {
              ...seventhFixedBatchImportProfile,
              audioWarningCode: "caption_primary_audio_confirmed",
              warnings: [
                {
                  code: "caption_primary_audio_confirmed",
                  safeDetail:
                    "The official API reported primary audio association.",
                },
                ...seventhFixedBatchImportProfile.warnings.filter(
                  (warning) =>
                    warning.code !== seventhFixedBatchAudioWarning &&
                    warning.code !== "primary_audio_association_unconfirmed",
                ),
              ],
            },
      contentChecksum: artifact.integrity.canonicalSha256,
    },
  );
}

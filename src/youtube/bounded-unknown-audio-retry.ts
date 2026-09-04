import { createHash } from "node:crypto";
import { z } from "zod";
import {
  oneTimePreapprovalBatchSize,
  oneTimePreapprovalDraftEnvelopeSchema,
  validateOneTimePreapprovalDraftEnvelope,
  type OneTimePreapprovalBatchAuthorization,
  type OneTimePreapprovalBatchRecord
} from "../enrichment/one-time-preapproval-batch";
import type { CaptionTrackMetadata } from "./pilot-caption-proof";

export const boundedUnknownAudioRetryDecisionId = "D-152" as const;
export const boundedUnknownAudioRetryManifestSha256 =
  "7e513f03cab908f30223753832211d2593ce4ffab15706ee851760385d9acb30" as const;
export const boundedUnknownAudioRetryWarning =
  "CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION" as const;
export const boundedUnknownAudioRetryPriorFailure = "caption_primary_audio_unconfirmed" as const;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const gitCommitSchema = z.string().regex(/^[0-9a-f]{40}$/u);
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/u;
const captionIdPattern = /^[A-Za-z0-9_-]{1,200}$/u;

const priorAttemptRecordSchema = z.object({
  sequence: z.number().int().min(1).max(oneTimePreapprovalBatchSize),
  sourceWordPressId: z.number().int().positive(),
  videoId: z.string().regex(videoIdPattern),
  outcome: z.literal("failed"),
  failureCode: z.literal(boundedUnknownAudioRetryPriorFailure)
}).loose();

export const boundedUnknownAudioRetryPriorCheckpointSchema = z.object({
  schemaVersion: z.literal(1),
  privateContent: z.literal(true),
  manifestSha256: z.literal(boundedUnknownAudioRetryManifestSha256),
  records: z.array(priorAttemptRecordSchema).length(oneTimePreapprovalBatchSize),
  integrity: z.object({ recordsSha256: sha256Schema }).loose()
}).loose();

export interface BoundedUnknownAudioRetryAuthorization {
  decisionId: typeof boundedUnknownAudioRetryDecisionId;
  manifestSha256: typeof boundedUnknownAudioRetryManifestSha256;
  governanceCommitHash: string;
  previousCheckpointSha256: string;
  previousAttemptCount: typeof oneTimePreapprovalBatchSize;
  orderedRecords: readonly OneTimePreapprovalBatchRecord[];
  baseAuthorization: OneTimePreapprovalBatchAuthorization;
}

export function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function bindBoundedUnknownAudioRetry(input: {
  baseAuthorization: OneTimePreapprovalBatchAuthorization;
  priorCheckpoint: unknown;
  priorCheckpointBytes: Uint8Array;
  governanceCommitHash: string;
}): BoundedUnknownAudioRetryAuthorization {
  gitCommitSchema.parse(input.governanceCommitHash);
  if (input.baseAuthorization.manifestSha256 !== boundedUnknownAudioRetryManifestSha256) {
    throw new Error("bounded_unknown_audio_retry_manifest_scope_mismatch");
  }
  if (input.baseAuthorization.orderedRecords.length !== oneTimePreapprovalBatchSize) {
    throw new Error("bounded_unknown_audio_retry_manifest_size_mismatch");
  }
  const rawRecords = (input.priorCheckpoint as { records?: unknown } | null)?.records;
  if (!Array.isArray(rawRecords)) {
    throw new Error("bounded_unknown_audio_retry_prior_checkpoint_invalid");
  }
  const checkpoint = boundedUnknownAudioRetryPriorCheckpointSchema.parse(input.priorCheckpoint);
  const calculatedRecordsSha256 = createHash("sha256")
    .update(JSON.stringify(rawRecords))
    .digest("hex");
  if (calculatedRecordsSha256 !== checkpoint.integrity.recordsSha256) {
    throw new Error("bounded_unknown_audio_retry_prior_checkpoint_integrity_mismatch");
  }
  checkpoint.records.forEach((attempt, index) => {
    const target = input.baseAuthorization.orderedRecords[index];
    if (!target || attempt.sequence !== target.sequence ||
      attempt.sourceWordPressId !== target.sourceWordPressId || attempt.videoId !== target.videoId) {
      throw new Error("bounded_unknown_audio_retry_prior_attempt_scope_mismatch");
    }
  });
  return {
    decisionId: boundedUnknownAudioRetryDecisionId,
    manifestSha256: boundedUnknownAudioRetryManifestSha256,
    governanceCommitHash: input.governanceCommitHash,
    previousCheckpointSha256: sha256Bytes(input.priorCheckpointBytes),
    previousAttemptCount: oneTimePreapprovalBatchSize,
    orderedRecords: input.baseAuthorization.orderedRecords,
    baseAuthorization: input.baseAuthorization
  };
}

function normalizedTrackKind(value: string): "standard" | "asr" | "other" {
  const normalized = value.trim().toLocaleLowerCase("en-AU");
  if (normalized === "standard") return "standard";
  if (normalized === "asr") return "asr";
  return "other";
}

function normalizedAudioTrackType(value: string): "primary" | "unknown" | "other" {
  const normalized = value.trim().toLocaleLowerCase("en-AU");
  if (normalized === "primary") return "primary";
  if (normalized === "unknown") return "unknown";
  return "other";
}

function eligible(track: CaptionTrackMetadata, allowUnknown: boolean): boolean {
  const audioType = normalizedAudioTrackType(track.audioTrackType);
  return track.status.trim().toLocaleLowerCase("en-AU") === "serving" &&
    !track.isDraft &&
    /^en(?:-|$)/iu.test(track.language.trim()) &&
    normalizedTrackKind(track.trackKind) !== "other" &&
    (audioType === "primary" || (allowUnknown && audioType === "unknown"));
}

export type BoundedUnknownAudioCaptionSelection =
  | {
    outcome: "selected";
    track: CaptionTrackMetadata;
    eligibleTrackCount: number;
    provenance: {
      audioTrackType: "primary" | "unknown";
      primaryAudioConfirmed: boolean;
      acceptedUnderBoundedException: boolean;
      warnings: Array<typeof boundedUnknownAudioRetryWarning>;
    };
  }
  | { outcome: "ambiguous_track"; priority: "standard" | "asr"; eligibleTrackCount: number }
  | { outcome: "no_eligible_track"; eligibleTrackCount: 0 };

function selectCaptionTrackWithPolicy(
  videoId: string,
  tracks: readonly CaptionTrackMetadata[],
  allowUnknown: boolean
): BoundedUnknownAudioCaptionSelection {
  if (!videoIdPattern.test(videoId)) throw new Error("caption_video_identity_invalid");
  if (tracks.some((track) => track.videoId !== videoId)) {
    throw new Error("bounded_unknown_audio_retry_cross_video_track");
  }
  if (tracks.some((track) => !captionIdPattern.test(track.id))) {
    throw new Error("bounded_unknown_audio_retry_caption_identity_invalid");
  }
  const eligibleTracks = tracks.filter((track) => eligible(track, allowUnknown));
  for (const priority of ["standard", "asr"] as const) {
    const candidates = eligibleTracks.filter((track) => normalizedTrackKind(track.trackKind) === priority);
    if (candidates.length > 1) {
      return { outcome: "ambiguous_track", priority, eligibleTrackCount: eligibleTracks.length };
    }
    if (candidates.length === 1) {
      const track = candidates[0]!;
      const audioTrackType = normalizedAudioTrackType(track.audioTrackType) as "primary" | "unknown";
      const acceptedUnderBoundedException = audioTrackType === "unknown";
      return {
        outcome: "selected",
        track,
        eligibleTrackCount: eligibleTracks.length,
        provenance: {
          audioTrackType,
          primaryAudioConfirmed: audioTrackType === "primary",
          acceptedUnderBoundedException,
          warnings: acceptedUnderBoundedException ? [boundedUnknownAudioRetryWarning] : []
        }
      };
    }
  }
  return { outcome: "no_eligible_track", eligibleTrackCount: 0 };
}

export function selectCaptionTrackWithPrimaryAudioRequirement(
  videoId: string,
  tracks: readonly CaptionTrackMetadata[]
): BoundedUnknownAudioCaptionSelection {
  return selectCaptionTrackWithPolicy(videoId, tracks, false);
}

export function selectCaptionTrackForBoundedUnknownAudioRetry(
  authorization: BoundedUnknownAudioRetryAuthorization,
  videoId: string,
  tracks: readonly CaptionTrackMetadata[]
): BoundedUnknownAudioCaptionSelection {
  if (!videoIdPattern.test(videoId) || !authorization.orderedRecords.some((record) => record.videoId === videoId)) {
    throw new Error("bounded_unknown_audio_retry_video_out_of_scope");
  }
  return selectCaptionTrackWithPolicy(videoId, tracks, true);
}

export interface BoundedUnknownAudioRetryAttempt {
  sequence: number;
  sourceWordPressId: number;
  videoId: string;
  outcome: "completed" | "failed";
}

export interface BoundedUnknownAudioRetryState {
  decisionId: typeof boundedUnknownAudioRetryDecisionId;
  manifestSha256: typeof boundedUnknownAudioRetryManifestSha256;
  previousCheckpointSha256: string;
  previousAttemptCount: typeof oneTimePreapprovalBatchSize;
  attempts: readonly BoundedUnknownAudioRetryAttempt[];
}

export function createBoundedUnknownAudioRetryState(
  authorization: BoundedUnknownAudioRetryAuthorization
): BoundedUnknownAudioRetryState {
  return {
    decisionId: boundedUnknownAudioRetryDecisionId,
    manifestSha256: boundedUnknownAudioRetryManifestSha256,
    previousCheckpointSha256: authorization.previousCheckpointSha256,
    previousAttemptCount: oneTimePreapprovalBatchSize,
    attempts: []
  };
}

export function nextBoundedUnknownAudioRetryRecord(
  authorization: BoundedUnknownAudioRetryAuthorization,
  state: BoundedUnknownAudioRetryState
): OneTimePreapprovalBatchRecord | null {
  if (state.decisionId !== boundedUnknownAudioRetryDecisionId ||
    state.manifestSha256 !== authorization.manifestSha256 ||
    state.previousCheckpointSha256 !== authorization.previousCheckpointSha256 ||
    state.previousAttemptCount !== oneTimePreapprovalBatchSize ||
    state.attempts.length > oneTimePreapprovalBatchSize) {
    throw new Error("bounded_unknown_audio_retry_state_invalid");
  }
  state.attempts.forEach((attempt, index) => {
    const target = authorization.orderedRecords[index];
    if (!target || attempt.sequence !== target.sequence ||
      attempt.sourceWordPressId !== target.sourceWordPressId || attempt.videoId !== target.videoId) {
      throw new Error("bounded_unknown_audio_retry_attempt_order_mismatch");
    }
  });
  return authorization.orderedRecords[state.attempts.length] ?? null;
}

export function recordBoundedUnknownAudioRetryAttempt(
  authorization: BoundedUnknownAudioRetryAuthorization,
  state: BoundedUnknownAudioRetryState,
  attempt: BoundedUnknownAudioRetryAttempt
): BoundedUnknownAudioRetryState {
  const next = nextBoundedUnknownAudioRetryRecord(authorization, state);
  if (!next) throw new Error("bounded_unknown_audio_retry_expired");
  if (attempt.sequence !== next.sequence || attempt.sourceWordPressId !== next.sourceWordPressId ||
    attempt.videoId !== next.videoId) {
    throw new Error("bounded_unknown_audio_retry_record_out_of_order_or_scope");
  }
  return { ...state, attempts: [...state.attempts, attempt] };
}

export const boundedUnknownAudioRetryDraftEnvelopeSchema = oneTimePreapprovalDraftEnvelopeSchema.extend({
  retryDecisionId: z.literal(boundedUnknownAudioRetryDecisionId),
  captionAudioAssociation: z.object({
    audioTrackType: z.enum(["primary", "unknown"]),
    primaryAudioConfirmed: z.boolean(),
    acceptedUnderBoundedException: z.boolean(),
    warning: z.literal(boundedUnknownAudioRetryWarning).nullable()
  }).strict()
}).strict().superRefine((value, context) => {
  const unknown = value.captionAudioAssociation.audioTrackType === "unknown";
  if (value.captionAudioAssociation.primaryAudioConfirmed === unknown ||
    value.captionAudioAssociation.acceptedUnderBoundedException !== unknown ||
    (unknown ? value.captionAudioAssociation.warning !== boundedUnknownAudioRetryWarning
      : value.captionAudioAssociation.warning !== null) ||
    (unknown && !value.warnings.includes(boundedUnknownAudioRetryWarning))) {
    context.addIssue({ code: "custom", message: "Caption audio-association provenance is inconsistent" });
  }
});

export function validateBoundedUnknownAudioRetryDraftEnvelope(
  input: unknown,
  authorization: BoundedUnknownAudioRetryAuthorization,
  currentTranscriptSha256: string
): { valid: boolean; stale: boolean; issues: string[] } {
  const parsed = boundedUnknownAudioRetryDraftEnvelopeSchema.safeParse(input);
  if (!parsed.success) return { valid: false, stale: false, issues: ["bounded_unknown_audio_retry_draft_invalid"] };
  return validateOneTimePreapprovalDraftEnvelope(
    parsed.data,
    authorization.baseAuthorization,
    currentTranscriptSha256
  );
}

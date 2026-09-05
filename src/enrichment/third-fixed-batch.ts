import { createHash } from "node:crypto";
import { z } from "zod";
import type { CaptionTrackMetadata } from "../youtube/pilot-caption-proof";
import {
  limitedReproducibilityWarning,
  oneTimePreapprovalDraftArtifactSchema,
  oneTimePreapprovalDraftArtifactSha256,
  oneTimePreapprovalGeneratorProvenanceSchema,
  oneTimePreapprovalOutputSha256,
  validateOneTimePreapprovalDraftArtifact,
  type OneTimePreapprovalBatchAuthorization,
  type OneTimePreapprovalBatchRecord,
  type OneTimePreapprovalDraftArtifact
} from "./one-time-preapproval-batch";

export const thirdFixedBatchDecisionId = "D-154" as const;
export const thirdFixedBatchManifestSha256 =
  "d0255234eaab92efafaf0859f061f4bfa6a889e7eb085fb9d951eeafa0ff8244" as const;
export const thirdFixedBatchSize = 36 as const;
export const thirdFixedBatchProcessingVersion = "phase3b2c-evaluation-36-d154-v1" as const;
export const thirdFixedBatchAudioWarning =
  "CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION" as const;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const gitCommitSchema = z.string().regex(/^[0-9a-f]{40}$/u);
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/u;
const captionIdPattern = /^[A-Za-z0-9_-]{1,200}$/u;

export const thirdFixedBatchRecordSchema = z.object({
  sequence: z.number().int().min(1).max(thirdFixedBatchSize),
  sourceWordPressId: z.number().int().positive(),
  videoId: z.string().regex(videoIdPattern),
  publicationStatus: z.enum(["publish", "pending"]),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  inventoryRowSha256: sha256Schema,
  mappingRecordSha256: sha256Schema,
  channelOwnershipCorroboratedByExistingEvidence: z.literal(true)
}).strict();

export const thirdFixedBatchManifestSchema = z.object({
  schemaVersion: z.literal("phase3b2c-evaluation-36-batch-3-identity-manifest/v1"),
  privateContent: z.literal(true),
  authorityState: z.literal("identity_scope_only_no_caption_or_content_processing_authority"),
  createdAt: z.iso.datetime(),
  sourceCommit: z.literal("6e75ae4f3286680601bef35837f629e4ae7ee862"),
  deterministicSelection: z.object({
    rule: z.literal("authoritative_batch_2_mapping_record_order"),
    orderEvidence: z.literal("mapping_source_id_strictly_ascending"),
    mappingRule: z.literal("exact_stored_asp_sermon_youtube_value_only"),
    inventorySha256: sha256Schema,
    mappingSha256: sha256Schema,
    candidateSnapshotSha256: sha256Schema,
    officialUploadEvidenceSha256: sha256Schema,
    d151ManifestSha256: sha256Schema,
    d153ManifestSha256: sha256Schema,
    previouslyAttemptedCount: z.literal(87),
    cleanCandidateCountBeforeSelection: z.literal(231),
    takeCount: z.literal(thirdFixedBatchSize),
    cleanCandidateCountAfterSelection: z.literal(195),
    noSubstitutionAfterFreeze: z.literal(true)
  }).strict(),
  records: z.array(thirdFixedBatchRecordSchema).length(thirdFixedBatchSize),
  integrity: z.object({ canonicalSha256: z.literal(thirdFixedBatchManifestSha256) }).strict()
}).strict();

export type ThirdFixedBatchRecord = z.infer<typeof thirdFixedBatchRecordSchema>;
export type ThirdFixedBatchManifest = z.infer<typeof thirdFixedBatchManifestSchema>;

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "integrity")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalise(nested)]));
  }
  return value;
}

export function thirdFixedBatchCanonicalSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalise(value))).digest("hex");
}

export interface ThirdFixedBatchAuthorization {
  decisionId: typeof thirdFixedBatchDecisionId;
  manifestSha256: typeof thirdFixedBatchManifestSha256;
  governanceCommitHash: string;
  orderedRecords: readonly ThirdFixedBatchRecord[];
}

export function inspectThirdFixedBatchManifestStructure(input: unknown): {
  valid: boolean;
  issues: string[];
  canonicalSha256: string | null;
} {
  const parsed = thirdFixedBatchManifestSchema.safeParse(input);
  if (!parsed.success) return { valid: false, issues: ["d154_manifest_contract_invalid"], canonicalSha256: null };
  const manifest = parsed.data;
  const issues: string[] = [];
  const calculated = thirdFixedBatchCanonicalSha256(manifest);
  if (calculated !== thirdFixedBatchManifestSha256) issues.push("d154_manifest_integrity_mismatch");
  if (!manifest.records.every((record, index) => record.sequence === index + 1)) {
    issues.push("d154_manifest_order_invalid");
  }
  if (new Set(manifest.records.map((record) => record.sourceWordPressId)).size !== thirdFixedBatchSize ||
    new Set(manifest.records.map((record) => record.videoId)).size !== thirdFixedBatchSize) {
    issues.push("d154_manifest_identity_not_unique");
  }
  if (!manifest.records.every((record, index, records) => index === 0 ||
    record.sourceWordPressId > records[index - 1]!.sourceWordPressId)) {
    issues.push("d154_manifest_canonical_order_invalid");
  }
  return { valid: issues.length === 0, issues, canonicalSha256: calculated };
}

export function bindThirdFixedBatchManifest(
  input: unknown,
  governanceCommitHash: string
): ThirdFixedBatchAuthorization {
  gitCommitSchema.parse(governanceCommitHash);
  const inspection = inspectThirdFixedBatchManifestStructure(input);
  if (!inspection.valid) throw new Error(inspection.issues.join(","));
  const manifest = thirdFixedBatchManifestSchema.parse(input);
  return {
    decisionId: thirdFixedBatchDecisionId,
    manifestSha256: thirdFixedBatchManifestSha256,
    governanceCommitHash,
    orderedRecords: manifest.records
  };
}

export interface ThirdFixedBatchAttempt {
  sequence: number;
  sourceWordPressId: number;
  videoId: string;
  outcome: "completed" | "failed";
  failureCode: string | null;
}

export interface ThirdFixedBatchState {
  decisionId: typeof thirdFixedBatchDecisionId;
  manifestSha256: typeof thirdFixedBatchManifestSha256;
  attempts: readonly ThirdFixedBatchAttempt[];
}

export function createThirdFixedBatchState(): ThirdFixedBatchState {
  return { decisionId: thirdFixedBatchDecisionId, manifestSha256: thirdFixedBatchManifestSha256, attempts: [] };
}

export function nextThirdFixedBatchRecord(
  authorization: ThirdFixedBatchAuthorization,
  state: ThirdFixedBatchState
): ThirdFixedBatchRecord | null {
  if (state.decisionId !== thirdFixedBatchDecisionId || state.manifestSha256 !== authorization.manifestSha256 ||
    state.attempts.length > thirdFixedBatchSize) throw new Error("d154_checkpoint_invalid");
  state.attempts.forEach((attempt, index) => {
    const record = authorization.orderedRecords[index];
    if (!record || attempt.sequence !== record.sequence || attempt.sourceWordPressId !== record.sourceWordPressId ||
      attempt.videoId !== record.videoId) throw new Error("d154_attempt_order_or_identity_mismatch");
  });
  return authorization.orderedRecords[state.attempts.length] ?? null;
}

export function recordThirdFixedBatchAttempt(
  authorization: ThirdFixedBatchAuthorization,
  state: ThirdFixedBatchState,
  attempt: ThirdFixedBatchAttempt
): ThirdFixedBatchState {
  const record = nextThirdFixedBatchRecord(authorization, state);
  if (!record) throw new Error("d154_exception_expired");
  if (attempt.sequence !== record.sequence || attempt.sourceWordPressId !== record.sourceWordPressId ||
    attempt.videoId !== record.videoId) throw new Error("d154_attempt_out_of_order_or_scope");
  return { ...state, attempts: [...state.attempts, attempt] };
}

function trackKind(value: string): "standard" | "asr" | "other" {
  const normalized = value.trim().toLocaleLowerCase("en-AU");
  if (normalized === "standard") return "standard";
  if (normalized === "asr") return "asr";
  return "other";
}

function audioType(value: string): "primary" | "unknown" | "other" {
  const normalized = value.trim().toLocaleLowerCase("en-AU");
  if (normalized === "primary") return "primary";
  if (normalized === "unknown") return "unknown";
  return "other";
}

export type ThirdFixedBatchCaptionSelection =
  | {
    outcome: "selected";
    track: CaptionTrackMetadata;
    eligibleTrackCount: number;
    provenance: {
      decision: typeof thirdFixedBatchDecisionId;
      manifestSha256: typeof thirdFixedBatchManifestSha256;
      audioTrackType: "primary" | "unknown";
      primaryAudioConfirmed: boolean;
      acceptedUnderBoundedException: boolean;
      warning: typeof thirdFixedBatchAudioWarning | null;
    };
  }
  | { outcome: "ambiguous_track"; priority: "standard_primary" | "standard_unknown" | "asr_primary" | "asr_unknown"; eligibleTrackCount: number }
  | { outcome: "no_eligible_track"; eligibleTrackCount: 0 };

export function selectCaptionTrackForThirdFixedBatch(
  authorization: ThirdFixedBatchAuthorization,
  videoId: string,
  tracks: readonly CaptionTrackMetadata[]
): ThirdFixedBatchCaptionSelection {
  if (!videoIdPattern.test(videoId) || !authorization.orderedRecords.some((record) => record.videoId === videoId)) {
    throw new Error("d154_video_out_of_scope");
  }
  if (tracks.some((track) => track.videoId !== videoId)) throw new Error("d154_cross_video_caption_resource");
  if (tracks.some((track) => !captionIdPattern.test(track.id))) throw new Error("d154_caption_identity_invalid");
  const eligible = tracks.filter((track) =>
    track.status.trim().toLocaleLowerCase("en-AU") === "serving" && !track.isDraft &&
    /^en(?:-|$)/iu.test(track.language.trim()) && trackKind(track.trackKind) !== "other" &&
    audioType(track.audioTrackType) !== "other");
  const priorities = [
    ["standard_primary", "standard", "primary"],
    ["standard_unknown", "standard", "unknown"],
    ["asr_primary", "asr", "primary"],
    ["asr_unknown", "asr", "unknown"]
  ] as const;
  for (const [priority, kind, audio] of priorities) {
    const candidates = eligible.filter((track) => trackKind(track.trackKind) === kind && audioType(track.audioTrackType) === audio);
    if (candidates.length > 1) return { outcome: "ambiguous_track", priority, eligibleTrackCount: eligible.length };
    if (candidates.length === 1) {
      const unknown = audio === "unknown";
      return {
        outcome: "selected",
        track: candidates[0]!,
        eligibleTrackCount: eligible.length,
        provenance: {
          decision: thirdFixedBatchDecisionId,
          manifestSha256: thirdFixedBatchManifestSha256,
          audioTrackType: audio,
          primaryAudioConfirmed: !unknown,
          acceptedUnderBoundedException: unknown,
          warning: unknown ? thirdFixedBatchAudioWarning : null
        }
      };
    }
  }
  return { outcome: "no_eligible_track", eligibleTrackCount: 0 };
}

export const thirdFixedBatchDraftArtifactSchema = oneTimePreapprovalDraftArtifactSchema.extend({
  exceptionId: z.literal(thirdFixedBatchDecisionId),
  batchManifestSha256: z.literal(thirdFixedBatchManifestSha256),
  decisionId: z.literal(thirdFixedBatchDecisionId),
  captionAudioAssociation: z.object({
    decision: z.literal(thirdFixedBatchDecisionId),
    manifestSha256: z.literal(thirdFixedBatchManifestSha256),
    audioTrackType: z.enum(["primary", "unknown"]),
    primaryAudioConfirmed: z.boolean(),
    acceptedUnderBoundedException: z.boolean(),
    warning: z.literal(thirdFixedBatchAudioWarning).nullable()
  }).strict(),
  generator: oneTimePreapprovalGeneratorProvenanceSchema.extend({
    batchManifestSha256: z.literal(thirdFixedBatchManifestSha256)
  }).strict()
}).strict().superRefine((value, context) => {
  const unknown = value.captionAudioAssociation.audioTrackType === "unknown";
  if (value.captionAudioAssociation.primaryAudioConfirmed === unknown ||
    value.captionAudioAssociation.acceptedUnderBoundedException !== unknown ||
    (unknown ? value.captionAudioAssociation.warning !== thirdFixedBatchAudioWarning
      : value.captionAudioAssociation.warning !== null) ||
    (unknown && !value.warnings.includes(thirdFixedBatchAudioWarning))) {
    context.addIssue({ code: "custom", message: "D-154 caption audio-association provenance is inconsistent" });
  }
});

export type ThirdFixedBatchDraftArtifact = z.infer<typeof thirdFixedBatchDraftArtifactSchema>;

export function thirdFixedBatchDraftArtifactSha256(value: unknown): string {
  return thirdFixedBatchCanonicalSha256(value);
}

export function thirdFixedBatchOutputSha256(value: ThirdFixedBatchDraftArtifact["content"]): string {
  return oneTimePreapprovalOutputSha256(value);
}

function compatibilityRecord(record: ThirdFixedBatchRecord): OneTimePreapprovalBatchRecord {
  return {
    sequence: record.sequence,
    sourceWordPressId: record.sourceWordPressId,
    videoId: record.videoId,
    priorInspectionSha256: record.inventoryRowSha256,
    selectedCaption: { captionId: `d154-${record.sequence}`, language: "en", trackKind: "standard" },
    sourceSnapshot: {
      publicationStatus: record.publicationStatus,
      serviceDate: record.serviceDate,
      serviceDateAnomaly: "not_applicable",
      speakerTermIds: [],
      seriesTermIds: [],
      bibleBookTermIds: [],
      passageMetadataPresent: false,
      metadataAnomalyFlags: []
    }
  };
}

export function toD151ValidationCompatibilityArtifact(value: ThirdFixedBatchDraftArtifact): OneTimePreapprovalDraftArtifact {
  const { decisionId: _decisionId, captionAudioAssociation: _captionAudioAssociation, ...rest } = value;
  const compatibility = {
    ...rest,
    exceptionId: "D-151" as const,
    integrity: { canonicalSha256: "0".repeat(64) }
  };
  compatibility.integrity.canonicalSha256 = oneTimePreapprovalDraftArtifactSha256(compatibility);
  return oneTimePreapprovalDraftArtifactSchema.parse(compatibility);
}

export function validateThirdFixedBatchDraftArtifact(
  input: unknown,
  authorization: ThirdFixedBatchAuthorization,
  currentTranscript: { bodyText: string; sha256: string }
): { valid: boolean; stale: boolean; issues: string[]; metrics: { descriptionWordCount: number; questionAnswerCount: number } } {
  const parsed = thirdFixedBatchDraftArtifactSchema.safeParse(input);
  if (!parsed.success) {
    return { valid: false, stale: false, issues: ["d154_draft_artifact_contract_invalid"], metrics: { descriptionWordCount: 0, questionAnswerCount: 0 } };
  }
  const value = parsed.data;
  const record = authorization.orderedRecords[value.target.sequence - 1];
  const issues: string[] = [];
  if (!record || record.sourceWordPressId !== value.target.sourceWordPressId || record.videoId !== value.target.videoId) {
    issues.push("d154_target_scope_mismatch");
  }
  if (value.generator.governanceCommitHash !== authorization.governanceCommitHash) {
    issues.push("d154_governance_commit_mismatch");
  }
  if (value.integrity.canonicalSha256 !== thirdFixedBatchDraftArtifactSha256(value)) {
    issues.push("d154_artifact_integrity_mismatch");
  }
  if (value.generator.outputSha256 !== thirdFixedBatchOutputSha256(value.content)) {
    issues.push("d154_output_hash_mismatch");
  }
  const baseAuthorization: OneTimePreapprovalBatchAuthorization = {
    exceptionId: "D-151",
    manifestSha256: authorization.manifestSha256,
    governanceCommitHash: authorization.governanceCommitHash,
    orderedRecords: authorization.orderedRecords.map(compatibilityRecord)
  };
  const base = validateOneTimePreapprovalDraftArtifact(
    toD151ValidationCompatibilityArtifact(value),
    baseAuthorization,
    currentTranscript
  );
  issues.push(...base.issues);
  return { valid: issues.length === 0, stale: base.stale, issues: [...new Set(issues)], metrics: base.metrics };
}

export { limitedReproducibilityWarning };

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

export const secondFixedBatchDecisionId = "D-153" as const;
export const secondFixedBatchManifestSha256 =
  "f25979b57aae574dcd4616509d7678f7f0b8e08b28ef6911ab322762c6fd69ab" as const;
export const secondFixedBatchSize = 36 as const;
export const secondFixedBatchProcessingVersion = "phase3b2c-evaluation-36-d153-v1" as const;
export const secondFixedBatchAudioWarning =
  "CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION" as const;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const gitCommitSchema = z.string().regex(/^[0-9a-f]{40}$/u);
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/u;
const captionIdPattern = /^[A-Za-z0-9_-]{1,200}$/u;

export const secondFixedBatchRecordSchema = z.object({
  sequence: z.number().int().min(1).max(secondFixedBatchSize),
  sourceWordPressId: z.number().int().positive(),
  videoId: z.string().regex(videoIdPattern),
  publicationStatus: z.enum(["publish", "pending"]),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  inventoryRowSha256: sha256Schema,
  mappingRecordSha256: sha256Schema,
  channelOwnershipCorroboratedByExistingEvidence: z.literal(true)
}).strict();

export const secondFixedBatchManifestSchema = z.object({
  schemaVersion: z.literal("phase3b2c-evaluation-36-batch-2-identity-manifest/v1"),
  privateContent: z.literal(true),
  authorityState: z.literal("identity_scope_only_no_caption_or_content_processing_authority"),
  createdAt: z.iso.datetime(),
  sourceCommit: z.literal("cf56b7bff6c65dc320b570db7f4f5c241b3f80f0"),
  deterministicSelection: z.object({
    rule: z.literal("authoritative_inventory_row_order"),
    orderEvidence: z.literal("inventory_source_id_strictly_ascending"),
    mappingRule: z.literal("exact_stored_asp_sermon_youtube_value_only"),
    inventorySha256: sha256Schema,
    mappingSha256: sha256Schema,
    officialUploadEvidenceSha256: sha256Schema,
    previouslyExcludedCount: z.number().int().nonnegative(),
    cleanCandidateCount: z.number().int().min(secondFixedBatchSize),
    takeCount: z.literal(secondFixedBatchSize),
    noSubstitutionAfterFreeze: z.literal(true)
  }).strict(),
  records: z.array(secondFixedBatchRecordSchema).length(secondFixedBatchSize),
  integrity: z.object({ canonicalSha256: z.literal(secondFixedBatchManifestSha256) }).strict()
}).strict();

export type SecondFixedBatchRecord = z.infer<typeof secondFixedBatchRecordSchema>;
export type SecondFixedBatchManifest = z.infer<typeof secondFixedBatchManifestSchema>;

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

export function secondFixedBatchCanonicalSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalise(value))).digest("hex");
}

export interface SecondFixedBatchAuthorization {
  decisionId: typeof secondFixedBatchDecisionId;
  manifestSha256: typeof secondFixedBatchManifestSha256;
  governanceCommitHash: string;
  orderedRecords: readonly SecondFixedBatchRecord[];
}

export function inspectSecondFixedBatchManifestStructure(input: unknown): {
  valid: boolean;
  issues: string[];
  canonicalSha256: string | null;
} {
  const parsed = secondFixedBatchManifestSchema.safeParse(input);
  if (!parsed.success) return { valid: false, issues: ["d153_manifest_contract_invalid"], canonicalSha256: null };
  const manifest = parsed.data;
  const issues: string[] = [];
  const calculated = secondFixedBatchCanonicalSha256(manifest);
  if (calculated !== secondFixedBatchManifestSha256) issues.push("d153_manifest_integrity_mismatch");
  if (!manifest.records.every((record, index) => record.sequence === index + 1)) {
    issues.push("d153_manifest_order_invalid");
  }
  if (new Set(manifest.records.map((record) => record.sourceWordPressId)).size !== secondFixedBatchSize ||
    new Set(manifest.records.map((record) => record.videoId)).size !== secondFixedBatchSize) {
    issues.push("d153_manifest_identity_not_unique");
  }
  if (!manifest.records.every((record, index, records) => index === 0 ||
    record.sourceWordPressId > records[index - 1]!.sourceWordPressId)) {
    issues.push("d153_manifest_canonical_order_invalid");
  }
  return { valid: issues.length === 0, issues, canonicalSha256: calculated };
}

export function bindSecondFixedBatchManifest(
  input: unknown,
  governanceCommitHash: string
): SecondFixedBatchAuthorization {
  gitCommitSchema.parse(governanceCommitHash);
  const inspection = inspectSecondFixedBatchManifestStructure(input);
  if (!inspection.valid) throw new Error(inspection.issues.join(","));
  const manifest = secondFixedBatchManifestSchema.parse(input);
  return {
    decisionId: secondFixedBatchDecisionId,
    manifestSha256: secondFixedBatchManifestSha256,
    governanceCommitHash,
    orderedRecords: manifest.records
  };
}

export interface SecondFixedBatchAttempt {
  sequence: number;
  sourceWordPressId: number;
  videoId: string;
  outcome: "completed" | "failed";
  failureCode: string | null;
}

export interface SecondFixedBatchState {
  decisionId: typeof secondFixedBatchDecisionId;
  manifestSha256: typeof secondFixedBatchManifestSha256;
  attempts: readonly SecondFixedBatchAttempt[];
}

export function createSecondFixedBatchState(): SecondFixedBatchState {
  return { decisionId: secondFixedBatchDecisionId, manifestSha256: secondFixedBatchManifestSha256, attempts: [] };
}

export function nextSecondFixedBatchRecord(
  authorization: SecondFixedBatchAuthorization,
  state: SecondFixedBatchState
): SecondFixedBatchRecord | null {
  if (state.decisionId !== secondFixedBatchDecisionId || state.manifestSha256 !== authorization.manifestSha256 ||
    state.attempts.length > secondFixedBatchSize) throw new Error("d153_checkpoint_invalid");
  state.attempts.forEach((attempt, index) => {
    const record = authorization.orderedRecords[index];
    if (!record || attempt.sequence !== record.sequence || attempt.sourceWordPressId !== record.sourceWordPressId ||
      attempt.videoId !== record.videoId) throw new Error("d153_attempt_order_or_identity_mismatch");
  });
  return authorization.orderedRecords[state.attempts.length] ?? null;
}

export function recordSecondFixedBatchAttempt(
  authorization: SecondFixedBatchAuthorization,
  state: SecondFixedBatchState,
  attempt: SecondFixedBatchAttempt
): SecondFixedBatchState {
  const record = nextSecondFixedBatchRecord(authorization, state);
  if (!record) throw new Error("d153_exception_expired");
  if (attempt.sequence !== record.sequence || attempt.sourceWordPressId !== record.sourceWordPressId ||
    attempt.videoId !== record.videoId) throw new Error("d153_attempt_out_of_order_or_scope");
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

export type SecondFixedBatchCaptionSelection =
  | {
    outcome: "selected";
    track: CaptionTrackMetadata;
    eligibleTrackCount: number;
    provenance: {
      decision: typeof secondFixedBatchDecisionId;
      manifestSha256: typeof secondFixedBatchManifestSha256;
      audioTrackType: "primary" | "unknown";
      primaryAudioConfirmed: boolean;
      acceptedUnderBoundedException: boolean;
      warning: typeof secondFixedBatchAudioWarning | null;
    };
  }
  | { outcome: "ambiguous_track"; priority: "standard_primary" | "standard_unknown" | "asr_primary" | "asr_unknown"; eligibleTrackCount: number }
  | { outcome: "no_eligible_track"; eligibleTrackCount: 0 };

export function selectCaptionTrackForSecondFixedBatch(
  authorization: SecondFixedBatchAuthorization,
  videoId: string,
  tracks: readonly CaptionTrackMetadata[]
): SecondFixedBatchCaptionSelection {
  if (!videoIdPattern.test(videoId) || !authorization.orderedRecords.some((record) => record.videoId === videoId)) {
    throw new Error("d153_video_out_of_scope");
  }
  if (tracks.some((track) => track.videoId !== videoId)) throw new Error("d153_cross_video_caption_resource");
  if (tracks.some((track) => !captionIdPattern.test(track.id))) throw new Error("d153_caption_identity_invalid");
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
          decision: secondFixedBatchDecisionId,
          manifestSha256: secondFixedBatchManifestSha256,
          audioTrackType: audio,
          primaryAudioConfirmed: !unknown,
          acceptedUnderBoundedException: unknown,
          warning: unknown ? secondFixedBatchAudioWarning : null
        }
      };
    }
  }
  return { outcome: "no_eligible_track", eligibleTrackCount: 0 };
}

export const secondFixedBatchDraftArtifactSchema = oneTimePreapprovalDraftArtifactSchema.extend({
  exceptionId: z.literal(secondFixedBatchDecisionId),
  batchManifestSha256: z.literal(secondFixedBatchManifestSha256),
  decisionId: z.literal(secondFixedBatchDecisionId),
  captionAudioAssociation: z.object({
    decision: z.literal(secondFixedBatchDecisionId),
    manifestSha256: z.literal(secondFixedBatchManifestSha256),
    audioTrackType: z.enum(["primary", "unknown"]),
    primaryAudioConfirmed: z.boolean(),
    acceptedUnderBoundedException: z.boolean(),
    warning: z.literal(secondFixedBatchAudioWarning).nullable()
  }).strict(),
  generator: oneTimePreapprovalGeneratorProvenanceSchema.extend({
    batchManifestSha256: z.literal(secondFixedBatchManifestSha256)
  }).strict()
}).strict().superRefine((value, context) => {
  const unknown = value.captionAudioAssociation.audioTrackType === "unknown";
  if (value.captionAudioAssociation.primaryAudioConfirmed === unknown ||
    value.captionAudioAssociation.acceptedUnderBoundedException !== unknown ||
    (unknown ? value.captionAudioAssociation.warning !== secondFixedBatchAudioWarning
      : value.captionAudioAssociation.warning !== null) ||
    (unknown && !value.warnings.includes(secondFixedBatchAudioWarning))) {
    context.addIssue({ code: "custom", message: "D-153 caption audio-association provenance is inconsistent" });
  }
});

export type SecondFixedBatchDraftArtifact = z.infer<typeof secondFixedBatchDraftArtifactSchema>;

export function secondFixedBatchDraftArtifactSha256(value: unknown): string {
  return secondFixedBatchCanonicalSha256(value);
}

export function secondFixedBatchOutputSha256(value: SecondFixedBatchDraftArtifact["content"]): string {
  return oneTimePreapprovalOutputSha256(value);
}

function compatibilityRecord(record: SecondFixedBatchRecord): OneTimePreapprovalBatchRecord {
  return {
    sequence: record.sequence,
    sourceWordPressId: record.sourceWordPressId,
    videoId: record.videoId,
    priorInspectionSha256: record.inventoryRowSha256,
    selectedCaption: { captionId: `d153-${record.sequence}`, language: "en", trackKind: "standard" },
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

export function toD151ValidationCompatibilityArtifact(value: SecondFixedBatchDraftArtifact): OneTimePreapprovalDraftArtifact {
  const { decisionId: _decisionId, captionAudioAssociation: _captionAudioAssociation, ...rest } = value;
  const compatibility = {
    ...rest,
    exceptionId: "D-151" as const,
    integrity: { canonicalSha256: "0".repeat(64) }
  };
  compatibility.integrity.canonicalSha256 = oneTimePreapprovalDraftArtifactSha256(compatibility);
  return oneTimePreapprovalDraftArtifactSchema.parse(compatibility);
}

export function validateSecondFixedBatchDraftArtifact(
  input: unknown,
  authorization: SecondFixedBatchAuthorization,
  currentTranscript: { bodyText: string; sha256: string }
): { valid: boolean; stale: boolean; issues: string[]; metrics: { descriptionWordCount: number; questionAnswerCount: number } } {
  const parsed = secondFixedBatchDraftArtifactSchema.safeParse(input);
  if (!parsed.success) {
    return { valid: false, stale: false, issues: ["d153_draft_artifact_contract_invalid"], metrics: { descriptionWordCount: 0, questionAnswerCount: 0 } };
  }
  const value = parsed.data;
  const record = authorization.orderedRecords[value.target.sequence - 1];
  const issues: string[] = [];
  if (!record || record.sourceWordPressId !== value.target.sourceWordPressId || record.videoId !== value.target.videoId) {
    issues.push("d153_target_scope_mismatch");
  }
  if (value.generator.governanceCommitHash !== authorization.governanceCommitHash) {
    issues.push("d153_governance_commit_mismatch");
  }
  if (value.integrity.canonicalSha256 !== secondFixedBatchDraftArtifactSha256(value)) {
    issues.push("d153_artifact_integrity_mismatch");
  }
  if (value.generator.outputSha256 !== secondFixedBatchOutputSha256(value.content)) {
    issues.push("d153_output_hash_mismatch");
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

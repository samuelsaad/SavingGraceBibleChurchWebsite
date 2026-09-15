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

export const fifthFixedBatchDecisionId = "D-159" as const;
export const fifthFixedBatchManifestSha256 =
  "49c7eac788ce5564678cc3ff0c8aa72ec09f3e4e8f746044c1c6e4ed00ea5297" as const;
export const fifthFixedBatchSize = 36 as const;
export const fifthFixedBatchProcessingVersion = "phase3b2c-evaluation-36-d159-v1" as const;
export const fifthFixedBatchAudioWarning =
  "CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION" as const;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const gitCommitSchema = z.string().regex(/^[0-9a-f]{40}$/u);
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/u;
const captionIdPattern = /^[A-Za-z0-9_-]{1,200}$/u;

export const fifthFixedBatchRecordSchema = z.object({
  sequence: z.number().int().min(1).max(fifthFixedBatchSize),
  sourceWordPressId: z.number().int().positive(),
  videoId: z.string().regex(videoIdPattern),
  publicationStatus: z.enum(["publish", "pending"]),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  inventoryRowSha256: sha256Schema,
  mappingRecordSha256: sha256Schema,
  channelOwnershipCorroboratedByExistingEvidence: z.literal(true)
}).strict();

export const fifthFixedBatchManifestSchema = z.object({
  schemaVersion: z.literal("phase3b2c-evaluation-36-batch-5-identity-manifest/v1"),
  privateContent: z.literal(true),
  authorityState: z.literal("identity_scope_only_no_caption_or_content_processing_authority"),
  createdAt: z.iso.datetime(),
  sourceCommit: z.literal("ae8755ab93e446fa8c6da1f7ad32a39218a0fd45"),
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
    d154ManifestSha256: z.literal("d0255234eaab92efafaf0859f061f4bfa6a889e7eb085fb9d951eeafa0ff8244"),
    d155ManifestSha256: z.literal("eb6000c8ec11be8a7f55482fd84658a377953427e1dc18309dbb90f6ab00407a"),
    previouslyAttemptedCount: z.literal(159),
    cleanCandidateCountBeforeSelection: z.literal(159),
    takeCount: z.literal(fifthFixedBatchSize),
    cleanCandidateCountAfterSelection: z.literal(123),
    noSubstitutionAfterFreeze: z.literal(true)
  }).strict(),
  records: z.array(fifthFixedBatchRecordSchema).length(fifthFixedBatchSize),
  integrity: z.object({ canonicalSha256: z.literal(fifthFixedBatchManifestSha256) }).strict()
}).strict();

export type FifthFixedBatchRecord = z.infer<typeof fifthFixedBatchRecordSchema>;
export type FifthFixedBatchManifest = z.infer<typeof fifthFixedBatchManifestSchema>;

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

export function fifthFixedBatchCanonicalSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalise(value))).digest("hex");
}

export interface FifthFixedBatchAuthorization {
  decisionId: typeof fifthFixedBatchDecisionId;
  manifestSha256: typeof fifthFixedBatchManifestSha256;
  governanceCommitHash: string;
  orderedRecords: readonly FifthFixedBatchRecord[];
}

export function inspectFifthFixedBatchManifestStructure(input: unknown): {
  valid: boolean;
  issues: string[];
  canonicalSha256: string | null;
} {
  const parsed = fifthFixedBatchManifestSchema.safeParse(input);
  if (!parsed.success) return { valid: false, issues: ["d159_manifest_contract_invalid"], canonicalSha256: null };
  const manifest = parsed.data;
  const issues: string[] = [];
  const calculated = fifthFixedBatchCanonicalSha256(manifest);
  if (calculated !== fifthFixedBatchManifestSha256) issues.push("d159_manifest_integrity_mismatch");
  if (!manifest.records.every((record, index) => record.sequence === index + 1)) {
    issues.push("d159_manifest_order_invalid");
  }
  if (new Set(manifest.records.map((record) => record.sourceWordPressId)).size !== fifthFixedBatchSize ||
    new Set(manifest.records.map((record) => record.videoId)).size !== fifthFixedBatchSize) {
    issues.push("d159_manifest_identity_not_unique");
  }
  if (!manifest.records.every((record, index, records) => index === 0 ||
    record.sourceWordPressId > records[index - 1]!.sourceWordPressId)) {
    issues.push("d159_manifest_canonical_order_invalid");
  }
  return { valid: issues.length === 0, issues, canonicalSha256: calculated };
}

export function bindFifthFixedBatchManifest(
  input: unknown,
  governanceCommitHash: string
): FifthFixedBatchAuthorization {
  gitCommitSchema.parse(governanceCommitHash);
  const inspection = inspectFifthFixedBatchManifestStructure(input);
  if (!inspection.valid) throw new Error(inspection.issues.join(","));
  const manifest = fifthFixedBatchManifestSchema.parse(input);
  return {
    decisionId: fifthFixedBatchDecisionId,
    manifestSha256: fifthFixedBatchManifestSha256,
    governanceCommitHash,
    orderedRecords: manifest.records
  };
}

export interface FifthFixedBatchAttempt {
  sequence: number;
  sourceWordPressId: number;
  videoId: string;
  outcome: "completed" | "failed";
  failureCode: string | null;
}

export interface FifthFixedBatchState {
  decisionId: typeof fifthFixedBatchDecisionId;
  manifestSha256: typeof fifthFixedBatchManifestSha256;
  attempts: readonly FifthFixedBatchAttempt[];
}

export function createFifthFixedBatchState(): FifthFixedBatchState {
  return { decisionId: fifthFixedBatchDecisionId, manifestSha256: fifthFixedBatchManifestSha256, attempts: [] };
}

export function nextFifthFixedBatchRecord(
  authorization: FifthFixedBatchAuthorization,
  state: FifthFixedBatchState
): FifthFixedBatchRecord | null {
  if (state.decisionId !== fifthFixedBatchDecisionId || state.manifestSha256 !== authorization.manifestSha256 ||
    state.attempts.length > fifthFixedBatchSize) throw new Error("d159_checkpoint_invalid");
  state.attempts.forEach((attempt, index) => {
    const record = authorization.orderedRecords[index];
    if (!record || attempt.sequence !== record.sequence || attempt.sourceWordPressId !== record.sourceWordPressId ||
      attempt.videoId !== record.videoId) throw new Error("d159_attempt_order_or_identity_mismatch");
  });
  return authorization.orderedRecords[state.attempts.length] ?? null;
}

export function recordFifthFixedBatchAttempt(
  authorization: FifthFixedBatchAuthorization,
  state: FifthFixedBatchState,
  attempt: FifthFixedBatchAttempt
): FifthFixedBatchState {
  const record = nextFifthFixedBatchRecord(authorization, state);
  if (!record) throw new Error("d159_exception_expired");
  if (attempt.sequence !== record.sequence || attempt.sourceWordPressId !== record.sourceWordPressId ||
    attempt.videoId !== record.videoId) throw new Error("d159_attempt_out_of_order_or_scope");
  return { ...state, attempts: [...state.attempts, attempt] };
}

function englishLanguageTag(value: string): boolean {
  try { return new Intl.Locale(value.trim()).language === "en"; } catch { return false; }
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

export type FifthFixedBatchCaptionSelection =
  | {
    outcome: "selected";
    track: CaptionTrackMetadata;
    eligibleTrackCount: number;
    provenance: {
      decision: typeof fifthFixedBatchDecisionId;
      manifestSha256: typeof fifthFixedBatchManifestSha256;
      audioTrackType: "primary" | "unknown";
      primaryAudioConfirmed: boolean;
      acceptedUnderBoundedException: boolean;
      warning: typeof fifthFixedBatchAudioWarning | null;
    };
  }
  | { outcome: "ambiguous_track"; priority: "standard_primary" | "standard_unknown" | "asr_primary" | "asr_unknown"; eligibleTrackCount: number }
  | { outcome: "no_eligible_track"; eligibleTrackCount: 0 };

export function selectCaptionTrackForFifthFixedBatch(
  authorization: FifthFixedBatchAuthorization,
  videoId: string,
  tracks: readonly CaptionTrackMetadata[]
): FifthFixedBatchCaptionSelection {
  if (!videoIdPattern.test(videoId) || !authorization.orderedRecords.some((record) => record.videoId === videoId)) {
    throw new Error("d159_video_out_of_scope");
  }
  if (tracks.some((track) => track.videoId !== videoId)) throw new Error("d159_cross_video_caption_resource");
  if (tracks.some((track) => !captionIdPattern.test(track.id))) throw new Error("d159_caption_identity_invalid");
  const eligible = tracks.filter((track) =>
    track.status.trim().toLocaleLowerCase("en-AU") === "serving" && !track.isDraft &&
    englishLanguageTag(track.language) && trackKind(track.trackKind) !== "other" &&
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
          decision: fifthFixedBatchDecisionId,
          manifestSha256: fifthFixedBatchManifestSha256,
          audioTrackType: audio,
          primaryAudioConfirmed: !unknown,
          acceptedUnderBoundedException: unknown,
          warning: unknown ? fifthFixedBatchAudioWarning : null
        }
      };
    }
  }
  return { outcome: "no_eligible_track", eligibleTrackCount: 0 };
}

export const fifthFixedBatchDraftArtifactSchema = oneTimePreapprovalDraftArtifactSchema.extend({
  exceptionId: z.literal(fifthFixedBatchDecisionId),
  batchManifestSha256: z.literal(fifthFixedBatchManifestSha256),
  decisionId: z.literal(fifthFixedBatchDecisionId),
  captionAudioAssociation: z.object({
    decision: z.literal(fifthFixedBatchDecisionId),
    manifestSha256: z.literal(fifthFixedBatchManifestSha256),
    audioTrackType: z.enum(["primary", "unknown"]),
    primaryAudioConfirmed: z.boolean(),
    acceptedUnderBoundedException: z.boolean(),
    warning: z.literal(fifthFixedBatchAudioWarning).nullable()
  }).strict(),
  generator: oneTimePreapprovalGeneratorProvenanceSchema.extend({
    batchManifestSha256: z.literal(fifthFixedBatchManifestSha256),
    model: z.object({ value: z.literal("gpt-6-astra"), unavailableReason: z.null() }).strict(),
    validationModel: z.literal("gpt-6-astra"),
    separatelyBilledApiUsed: z.literal(false),
    workspacePrivacyAndRetention: z.literal("not_exposed_by_runtime"),
    tokenCount: z.literal("not_exposed_by_runtime"),
    candidateSha256: sha256Schema,
    correction: z.object({
      previousCandidateSha256: sha256Schema,
      correctedByModel: z.literal("gpt-6-astra"),
      correctionNumber: z.literal(1),
      correctedAt: z.iso.datetime(),
      previousValidationIssueCodes: z.array(z.string().regex(/^[a-z0-9_:.-]+$/u)).min(1),
      kind: z.enum(["question_opening", "grounding_metadata", "candidate_validation_repair"])
    }).strict().nullable()
  }).strict()
}).strict().superRefine((value, context) => {
  if ((value.generator.retryCount === 0) !== (value.generator.correction === null)) {
    context.addIssue({ code: "custom", message: "D-159 correction lineage must match the single correction allowance" });
  }
  const unknown = value.captionAudioAssociation.audioTrackType === "unknown";
  if (value.captionAudioAssociation.primaryAudioConfirmed === unknown ||
    value.captionAudioAssociation.acceptedUnderBoundedException !== unknown ||
    (unknown ? value.captionAudioAssociation.warning !== fifthFixedBatchAudioWarning
      : value.captionAudioAssociation.warning !== null) ||
    (unknown && !value.warnings.includes(fifthFixedBatchAudioWarning))) {
    context.addIssue({ code: "custom", message: "D-159 caption audio-association provenance is inconsistent" });
  }
});

export type FifthFixedBatchDraftArtifact = z.infer<typeof fifthFixedBatchDraftArtifactSchema>;

export function fifthFixedBatchDraftArtifactSha256(value: unknown): string {
  return fifthFixedBatchCanonicalSha256(value);
}

export function fifthFixedBatchOutputSha256(value: FifthFixedBatchDraftArtifact["content"]): string {
  return oneTimePreapprovalOutputSha256(value);
}

function compatibilityRecord(record: FifthFixedBatchRecord): OneTimePreapprovalBatchRecord {
  return {
    sequence: record.sequence,
    sourceWordPressId: record.sourceWordPressId,
    videoId: record.videoId,
    priorInspectionSha256: record.inventoryRowSha256,
    selectedCaption: { captionId: `d159-${record.sequence}`, language: "en", trackKind: "standard" },
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

export function toD151ValidationCompatibilityArtifact(value: FifthFixedBatchDraftArtifact): OneTimePreapprovalDraftArtifact {
  const { decisionId: _decisionId, captionAudioAssociation: _captionAudioAssociation, ...rest } = value;
  const { validationModel: _validationModel, separatelyBilledApiUsed: _apiUsed,
    tokenCount: _tokenCount, candidateSha256: _candidateSha256, correction: _correction,
    ...generator } = rest.generator;
  const compatibility = {
    ...rest,
    generator: { ...generator, workspacePrivacyAndRetention: "not_exposed_to_runtime" as const },
    exceptionId: "D-151" as const,
    integrity: { canonicalSha256: "0".repeat(64) }
  };
  compatibility.integrity.canonicalSha256 = oneTimePreapprovalDraftArtifactSha256(compatibility);
  return oneTimePreapprovalDraftArtifactSchema.parse(compatibility);
}

export function validateFifthFixedBatchDraftArtifact(
  input: unknown,
  authorization: FifthFixedBatchAuthorization,
  currentTranscript: { bodyText: string; sha256: string }
): { valid: boolean; stale: boolean; issues: string[]; metrics: { descriptionWordCount: number; questionAnswerCount: number } } {
  const parsed = fifthFixedBatchDraftArtifactSchema.safeParse(input);
  if (!parsed.success) {
    return { valid: false, stale: false, issues: ["d159_draft_artifact_contract_invalid"], metrics: { descriptionWordCount: 0, questionAnswerCount: 0 } };
  }
  const value = parsed.data;
  const record = authorization.orderedRecords[value.target.sequence - 1];
  const issues: string[] = [];
  if (!record || record.sourceWordPressId !== value.target.sourceWordPressId || record.videoId !== value.target.videoId) {
    issues.push("d159_target_scope_mismatch");
  }
  if (value.generator.governanceCommitHash !== authorization.governanceCommitHash) {
    issues.push("d159_governance_commit_mismatch");
  }
  if (value.integrity.canonicalSha256 !== fifthFixedBatchDraftArtifactSha256(value)) {
    issues.push("d159_artifact_integrity_mismatch");
  }
  if (value.generator.outputSha256 !== fifthFixedBatchOutputSha256(value.content)) {
    issues.push("d159_output_hash_mismatch");
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



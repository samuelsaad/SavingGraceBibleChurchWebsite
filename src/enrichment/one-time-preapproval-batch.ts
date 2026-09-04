import { createHash } from "node:crypto";
import { z } from "zod";

export const oneTimePreapprovalBatchExceptionId = "D-151" as const;
export const oneTimePreapprovalBatchProcessingVersion = "one-time-private-evaluation-36-v1" as const;
export const oneTimePreapprovalBatchSize = 36 as const;
export const limitedReproducibilityWarning = "MODEL_REVISION_UNAVAILABLE_LIMITED_REPRODUCIBILITY" as const;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const gitCommitSchema = z.string().regex(/^[0-9a-f]{40}$/u);

const runtimeValueSchema = z.object({
  value: z.string().trim().min(1).max(300).nullable(),
  unavailableReason: z.enum(["not_exposed_by_runtime"]).nullable()
}).strict().superRefine((value, context) => {
  if ((value.value === null) === (value.unavailableReason === null)) {
    context.addIssue({ code: "custom", message: "Exactly one of value or unavailableReason is required" });
  }
});

export const oneTimePreapprovalBatchRecordSchema = z.object({
  sequence: z.number().int().min(1).max(oneTimePreapprovalBatchSize),
  sourceWordPressId: z.number().int().positive(),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/u),
  priorInspectionSha256: sha256Schema,
  selectedCaption: z.object({
    captionId: z.string().trim().min(1).max(500),
    language: z.literal("en"),
    trackKind: z.enum(["standard", "asr"])
  }).strict(),
  sourceSnapshot: z.object({
    publicationStatus: z.enum(["publish", "pending"]),
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    serviceDateAnomaly: z.string().trim().min(1).max(100),
    speakerTermIds: z.array(z.number().int().positive()),
    seriesTermIds: z.array(z.number().int().positive()),
    bibleBookTermIds: z.array(z.number().int().positive()),
    passageMetadataPresent: z.boolean(),
    metadataAnomalyFlags: z.array(z.string().trim().min(1).max(100))
  }).strict()
}).strict();

export const oneTimePreapprovalBatchManifestSchema = z.object({
  schemaVersion: z.literal(1),
  privateContent: z.literal(true),
  exceptionId: z.literal(oneTimePreapprovalBatchExceptionId),
  processingVersion: z.literal(oneTimePreapprovalBatchProcessingVersion),
  createdAt: z.iso.datetime(),
  records: z.array(oneTimePreapprovalBatchRecordSchema).length(oneTimePreapprovalBatchSize),
  integrity: z.object({ canonicalSha256: sha256Schema }).strict()
}).strict();

export const oneTimePreapprovalGeneratorProvenanceSchema = z.object({
  provider: z.literal("OpenAI"),
  executionSurface: z.literal("Codex"),
  executionMode: z.literal("interactive Codex session"),
  model: runtimeValueSchema,
  immutableRevision: runtimeValueSchema,
  sessionOrRunIdentifier: runtimeValueSchema,
  workspacePrivacyAndRetention: z.literal("not_exposed_to_runtime"),
  availableGenerationSettings: z.array(z.string().trim().min(1).max(200)).max(20),
  generatedAt: z.iso.datetime(),
  governanceCommitHash: gitCommitSchema,
  batchManifestSha256: sha256Schema,
  promptOrProcessingVersionSha256: sha256Schema,
  sourceTranscriptSha256: sha256Schema,
  outputSha256: sha256Schema,
  retryCount: z.number().int().min(0).max(1),
  externalGenerativeApiCostAud: z.literal(0)
}).strict();

export const oneTimePreapprovalDraftEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  privateContent: z.literal(true),
  exceptionId: z.literal(oneTimePreapprovalBatchExceptionId),
  batchManifestSha256: sha256Schema,
  target: z.object({
    sequence: z.number().int().min(1).max(oneTimePreapprovalBatchSize),
    sourceWordPressId: z.number().int().positive(),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/u)
  }).strict(),
  transcript: z.object({
    groundingRevisionId: z.uuid(),
    rowVersion: z.number().int().positive(),
    sourceTranscriptSha256: sha256Schema,
    sourceTranscriptApprovalStateAtGeneration: z.literal("unapproved")
  }).strict(),
  requiresAdministratorReview: z.literal(true),
  transcriptApprovalRequiredBeforeDependentApproval: z.literal(true),
  approvalState: z.literal("draft"),
  publicVisibility: z.literal("private"),
  searchEligible: z.literal(false),
  feedEligible: z.literal(false),
  sitemapEligible: z.literal(false),
  semanticEligible: z.literal(false),
  productionBuildEligible: z.literal(false),
  generator: oneTimePreapprovalGeneratorProvenanceSchema,
  warnings: z.array(z.string().trim().min(1)).superRefine((warnings, context) => {
    if (!warnings.includes(limitedReproducibilityWarning)) {
      context.addIssue({ code: "custom", message: `${limitedReproducibilityWarning} is required` });
    }
  })
}).strict();

export type OneTimePreapprovalBatchRecord = z.infer<typeof oneTimePreapprovalBatchRecordSchema>;
export type OneTimePreapprovalBatchManifest = z.infer<typeof oneTimePreapprovalBatchManifestSchema>;

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

export function oneTimePreapprovalBatchManifestSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalise(value))).digest("hex");
}

export interface OneTimePreapprovalBatchAuthorization {
  exceptionId: typeof oneTimePreapprovalBatchExceptionId;
  manifestSha256: string;
  governanceCommitHash: string;
  orderedRecords: readonly OneTimePreapprovalBatchRecord[];
}

export function bindOneTimePreapprovalBatch(
  input: unknown,
  governanceCommitHash: string
): OneTimePreapprovalBatchAuthorization {
  const manifest = oneTimePreapprovalBatchManifestSchema.parse(input);
  gitCommitSchema.parse(governanceCommitHash);
  const calculatedHash = oneTimePreapprovalBatchManifestSha256(manifest);
  if (manifest.integrity.canonicalSha256 !== calculatedHash) {
    throw new Error("one_time_batch_manifest_integrity_mismatch");
  }
  const sourceIds = new Set(manifest.records.map((record) => record.sourceWordPressId));
  const videoIds = new Set(manifest.records.map((record) => record.videoId));
  if (sourceIds.size !== oneTimePreapprovalBatchSize || videoIds.size !== oneTimePreapprovalBatchSize) {
    throw new Error("one_time_batch_manifest_identity_not_unique");
  }
  if (!manifest.records.every((record, index) => record.sequence === index + 1)) {
    throw new Error("one_time_batch_manifest_order_invalid");
  }
  return {
    exceptionId: oneTimePreapprovalBatchExceptionId,
    manifestSha256: calculatedHash,
    governanceCommitHash,
    orderedRecords: manifest.records
  };
}

export interface OneTimePreapprovalAttempt {
  sourceWordPressId: number;
  outcome: "completed" | "failed";
}

export interface OneTimePreapprovalBatchState {
  manifestSha256: string;
  attempts: readonly OneTimePreapprovalAttempt[];
}

export function nextOneTimePreapprovalBatchRecord(
  authorization: OneTimePreapprovalBatchAuthorization,
  state: OneTimePreapprovalBatchState
): OneTimePreapprovalBatchRecord | null {
  if (state.manifestSha256 !== authorization.manifestSha256) throw new Error("one_time_batch_manifest_scope_mismatch");
  if (state.attempts.length > oneTimePreapprovalBatchSize) throw new Error("one_time_batch_attempt_count_invalid");
  for (const [index, attempt] of state.attempts.entries()) {
    if (attempt.sourceWordPressId !== authorization.orderedRecords[index]?.sourceWordPressId) {
      throw new Error("one_time_batch_attempt_order_mismatch");
    }
  }
  return authorization.orderedRecords[state.attempts.length] ?? null;
}

export function recordOneTimePreapprovalBatchAttempt(
  authorization: OneTimePreapprovalBatchAuthorization,
  state: OneTimePreapprovalBatchState,
  sourceWordPressId: number,
  outcome: OneTimePreapprovalAttempt["outcome"]
): OneTimePreapprovalBatchState {
  const next = nextOneTimePreapprovalBatchRecord(authorization, state);
  if (!next) throw new Error("one_time_batch_exception_expired");
  if (next.sourceWordPressId !== sourceWordPressId) {
    throw new Error("one_time_batch_record_out_of_order_or_out_of_scope");
  }
  return { manifestSha256: state.manifestSha256, attempts: [...state.attempts, { sourceWordPressId, outcome }] };
}

export function validateOneTimePreapprovalDraftEnvelope(
  input: unknown,
  authorization: OneTimePreapprovalBatchAuthorization,
  currentTranscriptSha256: string
): { valid: boolean; stale: boolean; issues: string[] } {
  const parsed = oneTimePreapprovalDraftEnvelopeSchema.safeParse(input);
  if (!parsed.success) return { valid: false, stale: false, issues: ["one_time_batch_draft_contract_invalid"] };
  const value = parsed.data;
  const record = authorization.orderedRecords[value.target.sequence - 1];
  const issues: string[] = [];
  if (value.batchManifestSha256 !== authorization.manifestSha256 ||
    value.generator.batchManifestSha256 !== authorization.manifestSha256) {
    issues.push("one_time_batch_manifest_scope_mismatch");
  }
  if (!record || record.sourceWordPressId !== value.target.sourceWordPressId || record.videoId !== value.target.videoId) {
    issues.push("one_time_batch_target_scope_mismatch");
  }
  if (value.generator.governanceCommitHash !== authorization.governanceCommitHash) {
    issues.push("one_time_batch_governance_commit_mismatch");
  }
  if (value.generator.sourceTranscriptSha256 !== value.transcript.sourceTranscriptSha256) {
    issues.push("one_time_batch_transcript_provenance_mismatch");
  }
  const stale = value.transcript.sourceTranscriptSha256 !== currentTranscriptSha256;
  if (stale) issues.push("one_time_batch_dependent_draft_stale");
  return { valid: issues.length === 0, stale, issues };
}

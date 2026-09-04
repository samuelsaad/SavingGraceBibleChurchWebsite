import { createHash } from "node:crypto";
import { z } from "zod";
import { inspectGeneratedText } from "./generated-text-mechanical-qa";
import {
  groundingSupportSchema,
  inspectDescriptionQuality,
  lexicalWordOffsets,
  type GroundingSupport
} from "./sermon-enrichment-contracts";

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

const oneTimeGroundedDescriptionSchema = z.object({
  bodyText: z.string().trim().min(1).max(2_000),
  centralSubject: z.string().trim().min(1).max(500),
  application: z.string().trim().min(1).max(500),
  supports: z.array(groundingSupportSchema).min(1)
}).strict();

const oneTimeGroundedQuestionAnswerSchema = z.object({
  displayOrder: z.number().int().min(1).max(10),
  question: z.string().trim().min(1).max(1_000),
  answer: z.string().trim().min(1).max(10_000),
  supports: z.array(groundingSupportSchema).min(1)
}).strict();

export const oneTimePreapprovalDraftArtifactSchema = oneTimePreapprovalDraftEnvelopeSchema.extend({
  content: z.object({
    description: oneTimeGroundedDescriptionSchema,
    questionAnswers: z.array(oneTimeGroundedQuestionAnswerSchema).min(5).max(10)
  }).strict(),
  integrity: z.object({ canonicalSha256: sha256Schema }).strict()
}).strict();

export type OneTimePreapprovalBatchRecord = z.infer<typeof oneTimePreapprovalBatchRecordSchema>;
export type OneTimePreapprovalBatchManifest = z.infer<typeof oneTimePreapprovalBatchManifestSchema>;
export type OneTimePreapprovalDraftArtifact = z.infer<typeof oneTimePreapprovalDraftArtifactSchema>;

const oneTimePreapprovalValidationRetryQuestionOrders: ReadonlyMap<number, readonly number[]> = new Map([
  [3, [1]],
  [16, [6]],
  [19, [3]],
  [21, [2]],
  [24, [3, 6]],
  [26, [6]]
]);

export interface OneTimePreapprovalValidationRetryInspection {
  valid: boolean;
  issues: string[];
  changedQuestionOrders: number[];
}

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

export function oneTimePreapprovalDraftArtifactSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalise(value))).digest("hex");
}

export function oneTimePreapprovalOutputSha256(value: OneTimePreapprovalDraftArtifact["content"]): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function exactJsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withoutKeys(value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

export function inspectOneTimePreapprovalValidationRetry(
  previousInput: unknown,
  currentInput: unknown
): OneTimePreapprovalValidationRetryInspection {
  const previousParsed = oneTimePreapprovalDraftArtifactSchema.safeParse(previousInput);
  const currentParsed = oneTimePreapprovalDraftArtifactSchema.safeParse(currentInput);
  if (!previousParsed.success || !currentParsed.success) {
    return { valid: false, issues: ["one_time_batch_validation_retry_contract_invalid"], changedQuestionOrders: [] };
  }
  const previous = previousParsed.data;
  const current = currentParsed.data;
  const issues: string[] = [];
  const expectedQuestionOrders = oneTimePreapprovalValidationRetryQuestionOrders.get(current.target.sequence);
  if (!expectedQuestionOrders) issues.push("one_time_batch_validation_retry_sequence_not_authorised");
  const { generator: previousGenerator, content: previousContent, integrity: _previousIntegrity, ...previousEnvelope } = previous;
  const { generator: currentGenerator, content: currentContent, integrity: _currentIntegrity, ...currentEnvelope } = current;
  if (!exactJsonEqual(previousEnvelope, currentEnvelope)) issues.push("one_time_batch_validation_retry_envelope_changed");
  if (!exactJsonEqual(
    withoutKeys(previousGenerator, ["generatedAt", "outputSha256", "retryCount"]),
    withoutKeys(currentGenerator, ["generatedAt", "outputSha256", "retryCount"])
  )) issues.push("one_time_batch_validation_retry_generator_provenance_changed");
  if (previousGenerator.retryCount !== 0 || currentGenerator.retryCount !== 1 ||
    Date.parse(currentGenerator.generatedAt) < Date.parse(previousGenerator.generatedAt)) {
    issues.push("one_time_batch_validation_retry_attempt_invalid");
  }
  if (previousGenerator.outputSha256 !== oneTimePreapprovalOutputSha256(previousContent) ||
    currentGenerator.outputSha256 !== oneTimePreapprovalOutputSha256(currentContent) ||
    previous.integrity.canonicalSha256 !== oneTimePreapprovalDraftArtifactSha256(previous) ||
    current.integrity.canonicalSha256 !== oneTimePreapprovalDraftArtifactSha256(current)) {
    issues.push("one_time_batch_validation_retry_integrity_mismatch");
  }
  if (previousContent.description.bodyText !== currentContent.description.bodyText ||
    previousContent.description.centralSubject !== currentContent.description.centralSubject ||
    previousContent.description.application !== currentContent.description.application) {
    issues.push("one_time_batch_validation_retry_description_prose_changed");
  }
  if (current.target.sequence === 3) {
    const previousSupports = previousContent.description.supports;
    const currentSupports = currentContent.description.supports;
    if (previousSupports.length !== currentSupports.length || !previousSupports.every((support, index) => {
      const currentSupport = currentSupports[index];
      return currentSupport !== undefined && exactJsonEqual(
        withoutKeys(support, ["outputIndex"]),
        withoutKeys(currentSupport, ["outputIndex"])
      );
    })) issues.push("one_time_batch_validation_retry_description_support_scope_changed");
  } else if (!exactJsonEqual(previousContent.description.supports, currentContent.description.supports)) {
    issues.push("one_time_batch_validation_retry_description_support_scope_changed");
  }
  if (previousContent.questionAnswers.length !== currentContent.questionAnswers.length) {
    issues.push("one_time_batch_validation_retry_question_count_changed");
  }
  const changedQuestionOrders: number[] = [];
  for (const [index, previousItem] of previousContent.questionAnswers.entries()) {
    const currentItem = currentContent.questionAnswers[index];
    if (!currentItem || previousItem.displayOrder !== currentItem.displayOrder) {
      issues.push("one_time_batch_validation_retry_question_order_changed");
      continue;
    }
    if (previousItem.question !== currentItem.question) changedQuestionOrders.push(previousItem.displayOrder);
    if (previousItem.answer !== currentItem.answer) issues.push("one_time_batch_validation_retry_answer_changed");
    const supportChangePermitted = current.target.sequence === 3 && previousItem.displayOrder === 2;
    if (supportChangePermitted) {
      if (previousItem.supports.length !== currentItem.supports.length || !previousItem.supports.every((support, supportIndex) => {
        const currentSupport = currentItem.supports[supportIndex];
        return currentSupport !== undefined && exactJsonEqual(
          { outputPart: support.outputPart, outputIndex: support.outputIndex, purpose: support.purpose },
          { outputPart: currentSupport.outputPart, outputIndex: currentSupport.outputIndex, purpose: currentSupport.purpose }
        );
      })) issues.push("one_time_batch_validation_retry_question_support_scope_changed");
    } else if (!exactJsonEqual(previousItem.supports, currentItem.supports)) {
      issues.push("one_time_batch_validation_retry_question_support_scope_changed");
    }
  }
  if (!exactJsonEqual(changedQuestionOrders, expectedQuestionOrders ?? [])) {
    issues.push("one_time_batch_validation_retry_question_scope_mismatch");
  }
  for (const order of changedQuestionOrders) {
    const previousQuestion = previousContent.questionAnswers[order - 1]?.question ?? "";
    const currentQuestion = currentContent.questionAnswers[order - 1]?.question ?? "";
    if (!/^how does the sermon\b/iu.test(previousQuestion) ||
      /^(?:what (?:main|biblical)|how does the sermon|what should listeners)\b/iu.test(currentQuestion)) {
      issues.push("one_time_batch_validation_retry_not_generic_opening_correction");
    }
  }
  return { valid: issues.length === 0, issues: [...new Set(issues)], changedQuestionOrders };
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

function paragraphNumberAt(value: string, offset: number): number {
  return value.slice(0, offset).split(/\n\s*\n/gu).length;
}

function paragraphContaining(value: string, offset: number): string {
  let start = value.lastIndexOf("\n\n", Math.max(0, offset - 1));
  start = start < 0 ? 0 : start + 2;
  const end = value.indexOf("\n\n", offset);
  return value.slice(start, end < 0 ? value.length : end);
}

function oneTimeContentWords(value: string): string[] {
  const stop = new Set([
    "a", "an", "and", "are", "as", "at", "be", "because", "but", "by", "for", "from", "has", "have",
    "he", "in", "is", "it", "of", "on", "or", "our", "that", "the", "their", "this", "to", "was", "we",
    "what", "when", "which", "who", "will", "with", "you", "your"
  ]);
  return lexicalWordOffsets(value).map((item) => item.word).filter((word) => word.length >= 4 && !stop.has(word));
}

function oneTimeOverlapCount(left: string, right: string): number {
  const rightWords = new Set(oneTimeContentWords(right));
  return new Set(oneTimeContentWords(left).filter((word) => rightWords.has(word))).size;
}

function oneTimeLongestCopiedRun(output: string, transcript: string): number {
  const left = lexicalWordOffsets(output).map((item) => item.word);
  const right = lexicalWordOffsets(transcript).map((item) => item.word);
  const previous = new Array<number>(right.length + 1).fill(0);
  let maximum = 0;
  for (const word of left) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let index = 1; index <= right.length; index += 1) {
      if (word === right[index - 1]) {
        current[index] = previous[index - 1]! + 1;
        maximum = Math.max(maximum, current[index]!);
      }
    }
    previous.splice(0, previous.length, ...current);
  }
  return maximum;
}

function validateGroundingSupport(
  support: GroundingSupport,
  transcript: string,
  outputPart: GroundingSupport["outputPart"],
  outputIndex: number,
  issues: string[]
): void {
  const words = lexicalWordOffsets(transcript);
  const selected = transcript.slice(support.characterStart, support.characterEnd);
  if (support.outputPart !== outputPart || support.outputIndex !== outputIndex) {
    issues.push("one_time_batch_grounding_target_mismatch");
  }
  if (selected.length === 0 || createHash("sha256").update(selected).digest("hex") !== support.supportSha256) {
    issues.push("one_time_batch_grounding_hash_mismatch");
  }
  const firstWord = words[support.wordStart - 1];
  const lastWord = words[support.wordEnd - 1];
  if (!firstWord || !lastWord || firstWord.start < support.characterStart || lastWord.end > support.characterEnd ||
    support.wordEnd < support.wordStart) {
    issues.push("one_time_batch_grounding_word_offsets_invalid");
  }
  if (paragraphNumberAt(transcript, support.characterStart) !== support.paragraphNumber) {
    issues.push("one_time_batch_grounding_paragraph_mismatch");
  }
}

export function validateOneTimePreapprovalDraftArtifact(
  input: unknown,
  authorization: OneTimePreapprovalBatchAuthorization,
  currentTranscript: { bodyText: string; sha256: string }
): { valid: boolean; stale: boolean; issues: string[]; metrics: { descriptionWordCount: number; questionAnswerCount: number } } {
  const parsed = oneTimePreapprovalDraftArtifactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      stale: false,
      issues: ["one_time_batch_draft_artifact_contract_invalid"],
      metrics: { descriptionWordCount: 0, questionAnswerCount: 0 }
    };
  }
  const value = parsed.data;
  const { content: _content, integrity: _integrity, ...envelopeValue } = value;
  const envelope = validateOneTimePreapprovalDraftEnvelope(envelopeValue, authorization, currentTranscript.sha256);
  const issues = [...envelope.issues];
  if (createHash("sha256").update(currentTranscript.bodyText).digest("hex") !== currentTranscript.sha256) {
    issues.push("one_time_batch_current_transcript_hash_mismatch");
  }
  if (value.generator.outputSha256 !== oneTimePreapprovalOutputSha256(value.content)) {
    issues.push("one_time_batch_output_hash_mismatch");
  }
  if (value.integrity.canonicalSha256 !== oneTimePreapprovalDraftArtifactSha256(value)) {
    issues.push("one_time_batch_artifact_integrity_mismatch");
  }
  const description = inspectDescriptionQuality(value.content.description, currentTranscript);
  issues.push(...description.issues.map((issue) => issue.code));
  const mechanical = inspectGeneratedText(value.content.description.bodyText, value.content.questionAnswers);
  issues.push(...mechanical.issues.filter((issue) => issue.severity === "blocking").map((issue) => issue.code));
  const descriptionParagraphCount = value.content.description.bodyText.split(/\n\s*\n/gu).length;
  for (let index = 1; index <= descriptionParagraphCount; index += 1) {
    const supports = value.content.description.supports.filter((support) => support.outputIndex === index);
    if (supports.length === 0) issues.push("one_time_batch_description_support_missing");
    for (const support of supports) validateGroundingSupport(support, currentTranscript.bodyText, "description_paragraph", index, issues);
  }
  if (!value.content.description.supports.some((support) => support.purpose === "subject" || support.purpose === "reasoning") ||
    !value.content.description.supports.some((support) => support.purpose === "application")) {
    issues.push("one_time_batch_description_required_grounding_missing");
  }
  if (!value.content.questionAnswers.every((item, index) => item.displayOrder === index + 1)) {
    issues.push("one_time_batch_question_order_invalid");
  }
  for (const item of value.content.questionAnswers) {
    if (!item.question.endsWith("?") || lexicalWordOffsets(item.question).length < 6 ||
      lexicalWordOffsets(item.answer).length < 12 || !/[.!?]["'’”)]*$/u.test(item.answer)) {
      issues.push("one_time_batch_question_answer_not_substantive");
    }
    if (/^(?:what (?:main|biblical)|how does the sermon|what should listeners)/iu.test(item.question)) {
      issues.push("one_time_batch_fixed_or_generic_question");
    }
    for (const support of item.supports) {
      validateGroundingSupport(support, currentTranscript.bodyText, "question_answer", item.displayOrder, issues);
    }
    const evidence = item.supports
      .map((support) => paragraphContaining(currentTranscript.bodyText, support.characterStart))
      .join(" ");
    if (oneTimeOverlapCount(item.answer, evidence) < 1) issues.push(`one_time_batch_answer_support_disconnected:${item.displayOrder}`);
    if (oneTimeLongestCopiedRun(item.answer, currentTranscript.bodyText) >= 18) issues.push("one_time_batch_answer_excerpt_copy");
  }
  for (let left = 0; left < value.content.questionAnswers.length; left += 1) {
    for (let right = left + 1; right < value.content.questionAnswers.length; right += 1) {
      const leftWords = new Set(oneTimeContentWords(value.content.questionAnswers[left]!.question));
      const rightWords = new Set(oneTimeContentWords(value.content.questionAnswers[right]!.question));
      const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
      const union = new Set([...leftWords, ...rightWords]).size;
      if (union > 0 && intersection / union >= 0.8) issues.push("one_time_batch_question_substantial_duplicate");
    }
  }
  return {
    valid: issues.length === 0,
    stale: envelope.stale,
    issues: [...new Set(issues)],
    metrics: {
      descriptionWordCount: description.metrics.wordCount,
      questionAnswerCount: value.content.questionAnswers.length
    }
  };
}

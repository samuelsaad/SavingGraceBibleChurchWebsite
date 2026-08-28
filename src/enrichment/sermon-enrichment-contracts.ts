import { createHash } from "node:crypto";
import { z } from "zod";
import {
  sermonEnrichmentGenerationMethod,
  sermonEnrichmentSkillName,
  supportedSermonEnrichmentSkillVersions
} from "./sermon-enrichment-policy";
import {
  generatedTextMechanicalQaVersion,
  inspectGeneratedText,
  type GeneratedTextMechanicalQaReport
} from "./generated-text-mechanical-qa";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const safeText = z.string().trim().min(1);

export const groundingSupportSchema = z.object({
  outputPart: z.enum(["description_paragraph", "question_answer"]),
  outputIndex: z.number().int().positive(),
  paragraphNumber: z.number().int().positive(),
  characterStart: z.number().int().nonnegative(),
  characterEnd: z.number().int().positive(),
  wordStart: z.number().int().positive(),
  wordEnd: z.number().int().positive(),
  supportSha256: sha256Schema,
  purpose: z.enum(["subject", "reasoning", "scripture_use", "application", "answer_support", "theological_claim"])
}).strict();

export const sermonEnrichmentRequestSchema = z.object({
  schemaVersion: z.literal(1),
  privateContent: z.literal(true),
  skillName: z.literal(sermonEnrichmentSkillName),
  skillVersion: z.enum(supportedSermonEnrichmentSkillVersions),
  requestedAt: z.iso.datetime(),
  target: z.object({
    sourceWordPressId: z.number().int().positive(),
    sermonId: z.uuid()
  }).strict(),
  transcript: z.object({
    sermonId: z.uuid(),
    rowVersion: z.number().int().positive(),
    status: z.literal("approved"),
    approvedAt: z.iso.datetime(),
    sha256: sha256Schema,
    characterCount: z.number().int().positive(),
    wordCount: z.number().int().positive(),
    bodyText: z.string().min(1)
  }).strict(),
  original: z.object({
    bundleRelativePath: z.string().regex(/^private\/phase-3b2c-wave1\/[A-Za-z0-9._/-]+\.private\.json$/u),
    bundleSha256: sha256Schema,
    descriptionSha256: sha256Schema,
    questionAnswerSetSha256: sha256Schema
  }).strict(),
  requirements: z.object({
    descriptionWordMinimum: z.literal(180),
    descriptionWordMaximum: z.literal(220),
    questionAnswerMinimum: z.literal(5),
    questionAnswerMaximum: z.literal(10),
    questionAnswerTarget: z.literal(7),
    privateDraftOnly: z.literal(true),
    administratorApprovalRequired: z.literal(true)
  }).strict(),
  integrity: z.object({ canonicalSha256: sha256Schema }).strict()
}).strict();

export const sermonEnrichmentResultSchema = z.object({
  schemaVersion: z.literal(1),
  privateContent: z.literal(true),
  approvalState: z.literal("draft"),
  publicVisibility: z.literal("private"),
  searchEligible: z.literal(false),
  semanticEligible: z.literal(false),
  skillName: z.literal(sermonEnrichmentSkillName),
  skillVersion: z.enum(supportedSermonEnrichmentSkillVersions),
  generationMethod: z.literal(sermonEnrichmentGenerationMethod),
  generator: z.object({
    provider: z.string().trim().regex(/^[A-Za-z0-9._-]+$/u).max(100),
    model: z.string().trim().min(1).max(240),
    modelRevision: z.string().trim().min(1).max(240),
    approvalReference: z.string().trim().regex(/^[A-Za-z0-9._:-]+$/u).max(240)
  }).strict().optional(),
  promptPolicy: z.object({
    version: z.string().trim().regex(/^[A-Za-z0-9._-]+$/u).max(100),
    skillInstructionsSha256: sha256Schema,
    groundingContractSha256: sha256Schema,
    combinedSha256: sha256Schema
  }).strict().optional(),
  generatedAt: z.iso.datetime(),
  requestSha256: sha256Schema,
  target: z.object({
    sourceWordPressId: z.number().int().positive(),
    sermonId: z.uuid()
  }).strict(),
  transcript: z.object({
    sermonId: z.uuid(),
    rowVersion: z.number().int().positive(),
    status: z.literal("approved"),
    approvedAt: z.iso.datetime(),
    sha256: sha256Schema,
    characterCount: z.number().int().positive(),
    wordCount: z.number().int().positive()
  }).strict(),
  original: z.object({
    bundleRelativePath: z.string().regex(/^private\/phase-3b2c-wave1\/[A-Za-z0-9._/-]+\.private\.json$/u),
    bundleSha256: sha256Schema,
    descriptionSha256: sha256Schema,
    questionAnswerSetSha256: sha256Schema
  }).strict(),
  description: z.object({
    bodyText: z.string().trim().min(1).max(2_000),
    centralSubject: safeText.max(500),
    application: safeText.max(500),
    supports: z.array(groundingSupportSchema).min(1)
  }).strict(),
  questionAnswers: z.array(z.object({
    displayOrder: z.number().int().min(1).max(10),
    question: z.string().trim().min(1).max(1_000),
    answer: z.string().trim().min(1).max(10_000),
    supports: z.array(groundingSupportSchema).min(1)
  }).strict()).min(5).max(10),
  warnings: z.array(z.object({ code: z.string().regex(/^[a-z0-9_]+$/u), safeDetail: safeText.max(1_000) }).strict()),
  uncertainties: z.array(z.object({ marker: z.string().regex(/^[a-z0-9_-]+$/u), safeReason: safeText.max(1_000) }).strict()),
  mechanicalProofread: z.object({
    version: z.literal(generatedTextMechanicalQaVersion),
    completed: z.literal(true),
    outcome: z.enum(["passed", "passed_with_review_flags", "failed"]),
    blockingIssueCount: z.number().int().nonnegative(),
    reviewIssueCount: z.number().int().nonnegative()
  }).strict().optional(),
  integrity: z.object({ canonicalSha256: sha256Schema }).strict()
}).strict();

export type GroundingSupport = z.infer<typeof groundingSupportSchema>;
export type SermonEnrichmentRequest = z.infer<typeof sermonEnrichmentRequestSchema>;
export type SermonEnrichmentResult = z.infer<typeof sermonEnrichmentResultSchema>;

export interface CurrentApprovedTranscript {
  sermonId: string;
  sourceWordPressId: number;
  rowVersion: number;
  status: "approved";
  approvedAt: string;
  bodyText: string;
}

export interface EnrichmentValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface EnrichmentValidationResult {
  valid: boolean;
  issues: EnrichmentValidationIssue[];
  mechanicalQa: GeneratedTextMechanicalQaReport | null;
  metrics: {
    descriptionWordCount: number;
    questionAnswerCount: number;
    descriptionParagraphCount: number;
    supportCount: number;
    maximumCopiedWordRun: number;
  };
}

export function sha256Utf8(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
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

export function sermonEnrichmentResultSha256(value: Omit<SermonEnrichmentResult, "integrity"> | SermonEnrichmentResult): string {
  return sha256Utf8(JSON.stringify(canonicalise(value)));
}

export function sermonEnrichmentRequestSha256(value: Omit<SermonEnrichmentRequest, "integrity"> | SermonEnrichmentRequest): string {
  return sha256Utf8(JSON.stringify(canonicalise(value)));
}

export function lexicalWordOffsets(value: string): Array<{ word: string; start: number; end: number }> {
  return [...value.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)].map((match) => ({
    word: match[0]!.normalize("NFKC").toLocaleLowerCase("en-AU"),
    start: match.index!,
    end: match.index! + match[0]!.length
  }));
}

function contentWords(value: string): string[] {
  const stop = new Set([
    "a", "an", "and", "are", "as", "at", "be", "because", "but", "by", "for", "from", "has", "have",
    "he", "in", "is", "it", "of", "on", "or", "our", "that", "the", "their", "this", "to", "was", "we",
    "what", "when", "which", "who", "will", "with", "you", "your"
  ]);
  return lexicalWordOffsets(value).map((item) => item.word).filter((word) => word.length >= 4 && !stop.has(word));
}

function paragraphRanges(value: string): Array<{ number: number; start: number; end: number }> {
  const ranges: Array<{ number: number; start: number; end: number }> = [];
  const pattern = /\S(?:[\s\S]*?\S)?(?=\n\s*\n|$)/gu;
  for (const match of value.matchAll(pattern)) {
    ranges.push({ number: ranges.length + 1, start: match.index!, end: match.index! + match[0]!.length });
  }
  return ranges;
}

function sentenceFragments(value: string): string[] {
  return value.split(/(?<=[.!?])\s+/u).map((item) => item.trim()).filter(Boolean);
}

function longestCopiedRun(output: string, transcript: string): number {
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

function overlapCount(left: string, right: string): number {
  const rightWords = new Set(contentWords(right));
  return new Set(contentWords(left).filter((word) => rightWords.has(word))).size;
}

function add(issues: EnrichmentValidationIssue[], code: string, path: string, message: string): void {
  issues.push({ code, path, message });
}

function supportText(supports: readonly GroundingSupport[], transcript: string): string {
  return supports.map((support) => transcript.slice(support.characterStart, support.characterEnd)).join(" ");
}

function validateSupports(
  supports: readonly GroundingSupport[],
  transcript: string,
  expectedPart: GroundingSupport["outputPart"],
  expectedIndex: number,
  path: string,
  issues: EnrichmentValidationIssue[]
): void {
  const words = lexicalWordOffsets(transcript);
  const paragraphs = paragraphRanges(transcript);
  if (supports.length === 0) add(issues, "grounding_missing", path, "Grounding evidence is required");
  for (const [index, support] of supports.entries()) {
    const itemPath = `${path}[${index}]`;
    if (support.outputPart !== expectedPart || support.outputIndex !== expectedIndex) {
      add(issues, "grounding_output_mismatch", itemPath, "Grounding evidence is attached to the wrong output item");
    }
    if (support.characterStart >= support.characterEnd || support.characterEnd > transcript.length) {
      add(issues, "grounding_bounds_invalid", itemPath, "Grounding character bounds are outside the transcript");
      continue;
    }
    const paragraph = paragraphs.find((item) => support.characterStart >= item.start && support.characterEnd <= item.end);
    if (!paragraph || paragraph.number !== support.paragraphNumber) {
      add(issues, "grounding_paragraph_mismatch", itemPath, "Grounding evidence does not match its transcript paragraph");
    }
    const contained = words.map((word, wordIndex) => ({ ...word, wordIndex: wordIndex + 1 }))
      .filter((word) => word.start >= support.characterStart && word.end <= support.characterEnd);
    if (contained.length === 0 || contained[0]!.wordIndex !== support.wordStart ||
      contained.at(-1)!.wordIndex !== support.wordEnd || support.wordStart > support.wordEnd) {
      add(issues, "grounding_word_bounds_mismatch", itemPath, "Grounding word bounds do not match the character range");
    }
    if (sha256Utf8(transcript.slice(support.characterStart, support.characterEnd)) !== support.supportSha256) {
      add(issues, "grounding_hash_mismatch", itemPath, "Grounding evidence hash does not match the transcript range");
    }
  }
}

const retiredWrapperPhrases = [
  "this sermon explores its central themes and applications through the speaker's teaching",
  "listeners are invited to consider these points carefully and reflect on how the message applies to faith and daily life",
  "the sermon explains:"
];

const retiredQuestions = new Set([
  "what main concern does the opening part of the sermon establish?",
  "how does the sermon develop its central teaching?",
  "what biblical truth or context does the message emphasize?",
  "what challenge does the sermon place before its listeners?",
  "what encouragement does the message offer?",
  "how does the sermon connect belief with everyday life?",
  "what should listeners reflect on after hearing this message?"
]);

const scriptureClaimPattern = /\b(?:genesis|exodus|psalms?|isaiah|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|hebrews|james|peter|revelation)\s+\d|\b(?:the bible teaches|god promises|jesus says|scripture says|salvation requires)\b/iu;
const unexplainedVerseFragmentPattern = /\b(?:chapter|verse)\s+\d{1,3}\b|\b\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\b/iu;
const abruptTransitionPattern = /(?:^|[.!?]["'’)]?\s+)(?:And|But|So)\s+(?:then|now)\b|\b(?:and|but|so)\s+(?:and|but|so)\b/u;

function hasRepeatedWordSequence(value: string, size = 8): boolean {
  const words = lexicalWordOffsets(value).map((item) => item.word);
  const observed = new Set<string>();
  for (let index = 0; index + size <= words.length; index += 1) {
    const sequence = words.slice(index, index + size).join(" ");
    if (observed.has(sequence)) return true;
    observed.add(sequence);
  }
  return false;
}

export interface DescriptionQualityInspection {
  issues: EnrichmentValidationIssue[];
  metrics: {
    wordCount: number;
    paragraphCount: number;
    maximumCopiedWordRun: number;
  };
}

export function inspectDescriptionQuality(
  description: SermonEnrichmentResult["description"],
  current: CurrentApprovedTranscript
): DescriptionQualityInspection {
  const issues: EnrichmentValidationIssue[] = [];
  const descriptionWords = lexicalWordOffsets(description.bodyText).length;
  const descriptionParagraphs = paragraphRanges(description.bodyText);
  const maximumCopiedWordRun = longestCopiedRun(description.bodyText, current.bodyText);
  if (descriptionWords < 180 || descriptionWords > 220) {
    add(issues, "description_word_count", "description.bodyText", "The description must contain 180–220 words");
  }
  if (descriptionParagraphs.length < 2 || descriptionParagraphs.length > 4) {
    add(issues, "description_paragraph_count", "description.bodyText", "The description must use two to four coherent paragraphs");
  }
  const fragments = sentenceFragments(description.bodyText);
  if (fragments.some((sentence) => !/[.!?]["'’)]*$/u.test(sentence) || lexicalWordOffsets(sentence).length < 5)) {
    add(issues, "description_incomplete_sentence", "description.bodyText", "The description contains an incomplete sentence or caption fragment");
  }
  const lowerDescription = description.bodyText.toLocaleLowerCase("en-AU");
  if (retiredWrapperPhrases.some((phrase) => lowerDescription.includes(phrase))) {
    add(issues, "generic_wrapper", "description.bodyText", "The description contains retired generic wrapper text");
  }
  if (maximumCopiedWordRun >= 18) {
    add(issues, "disconnected_excerpt_risk", "description.bodyText", "The description contains an overlong verbatim transcript run");
  }
  if (hasRepeatedWordSequence(description.bodyText)) {
    add(issues, "description_repetition", "description.bodyText", "The description repeats an overlong wording sequence");
  }
  if (abruptTransitionPattern.test(description.bodyText)) {
    add(issues, "description_abrupt_transition", "description.bodyText", "The description contains an abrupt caption-like transition");
  }
  if (overlapCount(description.centralSubject, description.bodyText) < 2 ||
    overlapCount(description.centralSubject, current.bodyText) < 2) {
    add(issues, "central_subject_missing", "description.centralSubject", "The declared central subject is not grounded in both transcript and description");
  }
  if (/faith and daily life|apply (?:it|this) to (?:our|your) lives|consider these points|reflect on the message/iu.test(description.application) ||
    overlapCount(description.application, description.bodyText) < 2 ||
    overlapCount(description.application, current.bodyText) < 2) {
    add(issues, "application_generic_or_missing", "description.application", "The application must be specific to the sermon and transcript-grounded");
  }
  for (const paragraph of descriptionParagraphs) {
    const supports = description.supports.filter((support) => support.outputIndex === paragraph.number);
    validateSupports(supports, current.bodyText, "description_paragraph", paragraph.number, `description.supports.paragraph${paragraph.number}`, issues);
    const paragraphText = description.bodyText.slice(paragraph.start, paragraph.end);
    if (supports.length > 0 && overlapCount(paragraphText, supportText(supports, current.bodyText)) < 2) {
      add(issues, "description_support_disconnected", `description.supports.paragraph${paragraph.number}`, "The paragraph is disconnected from its recorded transcript support");
    }
  }
  if (!description.supports.some((support) => support.purpose === "subject" || support.purpose === "reasoning") ||
    !description.supports.some((support) => support.purpose === "application")) {
    add(issues, "description_required_grounding_missing", "description.supports", "Subject/reasoning and application support are both required");
  }
  if ((scriptureClaimPattern.test(description.bodyText) || unexplainedVerseFragmentPattern.test(description.bodyText)) &&
    !description.supports.some((support) => support.purpose === "scripture_use" || support.purpose === "theological_claim")) {
    add(issues, "unsupported_scripture_or_theology", "description", "A detectable Scripture, verse or theological claim lacks explicit supporting evidence");
  }
  return {
    issues,
    metrics: {
      wordCount: descriptionWords,
      paragraphCount: descriptionParagraphs.length,
      maximumCopiedWordRun
    }
  };
}

export function validateSermonEnrichmentResult(
  input: unknown,
  current: CurrentApprovedTranscript
): EnrichmentValidationResult {
  const parsed = sermonEnrichmentResultSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "contract_invalid",
        path: issue.path.join("."),
        message: issue.message
      })),
      mechanicalQa: null,
      metrics: { descriptionWordCount: 0, questionAnswerCount: 0, descriptionParagraphCount: 0, supportCount: 0, maximumCopiedWordRun: 0 }
    };
  }
  const value = parsed.data;
  const issues: EnrichmentValidationIssue[] = [];
  const transcriptSha256 = sha256Utf8(current.bodyText);
  const transcriptWords = lexicalWordOffsets(current.bodyText);
  if (value.target.sermonId !== current.sermonId || value.target.sourceWordPressId !== current.sourceWordPressId ||
    value.transcript.sermonId !== current.sermonId) {
    add(issues, "target_identity_mismatch", "target", "The result target does not match the approved transcript identity");
  }
  if (value.transcript.rowVersion !== current.rowVersion || value.transcript.sha256 !== transcriptSha256 ||
    value.transcript.characterCount !== current.bodyText.length || value.transcript.wordCount !== transcriptWords.length ||
    value.transcript.status !== current.status || value.transcript.approvedAt !== current.approvedAt) {
    add(issues, "transcript_binding_stale", "transcript", "The result is stale or does not match the current approved transcript");
  }
  if (value.integrity.canonicalSha256 !== sermonEnrichmentResultSha256(value)) {
    add(issues, "result_integrity_mismatch", "integrity", "The result integrity hash is invalid");
  }

  const descriptionQuality = inspectDescriptionQuality(value.description, current);
  issues.push(...descriptionQuality.issues);
  const mechanicalQa = inspectGeneratedText(value.description.bodyText, value.questionAnswers);
  if (value.skillVersion !== "1.0.0" && value.mechanicalProofread === undefined) {
    add(issues, "mechanical_proofread_missing", "mechanicalProofread", "Current skill results must record the completed mechanical proofread");
  }
  if (value.skillVersion === "1.2.0" && (!value.generator || !value.promptPolicy)) {
    add(issues, "generator_provenance_missing", "generator", "Skill version 1.2 results must identify the approved generator and prompt policy");
  }
  if (value.mechanicalProofread && (
    value.mechanicalProofread.outcome !== mechanicalQa.outcome ||
    value.mechanicalProofread.blockingIssueCount !== mechanicalQa.blockingIssueCount ||
    value.mechanicalProofread.reviewIssueCount !== mechanicalQa.reviewIssueCount
  )) {
    add(issues, "mechanical_proofread_mismatch", "mechanicalProofread", "The recorded mechanical proofread does not match independent validation");
  }
  for (const finding of mechanicalQa.issues.filter((item) => item.severity === "blocking")) {
    const itemPath = finding.itemIndex === null ? "" : `[${finding.itemIndex}]`;
    add(
      issues,
      finding.code,
      finding.contentArea === "description"
        ? "description.bodyText"
        : `questionAnswers${itemPath}.${finding.contentArea}`,
      "Generated text did not pass the required deterministic editorial proofread"
    );
  }
  const expectedOrders = value.questionAnswers.map((_item, index) => index + 1);
  if (!value.questionAnswers.every((item, index) => item.displayOrder === expectedOrders[index])) {
    add(issues, "question_order_invalid", "questionAnswers", "Q&A display orders must be consecutive and ordered");
  }
  for (const [index, item] of value.questionAnswers.entries()) {
    const path = `questionAnswers[${index}]`;
    if (retiredQuestions.has(item.question.toLocaleLowerCase("en-AU")) ||
      /^(?:what (?:main|biblical)|how does the sermon|what should listeners)/iu.test(item.question)) {
      add(issues, "fixed_or_generic_question", `${path}.question`, "The question is a fixed or generic prompt rather than sermon-specific");
    }
    if (!/[?]$/u.test(item.question) || lexicalWordOffsets(item.question).length < 6) {
      add(issues, "question_not_substantive", `${path}.question`, "The question must be a complete, substantive question");
    }
    if (!/[.!?]["'’)]*$/u.test(item.answer) || lexicalWordOffsets(item.answer).length < 12) {
      add(issues, "answer_not_substantive", `${path}.answer`, "The answer must be a complete, substantive response");
    }
    validateSupports(item.supports, current.bodyText, "question_answer", item.displayOrder, `${path}.supports`, issues);
    const evidence = supportText(item.supports, current.bodyText);
    if (overlapCount(item.answer, evidence) < 1) {
      add(issues, "answer_support_disconnected", path, "The Q&A wording is disconnected from its recorded transcript support");
    }
    if (longestCopiedRun(item.answer, current.bodyText) >= 18) {
      add(issues, "answer_excerpt_copy", `${path}.answer`, "The answer pastes an overlong transcript excerpt instead of paraphrasing it");
    }
    if (scriptureClaimPattern.test(`${item.question} ${item.answer}`) &&
      !item.supports.some((support) => support.purpose === "scripture_use" || support.purpose === "theological_claim")) {
      add(issues, "unsupported_scripture_or_theology", path, "A detectable Scripture or theological claim lacks explicit supporting evidence");
    }
  }
  for (let left = 0; left < value.questionAnswers.length; left += 1) {
    for (let right = left + 1; right < value.questionAnswers.length; right += 1) {
      const leftWords = new Set(contentWords(value.questionAnswers[left]!.question));
      const rightWords = new Set(contentWords(value.questionAnswers[right]!.question));
      const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
      const union = new Set([...leftWords, ...rightWords]).size;
      if (union > 0 && intersection / union >= 0.8) {
        add(issues, "question_substantial_duplicate", "questionAnswers", "Q&A questions must cover distinct sermon-specific concerns");
      }
    }
  }
  return {
    valid: issues.length === 0,
    issues,
    mechanicalQa,
    metrics: {
      descriptionWordCount: descriptionQuality.metrics.wordCount,
      questionAnswerCount: value.questionAnswers.length,
      descriptionParagraphCount: descriptionQuality.metrics.paragraphCount,
      supportCount: value.description.supports.length + value.questionAnswers.reduce((sum, item) => sum + item.supports.length, 0),
      maximumCopiedWordRun: descriptionQuality.metrics.maximumCopiedWordRun
    }
  };
}

import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  groundingSupportSchema,
  inspectDescriptionQuality,
  lexicalWordOffsets,
  sha256Utf8,
  type CurrentApprovedTranscript
} from "./sermon-enrichment-contracts";
import {
  generatedTextMechanicalQaVersion,
  inspectGeneratedText
} from "./generated-text-mechanical-qa";
import {
  sermonEnrichmentSkillName,
  sermonEnrichmentSkillVersion
} from "./sermon-enrichment-policy";

export const approvedDescriptionGenerationPipelineVersion = "approved-description-generation-v1" as const;
export const descriptionGenerationPromptPolicyVersion = "sermon-enrichment-description-prompt-v1" as const;

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(sourceDirectory, "..", "..");
const skillPath = join(repositoryRoot, ".agents", "skills", "sermon-enrichment", "SKILL.md");
const groundingContractPath = join(
  repositoryRoot,
  ".agents",
  "skills",
  "sermon-enrichment",
  "references",
  "grounding-contract.md"
);

const generatorIdentitySchema = z.object({
  provider: z.string().trim().regex(/^[A-Za-z0-9._-]+$/u).max(100),
  model: z.string().trim().min(1).max(240),
  modelRevision: z.string().trim().min(1).max(240),
  approvalReference: z.string().trim().regex(/^[A-Za-z0-9._:-]+$/u).max(240)
}).strict();

const descriptionCandidateSchema = z.object({
  bodyText: z.string().trim().min(1).max(2_000),
  centralSubject: z.string().trim().min(1).max(500),
  application: z.string().trim().min(1).max(500),
  supports: z.array(groundingSupportSchema).min(1)
}).strict();

export type ApprovedDescriptionGeneratorIdentity = z.infer<typeof generatorIdentitySchema>;
export type GeneratedDescriptionCandidate = z.infer<typeof descriptionCandidateSchema>;

export interface DescriptionGenerationPromptPolicy {
  policyVersion: typeof descriptionGenerationPromptPolicyVersion;
  skillName: typeof sermonEnrichmentSkillName;
  skillVersion: typeof sermonEnrichmentSkillVersion;
  skillInstructions: string;
  groundingContract: string;
  skillInstructionsSha256: string;
  groundingContractSha256: string;
  combinedSha256: string;
}

export interface ApprovedDescriptionGenerationRequest {
  pipelineVersion: typeof approvedDescriptionGenerationPipelineVersion;
  requestedAt: string;
  target: { sourceWordPressId: number; sermonId: string };
  transcript: {
    sermonId: string;
    rowVersion: number;
    groundingRevisionId?: string;
    status: "approved";
    approvedAt: string;
    sha256: string;
    characterCount: number;
    wordCount: number;
    bodyText: string;
  };
  instructions: {
    promptPolicyVersion: typeof descriptionGenerationPromptPolicyVersion;
    skillName: typeof sermonEnrichmentSkillName;
    skillVersion: typeof sermonEnrichmentSkillVersion;
    skillInstructions: string;
    groundingContract: string;
  };
  requirements: {
    descriptionWordMinimum: 180;
    descriptionWordMaximum: 220;
    completeTranscriptRequired: true;
    transcriptGroundingRequired: true;
    privateUnapprovedDraftOnly: true;
    finalProofreadRequired: true;
    mechanicalProofreadVersion: typeof generatedTextMechanicalQaVersion;
    prohibitedMethods: readonly ["transcript_excerpt_ranking", "fixed_generic_wrapper", "deterministic_extraction_fallback"];
  };
}

export interface ApprovedDescriptionTextGenerator {
  identity: ApprovedDescriptionGeneratorIdentity;
  generateDescription(request: ApprovedDescriptionGenerationRequest): Promise<unknown>;
}

export type DescriptionGenerationFailureCode =
  | "target_scope_mismatch"
  | "approved_transcript_required"
  | "transcript_binding_invalid"
  | "prompt_policy_unavailable"
  | "approved_text_generation_model_unavailable"
  | "generator_identity_invalid"
  | "text_generation_failed"
  | "generated_candidate_invalid"
  | "generated_candidate_quality_failed";

export interface ApprovedDescriptionGenerationInput {
  authorizedTarget: { sourceWordPressId: number; sermonId: string };
  transcript: CurrentApprovedTranscript;
  requestedAt: string;
}

interface GenerationResultBase {
  schemaVersion: 1;
  privateContent: true;
  pipelineVersion: typeof approvedDescriptionGenerationPipelineVersion;
  target: { sourceWordPressId: number; sermonId: string };
  transcript: {
    rowVersion: number;
    groundingRevisionId?: string;
    approvedAt: string;
    sha256: string;
    characterCount: number;
    wordCount: number;
  };
  promptPolicy: {
    version: typeof descriptionGenerationPromptPolicyVersion;
    skillName: typeof sermonEnrichmentSkillName;
    skillVersion: typeof sermonEnrichmentSkillVersion;
    skillInstructionsSha256: string;
    groundingContractSha256: string;
    combinedSha256: string;
  } | null;
  generator: ApprovedDescriptionGeneratorIdentity | null;
  publicVisibility: "private";
  searchEligible: false;
  semanticEligible: false;
  manualAdministratorReviewRequired: true;
}

export interface ApprovedDescriptionGenerationSuccess extends GenerationResultBase {
  outcome: "generated_private_draft";
  draftCreated: true;
  approvalState: "draft";
  candidate: GeneratedDescriptionCandidate;
  validation: {
    valid: true;
    issueCodes: [];
    mechanicalProofreadVersion: typeof generatedTextMechanicalQaVersion;
    mechanicalProofreadOutcome: "passed" | "passed_with_review_flags";
    mechanicalReviewFlagCount: number;
  };
  failure: null;
  integrity: { canonicalSha256: string };
}

export interface ApprovedDescriptionGenerationFailure extends GenerationResultBase {
  outcome: "generation_failed";
  draftCreated: false;
  approvalState: "not_created";
  candidate: null;
  validation: {
    valid: false;
    issueCodes: string[];
    mechanicalProofreadVersion: typeof generatedTextMechanicalQaVersion;
    mechanicalProofreadOutcome: "not_run" | "failed";
    mechanicalReviewFlagCount: number;
  };
  failure: {
    code: DescriptionGenerationFailureCode;
    manualAttentionRequired: true;
  };
  integrity: { canonicalSha256: string };
}

export type ApprovedDescriptionGenerationResult =
  | ApprovedDescriptionGenerationSuccess
  | ApprovedDescriptionGenerationFailure;

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

function resultSha256(value: Omit<ApprovedDescriptionGenerationResult, "integrity"> | ApprovedDescriptionGenerationResult): string {
  return createHash("sha256").update(JSON.stringify(canonicalise(value)), "utf8").digest("hex");
}

function transcriptEvidence(transcript: CurrentApprovedTranscript): GenerationResultBase["transcript"] {
  return {
    rowVersion: transcript.rowVersion,
    ...(transcript.groundingRevisionId ? { groundingRevisionId: transcript.groundingRevisionId } : {}),
    approvedAt: transcript.approvedAt,
    sha256: sha256Utf8(transcript.bodyText),
    characterCount: transcript.bodyText.length,
    wordCount: lexicalWordOffsets(transcript.bodyText).length
  };
}

function promptEvidence(policy: DescriptionGenerationPromptPolicy): NonNullable<GenerationResultBase["promptPolicy"]> {
  return {
    version: policy.policyVersion,
    skillName: policy.skillName,
    skillVersion: policy.skillVersion,
    skillInstructionsSha256: policy.skillInstructionsSha256,
    groundingContractSha256: policy.groundingContractSha256,
    combinedSha256: policy.combinedSha256
  };
}

function failureResult(input: {
  request: ApprovedDescriptionGenerationInput;
  code: DescriptionGenerationFailureCode;
  promptPolicy: DescriptionGenerationPromptPolicy | null;
  generator: ApprovedDescriptionGeneratorIdentity | null;
  issueCodes?: string[];
  mechanicalOutcome?: "not_run" | "failed";
  mechanicalReviewFlagCount?: number;
}): ApprovedDescriptionGenerationFailure {
  const withoutIntegrity: Omit<ApprovedDescriptionGenerationFailure, "integrity"> = {
    schemaVersion: 1,
    privateContent: true,
    pipelineVersion: approvedDescriptionGenerationPipelineVersion,
    outcome: "generation_failed",
    draftCreated: false,
    approvalState: "not_created",
    target: { ...input.request.authorizedTarget },
    transcript: transcriptEvidence(input.request.transcript),
    promptPolicy: input.promptPolicy ? promptEvidence(input.promptPolicy) : null,
    generator: input.generator,
    publicVisibility: "private",
    searchEligible: false,
    semanticEligible: false,
    manualAdministratorReviewRequired: true,
    candidate: null,
    validation: {
      valid: false,
      issueCodes: input.issueCodes ?? [],
      mechanicalProofreadVersion: generatedTextMechanicalQaVersion,
      mechanicalProofreadOutcome: input.mechanicalOutcome ?? "not_run",
      mechanicalReviewFlagCount: input.mechanicalReviewFlagCount ?? 0
    },
    failure: { code: input.code, manualAttentionRequired: true }
  };
  return { ...withoutIntegrity, integrity: { canonicalSha256: resultSha256(withoutIntegrity) } };
}

export async function loadDescriptionGenerationPromptPolicy(): Promise<DescriptionGenerationPromptPolicy> {
  const [skillInstructions, groundingContract] = await Promise.all([
    readFile(skillPath, "utf8"),
    readFile(groundingContractPath, "utf8")
  ]);
  if (!skillInstructions.includes("## Non-negotiable boundaries") ||
    !skillInstructions.includes("Do not rank, concatenate, or wrap transcript excerpts") ||
    !skillInstructions.includes("## Final editorial-proofreading checklist") ||
    !groundingContract.includes("# Private grounding contract") ||
    !groundingContract.includes("Do not store support quotations separately")) {
    throw new Error("The complete sermon-enrichment prompt policy is unavailable or incomplete");
  }
  const skillInstructionsSha256 = sha256Utf8(skillInstructions);
  const groundingContractSha256 = sha256Utf8(groundingContract);
  return {
    policyVersion: descriptionGenerationPromptPolicyVersion,
    skillName: sermonEnrichmentSkillName,
    skillVersion: sermonEnrichmentSkillVersion,
    skillInstructions,
    groundingContract,
    skillInstructionsSha256,
    groundingContractSha256,
    combinedSha256: sha256Utf8(`${descriptionGenerationPromptPolicyVersion}\n${skillInstructionsSha256}\n${groundingContractSha256}`)
  };
}

function currentTranscriptForCandidate(input: ApprovedDescriptionGenerationInput): CurrentApprovedTranscript {
  return {
    ...input.transcript,
    sourceWordPressId: input.authorizedTarget.sourceWordPressId,
    sermonId: input.authorizedTarget.sermonId
  };
}

export async function generateApprovedDescriptionDraft(
  input: ApprovedDescriptionGenerationInput,
  generator: ApprovedDescriptionTextGenerator | null
): Promise<ApprovedDescriptionGenerationResult> {
  if (input.authorizedTarget.sourceWordPressId !== input.transcript.sourceWordPressId ||
    input.authorizedTarget.sermonId !== input.transcript.sermonId) {
    return failureResult({ request: input, code: "target_scope_mismatch", promptPolicy: null, generator: null });
  }
  if (input.transcript.status !== "approved" || !input.transcript.approvedAt) {
    return failureResult({ request: input, code: "approved_transcript_required", promptPolicy: null, generator: null });
  }
  const sourceSha256 = sha256Utf8(input.transcript.bodyText);
  if (!/^[0-9a-f]{64}$/u.test(sourceSha256) || input.transcript.bodyText.trim().length === 0) {
    return failureResult({ request: input, code: "transcript_binding_invalid", promptPolicy: null, generator: null });
  }

  let policy: DescriptionGenerationPromptPolicy;
  try {
    policy = await loadDescriptionGenerationPromptPolicy();
  } catch {
    return failureResult({ request: input, code: "prompt_policy_unavailable", promptPolicy: null, generator: null });
  }
  if (!generator) {
    return failureResult({
      request: input,
      code: "approved_text_generation_model_unavailable",
      promptPolicy: policy,
      generator: null
    });
  }
  const identity = generatorIdentitySchema.safeParse(generator.identity);
  if (!identity.success) {
    return failureResult({ request: input, code: "generator_identity_invalid", promptPolicy: policy, generator: null });
  }

  const request: ApprovedDescriptionGenerationRequest = {
    pipelineVersion: approvedDescriptionGenerationPipelineVersion,
    requestedAt: input.requestedAt,
    target: { ...input.authorizedTarget },
    transcript: {
      sermonId: input.transcript.sermonId,
      rowVersion: input.transcript.rowVersion,
      ...(input.transcript.groundingRevisionId
        ? { groundingRevisionId: input.transcript.groundingRevisionId }
        : {}),
      status: "approved",
      approvedAt: input.transcript.approvedAt,
      sha256: sourceSha256,
      characterCount: input.transcript.bodyText.length,
      wordCount: lexicalWordOffsets(input.transcript.bodyText).length,
      bodyText: input.transcript.bodyText
    },
    instructions: {
      promptPolicyVersion: policy.policyVersion,
      skillName: policy.skillName,
      skillVersion: policy.skillVersion,
      skillInstructions: policy.skillInstructions,
      groundingContract: policy.groundingContract
    },
    requirements: {
      descriptionWordMinimum: 180,
      descriptionWordMaximum: 220,
      completeTranscriptRequired: true,
      transcriptGroundingRequired: true,
      privateUnapprovedDraftOnly: true,
      finalProofreadRequired: true,
      mechanicalProofreadVersion: generatedTextMechanicalQaVersion,
      prohibitedMethods: ["transcript_excerpt_ranking", "fixed_generic_wrapper", "deterministic_extraction_fallback"]
    }
  };

  let raw: unknown;
  try {
    raw = await generator.generateDescription(request);
  } catch {
    return failureResult({ request: input, code: "text_generation_failed", promptPolicy: policy, generator: identity.data });
  }
  const candidate = descriptionCandidateSchema.safeParse(raw);
  if (!candidate.success) {
    return failureResult({ request: input, code: "generated_candidate_invalid", promptPolicy: policy, generator: identity.data });
  }
  const quality = inspectDescriptionQuality(candidate.data, currentTranscriptForCandidate(input));
  const mechanical = inspectGeneratedText(candidate.data.bodyText, []);
  const blockingMechanicalCodes = mechanical.issues
    .filter((issue) => issue.severity === "blocking" ||
      issue.code === "possible_caption_fragment" || issue.code === "biblical_name_or_book_capitalisation")
    .map((issue) => issue.code);
  const issueCodes = [...new Set([...quality.issues.map((issue) => issue.code), ...blockingMechanicalCodes])].sort();
  if (issueCodes.length > 0) {
    return failureResult({
      request: input,
      code: "generated_candidate_quality_failed",
      promptPolicy: policy,
      generator: identity.data,
      issueCodes,
      mechanicalOutcome: blockingMechanicalCodes.length > 0 ? "failed" : "not_run",
      mechanicalReviewFlagCount: mechanical.reviewIssueCount
    });
  }

  const withoutIntegrity: Omit<ApprovedDescriptionGenerationSuccess, "integrity"> = {
    schemaVersion: 1,
    privateContent: true,
    pipelineVersion: approvedDescriptionGenerationPipelineVersion,
    outcome: "generated_private_draft",
    draftCreated: true,
    approvalState: "draft",
    target: { ...input.authorizedTarget },
    transcript: transcriptEvidence(input.transcript),
    promptPolicy: promptEvidence(policy),
    generator: identity.data,
    publicVisibility: "private",
    searchEligible: false,
    semanticEligible: false,
    manualAdministratorReviewRequired: true,
    candidate: candidate.data,
    validation: {
      valid: true,
      issueCodes: [],
      mechanicalProofreadVersion: generatedTextMechanicalQaVersion,
      mechanicalProofreadOutcome: mechanical.outcome === "failed" ? "passed_with_review_flags" : mechanical.outcome,
      mechanicalReviewFlagCount: mechanical.reviewIssueCount
    },
    failure: null
  };
  return { ...withoutIntegrity, integrity: { canonicalSha256: resultSha256(withoutIntegrity) } };
}

export const supersededWave1GenerationVersion = "phase3b2c-wave1-extractive-drafts-v2" as const;
export const sermonEnrichmentSkillName = "sermon-enrichment" as const;
export const sermonEnrichmentSkillVersion = "1.3.0" as const;
export const supportedSermonEnrichmentSkillVersions = ["1.0.0", "1.1.0", "1.2.0", sermonEnrichmentSkillVersion] as const;
export const sermonEnrichmentGenerationMethod = "codex_skill_grounded_synthesis" as const;

const groundedReferenceV1Pattern = /^sermon-enrichment:v1:([0-9a-f]{64}):([1-9][0-9]*):([0-9a-f]{64})$/u;
const groundedReferenceV2Pattern = /^sermon-enrichment:v2:([0-9a-f-]{36}):([0-9a-f]{64}):([0-9a-f]{64})$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function isSupersededWave1SourceReference(value: string | null | undefined): boolean {
  return typeof value === "string" && value.endsWith(`:${supersededWave1GenerationVersion}`);
}

export function parseGroundedSermonEnrichmentSourceReference(value: string | null | undefined): {
  version: 1;
  transcriptSha256: string;
  transcriptRowVersion: number;
  resultSha256: string;
} | {
  version: 2;
  transcriptGroundingRevisionId: string;
  transcriptRowVersion?: undefined;
  transcriptSha256: string;
  resultSha256: string;
} | null {
  if (typeof value !== "string") return null;
  const current = value.match(groundedReferenceV2Pattern);
  if (current && uuidPattern.test(current[1]!)) {
    return {
      version: 2,
      transcriptGroundingRevisionId: current[1]!,
      transcriptSha256: current[2]!,
      resultSha256: current[3]!
    };
  }
  const legacy = value.match(groundedReferenceV1Pattern);
  if (!legacy) return null;
  return {
    version: 1,
    transcriptSha256: legacy[1]!,
    transcriptRowVersion: Number(legacy[2]),
    resultSha256: legacy[3]!
  };
}

export function groundedSermonEnrichmentSourceReference(
  transcriptSha256: string,
  transcriptGroundingIdentity: number | string,
  resultSha256: string
): string {
  const value = typeof transcriptGroundingIdentity === "number"
    ? `sermon-enrichment:v1:${transcriptSha256}:${transcriptGroundingIdentity}:${resultSha256}`
    : `sermon-enrichment:v2:${transcriptGroundingIdentity}:${transcriptSha256}:${resultSha256}`;
  const valid = typeof transcriptGroundingIdentity === "number"
    ? groundedReferenceV1Pattern.test(value)
    : groundedReferenceV2Pattern.test(value) && uuidPattern.test(transcriptGroundingIdentity);
  if (!valid) throw new Error("The grounded sermon-enrichment reference is invalid");
  return value;
}

export interface CurrentTranscriptGroundingIdentity {
  groundingRevisionId: string;
  transcriptSha256: string;
  legacyBindings: ReadonlyArray<{
    transcriptRowVersion: number;
    transcriptSha256: string;
    groundingRevisionId: string;
  }>;
}

export function groundedSermonEnrichmentReferenceIsCurrent(
  reference: string | null | undefined,
  current: CurrentTranscriptGroundingIdentity
): boolean {
  const grounded = parseGroundedSermonEnrichmentSourceReference(reference);
  if (!grounded || grounded.transcriptSha256 !== current.transcriptSha256) return false;
  if (grounded.version === 2) {
    return grounded.transcriptGroundingRevisionId === current.groundingRevisionId;
  }
  return current.legacyBindings.some((binding) =>
    binding.transcriptRowVersion === grounded.transcriptRowVersion &&
    binding.transcriptSha256 === grounded.transcriptSha256 &&
    binding.groundingRevisionId === current.groundingRevisionId
  );
}

export type GroundedArtifactRebindResult =
  | { outcome: "unchanged"; sourceReference: string }
  | { outcome: "rebound"; sourceReference: string; previousSourceReference: string }
  | { outcome: "refused"; reason: "approved" | "administrator_edited" | "invalid_grounding" | "transcript_changed" };

export function rebindPrivateGroundedArtifact(input: {
  sourceReference: string | null;
  sourceKind: string;
  status: string;
  administratorEdited: boolean;
  current: CurrentTranscriptGroundingIdentity;
}): GroundedArtifactRebindResult {
  if (input.status === "approved") return { outcome: "refused", reason: "approved" };
  if (input.administratorEdited || input.sourceKind !== "generated_draft") {
    return { outcome: "refused", reason: "administrator_edited" };
  }
  const parsed = parseGroundedSermonEnrichmentSourceReference(input.sourceReference);
  if (!parsed) return { outcome: "refused", reason: "invalid_grounding" };
  if (parsed.transcriptSha256 !== input.current.transcriptSha256) {
    return { outcome: "refused", reason: "transcript_changed" };
  }
  if (parsed.version === 2) {
    return parsed.transcriptGroundingRevisionId === input.current.groundingRevisionId
      ? { outcome: "unchanged", sourceReference: input.sourceReference! }
      : { outcome: "refused", reason: "transcript_changed" };
  }
  if (!groundedSermonEnrichmentReferenceIsCurrent(input.sourceReference, input.current)) {
    return { outcome: "refused", reason: "invalid_grounding" };
  }
  return {
    outcome: "rebound",
    previousSourceReference: input.sourceReference!,
    sourceReference: groundedSermonEnrichmentSourceReference(
      parsed.transcriptSha256,
      input.current.groundingRevisionId,
      parsed.resultSha256
    )
  };
}

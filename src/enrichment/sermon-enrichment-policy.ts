export const supersededWave1GenerationVersion = "phase3b2c-wave1-extractive-drafts-v2" as const;
export const sermonEnrichmentSkillName = "sermon-enrichment" as const;
export const sermonEnrichmentSkillVersion = "1.2.0" as const;
export const supportedSermonEnrichmentSkillVersions = ["1.0.0", "1.1.0", sermonEnrichmentSkillVersion] as const;
export const sermonEnrichmentGenerationMethod = "codex_skill_grounded_synthesis" as const;

const groundedReferencePattern = /^sermon-enrichment:v1:([0-9a-f]{64}):([1-9][0-9]*):([0-9a-f]{64})$/u;

export function isSupersededWave1SourceReference(value: string | null | undefined): boolean {
  return typeof value === "string" && value.endsWith(`:${supersededWave1GenerationVersion}`);
}

export function parseGroundedSermonEnrichmentSourceReference(value: string | null | undefined): {
  transcriptSha256: string;
  transcriptRowVersion: number;
  resultSha256: string;
} | null {
  if (typeof value !== "string") return null;
  const match = value.match(groundedReferencePattern);
  if (!match) return null;
  return {
    transcriptSha256: match[1]!,
    transcriptRowVersion: Number(match[2]),
    resultSha256: match[3]!
  };
}

export function groundedSermonEnrichmentSourceReference(
  transcriptSha256: string,
  transcriptRowVersion: number,
  resultSha256: string
): string {
  const value = `sermon-enrichment:v1:${transcriptSha256}:${transcriptRowVersion}:${resultSha256}`;
  if (!groundedReferencePattern.test(value)) throw new Error("The grounded sermon-enrichment reference is invalid");
  return value;
}

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  lexicalWordOffsets,
  sermonEnrichmentResultSha256,
  sha256Utf8,
  validateSermonEnrichmentResult,
  type GroundingSupport,
  type SermonEnrichmentResult
} from "../src/enrichment/sermon-enrichment-contracts";
import {
  groundedSermonEnrichmentSourceReference,
  isSupersededWave1SourceReference,
  parseGroundedSermonEnrichmentSourceReference,
  sermonEnrichmentGenerationMethod,
  sermonEnrichmentSkillName,
  sermonEnrichmentSkillVersion,
  supersededWave1GenerationVersion
} from "../src/enrichment/sermon-enrichment-policy";
import { canaryPreservedEvidenceMatches } from "../src/enrichment/sermon-enrichment-canary";

const sermonId = "11111111-1111-4111-8111-111111111111";
const approvedAt = "2026-01-02T03:04:05.000Z";
const transcript = [
  "The community garden had become difficult to maintain when schedules changed and several helpers carried competing responsibilities. The teacher asked everyone to remember that the garden existed to serve neighbours, not to reward the loudest volunteer. Dependable service began with understanding the purpose, listening to what was needed, and selecting useful tasks. Practical skill helped, but patience and cooperation protected both the work and the people. Hurried action could damage young plants and discourage quieter contributors. Steady responsibility mattered more than personal recognition, especially when progress was slow and the most important work happened without applause.",
  "The message then described ordinary habits that make shared work sustainable. People should keep promises, communicate clearly, and ask for help before confusion grows. Leaders should make room for quieter contributors and distribute responsibility instead of collecting every task. When a plan failed, the group should name the setback honestly, learn from it, and renew its effort without blaming one another. Every contribution deserved care, while rivalry distracted the community from its common purpose. Patient attention made cooperation possible because it allowed problems to be understood before solutions were imposed.",
  "The closing application focused on the next week of community commitments. Listeners were encouraged to choose one useful responsibility, confirm what others expected, and complete the work faithfully even if nobody noticed. They should invite help when a task exceeded their capacity and thank people whose contributions were easily overlooked. Success was measured by faithful care for neighbours rather than public credit or quick visible results. Continuing together through interruption would strengthen trust and keep the shared purpose clear. Slow progress was not failure when the community remained honest, attentive, responsible, and willing to begin again."
].join("\n\n");

const current = {
  sermonId,
  sourceWordPressId: 101,
  rowVersion: 3,
  status: "approved" as const,
  approvedAt,
  bodyText: transcript
};

function paragraphBounds(paragraphNumber: number): { start: number; end: number } {
  const paragraphs = transcript.split("\n\n");
  const text = paragraphs[paragraphNumber - 1]!;
  const start = paragraphs.slice(0, paragraphNumber - 1).reduce((sum, paragraph) => sum + paragraph.length + 2, 0);
  return { start, end: start + text.length };
}

function support(
  outputPart: GroundingSupport["outputPart"],
  outputIndex: number,
  paragraphNumber: number,
  purpose: GroundingSupport["purpose"]
): GroundingSupport {
  const bounds = paragraphBounds(paragraphNumber);
  const words = lexicalWordOffsets(transcript).map((word, index) => ({ ...word, number: index + 1 }))
    .filter((word) => word.start >= bounds.start && word.end <= bounds.end);
  return {
    outputPart,
    outputIndex,
    paragraphNumber,
    characterStart: bounds.start,
    characterEnd: bounds.end,
    wordStart: words[0]!.number,
    wordEnd: words.at(-1)!.number,
    supportSha256: sha256Utf8(transcript.slice(bounds.start, bounds.end)),
    purpose
  };
}

const description = [
  "An anonymised message examines dependable service when a community faces interruptions, competing needs, and slow progress. The speaker develops the subject through a shared garden project: healthy work begins by understanding the purpose, listening carefully, and choosing tasks that genuinely help. Skill matters, yet patience and cooperation matter as well, because hurried action can damage both the work and the people carrying it. The central concern is therefore not personal recognition, but steady responsibility shaped by the needs of neighbours.",
  "The sermon then turns from planning to daily practice. Listeners are encouraged to keep promises, ask for help before confusion grows, and make room for quieter contributors. Setbacks should be named honestly, learned from, and met with renewed effort instead of blame. The message applies this approach to ordinary community commitments: serve with patient attention, communicate clearly, share responsibility, and measure success by faithful care rather than applause. Such service becomes sustainable when the community remembers its common purpose and values every contribution without turning difficulty into rivalry. It closes by encouraging the group to continue useful work together, especially when results arrive slowly and no individual receives public credit."
].join("\n\n");

function validResult(): SermonEnrichmentResult {
  const withoutIntegrity: Omit<SermonEnrichmentResult, "integrity"> = {
    schemaVersion: 1,
    privateContent: true,
    approvalState: "draft",
    publicVisibility: "private",
    searchEligible: false,
    semanticEligible: false,
    skillName: sermonEnrichmentSkillName,
    skillVersion: sermonEnrichmentSkillVersion,
    generationMethod: sermonEnrichmentGenerationMethod,
    generatedAt: "2026-01-03T00:00:00.000Z",
    requestSha256: "9".repeat(64),
    target: { sourceWordPressId: current.sourceWordPressId, sermonId },
    transcript: {
      sermonId,
      rowVersion: current.rowVersion,
      status: "approved",
      approvedAt,
      sha256: sha256Utf8(transcript),
      characterCount: transcript.length,
      wordCount: lexicalWordOffsets(transcript).length
    },
    original: {
      bundleRelativePath: "private/phase-3b2c-wave1/prepared-private/anonymised.private.json",
      bundleSha256: "1".repeat(64),
      descriptionSha256: "2".repeat(64),
      questionAnswerSetSha256: "3".repeat(64)
    },
    description: {
      bodyText: description,
      centralSubject: "Dependable community service requires steady responsibility, patience, and cooperation rather than personal recognition.",
      application: "Listeners should keep commitments, communicate clearly, share responsibility, and care faithfully for neighbours even when progress is slow.",
      supports: [
        support("description_paragraph", 1, 1, "subject"),
        support("description_paragraph", 2, 2, "reasoning"),
        support("description_paragraph", 2, 3, "application")
      ]
    },
    questionAnswers: [
      ["Why did the shared garden need dependable service?", "Changing schedules and competing responsibilities made the work difficult, so the community needed steady helpers who remembered its purpose.", 1],
      ["What mattered more than recognition in the garden project?", "The message valued steady responsibility, patience, and cooperation above personal recognition or public applause.", 1],
      ["How could hurried action harm the shared work?", "Moving too quickly could damage young plants, overlook real needs, and discourage quieter people who were contributing.", 1],
      ["Which habits made the community's work sustainable?", "Keeping promises, communicating clearly, asking for help, and sharing responsibility allowed the group to work together with patient attention.", 2],
      ["How should the group respond when a plan failed?", "They should name the setback honestly, learn from it, and renew their effort without blaming one another.", 2],
      ["What responsibility were listeners encouraged to choose next?", "Each listener was encouraged to choose one useful commitment, clarify expectations, and complete the work faithfully during the coming week.", 3],
      ["How did the message measure success in service?", "Success meant faithful care for neighbours and continued responsibility together, even when progress was slow and nobody offered public credit.", 3]
    ].map(([question, answer, paragraphNumber], index) => ({
      displayOrder: index + 1,
      question: String(question),
      answer: String(answer),
      supports: [support("question_answer", index + 1, Number(paragraphNumber), "answer_support")]
    })),
    warnings: [{ code: "human_theological_review_required", safeDetail: "Automated checks do not establish theological or editorial approval." }],
    uncertainties: [],
    mechanicalProofread: {
      version: "generated-text-mechanical-qa-v1",
      completed: true,
      outcome: "passed",
      blockingIssueCount: 0,
      reviewIssueCount: 0
    }
  };
  return { ...withoutIntegrity, integrity: { canonicalSha256: sermonEnrichmentResultSha256(withoutIntegrity) } };
}

function rehash(value: SermonEnrichmentResult): SermonEnrichmentResult {
  return { ...value, integrity: { canonicalSha256: sermonEnrichmentResultSha256(value) } };
}

function issueCodes(value: unknown, snapshot = current): string[] {
  return validateSermonEnrichmentResult(value, snapshot).issues.map((issue) => issue.code);
}

describe("sermon-enrichment private grounded result", () => {
  it("accepts a coherent, private, transcript-bound anonymised result", () => {
    const result = validateSermonEnrichmentResult(validResult(), current);
    expect(result.issues).toEqual([]);
    expect(result.metrics.descriptionWordCount).toBeGreaterThanOrEqual(180);
    expect(result.metrics.descriptionWordCount).toBeLessThanOrEqual(220);
    expect(result.metrics.questionAnswerCount).toBe(7);
  });

  it("rejects generic wrappers and disconnected transcript excerpts", () => {
    const wrapper = validResult();
    wrapper.description.bodyText = wrapper.description.bodyText.replace(
      "An anonymised message examines dependable service",
      "This sermon explores its central themes and applications through the speaker's teaching and examines dependable service"
    );
    expect(issueCodes(rehash(wrapper))).toContain("generic_wrapper");

    const excerpts = validResult();
    excerpts.description.bodyText = `${transcript.split("\n\n")[0]}\n\n${transcript.split("\n\n")[1]}`;
    expect(issueCodes(rehash(excerpts))).toContain("disconnected_excerpt_risk");
  });

  it("rejects fixed questions and answers pasted from unrelated material", () => {
    const fixed = validResult();
    fixed.questionAnswers[0]!.question = "What main concern does the opening part of the sermon establish?";
    expect(issueCodes(rehash(fixed))).toContain("fixed_or_generic_question");

    const unrelated = validResult();
    unrelated.questionAnswers[0]!.answer = "Orbiting satellites calculate distant ocean temperatures while engineers inspect unrelated machinery in a silent laboratory.";
    expect(issueCodes(rehash(unrelated))).toContain("answer_support_disconnected");
  });

  it("rejects incomplete sentences, a missing subject, and generic application", () => {
    const fragment = validResult();
    fragment.description.bodyText = fragment.description.bodyText.replace(/\.$/u, "");
    expect(issueCodes(rehash(fragment))).toContain("description_incomplete_sentence");

    const subject = validResult();
    subject.description.centralSubject = "Invisible astronomy mechanics control remote galaxies beyond measurement.";
    expect(issueCodes(rehash(subject))).toContain("central_subject_missing");

    const application = validResult();
    application.description.application = "Listeners should reflect on the message and apply it to our lives.";
    expect(issueCodes(rehash(application))).toContain("application_generic_or_missing");
  });

  it("requires a completed deterministic editorial proofread and rejects lowercase jesus", () => {
    const defective = validResult();
    defective.description.bodyText = defective.description.bodyText.replace("The speaker", "jesus and the speaker");
    defective.mechanicalProofread = {
      version: "generated-text-mechanical-qa-v1",
      completed: true,
      outcome: "failed",
      blockingIssueCount: 1,
      reviewIssueCount: 0
    };
    const validation = validateSermonEnrichmentResult(rehash(defective), current);
    expect(validation.mechanicalQa?.completed).toBe(true);
    expect(validation.mechanicalQa?.outcome).toBe("failed");
    expect(validation.issues.map((issue) => issue.code)).toContain("jesus_incorrect_capitalisation");
  });

  it("requires and independently verifies the declared version 1.1 proofread result", () => {
    const missing = validResult();
    delete missing.mechanicalProofread;
    expect(issueCodes(rehash(missing))).toContain("mechanical_proofread_missing");

    const mismatch = validResult();
    mismatch.mechanicalProofread!.reviewIssueCount = 1;
    expect(issueCodes(rehash(mismatch))).toContain("mechanical_proofread_mismatch");
  });

  it("rejects detectable unsupported Scripture claims and invalid evidence", () => {
    const claim = validResult();
    claim.questionAnswers[0]!.answer = "Romans 8 teaches that the garden will prosper because dependable volunteers always receive a visible reward.";
    expect(issueCodes(rehash(claim))).toContain("unsupported_scripture_or_theology");

    const bounds = validResult();
    bounds.description.supports[0]!.characterEnd = transcript.length + 10;
    expect(issueCodes(rehash(bounds))).toContain("grounding_bounds_invalid");

    const hash = validResult();
    hash.questionAnswers[0]!.supports[0]!.supportSha256 = "f".repeat(64);
    expect(issueCodes(rehash(hash))).toContain("grounding_hash_mismatch");
  });

  it("marks transcript hash or row-version changes stale", () => {
    expect(issueCodes(validResult(), { ...current, rowVersion: current.rowVersion + 1 })).toContain("transcript_binding_stale");
    expect(issueCodes(validResult(), { ...current, bodyText: `${current.bodyText} changed` })).toContain("transcript_binding_stale");
  });

  it("prevents approval, public visibility, search, or semantic eligibility in the result contract", () => {
    const result = validResult() as unknown as Record<string, unknown>;
    result.approvalState = "approved";
    result.publicVisibility = "public";
    result.searchEligible = true;
    result.semanticEligible = true;
    expect(issueCodes(result)).toContain("contract_invalid");
  });

  it("detects any change to transcript, provenance, administrator evidence, or the other Wave 1 records", () => {
    const evidence = {
      transcriptSha256: "1".repeat(64),
      sourceEvidenceSha256: "2".repeat(64),
      reviewEvidenceSha256: "3".repeat(64),
      genuineAdministratorAuditSha256: "4".repeat(64),
      otherWaveOneEvidenceSha256: "5".repeat(64),
      supersededBundleSha256: "6".repeat(64)
    };
    expect(canaryPreservedEvidenceMatches(evidence, { ...evidence })).toBe(true);
    expect(canaryPreservedEvidenceMatches(evidence, {
      ...evidence,
      genuineAdministratorAuditSha256: "7".repeat(64)
    })).toBe(false);
  });

  it("keeps the real canary title out of tracked implementation and fixture files", async () => {
    const privateTitle = Buffer.from("V2hhdCBJcyBHZW51aW5lIEZhaXRo", "base64").toString("utf8");
    const files = [
      "src/enrichment/sermon-enrichment-policy.ts",
      "src/enrichment/sermon-enrichment-contracts.ts",
      "src/enrichment/sermon-enrichment-canary.ts",
      "src/enrichment/sermon-enrichment-canary-cli.ts",
      "tests/sermon-enrichment.test.ts"
    ];
    const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
    expect(contents.every((content) => !content.includes(privateTitle))).toBe(true);
  });
});

describe("superseded and grounded source-reference policy", () => {
  it("recognises only the exact retired Wave 1 suffix", () => {
    expect(isSupersededWave1SourceReference(`private:${supersededWave1GenerationVersion}`)).toBe(true);
    expect(isSupersededWave1SourceReference("private:another-version")).toBe(false);
  });

  it("round-trips transcript-bound grounded references", () => {
    const reference = groundedSermonEnrichmentSourceReference("a".repeat(64), 4, "b".repeat(64));
    expect(parseGroundedSermonEnrichmentSourceReference(reference)).toEqual({
      transcriptSha256: "a".repeat(64),
      transcriptRowVersion: 4,
      resultSha256: "b".repeat(64)
    });
  });
});

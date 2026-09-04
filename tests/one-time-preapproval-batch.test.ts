import { describe, expect, it } from "vitest";
import { sermonEnrichmentRequestSchema } from "../src/enrichment/sermon-enrichment-contracts";
import {
  bindOneTimePreapprovalBatch,
  inspectOneTimePreapprovalValidationRetry,
  limitedReproducibilityWarning,
  nextOneTimePreapprovalBatchRecord,
  oneTimePreapprovalBatchExceptionId,
  oneTimePreapprovalBatchManifestSha256,
  oneTimePreapprovalBatchProcessingVersion,
  oneTimePreapprovalDraftArtifactSchema,
  oneTimePreapprovalDraftArtifactSha256,
  oneTimePreapprovalOutputSha256,
  recordOneTimePreapprovalBatchAttempt,
  validateOneTimePreapprovalDraftArtifact,
  validateOneTimePreapprovalDraftEnvelope,
  type OneTimePreapprovalBatchState
} from "../src/enrichment/one-time-preapproval-batch";
import {
  deterministicOneTimePreapprovalSermonId,
  oneTimePreapprovalGroundedSourceReference
} from "../src/enrichment/one-time-preapproval-batch-import";
import { parseGroundedSermonEnrichmentSourceReference } from "../src/enrichment/sermon-enrichment-policy";

const manifestWithoutIntegrity = {
  schemaVersion: 1 as const,
  privateContent: true as const,
  exceptionId: oneTimePreapprovalBatchExceptionId,
  processingVersion: oneTimePreapprovalBatchProcessingVersion,
  createdAt: "2026-09-03T00:00:00.000Z",
  records: Array.from({ length: 36 }, (_, index) => ({
    sequence: index + 1,
    sourceWordPressId: 10_000 + index,
    videoId: `${String(index).padStart(11, "A")}`.slice(-11),
    priorInspectionSha256: (index % 16).toString(16).repeat(64),
    selectedCaption: {
      captionId: `anonymised-caption-${index + 1}`,
      language: "en" as const,
      trackKind: index % 2 === 0 ? "standard" as const : "asr" as const
    },
    sourceSnapshot: {
      publicationStatus: index % 7 === 0 ? "pending" as const : "publish" as const,
      serviceDate: "2025-01-05",
      serviceDateAnomaly: "none",
      speakerTermIds: [100 + index],
      seriesTermIds: [],
      bibleBookTermIds: [],
      passageMetadataPresent: false,
      metadataAnomalyFlags: []
    }
  }))
};

function manifest() {
  return {
    ...manifestWithoutIntegrity,
    records: manifestWithoutIntegrity.records.map((record) => ({ ...record })),
    integrity: { canonicalSha256: oneTimePreapprovalBatchManifestSha256(manifestWithoutIntegrity) }
  };
}

const governanceCommitHash = "a".repeat(40);
const transcriptSha256 = "b".repeat(64);

function envelope() {
  const bound = bindOneTimePreapprovalBatch(manifest(), governanceCommitHash);
  const record = bound.orderedRecords[0]!;
  return {
    bound,
    value: {
      schemaVersion: 1 as const,
      privateContent: true as const,
      exceptionId: oneTimePreapprovalBatchExceptionId,
      batchManifestSha256: bound.manifestSha256,
      target: { sequence: record.sequence, sourceWordPressId: record.sourceWordPressId, videoId: record.videoId },
      transcript: {
        groundingRevisionId: "11111111-1111-4111-8111-111111111111",
        rowVersion: 1,
        sourceTranscriptSha256: transcriptSha256,
        sourceTranscriptApprovalStateAtGeneration: "unapproved" as const
      },
      requiresAdministratorReview: true as const,
      transcriptApprovalRequiredBeforeDependentApproval: true as const,
      approvalState: "draft" as const,
      publicVisibility: "private" as const,
      searchEligible: false as const,
      feedEligible: false as const,
      sitemapEligible: false as const,
      semanticEligible: false as const,
      productionBuildEligible: false as const,
      generator: {
        provider: "OpenAI" as const,
        executionSurface: "Codex" as const,
        executionMode: "interactive Codex session" as const,
        model: { value: null, unavailableReason: "not_exposed_by_runtime" as const },
        immutableRevision: { value: null, unavailableReason: "not_exposed_by_runtime" as const },
        sessionOrRunIdentifier: { value: null, unavailableReason: "not_exposed_by_runtime" as const },
        workspacePrivacyAndRetention: "not_exposed_to_runtime" as const,
        availableGenerationSettings: ["maximum_one_regeneration_retry"],
        generatedAt: "2026-09-03T00:01:00.000Z",
        governanceCommitHash,
        batchManifestSha256: bound.manifestSha256,
        promptOrProcessingVersionSha256: "c".repeat(64),
        sourceTranscriptSha256: transcriptSha256,
        outputSha256: "d".repeat(64),
        retryCount: 0,
        externalGenerativeApiCostAud: 0 as const
      },
      warnings: [limitedReproducibilityWarning]
    }
  };
}

function artifactFixture() {
  const { bound, value } = envelope();
  const support = {
    outputPart: "description_paragraph" as const,
    outputIndex: 1,
    paragraphNumber: 1,
    characterStart: 0,
    characterEnd: 11,
    wordStart: 1,
    wordEnd: 2,
    supportSha256: "1".repeat(64),
    purpose: "subject" as const
  };
  const content = {
    description: {
      bodyText: "An anonymised private draft remains deliberately unavailable to public visitors while a real administrator reviews it.",
      centralSubject: "An anonymised private review subject.",
      application: "An administrator must review the private material.",
      supports: [support]
    },
    questionAnswers: Array.from({ length: 7 }, (_, index) => ({
      displayOrder: index + 1,
      question: `Which anonymised review concern is represented by item ${index + 1}?`,
      answer: "The fixture represents a private draft that still requires a real administrator decision before any later use.",
      supports: [{ ...support, outputPart: "question_answer" as const, outputIndex: index + 1, purpose: "answer_support" as const }]
    }))
  };
  const withoutIntegrity = {
    ...value,
    generator: { ...value.generator, outputSha256: oneTimePreapprovalOutputSha256(content) },
    content
  };
  return {
    bound,
    value: oneTimePreapprovalDraftArtifactSchema.parse({
      ...withoutIntegrity,
      integrity: { canonicalSha256: oneTimePreapprovalDraftArtifactSha256(withoutIntegrity) }
    })
  };
}

function rehashArtifact(value: ReturnType<typeof artifactFixture>["value"]) {
  const withoutIntegrity = structuredClone(value);
  withoutIntegrity.generator.outputSha256 = oneTimePreapprovalOutputSha256(withoutIntegrity.content);
  withoutIntegrity.integrity.canonicalSha256 = oneTimePreapprovalDraftArtifactSha256(withoutIntegrity);
  return withoutIntegrity;
}

describe("D-151 one-time pre-approval batch exception", () => {
  it("binds only one exact, ordered, unique 36-record private manifest", () => {
    const bound = bindOneTimePreapprovalBatch(manifest(), governanceCommitHash);
    expect(bound.orderedRecords).toHaveLength(36);
    expect(nextOneTimePreapprovalBatchRecord(bound, { manifestSha256: bound.manifestSha256, attempts: [] }))
      .toEqual(bound.orderedRecords[0]);

    const wrongSize = manifest();
    wrongSize.records = wrongSize.records.slice(0, 35);
    wrongSize.integrity.canonicalSha256 = oneTimePreapprovalBatchManifestSha256(wrongSize);
    expect(() => bindOneTimePreapprovalBatch(wrongSize, governanceCommitHash)).toThrow();

    const duplicate = manifest();
    duplicate.records[35] = { ...duplicate.records[35]!, videoId: duplicate.records[0]!.videoId };
    duplicate.integrity.canonicalSha256 = oneTimePreapprovalBatchManifestSha256(duplicate);
    expect(() => bindOneTimePreapprovalBatch(duplicate, governanceCommitHash))
      .toThrow("one_time_batch_manifest_identity_not_unique");
  });

  it("keeps the normal approved-transcript contract closed to unapproved transcripts", () => {
    const normalRequest = {
      schemaVersion: 1,
      privateContent: true,
      skillName: "sermon-enrichment",
      skillVersion: "1.4.0",
      requestedAt: "2026-09-03T00:00:00.000Z",
      target: { sourceWordPressId: 1, sermonId: "11111111-1111-4111-8111-111111111111" },
      transcript: {
        sermonId: "11111111-1111-4111-8111-111111111111",
        rowVersion: 1,
        status: "unapproved",
        approvedAt: null,
        sha256: transcriptSha256,
        characterCount: 100,
        wordCount: 20,
        bodyText: "An anonymised transcript body used only to prove policy separation."
      },
      original: {
        bundleRelativePath: "private/phase-3b2c-wave1/anonymised.private.json",
        bundleSha256: "1".repeat(64),
        descriptionSha256: "2".repeat(64),
        questionAnswerSetSha256: "3".repeat(64)
      },
      requirements: {
        descriptionWordMinimum: 180,
        descriptionWordMaximum: 220,
        questionAnswerMinimum: 5,
        questionAnswerMaximum: 10,
        questionAnswerTarget: 7,
        privateDraftOnly: true,
        administratorApprovalRequired: true
      },
      integrity: { canonicalSha256: "4".repeat(64) }
    };
    expect(sermonEnrichmentRequestSchema.safeParse(normalRequest).success).toBe(false);
  });

  it("forces exception output to remain private, unapproved, review-required, and manifest-bound", () => {
    const { bound, value } = envelope();
    expect(validateOneTimePreapprovalDraftEnvelope(value, bound, transcriptSha256))
      .toEqual({ valid: true, stale: false, issues: [] });
    expect(validateOneTimePreapprovalDraftEnvelope({ ...value, approvalState: "approved" }, bound, transcriptSha256).valid)
      .toBe(false);
    expect(validateOneTimePreapprovalDraftEnvelope({ ...value, publicVisibility: "public" }, bound, transcriptSha256).valid)
      .toBe(false);

    const anotherManifest = { ...manifest(), createdAt: "2026-09-03T01:00:00.000Z" };
    anotherManifest.integrity.canonicalSha256 = oneTimePreapprovalBatchManifestSha256(anotherManifest);
    const anotherBinding = bindOneTimePreapprovalBatch(anotherManifest, governanceCommitHash);
    expect(validateOneTimePreapprovalDraftEnvelope(value, anotherBinding, transcriptSha256).issues)
      .toContain("one_time_batch_manifest_scope_mismatch");
  });

  it("marks dependent drafts stale when transcript bytes change", () => {
    const { bound, value } = envelope();
    const result = validateOneTimePreapprovalDraftEnvelope(value, bound, "e".repeat(64));
    expect(result.stale).toBe(true);
    expect(result.issues).toContain("one_time_batch_dependent_draft_stale");
  });

  it("counts failed attempts, enforces fixed order, and expires after all 36 attempts", () => {
    const bound = bindOneTimePreapprovalBatch(manifest(), governanceCommitHash);
    let state: OneTimePreapprovalBatchState = { manifestSha256: bound.manifestSha256, attempts: [] };
    expect(() => recordOneTimePreapprovalBatchAttempt(bound, state, bound.orderedRecords[1]!.sourceWordPressId, "failed"))
      .toThrow("one_time_batch_record_out_of_order_or_out_of_scope");
    for (const [index, record] of bound.orderedRecords.entries()) {
      state = recordOneTimePreapprovalBatchAttempt(bound, state, record.sourceWordPressId, index === 0 ? "failed" : "completed");
    }
    expect(nextOneTimePreapprovalBatchRecord(bound, state)).toBeNull();
    expect(() => recordOneTimePreapprovalBatchAttempt(bound, state, bound.orderedRecords[0]!.sourceWordPressId, "completed"))
      .toThrow("one_time_batch_exception_expired");
  });

  it("binds private draft provenance to a deterministic sermon and immutable transcript identity", () => {
    const { value } = artifactFixture();
    const sermonId = deterministicOneTimePreapprovalSermonId(value.target.videoId);
    expect(deterministicOneTimePreapprovalSermonId(value.target.videoId)).toBe(sermonId);
    const reference = oneTimePreapprovalGroundedSourceReference(value);
    expect(parseGroundedSermonEnrichmentSourceReference(reference)).toEqual({
      version: 2,
      transcriptGroundingRevisionId: value.transcript.groundingRevisionId,
      transcriptSha256: value.transcript.sourceTranscriptSha256,
      resultSha256: value.generator.outputSha256
    });
  });

  it("rejects public or approved artifact shapes and detects stale or altered hashes", () => {
    const { bound, value } = artifactFixture();
    expect(oneTimePreapprovalDraftArtifactSchema.safeParse({ ...value, publicVisibility: "public" }).success).toBe(false);
    expect(oneTimePreapprovalDraftArtifactSchema.safeParse({ ...value, approvalState: "approved" }).success).toBe(false);
    const changedOutput = structuredClone(value);
    changedOutput.generator.outputSha256 = "e".repeat(64);
    const outputResult = validateOneTimePreapprovalDraftArtifact(
      changedOutput,
      bound,
      { bodyText: "Anonymised transcript evidence.", sha256: transcriptSha256 }
    );
    expect(outputResult.issues).toContain("one_time_batch_output_hash_mismatch");
    const stale = validateOneTimePreapprovalDraftArtifact(
      value,
      bound,
      { bodyText: "Changed anonymised transcript evidence.", sha256: "f".repeat(64) }
    );
    expect(stale.stale).toBe(true);
    expect(stale.issues).toContain("one_time_batch_dependent_draft_stale");
  });

  it("permits only the seven authorised generic-opening corrections while preserving answers", () => {
    const cases: Array<[number, number[]]> = [[3, [1]], [16, [6]], [19, [3]], [21, [2]], [24, [3, 6]], [26, [6]]];
    for (const [sequence, orders] of cases) {
      const previous = structuredClone(artifactFixture().value);
      previous.target.sequence = sequence;
      for (const order of orders) {
        previous.content.questionAnswers[order - 1]!.question = `How does the sermon explain anonymised concern ${order}?`;
      }
      const previousHashed = rehashArtifact(previous);
      const current = structuredClone(previousHashed);
      for (const order of orders) {
        current.content.questionAnswers[order - 1]!.question = `Why does anonymised concern ${order} matter to the listener?`;
      }
      current.generator.retryCount = 1;
      current.generator.generatedAt = "2026-09-03T00:02:00.000Z";
      const currentHashed = rehashArtifact(current);
      expect(inspectOneTimePreapprovalValidationRetry(previousHashed, currentHashed)).toEqual({
        valid: true,
        issues: [],
        changedQuestionOrders: orders
      });
    }

    const previous = structuredClone(artifactFixture().value);
    previous.target.sequence = 3;
    previous.content.questionAnswers[0]!.question = "How does the sermon explain this anonymised concern?";
    const previousHashed = rehashArtifact(previous);
    const current = structuredClone(previousHashed);
    current.content.questionAnswers[0]!.question = "Why does this anonymised concern matter to the listener?";
    current.generator.retryCount = 1;
    current.generator.generatedAt = "2026-09-03T00:02:00.000Z";
    const changedAnswer = structuredClone(rehashArtifact(current));
    changedAnswer.content.questionAnswers[0]!.answer = "A changed answer must never pass this tightly bounded retry.";
    const changedAnswerHashed = rehashArtifact(changedAnswer);
    expect(inspectOneTimePreapprovalValidationRetry(previousHashed, changedAnswerHashed).issues)
      .toContain("one_time_batch_validation_retry_answer_changed");
  });

  it("refuses another sequence, question order, or prose change during the validation retry", () => {
    const previous = structuredClone(artifactFixture().value);
    previous.target.sequence = 16;
    previous.content.questionAnswers[5 - 1]!.question = "How does the sermon explain a fifth anonymised concern?";
    previous.content.questionAnswers[5 - 1]!.displayOrder = 5;
    const previousHashed = rehashArtifact(previous);
    const wrongOrder = structuredClone(previousHashed);
    wrongOrder.content.questionAnswers[5 - 1]!.question = "Why does a fifth anonymised concern matter?";
    wrongOrder.generator.retryCount = 1;
    wrongOrder.generator.generatedAt = "2026-09-03T00:02:00.000Z";
    const wrongOrderHashed = rehashArtifact(wrongOrder);
    expect(inspectOneTimePreapprovalValidationRetry(previousHashed, wrongOrderHashed).issues)
      .toContain("one_time_batch_validation_retry_question_scope_mismatch");

    const proseChange = structuredClone(wrongOrderHashed);
    proseChange.content.description.bodyText += " This prose change is outside the authorisation.";
    const proseChangeHashed = rehashArtifact(proseChange);
    expect(inspectOneTimePreapprovalValidationRetry(previousHashed, proseChangeHashed).issues)
      .toContain("one_time_batch_validation_retry_description_prose_changed");
  });
});

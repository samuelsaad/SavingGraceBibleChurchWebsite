import { describe, expect, it } from "vitest";
import { seventhBatchFixture, fixtureHash } from "./fixtures/seventh-batch";
import {
  validateSeventhFixedBatchDraftArtifact,
  bindSeventhFixedBatchManifest,
} from "../src/enrichment/seventh-fixed-batch";
import { sermonEnrichmentRequestSchema } from "../src/enrichment/sermon-enrichment-contracts";
import type { CaptionTrackMetadata } from "../src/youtube/pilot-caption-proof";
import {
  createSeventhFixedBatchState,
  limitedReproducibilityWarning,
  nextSeventhFixedBatchRecord,
  recordSeventhFixedBatchAttempt,
  selectCaptionTrackForSeventhFixedBatch,
  seventhFixedBatchAudioWarning,
  seventhFixedBatchDecisionId,
  seventhFixedBatchDraftArtifactSchema,
  seventhFixedBatchManifestSha256,
  type SeventhFixedBatchAuthorization,
  type SeventhFixedBatchRecord,
} from "../src/enrichment/seventh-fixed-batch";
import {
  deterministicSeventhFixedBatchSermonId,
  seventhFixedBatchImportActor,
  seventhFixedBatchImportProfile,
} from "../src/enrichment/seventh-fixed-batch-import";
import { deterministicThirdFixedBatchSermonId } from "../src/enrichment/one-time-preapproval-batch-import";

const records: SeventhFixedBatchRecord[] = Array.from(
  { length: 36 },
  (_, index) => ({
    sequence: index + 1,
    sourceWordPressId: 30_000 + index,
    videoId: `${String(index).padStart(11, "B")}`.slice(-11),
    publicationStatus: index % 9 === 0 ? "pending" : "publish",
    serviceDate: "2022-04-24",
    inventoryRowSha256: (index % 16).toString(16).repeat(64),
    mappingRecordSha256: ((index + 1) % 16).toString(16).repeat(64),
    channelOwnershipCorroboratedByExistingEvidence: true,
  }),
);

const authorization: SeventhFixedBatchAuthorization = {
  decisionId: seventhFixedBatchDecisionId,
  manifestSha256: seventhFixedBatchManifestSha256,
  governanceCommitHash: "b".repeat(40),
  orderedRecords: records,
};

function track(
  overrides: Partial<CaptionTrackMetadata> = {},
): CaptionTrackMetadata {
  return {
    id: "caption-1",
    videoId: records[0]!.videoId,
    language: "en-AU",
    trackKind: "standard",
    audioTrackType: "primary",
    status: "serving",
    isDraft: false,
    lastUpdated: "2026-09-05T00:00:00.000Z",
    ...overrides,
  };
}

function envelope(audioTrackType: "primary" | "unknown" = "unknown") {
  const unknown = audioTrackType === "unknown";
  return {
    schemaVersion: 1,
    privateContent: true,
    exceptionId: seventhFixedBatchDecisionId,
    decisionId: seventhFixedBatchDecisionId,
    batchManifestSha256: seventhFixedBatchManifestSha256,
    target: {
      sequence: 1,
      sourceWordPressId: records[0]!.sourceWordPressId,
      videoId: records[0]!.videoId,
    },
    transcript: {
      groundingRevisionId: "11111111-1111-4111-8111-111111111111",
      rowVersion: 1,
      sourceTranscriptSha256: "b".repeat(64),
      sourceTranscriptApprovalStateAtGeneration: "unapproved",
    },
    requiresAdministratorReview: true,
    transcriptApprovalRequiredBeforeDependentApproval: true,
    approvalState: "draft",
    publicVisibility: "private",
    searchEligible: false,
    feedEligible: false,
    sitemapEligible: false,
    semanticEligible: false,
    productionBuildEligible: false,
    captionAudioAssociation: {
      decision: seventhFixedBatchDecisionId,
      manifestSha256: seventhFixedBatchManifestSha256,
      audioTrackType,
      primaryAudioConfirmed: !unknown,
      acceptedUnderBoundedException: unknown,
      warning: unknown ? seventhFixedBatchAudioWarning : null,
    },
    generator: {
      provider: "OpenAI",
      executionSurface: "Codex",
      executionMode: "interactive Codex session",
      selectedModelLabel: "gpt-5.6-sol",
      selectionAuthorityReference: "SAMUEL-CODEX-D162-SOL-SELECTION-2026-09-19",
      model: { value: null, unavailableReason: "not_exposed_by_runtime" },
      validationSelectedModelLabel: "gpt-5.6-sol",
      validationRuntimeModel: {
        value: null,
        unavailableReason: "not_exposed_by_runtime",
      },
      separatelyBilledApiUsed: false,
      tokenCount: "not_exposed_by_runtime",
      candidateSha256: "a".repeat(64),
      correction: null,
      immutableRevision: {
        value: null,
        unavailableReason: "not_exposed_by_runtime",
      },
      sessionOrRunIdentifier: {
        value: null,
        unavailableReason: "not_exposed_by_runtime",
      },
      workspacePrivacyAndRetention: "not_exposed_by_runtime",
      availableGenerationSettings: ["maximum_one_regeneration_retry"],
      generatedAt: "2026-09-05T00:00:00.000Z",
      governanceCommitHash: authorization.governanceCommitHash,
      batchManifestSha256: seventhFixedBatchManifestSha256,
      promptOrProcessingVersionSha256: "c".repeat(64),
      sourceTranscriptSha256: "b".repeat(64),
      outputSha256: "d".repeat(64),
      retryCount: 0,
      externalGenerativeApiCostAud: 0,
    },
    warnings: unknown
      ? [limitedReproducibilityWarning, seventhFixedBatchAudioWarning]
      : [limitedReproducibilityWarning],
    content: {
      description: {
        bodyText:
          "This anonymised private fixture remains subject to later administrator review.",
        centralSubject: "An anonymised private subject.",
        application: "Administrator review remains required.",
        supports: [
          {
            outputPart: "description_paragraph",
            outputIndex: 1,
            paragraphNumber: 1,
            characterStart: 0,
            characterEnd: 10,
            wordStart: 1,
            wordEnd: 2,
            supportSha256: "e".repeat(64),
            purpose: "subject",
          },
        ],
      },
      questionAnswers: Array.from({ length: 7 }, (_, index) => ({
        displayOrder: index + 1,
        question: `Why does anonymised concern ${index + 1} require careful review?`,
        answer:
          "The fixture remains a private draft and requires a real administrator decision before any later use.",
        supports: [
          {
            outputPart: "question_answer",
            outputIndex: index + 1,
            paragraphNumber: 1,
            characterStart: 0,
            characterEnd: 10,
            wordStart: 1,
            wordEnd: 2,
            supportSha256: "e".repeat(64),
            purpose: "answer_support",
          },
        ],
      })),
    },
    integrity: { canonicalSha256: "f".repeat(64) },
  };
}

describe("D-162 seventh fixed private batch", () => {
  it("validates invented grounded content and rejects changed transcript bytes or an unbound manifest", () => {
    const f = seventhBatchFixture();
    const result = validateSeventhFixedBatchDraftArtifact(
      f.artifact,
      f.authorization,
      { bodyText: f.transcript, sha256: fixtureHash(f.transcript) },
    );
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    const changed = f.transcript + " Changed.";
    expect(
      validateSeventhFixedBatchDraftArtifact(f.artifact, f.authorization, {
        bodyText: changed,
        sha256: fixtureHash(changed),
      }).stale,
    ).toBe(true);
    expect(() =>
      bindSeventhFixedBatchManifest(
        {
          records: f.authorization.orderedRecords,
          integrity: { canonicalSha256: seventhFixedBatchManifestSha256 },
        },
        "a".repeat(40),
      ),
    ).toThrow();
    expect(
      sermonEnrichmentRequestSchema.shape.transcript.safeParse({
        status: "unapproved",
      }).success,
    ).toBe(false);
  });
  it("uses a distinct deterministic identity namespace and private import profile", () => {
    const videoId = records[0]!.videoId;
    expect(deterministicSeventhFixedBatchSermonId(videoId)).not.toBe(
      deterministicThirdFixedBatchSermonId(videoId),
    );
    expect(deterministicSeventhFixedBatchSermonId(videoId)).toBe(
      deterministicSeventhFixedBatchSermonId(videoId),
    );
    expect(seventhFixedBatchImportProfile).toMatchObject({
      exceptionId: seventhFixedBatchDecisionId,
      actor: seventhFixedBatchImportActor,
      processingVersion: "phase3b2c-evaluation-36-d162-v1",
      sourceStatus: "phase3b2c_evaluation_36_batch_7_private",
      migrationReasonCode: "authorised_d162_private_batch",
      audioWarningCode: seventhFixedBatchAudioWarning,
      sourceRecordKeyPrefix: "authorised-record",
    });
  });

  it("consumes exactly 36 ordered positions and expires without substitution", () => {
    let state = createSeventhFixedBatchState();
    expect(nextSeventhFixedBatchRecord(authorization, state)).toEqual(
      records[0],
    );
    expect(() =>
      recordSeventhFixedBatchAttempt(authorization, state, {
        sequence: 2,
        sourceWordPressId: records[1]!.sourceWordPressId,
        videoId: records[1]!.videoId,
        outcome: "failed",
        failureCode: "synthetic_failure",
      }),
    ).toThrow("d162_attempt_out_of_order_or_scope");
    for (const record of records) {
      state = recordSeventhFixedBatchAttempt(authorization, state, {
        sequence: record.sequence,
        sourceWordPressId: record.sourceWordPressId,
        videoId: record.videoId,
        outcome: record.sequence === 4 ? "failed" : "completed",
        failureCode: record.sequence === 4 ? "synthetic_failure" : null,
      });
    }
    expect(nextSeventhFixedBatchRecord(authorization, state)).toBeNull();
    expect(() =>
      recordSeventhFixedBatchAttempt(authorization, state, {
        sequence: 1,
        sourceWordPressId: records[0]!.sourceWordPressId,
        videoId: records[0]!.videoId,
        outcome: "completed",
        failureCode: null,
      }),
    ).toThrow("d162_exception_expired");
  });

  it("uses the approved four-level caption priority and truthful unknown-audio provenance", () => {
    const videoId = records[0]!.videoId;
    const selected = selectCaptionTrackForSeventhFixedBatch(
      authorization,
      videoId,
      [
        track({
          id: "asr-unknown",
          trackKind: "asr",
          audioTrackType: "unknown",
        }),
        track({ id: "standard-unknown", audioTrackType: "unknown" }),
        track({
          id: "asr-primary",
          trackKind: "asr",
          audioTrackType: "primary",
        }),
        track({ id: "standard-primary", audioTrackType: "primary" }),
      ],
    );
    expect(selected.outcome).toBe("selected");
    if (selected.outcome === "selected")
      expect(selected.track.id).toBe("standard-primary");
    const fallback = selectCaptionTrackForSeventhFixedBatch(
      authorization,
      videoId,
      [
        track({
          id: "asr-unknown",
          trackKind: "asr",
          audioTrackType: "unknown",
        }),
      ],
    );
    expect(fallback).toMatchObject({
      outcome: "selected",
      provenance: {
        audioTrackType: "unknown",
        primaryAudioConfirmed: false,
        acceptedUnderBoundedException: true,
        warning: seventhFixedBatchAudioWarning,
      },
    });
  });

  it("fails ambiguity and rejects wrong-language, draft, failed, forced, descriptive and commentary tracks", () => {
    const videoId = records[0]!.videoId;
    expect(
      selectCaptionTrackForSeventhFixedBatch(authorization, videoId, [
        track({ id: "first" }),
        track({ id: "second" }),
      ]),
    ).toMatchObject({
      outcome: "ambiguous_track",
      priority: "standard_primary",
    });
    expect(
      selectCaptionTrackForSeventhFixedBatch(authorization, videoId, [
        track({ id: "wrong-language", language: "fr" }),
        track({ id: "malformed-language", language: "en-@invalid" }),
        track({ id: "draft", isDraft: true }),
        track({ id: "failed", status: "failed" }),
        track({ id: "forced", trackKind: "forced" }),
        track({ id: "descriptive", audioTrackType: "descriptive" }),
        track({ id: "commentary", audioTrackType: "commentary" }),
      ]),
    ).toEqual({ outcome: "no_eligible_track", eligibleTrackCount: 0 });
  });

  it("forces D-162 artifacts to remain private and unapproved", () => {
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse(envelope()).success,
    ).toBe(true);
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse({
        ...envelope(),
        publicVisibility: "public",
      }).success,
    ).toBe(false);
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse({
        ...envelope(),
        approvalState: "approved",
      }).success,
    ).toBe(false);
    const missingWarning = envelope();
    missingWarning.warnings = [limitedReproducibilityWarning];
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse(missingWarning).success,
    ).toBe(false);
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse(envelope("primary"))
        .success,
    ).toBe(true);
  });

  it("keeps Samuel's Sol selection separate from unavailable runtime metadata", () => {
    const candidate = envelope();
    const parsed = seventhFixedBatchDraftArtifactSchema.parse(candidate);
    expect(parsed.generator.selectedModelLabel).toBe("gpt-5.6-sol");
    expect(parsed.generator.model).toEqual({
      value: null,
      unavailableReason: "not_exposed_by_runtime",
    });
    expect(parsed.generator.validationRuntimeModel).toEqual({
      value: null,
      unavailableReason: "not_exposed_by_runtime",
    });
    expect(parsed.generator.immutableRevision.value).toBeNull();
    for (const model of ["gpt-5.6-sol", "gpt-6-astra", "other"]) {
      expect(
        seventhFixedBatchDraftArtifactSchema.safeParse({
          ...candidate,
          generator: {
            ...candidate.generator,
            model: { value: model, unavailableReason: null },
          },
        }).success,
      ).toBe(false);
    }
    for (const change of [
      { selectedModelLabel: "gpt-6-astra" },
      { validationSelectedModelLabel: "gpt-6-astra" },
      { separatelyBilledApiUsed: true },
      { externalGenerativeApiCostAud: 1 },
      { workspacePrivacyAndRetention: "guaranteed_private" },
    ])
      expect(
        seventhFixedBatchDraftArtifactSchema.safeParse({
          ...candidate,
          generator: { ...candidate.generator, ...change },
        }).success,
      ).toBe(false);
  });

  it("requires preserved one-correction lineage and cannot reset or expand the allowance", () => {
    const candidate = envelope();
    const correction = {
      previousCandidateSha256: "e".repeat(64),
      correctedBySelectedModelLabel: "gpt-5.6-sol",
      correctionRuntimeModel: {
        value: null,
        unavailableReason: "not_exposed_by_runtime",
      },
      correctionNumber: 1,
      correctedAt: "2026-09-05T01:00:00.000Z",
      previousValidationIssueCodes: [
        "one_time_batch_fixed_or_generic_question",
      ],
      kind: "question_opening",
    };
    const corrected = {
      ...candidate,
      generator: { ...candidate.generator, retryCount: 1, correction },
    };
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse(corrected).success,
    ).toBe(true);
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse({
        ...corrected,
        generator: { ...corrected.generator, correction: null },
      }).success,
    ).toBe(false);
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse({
        ...corrected,
        generator: { ...corrected.generator, retryCount: 0 },
      }).success,
    ).toBe(false);
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse({
        ...corrected,
        generator: { ...corrected.generator, retryCount: 2 },
      }).success,
    ).toBe(false);
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse({
        ...corrected,
        generator: {
          ...corrected.generator,
          correction: { ...correction, correctedBySelectedModelLabel: "other" },
        },
      }).success,
    ).toBe(false);
    expect(
      seventhFixedBatchDraftArtifactSchema.safeParse({
        ...candidate,
        batchManifestSha256: "a".repeat(64),
      }).success,
    ).toBe(false);
  });

  it("refuses out-of-scope and cross-video caption resources", () => {
    expect(() =>
      selectCaptionTrackForSeventhFixedBatch(authorization, "ZZZZZZZZZZZ", []),
    ).toThrow("d162_video_out_of_scope");
    expect(() =>
      selectCaptionTrackForSeventhFixedBatch(
        authorization,
        records[0]!.videoId,
        [track({ videoId: records[1]!.videoId })],
      ),
    ).toThrow("d162_cross_video_caption_resource");
  });
});

import { describe, expect, it } from "vitest";
import type { CaptionTrackMetadata } from "../src/youtube/pilot-caption-proof";
import {
  createFourthFixedBatchState,
  limitedReproducibilityWarning,
  nextFourthFixedBatchRecord,
  recordFourthFixedBatchAttempt,
  selectCaptionTrackForFourthFixedBatch,
  fourthFixedBatchAudioWarning,
  fourthFixedBatchDecisionId,
  fourthFixedBatchDraftArtifactSchema,
  fourthFixedBatchManifestSha256,
  type FourthFixedBatchAuthorization,
  type FourthFixedBatchRecord
} from "../src/enrichment/fourth-fixed-batch";
import {
  deterministicFourthFixedBatchSermonId,
  fourthFixedBatchImportActor,
  fourthFixedBatchImportProfile
} from "../src/enrichment/fourth-fixed-batch-import";
import { deterministicThirdFixedBatchSermonId } from "../src/enrichment/one-time-preapproval-batch-import";

const records: FourthFixedBatchRecord[] = Array.from({ length: 36 }, (_, index) => ({
  sequence: index + 1,
  sourceWordPressId: 30_000 + index,
  videoId: `${String(index).padStart(11, "B")}`.slice(-11),
  publicationStatus: index % 9 === 0 ? "pending" : "publish",
  serviceDate: "2022-04-24",
  inventoryRowSha256: (index % 16).toString(16).repeat(64),
  mappingRecordSha256: ((index + 1) % 16).toString(16).repeat(64),
  channelOwnershipCorroboratedByExistingEvidence: true
}));

const authorization: FourthFixedBatchAuthorization = {
  decisionId: fourthFixedBatchDecisionId,
  manifestSha256: fourthFixedBatchManifestSha256,
  governanceCommitHash: "b".repeat(40),
  orderedRecords: records
};

function track(overrides: Partial<CaptionTrackMetadata> = {}): CaptionTrackMetadata {
  return {
    id: "caption-1",
    videoId: records[0]!.videoId,
    language: "en-AU",
    trackKind: "standard",
    audioTrackType: "primary",
    status: "serving",
    isDraft: false,
    lastUpdated: "2026-09-05T00:00:00.000Z",
    ...overrides
  };
}

function envelope(audioTrackType: "primary" | "unknown" = "unknown") {
  const unknown = audioTrackType === "unknown";
  return {
    schemaVersion: 1,
    privateContent: true,
    exceptionId: fourthFixedBatchDecisionId,
    decisionId: fourthFixedBatchDecisionId,
    batchManifestSha256: fourthFixedBatchManifestSha256,
    target: { sequence: 1, sourceWordPressId: records[0]!.sourceWordPressId, videoId: records[0]!.videoId },
    transcript: {
      groundingRevisionId: "11111111-1111-4111-8111-111111111111",
      rowVersion: 1,
      sourceTranscriptSha256: "b".repeat(64),
      sourceTranscriptApprovalStateAtGeneration: "unapproved"
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
      decision: fourthFixedBatchDecisionId,
      manifestSha256: fourthFixedBatchManifestSha256,
      audioTrackType,
      primaryAudioConfirmed: !unknown,
      acceptedUnderBoundedException: unknown,
      warning: unknown ? fourthFixedBatchAudioWarning : null
    },
    generator: {
      provider: "OpenAI",
      executionSurface: "Codex",
      executionMode: "interactive Codex session",
      model: { value: "gpt-6-astra", unavailableReason: null },
      validationModel: "gpt-6-astra",
      separatelyBilledApiUsed: false,
      tokenCount: "not_exposed_by_runtime",
      candidateSha256: "a".repeat(64),
      correction: null,
      immutableRevision: { value: null, unavailableReason: "not_exposed_by_runtime" },
      sessionOrRunIdentifier: { value: null, unavailableReason: "not_exposed_by_runtime" },
      workspacePrivacyAndRetention: "not_exposed_by_runtime",
      availableGenerationSettings: ["maximum_one_regeneration_retry"],
      generatedAt: "2026-09-05T00:00:00.000Z",
      governanceCommitHash: authorization.governanceCommitHash,
      batchManifestSha256: fourthFixedBatchManifestSha256,
      promptOrProcessingVersionSha256: "c".repeat(64),
      sourceTranscriptSha256: "b".repeat(64),
      outputSha256: "d".repeat(64),
      retryCount: 0,
      externalGenerativeApiCostAud: 0
    },
    warnings: unknown
      ? [limitedReproducibilityWarning, fourthFixedBatchAudioWarning]
      : [limitedReproducibilityWarning],
    content: {
      description: {
        bodyText: "This anonymised private fixture remains subject to later administrator review.",
        centralSubject: "An anonymised private subject.",
        application: "Administrator review remains required.",
        supports: [{
          outputPart: "description_paragraph",
          outputIndex: 1,
          paragraphNumber: 1,
          characterStart: 0,
          characterEnd: 10,
          wordStart: 1,
          wordEnd: 2,
          supportSha256: "e".repeat(64),
          purpose: "subject"
        }]
      },
      questionAnswers: Array.from({ length: 7 }, (_, index) => ({
        displayOrder: index + 1,
        question: `Why does anonymised concern ${index + 1} require careful review?`,
        answer: "The fixture remains a private draft and requires a real administrator decision before any later use.",
        supports: [{
          outputPart: "question_answer",
          outputIndex: index + 1,
          paragraphNumber: 1,
          characterStart: 0,
          characterEnd: 10,
          wordStart: 1,
          wordEnd: 2,
          supportSha256: "e".repeat(64),
          purpose: "answer_support"
        }]
      }))
    },
    integrity: { canonicalSha256: "f".repeat(64) }
  };
}

describe("D-155 fourth fixed private batch", () => {
  it("uses a distinct deterministic identity namespace and private import profile", () => {
    const videoId = records[0]!.videoId;
    expect(deterministicFourthFixedBatchSermonId(videoId)).not.toBe(deterministicThirdFixedBatchSermonId(videoId));
    expect(deterministicFourthFixedBatchSermonId(videoId)).toBe(deterministicFourthFixedBatchSermonId(videoId));
    expect(fourthFixedBatchImportProfile).toMatchObject({
      exceptionId: fourthFixedBatchDecisionId,
      actor: fourthFixedBatchImportActor,
      processingVersion: "phase3b2c-evaluation-36-d155-v1",
      sourceStatus: "phase3b2c_evaluation_36_batch_4_private",
      migrationReasonCode: "authorised_d155_private_batch",
      audioWarningCode: fourthFixedBatchAudioWarning,
      sourceRecordKeyPrefix: "authorised-record"
    });
  });

  it("consumes exactly 36 ordered positions and expires without substitution", () => {
    let state = createFourthFixedBatchState();
    expect(nextFourthFixedBatchRecord(authorization, state)).toEqual(records[0]);
    expect(() => recordFourthFixedBatchAttempt(authorization, state, {
      sequence: 2,
      sourceWordPressId: records[1]!.sourceWordPressId,
      videoId: records[1]!.videoId,
      outcome: "failed",
      failureCode: "synthetic_failure"
    })).toThrow("d155_attempt_out_of_order_or_scope");
    for (const record of records) {
      state = recordFourthFixedBatchAttempt(authorization, state, {
        sequence: record.sequence,
        sourceWordPressId: record.sourceWordPressId,
        videoId: record.videoId,
        outcome: record.sequence === 4 ? "failed" : "completed",
        failureCode: record.sequence === 4 ? "synthetic_failure" : null
      });
    }
    expect(nextFourthFixedBatchRecord(authorization, state)).toBeNull();
    expect(() => recordFourthFixedBatchAttempt(authorization, state, {
      sequence: 1,
      sourceWordPressId: records[0]!.sourceWordPressId,
      videoId: records[0]!.videoId,
      outcome: "completed",
      failureCode: null
    })).toThrow("d155_exception_expired");
  });

  it("uses the approved four-level caption priority and truthful unknown-audio provenance", () => {
    const videoId = records[0]!.videoId;
    const selected = selectCaptionTrackForFourthFixedBatch(authorization, videoId, [
      track({ id: "asr-unknown", trackKind: "asr", audioTrackType: "unknown" }),
      track({ id: "standard-unknown", audioTrackType: "unknown" }),
      track({ id: "asr-primary", trackKind: "asr", audioTrackType: "primary" }),
      track({ id: "standard-primary", audioTrackType: "primary" })
    ]);
    expect(selected.outcome).toBe("selected");
    if (selected.outcome === "selected") expect(selected.track.id).toBe("standard-primary");
    const fallback = selectCaptionTrackForFourthFixedBatch(authorization, videoId, [
      track({ id: "asr-unknown", trackKind: "asr", audioTrackType: "unknown" })
    ]);
    expect(fallback).toMatchObject({
      outcome: "selected",
      provenance: {
        audioTrackType: "unknown",
        primaryAudioConfirmed: false,
        acceptedUnderBoundedException: true,
        warning: fourthFixedBatchAudioWarning
      }
    });
  });

  it("fails ambiguity and rejects wrong-language, draft, failed, forced, descriptive and commentary tracks", () => {
    const videoId = records[0]!.videoId;
    expect(selectCaptionTrackForFourthFixedBatch(authorization, videoId, [
      track({ id: "first" }), track({ id: "second" })
    ])).toMatchObject({ outcome: "ambiguous_track", priority: "standard_primary" });
    expect(selectCaptionTrackForFourthFixedBatch(authorization, videoId, [
      track({ id: "wrong-language", language: "fr" }),
      track({ id: "malformed-language", language: "en-@invalid" }),
      track({ id: "draft", isDraft: true }),
      track({ id: "failed", status: "failed" }),
      track({ id: "forced", trackKind: "forced" }),
      track({ id: "descriptive", audioTrackType: "descriptive" }),
      track({ id: "commentary", audioTrackType: "commentary" })
    ])).toEqual({ outcome: "no_eligible_track", eligibleTrackCount: 0 });
  });

  it("forces D-155 artifacts to remain private and unapproved", () => {
    expect(fourthFixedBatchDraftArtifactSchema.safeParse(envelope()).success).toBe(true);
    expect(fourthFixedBatchDraftArtifactSchema.safeParse({ ...envelope(), publicVisibility: "public" }).success).toBe(false);
    expect(fourthFixedBatchDraftArtifactSchema.safeParse({ ...envelope(), approvalState: "approved" }).success).toBe(false);
    const missingWarning = envelope();
    missingWarning.warnings = [limitedReproducibilityWarning];
    expect(fourthFixedBatchDraftArtifactSchema.safeParse(missingWarning).success).toBe(false);
    expect(fourthFixedBatchDraftArtifactSchema.safeParse(envelope("primary")).success).toBe(true);
  });

  it("requires Astra and honest unavailable fields with no external API billing", () => {
    const candidate = envelope();
    const parsed = fourthFixedBatchDraftArtifactSchema.parse(candidate);
    expect(parsed.generator.model.value).toBe("gpt-6-astra");
    expect(parsed.generator.immutableRevision.value).toBeNull();
    for (const model of ["gpt-5.6-sol", "other", null]) {
      expect(fourthFixedBatchDraftArtifactSchema.safeParse({ ...candidate,
        generator: { ...candidate.generator, model: { value: model, unavailableReason: null } }
      }).success).toBe(false);
    }
    for (const change of [
      { validationModel: "gpt-5.6-sol" }, { separatelyBilledApiUsed: true },
      { externalGenerativeApiCostAud: 1 }, { workspacePrivacyAndRetention: "guaranteed_private" }
    ]) expect(fourthFixedBatchDraftArtifactSchema.safeParse({
      ...candidate, generator: { ...candidate.generator, ...change }
    }).success).toBe(false);
  });

  it("requires preserved one-correction lineage and cannot reset or expand the allowance", () => {
    const candidate = envelope();
    const correction = {
      previousCandidateSha256: "e".repeat(64), correctedByModel: "gpt-6-astra",
      correctionNumber: 1, correctedAt: "2026-09-05T01:00:00.000Z",
      previousValidationIssueCodes: ["one_time_batch_fixed_or_generic_question"],
      kind: "question_opening"
    };
    const corrected = { ...candidate, generator: { ...candidate.generator, retryCount: 1, correction } };
    expect(fourthFixedBatchDraftArtifactSchema.safeParse(corrected).success).toBe(true);
    expect(fourthFixedBatchDraftArtifactSchema.safeParse({ ...corrected,
      generator: { ...corrected.generator, correction: null } }).success).toBe(false);
    expect(fourthFixedBatchDraftArtifactSchema.safeParse({ ...corrected,
      generator: { ...corrected.generator, retryCount: 0 } }).success).toBe(false);
    expect(fourthFixedBatchDraftArtifactSchema.safeParse({ ...corrected,
      generator: { ...corrected.generator, retryCount: 2 } }).success).toBe(false);
    expect(fourthFixedBatchDraftArtifactSchema.safeParse({ ...corrected,
      generator: { ...corrected.generator, correction: { ...correction, correctedByModel: "other" } }
    }).success).toBe(false);
    expect(fourthFixedBatchDraftArtifactSchema.safeParse({
      ...candidate, batchManifestSha256: "a".repeat(64)
    }).success).toBe(false);
  });

  it("refuses out-of-scope and cross-video caption resources", () => {
    expect(() => selectCaptionTrackForFourthFixedBatch(authorization, "ZZZZZZZZZZZ", [])).toThrow("d155_video_out_of_scope");
    expect(() => selectCaptionTrackForFourthFixedBatch(authorization, records[0]!.videoId, [
      track({ videoId: records[1]!.videoId })
    ])).toThrow("d155_cross_video_caption_resource");
  });
});

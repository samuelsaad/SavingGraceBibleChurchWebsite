import { describe, expect, it } from "vitest";
import type { CaptionTrackMetadata } from "../src/youtube/pilot-caption-proof";
import {
  createSecondFixedBatchState,
  limitedReproducibilityWarning,
  nextSecondFixedBatchRecord,
  recordSecondFixedBatchAttempt,
  secondFixedBatchAudioWarning,
  secondFixedBatchDecisionId,
  secondFixedBatchDraftArtifactSchema,
  secondFixedBatchManifestSha256,
  selectCaptionTrackForSecondFixedBatch,
  type SecondFixedBatchAuthorization,
  type SecondFixedBatchRecord
} from "../src/enrichment/second-fixed-batch";

const records: SecondFixedBatchRecord[] = Array.from({ length: 36 }, (_, index) => ({
  sequence: index + 1,
  sourceWordPressId: 20_000 + index,
  videoId: `${String(index).padStart(11, "A")}`.slice(-11),
  publicationStatus: index % 8 === 0 ? "pending" : "publish",
  serviceDate: "2023-01-22",
  inventoryRowSha256: (index % 16).toString(16).repeat(64),
  mappingRecordSha256: ((index + 1) % 16).toString(16).repeat(64),
  channelOwnershipCorroboratedByExistingEvidence: true
}));

const authorization: SecondFixedBatchAuthorization = {
  decisionId: secondFixedBatchDecisionId,
  manifestSha256: secondFixedBatchManifestSha256,
  governanceCommitHash: "a".repeat(40),
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
    lastUpdated: "2026-09-04T00:00:00.000Z",
    ...overrides
  };
}

function envelope(audioTrackType: "primary" | "unknown" = "unknown") {
  const unknown = audioTrackType === "unknown";
  return {
    schemaVersion: 1,
    privateContent: true,
    exceptionId: secondFixedBatchDecisionId,
    decisionId: secondFixedBatchDecisionId,
    batchManifestSha256: secondFixedBatchManifestSha256,
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
      decision: secondFixedBatchDecisionId,
      manifestSha256: secondFixedBatchManifestSha256,
      audioTrackType,
      primaryAudioConfirmed: !unknown,
      acceptedUnderBoundedException: unknown,
      warning: unknown ? secondFixedBatchAudioWarning : null
    },
    generator: {
      provider: "OpenAI",
      executionSurface: "Codex",
      executionMode: "interactive Codex session",
      model: { value: null, unavailableReason: "not_exposed_by_runtime" },
      immutableRevision: { value: null, unavailableReason: "not_exposed_by_runtime" },
      sessionOrRunIdentifier: { value: null, unavailableReason: "not_exposed_by_runtime" },
      workspacePrivacyAndRetention: "not_exposed_to_runtime",
      availableGenerationSettings: ["maximum_one_regeneration_retry"],
      generatedAt: "2026-09-04T00:00:00.000Z",
      governanceCommitHash: authorization.governanceCommitHash,
      batchManifestSha256: secondFixedBatchManifestSha256,
      promptOrProcessingVersionSha256: "c".repeat(64),
      sourceTranscriptSha256: "b".repeat(64),
      outputSha256: "d".repeat(64),
      retryCount: 0,
      externalGenerativeApiCostAud: 0
    },
    warnings: unknown
      ? [limitedReproducibilityWarning, secondFixedBatchAudioWarning]
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

describe("D-153 second fixed private batch", () => {
  it("uses the exact manifest hash and consumes all 36 positions without substitution", () => {
    let state = createSecondFixedBatchState();
    expect(nextSecondFixedBatchRecord(authorization, state)).toEqual(records[0]);
    expect(() => recordSecondFixedBatchAttempt(authorization, state, {
      sequence: 2,
      sourceWordPressId: records[1]!.sourceWordPressId,
      videoId: records[1]!.videoId,
      outcome: "failed",
      failureCode: "synthetic_failure"
    })).toThrow("d153_attempt_out_of_order_or_scope");
    for (const record of records) {
      state = recordSecondFixedBatchAttempt(authorization, state, {
        sequence: record.sequence,
        sourceWordPressId: record.sourceWordPressId,
        videoId: record.videoId,
        outcome: record.sequence === 4 ? "failed" : "completed",
        failureCode: record.sequence === 4 ? "synthetic_failure" : null
      });
    }
    expect(nextSecondFixedBatchRecord(authorization, state)).toBeNull();
    expect(() => recordSecondFixedBatchAttempt(authorization, state, {
      sequence: 1,
      sourceWordPressId: records[0]!.sourceWordPressId,
      videoId: records[0]!.videoId,
      outcome: "completed",
      failureCode: null
    })).toThrow("d153_exception_expired");
  });

  it("implements the four-level standard/ASR and primary/unknown priority", () => {
    const videoId = records[0]!.videoId;
    const selected = selectCaptionTrackForSecondFixedBatch(authorization, videoId, [
      track({ id: "asr-unknown", trackKind: "asr", audioTrackType: "unknown" }),
      track({ id: "standard-unknown", audioTrackType: "unknown" }),
      track({ id: "asr-primary", trackKind: "asr", audioTrackType: "primary" }),
      track({ id: "standard-primary", audioTrackType: "primary" })
    ]);
    expect(selected.outcome).toBe("selected");
    if (selected.outcome === "selected") {
      expect(selected.track.id).toBe("standard-primary");
      expect(selected.provenance).toMatchObject({ primaryAudioConfirmed: true, acceptedUnderBoundedException: false, warning: null });
    }

    const fallback = selectCaptionTrackForSecondFixedBatch(authorization, videoId, [
      track({ id: "asr-unknown", trackKind: "asr", audioTrackType: "unknown" })
    ]);
    expect(fallback.outcome).toBe("selected");
    if (fallback.outcome === "selected") {
      expect(fallback.provenance).toMatchObject({
        audioTrackType: "unknown",
        primaryAudioConfirmed: false,
        acceptedUnderBoundedException: true,
        warning: secondFixedBatchAudioWarning
      });
    }
  });

  it("fails an equal-priority ambiguity and rejects ineligible language, draft, failed, forced, descriptive and commentary tracks", () => {
    const videoId = records[0]!.videoId;
    expect(selectCaptionTrackForSecondFixedBatch(authorization, videoId, [
      track({ id: "first" }), track({ id: "second" })
    ])).toMatchObject({ outcome: "ambiguous_track", priority: "standard_primary" });
    expect(selectCaptionTrackForSecondFixedBatch(authorization, videoId, [
      track({ id: "wrong-language", language: "fr" }),
      track({ id: "draft", isDraft: true }),
      track({ id: "failed", status: "failed" }),
      track({ id: "forced", trackKind: "forced" }),
      track({ id: "descriptive", audioTrackType: "descriptive" }),
      track({ id: "commentary", audioTrackType: "commentary" })
    ])).toEqual({ outcome: "no_eligible_track", eligibleTrackCount: 0 });
  });

  it("forces D-153 artifacts to remain private and unapproved with truthful unknown-audio provenance", () => {
    expect(secondFixedBatchDraftArtifactSchema.safeParse(envelope()).success).toBe(true);
    expect(secondFixedBatchDraftArtifactSchema.safeParse({ ...envelope(), publicVisibility: "public" }).success).toBe(false);
    expect(secondFixedBatchDraftArtifactSchema.safeParse({ ...envelope(), approvalState: "approved" }).success).toBe(false);
    const missingWarning = envelope();
    missingWarning.warnings = [limitedReproducibilityWarning];
    expect(secondFixedBatchDraftArtifactSchema.safeParse(missingWarning).success).toBe(false);
    expect(secondFixedBatchDraftArtifactSchema.safeParse(envelope("primary")).success).toBe(true);
  });

  it("refuses another video or cross-video caption resource", () => {
    expect(() => selectCaptionTrackForSecondFixedBatch(authorization, "ZZZZZZZZZZZ", [])).toThrow("d153_video_out_of_scope");
    expect(() => selectCaptionTrackForSecondFixedBatch(authorization, records[0]!.videoId, [
      track({ videoId: records[1]!.videoId })
    ])).toThrow("d153_cross_video_caption_resource");
  });
});

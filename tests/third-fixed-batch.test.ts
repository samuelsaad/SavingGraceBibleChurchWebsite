import { describe, expect, it } from "vitest";
import type { CaptionTrackMetadata } from "../src/youtube/pilot-caption-proof";
import {
  createThirdFixedBatchState,
  limitedReproducibilityWarning,
  nextThirdFixedBatchRecord,
  recordThirdFixedBatchAttempt,
  selectCaptionTrackForThirdFixedBatch,
  thirdFixedBatchAudioWarning,
  thirdFixedBatchDecisionId,
  thirdFixedBatchDraftArtifactSchema,
  thirdFixedBatchManifestSha256,
  type ThirdFixedBatchAuthorization,
  type ThirdFixedBatchRecord
} from "../src/enrichment/third-fixed-batch";
import {
  deterministicSecondFixedBatchSermonId,
  deterministicThirdFixedBatchSermonId,
  thirdFixedBatchImportActor,
  thirdFixedBatchImportProfile
} from "../src/enrichment/one-time-preapproval-batch-import";

const records: ThirdFixedBatchRecord[] = Array.from({ length: 36 }, (_, index) => ({
  sequence: index + 1,
  sourceWordPressId: 30_000 + index,
  videoId: `${String(index).padStart(11, "B")}`.slice(-11),
  publicationStatus: index % 9 === 0 ? "pending" : "publish",
  serviceDate: "2022-04-24",
  inventoryRowSha256: (index % 16).toString(16).repeat(64),
  mappingRecordSha256: ((index + 1) % 16).toString(16).repeat(64),
  channelOwnershipCorroboratedByExistingEvidence: true
}));

const authorization: ThirdFixedBatchAuthorization = {
  decisionId: thirdFixedBatchDecisionId,
  manifestSha256: thirdFixedBatchManifestSha256,
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
    exceptionId: thirdFixedBatchDecisionId,
    decisionId: thirdFixedBatchDecisionId,
    batchManifestSha256: thirdFixedBatchManifestSha256,
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
      decision: thirdFixedBatchDecisionId,
      manifestSha256: thirdFixedBatchManifestSha256,
      audioTrackType,
      primaryAudioConfirmed: !unknown,
      acceptedUnderBoundedException: unknown,
      warning: unknown ? thirdFixedBatchAudioWarning : null
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
      generatedAt: "2026-09-05T00:00:00.000Z",
      governanceCommitHash: authorization.governanceCommitHash,
      batchManifestSha256: thirdFixedBatchManifestSha256,
      promptOrProcessingVersionSha256: "c".repeat(64),
      sourceTranscriptSha256: "b".repeat(64),
      outputSha256: "d".repeat(64),
      retryCount: 0,
      externalGenerativeApiCostAud: 0
    },
    warnings: unknown
      ? [limitedReproducibilityWarning, thirdFixedBatchAudioWarning]
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

describe("D-154 third fixed private batch", () => {
  it("uses a distinct deterministic identity namespace and private import profile", () => {
    const videoId = records[0]!.videoId;
    expect(deterministicThirdFixedBatchSermonId(videoId)).not.toBe(deterministicSecondFixedBatchSermonId(videoId));
    expect(deterministicThirdFixedBatchSermonId(videoId)).toBe(deterministicThirdFixedBatchSermonId(videoId));
    expect(thirdFixedBatchImportProfile).toMatchObject({
      exceptionId: thirdFixedBatchDecisionId,
      actor: thirdFixedBatchImportActor,
      processingVersion: "phase3b2c-evaluation-36-d154-v1",
      sourceStatus: "phase3b2c_evaluation_36_batch_3_private",
      migrationReasonCode: "authorised_d154_private_batch",
      audioWarningCode: thirdFixedBatchAudioWarning,
      sourceRecordKeyPrefix: "authorised-record"
    });
  });

  it("consumes exactly 36 ordered positions and expires without substitution", () => {
    let state = createThirdFixedBatchState();
    expect(nextThirdFixedBatchRecord(authorization, state)).toEqual(records[0]);
    expect(() => recordThirdFixedBatchAttempt(authorization, state, {
      sequence: 2,
      sourceWordPressId: records[1]!.sourceWordPressId,
      videoId: records[1]!.videoId,
      outcome: "failed",
      failureCode: "synthetic_failure"
    })).toThrow("d154_attempt_out_of_order_or_scope");
    for (const record of records) {
      state = recordThirdFixedBatchAttempt(authorization, state, {
        sequence: record.sequence,
        sourceWordPressId: record.sourceWordPressId,
        videoId: record.videoId,
        outcome: record.sequence === 4 ? "failed" : "completed",
        failureCode: record.sequence === 4 ? "synthetic_failure" : null
      });
    }
    expect(nextThirdFixedBatchRecord(authorization, state)).toBeNull();
    expect(() => recordThirdFixedBatchAttempt(authorization, state, {
      sequence: 1,
      sourceWordPressId: records[0]!.sourceWordPressId,
      videoId: records[0]!.videoId,
      outcome: "completed",
      failureCode: null
    })).toThrow("d154_exception_expired");
  });

  it("uses the approved four-level caption priority and truthful unknown-audio provenance", () => {
    const videoId = records[0]!.videoId;
    const selected = selectCaptionTrackForThirdFixedBatch(authorization, videoId, [
      track({ id: "asr-unknown", trackKind: "asr", audioTrackType: "unknown" }),
      track({ id: "standard-unknown", audioTrackType: "unknown" }),
      track({ id: "asr-primary", trackKind: "asr", audioTrackType: "primary" }),
      track({ id: "standard-primary", audioTrackType: "primary" })
    ]);
    expect(selected.outcome).toBe("selected");
    if (selected.outcome === "selected") expect(selected.track.id).toBe("standard-primary");
    const fallback = selectCaptionTrackForThirdFixedBatch(authorization, videoId, [
      track({ id: "asr-unknown", trackKind: "asr", audioTrackType: "unknown" })
    ]);
    expect(fallback).toMatchObject({
      outcome: "selected",
      provenance: {
        audioTrackType: "unknown",
        primaryAudioConfirmed: false,
        acceptedUnderBoundedException: true,
        warning: thirdFixedBatchAudioWarning
      }
    });
  });

  it("fails ambiguity and rejects wrong-language, draft, failed, forced, descriptive and commentary tracks", () => {
    const videoId = records[0]!.videoId;
    expect(selectCaptionTrackForThirdFixedBatch(authorization, videoId, [
      track({ id: "first" }), track({ id: "second" })
    ])).toMatchObject({ outcome: "ambiguous_track", priority: "standard_primary" });
    expect(selectCaptionTrackForThirdFixedBatch(authorization, videoId, [
      track({ id: "wrong-language", language: "fr" }),
      track({ id: "draft", isDraft: true }),
      track({ id: "failed", status: "failed" }),
      track({ id: "forced", trackKind: "forced" }),
      track({ id: "descriptive", audioTrackType: "descriptive" }),
      track({ id: "commentary", audioTrackType: "commentary" })
    ])).toEqual({ outcome: "no_eligible_track", eligibleTrackCount: 0 });
  });

  it("forces D-154 artifacts to remain private and unapproved", () => {
    expect(thirdFixedBatchDraftArtifactSchema.safeParse(envelope()).success).toBe(true);
    expect(thirdFixedBatchDraftArtifactSchema.safeParse({ ...envelope(), publicVisibility: "public" }).success).toBe(false);
    expect(thirdFixedBatchDraftArtifactSchema.safeParse({ ...envelope(), approvalState: "approved" }).success).toBe(false);
    const missingWarning = envelope();
    missingWarning.warnings = [limitedReproducibilityWarning];
    expect(thirdFixedBatchDraftArtifactSchema.safeParse(missingWarning).success).toBe(false);
    expect(thirdFixedBatchDraftArtifactSchema.safeParse(envelope("primary")).success).toBe(true);
  });

  it("retains truthful per-candidate runtime labels without widening the private exception", () => {
    for (const model of ["gpt-5.6-sol", "gpt-6-astra"]) {
      const candidate = envelope();
      const input = { ...candidate, generator: {
        ...candidate.generator, model: { value: model, unavailableReason: null }
      }};
      const parsed = thirdFixedBatchDraftArtifactSchema.parse(input);
      expect(parsed.generator.model.value).toBe(model);
      expect(parsed.generator.immutableRevision).toEqual({ value: null, unavailableReason: "not_exposed_by_runtime" });
      expect(parsed.requiresAdministratorReview).toBe(true);
      expect(parsed.transcriptApprovalRequiredBeforeDependentApproval).toBe(true);
      expect(parsed.approvalState).toBe("draft");
      expect(parsed.searchEligible).toBe(false);
      expect(parsed.semanticEligible).toBe(false);
      expect(thirdFixedBatchDraftArtifactSchema.safeParse({ ...input, batchManifestSha256: "a".repeat(64) }).success).toBe(false);
      expect(thirdFixedBatchDraftArtifactSchema.safeParse({ ...input, generator: { ...input.generator, retryCount: 2 }}).success).toBe(false);
    }
  });

  it("keeps an original runtime label when a separately recorded correction uses another model", () => {
    const candidate = envelope();
    const parsed = thirdFixedBatchDraftArtifactSchema.parse({ ...candidate, generator: {
      ...candidate.generator,
      model: { value: "gpt-5.6-sol", unavailableReason: null },
      retryCount: 1,
      availableGenerationSettings: [
        "maximum_one_pre_import_validation_regeneration",
        `original_candidate_sha256:${"a".repeat(64)}`,
        "correction_model:gpt-6-astra",
        `correction_lineage_sha256:${"b".repeat(64)}`
      ]
    }});
    expect(parsed.generator.model.value).toBe("gpt-5.6-sol");
    expect(parsed.generator.availableGenerationSettings).toContain("correction_model:gpt-6-astra");
    expect(parsed.warnings).toContain(limitedReproducibilityWarning);
    expect(parsed.approvalState).toBe("draft");
    expect(parsed.publicVisibility).toBe("private");
  });

  it("refuses out-of-scope and cross-video caption resources", () => {
    expect(() => selectCaptionTrackForThirdFixedBatch(authorization, "ZZZZZZZZZZZ", [])).toThrow("d154_video_out_of_scope");
    expect(() => selectCaptionTrackForThirdFixedBatch(authorization, records[0]!.videoId, [
      track({ videoId: records[1]!.videoId })
    ])).toThrow("d154_cross_video_caption_resource");
  });
});

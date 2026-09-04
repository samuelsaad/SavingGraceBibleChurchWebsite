import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  boundedUnknownAudioRetryDecisionId,
  boundedUnknownAudioRetryDraftEnvelopeSchema,
  boundedUnknownAudioRetryManifestSha256,
  boundedUnknownAudioRetryWarning,
  bindBoundedUnknownAudioRetry,
  createBoundedUnknownAudioRetryState,
  nextBoundedUnknownAudioRetryRecord,
  recordBoundedUnknownAudioRetryAttempt,
  selectCaptionTrackForBoundedUnknownAudioRetry,
  selectCaptionTrackWithPrimaryAudioRequirement
} from "../src/youtube/bounded-unknown-audio-retry";
import {
  limitedReproducibilityWarning,
  oneTimePreapprovalBatchExceptionId,
  type OneTimePreapprovalBatchAuthorization,
  type OneTimePreapprovalBatchRecord
} from "../src/enrichment/one-time-preapproval-batch";
import type { CaptionTrackMetadata } from "../src/youtube/pilot-caption-proof";

const governanceCommitHash = "a".repeat(40);
const transcriptSha256 = "b".repeat(64);

function records(): OneTimePreapprovalBatchRecord[] {
  return Array.from({ length: 36 }, (_, index) => ({
    sequence: index + 1,
    sourceWordPressId: 20_000 + index,
    videoId: String(index).padStart(11, "A").slice(-11),
    priorInspectionSha256: (index % 16).toString(16).repeat(64),
    selectedCaption: {
      captionId: `anonymised-caption-${index + 1}`,
      language: "en" as const,
      trackKind: index % 2 === 0 ? "standard" as const : "asr" as const
    },
    sourceSnapshot: {
      publicationStatus: "publish" as const,
      serviceDate: "2025-01-05",
      serviceDateAnomaly: "none",
      speakerTermIds: [],
      seriesTermIds: [],
      bibleBookTermIds: [],
      passageMetadataPresent: false,
      metadataAnomalyFlags: []
    }
  }));
}

function baseAuthorization(): OneTimePreapprovalBatchAuthorization {
  return {
    exceptionId: oneTimePreapprovalBatchExceptionId,
    manifestSha256: boundedUnknownAudioRetryManifestSha256,
    governanceCommitHash,
    orderedRecords: records()
  };
}

function priorCheckpoint() {
  const attempts = records().map((record) => ({
    sequence: record.sequence,
    sourceWordPressId: record.sourceWordPressId,
    videoId: record.videoId,
    safeMetadata: "retained-prior-attempt-evidence",
    outcome: "failed" as const,
    failureCode: "caption_primary_audio_unconfirmed" as const
  }));
  return {
    schemaVersion: 1 as const,
    privateContent: true as const,
    manifestSha256: boundedUnknownAudioRetryManifestSha256,
    records: attempts,
    integrity: {
      recordsSha256: createHash("sha256").update(JSON.stringify(attempts)).digest("hex")
    }
  };
}

function authorization() {
  const prior = priorCheckpoint();
  return bindBoundedUnknownAudioRetry({
    baseAuthorization: baseAuthorization(),
    priorCheckpoint: prior,
    priorCheckpointBytes: Buffer.from(JSON.stringify(prior)),
    governanceCommitHash
  });
}

function track(overrides: Partial<CaptionTrackMetadata> = {}): CaptionTrackMetadata {
  return {
    id: "anonymised-caption",
    videoId: records()[0]!.videoId,
    language: "en",
    trackKind: "ASR",
    audioTrackType: "unknown",
    status: "serving",
    isDraft: false,
    lastUpdated: "2026-09-04T00:00:00.000Z",
    ...overrides
  };
}

function envelope() {
  const auth = authorization();
  const target = auth.orderedRecords[0]!;
  return {
    schemaVersion: 1,
    privateContent: true,
    exceptionId: oneTimePreapprovalBatchExceptionId,
    retryDecisionId: boundedUnknownAudioRetryDecisionId,
    batchManifestSha256: boundedUnknownAudioRetryManifestSha256,
    target: {
      sequence: target.sequence,
      sourceWordPressId: target.sourceWordPressId,
      videoId: target.videoId
    },
    transcript: {
      groundingRevisionId: "11111111-1111-4111-8111-111111111111",
      rowVersion: 1,
      sourceTranscriptSha256: transcriptSha256,
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
    generator: {
      provider: "OpenAI",
      executionSurface: "Codex",
      executionMode: "interactive Codex session",
      model: { value: null, unavailableReason: "not_exposed_by_runtime" },
      immutableRevision: { value: null, unavailableReason: "not_exposed_by_runtime" },
      sessionOrRunIdentifier: { value: null, unavailableReason: "not_exposed_by_runtime" },
      workspacePrivacyAndRetention: "not_exposed_to_runtime",
      availableGenerationSettings: ["maximum_one_regeneration_retry"],
      generatedAt: "2026-09-04T00:01:00.000Z",
      governanceCommitHash,
      batchManifestSha256: boundedUnknownAudioRetryManifestSha256,
      promptOrProcessingVersionSha256: "c".repeat(64),
      sourceTranscriptSha256: transcriptSha256,
      outputSha256: "d".repeat(64),
      retryCount: 0,
      externalGenerativeApiCostAud: 0
    },
    captionAudioAssociation: {
      audioTrackType: "unknown",
      primaryAudioConfirmed: false,
      acceptedUnderBoundedException: true,
      warning: boundedUnknownAudioRetryWarning
    },
    warnings: [limitedReproducibilityWarning, boundedUnknownAudioRetryWarning]
  };
}

describe("D-152 bounded unknown-audio retry", () => {
  it("binds only the exact D-151 manifest after all 36 expected prior failures", () => {
    const bound = authorization();
    expect(bound.decisionId).toBe(boundedUnknownAudioRetryDecisionId);
    expect(bound.previousAttemptCount).toBe(36);

    const wrongManifest = { ...baseAuthorization(), manifestSha256: "f".repeat(64) };
    expect(() => bindBoundedUnknownAudioRetry({
      baseAuthorization: wrongManifest,
      priorCheckpoint: priorCheckpoint(),
      priorCheckpointBytes: Buffer.from("private"),
      governanceCommitHash
    })).toThrow("bounded_unknown_audio_retry_manifest_scope_mismatch");

    const wrongFailure = priorCheckpoint();
    wrongFailure.records[0] = { ...wrongFailure.records[0]!, failureCode: "caption_missing" as never };
    wrongFailure.integrity.recordsSha256 = createHash("sha256")
      .update(JSON.stringify(wrongFailure.records)).digest("hex");
    expect(() => bindBoundedUnknownAudioRetry({
      baseAuthorization: baseAuthorization(),
      priorCheckpoint: wrongFailure,
      priorCheckpointBytes: Buffer.from("private"),
      governanceCommitHash
    })).toThrow();
  });

  it("accepts an eligible unknown track only through the exact bounded authorization", () => {
    const auth = authorization();
    const result = selectCaptionTrackForBoundedUnknownAudioRetry(auth, auth.orderedRecords[0]!.videoId, [track()]);
    expect(result).toMatchObject({
      outcome: "selected",
      provenance: {
        audioTrackType: "unknown",
        primaryAudioConfirmed: false,
        acceptedUnderBoundedException: true,
        warnings: [boundedUnknownAudioRetryWarning]
      }
    });
    expect(() => selectCaptionTrackForBoundedUnknownAudioRetry(
      auth,
      "ZZZZZZZZZZZ",
      [track({ videoId: "ZZZZZZZZZZZ" })]
    )).toThrow("bounded_unknown_audio_retry_video_out_of_scope");
    expect(selectCaptionTrackWithPrimaryAudioRequirement(auth.orderedRecords[0]!.videoId, [track()]))
      .toEqual({ outcome: "no_eligible_track", eligibleTrackCount: 0 });
  });

  it("prefers standard, rejects unsupported tracks, and fails on equal-priority ambiguity", () => {
    const auth = authorization();
    const videoId = auth.orderedRecords[0]!.videoId;
    const selected = selectCaptionTrackForBoundedUnknownAudioRetry(auth, videoId, [
      track({ id: "asr-caption", trackKind: "ASR" }),
      track({ id: "standard-caption", trackKind: "standard" })
    ]);
    expect(selected.outcome).toBe("selected");
    if (selected.outcome === "selected") expect(selected.track.id).toBe("standard-caption");

    for (const rejected of [
      track({ audioTrackType: "commentary" }),
      track({ audioTrackType: "descriptive" }),
      track({ trackKind: "forced" }),
      track({ language: "fr" }),
      track({ isDraft: true })
    ]) {
      expect(selectCaptionTrackForBoundedUnknownAudioRetry(auth, videoId, [rejected]).outcome)
        .toBe("no_eligible_track");
    }
    expect(selectCaptionTrackForBoundedUnknownAudioRetry(auth, videoId, [
      track({ id: "first-standard", trackKind: "standard" }),
      track({ id: "second-standard", trackKind: "standard", audioTrackType: "primary" })
    ])).toEqual({ outcome: "ambiguous_track", priority: "standard", eligibleTrackCount: 2 });
  });

  it("requires truthful unknown-audio warning and provenance on private draft envelopes", () => {
    const valid = envelope();
    expect(boundedUnknownAudioRetryDraftEnvelopeSchema.safeParse(valid).success).toBe(true);
    expect(boundedUnknownAudioRetryDraftEnvelopeSchema.safeParse({
      ...valid,
      warnings: [limitedReproducibilityWarning]
    }).success).toBe(false);
    expect(boundedUnknownAudioRetryDraftEnvelopeSchema.safeParse({
      ...valid,
      captionAudioAssociation: { ...valid.captionAudioAssociation, primaryAudioConfirmed: true }
    }).success).toBe(false);
  });

  it("retains the prior checkpoint binding, preserves order, and expires after 36 retry attempts", () => {
    const auth = authorization();
    let state = createBoundedUnknownAudioRetryState(auth);
    expect(state.previousAttemptCount).toBe(36);
    expect(state.previousCheckpointSha256).toBe(auth.previousCheckpointSha256);
    expect(() => recordBoundedUnknownAudioRetryAttempt(auth, state, {
      sequence: 2,
      sourceWordPressId: auth.orderedRecords[1]!.sourceWordPressId,
      videoId: auth.orderedRecords[1]!.videoId,
      outcome: "failed"
    })).toThrow("bounded_unknown_audio_retry_record_out_of_order_or_scope");

    for (const record of auth.orderedRecords) {
      state = recordBoundedUnknownAudioRetryAttempt(auth, state, {
        sequence: record.sequence,
        sourceWordPressId: record.sourceWordPressId,
        videoId: record.videoId,
        outcome: "completed"
      });
    }
    expect(nextBoundedUnknownAudioRetryRecord(auth, state)).toBeNull();
    expect(() => recordBoundedUnknownAudioRetryAttempt(auth, state, {
      sequence: 37,
      sourceWordPressId: 99_999,
      videoId: "ZZZZZZZZZZZ",
      outcome: "failed"
    })).toThrow("bounded_unknown_audio_retry_expired");
  });
});

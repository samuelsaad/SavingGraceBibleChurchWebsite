import { createHash } from "node:crypto";
import {
  atomicReviewItemSetSha256,
  buildAtomicReviewItems,
  phase3b2AtomicReviewManifestSchema,
  type Phase3b2AtomicReviewManifest
} from "../../src/enrichment/atomic-review-contracts";
import { deterministicPilotUuid } from "../../src/enrichment/phase3b2-pilot";
import { lexicalTokenSequenceSha256 } from "../../src/enrichment/pilot-punctuation";

export const anonymisedAtomicVideos = ["atomictst01", "atomictst02"] as const;

function transcript(label: string): string {
  return Array.from(
    { length: 50 },
    (_, index) => `Anonymised ${label} paragraph ${index + 1} provides stable local review context.`
  ).join("\n\n");
}

function record(
  recordKey: "authorised-record-2" | "authorised-record-3",
  videoId: string,
  sourceWordPressId: number,
  captionCount: number,
  combinedCount: number
) {
  const bodyText = transcript(recordKey);
  const targetSermonId = deterministicPilotUuid(videoId);
  const contentSha256 = createHash("sha256").update(bodyText, "utf8").digest("hex");
  const tokenSha256 = lexicalTokenSequenceSha256(bodyText);
  const reviewItems = buildAtomicReviewItems({
    sourceRecordKey: recordKey,
    transcriptSermonId: targetSermonId,
    sourceTranscriptSha256: contentSha256,
    expectedTranscriptRowVersion: 1,
    captionErrors: Array.from({ length: captionCount }, (_, index) => ({
      detail: `Anonymised caption finding ${index + 1}.`,
      supportingParagraphs: [(index % 50) + 1]
    })),
    namesOrScriptureReferences: Array.from({ length: combinedCount }, (_, index) => ({
      detail: `Anonymised combined name or Scripture finding ${index + 1}.`,
      supportingParagraphs: [((index + captionCount) % 50) + 1]
    }))
  });
  return {
    recordKey,
    restorationTarget: {
      title: `Anonymised atomic review ${recordKey}`,
      slug: `anonymised-atomic-review-${recordKey}`,
      serviceDate: "1970-01-01",
      mediaTitle: `Anonymised atomic media ${recordKey}`
    },
    draftBundle: {
      schemaVersion: 3 as const,
      sourceWordPressId,
      targetSermonId,
      expectedRowVersion: 1,
      description: {
        bodyText: "This anonymised description is long enough for private draft validation and remains entirely fictional test content.",
        provenance: { sourceKind: "generated_draft" as const, sourceReference: "anonymised" }
      },
      transcript: {
        bodyText,
        provenance: { sourceKind: "caption" as const, sourceReference: "anonymised" }
      },
      questionAnswers: Array.from({ length: 7 }, (_, index) => ({
        question: `What does anonymised question ${index + 1} ask?`,
        answer: "It records an entirely fictional answer for local contract verification.",
        provenance: { sourceKind: "generated_draft" as const, sourceReference: "anonymised" }
      })),
      sourceProvenance: {
        provider: "youtube" as const,
        videoId,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        captionLanguage: "en-AU",
        captionTrackType: "unknown" as const,
        originalFilename: `anonymised-${recordKey}.txt`,
        sourceContentSha256: "a".repeat(64),
        retrievalAttribution: "authorised_youtube_studio_export" as const,
        sourceCharacterCount: bodyText.length,
        cleanedCharacterCount: bodyText.length,
        apparentCompleteness: "requires_manual_review" as const,
        uncertaintyMarkerCount: 0,
        warnings: [{
          code: "possible_caption_errors_require_review",
          safeDetail: "Aggregate warning retained as informational provenance only."
        }],
        unresolvedPassages: [],
        processingVersion: "anonymised-atomic-v1",
        importedAt: "2026-08-07T00:00:00.000Z",
        processedAt: "2026-08-07T00:00:00.000Z",
        processingDurationMs: 1,
        estimatedReviewMinutes: 1,
        manualAttentionRequired: true as const,
        accuracyReviewStatus: "required" as const
      }
    },
    transcriptEvidence: {
      contentSha256,
      sourceTokenSequenceSha256: tokenSha256,
      cleanedTokenSequenceSha256: tokenSha256,
      sourceTokenCount: bodyText.split(/\s+/u).length,
      cleanedTokenCount: bodyText.split(/\s+/u).length,
      expectedRowVersion: 1,
      zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens: true as const,
      whitespaceBoundariesPreserved: true as const,
      sourceSegmentsCompleteAndUnique: true as const,
      chunkReassemblyComplete: true as const
    },
    reviewItemSetSha256: atomicReviewItemSetSha256(reviewItems),
    reviewItems
  };
}

export function anonymisedAtomicManifest(): Phase3b2AtomicReviewManifest {
  return phase3b2AtomicReviewManifestSchema.parse({
    schemaVersion: 1,
    sourceSnapshotId: "anonymised-atomic-review",
    records: [
      record("authorised-record-2", anonymisedAtomicVideos[0], 992_002, 26, 16),
      record("authorised-record-3", anonymisedAtomicVideos[1], 992_003, 29, 15)
    ]
  });
}

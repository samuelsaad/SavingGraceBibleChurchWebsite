import { describe, expect, it } from "vitest";
import {
  deterministicEnrichmentQueue,
  enrichmentDraftBundleSchema
} from "../src/enrichment/contracts";

const idA = "75df2144-b557-50f6-98bd-011cd696bfb9";
const idB = "76df2144-b557-50f6-98bd-011cd696bfb9";

describe("historical enrichment contracts", () => {
  it("produces a deterministic source-ID queue with deterministic needs", () => {
    const records = [
      { sourceWordPressId: 20, targetSermonId: idB, slug: "second", rowVersion: 1, needs: ["missing_media", "missing_speaker"] as const },
      { sourceWordPressId: 10, targetSermonId: idA, slug: "first", rowVersion: 2, needs: ["questions_awaiting_review", "missing_transcript"] as const }
    ];
    const first = deterministicEnrichmentQueue("safe-snapshot", records.map((item) => ({ ...item, needs: [...item.needs] })));
    const second = deterministicEnrichmentQueue("safe-snapshot", records.map((item) => ({ ...item, needs: [...item.needs].reverse() })));
    expect(first).toEqual(second);
    expect(first.records.map((item) => item.sourceWordPressId)).toEqual([10, 20]);
  });

  it("accepts 5–10 plain-text drafts and never grants approval", () => {
    const parsed = enrichmentDraftBundleSchema.parse({
      schemaVersion: 2,
      sourceWordPressId: 10,
      targetSermonId: idA,
      expectedRowVersion: 2,
      description: {
        bodyText: "A draft description grounded in the sermon transcript and scripture context.",
        provenance: { sourceKind: "generated_draft", sourceReference: "local-job-10" }
      },
      transcript: {
        bodyText: "Draft transcript",
        provenance: { sourceKind: "transcription", sourceReference: "local-job-10" }
      },
      questionAnswers: Array.from({ length: 5 }, (_, index) => ({
        question: `Question ${index + 1}?`,
        answer: `Answer ${index + 1}.`,
        provenance: { sourceKind: "generated_draft", sourceReference: "local-job-10" }
      }))
    });
    expect(parsed.questionAnswers).toHaveLength(5);
    expect(JSON.stringify(parsed)).not.toMatch(/approved|in_review/);
  });

  it("rejects unsafe HTML, blank fields and invalid counts", () => {
    const base = {
      schemaVersion: 2,
      sourceWordPressId: 10,
      targetSermonId: idA,
      expectedRowVersion: 2,
      description: {
        bodyText: "<iframe src='unsafe'></iframe>",
        provenance: { sourceKind: "generated_draft", sourceReference: null }
      },
      transcript: {
        bodyText: "<script>alert(1)</script>",
        provenance: { sourceKind: "manual", sourceReference: null }
      },
      questionAnswers: Array.from({ length: 4 }, () => ({
        question: " ",
        answer: "Answer",
        provenance: { sourceKind: "manual", sourceReference: null }
      }))
    };
    expect(() => enrichmentDraftBundleSchema.parse(base)).toThrow();
  });
});

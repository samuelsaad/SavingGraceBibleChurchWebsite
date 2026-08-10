import { describe, expect, it } from "vitest";
import {
  applyAssociatedTranscriptCorrection,
  associatedTranscriptWording,
  TranscriptAssociationError
} from "../src/enrichment/review-wording";

describe("exact guided-review transcript wording", () => {
  const transcript = "First anonymised paragraph.\n\nSecond wording to review.\n\nThird paragraph.";

  it("returns and replaces only exact paragraph-ordinal associations", () => {
    expect(associatedTranscriptWording(transcript, [2])).toBe("Second wording to review.");
    expect(applyAssociatedTranscriptCorrection({
      transcript,
      paragraphNumbers: [2],
      expectedOriginalWording: "Second wording to review.",
      correctedWording: "Second wording was reviewed."
    })).toEqual({
      bodyText: "First anonymised paragraph.\n\nSecond wording was reviewed.\n\nThird paragraph.",
      originalWording: "Second wording to review.",
      correctedWording: "Second wording was reviewed."
    });
  });

  it("supports stable multi-paragraph associations without changing unrelated text", () => {
    const result = applyAssociatedTranscriptCorrection({
      transcript,
      paragraphNumbers: [1, 3],
      expectedOriginalWording: "First anonymised paragraph.\n\nThird paragraph.",
      correctedWording: "First reviewed paragraph.\n\nThird reviewed paragraph."
    });
    expect(result.bodyText).toBe(
      "First reviewed paragraph.\n\nSecond wording to review.\n\nThird reviewed paragraph."
    );
  });

  it("rejects blank, unchanged, stale, missing, and ambiguous targets", () => {
    const attempt = (overrides: Partial<Parameters<typeof applyAssociatedTranscriptCorrection>[0]>) =>
      applyAssociatedTranscriptCorrection({
        transcript,
        paragraphNumbers: [2],
        expectedOriginalWording: "Second wording to review.",
        correctedWording: "Reviewed wording.",
        ...overrides
      });
    const expectReason = (
      reason: TranscriptAssociationError["reason"],
      action: () => unknown
    ) => {
      try {
        action();
        throw new Error("Expected transcript association failure");
      } catch (error) {
        expect(error).toBeInstanceOf(TranscriptAssociationError);
        expect(error).toMatchObject({ reason });
      }
    };
    expectReason("blank", () => attempt({ correctedWording: "   " }));
    expectReason("unchanged", () => attempt({ correctedWording: "Second wording to review." }));
    expectReason("unchanged", () => attempt({ correctedWording: "  Second wording to review.  " }));
    expectReason("stale", () => attempt({ expectedOriginalWording: "Stale wording." }));
    expectReason("missing", () => attempt({ paragraphNumbers: [4] }));
    expectReason("ambiguous", () => attempt({ paragraphNumbers: [2, 2] }));
    expectReason("ambiguous", () => attempt({
      paragraphNumbers: [1, 3],
      expectedOriginalWording: "First anonymised paragraph.\n\nThird paragraph.",
      correctedWording: "Merged paragraph."
    }));
  });
});

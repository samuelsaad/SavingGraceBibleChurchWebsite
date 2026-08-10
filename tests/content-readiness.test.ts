import { describe, expect, it } from "vitest";
import { evaluateContentReadiness } from "../src/domain/content-readiness";

const media = [{
  provider: "youtube" as const,
  mediaType: "video" as const,
  externalId: "abcdefghijk",
  canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
  title: "Controlled video"
}];

function questionAnswers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    question: `Question ${index + 1}?`,
    answer: `Answer ${index + 1}.`,
    status: "approved" as const,
    displayOrder: index + 1
  }));
}

const completeBase = {
  speakerId: "75df2144-b557-50f6-98bd-011cd696bfb9",
  bookClassificationIds: ["4b4ae324-6cf8-5510-9f77-c5c88a308fc4"],
  summary: "This approved description clearly explains the central sermon message and its application to the listener.",
  summaryStatus: "approved" as const,
  transcript: { bodyText: "A complete reviewed transcript.", status: "approved" as const },
  media
};

describe("sermon content readiness", () => {
  it.each([5, 10])("passes with %i reviewed ordered Q&A pairs", (count) => {
    expect(
      evaluateContentReadiness({ ...completeBase, questionAnswers: questionAnswers(count) })
    ).toMatchObject({ isComplete: true, approvedQuestionCount: count });
  });

  it.each([4, 11])("fails with %i Q&A pairs", (count) => {
    const result = evaluateContentReadiness({
      ...completeBase,
      questionAnswers: questionAnswers(count)
    });
    expect(result.isComplete).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "insufficient_questions" })
    );
  });

  it("allows an incomplete draft shape but reports every blocking field", () => {
    const result = evaluateContentReadiness({
      speakerId: null,
      bookClassificationIds: [],
      summary: "A private description draft that has enough meaningful context for later human review and approval.",
      summaryStatus: "draft",
      transcript: { bodyText: "draft text", status: "draft" },
      questionAnswers: [],
      media: []
    });
    expect(result.isComplete).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "missing_speaker",
      "missing_bible_book",
      "description_awaiting_review",
      "transcript_awaiting_review",
      "insufficient_questions",
      "missing_media"
    ]);
  });

  it("keeps approved content complete while Bible-book metadata is incomplete", () => {
    const result = evaluateContentReadiness({
      ...completeBase,
      bookClassificationIds: [],
      questionAnswers: questionAnswers(5)
    });
    expect(result).toMatchObject({
      isComplete: false,
      isContentComplete: true,
      hasRequiredBibleBook: false
    });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "missing_bible_book" }));
  });

  it.each(["draft", "in_review"] as const)(
    "does not count a %s sermon description as ready",
    (summaryStatus) => {
      const result = evaluateContentReadiness({
        ...completeBase,
        summaryStatus,
        questionAnswers: questionAnswers(5)
      });
      expect(result).toMatchObject({ isComplete: false, hasApprovedDescription: false });
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: "description_awaiting_review" })
      );
    }
  );

  it("reports a blank description as missing", () => {
    const result = evaluateContentReadiness({
      ...completeBase,
      summary: " ",
      summaryStatus: "missing",
      questionAnswers: questionAnswers(5)
    });
    expect(result).toMatchObject({ isComplete: false, hasApprovedDescription: false });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "missing_description" }));
  });

  it("rejects blank text and non-consecutive ordering", () => {
    const items = questionAnswers(5);
    items[1]!.question = " ";
    items[2]!.answer = " ";
    items[4]!.displayOrder = 7;
    const result = evaluateContentReadiness({ ...completeBase, questionAnswers: items });
    expect(result.isComplete).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["blank_question", "blank_answer", "invalid_question_order"])
    );
  });
});

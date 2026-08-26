import { describe, expect, it } from "vitest";
import {
  applyIndisputableMechanicalCorrections,
  generatedTextMechanicalQaVersion,
  inspectGeneratedText
} from "../src/enrichment/generated-text-mechanical-qa";

describe("generated sermon text mechanical QA", () => {
  it("rejects and exactly corrects noncanonical Jesus and Christ casing", () => {
    const original = "The speaker explains why jesus is called CHRIST and why Jesus matters.";
    const report = inspectGeneratedText(original, []);
    expect(report.version).toBe(generatedTextMechanicalQaVersion);
    expect(report.completed).toBe(true);
    expect(report.outcome).toBe("failed");
    expect(report.issues.map((item) => item.code)).toEqual([
      "jesus_incorrect_capitalisation",
      "christ_incorrect_capitalisation"
    ]);

    const corrected = applyIndisputableMechanicalCorrections(original);
    expect(corrected.text).toBe("The speaker explains why Jesus is called Christ and why Jesus matters.");
    expect(corrected.correctionCount).toBe(2);
    expect(applyIndisputableMechanicalCorrections(corrected.text).correctionCount).toBe(0);
  });

  it("checks descriptions, questions and answers independently", () => {
    const report = inspectGeneratedText(
      "A complete anonymised description ends clearly.",
      [{ question: "Why does jesus matter?", answer: "The answer refers to christ and remains a complete response." }]
    );
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "jesus_incorrect_capitalisation", contentArea: "question", itemIndex: 0 }),
      expect.objectContaining({ code: "christ_incorrect_capitalisation", contentArea: "answer", itemIndex: 0 })
    ]));
  });

  it("corrects only indisputable spacing and punctuation placement", () => {
    const corrected = applyIndisputableMechanicalCorrections("A sentence  has space , but no changed meaning.");
    expect(corrected.text).toBe("A sentence has space, but no changed meaning.");
    expect(corrected.corrections).toMatchObject({ repeated_spacing: 1, space_before_punctuation: 1 });
  });

  it("flags contextual divine terms and biblical names for review without changing them", () => {
    const original = "The example contrasts a false god with scripture, refers to genesis 1, and quotes from exodus.";
    const report = inspectGeneratedText(original, []);
    expect(report.outcome).toBe("passed_with_review_flags");
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "contextual_divine_term_capitalisation", severity: "review" }),
      expect.objectContaining({ code: "biblical_name_or_book_capitalisation", severity: "review" })
    ]));
    expect(applyIndisputableMechanicalCorrections(original).text).toBe(original);
  });

  it("detects sentence starts, broken joins, duplicated punctuation and fragment risk", () => {
    const report = inspectGeneratedText("A complete example!another sentence begins. final words", []);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "broken_sentence_join", severity: "blocking" }),
      expect.objectContaining({ code: "sentence_initial_lowercase", severity: "blocking" }),
      expect.objectContaining({ code: "possible_caption_fragment", severity: "review" })
    ]));
    expect(inspectGeneratedText("A complete example!! Another sentence follows.", []).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "duplicated_punctuation" })]));
  });
});

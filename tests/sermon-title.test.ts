import { describe, expect, it } from "vitest";
import { assessSermonTitle } from "../src/domain/sermon-title";

describe("conservative sermon title boundary policy", () => {
  it.each([
    "A Living Hope — 1 Peter 1:3–9", "A Living Hope - 1 Pet 1:3-9",
    "1 Peter 1:3–9: A Living Hope", "A Living Hope (1 Peter 1:3–9)",
    "A Living Hope [1 Peter 1:3–9]", "[1 Peter 1:3–9] A Living Hope",
    "(1 Peter 1:3–9) — A Living Hope", "A Living Hope | 1 Peter 1:3–9"
  ])("separates a corroborated prefix or suffix: %s", (title) => {
    expect(assessSermonTitle(title, { passageTexts: ["1 Peter 1:3–9"] })).toEqual({
      outcome: "correctable", title: "A Living Hope", reason: "corroborated_boundary_reference"
    });
  });
  it.each(["Learning from Romans", "Hope: Part 2", "Seven reasons for hope", "A Living Hope"])(
    "preserves legitimate wording: %s", (title) => expect(assessSermonTitle(title).title).toBe(title)
  );
  it.each(["1 Peter 1:3–9", "A Living Hope 1 Peter 1:3–9", "Romans 8 in daily life",
    "Romans 8 — John 3", "Hope — Romans 99", "— 1 Peter 1:3–9"])(
    "requires a human decision: %s", (title) => {
      expect(assessSermonTitle(title, { sourceTitles: [title] })).toMatchObject({ outcome: "manual_review", title });
    }
  );
  it("requires corroboration and preserves all remaining punctuation and part numbers", () => {
    const title = "Hope! Part 2 — Romans 8:1–9:3";
    expect(assessSermonTitle(title).outcome).toBe("manual_review");
    const fixed = assessSermonTitle(title, { sourceTitles: [title] });
    expect(fixed.title).toBe("Hope! Part 2");
    expect(assessSermonTitle(fixed.title).outcome).toBe("clean");
  });
  it("does not mutate evidence or accept a different passage", () => {
    const evidence = { passageTexts: ["John 3:1–10"] };
    expect(assessSermonTitle("Hope — Romans 8:1–9", evidence).outcome).toBe("manual_review");
    expect(evidence).toEqual({ passageTexts: ["John 3:1–10"] });
  });
});

import { describe, expect, it } from "vitest";
import {
  bibleBooks,
  biblePassageIntervalsOverlap,
  bibleBookBySlug,
  extractPrimaryPassageFromTitle,
  formatBiblePassage,
  passageQueryLabel,
  validateBiblePassage
} from "../src/domain/bible-passage";
import { anonymisedPreparationFixture } from "../src/scripture/primary-passage-preparation";

describe("structured primary preaching passage parsing", () => {
  it("recognises canonical, abbreviated, numbered-book, single-chapter, and cross-chapter forms", () => {
    expect(extractPrimaryPassageFromTitle("An anonymised message — Romans 8:1-4")).toMatchObject({
      outcome: "one_valid_reference",
      passage: { canonicalBookId: 45, startChapter: 8, startVerse: 1, endChapter: 8, endVerse: 4, displayText: "Romans 8:1–4" }
    });
    expect(extractPrimaryPassageFromTitle("An anonymised message (1 Jn 2:1—2)")).toMatchObject({
      outcome: "one_valid_reference",
      passage: { canonicalBookId: 62, startChapter: 2, startVerse: 1, endVerse: 2 }
    });
    expect(extractPrimaryPassageFromTitle("An anonymised message, Jude 3–4")).toMatchObject({
      outcome: "one_valid_reference",
      passage: { canonicalBookId: 65, startChapter: 1, startVerse: 3, endChapter: 1, endVerse: 4 }
    });
    expect(extractPrimaryPassageFromTitle("An anonymised message John 3:16–4:2")).toMatchObject({
      outcome: "one_valid_reference",
      passage: { canonicalBookId: 43, startChapter: 3, startVerse: 16, endChapter: 4, endVerse: 2 }
    });
  });

  it("does not guess when a title is absent, invalid, or contains multiple references", () => {
    expect(extractPrimaryPassageFromTitle("An anonymised title with no reference")).toEqual({ outcome: "no_reference", passage: null });
    expect(extractPrimaryPassageFromTitle("An anonymised title Romans 99:1")).toMatchObject({ outcome: "manual_review_required", reason: "invalid_reference" });
    expect(extractPrimaryPassageFromTitle("Romans 8:1 and John 3:16")).toMatchObject({ outcome: "manual_review_required", reason: "multiple_references" });
  });

  it("rejects reversed or structurally invalid coordinates and formats valid ranges", () => {
    expect(validateBiblePassage({ canonicalBookId: 45, startChapter: 8, startVerse: 4, endChapter: 8, endVerse: 1 }).valid).toBe(false);
    expect(validateBiblePassage({ canonicalBookId: 45, startChapter: 17, startVerse: null, endChapter: 17, endVerse: null }).valid).toBe(false);
    expect(validateBiblePassage({ canonicalBookId: 45, startChapter: 8, startVerse: null, endChapter: 8, endVerse: 4 }).valid).toBe(false);
    expect(formatBiblePassage({ canonicalBookId: 45, startChapter: 8, startVerse: 1, endChapter: 8, endVerse: 4 })).toBe("Romans 8:1–4");
  });

  it("provides stable book metadata and anonymised preparation evidence", () => {
    expect(bibleBookBySlug("romans")).toMatchObject({ id: 45, chapterCount: 16, testament: "new" });
    expect(passageQueryLabel({ passageBook: "romans", passageChapter: 8, passageVerse: 1, passageEndVerse: 4 })).toBe("Romans 8:1–4");
    const fixtures = anonymisedPreparationFixture(["Anonymised — Romans 8:1–4", "Anonymised without a passage"]);
    expect(fixtures).toHaveLength(2);
    expect(fixtures[0]?.evidenceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fixtures.map((fixture) => fixture.extraction.outcome)).toEqual(["one_valid_reference", "no_reference"]);
  });

  it("recognises every canonical book and its configured common aliases", () => {
    expect(bibleBooks).toHaveLength(66);
    for (const book of bibleBooks) {
      const canonical = extractPrimaryPassageFromTitle(`Anonymised — ${book.canonicalName} 1:1`);
      expect(canonical).toMatchObject({ outcome: "one_valid_reference", passage: { canonicalBookId: book.id } });
      for (const alias of book.aliases) {
        expect(extractPrimaryPassageFromTitle(`Anonymised — ${alias} 1:1`)).toMatchObject({
          outcome: "one_valid_reference",
          passage: { canonicalBookId: book.id }
        });
      }
    }
  });

  it("uses inclusive structured interval overlap at chapter and verse boundaries", () => {
    const mark = (startVerse: number | null, endVerse: number | null, chapter = 10) => ({
      canonicalBookId: 41,
      startChapter: chapter,
      startVerse,
      endChapter: chapter,
      endVerse
    });
    const sermon = mark(46, 50);
    expect(biblePassageIntervalsOverlap(sermon, mark(null, null))).toBe(true);
    expect(biblePassageIntervalsOverlap(sermon, mark(46, 46))).toBe(true);
    expect(biblePassageIntervalsOverlap(sermon, mark(48, 48))).toBe(true);
    expect(biblePassageIntervalsOverlap(sermon, mark(50, 50))).toBe(true);
    expect(biblePassageIntervalsOverlap(sermon, mark(47, 49))).toBe(true);
    expect(biblePassageIntervalsOverlap(sermon, mark(45, 45))).toBe(false);
    expect(biblePassageIntervalsOverlap(sermon, mark(51, 51))).toBe(false);
    expect(biblePassageIntervalsOverlap(sermon, mark(null, null, 9))).toBe(false);
    expect(biblePassageIntervalsOverlap(sermon, { ...mark(48, 48), canonicalBookId: 40 })).toBe(false);
  });

  it("does not confuse dates or unrelated title numbers with Scripture references", () => {
    expect(extractPrimaryPassageFromTitle("Anonymised episode 23 — 2026-08-20")).toEqual({ outcome: "no_reference", passage: null });
    expect(extractPrimaryPassageFromTitle("Anonymised part 2 of 5")).toEqual({ outcome: "no_reference", passage: null });
    expect(extractPrimaryPassageFromTitle("Anonymised — Mark 10:177")).toMatchObject({ outcome: "manual_review_required", reason: "invalid_reference" });
  });
});

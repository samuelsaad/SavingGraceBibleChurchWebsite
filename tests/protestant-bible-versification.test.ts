import { describe, expect, it } from "vitest";
import {
  bibleBookCategories,
  bibleBooks,
  validateBiblePassage
} from "../src/domain/bible-passage";
import {
  protestantBibleVerseCounts,
  protestantVersificationRevision,
  verseCountForChapter
} from "../src/domain/protestant-bible-versification";

describe("checked-in Protestant Bible versification", () => {
  it("matches the reviewed KJV canon totals and every canonical chapter count", () => {
    const entries = Object.entries(protestantBibleVerseCounts);
    expect(protestantVersificationRevision).toBe("sgbc-kjv-versification-v1");
    expect(entries).toHaveLength(66);
    expect(bibleBooks).toHaveLength(66);
    expect(bibleBooks.reduce((total, book) => total + book.chapterCount, 0)).toBe(1_189);
    expect(entries.flatMap(([, verses]) => verses).reduce((total, count) => total + count, 0)).toBe(31_102);

    for (const book of bibleBooks) {
      expect(book.verseCounts).toHaveLength(book.chapterCount);
      expect(book.verseCounts.every((count) => Number.isInteger(count) && count > 0 && count <= 176)).toBe(true);
      expect(book.abbreviation.length).toBeGreaterThan(0);
    }
  });

  it("retains canonical order, ten named categories and known boundary counts", () => {
    expect(bibleBooks.map((book) => book.id)).toEqual(Array.from({ length: 66 }, (_, index) => index + 1));
    expect(bibleBookCategories).toHaveLength(10);
    expect(new Set(bibleBooks.map((book) => book.category))).toEqual(
      new Set(bibleBookCategories.map((category) => category.key))
    );
    expect(verseCountForChapter("genesis", 3)).toBe(24);
    expect(verseCountForChapter("psalms", 119)).toBe(176);
    expect(verseCountForChapter("obadiah", 1)).toBe(21);
    expect(verseCountForChapter("revelation", 22)).toBe(21);
    expect(verseCountForChapter("genesis", 51)).toBeNull();
  });

  it("rejects a verse outside its actual canonical chapter", () => {
    expect(validateBiblePassage({
      canonicalBookId: 1,
      startChapter: 3,
      startVerse: 25,
      endChapter: 3,
      endVerse: 25
    })).toMatchObject({ valid: false, issues: ["Starting verse is outside the canonical chapter", "Ending verse is outside the canonical chapter"] });
  });
});

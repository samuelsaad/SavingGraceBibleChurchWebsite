/**
 * Pure helpers behind the Canon presentation: shelf geometry for the 66
 * books, the to-scale canon strip, per-book sermon counts derived from the
 * repository's filter options, and the chapter/verse availability map used
 * by the open-book rulers.
 *
 * Everything here is derived from the checked-in canonical versification and
 * from repository projections; nothing is invented and no external Bible
 * service is used.
 */
import { bibleBookCategories, bibleBooks, type BibleBookCategory, type BibleBookDefinition } from "../domain/bible-passage";
import type { PublicPassageVerseAvailability, PublicSermonFilterOption, PublicSermonFilterOptions } from "../server/repositories/sermon-repository";

export const totalChapters = bibleBooks.reduce((sum, book) => sum + book.chapterCount, 0);

export interface CanonSegment {
  book: BibleBookDefinition;
  /** First chapter index in the 1,189-chapter canon, zero-based. */
  start: number;
  /** Chapter count. */
  length: number;
}

/** The 66 books laid end to end, one unit per chapter. */
export const canonSegments: readonly CanonSegment[] = (() => {
  let start = 0;
  return bibleBooks.map((book) => {
    const segment = { book, start, length: book.chapterCount };
    start += book.chapterCount;
    return segment;
  });
})();

export function categoryLabel(category: BibleBookCategory): string {
  return bibleBookCategories.find((item) => item.key === category)?.label ?? category;
}

/** Books that eligible sermons are classified under, keyed by slug. */
export function preachedBooks(options: Pick<PublicSermonFilterOptions, "books">): Map<string, PublicSermonFilterOption> {
  return new Map(options.books.map((option) => [option.slug, option]));
}

export interface ShelfBook {
  book: BibleBookDefinition;
  /** Index in canonical order, zero-based (used for the settle animation stagger). */
  index: number;
  /** Present when at least one eligible sermon is classified under the book. */
  option: PublicSermonFilterOption | null;
  /** Sermon count when the repository projection carries it. */
  count: number | null;
}

export function shelfBooks(options: Pick<PublicSermonFilterOptions, "books">): ShelfBook[] {
  const preached = preachedBooks(options);
  return bibleBooks.map((book, index) => {
    const option = preached.get(book.slug) ?? null;
    return { book, index, option, count: option?.sermonCount ?? null };
  });
}

/** Square-root width factor so Psalms is wide without dwarfing Obadiah. */
export function spineWidthFactor(book: BibleBookDefinition): number {
  return Number(Math.sqrt(book.chapterCount).toFixed(2));
}

/** A book's compact shelf lettering: the canonical name when it fits, else the abbreviation. */
export function spineLabel(book: BibleBookDefinition): { long: string; short: string; length: "short" | "mid" | "long" } {
  const name = book.canonicalName;
  const length = name.length <= 6 ? "short" : name.length <= 10 ? "mid" : "long";
  return { long: name, short: book.abbreviation, length };
}

export interface ChapterAvailability {
  chapter: number;
  verses: number[];
}

/** book slug → chapter → verses covered by confirmed single-chapter primary passages. */
export function availabilityByBook(entries: readonly PublicPassageVerseAvailability[]): Map<string, Map<number, number[]>> {
  const map = new Map<string, Map<number, number[]>>();
  for (const entry of entries) {
    const chapters = map.get(entry.bookSlug) ?? new Map<number, number[]>();
    const verses = new Set([...(chapters.get(entry.chapter) ?? []), ...entry.verses]);
    chapters.set(entry.chapter, [...verses].sort((left, right) => left - right));
    map.set(entry.bookSlug, chapters);
  }
  return map;
}

/** Sermon counts for the summary line, computed only from projections that carry them. */
export function librarySummary(totalItems: number, options: PublicSermonFilterOptions): string[] {
  const parts = [`${totalItems} ${totalItems === 1 ? "sermon" : "sermons"}`];
  parts.push(`${options.books.length} of ${bibleBooks.length} books`);
  parts.push(`${options.speakers.length} ${options.speakers.length === 1 ? "speaker" : "speakers"}`);
  parts.push(`${options.series.length} series`);
  return parts;
}

/** Reading-time estimate at a conservative 200 words per minute, from the exact approved text. */
export function readingStats(text: string): { words: number; paragraphs: number; minutes: number } {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  const paragraphs = text.trim().split(/\n\s*\n/u).filter(Boolean).length;
  return { words, paragraphs, minutes: Math.max(1, Math.round(words / 200)) };
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-AU")} ${count === 1 ? singular : plural}`;
}

/**
 * A short excerpt of approved text for card lists: whole words, cut at the
 * last sentence end after roughly two thirds of the limit when one exists,
 * otherwise at the last word boundary, closed with an ellipsis. The wording
 * is never altered, only shortened; the full text lives on the sermon page.
 */
export function excerpt(text: string, limit = 150): string {
  const single = text.replace(/\s+/gu, " ").trim();
  if (single.length <= limit) return single;
  const window = single.slice(0, limit);
  const floor = Math.floor(limit * 0.5);
  const sentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (sentenceEnd >= floor) return window.slice(0, sentenceEnd + 1);
  const wordEnd = window.lastIndexOf(" ");
  return `${window.slice(0, wordEnd > 0 ? wordEnd : limit).replace(/[,;:]$/u, "")}…`;
}

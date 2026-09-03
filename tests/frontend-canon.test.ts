import { describe, expect, it } from "vitest";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import { bibleBookBySlug, bibleBooks } from "../src/domain/bible-passage";
import {
  availabilityByBook,
  canonSegments,
  formatCount,
  librarySummary,
  readingStats,
  shelfBooks,
  spineLabel,
  spineWidthFactor,
  totalChapters
} from "../src/frontend/canon";
import { bookTab, canonStrip, openBook, shelf } from "../src/frontend/components/shelf";
import { emptyFilterOptions } from "../src/frontend";
import { resultsTitle } from "../src/frontend/pages/archive";
import { previewRenderContext, publicRenderContext, withFilter, withoutPassage } from "../src/frontend/routes";
import type { PublicSermonFilterOptions } from "../src/server/repositories/sermon-repository";

const options: PublicSermonFilterOptions = {
  ...emptyFilterOptions,
  speakers: [{ name: "Example Speaker", slug: "example-speaker", sermonCount: 3 }],
  series: [{ name: "Example Series", slug: "example-series", sermonCount: 2 }],
  books: [
    { name: "Mark", slug: "mark", sermonCount: 4 },
    { name: "Romans", slug: "romans" }
  ],
  passageVerseAvailability: [
    { bookSlug: "mark", chapter: 12, verses: [30, 28, 29] },
    { bookSlug: "mark", chapter: 10, verses: [23] },
    { bookSlug: "mark", chapter: 12, verses: [28, 31] }
  ]
};

const query = publicSermonListQuerySchema.parse({ page: 1, pageSize: 9 });

describe("canon geometry", () => {
  it("lays the 66 books end to end, one unit per chapter, from the checked-in versification", () => {
    expect(totalChapters).toBe(1189);
    expect(canonSegments).toHaveLength(66);
    expect(canonSegments[0]).toMatchObject({ start: 0, length: 50 });
    const last = canonSegments[65]!;
    expect(last.book.slug).toBe("revelation");
    expect(last.start + last.length).toBe(totalChapters);
    for (let index = 1; index < canonSegments.length; index += 1) {
      expect(canonSegments[index]!.start).toBe(canonSegments[index - 1]!.start + canonSegments[index - 1]!.length);
    }
  });

  it("widens spines by the square root of their chapter count so Psalms stays legible next to Obadiah", () => {
    expect(spineWidthFactor(bibleBookBySlug("psalms")!)).toBe(12.25);
    expect(spineWidthFactor(bibleBookBySlug("obadiah")!)).toBe(1);
    expect(spineWidthFactor(bibleBookBySlug("genesis")!)).toBe(7.07);
  });

  it("letters short and mid-length names in full and falls back to the abbreviation for long names", () => {
    expect(spineLabel(bibleBookBySlug("job")!)).toEqual({ long: "Job", short: "Job", length: "short" });
    expect(spineLabel(bibleBookBySlug("genesis")!).length).toBe("mid");
    const thessalonians = spineLabel(bibleBookBySlug("1-thessalonians")!);
    expect(thessalonians.length).toBe("long");
    expect(thessalonians.short).toBe(bibleBookBySlug("1-thessalonians")!.abbreviation);
  });

  it("derives shelf state only from the repository projection", () => {
    const books = shelfBooks(options);
    expect(books).toHaveLength(66);
    expect(books.filter((item) => item.option)).toHaveLength(2);
    expect(books.find((item) => item.book.slug === "mark")).toMatchObject({ index: 40, count: 4 });
    expect(books.find((item) => item.book.slug === "romans")).toMatchObject({ count: null });
    expect(shelfBooks(emptyFilterOptions).every((item) => item.option === null)).toBe(true);
  });

  it("merges and sorts verse availability per book and chapter", () => {
    const availability = availabilityByBook(options.passageVerseAvailability);
    expect([...availability.get("mark")!.keys()].sort((left, right) => left - right)).toEqual([10, 12]);
    expect(availability.get("mark")!.get(12)).toEqual([28, 29, 30, 31]);
    expect(availability.get("romans")).toBeUndefined();
  });

  it("summarises the library and the transcript from real counts only", () => {
    expect(librarySummary(15, options)).toEqual(["15 sermons", "2 of 66 books", "1 speaker", "1 series"]);
    expect(librarySummary(1, emptyFilterOptions)).toEqual(["1 sermon", "0 of 66 books", "0 speakers", "0 series"]);
    expect(readingStats("One two three.\n\nFour five.")).toEqual({ words: 5, paragraphs: 2, minutes: 1 });
    expect(readingStats(Array.from({ length: 1000 }, () => "word").join(" ")).minutes).toBe(5);
    expect(formatCount(1, "sermon")).toBe("1 sermon");
    expect(formatCount(1234, "sermon")).toBe("1,234 sermons");
  });
});

describe("filter URLs", () => {
  it("adds, replaces and removes legacy-named parameters while dropping the expanded view", () => {
    const base = publicSermonListQuerySchema.parse({ speaker: "example-speaker", view: "recent", page: 1, pageSize: 9 });
    expect(withFilter(base, { sermon_book: "mark" }, publicRenderContext, "canon")).toBe("/sermons/?sermon_speaker=example-speaker&sermon_book=mark#canon");
    expect(withFilter(base, { sermon_speaker: null }, publicRenderContext)).toBe("/sermons/#results");
    expect(withFilter(base, { sermon_series: "example-series" }, previewRenderContext)).toBe("/frontend-preview/sermons/?sermon_speaker=example-speaker&sermon_series=example-series#results");
    const passage = publicSermonListQuerySchema.parse({
      query: "grace",
      book: "mark",
      passageBook: "mark",
      passageChapter: 12,
      passageVerse: 28,
      passageScope: "verse",
      page: 1,
      pageSize: 9
    });
    expect(withoutPassage(passage, publicRenderContext)).toBe("/sermons/?s=grace#results");
    expect(withFilter(passage, { passageVerse: null, passageScope: "chapter" }, publicRenderContext, "canon")).toContain("passageChapter=12&passageScope=chapter#canon");
    expect(withFilter(passage, { passageVerse: null, passageScope: "chapter" }, publicRenderContext, "canon")).not.toContain("passageVerse");
  });

  it("names results after what the visitor asked for", () => {
    expect(resultsTitle(query, options)).toBe("All sermons");
    expect(resultsTitle(publicSermonListQuerySchema.parse({ order: "ASC", page: 1, pageSize: 9 }), options)).toBe("All sermons, oldest first");
    expect(resultsTitle(publicSermonListQuerySchema.parse({ query: "grace", speaker: "example-speaker", page: 1, pageSize: 9 }), options)).toBe("“grace” · Example Speaker");
    expect(resultsTitle(publicSermonListQuerySchema.parse({ book: "mark", page: 1, pageSize: 9 }), options)).toBe("Mark");
    expect(resultsTitle(publicSermonListQuerySchema.parse({ passageBook: "mark", passageChapter: 12, passageScope: "chapter", page: 1, pageSize: 9 }), options)).toBe("Mark 12");
    expect(resultsTitle(publicSermonListQuerySchema.parse({ dateFrom: "2026-01-01", page: 1, pageSize: 9 }), options)).toBe("Sermons by service date");
  });
});

describe("shelf, strip, tab and open book", () => {
  it("renders 66 spines in canonical order, links only preached books and keeps ghosts inert", () => {
    const html = shelf(options, { href: (book) => `/books/${book.slug}/`, skipTo: "after", headingId: "heading", current: "mark" }).toString();
    expect(html.match(/<li class="spine /gu)).toHaveLength(66);
    expect(html.match(/<a class="spine__link"/gu)).toHaveLength(2);
    expect(html.match(/<span class="spine__ghost" aria-hidden="true">/gu)).toHaveLength(64);
    expect(html).toContain('<li class="spine spine--mark spine--gospels-acts is-preached" data-len="short" aria-current="true"><a class="spine__link" href="/books/mark/">');
    expect(html).toContain('<span class="spine__count" aria-hidden="true">4</span>');
    expect(html).toContain('<li class="spine spine--romans spine--pauline is-preached" data-len="short"><a class="spine__link" href="/books/romans/">');
    expect(html).not.toContain('spine--romans spine--pauline is-preached" data-len="short"><a class="spine__link" href="/books/romans/"><span class="spine__name" aria-hidden="true">Romans</span><span class="spine__abbr" aria-hidden="true">Ro</span><span class="spine__count"');
    expect(html.indexOf("spine--genesis")).toBeLessThan(html.indexOf("spine--exodus"));
    expect(html.indexOf("spine--malachi")).toBeLessThan(html.indexOf("New Testament"));
    expect(html.indexOf("New Testament")).toBeLessThan(html.indexOf("spine--matthew"));
    expect(html).toContain('data-canon-grid data-escape-to="after"');
    expect(html).toContain('<a class="shelf__skip" href="#after">Skip the bookshelf</a>');
    expect(html).toContain("preached from 2 of the 66 books: Mark (4), Romans.");
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("aria-pressed");
    for (const book of bibleBooks) expect(html).toContain(`spine--${book.slug} `);
  });

  it("draws the canon strip to scale and marks the current book", () => {
    const html = canonStrip(options, { current: "mark", label: "Mark on the shelf" }).toString();
    expect(html.match(/<rect /gu)).toHaveLength(66);
    expect(html).toContain('viewBox="0 0 1189 14"');
    expect(html.match(/strip__seg--preached/gu)).toHaveLength(2);
    expect(html.match(/ strip__seg--current"/gu)).toHaveLength(1);
    expect(html).toContain('<rect class="strip__seg" x="0" y="4" width="50" height="10" />');
    expect(html).toContain('<p class="strip__label">Mark on the shelf</p>');
    expect(html).toContain('aria-hidden="true" focusable="false"');
    expect(canonStrip(emptyFilterOptions).toString()).not.toContain("strip__seg--preached");
  });

  it("renders the book tab as a link, a plain label or an inert ghost", () => {
    const mark = bibleBookBySlug("mark")!;
    expect(bookTab(mark, { href: "/mark/", count: 4 }).toString()).toBe('<a class="tab hue--gospels-acts" href="/mark/"><span class="tab__name" aria-hidden="true">Mark</span><span class="tab__count" aria-hidden="true">4</span><span class="sr-only">Mark, 4 sermons</span></a>');
    expect(bookTab(mark, { href: null, count: null }).toString()).toBe('<span class="tab hue--gospels-acts"><span class="tab__name" aria-hidden="true">Mark</span><span class="sr-only">Mark</span></span>');
    expect(bookTab(null, { href: null, count: null, ghost: true }).toString()).toContain('class="tab tab--ghost" aria-hidden="true"');
  });

  it("renders chapter and verse rulers whose every cell is a real server search link", () => {
    const html = openBook({
      book: bibleBookBySlug("mark")!,
      query: publicSermonListQuerySchema.parse({ query: "grace", passageBook: "mark", passageChapter: 12, passageVerse: 28, passageScope: "verse", page: 1, pageSize: 9 }),
      options,
      context: publicRenderContext,
      count: 4,
      chapter: 12,
      verse: 28,
      headingLevel: 2
    }).toString();
    expect(html).toContain('<section class="open-book hue--gospels-acts" id="canon" aria-labelledby="open-book-heading">');
    expect(html).toContain('<h2 class="open-book__title" id="open-book-heading">Mark 12:28</h2>');
    expect(html.match(/<span class="sr-only">Chapter \d+/gu)).toHaveLength(16);
    expect(html.match(/<span class="sr-only">Verse \d+/gu)).toHaveLength(44);
    expect(html).toContain('href="/sermons/?s=grace&amp;passageBook=mark&amp;passageChapter=10&amp;passageScope=chapter#canon"');
    expect(html).toContain('<span class="sr-only">Chapter 10, has sermons</span>');
    expect(html).toContain('<span class="sr-only">Chapter 12, has sermons, current search</span>');
    expect(html).toContain('<span class="sr-only">Chapter 1</span>');
    expect(html).toContain('href="/sermons/?s=grace&amp;passageBook=mark&amp;passageChapter=12&amp;passageVerse=31&amp;passageScope=verse#canon"');
    expect(html).toContain('<span class="sr-only">Verse 28, has sermons, current search</span>');
    expect(html).toContain('<span class="sr-only">Verse 44</span>');
    expect(html).toContain("Chapters with sermons: 10, 12");
    expect(html).toContain('href="/sermons/?s=grace&amp;passageBook=mark&amp;passageScope=book#canon">Search all of Mark</a>');
    expect(html).toContain('<a class="open-book__clear" href="/sermons/?s=grace#results">Put the book back</a>');
    expect(html.match(/aria-current="true"/gu)).toHaveLength(2);
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("aria-pressed");
    expect(html.match(/data-canon-grid/gu)).toHaveLength(2);

    const broad = openBook({ book: bibleBookBySlug("romans")!, query, options, context: previewRenderContext, count: null, headingLevel: 1, broad: true }).toString();
    expect(broad).toContain('<h1 class="open-book__title" id="open-book-heading">Romans</h1>');
    expect(broad).toContain('<p class="eyebrow">Sermons filed under</p>');
    expect(broad).toContain('<span class="tab hue--pauline"><span class="tab__name" aria-hidden="true">Romans</span>');
    expect(broad).not.toContain("Verses of");
    expect(broad).toContain('href="/frontend-preview/sermons/?passageBook=romans&amp;passageScope=book#canon">Search all of Romans</a>');
  });
});

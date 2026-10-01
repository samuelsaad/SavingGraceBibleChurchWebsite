/**
 * The Canon's signature components: the 66-book shelf, the to-scale canon
 * strip, the book tab, and the open-book chapter and verse rulers.
 *
 * Every spine, cell and control is an ordinary link that performs its search
 * on the server, so the whole passage flow works without JavaScript. The
 * canon enhancement only adds roving keyboard focus and announcements.
 */
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { bibleBookCategories, bibleBooks, type BibleBookDefinition } from "../../domain/bible-passage";
import type { PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { availabilityByBook, canonSegments, categoryLabel, formatCount, shelfBooks, spineLabel, totalChapters } from "../canon";
import { attribute, html, raw, when, type Html } from "../html";
import { archiveTarget, type ArchiveTarget, type FrontendRenderContext, withFilter, withoutPassage } from "../routes";

export interface ShelfOptions {
  /** Destination for a preached book. */
  href: (book: BibleBookDefinition) => string;
  /** Book slug shown as the current selection. */
  current?: string | undefined;
  /** Runs the one-time settle animation on first paint. */
  settle?: boolean;
  /** Identifier for the skip-link target that follows the shelf. */
  skipTo: string;
  /** Optional caption row rendered under the shelf. */
  caption?: Html | null;
  headingId: string;
}

function preachedSentence(options: PublicSermonFilterOptions): string {
  const books = shelfBooks(options).filter((item) => item.option);
  if (!books.length) return "No sermons have been shelved yet.";
  const list = books.map((item) => `${item.book.canonicalName}${item.count === null ? "" : ` (${item.count})`}`).join(", ");
  return `Sermons in this archive have been preached from ${books.length} of the ${bibleBooks.length} books: ${list}.`;
}

/** The bookshelf: 66 spines in canonical order, preached books pulled forward. */
export function shelf(options: PublicSermonFilterOptions, shelfOptions: ShelfOptions): Html {
  const books = shelfBooks(options);
  const items: Html[] = [];
  items.push(html`<li class="bookend" aria-hidden="true"><span class="bookend__long">Old Testament</span><span class="bookend__short">OT</span></li>`);
  for (const item of books) {
    if (item.book.id === 40) items.push(html`<li class="bookend" aria-hidden="true"><span class="bookend__long">New Testament</span><span class="bookend__short">NT</span></li>`);
    const label = spineLabel(item.book);
    const group = categoryLabel(item.book.category);
    const current = shelfOptions.current === item.book.slug;
    const lettering = html`<span class="spine__name" aria-hidden="true">${label.long}</span><span class="spine__abbr" aria-hidden="true">${label.short}</span>`;
    items.push(item.option
      ? html`<li class="spine spine--${item.book.slug} spine--${item.book.category} is-preached" data-len="${label.length}"${attribute("aria-current", current ? "true" : null)}><a class="spine__link" href="${shelfOptions.href(item.book)}">${lettering}${when(item.count !== null, () => html`<span class="spine__count" aria-hidden="true">${item.count}</span>`)}<span class="sr-only">${item.book.canonicalName}, ${item.count === null ? "sermons available" : formatCount(item.count, "sermon")}, ${group}${current ? ", current book" : ""}</span></a></li>`
      : html`<li class="spine spine--${item.book.slug} spine--${item.book.category}" data-len="${label.length}"><span class="spine__ghost" aria-hidden="true">${lettering}</span></li>`);
  }
  return html`<nav class="shelf${shelfOptions.settle ? " shelf--settle" : ""}" aria-labelledby="${shelfOptions.headingId}" data-canon-grid data-escape-to="${shelfOptions.skipTo}">
    <p class="sr-only">${preachedSentence(options)} Books without sermons are shown as outlines and are not links.</p>
    <a class="shelf__skip" href="#${shelfOptions.skipTo}">Skip the bookshelf</a>
    <ol class="shelf__row" role="list">${items}</ol>
    ${shelfOptions.caption}
  </nav>`;
}

/** The legend of literary groups used by the shelf hues. */
export function shelfLegend(): Html {
  return html`<ul class="legend" role="list" aria-label="Literary groups on the shelf">${bibleBookCategories.map((category) => html`<li class="hue--${category.key}"><span class="legend__swatch" aria-hidden="true"></span>${category.label}</li>`)}</ul>`;
}

export interface StripOptions {
  /** Book slug to mark. */
  current?: string | undefined;
  label?: string | undefined;
  className?: string;
}

/** The whole Bible to scale, one unit per chapter, preached books in their hue. */
export function canonStrip(options: Pick<PublicSermonFilterOptions, "books">, strip: StripOptions = {}): Html {
  const preached = new Set(options.books.map((book) => book.slug));
  const height = strip.current ? 14 : 10;
  const segments = canonSegments.map((segment) => {
    const cls = preached.has(segment.book.slug) ? `hue--${segment.book.category} strip__seg strip__seg--preached` : "strip__seg";
    const isCurrent = segment.book.slug === strip.current;
    return `<rect class="${cls}${isCurrent ? " strip__seg--current" : ""}" x="${segment.start}" y="${isCurrent ? 0 : 4}" width="${segment.length}" height="${isCurrent ? height : height - 4}" />`;
  }).join("");
  const svg = `<svg class="strip${strip.current ? " strip--marked" : ""}${strip.className ? ` ${strip.className}` : ""}" viewBox="0 0 ${totalChapters} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${segments}</svg>`;
  return html`${raw(svg)}${when(strip.label, () => html`<p class="strip__label">${strip.label}</p>`)}`;
}

export interface TabOptions {
  href: string | null;
  count: number | null;
  ghost?: boolean;
  className?: string;
}

/** A single book pulled from the shelf. */
export function bookTab(book: BibleBookDefinition | null, tab: TabOptions): Html {
  if (!book || tab.ghost) {
    return html`<span class="tab tab--ghost${tab.className ? ` ${tab.className}` : ""}" aria-hidden="true"><span class="tab__name">—</span></span>`;
  }
  const inner = html`<span class="tab__name" aria-hidden="true">${book.canonicalName}</span>${when(tab.count !== null, () => html`<span class="tab__count" aria-hidden="true">${tab.count}</span>`)}<span class="sr-only">${book.canonicalName}${tab.count === null ? "" : `, ${formatCount(tab.count, "sermon")}`}</span>`;
  return tab.href
    ? html`<a class="tab hue--${book.category}${tab.className ? ` ${tab.className}` : ""}" href="${tab.href}">${inner}</a>`
    : html`<span class="tab hue--${book.category}${tab.className ? ` ${tab.className}` : ""}">${inner}</span>`;
}

/** Explicit topical classification only; Scripture remains elsewhere in the card. */
export function topicalTab(): Html {
  return html`<span class="tab hue--topical"><span class="tab__name" aria-hidden="true">Topical</span><span class="sr-only">Topical</span></span>`;
}

export interface OpenBookInput {
  book: BibleBookDefinition;
  query: PublicSermonListQuery;
  options: PublicSermonFilterOptions;
  context: FrontendRenderContext;
  /** Sermon count for the tab sticker, when known. */
  count: number | null;
  chapter?: number | undefined;
  verse?: number | undefined;
  /** Heading level for the book name. */
  headingLevel: 1 | 2 | 3;
  /** Whether the panel is scoped by the broad classification rather than a passage. */
  broad?: boolean;
  /** The presentation that receives chapter and verse searches; the archive by default. */
  target?: ArchiveTarget;
  /** Opt-in sermon presentation; every other caller keeps Astra's composition. */
  presentation?: "claude";
}

/** The open book: tab, chapter ruler and, once a chapter is chosen, the verse ruler. */
export function openBook(input: OpenBookInput): Html {
  const { book, query, options, context } = input;
  const target = input.target ?? archiveTarget;
  const availability = availabilityByBook(options.passageVerseAvailability).get(book.slug) ?? new Map<number, number[]>();
  const heading = `h${input.headingLevel}`;
  const wholeBook = withFilter(query, { passageBook: book.slug, passageChapter: null, passageVerse: null, passageEndVerse: null, passageScope: "book", sermon_book: null }, context, "canon", target.path);
  const chapterCells = Array.from({ length: book.chapterCount }, (_, index) => index + 1).map((chapter) => {
    const verses = availability.get(chapter);
    const current = chapter === input.chapter;
    const href = withFilter(query, { passageBook: book.slug, passageChapter: String(chapter), passageVerse: null, passageEndVerse: null, passageScope: "chapter", sermon_book: null }, context, "canon", target.path);
    return html`<li><a class="ruler__cell hue--${book.category}${verses ? " is-marked" : ""}" href="${href}"${attribute("aria-current", current ? "true" : null)}><span aria-hidden="true">${chapter}</span><span class="sr-only">Chapter ${chapter}${verses ? ", has sermons" : ""}${current ? ", current search" : ""}</span></a></li>`;
  });
  const verseCells = input.chapter !== undefined
    ? Array.from({ length: book.verseCounts[input.chapter - 1] ?? 0 }, (_, index) => index + 1).map((verse) => {
      const covered = availability.get(input.chapter!)?.includes(verse) ?? false;
      const current = verse === input.verse;
      const href = withFilter(query, { passageBook: book.slug, passageChapter: String(input.chapter), passageVerse: String(verse), passageEndVerse: null, passageScope: "verse", sermon_book: null }, context, "canon", target.path);
      return html`<li><a class="ruler__cell hue--${book.category}${covered ? " is-marked" : ""}" href="${href}"${attribute("aria-current", current ? "true" : null)}><span aria-hidden="true">${verse}</span><span class="sr-only">Verse ${verse}${covered ? ", has sermons" : ""}${current ? ", current search" : ""}</span></a></li>`;
    })
    : [];
  const markedChapters = [...availability.keys()].sort((left, right) => left - right);
  const scopeLabel = input.chapter !== undefined && input.verse !== undefined
    ? `${book.canonicalName} ${input.chapter}:${input.verse}`
    : input.chapter !== undefined ? `${book.canonicalName} ${input.chapter}` : book.canonicalName;
  return html`<section class="open-book hue--${book.category}" id="canon" aria-labelledby="open-book-heading">
    ${bookTab(book, { href: input.broad ? null : wholeBook, count: input.count })}
    <div class="open-book__body">
      ${when(input.presentation === "claude", () => html`<p class="eyebrow">${input.broad ? "Sermons filed under" : "Preached from"}</p>`)}
      <${heading} class="open-book__title" id="open-book-heading">${scopeLabel}</${heading}>
      ${when(input.presentation !== "claude", () => html`<p class="title-page__category">${input.broad ? "Sermons filed under" : "Preached from"}</p>`)}
      <p class="open-book__meta">
        ${when(input.count !== null, () => html`<span>${formatCount(input.count!, "sermon")} in ${book.canonicalName}</span>`)}
        ${when(markedChapters.length, () => html`<span>Chapters with sermons: ${markedChapters.join(", ")}</span>`)}
        ${when(input.chapter !== undefined || input.broad, () => html`<a href="${wholeBook}">Search all of ${book.canonicalName}</a>`)}
      </p>
      <div class="ruler-block">
        <p class="ruler-block__label" id="chapter-ruler-label"><span>Chapters</span><a class="ruler-block__skip" id="skip-chapters" href="#after-chapters">Skip chapter list</a></p>
        <ol class="ruler" role="list" aria-labelledby="chapter-ruler-label" data-canon-grid data-escape-to="skip-chapters">${chapterCells}</ol>
        <p class="ruler__note" id="after-chapters">A filled chapter has a sermon preached from it. Any chapter can be searched; unmarked chapters simply have none recorded yet.</p>
      </div>
      ${when(input.chapter !== undefined, () => html`<div class="ruler-block">
        <p class="ruler-block__label" id="verse-ruler-label"><span>Verses of ${book.canonicalName} ${input.chapter}</span><a class="ruler-block__skip" id="skip-verses" href="#after-verses">Skip verse list</a></p>
        <ol class="ruler" role="list" aria-labelledby="verse-ruler-label" data-canon-grid data-escape-to="skip-verses">${verseCells}</ol>
        <p class="ruler__note" id="after-verses">Choosing a verse searches that exact verse.</p>
      </div>`)}
      <a class="open-book__clear" href="${withoutPassage(query, context, target.fragment, target.path)}">Put the book back</a>
    </div>
  </section>`;
}

/** The shelf folded into a native disclosure, for pages where it is secondary. */
export function shelfDetails(shelfHtml: Html, label = "Choose a Bible book"): Html {
  return html`<details class="book-details"><summary class="book-details__summary">${label}</summary>${shelfHtml}</details>`;
}

/** The full canon as text: name, group, chapters, sermons. */
export function canonTable(options: PublicSermonFilterOptions, href: (book: BibleBookDefinition) => string): Html {
  const books = shelfBooks(options);
  return html`<div class="canon-table-wrap"><table class="canon-table">
    <caption class="sr-only">The 66 books of the Bible with sermon counts</caption>
    <thead><tr><th scope="col">Book</th><th scope="col">Group</th><th scope="col" class="num">Chapters</th><th scope="col" class="num">Sermons</th></tr></thead>
    <tbody>${books.map((item) => html`<tr><td>${item.option ? html`<a href="${href(item.book)}">${item.book.canonicalName}</a>` : item.book.canonicalName}</td><td>${categoryLabel(item.book.category)}</td><td class="num">${item.book.chapterCount}</td><td class="num">${item.option ? (item.count ?? "yes") : "—"}</td></tr>`)}</tbody>
  </table></div>`;
}

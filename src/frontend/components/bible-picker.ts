/**
 * Books → Chapters → Verses passage picker.
 *
 * Every tile and "Search all of …" control is a real link that performs the
 * corresponding search on the server, so the picker works without
 * JavaScript. The archive enhancement upgrades single activation to
 * reveal-only, adds roving focus, announcements and mobile Back controls.
 * Chapter and verse counts come from the checked-in canonical versification;
 * no external Bible service is contacted.
 */
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import {
  bibleBookBySlug,
  bibleBookCategories,
  bibleBooks,
  passageQueryLabel,
  type BibleBookCategory,
  type BibleBookDefinition
} from "../../domain/bible-passage";
import { attribute, html, when, type Html } from "../html";
import {
  archivePath,
  contextualPath,
  effectivePassageScope,
  passageClearUrl,
  standardizedFilterParameters,
  type FrontendRenderContext,
  type PassageSearchScope
} from "../routes";

const resultsFragment = "#sermon-results";

function categoryLabel(category: BibleBookCategory): string {
  return bibleBookCategories.find((item) => item.key === category)?.label ?? category;
}

/** Archive URL carrying every non-passage filter, ready for passage parameters. */
export function passageUrlBase(query: PublicSermonListQuery, context: FrontendRenderContext): string {
  const parameters = standardizedFilterParameters(query);
  for (const name of ["passageBook", "passageChapter", "passageVerse", "passageEndVerse", "passageScope", "sermon_book", "view"]) {
    parameters.delete(name);
  }
  const base = contextualPath(context, archivePath);
  return parameters.size ? `${base}?${parameters.toString()}` : base;
}

function passageUrl(base: string, parameters: Record<string, string>): string {
  return `${base}${base.includes("?") ? "&" : "?"}${new URLSearchParams(parameters).toString()}${resultsFragment}`;
}

function bookTile(book: BibleBookDefinition, base: string, selected: boolean, applied: boolean): Html {
  return html`<a class="bible-tile bible-tile--${book.category}" href="${passageUrl(base, { passageBook: book.slug, passageScope: "book" })}" data-book-tile data-book="${book.slug}" data-book-name="${book.canonicalName}" data-chapters="${book.chapterCount}" data-verse-counts="${book.verseCounts.join(",")}" data-applied="${String(applied)}"${attribute("aria-current", selected ? "true" : null)}><span class="bible-tile__label">${book.abbreviation}</span><span class="sr-only">, ${book.canonicalName}, ${categoryLabel(book.category)}${applied ? ", current search" : ""}</span></a>`;
}

function numberTile(
  kind: "chapter" | "verse",
  number: number,
  href: string,
  accessiblePrefix: string,
  selected: boolean,
  applied: boolean
): Html {
  return html`<a class="bible-tile bible-tile--number" href="${href}" data-${kind}-tile data-${kind}="${number}" data-applied="${String(applied)}"${attribute("aria-current", selected ? "true" : null)}><span class="bible-tile__label">${number}</span><span class="sr-only">, ${accessiblePrefix} ${number}${applied ? ", current search" : ""}</span></a>`;
}

function actionLink(dataAttribute: string, href: string | null, label: string): Html {
  return html`<p class="passage-panel__action"><a class="button button--secondary"${attribute("href", href)}${attribute("aria-disabled", href ? null : "true")} ${dataAttribute}>${label}</a></p>`;
}

export interface BiblePickerState {
  book: BibleBookDefinition | null;
  chapter: number | undefined;
  verse: number | undefined;
  scope: PassageSearchScope | null;
  label: string | null;
  depth: "book" | "chapter" | "verse";
}

export function biblePickerState(query: PublicSermonListQuery): BiblePickerState {
  const book = query.passageBook ? bibleBookBySlug(query.passageBook) : null;
  return {
    book,
    chapter: query.passageChapter,
    verse: query.passageVerse,
    scope: effectivePassageScope(query),
    label: passageQueryLabel(query),
    depth: query.passageChapter !== undefined ? "verse" : book ? "chapter" : "book"
  };
}

const scopeLabels: Record<PassageSearchScope, string> = {
  book: "whole book",
  chapter: "whole chapter",
  verse: "exact verse"
};

/** The picker body. Rendered inside the archive form so its hidden inputs submit with it. */
export function biblePicker(query: PublicSermonListQuery, context: FrontendRenderContext): Html {
  const state = biblePickerState(query);
  const base = passageUrlBase(query, context);
  const selectedSlug = state.book?.slug;
  const appliedSlug = state.scope ? selectedSlug : undefined;
  const chapterCount = state.book?.chapterCount ?? 0;
  const verseCount = state.book && state.chapter !== undefined ? state.book.verseCounts[state.chapter - 1] ?? 0 : 0;
  const appliedChapter = state.scope === "chapter" || state.scope === "verse" ? state.chapter : undefined;
  const appliedVerse = state.scope === "verse" ? state.verse : undefined;
  const bookName = state.book?.canonicalName ?? "";
  const wholeBookHref = state.book ? passageUrl(base, { passageBook: state.book.slug, passageScope: "book" }) : null;
  const wholeChapterHref = state.book && state.chapter !== undefined
    ? passageUrl(base, { passageBook: state.book.slug, passageChapter: String(state.chapter), passageScope: "chapter" })
    : null;

  const chapterTiles = state.book
    ? Array.from({ length: chapterCount }, (_, index) => index + 1).map((number) => numberTile(
      "chapter",
      number,
      passageUrl(base, { passageBook: state.book!.slug, passageChapter: String(number), passageScope: "chapter" }),
      `${bookName} chapter`,
      number === state.chapter,
      number === appliedChapter
    ))
    : [];
  const verseTiles = state.book && state.chapter !== undefined
    ? Array.from({ length: verseCount }, (_, index) => index + 1).map((number) => numberTile(
      "verse",
      number,
      passageUrl(base, { passageBook: state.book!.slug, passageChapter: String(state.chapter), passageVerse: String(number), passageScope: "verse" }),
      `${bookName} ${state.chapter} verse`,
      number === state.verse,
      number === appliedVerse
    ))
    : [];

  return html`<div class="passage-picker" data-bible-picker data-depth="${state.depth}" data-mobile-panel="${state.depth}" data-passage-url="${base}">
    <p class="passage-picker__hint" id="passage-picker-hint">Choose a book to see its chapters, then a chapter to see its verses. Use <strong>Search all of …</strong> to search a whole book or chapter, or choose a verse to search that verse. Results use the reviewed passage each sermon was preached from.<span class="sr-only"> Arrow keys move between tiles; Enter chooses a tile.</span></p>
    <input id="passage-book" name="passageBook" type="hidden" value="${query.passageBook ?? ""}"${attribute("disabled", !query.passageBook)} />
    <input id="passage-chapter" name="passageChapter" type="hidden" value="${query.passageChapter ?? ""}"${attribute("disabled", query.passageChapter === undefined)} />
    <input id="passage-verse" name="passageVerse" type="hidden" value="${query.passageVerse ?? ""}"${attribute("disabled", query.passageVerse === undefined)} />
    <input id="passage-scope" name="passageScope" type="hidden" value="${state.scope ?? ""}"${attribute("disabled", !state.scope)} />
    <div class="passage-picker__panels">
      <div class="passage-panel passage-panel--books" data-books-panel>
        <div class="passage-panel__head"><h3 id="bible-books-heading">Books</h3></div>
        <div class="tile-grid tile-grid--books" data-tile-grid="book" role="group" aria-labelledby="bible-books-heading" aria-describedby="passage-picker-hint">${bibleBooks.map((book) => bookTile(book, base, book.slug === selectedSlug, book.slug === appliedSlug))}</div>
        ${actionLink("data-search-whole-book", wholeBookHref, state.book ? `Search all of ${bookName}` : "Search a whole book")}
        <details class="passage-key"><summary aria-expanded="false">Book colour key</summary><ul class="passage-key__list" role="list" aria-label="Bible book colour categories">${bibleBookCategories.map((category) => html`<li class="passage-key__item passage-key__item--${category.key}"><span class="passage-key__swatch" aria-hidden="true"></span>${category.label}</li>`)}</ul></details>
      </div>
      <div class="passage-panel passage-panel--chapters" data-chapters-panel${attribute("hidden", !state.book)}>
        <button class="passage-panel__back" type="button" data-back-to-books><span aria-hidden="true">←</span> Back to books</button>
        <div class="passage-panel__head"><h3 id="bible-chapters-heading">Chapters</h3><p class="passage-panel__selection" data-book-selection>${bookName}</p></div>
        <div class="tile-grid tile-grid--numbers" data-tile-grid="chapter" role="group" aria-labelledby="bible-chapters-heading">${chapterTiles}</div>
        ${actionLink("data-search-whole-chapter", wholeChapterHref, state.book && state.chapter !== undefined ? `Search all of ${bookName} ${state.chapter}` : "Search a whole chapter")}
      </div>
      <div class="passage-panel passage-panel--verses" data-verses-panel${attribute("hidden", state.chapter === undefined)}>
        <button class="passage-panel__back" type="button" data-back-to-chapters><span aria-hidden="true">←</span> Back to chapters</button>
        <div class="passage-panel__head"><h3 id="bible-verses-heading">Verses</h3><p class="passage-panel__selection" data-chapter-selection>${state.book && state.chapter !== undefined ? `${bookName} ${state.chapter}` : ""}</p></div>
        <div class="tile-grid tile-grid--numbers" data-tile-grid="verse" role="group" aria-labelledby="bible-verses-heading">${verseTiles}</div>
        <p class="passage-panel__note">Choosing a verse searches that exact verse.</p>
      </div>
    </div>
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-passage-announcement></p>
    ${when(state.scope && state.label, () => html`<p class="passage-picker__current">Current passage search: <strong>${state.label}</strong> (${scopeLabels[state.scope!]}) · <a href="${passageClearUrl(query, context)}">Clear passage</a></p>`)}
  </div>`;
}

export function passageBadgeLabel(query: PublicSermonListQuery): string | null {
  const state = biblePickerState(query);
  return state.scope && state.label ? state.label : null;
}

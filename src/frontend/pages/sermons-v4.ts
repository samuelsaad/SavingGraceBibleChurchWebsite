/**
 * SermonsV4: Claude's final opening presentation with the current finder,
 * the bookshelf folded behind a labelled disclosure and collapsed on
 * first load, and the sermon list as an equal-size card grid whose first
 * card is the latest sermon. Searches, filters and pagination stay inside
 * V4; every control is a server link or form so the page works without
 * JavaScript.
 */
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { bibleBookBySlug } from "../../domain/bible-passage";
import { formatCount, librarySummary } from "../canon";
import { cardGrid } from "../components/cards";
import { claudeSermonTitle as titlePage } from "../components/claude-sermon-title";
import { finder } from "../components/search";
import { pagination, sectionHead, sectionNote } from "../components/sections";
import { canonStrip, openBook, shelf } from "../components/shelf";
import { html, when, type Html } from "../html";
import type { SermonArchivePageInput } from "./archive";
import { resultsTitle } from "./archive";
import {
  archivePagePath,
  contextualPath,
  hasActiveSermonFilters,
  isExpandedRecentView,
  publicRenderContext,
  sermonsV4Path,
  sermonsV4Target,
  siteLinks,
  withFilter,
  type ArchiveTarget,
  type FrontendRenderContext
} from "../routes";
import { pageShell } from "../shell";

const archiveDescription = "Browse sermons from Saving Grace Bible Church by speaker, series, Scripture, Bible book, or service date.";

function resultsEyebrow(query: PublicSermonListQuery): string {
  const dimensions = [query.query, query.speaker, query.series, query.book && !query.passageBook, query.passageBook, query.passage].filter(Boolean).length;
  if (dimensions !== 1) return "Search results";
  if (query.passageBook) return "Preached from";
  if (query.book) return "Sermons filed under";
  if (query.speaker) return "Sermons by";
  if (query.series) return "Sermons in the series";
  if (query.query) return "Results for";
  return "Search results";
}

/** The bookshelf folded behind a compact, labelled disclosure; closed on first load. */
export function shelfFold(input: SermonArchivePageInput, context: FrontendRenderContext, skipTo: string, target: ArchiveTarget = sermonsV4Target, prefix = "v4"): Html {
  const preached = input.options.books.length;
  const shelfHtml = shelf(input.options, {
    href: (book) => withFilter(input.query, { sermon_book: book.slug, passageBook: null, passageChapter: null, passageVerse: null, passageEndVerse: null, passageScope: null }, context, "canon", target.path),
    settle: true,
    skipTo,
    headingId: `${prefix}-shelf-heading`
  });
  return html`<section class="fold-section" aria-labelledby="${prefix}-shelf-heading">
    <details class="fold" id="${prefix}-shelf" data-fold>
      <summary class="fold__summary">
        <span class="fold__chevron" aria-hidden="true"></span>
        <span class="fold__label"><span class="fold__title" id="${prefix}-shelf-heading">Browse by Bible book</span><span class="fold__hint">${preached ? `${formatCount(preached, "book")} with sermons · take one off the shelf` : "No sermons have been shelved yet"}</span></span>
        <span class="fold__strip">${canonStrip(input.options)}</span>
      </summary>
      <div class="fold__body">
        ${shelfHtml}
      </div>
    </details>
    <span id="${skipTo}" tabindex="-1"></span>
  </section>`;
}

function discoveryView(input: SermonArchivePageInput, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`${shelfFold(input, context, "after-v4-shelf")}
  <section class="section" aria-labelledby="v4-latest-heading">
    ${sectionHead("v4-latest-heading", "Latest sermons", when(input.totalItems > 0, () => html`<a href="${contextualPath(context, sermonsV4Path)}?view=recent#v4-results">Browse all ${formatCount(input.totalItems, "sermon")}, newest first</a>`))}
    ${input.sermons.length
      ? cardGrid(input.sermons, { links, headingLevel: 3, latestFirst: true })
      : sectionNote("No sermons are available yet.")}
  </section>`;
}

function bookPanel(input: SermonArchivePageInput, context: FrontendRenderContext): Html | null {
  const slug = input.query.passageBook ?? input.query.book;
  const book = slug ? bibleBookBySlug(slug) : null;
  if (!book) return null;
  const count = input.options.books.find((item) => item.slug === book.slug)?.sermonCount ?? null;
  return openBook({
    book,
    query: input.query,
    options: input.options,
    context,
    count,
    chapter: input.query.passageChapter,
    verse: input.query.passageVerse,
    headingLevel: 2,
    broad: !input.query.passageBook,
    target: sermonsV4Target,
    presentation: "claude"
  });
}

function resultsView(input: SermonArchivePageInput, context: FrontendRenderContext, totalPages: number): Html {
  const links = siteLinks(context);
  const filtered = hasActiveSermonFilters(input.query);
  const expandedRecent = isExpandedRecentView(input.query);
  const status = `${formatCount(input.totalItems, "sermon")}${totalPages > 1 ? ` · Page ${input.query.page} of ${totalPages}` : ""}`;
  const panel = bookPanel(input, context);
  const ordinalStart = (input.query.page - 1) * input.query.pageSize + 1;
  const list = input.sermons.length
    ? cardGrid(input.sermons, { links, headingLevel: 3, ordinalStart, className: "cards results__cards" })
    : html`<div class="empty">
        <p class="empty__title">${context.mode === "public" ? "No published sermons matched" : "No sermons on this shelf yet"}</p>
        <p>Try removing a filter, or take a different book off the shelf.</p>
        <p><a class="button button--outline" href="${contextualPath(context, sermonsV4Path)}">Show all sermons</a></p>
        ${canonStrip(input.options, { label: "Where sermons have been preached from" })}
      </div>`;
  return html`${panel ?? shelfFold(input, context, "v4-results")}
  <section class="results" id="v4-results" tabindex="-1" aria-labelledby="v4-results-heading v4-results-status">
    <div class="section__head">
      <h2 id="v4-results-heading" class="section__title">${filtered ? "Sermons" : "All sermons, newest first"}</h2>
      <div class="section__aside"><span class="results__status" id="v4-results-status">${status}</span>${when(expandedRecent && !filtered, () => html` <a class="results__fewer" href="${contextualPath(context, sermonsV4Path)}">Back to the latest sermons</a>`)}</div>
    </div>
    ${list}
    ${pagination(input.query, totalPages, context, expandedRecent, sermonsV4Target)}
  </section>`;
}

export function renderSermonsV4Page(
  input: SermonArchivePageInput,
  context: FrontendRenderContext = publicRenderContext
): string {
  const totalPages = Math.ceil(input.totalItems / input.query.pageSize);
  const filtered = hasActiveSermonFilters(input.query);
  const discovery = !filtered && !isExpandedRecentView(input.query) && input.query.page === 1;
  const links = siteLinks(context);
  // The complete V2 opening section: eyebrow, display title, library summary.
  const head = discovery
    ? titlePage({
      eyebrow: "Sermon archive",
      title: "Sermons",
      meta: input.totalItems > 0
        ? html`<ul class="stats" role="list">${librarySummary(input.totalItems, input.options).map((item) => html`<li>${item}</li>`)}</ul>`
        : html`<span>No sermons are available yet.</span>`
    })
    : titlePage({
      eyebrow: filtered ? resultsEyebrow(input.query) : "Sermon archive",
      title: filtered ? resultsTitle(input.query, input.options) : "All sermons",
      trail: [{ href: links.sermonsV4, label: "Sermons" }],
      longThreshold: 34
    });
  return pageShell({
    title: filtered ? resultsTitle(input.query, input.options) : "Sermons",
    description: archiveDescription,
    canonicalPath: archivePagePath(input.query.page, publicRenderContext),
    navigationPath: sermonsV4Path,
    robots: "noindex, follow",
    styles: ["shelf", "cards", "v4", "claudeSermons"],
    scripts: ["canon"],
    books: input.options.books,
    mastheadSearch: false,
    body: html`<div class="claude-sermons"><div class="v4">${head}${finder({ query: input.query, options: input.options, context, target: sermonsV4Target })}${discovery ? discoveryView(input, context) : resultsView(input, context, totalPages)}</div></div>`
  }, context);
}

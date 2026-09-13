/**
 * The sermon archive: the finder, then either the discovery view (shelf,
 * latest three, speakers and series, browse-all) or a results view (tokens,
 * the open book when a book is in scope, a continuously numbered list and
 * pagination). Search and filter state lives entirely in the URL.
 */
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { bibleBookBySlug, passageQueryLabel } from "../../domain/bible-passage";
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOptions, PublicSeriesRepresentative } from "../../server/repositories/sermon-repository";
import { formatCount, librarySummary } from "../canon";
import { catalogue, chips } from "../components/catalogue";
import { finder } from "../components/search";
import { pagination, sectionHead, sectionNote, titlePage } from "../components/sections";
import { canonStrip, openBook, shelf, shelfDetails } from "../components/shelf";
import { html, when, type Html } from "../html";
import {
  archivePagePath,
  archivePath,
  contextualPath,
  hasActiveSermonFilters,
  isExpandedRecentView,
  publicRenderContext,
  siteLinks,
  withFilter,
  type FrontendRenderContext
} from "../routes";
import { pageShell } from "../shell";

export interface SermonArchivePageInput {
  sermons: SermonSummary[];
  totalItems: number;
  query: PublicSermonListQuery;
  options: PublicSermonFilterOptions;
  topicalSermons: SermonSummary[];
  seriesRepresentatives: PublicSeriesRepresentative[];
  hasQueryParameters: boolean;
}

const archiveDescription = "Browse published sermons from Saving Grace Bible Church by speaker, series, Scripture, Bible book, or service date.";

function optionName(items: Array<{ name: string; slug: string }>, slug: string): string {
  return items.find((item) => item.slug === slug)?.name ?? slug;
}

/** A heading that names what the visitor asked for. */
export function resultsTitle(query: PublicSermonListQuery, options: PublicSermonFilterOptions): string {
  const dimensions = [
    query.query ? `“${query.query}”` : null,
    query.speaker ? optionName(options.speakers, query.speaker) : null,
    query.series ? optionName(options.series, query.series) : null,
    query.book && !query.passageBook ? optionName(options.books, query.book) : null,
    passageQueryLabel(query),
    query.passage ? optionName(options.passages, query.passage) : null
  ].filter((item): item is string => item !== null);
  if (dimensions.length === 1) return dimensions[0]!;
  if (dimensions.length > 1) return dimensions.join(" · ");
  if (query.dateFrom || query.dateTo) return "Sermons by service date";
  return query.order === "ASC" ? "All sermons, oldest first" : "All sermons";
}

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

function discoveryView(input: SermonArchivePageInput, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  const latest = input.sermons.slice(0, 3);
  return html`<section class="section" aria-labelledby="shelf-heading">
    ${sectionHead("shelf-heading", "By Bible book", html`<span>Take a book off the shelf to see its sermons.</span>`)}
    ${shelf(input.options, { href: (book) => withFilter(input.query, { sermon_book: book.slug }, context, "canon"), settle: true, skipTo: "after-shelf", headingId: "shelf-heading" })}
    <span id="after-shelf" tabindex="-1"></span>
  </section>
  <section class="section" aria-labelledby="latest-heading">
    ${sectionHead("latest-heading", "Latest sermons", when(input.totalItems > 0, () => html`<a href="${contextualPath(context, archivePath)}?view=recent#results">Browse all ${formatCount(input.totalItems, "sermon")}, newest first</a>`))}
    ${latest.length
      ? catalogue(latest, { variant: "card", headingLevel: 3, links, className: "catalogue catalogue--cards" })
      : sectionNote("No sermons are available yet.")}
  </section>
  ${when(input.options.speakers.length, () => html`<section class="section" aria-labelledby="speakers-heading">
    ${sectionHead("speakers-heading", "By speaker")}
    ${chips(input.options.speakers, (slug) => withFilter(input.query, { sermon_speaker: slug }, context))}
  </section>`)}
  ${when(input.options.series.length, () => html`<section class="section" aria-labelledby="series-heading">
    ${sectionHead("series-heading", "By series")}
    ${chips(input.options.series, (slug) => withFilter(input.query, { sermon_series: slug }, context))}
  </section>`)}
  ${when(input.topicalSermons.length, () => html`<section class="section" aria-labelledby="topical-heading">
    ${sectionHead("topical-heading", "Topical sermons")}
    ${catalogue(input.topicalSermons, { variant: "row", headingLevel: 3, links })}
  </section>`)}`;
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
    broad: !input.query.passageBook
  });
}

function resultsView(input: SermonArchivePageInput, context: FrontendRenderContext, totalPages: number): Html {
  const links = siteLinks(context);
  const filtered = hasActiveSermonFilters(input.query);
  const expandedRecent = isExpandedRecentView(input.query);
  const status = `${formatCount(input.totalItems, "sermon")}${totalPages > 1 ? ` · Page ${input.query.page} of ${totalPages}` : ""}`;
  const panel = bookPanel(input, context);
  const list = input.sermons.length
    ? catalogue(input.sermons, { variant: "row", headingLevel: 3, links, className: "catalogue results__list", ordinalStart: (input.query.page - 1) * input.query.pageSize + 1 })
    : html`<div class="empty">
        <p class="empty__title">${context.mode === "public" ? "No published sermons matched" : "No sermons on this shelf yet"}</p>
        <p>Try removing a filter, or take a different book off the shelf.</p>
        <p><a class="button button--outline" href="${contextualPath(context, archivePath)}">Show all sermons</a></p>
        ${canonStrip(input.options, { label: "Where sermons have been preached from" })}
      </div>`;
  const shelfFallback = html`<div class="section">${shelfDetails(shelf(input.options, {
    href: (book) => withFilter(input.query, { sermon_book: book.slug, passageBook: null, passageChapter: null, passageVerse: null, passageEndVerse: null, passageScope: null }, context, "canon"),
    skipTo: "results",
    headingId: "book-details-heading"
  }))}</div>`;
  return html`${panel ?? shelfFallback}
  <section class="results" id="results" tabindex="-1" aria-labelledby="results-heading results-status">
    <div class="section__head">
      <h2 id="results-heading" class="section__title">${filtered ? "Sermons" : "All sermons, newest first"}</h2>
      <div class="section__aside"><span class="results__status" id="results-status">${status}</span>${when(expandedRecent && !filtered, () => html` <a class="results__fewer" href="${contextualPath(context, archivePath)}">Back to the shelf</a>`)}</div>
    </div>
    ${list}
    ${pagination(input.query, totalPages, context, expandedRecent)}
  </section>`;
}

export function renderPublicSermonArchivePage(
  input: SermonArchivePageInput,
  context: FrontendRenderContext = publicRenderContext
): string {
  const totalPages = Math.ceil(input.totalItems / input.query.pageSize);
  const filtered = hasActiveSermonFilters(input.query);
  const discovery = !filtered && !isExpandedRecentView(input.query) && input.query.page === 1;
  const links = siteLinks(context);
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
      trail: [{ href: links.archive, label: "Sermons" }],
      longThreshold: 34
    });
  return pageShell({
    title: filtered ? resultsTitle(input.query, input.options) : "Sermons",
    description: archiveDescription,
    canonicalPath: archivePagePath(input.query.page, publicRenderContext),
    robots: input.hasQueryParameters ? "noindex, follow" : "index, follow",
    styles: ["shelf"],
    scripts: ["canon"],
    books: input.options.books,
    mastheadSearch: false,
    body: html`${head}${finder({ query: input.query, options: input.options, context })}${discovery ? discoveryView(input, context) : resultsView(input, context, totalPages)}`
  }, context);
}

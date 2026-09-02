/**
 * The sermon archive: Find Sermons controls, then either the landing
 * discovery view (Most Recent Sermons, Topical Sermons, Series) or a
 * paginated results list. Search and filter state lives entirely in the URL.
 */
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { passageQueryLabel } from "../../domain/bible-passage";
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOptions, PublicSeriesRepresentative } from "../../server/repositories/sermon-repository";
import { findSermonsForm } from "../components/find-sermons";
import { carousel, pagination, sectionHead, sectionNote } from "../components/sections";
import { seriesCard, sermonItem, sermonList } from "../components/sermon-list";
import { countLabel, html, when, type Html } from "../html";
import {
  archivePagePath,
  archivePath,
  contextualPath,
  hasActiveSermonFilters,
  isExpandedRecentView,
  publicRenderContext,
  recentAnchor,
  resultsAnchor,
  siteLinks,
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
    query.query ? `Results for “${query.query}”` : null,
    query.speaker ? `Sermons by ${optionName(options.speakers, query.speaker)}` : null,
    query.series ? `Sermons in ${optionName(options.series, query.series)}` : null,
    query.book && !query.passageBook ? `Sermons from ${optionName(options.books, query.book)}` : null,
    passageQueryLabel(query) ? `Sermons preached from ${passageQueryLabel(query)}` : null,
    query.passage ? `Sermons on ${optionName(options.passages, query.passage)}` : null
  ].filter((item): item is string => item !== null);
  if (dimensions.length === 1) return dimensions[0]!;
  if (dimensions.length > 1) return "Filtered sermons";
  if (query.dateFrom || query.dateTo) return "Sermons by service date";
  return query.order === "ASC" ? "All sermons, oldest first" : "All sermons";
}

function discoveryView(input: SermonArchivePageInput, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  const recent = input.sermons.slice(0, 3);
  const hasTopicalSeries = input.seriesRepresentatives.some((item) => item.series.slug === "topical");
  const topicalMessage = `Topical sermons will appear here once an approved topical classification exists for the collection.${hasTopicalSeries ? " Sermons in the series named “Topical” are listed under Series below." : ""}`;
  return html`<section class="discovery discovery--recent" id="${recentAnchor}" aria-labelledby="most-recent-sermons-heading">
    ${sectionHead("most-recent-sermons-heading", "Most Recent Sermons")}
    ${recent.length
      ? html`${sermonList(recent, { variant: "recent", headingLevel: 3, links }, "sermon-list sermon-list--recent")}
        <p class="section-more"><a class="button button--secondary" href="${contextualPath(context, archivePath)}?view=recent#${resultsAnchor}">Show more recent sermons</a></p>`
      : sectionNote("No sermons are available yet.")}
  </section>
  ${carousel({
    id: "topical-sermons",
    heading: "Topical Sermons",
    itemsLabel: "topical sermons",
    items: input.topicalSermons.map((sermon) => sermonItem(sermon, { variant: "card", headingLevel: 3, links })),
    emptyMessage: topicalMessage
  })}
  ${carousel({
    id: "series-sermons",
    heading: "Series",
    itemsLabel: "series",
    items: input.seriesRepresentatives.map((item) => seriesCard(item, links)),
    emptyMessage: "No sermon series are available yet.",
    aside: links.hasTaxonomyRoutes ? html`<a class="carousel__all" href="${links.taxonomyIndex("series")}">All series</a>` : null
  })}`;
}

function resultsView(input: SermonArchivePageInput, context: FrontendRenderContext, totalPages: number): Html {
  const links = siteLinks(context);
  const filtered = hasActiveSermonFilters(input.query);
  const expandedRecent = isExpandedRecentView(input.query);
  const status = `${countLabel(input.totalItems, "sermon")}${totalPages > 1 ? ` · Page ${input.query.page} of ${totalPages}` : ""}`;
  const aside = html`<p class="results__status" id="sermon-results-status">${status}</p>${when(expandedRecent && !filtered, () => html`<a class="results__fewer" href="${contextualPath(context, archivePath)}#${recentAnchor}">Show fewer recent sermons</a>`)}`;
  const list = input.sermons.length
    ? sermonList(input.sermons, { variant: "row", headingLevel: 3, links }, "sermon-list", (input.query.page - 1) * input.query.pageSize + 1)
    : html`<div class="empty-state">
        <p class="empty-state__title">${context.mode === "public" ? "No published sermons matched" : "No sermons matched"}</p>
        <p>Try removing a filter or searching for something else.</p>
        <p><a class="button button--secondary" href="${contextualPath(context, archivePath)}">Show all sermons</a></p>
      </div>`;
  return html`<section class="results" id="${resultsAnchor}" tabindex="-1" aria-labelledby="sermon-results-heading sermon-results-status">
    ${sectionHead("sermon-results-heading", resultsTitle(input.query, input.options), aside)}
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
  const title = filtered ? resultsTitle(input.query, input.options) : "Sermons";
  const libraryCount = discovery && input.totalItems > 0
    ? [countLabel(input.totalItems, "sermon"), countLabel(input.options.speakers.length, "speaker"), countLabel(input.options.series.length, "series", "series")].join(" · ")
    : null;
  return pageShell({
    title,
    description: archiveDescription,
    canonicalPath: archivePagePath(input.query.page, publicRenderContext),
    robots: input.hasQueryParameters ? "noindex, follow" : "index, follow",
    styles: ["archive"],
    scripts: ["archive"],
    body: html`<header class="page-head">
      <h1>Sermons</h1>
      <p class="page-head__lede">Recorded sermons from Saving Grace Bible Church. Search by keyword, or browse by speaker, series, Bible book or the passage a sermon was preached from.</p>
      ${when(libraryCount, () => html`<p class="page-head__count">${libraryCount}</p>`)}
    </header>
    ${findSermonsForm({ query: input.query, options: input.options, context })}
    ${discovery ? discoveryView(input, context) : resultsView(input, context, totalPages)}`
  }, context);
}

/**
 * The Find Sermons controls: one compact primary line (Search, Speaker,
 * Bible book, Series), a "Browse by Bible passage" disclosure holding the
 * picker, an "Advanced search" disclosure holding the remaining filters, and
 * removable tokens for every active filter.
 *
 * Query parameter names are the legacy-compatible public contract and are
 * not changed here.
 */
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { passageQueryLabel } from "../../domain/bible-passage";
import type { PublicSermonFilterOption, PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { attribute, countLabel, html, when, type Html } from "../html";
import {
  archivePath,
  contextualPath,
  hasActiveSermonFilters,
  standardizedFilterParameters,
  type FrontendRenderContext
} from "../routes";
import { biblePicker, passageBadgeLabel } from "./bible-picker";

function options(items: PublicSermonFilterOption[], value: string | undefined, emptyLabel: string): Html {
  return html`<option value="">${emptyLabel}</option>${items.map((item) => html`<option value="${item.slug}"${attribute("selected", value === item.slug)}>${item.name}</option>`)}`;
}

function optionName(items: PublicSermonFilterOption[], slug: string): string {
  return items.find((item) => item.slug === slug)?.name ?? slug;
}

function field(id: string, label: string, control: Html): Html {
  return html`<div class="field"><label class="field__label" for="${id}">${label}</label>${control}</div>`;
}

function advancedActiveCount(query: PublicSermonListQuery): number {
  return [query.passage, query.dateFrom, query.dateTo, query.order === "ASC" ? "asc" : ""].filter(Boolean).length;
}

function disclosureSummary(label: string, badge: string | null): Html {
  return html`<summary class="disclosure__summary" aria-expanded="${badge ? "true" : "false"}"><span class="disclosure__label">${label}</span>${when(badge, () => html`<span class="disclosure__badge">${badge}</span>`)}</summary>`;
}

/** One removable token per active filter dimension. */
export function filterTokens(query: PublicSermonListQuery, filterOptions: PublicSermonFilterOptions, context: FrontendRenderContext): Html | null {
  if (!hasActiveSermonFilters(query)) return null;
  const base = contextualPath(context, archivePath);
  const without = (...names: string[]): string => {
    const parameters = standardizedFilterParameters(query);
    for (const name of names) parameters.delete(name);
    parameters.delete("view");
    return parameters.size ? `${base}?${parameters.toString()}` : base;
  };
  const passageLabel = passageQueryLabel(query);
  const tokens: Array<[string, string] | null> = [
    query.query ? [`Search: “${query.query}”`, without("s")] : null,
    query.speaker ? [`Speaker: ${optionName(filterOptions.speakers, query.speaker)}`, without("sermon_speaker")] : null,
    query.series ? [`Series: ${optionName(filterOptions.series, query.series)}`, without("sermon_series")] : null,
    query.book ? [`Bible book: ${optionName(filterOptions.books, query.book)}`, without("sermon_book")] : null,
    passageLabel ? [`Passage: ${passageLabel}`, without("passageBook", "passageChapter", "passageVerse", "passageEndVerse", "passageScope")] : null,
    query.passage ? [`Scripture: ${optionName(filterOptions.passages, query.passage)}`, without("sermon_topics")] : null,
    query.dateFrom ? [`From: ${query.dateFrom}`, without("dateFrom")] : null,
    query.dateTo ? [`To: ${query.dateTo}`, without("dateTo")] : null,
    query.order === "ASC" ? ["Oldest first", without("order")] : null
  ];
  const active = tokens.filter((token): token is [string, string] => token !== null);
  return html`<div class="filter-tokens" aria-label="Active filters">
    <ul class="filter-tokens__list" role="list">${active.map(([label, href]) => html`<li><a class="filter-token" href="${href}#sermon-results">${label}<span class="filter-token__remove" aria-hidden="true">×</span><span class="sr-only">, remove this filter</span></a></li>`)}</ul>
    <a class="filter-tokens__clear" href="${base}">Clear all filters</a>
  </div>`;
}

export interface FindSermonsInput {
  query: PublicSermonListQuery;
  options: PublicSermonFilterOptions;
  context: FrontendRenderContext;
}

export function findSermonsForm(input: FindSermonsInput): Html {
  const { query, options: filterOptions, context } = input;
  const action = `${contextualPath(context, archivePath)}#sermon-results`;
  const advancedCount = advancedActiveCount(query);
  const advancedActive = advancedCount > 0;
  const passageBadge = passageBadgeLabel(query);
  const passageActive = Boolean(passageBadge);
  const bookOrigin = query.book && query.passageBook ? "both" : query.passageBook ? "exact" : query.book ? "broad" : "none";
  return html`<section class="find-sermons" aria-labelledby="find-sermons-heading">
    <h2 id="find-sermons-heading" class="find-sermons__heading">Find sermons</h2>
    <form class="find-sermons__form" method="get" action="${action}" role="search" data-sermon-search-form data-book-origin="${bookOrigin}">
      <div class="find-sermons__row">
        ${field("sermon-search", "Search", html`<input id="sermon-search" class="control" name="s" type="search" maxlength="120" value="${query.query ?? ""}" autocomplete="off" />`)}
        ${field("speaker-filter", "Speaker", html`<select id="speaker-filter" class="control" name="sermon_speaker">${options(filterOptions.speakers, query.speaker, "All speakers")}</select>`)}
        ${field("book-filter", "Bible book", html`<select id="book-filter" class="control" name="sermon_book">${options(filterOptions.books, query.book, "All books")}</select>`)}
        ${field("series-filter", "Series", html`<select id="series-filter" class="control" name="sermon_series">${options(filterOptions.series, query.series, "All series")}</select>`)}
        <div class="find-sermons__submit"><button class="button" type="submit">Search</button></div>
      </div>
      <div class="find-sermons__disclosures">
        <details class="disclosure disclosure--passage" data-passage-disclosure data-active="${String(passageActive)}"${attribute("open", passageActive)}>
          ${disclosureSummary("Browse by Bible passage", passageBadge)}
          <div class="disclosure__body">${biblePicker(query, context)}</div>
        </details>
        <details class="disclosure disclosure--advanced" data-advanced-search data-active="${String(advancedActive)}"${attribute("open", advancedActive)}>
          ${disclosureSummary("Advanced search", advancedCount ? `${countLabel(advancedCount, "filter")} active` : null)}
          <div class="disclosure__body find-sermons__advanced">
            ${field("passage-filter", "Scripture reference", html`<select id="passage-filter" class="control" name="sermon_topics">${options(filterOptions.passages, query.passage, "All references")}</select>`)}
            ${field("sort-order", "Order", html`<select id="sort-order" class="control" name="order"><option value="DESC"${attribute("selected", query.order === "DESC")}>Newest first</option><option value="ASC"${attribute("selected", query.order === "ASC")}>Oldest first</option></select>`)}
            ${field("date-from", "Service date from", html`<input id="date-from" class="control" name="dateFrom" type="date" value="${query.dateFrom ?? ""}" />`)}
            ${field("date-to", "Service date to", html`<input id="date-to" class="control" name="dateTo" type="date" value="${query.dateTo ?? ""}" />`)}
            <div class="find-sermons__advanced-actions"><button class="button button--secondary" type="submit">Apply advanced search</button></div>
          </div>
        </details>
      </div>
    </form>
    ${filterTokens(query, filterOptions, context)}
  </section>`;
}

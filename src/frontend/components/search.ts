/**
 * The finder: keyword search with speaker and series selects, a "More
 * filters" disclosure for the remaining legacy filters, removable tokens for
 * every active filter, and the compact masthead search form.
 *
 * Query parameter names are the legacy-compatible public contract and are
 * not changed here.
 */
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { passageQueryLabel } from "../../domain/bible-passage";
import type { PublicSermonFilterOption, PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { attribute, countLabel, html, when, type Html } from "../html";
import { archiveTarget, contextualPath, hasActiveSermonFilters, standardizedFilterParameters, type ArchiveTarget, type FrontendRenderContext } from "../routes";

function options(items: PublicSermonFilterOption[], value: string | undefined, emptyLabel: string): Html {
  return html`<option value="">${emptyLabel}</option>${items.map((item) => html`<option value="${item.slug}"${attribute("selected", value === item.slug)}>${item.name}${item.sermonCount !== undefined ? ` (${item.sermonCount})` : ""}</option>`)}`;
}

function optionName(items: PublicSermonFilterOption[], slug: string): string {
  return items.find((item) => item.slug === slug)?.name ?? slug;
}

function field(id: string, label: string, control: Html): Html {
  return html`<div class="field"><label class="field__label" for="${id}">${label}</label>${control}</div>`;
}

/** Filters that live inside "More filters". */
export function refineActiveCount(query: PublicSermonListQuery): number {
  return [query.passage, query.book && !query.passageBook ? query.book : "", query.dateFrom, query.dateTo, query.order === "ASC" ? "asc" : ""].filter(Boolean).length;
}

/** One removable token per active filter dimension. */
export function filterTokens(query: PublicSermonListQuery, filterOptions: PublicSermonFilterOptions, context: FrontendRenderContext, target: ArchiveTarget = archiveTarget): Html | null {
  if (!hasActiveSermonFilters(query)) return null;
  const base = contextualPath(context, target.path);
  const without = (...names: string[]): string => {
    const parameters = standardizedFilterParameters(query);
    for (const name of names) parameters.delete(name);
    parameters.delete("view");
    return `${parameters.size ? `${base}?${parameters.toString()}` : base}#${target.fragment}`;
  };
  const passageLabel = passageQueryLabel(query);
  const tokens: Array<[string, string] | null> = [
    query.query ? [`Search: “${query.query}”`, without("s")] : null,
    query.speaker ? [`Speaker: ${optionName(filterOptions.speakers, query.speaker)}`, without("sermon_speaker")] : null,
    query.series ? [`Series: ${optionName(filterOptions.series, query.series)}`, without("sermon_series")] : null,
    query.book ? [`Book: ${optionName(filterOptions.books, query.book)}`, without("sermon_book")] : null,
    passageLabel ? [`Passage: ${passageLabel}`, without("passageBook", "passageChapter", "passageVerse", "passageEndVerse", "passageScope")] : null,
    query.passage ? [`Reference: ${optionName(filterOptions.passages, query.passage)}`, without("sermon_topics")] : null,
    query.dateFrom ? [`From: ${query.dateFrom}`, without("dateFrom")] : null,
    query.dateTo ? [`To: ${query.dateTo}`, without("dateTo")] : null,
    query.order === "ASC" ? ["Oldest first", without("order")] : null
  ];
  const active = tokens.filter((token): token is [string, string] => token !== null);
  return html`<div class="tokens" aria-label="Active filters">
    <ul class="tokens__list" role="list">${active.map(([label, href]) => html`<li><a class="token" href="${href}">${label}<span class="token__remove" aria-hidden="true">×</span><span class="sr-only">, remove this filter</span></a></li>`)}</ul>
    <a class="tokens__clear" href="${base}">Clear all</a>
  </div>`;
}

export interface FinderInput {
  query: PublicSermonListQuery;
  options: PublicSermonFilterOptions;
  context: FrontendRenderContext;
  /** The presentation that receives the search; the archive by default. */
  target?: ArchiveTarget;
}

/** The archive's search controls. Passage state rides along in hidden inputs. */
export function finder(input: FinderInput): Html {
  const { query, options: filterOptions, context } = input;
  const target = input.target ?? archiveTarget;
  const action = `${contextualPath(context, target.path)}#${target.fragment}`;
  const refineCount = refineActiveCount(query);
  const passageActive = Boolean(query.passageBook);
  return html`<section class="finder" aria-labelledby="finder-heading">
    <h2 id="finder-heading" class="sr-only">Find sermons</h2>
    <form class="finder__form" method="get" action="${action}" role="search" data-finder>
      ${when(passageActive, () => html`<input type="hidden" name="passageBook" value="${query.passageBook}" />${when(query.passageChapter !== undefined, () => html`<input type="hidden" name="passageChapter" value="${query.passageChapter}" />`)}${when(query.passageVerse !== undefined, () => html`<input type="hidden" name="passageVerse" value="${query.passageVerse}" />`)}${when(query.passageScope, () => html`<input type="hidden" name="passageScope" value="${query.passageScope}" />`)}`)}
      <div class="finder__row">
        ${field("sermon-search", "Search sermons", html`<input id="sermon-search" class="control" name="s" type="search" maxlength="120" value="${query.query ?? ""}" autocomplete="off" placeholder="A word, a name, a passage" />`)}
        ${field("speaker-filter", "Speaker", html`<select id="speaker-filter" class="control" name="sermon_speaker">${options(filterOptions.speakers, query.speaker, "All speakers")}</select>`)}
        ${field("series-filter", "Series", html`<select id="series-filter" class="control" name="sermon_series">${options(filterOptions.series, query.series, "All series")}</select>`)}
        <div class="finder__submit"><button class="button" type="submit">Search</button></div>
      </div>
      <details class="refine" data-refine data-active="${String(refineCount > 0)}"${attribute("open", refineCount > 0)}>
        <summary class="refine__summary"><span>More filters</span>${when(refineCount > 0, () => html`<span class="refine__badge">${countLabel(refineCount, "filter")} active</span>`)}</summary>
        <div class="refine__grid">
          ${when(!passageActive, () => field("book-filter", "Bible book", html`<select id="book-filter" class="control" name="sermon_book">${options(filterOptions.books, query.book, "All books")}</select>`))}
          ${field("passage-filter", "Scripture reference", html`<select id="passage-filter" class="control" name="sermon_topics">${options(filterOptions.passages, query.passage, "All references")}</select>`)}
          ${field("sort-order", "Order", html`<select id="sort-order" class="control" name="order"><option value="DESC"${attribute("selected", query.order === "DESC")}>Newest first</option><option value="ASC"${attribute("selected", query.order === "ASC")}>Oldest first</option></select>`)}
          ${field("date-from", "Service date from", html`<input id="date-from" class="control" name="dateFrom" type="date" value="${query.dateFrom ?? ""}" />`)}
          ${field("date-to", "Service date to", html`<input id="date-to" class="control" name="dateTo" type="date" value="${query.dateTo ?? ""}" />`)}
          <div class="refine__actions"><button class="button button--outline" type="submit">Apply filters</button></div>
        </div>
      </details>
    </form>
    ${filterTokens(query, filterOptions, context, target)}
  </section>`;
}

/** The compact keyword form in the masthead. */
export function mastheadSearch(context: FrontendRenderContext): Html {
  const action = `${contextualPath(context, archiveTarget.path)}#${archiveTarget.fragment}`;
  return html`<form class="masthead__search" method="get" action="${action}" role="search" aria-label="Search sermons"><label class="sr-only" for="masthead-search">Search sermons</label><input id="masthead-search" class="control" name="s" type="search" maxlength="120" placeholder="Search sermons" autocomplete="off" /><button class="button button--outline" type="submit">Search</button></form><a class="masthead__search-link" href="${contextualPath(context, archiveTarget.path)}#sermon-search">Search</a>`;
}

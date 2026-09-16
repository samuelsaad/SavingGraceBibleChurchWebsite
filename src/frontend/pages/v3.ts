import { resolveBibleBook } from "../../domain/bible-passage";
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOption } from "../../server/repositories/sermon-repository";
import { primaryBook } from "../components/catalogue";
import { attribute, countLabel, html, timeElement, when, type Html } from "../html";
import { archivePagePath, hasActiveSermonFilters, siteLinks, standardizedFilterParameters, type FrontendRenderContext } from "../routes";
import { pageShell } from "../shell";
import { sermonsV3Path, sermonsV3Url } from "../v3-routes";
import { resultsTitle, type SermonArchivePageInput } from "./archive";

function arrow(): Html { return html`<span aria-hidden="true">&#8599;</span>`; }

function filter(context: FrontendRenderContext, name: string, slug: string): string {
  return `${sermonsV3Url(context)}?${new URLSearchParams({ [name]: slug })}#v3-results`;
}

function classification(sermon: SermonSummary, context: FrontendRenderContext): Html {
  if (sermon.isTopical === true) return html`<a class="v3-tag hue--topical" href="${sermonsV3Url(context)}#v3-topical">Topical</a>`;
  const book = primaryBook(sermon);
  return book ? html`<a class="v3-tag hue--${book.category}" href="${filter(context, "sermon_book", book.slug)}">${book.canonicalName}</a>` : html``;
}

function metadata(sermon: SermonSummary, context: FrontendRenderContext): Html {
  return html`<p class="v3-meta">${timeElement(sermon.serviceDate)}${when(sermon.speaker, () => html`<span aria-hidden="true"> / </span><a href="${filter(context, "sermon_speaker", sermon.speaker!.slug)}">${sermon.speaker!.name}</a>`)}</p>`;
}

function sermonCard(sermon: SermonSummary, context: FrontendRenderContext, ordinal: number): Html {
  const book = primaryBook(sermon);
  return html`<article class="v3-card${sermon.isTopical === true ? " hue--topical" : book ? ` hue--${book.category}` : ""}">
    <div class="v3-card-top">${classification(sermon, context)}<span class="v3-ordinal" aria-label="Result ${ordinal}">${String(ordinal).padStart(2, "0")}</span></div>
    <h3><a href="${siteLinks(context).sermon(sermon.slug)}">${sermon.title}</a></h3>
    ${when(sermon.primaryPassages.length, () => html`<p class="v3-passage">${sermon.primaryPassages.map(p => p.displayText).join(", ")}</p>`)}
    ${when(sermon.summary, () => html`<p class="v3-excerpt">${sermon.summary}</p>`)}
    ${metadata(sermon, context)}
  </article>`;
}

function select(name: string, label: string, options: PublicSermonFilterOption[], current?: string): Html {
  const available = current && !options.some(item => item.slug === current) ? [...options, { slug: current, name: current }] : options;
  return html`<label for="v3-${name}"><span id="v3-${name}-label">${label}</span><select id="v3-${name}" name="${name}" aria-labelledby="v3-${name}-label"><option value="">All ${label === "Bible book" ? "Bible books" : label.toLowerCase() + (label === "Series" ? "" : "s")}</option>${available.map(item => html`<option value="${item.slug}"${attribute("selected", item.slug === current)}>${item.name}${item.sermonCount !== undefined ? ` (${item.sermonCount})` : ""}</option>`)}</select></label>`;
}

function searchForm(input: SermonArchivePageInput, context: FrontendRenderContext): Html {
  const q = input.query;
  const preserved = standardizedFilterParameters(q);
  for (const name of ["s", "sermon_speaker", "sermon_series", "sermon_book", "order", "dateFrom", "dateTo", "view"]) preserved.delete(name);
  return html`<form class="v3-finder" action="${sermonsV3Url(context)}#v3-results" method="get" role="search" aria-label="Search the V3 archive">
    <div class="v3-search-line"><label for="v3-search"><span>Find a sermon</span><input type="search" id="v3-search" name="s" value="${q.query ?? ""}" placeholder="A word, a name, a passage" maxlength="120" /></label><button type="submit">Search the archive <span aria-hidden="true">&#8594;</span></button></div>
    <details class="v3-refine"${attribute("open", hasActiveSermonFilters(q))}><summary>Refine by book, speaker, series or date</summary><div class="v3-filter-grid">
      ${q.passageBook ? html`<input type="hidden" name="sermon_book" value="${q.book ?? ""}" /><p class="v3-filter-note">A precise passage is selected. <a href="${sermonsV3Url(context)}#v3-results">Clear filters</a> to choose another book.</p>` : select("sermon_book", "Bible book", input.options.books, q.book)}
      ${select("sermon_speaker", "Speaker", input.options.speakers, q.speaker)}${select("sermon_series", "Series", input.options.series, q.series)}
      <label for="v3-date-from"><span>From date</span><input id="v3-date-from" name="dateFrom" type="date" value="${q.dateFrom ?? ""}" /></label>
      <label for="v3-date-to"><span>To date</span><input id="v3-date-to" name="dateTo" type="date" value="${q.dateTo ?? ""}" /></label>
      <label for="v3-order"><span>Order</span><select id="v3-order" name="order"><option value="DESC"${attribute("selected", q.order === "DESC")}>Newest first</option><option value="ASC"${attribute("selected", q.order === "ASC")}>Oldest first</option></select></label>
    </div><button class="v3-apply" type="submit">Apply filters ${arrow()}</button></details>
    ${[...preserved].map(([name, value]) => html`<input type="hidden" name="${name}" value="${value}" />`)}
  </form>`;
}

function sectionHeading(number: string, title: string, id: string, aside?: Html): Html {
  return html`<div class="v3-section-head"><div><span class="v3-kicker">${number}</span><h2 id="${id}">${title}</h2></div>${aside}</div>`;
}

function discovery(input: SermonArchivePageInput, context: FrontendRenderContext): Html {
  const [latest, ...recent] = input.sermons;
  const base = sermonsV3Url(context);
  const books = [...input.options.books].sort((a, b) => (resolveBibleBook(a.slug)?.id ?? 99) - (resolveBibleBook(b.slug)?.id ?? 99));
  const topical = input.topicalSermons.filter(sermon => sermon.isTopical === true);
  return html`${when(latest, () => html`<section class="v3-opening" aria-label="Latest and recent sermons">
    <article class="v3-feature"><div class="v3-feature-label"><span class="v3-kicker">The latest sermon</span>${classification(latest!, context)}</div>
      <h2><a href="${siteLinks(context).sermon(latest!.slug)}">${latest!.title}</a></h2>
      ${when(latest!.primaryPassages.length, () => html`<p class="v3-passage">${latest!.primaryPassages.map(p => p.displayText).join(", ")}</p>`)}
      ${metadata(latest!, context)}${when(latest!.summary, () => html`<p class="v3-feature-description">${latest!.summary}</p>`)}
      <a class="v3-reading-link" href="${siteLinks(context).sermon(latest!.slug)}">Read &amp; listen ${arrow()}</a>
      <span class="v3-page-edge" aria-hidden="true"></span>
    </article>
    <aside class="v3-recent" aria-labelledby="v3-recent-heading"><div class="v3-recent-head"><h2 id="v3-recent-heading">Recent sermons</h2><span class="v3-kicker">Newest first</span></div><ol>${recent.slice(0, 3).map((sermon, i) => html`<li><span class="v3-recent-number" aria-hidden="true">${String(i + 2).padStart(2, "0")}</span><div>${metadata(sermon, context)}<h3><a href="${siteLinks(context).sermon(sermon.slug)}">${sermon.title}</a></h3>${when(sermon.primaryPassages.length, () => html`<p class="v3-passage">${sermon.primaryPassages.map(p => p.displayText).join(", ")}</p>`)}</div></li>`)}</ol><a class="v3-text-link" href="${base}?view=recent#v3-results">All recent sermons <span aria-hidden="true">&#8594;</span></a></aside>
  </section>`)}
  ${when(books.length, () => html`<section class="v3-section" id="v3-books" aria-labelledby="v3-books-heading">
    ${sectionHeading("01 / By Scripture", "Choose a book.", "v3-books-heading", html`<p>${countLabel(books.length, "book")} represented in the archive.<br />The same familiar colours, a new way in.</p>`)}
    <ul class="v3-books" role="list">${books.map(option => { const book = resolveBibleBook(option.slug); return html`<li><a class="v3-book${book ? ` hue--${book.category}` : ""}" href="${filter(context, "sermon_book", option.slug)}"><span class="v3-book-number" aria-hidden="true">${book ? String(book.id).padStart(2, "0") : ""}</span><span class="v3-book-name">${option.name}</span><span class="v3-book-count">${option.sermonCount !== undefined ? countLabel(option.sermonCount, "sermon") : "Browse sermons"}</span>${arrow()}</a></li>`; })}</ul>
    <a class="v3-text-link" href="${siteLinks(context).archive}#shelf-heading">Explore the full Bible bookshelf <span aria-hidden="true">&#8594;</span></a>
  </section>`)}
  ${when(topical.length, () => html`<section class="v3-topical" id="v3-topical" aria-labelledby="v3-topical-heading"><div class="v3-topical-intro"><span class="v3-kicker">02 / Topical sermons</span><h2 id="v3-topical-heading">Another place <br />to begin.</h2><p>Explore the sermons in our Topical collection.</p><span class="v3-topical-count">${countLabel(topical.length, "sermon")}</span></div><ul role="list">${topical.map(sermon => html`<li><a href="${siteLinks(context).sermon(sermon.slug)}"><span>${sermon.title}</span>${arrow()}<small>${timeElement(sermon.serviceDate)}</small></a></li>`)}</ul></section>`)}
  ${when(input.options.speakers.length || input.options.series.length, () => html`<section class="v3-section" id="v3-people" aria-labelledby="v3-people-heading">${sectionHeading("03 / People & collections", "Follow a voice. Explore a series.", "v3-people-heading")}<div class="v3-directories">${([ ["Speakers", "sermon_speaker", input.options.speakers], ["Series", "sermon_series", input.options.series] ] as const).map(([label, name, options]) => html`<div><h3>${label}</h3><ul role="list">${options.map(option => html`<li><a href="${filter(context, name, option.slug)}"><span>${option.name}</span><small>${option.sermonCount !== undefined ? countLabel(option.sermonCount, "sermon") : "Browse"}</small>${arrow()}</a></li>`)}</ul></div>`)}</div></section>`)}
  `;
}

function pagination(input: SermonArchivePageInput, context: FrontendRenderContext): Html {
  const { query, totalItems } = input;
  const totalPages = Math.ceil(totalItems / query.pageSize);
  if (totalPages <= 1) return html``;
  const pages = [...new Set([1, query.page - 1, query.page, query.page + 1, totalPages])].filter(page => page > 0 && page <= totalPages).sort((a, b) => a - b);
  return html`<nav class="v3-pagination" aria-label="Sermon archive pages">${when(query.page > 1, () => html`<a rel="prev" href="${sermonsV3Url(context, query, query.page - 1)}#v3-results">Previous</a>`)}<ol role="list">${pages.map((page, i) => html`${when(i > 0 && page > pages[i - 1]! + 1, () => html`<li class="v3-gap" aria-hidden="true">&#8230;</li>`)}<li>${page === query.page ? html`<span aria-current="page" aria-label="Page ${page}">${page}</span>` : html`<a aria-label="Page ${page}" href="${sermonsV3Url(context, query, page)}#v3-results">${page}</a>`}</li>`)}</ol>${when(query.page < totalPages, () => html`<a rel="next" href="${sermonsV3Url(context, query, query.page + 1)}#v3-results">Next</a>`)}</nav>`;
}

export function renderSermonsV3(input: SermonArchivePageInput, context: FrontendRenderContext): string {
  const filtered = hasActiveSermonFilters(input.query);
  const isDiscovery = !filtered && input.query.page === 1 && input.query.view !== "recent";
  const base = sermonsV3Url(context);
  const first = (input.query.page - 1) * input.query.pageSize + 1;
  const last = first + input.sermons.length - 1;
  return pageShell({
    title: filtered ? `${resultsTitle(input.query, input.options)} | Sermons V3` : "Sermons V3 | The reading room",
    canonicalPath: archivePagePath(input.query.page), navigationPath: sermonsV3Path,
    robots: "noindex, follow", styles: ["v3"], books: input.options.books, mastheadSearch: false,
    body: html`<div class="v3">
      <header class="v3-intro"><div class="v3-intro-top"><p class="v3-kicker">Saving Grace / The sermon library</p><span class="v3-edition">VOLUME III</span></div>
      <div class="v3-title-row"><h1>${isDiscovery ? html`A place in <br /><em>the Word.</em>` : filtered ? resultsTitle(input.query, input.options) : "The sermon archive."}</h1><div class="v3-intro-note"><span class="v3-rule" aria-hidden="true"></span><p>${isDiscovery ? "Take time with a sermon. Follow a passage, return to a familiar voice, or discover somewhere new to begin." : "Browse the collection. Find a passage, a speaker or a word that brings you here."}</p><a href="#v3-results">${countLabel(input.totalItems, "sermon")}${filtered ? " found" : " to explore"} <span aria-hidden="true">&#8595;</span></a></div></div>
      <nav class="v3-jumps" aria-label="Explore the sermon library"><a href="${base}#v3-books">Bible books</a><a href="${base}#v3-people">Speakers &amp; series</a><a href="${base}#v3-topical">Topical</a><a href="#v3-results">The full archive <span aria-hidden="true">&#8595;</span></a></nav></header>
      ${when(isDiscovery, () => discovery(input, context))}
      <section class="v3-section v3-archive" id="v3-results" tabindex="-1" aria-labelledby="v3-results-heading">
        ${sectionHeading(isDiscovery ? "04 / The complete collection" : "The collection", filtered ? "Your search results." : "Find your next sermon.", "v3-results-heading")}
        ${searchForm(input, context)}
        <div class="v3-results-bar"><p role="status">${input.totalItems ? `${first}-${last} of ${countLabel(input.totalItems, "sermon")}` : "No sermons found"}${Math.ceil(input.totalItems / input.query.pageSize) > 1 ? ` / Page ${input.query.page} of ${Math.ceil(input.totalItems / input.query.pageSize)}` : ""}</p>${when(filtered, () => html`<a href="${base}#v3-results">Clear all filters</a>`)}</div>
        ${filtered ? html`<p class="v3-query-label">${resultsTitle(input.query, input.options)}</p>` : null}
        ${input.sermons.length ? html`<ol class="v3-results" role="list" start="${first}">${input.sermons.map((sermon, index) => html`<li>${sermonCard(sermon, context, first + index)}</li>`)}</ol>` : html`<div class="v3-empty"><h3>A different starting point?</h3><p>Try another word or remove a filter to explore more sermons.</p><a class="v3-reading-link" href="${base}#v3-results">Browse all sermons ${arrow()}</a></div>`}
        ${pagination(input, context)}
      </section><div class="v3-colophon"><span class="v3-kicker">The reading room / Sermons V3</span><a href="#main-content">Back to the beginning <span aria-hidden="true">&#8593;</span></a></div>
    </div>`
  }, context);
}

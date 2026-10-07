/** V5: the existing finder and folded shelf, slim journal entries and V1 indexes. */
import { bibleBookBySlug } from "../../domain/bible-passage";
import type { PublicSermonFilterOption } from "../../server/repositories/sermon-repository";
import { formatCount } from "../canon";
import { finder } from "../components/search";
import { pagination, sectionHead } from "../components/sections";
import { sermonJournal, verifiedSpeakerPortrait } from "../components/sermon-journal";
import { pillarGlyph, socialGlyph } from "../components/glyphs";
import { openBook } from "../components/shelf";
import { html, when } from "../html";
import {
  archivePagePath, contextualPath, hasActiveSermonFilters, isExpandedRecentView,
  paginationUrl, publicRenderContext, sermonsV5Path, sermonsV5Target, siteLinks,
  type FrontendRenderContext
} from "../routes";
import { pageShell } from "../shell";
import { resultsTitle, type SermonArchivePageInput } from "./archive";
import { shelfFold } from "./sermons-v4";

export type SermonsV5PageInput = SermonArchivePageInput;

const directoryArrow = html`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function browseTable(items: PublicSermonFilterOption[], href: (slug: string) => string, label: string) {
  return html`<table class="v5-directory"><caption class="sr-only">${label} and available sermons</caption><thead><tr><th scope="col">${label === "Series" ? "Series title" : "Speaker"}</th><th scope="col">Sermons</th></tr></thead><tbody>${items.map(item => {
    const portrait = label === "Speakers" ? verifiedSpeakerPortrait(item.name) : null;
    return html`<tr><th scope="row"><a class="v5-directory__link" href="${href(item.slug)}">
      ${portrait ? html`<img class="v5-directory__portrait" src="${portrait.path}" width="${portrait.width}" height="${portrait.height}" alt="" loading="lazy" decoding="async" />` : html`<span class="v5-directory__symbol" aria-hidden="true">${label === "Series" ? pillarGlyph("our-faith") : socialGlyph("podcast")}</span>`}
      <span class="v5-directory__name">${item.name}</span><span class="v5-directory__arrow">${directoryArrow}</span>
    </a></th><td><span class="v5-directory__count">${item.sermonCount !== undefined ? item.sermonCount : html`<span aria-label="Count unavailable">—</span>`}</span></td></tr>`;
  })}</tbody></table>`;
}

export function renderSermonsV5Page(input: SermonsV5PageInput, context: FrontendRenderContext = publicRenderContext): string {
  const links = siteLinks(context);
  const filtered = hasActiveSermonFilters(input.query);
  const expanded = isExpandedRecentView(input.query);
  const discovery = !filtered && !expanded && input.query.page === 1;
  const latest = discovery ? input.sermons[0] : undefined;
  const recent = latest ? input.sermons.slice(1) : input.sermons;
  const totalPages = Math.ceil(input.totalItems / input.query.pageSize);
  const base = contextualPath(context, sermonsV5Path);
  const bookSlug = input.query.passageBook ?? input.query.book;
  const book = bookSlug ? bibleBookBySlug(bookSlug) : null;
  const panel = book ? openBook({ book, query: input.query, options: input.options, context,
    count: input.options.books.find(item => item.slug === book.slug)?.sermonCount ?? null,
    chapter: input.query.passageChapter, verse: input.query.passageVerse, headingLevel: 2,
    broad: !input.query.passageBook, target: sermonsV5Target }) : null;
  const body = html`<div class="v5">
    <header class="v5__heading"><h1>${filtered ? resultsTitle(input.query, input.options) : "Sermons"}</h1><p>${filtered ? "Search the archive, or explore a different passage." : "Explore the preaching of God's Word at Saving Grace."}</p></header>
    ${finder({ query: input.query, options: input.options, context, target: sermonsV5Target })}
    ${panel ?? shelfFold(input, context, "after-v5-shelf", sermonsV5Target, "v5")}
    ${when(latest, () => html`<section class="v5__featured" aria-labelledby="v5-latest-heading">${sectionHead("v5-latest-heading", "Last Week’s Sermon", html`<span>Latest available recording</span>`)}${sermonJournal([latest!], links, true)}</section>`)}
    <section class="v5__recent" id="v5-results" tabindex="-1" aria-labelledby="v5-results-heading" data-v5-base="${base}">
      ${sectionHead("v5-results-heading", discovery ? "Recent sermons" : filtered ? "Sermons" : "All sermons, newest first",
        discovery ? when(input.totalItems > 0, () => html`<a href="${base}?view=recent#v5-results">Browse all ${formatCount(input.totalItems, "sermon")}</a>`)
        : html`<span>${formatCount(input.totalItems, "sermon")}</span>${when(expanded && !filtered, () => html` <a href="${base}">Back to recent sermons</a>`)}`)}
      ${recent.length ? sermonJournal(recent, links) : html`<div class="empty"><h3 class="empty__title">${latest ? "You’re up to date" : filtered ? "No sermons matched these filters" : "No sermons are available yet"}</h3><p>${latest ? "More recordings will appear here when available." : filtered ? "Try removing a filter or choosing a different book." : "Please check back soon."}</p>${when(filtered, () => html`<a class="button button--outline" href="${base}">Clear filters</a>`)}</div>`}
      ${when(input.sermons.length > 0, () => html`<div class="v5__browse" data-v5-pagination data-page="${input.query.page}" data-total="${input.totalItems}">
        <p class="v5__progress" data-v5-progress>Showing ${input.sermons.length} of ${formatCount(input.totalItems, "sermon")}</p>
        ${input.query.page < totalPages ? html`<a class="button v5__more" data-v5-more href="${paginationUrl(input.query.page + 1, input.query, context, expanded, sermonsV5Target)}" aria-controls="v5-results">More sermons <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="M12 4v15m-6-6 6 6 6-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></a>` : html`<p class="v5__end">You’ve reached the end of these sermons.</p>`}
        ${pagination(input.query, totalPages, context, expanded, sermonsV5Target)}
      </div>`)}
      <p class="v5__load-status" role="status" aria-live="polite" aria-atomic="true" data-v5-load-status></p>
    </section>
    <div class="v5__indexes">
      ${when(input.options.series.length, () => html`<section class="v5-directory-section v5-directory-section--series" aria-labelledby="v5-series-heading"><header class="v5-directory-heading"><div><h2 id="v5-series-heading">Series</h2><p>Follow the teaching, series by series.</p></div>${when(links.hasTaxonomyRoutes, () => html`<a href="${links.taxonomyIndex("series")}">All series ${directoryArrow}</a>`)}</header>${browseTable(input.options.series, slug => links.taxonomy("series", slug), "Series")}</section>`)}
      ${when(input.options.speakers.length, () => html`<section class="v5-directory-section v5-directory-section--speakers" aria-labelledby="v5-speakers-heading"><header class="v5-directory-heading"><div><h2 id="v5-speakers-heading">Speakers</h2><p>Explore the sermons by speaker.</p></div>${when(links.hasTaxonomyRoutes, () => html`<a href="${links.taxonomyIndex("speakers")}">All speakers ${directoryArrow}</a>`)}</header>${browseTable(input.options.speakers, slug => links.taxonomy("speakers", slug), "Speakers")}</section>`)}
    </div>
  </div>`;
  return pageShell({ title: filtered ? resultsTitle(input.query, input.options) : "SermonsV5",
    description: "Browse sermons from Saving Grace Bible Church by speaker, series, Scripture, Bible book, or service date.",
    canonicalPath: archivePagePath(input.query.page, publicRenderContext), navigationPath: sermonsV5Path,
    robots: "noindex, follow", styles: ["shelf", "v4", "v5"], scripts: ["canon", "journal", "journalPagination"],
    books: input.options.books, mastheadSearch: false, body }, context);
}

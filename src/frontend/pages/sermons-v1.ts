/**
 * SermonsV1: the original Canon landing page, kept intact as an alternate
 * archive presentation at /sermons-v1/. The sermon archive is introduced by
 * the shelf, then the latest sermon as real content, recent sermons, series
 * and speakers.
 */
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { librarySummary } from "../canon";
import { catalogue, entry, nameIndex } from "../components/catalogue";
import { sectionHead, sectionNote } from "../components/sections";
import { shelf, shelfLegend } from "../components/shelf";
import { html, siteName, when, type Html } from "../html";
import { archivePath, publicRenderContext, sermonsV1Path, siteLinks, type FrontendRenderContext } from "../routes";
import { pageShell } from "../shell";

export interface SermonLandingInput {
  sermons: SermonSummary[];
  options: PublicSermonFilterOptions;
  totalItems: number;
}

export const emptyFilterOptions: PublicSermonFilterOptions = {
  speakers: [], series: [], passages: [], books: [], passageVerseAvailability: []
};

export function renderSermonsV1Page(
  input: SermonLandingInput,
  context: FrontendRenderContext = publicRenderContext
): string {
  const links = siteLinks(context);
  const [latest, ...rest] = input.sermons;
  const recent = rest.slice(0, 5);
  const stats = input.totalItems > 0 ? librarySummary(input.totalItems, input.options) : null;
  const hero: Html = html`<section class="hero" aria-labelledby="hero-heading">
    <div class="hero__inner">
      <div class="hero__copy">
        <p class="eyebrow">Sermon archive</p>
        <h1 id="hero-heading" class="hero__title">Sermons, shelved by Scripture.</h1>
        <p class="hero__lede lede">Every sermon is filed under the passage it was preached from. Take a book off the shelf, or search the archive.</p>
        ${stats
          ? html`<ul class="stats hero__stats" role="list">${stats.map((item) => html`<li>${item}</li>`)}</ul>`
          : html`<p class="hero__stats note">No sermons are available yet.</p>`}
      </div>
      <div class="hero__aside">
        ${shelfLegend()}
        <a class="button button--outline" href="${links.archive}">Browse and search sermons</a>
      </div>
    </div>
    <div class="hero__inner hero__inner--shelf">
      <h2 id="shelf-heading" class="sr-only">The bookshelf</h2>
      ${shelf(input.options, { href: (book) => links.taxonomy("books", book.slug), settle: true, skipTo: "after-shelf", headingId: "shelf-heading", caption: html`<p class="shelf__caption"><span>Filled spines have sermons; take one off the shelf to read them.</span><a href="${links.archive}">All sermons</a></p>` })}
    </div>
  </section>
  <span id="after-shelf" tabindex="-1"></span>`;
  const latestSection = latest
    ? html`<section class="section" aria-labelledby="latest-heading">
        ${sectionHead("latest-heading", "Latest sermon")}
        <ul class="catalogue catalogue--cards" role="list"><li>${entry(latest, { variant: "card", headingLevel: 3, links })}</li></ul>
      </section>`
    : html`<section class="section" aria-labelledby="latest-heading">
        ${sectionHead("latest-heading", "Sermons are being prepared")}
        ${sectionNote("No sermon is available yet. Please check back soon.")}
      </section>`;
  const recentSection = recent.length
    ? html`<section class="section" aria-labelledby="recent-heading">
        ${sectionHead("recent-heading", "Recent sermons", html`<a href="${links.archive}?view=recent#results">All sermons, newest first</a>`)}
        ${catalogue(recent, { variant: "row", headingLevel: 3, links })}
      </section>`
    : null;
  const seriesSection = input.options.series.length
    ? html`<section class="section" aria-labelledby="series-heading">
        ${sectionHead("series-heading", "Series", when(links.hasTaxonomyRoutes, () => html`<a href="${links.taxonomyIndex("series")}">All series</a>`))}
        ${nameIndex(input.options.series, (slug) => links.taxonomy("series", slug))}
      </section>`
    : null;
  const speakersSection = input.options.speakers.length
    ? html`<section class="section" aria-labelledby="speakers-heading">
        ${sectionHead("speakers-heading", "Speakers", when(links.hasTaxonomyRoutes, () => html`<a href="${links.taxonomyIndex("speakers")}">All speakers</a>`))}
        ${nameIndex(input.options.speakers, (slug) => links.taxonomy("speakers", slug))}
      </section>`
    : null;
  return pageShell({
    title: "Sermons",
    description: `Sermons from ${siteName}, shelved by the Bible passage they were preached from.`,
    canonicalPath: archivePath,
    navigationPath: sermonsV1Path,
    robots: "noindex, follow",
    styles: ["shelf"],
    scripts: ["canon"],
    books: input.options.books,
    body: html`${hero}${latestSection}${recentSection}${seriesSection}${speakersSection}`
  }, context);
}

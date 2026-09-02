/**
 * The sermon-focused home page: the latest sermon as real content, a short
 * list of recent sermons, and the series index. The same renderer produces
 * the static public home (with no data yet) and the authenticated preview.
 */
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOption } from "../../server/repositories/sermon-repository";
import { sectionHead, sectionNote } from "../components/sections";
import { nameIndex, sermonItem, sermonList } from "../components/sermon-list";
import { html, siteName, when, type Html } from "../html";
import { publicRenderContext, siteLinks, type FrontendRenderContext } from "../routes";
import { pageShell } from "../shell";

export interface FrontendHomePageInput {
  sermons: SermonSummary[];
  series: PublicSermonFilterOption[];
}

export function renderFrontendHomePage(
  input: FrontendHomePageInput,
  context: FrontendRenderContext = publicRenderContext
): string {
  const links = siteLinks(context);
  const [latest, ...rest] = input.sermons;
  const recent = rest.slice(0, 5);
  const latestSection: Html = latest
    ? html`<section class="home-section home-section--latest" aria-labelledby="latest-heading">
        ${sectionHead("latest-heading", "Latest sermon")}
        ${sermonItem(latest, { variant: "featured", headingLevel: 3, links })}
      </section>`
    : html`<section class="home-section" aria-labelledby="latest-heading">
        ${sectionHead("latest-heading", "Sermons are being prepared")}
        ${sectionNote("No sermon is available yet. Please check back soon.")}
      </section>`;
  const recentSection = recent.length
    ? html`<section class="home-section" aria-labelledby="recent-heading">
        ${sectionHead("recent-heading", "Recent sermons", html`<a href="${links.archive}">Browse all sermons</a>`)}
        ${sermonList(recent, { variant: "row", headingLevel: 3, links })}
      </section>`
    : null;
  const seriesSection = input.series.length
    ? html`<section class="home-section" aria-labelledby="series-heading">
        ${sectionHead("series-heading", "Series", when(links.hasTaxonomyRoutes, () => html`<a href="${links.taxonomyIndex("series")}">All series</a>`))}
        ${nameIndex(input.series, (slug) => links.taxonomy("series", slug))}
      </section>`
    : null;
  return pageShell({
    title: siteName,
    suffixTitle: false,
    description: `Sermons from ${siteName}.`,
    canonicalPath: "/",
    robots: "index, follow",
    body: html`<header class="page-head page-head--home">
      <h1>Sermon library</h1>
      <p class="page-head__lede">Recorded sermons from ${siteName}, searchable by speaker, series, Bible book or the passage a sermon was preached from.</p>
      ${when(latest, () => html`<p class="page-head__actions"><a class="button" href="${links.archive}">Browse and search sermons</a></p>`)}
    </header>
    ${latestSection}
    ${recentSection}
    ${seriesSection}`
  }, context);
}

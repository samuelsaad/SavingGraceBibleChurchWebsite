/**
 * Preview-only speaker, series and Bible-book pages: a typographic index and
 * a detail page listing that classification's sermons.
 */
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOption } from "../../server/repositories/sermon-repository";
import { sectionNote } from "../components/sections";
import { nameIndex, sermonList } from "../components/sermon-list";
import { countLabel, html, when } from "../html";
import { previewRenderContext, siteLinks, type FrontendRenderContext, type FrontendTaxonomyKind } from "../routes";
import { pageShell } from "../shell";

const taxonomyLabels = {
  speakers: { singular: "Speaker", plural: "Speakers", lede: "Browse sermons by the person who preached them." },
  series: { singular: "Series", plural: "Series", lede: "Browse sermons by the series they belong to." },
  books: { singular: "Bible book", plural: "Bible books", lede: "Browse sermons by the book of the Bible they are classified under." }
} as const;

export type { FrontendTaxonomyKind };

export function renderFrontendTaxonomyIndex(
  kind: FrontendTaxonomyKind,
  options: PublicSermonFilterOption[],
  context: FrontendRenderContext = previewRenderContext
): string {
  const label = taxonomyLabels[kind];
  const links = siteLinks(context);
  return pageShell({
    title: label.plural,
    canonicalPath: `/${kind}/`,
    robots: "noindex, nofollow",
    body: html`<header class="page-head">
      <h1>${label.plural}</h1>
      <p class="page-head__lede">${label.lede}</p>
    </header>
    ${options.length
      ? html`<div class="name-index-wrap">${nameIndex(options, (slug) => links.taxonomy(kind, slug))}</div>`
      : sectionNote(`No ${label.plural.toLowerCase()} are available yet.`)}`
  }, context);
}

export interface TaxonomyDetailInput {
  kind: FrontendTaxonomyKind;
  option: PublicSermonFilterOption;
  sermons: SermonSummary[];
  /** Total eligible sermons, when the list shown is capped. */
  totalItems?: number;
}

export function renderFrontendTaxonomyDetail(
  input: TaxonomyDetailInput,
  context: FrontendRenderContext = previewRenderContext
): string {
  const label = taxonomyLabels[input.kind];
  const links = siteLinks(context);
  const total = input.totalItems ?? input.sermons.length;
  const truncated = total > input.sermons.length;
  const filterName = input.kind === "speakers" ? "sermon_speaker" : input.kind === "series" ? "sermon_series" : "sermon_book";
  return pageShell({
    title: input.option.name,
    canonicalPath: `/${input.kind}/${input.option.slug}/`,
    robots: "noindex, nofollow",
    body: html`<p class="breadcrumb"><a href="${links.taxonomyIndex(input.kind)}">← All ${label.plural.toLowerCase()}</a></p>
    <header class="page-head">
      <p class="page-head__kind">${label.singular}</p>
      <h1>${input.option.name}</h1>
      <p class="page-head__count">${countLabel(total, "sermon")}</p>
    </header>
    ${input.sermons.length
      ? sermonList(input.sermons, { variant: "row", headingLevel: 2, links })
      : sectionNote("No eligible sermons use this classification yet.")}
    ${when(truncated, () => html`<p class="section-more">Showing the ${input.sermons.length} most recent. <a href="${links.filter(filterName, input.option.slug)}">Browse all ${countLabel(total, "sermon")} in the archive</a>.</p>`)}`
  }, context);
}

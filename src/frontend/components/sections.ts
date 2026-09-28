/**
 * Section furniture shared by pages: signage headings with an optional
 * aside, title pages, quiet notes and pagination.
 */
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { html, when, type Html, type Renderable } from "../html";
import { archiveTarget, paginationUrl, type ArchiveTarget, type FrontendRenderContext } from "../routes";

export function sectionHead(id: string, heading: string, aside?: Renderable): Html {
  return html`<div class="section__head"><h2 id="${id}" class="section__title">${heading}</h2>${when(aside, () => html`<div class="section__aside">${aside}</div>`)}</div>`;
}

/** A calm one-paragraph state for an empty section. */
export function sectionNote(message: string): Html {
  return html`<p class="note">${message}</p>`;
}

export interface TitlePageInput {
  eyebrow: string;
  title: string;
  trail?: Array<{ href: string; label: string }>;
  meta?: Renderable;
  /** Long titles step down one size. */
  longThreshold?: number;
}

/** A page-opening composition: trail, eyebrow, display title, meta line. */
export function titlePage(input: TitlePageInput): Html {
  const isLong = input.title.length > (input.longThreshold ?? 40);
  return html`<header class="title-page">
    ${when(input.trail?.length, () => html`<ol class="trail" role="list">${input.trail!.map((item) => html`<li><a href="${item.href}">${item.label}</a></li>`)}</ol>`)}
    <h1 class="title-page__title${isLong ? " is-long" : ""}">${input.title}</h1>
    <p class="title-page__category">${input.eyebrow}</p>
    ${when(input.meta, () => html`<div class="title-page__meta">${input.meta}</div>`)}
  </header>`;
}

/** Numbered pagination with Previous and Next, preserving filters in URLs. */
export function pagination(
  query: PublicSermonListQuery,
  totalPages: number,
  context: FrontendRenderContext,
  expandedRecent: boolean,
  target: ArchiveTarget = archiveTarget
): Html | null {
  if (totalPages <= 1) return null;
  const page = query.page;
  const url = (candidate: number): string => paginationUrl(candidate, query, context, expandedRecent, target);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((candidate) => candidate === 1 || candidate === totalPages || Math.abs(candidate - page) <= 2);
  return html`<nav class="pagination" aria-label="Sermon result pages"><ul class="pagination__list" role="list">
    ${when(page > 1, () => html`<li><a class="pagination__step" href="${url(page - 1)}" rel="prev">Previous</a></li>`)}
    ${pages.map((candidate, index) => html`${when(index > 0 && candidate - pages[index - 1]! > 1, html`<li class="pagination__gap" aria-hidden="true">…</li>`)}<li>${candidate === page
      ? html`<span class="pagination__page" aria-current="page"><span class="sr-only">Page </span>${candidate}</span>`
      : html`<a class="pagination__page" href="${url(candidate)}"><span class="sr-only">Page </span>${candidate}</a>`}</li>`)}
    ${when(page < totalPages, () => html`<li><a class="pagination__step" href="${url(page + 1)}" rel="next">Next</a></li>`)}
  </ul></nav>`;
}

/**
 * Section furniture shared by pages: headings with an optional aside, quiet
 * notes for empty states, carousels and pagination.
 */
import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { attribute, html, when, type Html, type Renderable } from "../html";
import { paginationUrl, type FrontendRenderContext } from "../routes";

export function sectionHead(id: string, heading: string, aside?: Renderable): Html {
  return html`<div class="section-head"><h2 id="${id}">${heading}</h2>${when(aside, () => html`<div class="section-head__aside">${aside}</div>`)}</div>`;
}

/** A calm one-paragraph state for an empty section. */
export function sectionNote(message: string): Html {
  return html`<p class="section-note">${message}</p>`;
}

export interface CarouselInput {
  id: string;
  heading: string;
  /** Accessible label for the previous/next controls, e.g. "series". */
  itemsLabel: string;
  items: Html[];
  emptyMessage: string;
  /** Optional link rendered beside the controls, e.g. "All series". */
  aside?: Html | null;
}

/** A horizontally scrolling list with Previous/Next controls. Never autoplays. */
export function carousel(input: CarouselInput): Html {
  if (!input.items.length) {
    return html`<section class="discovery" aria-labelledby="${input.id}-heading">${sectionHead(`${input.id}-heading`, input.heading)}${sectionNote(input.emptyMessage)}</section>`;
  }
  const controls = html`${input.aside}<div class="carousel__controls">
    <button class="icon-button" type="button" data-carousel-previous aria-controls="${input.id}-track" aria-disabled="true" hidden><span aria-hidden="true">‹</span><span class="sr-only">Show previous ${input.itemsLabel}</span></button>
    <button class="icon-button" type="button" data-carousel-next aria-controls="${input.id}-track" aria-disabled="false" hidden><span aria-hidden="true">›</span><span class="sr-only">Show more ${input.itemsLabel}</span></button>
  </div>`;
  return html`<section class="discovery carousel" aria-labelledby="${input.id}-heading" data-carousel>
    ${sectionHead(`${input.id}-heading`, input.heading, controls)}
    <ul class="carousel__track" id="${input.id}-track" role="list" aria-label="${input.heading}" data-carousel-track>${input.items.map((item) => html`<li class="carousel__item">${item}</li>`)}</ul>
  </section>`;
}

/** Numbered pagination with Previous and Next, preserving filters in URLs. */
export function pagination(
  query: PublicSermonListQuery,
  totalPages: number,
  context: FrontendRenderContext,
  expandedRecent: boolean
): Html | null {
  if (totalPages <= 1) return null;
  const page = query.page;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((candidate) => candidate === 1 || candidate === totalPages || Math.abs(candidate - page) <= 2);
  return html`<nav class="pagination" aria-label="Sermon result pages"><ul class="pagination__list" role="list">
    ${when(page > 1, () => html`<li><a class="pagination__step" href="${paginationUrl(page - 1, query, context, expandedRecent)}" rel="prev">Previous</a></li>`)}
    ${pages.map((candidate, index) => html`${when(index > 0 && candidate - pages[index - 1]! > 1, html`<li class="pagination__gap" aria-hidden="true">…</li>`)}<li>${candidate === page
      ? html`<span class="pagination__page" aria-current="page"><span class="sr-only">Page </span>${candidate}</span>`
      : html`<a class="pagination__page" href="${paginationUrl(candidate, query, context, expandedRecent)}"><span class="sr-only">Page </span>${candidate}</a>`}</li>`)}
    ${when(page < totalPages, () => html`<li><a class="pagination__step" href="${paginationUrl(page + 1, query, context, expandedRecent)}" rel="next">Next</a></li>`)}
  </ul></nav>`;
}

/** A visually hidden or visible heading depending on the design need. */
export function heading(level: 2 | 3, id: string, text: string, visuallyHidden = false): Html {
  return html`<h${level} id="${id}"${attribute("class", visuallyHidden ? "sr-only" : null)}>${text}</h${level}>`;
}

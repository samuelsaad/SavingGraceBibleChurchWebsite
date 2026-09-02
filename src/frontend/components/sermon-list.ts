/**
 * Sermon list items and series cards.
 *
 * One item component serves every sermon list on the site so the hierarchy
 * (passage kicker → title → date · speaker · series → description) is
 * defined once. The title is the only link to the sermon; CSS extends its
 * hit area over the whole item, and the speaker/series links are lifted
 * above that area.
 */
import type { RelatedSermonSummary, SermonSummary } from "../../domain/sermon";
import type { PublicSeriesRepresentative } from "../../server/repositories/sermon-repository";
import { attribute, html, singleLine, timeElement, when, type Html } from "../html";
import type { SiteLinks } from "../routes";

export type SermonItemVariant =
  /** Three newest sermons on the landing: landscape, clamped description. */
  | "recent"
  /** Archive results and taxonomy pages: landscape list rows. */
  | "row"
  /** Carousel cards. */
  | "card"
  /** Related sermons on the detail page. */
  | "related"
  /** Home page featured sermon: full description. */
  | "featured";

export interface SermonItemOptions {
  variant: SermonItemVariant;
  headingLevel: 2 | 3;
  links: SiteLinks;
  reasons?: RelatedSermonSummary["relationshipReasons"];
  /** Position in a continuous newest-first archive, shown beside the date. */
  ordinal?: number;
}

const reasonLabels: Record<RelatedSermonSummary["relationshipReasons"][number], string> = {
  same_series: "same series",
  overlapping_scripture: "overlapping passage",
  same_bible_book: "same Bible book",
  same_speaker: "same speaker"
};

export function relatedReasonLabel(reasons: RelatedSermonSummary["relationshipReasons"]): string {
  return reasons.map((reason) => reasonLabels[reason]).join(", ");
}

function normalisedReference(value: string): string {
  return value.replace(/[\u2010-\u2015\u2212-]/gu, "-").replace(/\s+/gu, " ").trim().toLowerCase();
}

/** True when the title already carries every reviewed passage reference. */
export function titleCarriesPassage(sermon: SermonSummary): boolean {
  if (!sermon.primaryPassages.length) return false;
  const title = normalisedReference(sermon.title);
  return sermon.primaryPassages.every((item) => title.includes(normalisedReference(item.displayText)));
}

/**
 * The reviewed passage the sermon was preached from, leading the item. It is
 * omitted when the title itself already states the same reference so the
 * passage is never printed twice beside the title.
 */
export function passageKicker(sermon: SermonSummary, className: string): Html | null {
  if (!sermon.primaryPassages.length || titleCarriesPassage(sermon)) return null;
  const passage = sermon.primaryPassages.map((item) => item.displayText).join(", ");
  return html`<p class="${className}"><span class="sr-only">Preached from </span>${passage}</p>`;
}

function metaLine(sermon: SermonSummary, links: SiteLinks, ordinal?: number): Html {
  return html`<p class="sermon-item__meta">
    ${when(ordinal, () => html`<span class="sermon-item__ordinal" aria-hidden="true">${ordinal}</span>`)}
    <span class="sermon-item__date">${timeElement(sermon.serviceDate)}</span>
    ${when(sermon.speaker, () => html`<span class="sermon-item__speaker"><a href="${links.taxonomy("speakers", sermon.speaker!.slug)}">${sermon.speaker!.name}</a></span>`)}
    ${when(sermon.series.length, () => html`<span class="sermon-item__series">${sermon.series.map((item, index) => html`${index > 0 ? ", " : ""}<a href="${links.taxonomy("series", item.slug)}">${item.name}</a>`)}</span>`)}
  </p>`;
}

/** Renders one sermon as an <article> for lists, cards and related sermons. */
export function sermonItem(sermon: SermonSummary, options: SermonItemOptions): Html {
  const { variant, links } = options;
  const heading = `h${options.headingLevel}`;
  const description = sermon.summary ? singleLine(sermon.summary) : null;
  const descriptionClass = variant === "featured" ? "sermon-item__description" : "sermon-item__description sermon-item__description--clamped";
  return html`<article class="sermon-item sermon-item--${variant}">
    ${passageKicker(sermon, "sermon-item__kicker")}
    <${heading} class="sermon-item__title"><a href="${links.sermon(sermon.slug)}">${sermon.title}</a></${heading}>
    ${metaLine(sermon, links, options.ordinal)}
    ${when(options.reasons?.length, () => html`<p class="sermon-item__reason">Related by ${relatedReasonLabel(options.reasons!)}</p>`)}
    ${when(description && variant !== "related", () => html`<p class="${descriptionClass}">${description}</p>`)}
  </article>`;
}

/**
 * Renders a list of sermons. With `ordinalStart` the list is an ordered list
 * whose numbering continues across archive pages.
 */
export function sermonList(
  sermons: SermonSummary[],
  options: SermonItemOptions,
  className = "sermon-list",
  ordinalStart?: number
): Html {
  if (ordinalStart !== undefined) {
    return html`<ol class="${className}" role="list" start="${ordinalStart}">${sermons.map((sermon, index) => html`<li>${sermonItem(sermon, { ...options, ordinal: ordinalStart + index })}</li>`)}</ol>`;
  }
  return html`<ul class="${className}" role="list">${sermons.map((sermon) => html`<li>${sermonItem(sermon, options)}</li>`)}</ul>`;
}

/** A series entity card: the series name leads, its latest sermon follows. */
export function seriesCard(representative: PublicSeriesRepresentative, links: SiteLinks): Html {
  const { series, sermon } = representative;
  return html`<article class="series-card">
    <h3 class="series-card__name"><a href="${links.taxonomy("series", series.slug)}">${series.name}</a></h3>
    <p class="series-card__label">Latest sermon</p>
    <p class="series-card__sermon"><a href="${links.sermon(sermon.slug)}">${sermon.title}</a></p>
    <p class="series-card__meta">${timeElement(sermon.serviceDate)}${when(sermon.speaker, () => html` · ${sermon.speaker!.name}`)}</p>
  </article>`;
}

/** Simple typographic index of speakers, series or Bible books. */
export function nameIndex(items: Array<{ name: string; slug: string }>, href: (slug: string) => string, current?: string): Html {
  return html`<ul class="name-index" role="list">${items.map((item) => html`<li><a href="${href(item.slug)}"${attribute("aria-current", item.slug === current ? "page" : null)}>${item.name}</a></li>`)}</ul>`;
}

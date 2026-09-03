/**
 * Catalogue entries, indexes and chips.
 *
 * One entry component serves every sermon list on the site so the hierarchy
 * (passage stamp → title → date · speaker · series → description) is defined
 * once. The title is the only link to the sermon; CSS extends its hit area
 * over the whole entry, and the speaker/series links are lifted above it.
 */
import { bibleBookBySlug } from "../../domain/bible-passage";
import type { RelatedSermonSummary, SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOption } from "../../server/repositories/sermon-repository";
import { formatCount } from "../canon";
import { attribute, html, singleLine, timeElement, when, type Html } from "../html";
import type { SiteLinks } from "../routes";
import { bookTab } from "./shelf";

export type EntryVariant = "card" | "row" | "related";

export interface EntryOptions {
  variant: EntryVariant;
  headingLevel: 2 | 3;
  links: SiteLinks;
  ordinal?: number;
  reasons?: RelatedSermonSummary["relationshipReasons"];
  /** Sermon counts by book slug, for the card's tab sticker. */
  bookCounts?: Map<string, number>;
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
  return value.replace(/[‐-―−-]/gu, "-").replace(/\s+/gu, " ").trim().toLowerCase();
}

/** True when the title already carries every reviewed passage reference. */
export function titleCarriesPassage(sermon: SermonSummary): boolean {
  if (!sermon.primaryPassages.length) return false;
  const title = normalisedReference(sermon.title);
  return sermon.primaryPassages.every((item) => title.includes(normalisedReference(item.displayText)));
}

/** The reviewed passage, as a signage stamp; omitted when the title already states it. */
export function passageStamp(sermon: SermonSummary, className: string): Html | null {
  if (!sermon.primaryPassages.length || titleCarriesPassage(sermon)) return null;
  return html`<p class="${className}"><span class="sr-only">Preached from </span>${sermon.primaryPassages.map((item) => item.displayText).join(", ")}</p>`;
}

/** The first classified book, which colours the entry's chip or tab. */
export function primaryBook(sermon: SermonSummary) {
  const first = sermon.books[0];
  return first ? bibleBookBySlug(first.slug) : null;
}

function metaLine(sermon: SermonSummary, links: SiteLinks): Html {
  return html`<p class="entry__meta">
    <span>${timeElement(sermon.serviceDate)}</span>
    ${when(sermon.speaker, () => html`<span><a href="${links.taxonomy("speakers", sermon.speaker!.slug)}">${sermon.speaker!.name}</a></span>`)}
    ${when(sermon.series.length, () => html`<span>${sermon.series.map((item, index) => html`${index > 0 ? ", " : ""}<a href="${links.taxonomy("series", item.slug)}">${item.name}</a>`)}</span>`)}
  </p>`;
}

/** Renders one sermon as an <article>. */
export function entry(sermon: SermonSummary, options: EntryOptions): Html {
  const { variant, links } = options;
  const heading = `h${options.headingLevel}`;
  const book = primaryBook(sermon);
  const description = sermon.summary ? singleLine(sermon.summary) : null;
  const lead = variant === "card"
    ? html`<div class="entry__tab">${bookTab(book, { href: book ? links.taxonomy("books", book.slug) : null, count: book ? options.bookCounts?.get(book.slug) ?? null : null, ghost: !book })}</div>`
    : variant === "row"
      ? (options.ordinal !== undefined
        ? html`<span class="entry__ordinal" aria-hidden="true">${options.ordinal}</span>`
        : html`<span class="entry__chipwrap${book ? ` hue--${book.category}` : ""}" aria-hidden="true"><span class="entry__chip"></span></span>`)
      : null;
  return html`<article class="entry entry--${variant}${book ? ` hue--${book.category}` : ""}">
    ${lead}
    ${passageStamp(sermon, "entry__stamp")}
    <${heading} class="entry__title"><a href="${links.sermon(sermon.slug)}">${sermon.title}</a></${heading}>
    ${metaLine(sermon, links)}
    ${when(options.reasons?.length, () => html`<p class="entry__reason">Related by ${relatedReasonLabel(options.reasons!)}</p>`)}
    ${when(description && variant !== "related", () => html`<p class="entry__desc${variant === "row" ? " entry__desc--clamp" : ""}">${description}</p>`)}
  </article>`;
}

export interface CatalogueOptions extends Omit<EntryOptions, "ordinal"> {
  className?: string;
  /** Continuous numbering across archive pages. */
  ordinalStart?: number;
}

/** A list of sermons, numbered continuously when `ordinalStart` is given. */
export function catalogue(sermons: SermonSummary[], options: CatalogueOptions): Html {
  const className = options.className ?? "catalogue";
  if (options.ordinalStart !== undefined) {
    return html`<ol class="${className}" role="list" start="${options.ordinalStart}">${sermons.map((sermon, index) => html`<li>${entry(sermon, { ...options, ordinal: options.ordinalStart! + index })}</li>`)}</ol>`;
  }
  return html`<ul class="${className}" role="list">${sermons.map((sermon) => html`<li>${entry(sermon, options)}</li>`)}</ul>`;
}

/** Typographic index of speakers, series or books, with counts when known. */
export function nameIndex(items: PublicSermonFilterOption[], href: (slug: string) => string, single = false): Html {
  return html`<ul class="index${single ? " index--single" : ""}" role="list">${items.map((item) => html`<li><a href="${href(item.slug)}"><span>${item.name}</span>${when(item.sermonCount !== undefined, () => html`<span class="index__count">${formatCount(item.sermonCount!, "sermon")}</span>`)}</a></li>`)}</ul>`;
}

/** Filter chips with counts. */
export function chips(items: PublicSermonFilterOption[], href: (slug: string) => string, current?: string): Html {
  return html`<ul class="chips" role="list">${items.map((item) => html`<li><a class="chip" href="${href(item.slug)}"${attribute("aria-current", item.slug === current ? "true" : null)}>${item.name}${when(item.sermonCount !== undefined, () => html`<span class="chip__count">${item.sermonCount}</span>`)}</a></li>`)}</ul>`;
}

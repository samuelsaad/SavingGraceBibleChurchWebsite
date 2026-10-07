/**
 * The V4 card system, shared by SermonsV4 and the homepage's Recent Sermons.
 *
 * Every sermon is a book taken off the 66-book shelf. Where a photograph
 * would sit there is a generated "plate": a panel in the sermon's cloth hue
 * lettered with the Bible book and the reference, ribbed like the shelf's
 * spines and finished with a to-scale "you are here" strip of the canon.
 * Nothing is fetched. Below the plate: date and series, the title as the
 * single link (its hit area covers the card), speaker and passages, a short
 * excerpt, and a footer with the book link. Every card has the same anatomy
 * and size; the latest sermon is the first card, marked by a gilt ribbon and
 * a gilt frame, never by a larger slot.
 */
import type { SermonSummary } from "../../domain/sermon";
import { canonSegments, categoryLabel, excerpt, totalChapters } from "../canon";
import { attribute, html, raw, timeElement, when, type Html } from "../html";
import type { SiteLinks } from "../routes";
import { primaryBook, titleCarriesPassage } from "./catalogue";
import { shelfMark } from "./marks";
import { recordingDurationLabel, sermonRecordingDuration } from "./recording-duration";

export interface SermonCardOptions {
  links: SiteLinks;
  headingLevel: 2 | 3;
  /** Marks the newest sermon; rendered once per list. */
  latest?: boolean;
  /** Continuous result number on archive pages. */
  ordinal?: number;
}

/** The minimum width of the "you are here" marker so single-chapter books stay visible. */
const markerMinimum = 14;

/** The reference without the book's own name, for the plate: "Romans 8:28–30" becomes "8:28–30". */
function plateReference(sermon: SermonSummary, bookName: string | null): string | null {
  const lead = sermon.primaryPassages.find((item) => item.isLead) ?? sermon.primaryPassages[0];
  if (!lead) return null;
  const text = lead.displayText.trim();
  if (bookName && text.toLowerCase().startsWith(bookName.toLowerCase())) {
    const rest = text.slice(bookName.length).trim();
    return rest || null;
  }
  return text;
}

/** Three rectangles: the canon before the book, the book itself in gilt, the canon after. */
function positionStrip(bookSlug: string | null): Html {
  const segment = bookSlug ? canonSegments.find((item) => item.book.slug === bookSlug) : undefined;
  if (!segment) {
    return raw(`<svg class="card__strip card__strip--plain" viewBox="0 0 ${totalChapters} 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="0" y="0" width="${totalChapters}" height="8" /></svg>`);
  }
  const width = Math.max(segment.length, markerMinimum);
  const start = Math.min(segment.start, totalChapters - width);
  const after = totalChapters - start - width;
  return raw(`<svg class="card__strip" viewBox="0 0 ${totalChapters} 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="0" y="0" width="${start}" height="8" /><rect class="card__strip-here" x="${start}" y="0" width="${width}" height="8" />${after > 0 ? `<rect x="${start + width}" y="0" width="${after}" height="8" />` : ""}</svg>`);
}

function titleSize(title: string): string {
  if (title.length >= 64) return " is-longest";
  if (title.length >= 48) return " is-long";
  return "";
}

/** One sermon as an equal-size card. */
export function sermonCard(sermon: SermonSummary, options: SermonCardOptions): Html {
  const { links } = options;
  const heading = `h${options.headingLevel}`;
  const book = primaryBook(sermon);
  const topical = sermon.isTopical === true;
  const plain = !book && !topical;
  const hue = topical ? " hue--topical" : book ? ` hue--${book.category}` : "";
  const group = topical ? "Topical" : book ? categoryLabel(book.category) : "Not yet shelved";
  const reference = plateReference(sermon, book?.canonicalName ?? null);
  const passages = sermon.primaryPassages.map((item) => item.displayText).join(", ");
  const showPassages = passages.length > 0 && !titleCarriesPassage(sermon);
  const description = sermon.summary ? excerpt(sermon.summary, 150) : null;
  const plate = html`<div class="card__plate" aria-hidden="true">
      <span class="card__group">${group}</span>
      ${when(options.ordinal !== undefined && !options.latest, () => html`<span class="card__ordinal">${options.ordinal}</span>`)}
      ${book
        ? html`<span class="card__bookname">${book.canonicalName}</span>${when(reference, () => html`<span class="card__ref">${reference}</span>`)}`
        : topical
          ? html`<span class="card__bookname">Topical</span>${when(reference, () => html`<span class="card__ref">${passages}</span>`)}`
          : html`<span class="card__device">${shelfMark("card__mark")}</span>`}
      ${positionStrip(book?.slug ?? null)}
    </div>`;
  return html`<article class="card${hue}${options.latest ? " card--latest" : ""}${plain ? " card--plain" : ""}">
    ${plate}
    <div class="card__body">
      ${when(options.latest, () => html`<span class="card__flag">Latest<span class="sr-only"> sermon.</span></span>`)}
      ${when(options.ordinal !== undefined, () => html`<span class="sr-only">Result ${options.ordinal}.</span>`)}
      <p class="card__top"><span>${timeElement(sermon.serviceDate)}</span>${when(sermonRecordingDuration(sermon), () => html`<span>${recordingDurationLabel(sermonRecordingDuration(sermon))}</span>`)}${when(sermon.series.length, () => html`<span class="card__series"><span class="sr-only">Series: </span>${sermon.series.map((item, index) => html`${index > 0 ? ", " : ""}<a href="${links.taxonomy("series", item.slug)}">${item.name}</a>`)}</span>`)}${when(sermon.reviewState === "draft_awaiting_review", () => html`<span class="card__pill">Draft · awaiting administrator review</span>`)}</p>
      <${heading} class="card__title${titleSize(sermon.title)}"><a href="${links.sermon(sermon.slug)}">${sermon.title}</a></${heading}>
      ${when(sermon.speaker || showPassages, () => html`<p class="card__meta">${when(sermon.speaker, () => html`<span><span class="sr-only">Preacher: </span><a href="${links.taxonomy("speakers", sermon.speaker!.slug)}">${sermon.speaker!.name}</a></span>`)}${when(sermon.speaker && showPassages, () => html`<span class="card__dot" aria-hidden="true">·</span>`)}${when(showPassages, () => html`<span><span class="sr-only">Passage: </span>${passages}</span>`)}</p>`)}
      ${when(description, () => html`<p class="card__desc">${description}</p>`)}
    </div>
    <p class="card__foot"><span class="card__cta" aria-hidden="true">Read the sermon</span>${book
      ? html`<a class="card__booklink" href="${links.taxonomy("books", book.slug)}"><span class="sr-only">Book: </span>${book.canonicalName}<span class="sr-only">, ${categoryLabel(book.category)}</span></a>`
      : topical ? html`<span class="card__booklink card__booklink--plain">Topical</span>` : null}</p>
  </article>`;
}

export interface CardGridOptions extends Omit<SermonCardOptions, "latest" | "ordinal"> {
  /** Numbers cards continuously from this ordinal (archive result pages). */
  ordinalStart?: number;
  /** Marks the first card as the latest sermon. */
  latestFirst?: boolean;
  className?: string;
}

/** An equal-size grid of cards. */
export function cardGrid(sermons: SermonSummary[], options: CardGridOptions): Html {
  const className = options.className ?? "cards";
  const items = sermons.map((sermon, index) => html`<li>${sermonCard(sermon, {
    links: options.links,
    headingLevel: options.headingLevel,
    latest: options.latestFirst === true && index === 0,
    ...(options.ordinalStart !== undefined ? { ordinal: options.ordinalStart + index } : {})
  })}</li>`);
  return options.ordinalStart !== undefined
    ? html`<ol class="${className}" role="list"${attribute("start", options.ordinalStart)}>${items}</ol>`
    : html`<ul class="${className}" role="list">${items}</ul>`;
}

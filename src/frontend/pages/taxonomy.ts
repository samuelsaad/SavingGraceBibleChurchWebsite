/**
 * Preview-only speaker, series and Bible-book pages: typographic indexes
 * with counts, the books index as the full shelf plus a text table, and
 * detail pages as title pages with the open book for a Bible book.
 */
import { bibleBookBySlug } from "../../domain/bible-passage";
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOption, PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { formatCount } from "../canon";
import { catalogue, nameIndex } from "../components/catalogue";
import { sectionNote, titlePage } from "../components/sections";
import { canonStrip, canonTable, openBook, shelf } from "../components/shelf";
import { html, when } from "../html";
import { previewRenderContext, siteLinks, type FrontendRenderContext, type FrontendTaxonomyKind } from "../routes";
import { pageShell } from "../shell";

const labels = {
  speakers: { singular: "Speaker", plural: "Speakers", lede: "Browse sermons by the person who preached them." },
  series: { singular: "Series", plural: "Series", lede: "Browse sermons by the series they belong to." },
  books: { singular: "Bible book", plural: "Bible books", lede: "Every sermon is shelved under the book it was preached from." }
} as const;

const emptyOptions: PublicSermonFilterOptions = { speakers: [], series: [], passages: [], books: [], passageVerseAvailability: [] };
const emptyQuery = { order: "DESC" as const, page: 1, pageSize: 9 };

export type { FrontendTaxonomyKind };

export function renderFrontendTaxonomyIndex(
  kind: FrontendTaxonomyKind,
  items: PublicSermonFilterOption[],
  context: FrontendRenderContext = previewRenderContext,
  options: PublicSermonFilterOptions = emptyOptions
): string {
  const label = labels[kind];
  const links = siteLinks(context);
  const body = kind === "books"
    ? html`${titlePage({ eyebrow: "Sermon archive", title: "Bible books", meta: html`<span>${label.lede}</span>` })}
      <h2 id="shelf-heading" class="sr-only">The bookshelf</h2>
      ${shelf({ ...options, books: items }, { href: (book) => links.taxonomy("books", book.slug), settle: true, skipTo: "after-shelf", headingId: "shelf-heading" })}
      <span id="after-shelf" tabindex="-1"></span>
      ${canonTable({ ...options, books: items }, (book) => links.taxonomy("books", book.slug))}`
    : html`${titlePage({ eyebrow: "Sermon archive", title: label.plural, meta: html`<span>${label.lede}</span>` })}
      ${items.length ? nameIndex(items, (slug) => links.taxonomy(kind, slug)) : sectionNote(`No ${label.plural.toLowerCase()} are available yet.`)}`;
  return pageShell({
    title: label.plural,
    canonicalPath: `/${kind}/`,
    robots: "noindex, nofollow",
    styles: kind === "books" ? ["shelf"] : [],
    scripts: kind === "books" ? ["canon"] : [],
    books: kind === "books" ? items : options.books,
    body
  }, context);
}

export interface TaxonomyDetailInput {
  kind: FrontendTaxonomyKind;
  option: PublicSermonFilterOption;
  sermons: SermonSummary[];
  /** Total eligible sermons, when the list shown is capped. */
  totalItems?: number;
  options?: PublicSermonFilterOptions;
}

export function renderFrontendTaxonomyDetail(
  input: TaxonomyDetailInput,
  context: FrontendRenderContext = previewRenderContext
): string {
  const label = labels[input.kind];
  const links = siteLinks(context);
  const options = input.options ?? emptyOptions;
  const total = input.totalItems ?? input.sermons.length;
  const truncated = total > input.sermons.length;
  const filterName = input.kind === "speakers" ? "sermon_speaker" : input.kind === "series" ? "sermon_series" : "sermon_book";
  const book = input.kind === "books" ? bibleBookBySlug(input.option.slug) : null;
  const shelvedBooks = new Map<string, PublicSermonFilterOption>();
  for (const sermon of input.sermons) for (const item of sermon.books) if (!shelvedBooks.has(item.slug)) shelvedBooks.set(item.slug, item);
  const head = book
    ? openBook({ book, query: { ...emptyQuery }, options, context, count: total, headingLevel: 1, broad: true })
    : titlePage({
      eyebrow: label.singular,
      title: input.option.name,
      trail: [{ href: links.taxonomyIndex(input.kind), label: label.plural }],
      meta: html`<span>${formatCount(total, "sermon")}</span>`
    });
  const list = input.sermons.length
    ? catalogue(input.sermons, { variant: "row", headingLevel: book ? 2 : 2, links, ordinalStart: 1 })
    : sectionNote("No eligible sermons use this classification yet.");
  return pageShell({
    title: input.option.name,
    canonicalPath: `/${input.kind}/${input.option.slug}/`,
    robots: "noindex, nofollow",
    styles: ["shelf"],
    scripts: ["canon"],
    books: options.books,
    body: html`${when(book, () => html`<ol class="trail" role="list"><li><a href="${links.taxonomyIndex("books")}">Bible books</a></li></ol>`)}
      ${head}
      ${when(!book && shelvedBooks.size && !truncated, () => html`<div class="section"><p class="eyebrow">Preached from</p>${canonStrip({ books: [...shelvedBooks.values()] }, { label: input.sermons.length === 1 ? "The book preached from in this sermon" : `Books preached from in these ${formatCount(input.sermons.length, "sermon")}` })}</div>`)}
      <section class="section" aria-labelledby="list-heading">
        <h2 id="list-heading" class="section__title">${book ? `Sermons in ${book.canonicalName}` : "Sermons"}</h2>
        ${list}
        ${when(truncated, () => html`<p class="note">Showing the ${input.sermons.length} most recent. <a href="${links.filter(filterName, input.option.slug)}">Browse all ${formatCount(total, "sermon")} in the archive</a>.</p>`)}
      </section>`
  }, context);
}

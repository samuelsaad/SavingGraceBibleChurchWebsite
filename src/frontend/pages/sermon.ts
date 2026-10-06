/**
 * The sermon page: a reading room. The book tab at the left, the reading
 * column with the description, the video plate, the open transcript and the
 * questions, related sermons at the end, and an "On this page" rail.
 *
 * Transcript and Q&A wording is rendered exactly as approved. The transcript
 * is a native disclosure, open by default; Q&A answers stay open in flow.
 */
import type { SermonDetail } from "../../domain/sermon";
import type { PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { formatCount, readingStats } from "../canon";
import { entry, passageStamp, primaryBook } from "../components/catalogue";
import { mediaSection } from "../components/media";
import { bookTab, canonStrip, topicalTab } from "../components/shelf";
import { formattedDate, html, plainTextParagraphs, timeElement, when, type Html } from "../html";
import { archivePath, contextualPath, publicRenderContext, siteLinks, withFilter, type FrontendRenderContext } from "../routes";
import { pageShell } from "../shell";

export interface SermonPageOptions {
  /** Filter options, for the tab count and the canon strip. */
  options?: PublicSermonFilterOptions;
}

const emptyOptions: PublicSermonFilterOptions = { speakers: [], series: [], passages: [], books: [], passageVerseAvailability: [] };
const emptyQuery = { order: "DESC" as const, page: 1, pageSize: 9 };

function contents(sermon: SermonDetail): Html | null {
  const entries: Array<[string, string]> = [];
  if (sermon.summary) entries.push(["about", "About this sermon"]);
  if (sermon.media.length) entries.push(["watch", "Watch"]);
  if (sermon.transcript) entries.push(["transcript", "Transcript"]);
  if (sermon.questionAnswers.length) entries.push(["questions", "Questions"]);
  if (sermon.relatedSermons.length) entries.push(["related", "Related sermons"]);
  if (entries.length < 2) return null;
  return html`<nav class="rail__contents" aria-labelledby="contents-heading" data-contents><p id="contents-heading" class="rail__title">On this page</p><ul class="rail__list" role="list">${entries.map(([id, label]) => html`<li><a href="#${id}">${label}</a></li>`)}</ul></nav>`;
}

export function renderPublicSermonPage(
  sermon: SermonDetail,
  context: FrontendRenderContext = publicRenderContext,
  pageOptions: SermonPageOptions = {}
): string {
  const options = pageOptions.options ?? emptyOptions;
  const links = siteLinks(context);
  const book = primaryBook(sermon);
  const bookCount = book ? options.books.find((item) => item.slug === book.slug)?.sermonCount ?? null : null;
  const canonicalPath = `/sermons/${sermon.slug}/`;
  const metadataDescription = sermon.seoDescription ?? sermon.summary ?? undefined;
  const isLongTitle = sermon.title.length > 40;
  const contentLanguage=sermon.language??'en';
  const contentAttributes=contentLanguage==='ar'?html` lang="ar" dir="rtl"`:null;
  const stats = sermon.transcript ? readingStats(sermon.transcript.bodyText) : null;
  const trail = html`<ol class="trail" role="list">
    <li><a href="${contextualPath(context, archivePath)}">Sermons</a></li>
    ${when(book, () => html`<li><a href="${links.taxonomy("books", book!.slug)}">${book!.canonicalName}</a></li>`)}
  </ol>`;
  const noPrimaryNote = context.mode === "preview" && sermon.primaryPassageState === "none"
    ? html`<span class="sermon__note">No single primary passage (reviewed outcome)</span>`
    : null;
  const head = html`<header class="sermon__head">
    ${canonStrip(options, { current: book?.slug, label: book ? `${book.canonicalName} on the shelf` : undefined })}
    ${trail}
    ${passageStamp(sermon, "sermon__stamp")}
    <h1 class="sermon__title${isLongTitle ? " is-long" : ""}"${contentAttributes}>${sermon.title}</h1>
    <p class="sermon__meta">
      <span>${timeElement(sermon.serviceDate)}</span>
      ${when(sermon.speaker, () => html`<span><a href="${links.taxonomy("speakers", sermon.speaker!.slug)}">${sermon.speaker!.name}</a></span>`)}
      ${when(sermon.series.length, () => html`<span>${sermon.series.map((item, index) => html`${index > 0 ? ", " : ""}<a href="${links.taxonomy("series", item.slug)}">${item.name}</a>`)}</span>`)}
      ${noPrimaryNote}
    </p>
  </header>`;
  const description = sermon.summary
    ? html`<section class="sermon-section sermon-section--description" id="about" aria-labelledby="about-heading">
        <h2 id="about-heading" class="sr-only">About this sermon</h2>
        <div class="prose prose--lede"${contentAttributes}>${plainTextParagraphs(sermon.summary)}</div>
      </section>`
    : null;
  const reviewNotice = sermon.reviewState === "draft_awaiting_review"
    ? html`<section class="sermon-section" aria-labelledby="draft-review-heading">
        <h2 id="draft-review-heading" class="section__title">Draft review status</h2>
        <p class="sermon__note">Private draft awaiting administrator review. Nothing on this page is approved or published.</p>
        ${when(sermon.reviewProvenance, () => html`<dl class="rail__meta">
          <dt>Source hash</dt><dd><code>${sermon.reviewProvenance!.sourceSha256}</code></dd>
          <dt>Processing version</dt><dd><code>${sermon.reviewProvenance!.processingVersion}</code></dd>
          <dt>Transcript</dt><dd>Draft</dd>
          <dt>Description</dt><dd>Draft</dd>
          <dt>Questions and answers</dt><dd>Draft</dd>
        </dl>`)}
        ${when(Boolean(sermon.reviewWarnings?.length), () => html`<h3>Warnings and findings requiring review</h3>
          <ul>${sermon.reviewWarnings!.map((warning) => html`<li><strong>${warning.code}</strong>: ${warning.detail}</li>`)}</ul>`)}
      </section>`
    : null;
  const transcript = sermon.transcript
    ? html`<section class="sermon-section" id="transcript" aria-labelledby="transcript-heading">
        <h2 id="transcript-heading" class="section__title">Transcript</h2>
        <details class="transcript" open data-open-for-print>
          <summary class="transcript__summary"><span class="transcript__label--closed">Read the transcript</span><span class="transcript__label--open">Hide the transcript</span>${when(stats, () => html`<span class="transcript__stats">${formatCount(stats!.words, "word")} · about ${formatCount(stats!.minutes, "minute")}</span>`)}</summary>
          <div class="prose transcript__body"${contentAttributes}>${plainTextParagraphs(sermon.transcript.bodyText)}</div>
          <p class="transcript__back"><a href="#transcript-heading">Back to the top of the transcript</a></p>
        </details>
      </section>`
    : null;
  const questions = sermon.questionAnswers.length
    ? html`<section class="sermon-section" id="questions" aria-labelledby="questions-heading">
        <h2 id="questions-heading" class="section__title">Questions for reflection</h2>
        <ol class="questions" role="list"${contentAttributes}>${sermon.questionAnswers.map((item, index) => html`<li class="question">
          <span class="question__number" aria-hidden="true">${index + 1}</span>
          <h3 class="question__title"><span class="sr-only">Question ${index + 1}: </span>${item.question}</h3>
          <div class="prose question__answer">${plainTextParagraphs(item.answer)}</div>
        </li>`)}</ol>
      </section>`
    : null;
  const related = sermon.relatedSermons.length
    ? html`<section class="sermon-section" id="related" aria-labelledby="related-heading">
        <h2 id="related-heading" class="section__title">Related sermons</h2>
        <ul class="catalogue catalogue--related" role="list">${sermon.relatedSermons.map((item) => html`<li>${entry(item, { variant: "related", headingLevel: 3, links, reasons: item.relationshipReasons })}</li>`)}</ul>
      </section>`
    : null;
  const rail = html`<aside class="sermon__rail" aria-label="Sermon details">
    <div class="rail">
      ${contents(sermon)}
      <dl class="rail__meta">
        <dt>Preached</dt><dd>${formattedDate(sermon.serviceDate)}</dd>
        ${when(sermon.speaker, () => html`<dt>Speaker</dt><dd><a href="${links.taxonomy("speakers", sermon.speaker!.slug)}">${sermon.speaker!.name}</a></dd>`)}
        ${when(sermon.series.length, () => html`<dt>Series</dt><dd>${sermon.series.map((item, index) => html`${index > 0 ? ", " : ""}<a href="${links.taxonomy("series", item.slug)}">${item.name}</a>`)}</dd>`)}
        ${when(sermon.primaryPassages.length, () => html`<dt>Preached from</dt><dd>${sermon.primaryPassages.map((item) => item.displayText).join(", ")}</dd>`)}
        ${when(book, () => html`<dt>Shelved under</dt><dd><a href="${links.taxonomy("books", book!.slug)}">${book!.canonicalName}</a></dd>`)}
      </dl>
    </div>
  </aside>`;
  const tab = html`<div class="sermon__tab">${sermon.isTopical ? topicalTab() : bookTab(book, { href: book ? withFilter({ ...emptyQuery }, { passageBook: book.slug, passageScope: "book" }, context, "canon") : null, count: bookCount, ghost: !book })}</div>`;
  return pageShell({
    title: sermon.title,
    ...(metadataDescription ? { description: metadataDescription } : {}),
    canonicalPath,
    robots: "index, follow",
    openGraphType: "article",
    styles: ["shelf", "sermon", "claudeSermons"],
    scripts: ["sermon"],
    books: options.books,
    body: html`<div class="claude-sermons"><article class="sermon${book ? ` hue--${book.category}` : ""}">
      ${tab}
      <div class="sermon__body">
        ${head}
        ${reviewNotice}
        ${description}
        ${mediaSection(sermon)}
        ${transcript}
        ${questions}
        ${related}
      </div>
      ${rail}
    </article></div>`
  }, context);
}

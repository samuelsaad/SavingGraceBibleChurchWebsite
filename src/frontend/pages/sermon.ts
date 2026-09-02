/**
 * The sermon detail page, in the required order: title and metadata, the
 * approved description, the click-to-load player, the transcript, the
 * ordered questions and answers, then metadata-based related sermons.
 *
 * Transcript and Q&A wording is rendered exactly as approved. The transcript
 * uses a native disclosure; Q&A answers stay open in normal flow.
 */
import type { SermonDetail } from "../../domain/sermon";
import { mediaSection } from "../components/media";
import { passageKicker, sermonItem } from "../components/sermon-list";
import { html, plainTextParagraphs, timeElement, when, type Html } from "../html";
import { archivePath, contextualPath, publicRenderContext, siteLinks, type FrontendRenderContext } from "../routes";
import { pageShell } from "../shell";

function sermonHeader(sermon: SermonDetail, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  const books = !sermon.primaryPassages.length && sermon.books.length
    ? html`<span class="sermon__books"><span class="sermon__label">Bible book</span> ${sermon.books.map((item, index) => html`${index > 0 ? ", " : ""}<a href="${links.taxonomy("books", item.slug)}">${item.name}</a>`)}</span>`
    : null;
  const noPrimaryNote = context.mode === "preview" && sermon.primaryPassageState === "none"
    ? html`<span class="sermon__note">No single primary passage (reviewed outcome)</span>`
    : null;
  return html`<header class="sermon__head">
    ${passageKicker(sermon, "sermon__kicker")}
    <h1 class="sermon__title">${sermon.title}</h1>
    <p class="sermon__meta">
      <span class="sermon__date">${timeElement(sermon.serviceDate)}</span>
      ${when(sermon.speaker, () => html`<span class="sermon__speaker"><a href="${links.taxonomy("speakers", sermon.speaker!.slug)}">${sermon.speaker!.name}</a></span>`)}
      ${when(sermon.series.length, () => html`<span class="sermon__series">${sermon.series.map((item, index) => html`${index > 0 ? ", " : ""}<a href="${links.taxonomy("series", item.slug)}">${item.name}</a>`)}</span>`)}
      ${books}
      ${noPrimaryNote}
    </p>
  </header>`;
}

/** In-page links to the sections that exist, for the long reading page. */
function onThisPage(sermon: SermonDetail): Html | null {
  const entries: Array<[string, string]> = [];
  if (sermon.summary) entries.push(["description-heading", "About this sermon"]);
  if (sermon.media.length) entries.push(["media-heading", "Watch"]);
  if (sermon.transcript) entries.push(["transcript-heading", "Transcript"]);
  if (sermon.questionAnswers.length) entries.push(["questions-heading", "Questions"]);
  if (sermon.relatedSermons.length) entries.push(["related-heading", "Related sermons"]);
  if (entries.length < 2) return null;
  return html`<nav class="on-page" aria-label="On this page"><ul class="on-page__list">${entries.map(([id, label]) => html`<li><a href="#${id}">${label}</a></li>`)}</ul></nav>`;
}

function transcriptSection(sermon: SermonDetail): Html | null {
  if (!sermon.transcript) return null;
  return html`<section class="sermon-section" aria-labelledby="transcript-heading">
    <h2 id="transcript-heading">Transcript</h2>
    <details class="transcript" data-open-for-print>
      <summary class="transcript__summary" aria-expanded="false">Read the full transcript</summary>
      <div class="prose transcript__body">${plainTextParagraphs(sermon.transcript.bodyText)}</div>
      <p class="transcript__back"><a href="#transcript-heading">Back to the top of the transcript</a></p>
    </details>
  </section>`;
}

function questionsSection(sermon: SermonDetail): Html | null {
  if (!sermon.questionAnswers.length) return null;
  return html`<section class="sermon-section" aria-labelledby="questions-heading">
    <h2 id="questions-heading">Questions for reflection</h2>
    <ol class="qa-list" role="list">${sermon.questionAnswers.map((item, index) => html`<li class="qa-item">
      <h3 class="qa-item__question"><span class="qa-item__number" aria-hidden="true">${index + 1}</span><span class="sr-only">Question ${index + 1}: </span>${item.question}</h3>
      <div class="prose qa-item__answer">${plainTextParagraphs(item.answer)}</div>
    </li>`)}</ol>
  </section>`;
}

function relatedSection(sermon: SermonDetail, context: FrontendRenderContext): Html | null {
  if (!sermon.relatedSermons.length) return null;
  const links = siteLinks(context);
  return html`<section class="sermon-section sermon-section--related" aria-labelledby="related-heading">
    <h2 id="related-heading">Related sermons</h2>
    <ul class="sermon-list sermon-list--related" role="list">${sermon.relatedSermons.map((item) => html`<li>${sermonItem(item, { variant: "related", headingLevel: 3, links, reasons: item.relationshipReasons })}</li>`)}</ul>
  </section>`;
}

export function renderPublicSermonPage(
  sermon: SermonDetail,
  context: FrontendRenderContext = publicRenderContext
): string {
  const canonicalPath = `/sermons/${sermon.slug}/`;
  const metadataDescription = sermon.seoDescription ?? sermon.summary ?? undefined;
  const description = sermon.summary
    ? html`<section class="sermon-section sermon-section--description" aria-labelledby="description-heading">
        <h2 id="description-heading" class="sr-only">About this sermon</h2>
        <div class="prose prose--lede">${plainTextParagraphs(sermon.summary)}</div>
      </section>`
    : null;
  return pageShell({
    title: sermon.title,
    ...(metadataDescription ? { description: metadataDescription } : {}),
    canonicalPath,
    robots: "index, follow",
    openGraphType: "article",
    styles: ["sermon"],
    scripts: ["sermon"],
    body: html`<p class="breadcrumb"><a href="${contextualPath(context, archivePath)}">← All sermons</a></p>
    <article class="sermon">
      ${sermonHeader(sermon, context)}
      ${onThisPage(sermon)}
      ${description}
      ${mediaSection(sermon)}
      ${transcriptSection(sermon)}
      ${questionsSection(sermon)}
      ${relatedSection(sermon, context)}
    </article>`
  }, context);
}

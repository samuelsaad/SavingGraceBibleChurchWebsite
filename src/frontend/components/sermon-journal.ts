/** Compact V5 entries; descriptions come from the caller's eligible summaries. */
import type { SermonSummary } from "../../domain/sermon";
import { siteImage } from "../assets/media";
import { html, plainTextParagraphs, timeElement, when, type Html } from "../html";
import type { SiteLinks } from "../routes";
import { passageStamp, primaryBook, sermonTab } from "./catalogue";
import { socialGlyph } from "./glyphs";

/** Exact public names and portrait associations recorded in content/pages/elders.ts.
 * No fuzzy matching, inferred identity or generic person image for other speakers. */
export function verifiedSpeakerPortrait(name: string) {
  if (name === "Wesam Saad") return siteImage("wesam");
  if (name === "Ralph Gambardella") return siteImage("ralph");
  return null;
}

const openArrow = html`<svg class="journal__arrow" viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const transcriptGlyph = html`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const clockGlyph = html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const disclosureGlyph = html`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Recording duration only. Never estimate it from transcript length or cue timing. */
export function recordingDuration(seconds: number | null | undefined): string | null {
  if (!Number.isSafeInteger(seconds) || !seconds || seconds < 1) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function sermonJournal(sermons: SermonSummary[], links: SiteLinks, featured = false): Html {
  return html`<ul class="journal" role="list">${sermons.map((sermon) => {
    const book = primaryBook(sermon);
    const portrait = sermon.speaker ? verifiedSpeakerPortrait(sermon.speaker.name) : null;
    const href = links.sermon(sermon.slug);
    const descriptionId = `description-${sermon.id}`;
    const duration = recordingDuration(sermon.primaryMedia?.durationSeconds);
    const contentAttributes = sermon.language === "ar" ? html` lang="ar" dir="rtl"` : null;
    return html`<li><article class="journal__entry${featured ? " journal__entry--featured" : ""}${sermon.isTopical ? " hue--topical" : book ? ` hue--${book.category}` : ""}">
      <div class="journal__tab">${sermonTab(sermon, links)}</div>
      <div class="journal__dateline"><div class="journal__recording">${passageStamp(sermon, "journal__passage")}<span class="journal__duration">${clockGlyph}${duration ? html`<span><span class="sr-only">Recording duration: </span>${duration}</span>` : html`<span>Duration unavailable</span>`}</span></div><span class="journal__date">${timeElement(sermon.serviceDate)}</span></div>
      <div class="journal__body">
        <h3 class="journal__title"${contentAttributes}><a href="${href}">${sermon.title}</a></h3>
        ${when(sermon.reviewState === "draft_awaiting_review", html`<p class="journal__warning">Draft · awaiting administrator review</p>`)}
        ${when(sermon.summary, () => html`<div class="journal__description" id="${descriptionId}"${contentAttributes}>${plainTextParagraphs(sermon.summary!)}</div>`)}
        ${when(sermon.series.length, () => html`<p class="journal__series"><span>Series</span> ${sermon.series.map((series, i) => html`${i ? ", " : ""}<a href="${links.taxonomy("series", series.slug)}">${series.name}</a>`)}</p>`)}
        <div class="journal__tools">
          <div class="journal__formats" aria-label="Media shortcuts, not yet active">
            <span class="journal__format journal__format--youtube" title="YouTube shortcut — not yet active" aria-label="YouTube shortcut, not yet active">${socialGlyph("youtube")}</span>
            <span class="journal__format journal__format--audio" title="Sermon audio shortcut — not yet active" aria-label="Sermon audio shortcut, not yet active">${socialGlyph("podcast")}</span>
            <span class="journal__format journal__format--text" title="Transcript shortcut — not yet active" aria-label="Transcript shortcut, not yet active">${transcriptGlyph}</span>
            <span class="journal__formats-note">Not yet active</span>
          </div>
          ${when(sermon.summary, () => html`<button class="journal__toggle" type="button" hidden aria-expanded="false" aria-controls="${descriptionId}"><span data-description-label>See more</span><span class="sr-only"> — description of ${sermon.title}</span>${disclosureGlyph}</button>`)}
        </div>
      </div>
      <div class="journal__rail">${when(sermon.speaker, () => html`<div class="journal__speaker">${when(portrait, () => html`<img class="journal__portrait" src="${portrait!.path}" width="${portrait!.width}" height="${portrait!.height}" alt="" loading="lazy" decoding="async" />`)}<a href="${links.taxonomy("speakers", sermon.speaker!.slug)}">${sermon.speaker!.name}</a></div>`)}<a class="journal__open" href="${href}" aria-label="${`Open sermon: ${sermon.title}`}">Open sermon ${openArrow}</a></div>
    </article></li>`;
  })}</ul>`;
}


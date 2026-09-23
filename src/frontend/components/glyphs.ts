/**
 * Small inline SVG glyphs drawn for the homepage and the shared footer:
 * the four welcome pillars, the recurring-event mark, the back-to-top arrow,
 * the search magnifier and the four social marks. All are monoline
 * currentColor drawings; none is fetched and none carries text.
 */
import { html, raw, type Html } from "../html";
import type { PillarGlyph, SocialGlyph } from "../content/home-content";

const stroke = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

const pillarPaths: Record<PillarGlyph, string> = {
  // three spines on a baseline: where the church family came from
  history: `<rect x="4" y="9" width="4" height="12" ${stroke} /><rect x="10" y="5" width="5" height="16" ${stroke} /><rect x="17" y="8" width="4" height="13" ${stroke} /><path d="M2 21.5h21" ${stroke} />`,
  // a rising sun over a horizon
  "lords-day": `<path d="M3 17h19" ${stroke} /><path d="M7 17a5.5 5.5 0 0 1 11 0" ${stroke} /><path d="M12.5 5v2.5M6 8.5l1.8 1.8M19 8.5l-1.8 1.8M3.5 13.5H6M19 13.5h2.5" ${stroke} />`,
  // an open book
  "our-faith": `<path d="M12.5 6.5c-2-1.5-4.5-2-8-2v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2z" ${stroke} /><path d="M12.5 6.5v13" ${stroke} />`,
  // a plain cross
  "the-gospel": `<path d="M12.5 3.5v18M6.5 9h12" ${stroke} />`
};

/** A welcome-pillar glyph on the ink "icon spine". */
export function pillarGlyph(kind: PillarGlyph): Html {
  return html`<svg class="pillar__glyph" viewBox="0 0 25 25" aria-hidden="true" focusable="false">${raw(pillarPaths[kind])}</svg>`;
}

/** Two arcs with arrowheads: a recurring event. */
export function recurringGlyph(): Html {
  return html`<svg class="glyph glyph--recurring" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${raw(`<path d="M4 12a8 8 0 0 1 13.5-5.8" ${stroke} /><path d="M17.5 3v3.5H14" ${stroke} /><path d="M20 12a8 8 0 0 1-13.5 5.8" ${stroke} /><path d="M6.5 21v-3.5H10" ${stroke} />`)}</svg>`;
}

export function upGlyph(): Html {
  return html`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${raw(`<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" ${stroke} />`)}</svg>`;
}

export function searchGlyph(): Html {
  return html`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${raw(`<circle cx="10.5" cy="10.5" r="6" ${stroke} /><path d="m15 15 5.5 5.5" ${stroke} />`)}</svg>`;
}

const socialPaths: Record<SocialGlyph, string> = {
  facebook: `<path d="M14.5 21v-7.5h2.5l.5-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.6V4.3c-.4 0-1.3-.1-2.3-.1-2.5 0-4 1.5-4 4v2.3H9v3h2.4V21" ${stroke} />`,
  youtube: `<rect x="3" y="6" width="18" height="12" rx="3" ${stroke} /><path d="m10 9.5 5 2.5-5 2.5z" ${stroke} />`,
  instagram: `<rect x="4" y="4" width="16" height="16" rx="4" ${stroke} /><circle cx="12" cy="12" r="3.5" ${stroke} /><path d="M16.8 7.2h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />`,
  podcast: `<rect x="9" y="3" width="6" height="11" rx="3" ${stroke} /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" ${stroke} />`
};

export function socialGlyph(kind: SocialGlyph): Html {
  return html`<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${raw(socialPaths[kind])}</svg>`;
}

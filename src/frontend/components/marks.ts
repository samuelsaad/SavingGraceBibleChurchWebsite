/**
 * The website's own identity device and boundary-page illustrations.
 *
 * The shelf mark is an abstracted row of book spines drawn with the same rule
 * as the hero shelf. It is the website's identity, not the church's official
 * logo: the church has supplied no mark and none is claimed.
 */
import { html, raw, type Html } from "../html";

/** Five upright spines on a baseline, two of them pulled forward. */
export function shelfMark(className = "mark"): Html {
  return html`<svg class="${className}" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><rect x="2" y="8" width="4" height="18" fill="none" stroke="currentColor" stroke-width="1.5" /><rect x="8" y="4" width="6" height="22" fill="currentColor" /><rect x="16" y="10" width="3" height="16" fill="none" stroke="currentColor" stroke-width="1.5" /><rect x="21" y="6" width="5" height="20" fill="currentColor" opacity="0.55" /><rect x="0" y="26" width="28" height="2" fill="currentColor" /></svg>`;
}

/**
 * A quiet shelf of seven outlined spines. The not-found variant leaves a gap
 * where a book has been taken; the private variant seals one spine with a
 * band; the error variant leans one spine over.
 */
export function boundaryArt(kind: "not-found" | "private" | "error"): Html {
  const spines = [
    { x: 4, w: 14, h: 64 },
    { x: 22, w: 10, h: 56 },
    { x: 36, w: 18, h: 70 },
    { x: 58, w: 12, h: 60 },
    { x: 74, w: 16, h: 66 },
    { x: 94, w: 10, h: 54 },
    { x: 108, w: 14, h: 62 }
  ];
  const drawn = spines.map((spine, index) => {
    if (kind === "not-found" && index === 3) return "";
    const y = 80 - spine.h;
    if (kind === "error" && index === 3) {
      return `<g transform="rotate(-14 ${spine.x + spine.w / 2} 80)"><rect x="${spine.x}" y="${y}" width="${spine.w}" height="${spine.h}" fill="none" stroke="currentColor" stroke-width="2" /></g>`;
    }
    const band = kind === "private" && index === 3
      ? `<rect x="${spine.x}" y="${y + 18}" width="${spine.w}" height="8" fill="currentColor" />`
      : "";
    return `<rect x="${spine.x}" y="${y}" width="${spine.w}" height="${spine.h}" fill="none" stroke="currentColor" stroke-width="2" />${band}`;
  }).join("");
  return html`<svg class="boundary__art" viewBox="0 0 128 88" aria-hidden="true" focusable="false"><g>${raw(drawn)}</g><rect x="0" y="80" width="128" height="6" fill="currentColor" /></svg>`;
}

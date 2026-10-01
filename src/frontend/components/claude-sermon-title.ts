import { html, when, type Html } from "../html";
import type { TitlePageInput } from "./sections";

/** Claude's sermon opening; shared Astra/church title pages are unchanged. */
export function claudeSermonTitle(input: TitlePageInput): Html {
  const isLong = input.title.length > (input.longThreshold ?? 40);
  return html`<header class="title-page">
    ${when(input.trail?.length, () => html`<ol class="trail" role="list">${input.trail!.map((item) => html`<li><a href="${item.href}">${item.label}</a></li>`)}</ol>`)}
    <p class="eyebrow">${input.eyebrow}</p>
    <h1 class="title-page__title${isLong ? " is-long" : ""}">${input.title}</h1>
    ${when(input.meta, () => html`<div class="title-page__meta">${input.meta}</div>`)}
  </header>`;
}

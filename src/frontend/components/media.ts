/**
 * Controlled media for the sermon page: a click-to-load YouTube frame that
 * makes no request until the visitor activates it, and plain links for
 * controlled audio.
 */
import type { SermonDetail } from "../../domain/sermon";
import { resolveYouTubeIdentity } from "../../domain/youtube";
import { html, when, type Html } from "../html";

export interface SermonMedia {
  video: Html | null;
  audioLinks: Html[];
}

export function sermonMedia(sermon: SermonDetail): SermonMedia {
  const youtube = sermon.media
    .filter((item) => item.provider === "youtube")
    .map((item) => ({ item, identity: resolveYouTubeIdentity([{ videoId: item.externalId, canonicalUrl: item.canonicalUrl }]) }))
    .find((candidate) => candidate.identity.status === "available");
  const video = youtube && youtube.identity.status === "available"
    ? html`<div class="video-frame" data-video-frame>
        <div class="video-frame__consent">
          <p class="video-frame__title">${youtube.item.title}</p>
          <p class="video-frame__note">Loading the player connects to YouTube (youtube-nocookie.com). Nothing plays until you press play.</p>
          <button class="button button--light" type="button" data-load-youtube data-video-id="${youtube.identity.videoId}" data-video-title="${`Video: ${sermon.title}`}">Load the video</button>
          <noscript><p class="video-frame__note">The video player needs JavaScript.</p></noscript>
        </div>
      </div>`
    : null;
  const audioLinks = sermon.media
    .filter((item) => item.provider !== "youtube")
    .map((item) => html`<a class="button button--secondary" href="${item.canonicalUrl}" target="_blank" rel="noopener noreferrer">Open audio <span aria-hidden="true">↗</span><span class="sr-only">(opens in a new tab)</span></a>`);
  return { video, audioLinks };
}

export function mediaSection(sermon: SermonDetail): Html | null {
  if (!sermon.media.length) return null;
  const media = sermonMedia(sermon);
  const heading = media.video ? (media.audioLinks.length ? "Watch or listen" : "Watch") : "Listen";
  return html`<section class="sermon-section sermon-section--media" aria-labelledby="media-heading">
    <h2 id="media-heading">${heading}</h2>
    ${media.video ?? when(!media.audioLinks.length, html`<p class="section-note">The sermon media is currently unavailable.</p>`)}
    ${when(media.audioLinks.length, () => html`<p class="media-links">${media.audioLinks}</p>`)}
  </section>`;
}

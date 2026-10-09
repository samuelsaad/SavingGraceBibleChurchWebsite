/**
 * Controlled media for the sermon page: a click-to-load video plate that
 * makes no request until the visitor activates it, plus a controlled,
 * click-to-load single-sermon audio player. Playback stays in the embedded controls.
 */
import type { SermonDetail } from "../../domain/sermon";
import { resolveYouTubeIdentity } from "../../domain/youtube";
import {resolveSermonAudioIdentity} from '../../domain/sermonaudio';
import { html, when, type Html } from "../html";
import { shelfMark } from "./marks";
import { recordingDurationLabel } from "./recording-duration";

export interface SermonMedia {
  video: Html | null;
  audio: Html[];
}

export function sermonMedia(sermon: SermonDetail): SermonMedia {
  const youtube = sermon.media
    .filter((item) => item.provider === "youtube")
    .map((item) => ({ item, identity: resolveYouTubeIdentity([{ videoId: item.externalId, canonicalUrl: item.canonicalUrl }]) }))
    .find((candidate) => candidate.identity.status === "available");
  const video = youtube && youtube.identity.status === "available"
    ? html`<div class="plate" id="play-video" data-video-frame>
        <div class="plate__consent">
          ${shelfMark("plate__mark")}
          <p class="plate__title">${youtube.item.title}</p>
          ${when(recordingDurationLabel(youtube.item), () => html`<p class="plate__note">Video length: ${recordingDurationLabel(youtube.item)}</p>`)}
          <p class="plate__note">Loading the player connects to YouTube (youtube-nocookie.com). Nothing plays until you press play.</p>
          <button class="button button--onink" type="button" data-load-youtube data-video-id="${youtube.identity.videoId}" data-video-title="${`Video: ${sermon.title}`}">Load the video<span class="sr-only"> for ${sermon.title} from youtube-nocookie.com</span></button>
          <noscript><p class="plate__note">The video player needs JavaScript.</p></noscript>
        </div>
      </div>`
    : null;
  const recordings = sermon.media.filter(item => item.provider === 'sermonaudio')
    .map(item => ({item, id:resolveSermonAudioIdentity(item)})).filter(item => item.id);
  const audio = recordings.map(({id, item}, index) => html`<div class="audio-plate"${index === 0 ? html` id="play-audio"` : null} data-audio-frame data-sermonaudio-id="${id}">
    <p class="audio-plate__title">Listen to this sermon</p>
    ${when(recordingDurationLabel(item), () => html`<p class="audio-plate__note">Audio length: ${recordingDurationLabel(item)}</p>`)}
    <p class="audio-plate__note">Loading the audio player connects to SermonAudio. Nothing plays until you press play.</p>
    <button class="button button--onink" type="button" data-load-sermonaudio data-sermonaudio-id="${id}" data-audio-title="${`Audio: ${sermon.title}`}">Load audio player<span class="sr-only"> for ${sermon.title}</span></button>
    <noscript><p class="audio-plate__note">The audio player needs JavaScript.</p></noscript>
  </div>`);
  return { video, audio };
}

export function mediaSection(sermon: SermonDetail): Html | null {
  if (!sermon.media.length) return null;
  const media = sermonMedia(sermon);
  const heading = media.video ? (media.audio.length ? "Watch or listen" : "Watch") : "Listen";
  return html`<section class="sermon-section sermon-section--media" id="watch" aria-labelledby="media-heading">
    <h2 id="media-heading" class="section__title">${heading}</h2>
    ${media.video ?? when(!media.audio.length, html`<p class="note">The sermon media is currently unavailable.</p>`)}
    ${media.audio}
  </section>`;
}

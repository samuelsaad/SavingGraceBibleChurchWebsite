import type { PublicMedia, RecordingDuration, SermonSummary } from "../../domain/sermon";
import { html, type Html } from "../html";

/** Recording metadata only. Never derive a duration from words or transcript cues. */
export function recordingDuration(seconds: number | null | undefined): string | null {
  if (!Number.isSafeInteger(seconds) || !seconds || seconds < 1) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function sermonRecordingDuration(sermon: Pick<SermonSummary, "recordingDuration" | "primaryMedia">): RecordingDuration | null {
  // Undefined supports older callers; an explicit null means the adapter found
  // no usable recording. Never copy audio seconds onto a YouTube media object.
  const source = sermon.recordingDuration === undefined ? sermon.primaryMedia : sermon.recordingDuration;
  if (!source || !recordingDuration(source.durationSeconds)) return null;
  return { provider: source.provider, mediaType: source.mediaType, externalId: source.externalId,
    durationSeconds: source.durationSeconds! };
}

function spokenDuration(seconds: number): string {
  const values: Array<[number, string]> = [[Math.floor(seconds / 3600), "hour"],
    [Math.floor((seconds % 3600) / 60), "minute"], [seconds % 60, "second"]];
  return values.filter(([value]) => value > 0).map(([value, unit]) => `${value} ${unit}${value === 1 ? "" : "s"}`).join(", ");
}

/** Same visible format everywhere, with the actual provider in the accessible label. */
export function recordingDurationLabel(source: Pick<PublicMedia, "provider" | "mediaType" | "durationSeconds"> | null | undefined): Html | null {
  const formatted = recordingDuration(source?.durationSeconds);
  if (!source || !formatted) return null;
  const provider = source.provider === "sermonaudio" ? "SermonAudio" : "YouTube";
  const label = `${provider} ${source.mediaType} duration: ${spokenDuration(source.durationSeconds!)}`;
  return html`<time datetime="PT${source.durationSeconds}S" title="${provider} ${source.mediaType} recording" aria-label="${label}">${formatted}</time>`;
}

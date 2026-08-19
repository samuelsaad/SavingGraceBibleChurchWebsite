import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export const pilotYouTubeVideoIds = ["RAMFOAOWwMA", "--U52ZfBC48", "H2-Rh_w8Dfg"] as const;
export const expectedYouTubeChannelTitle = "Saving Grace Bible Church";
export const youtubeForceSslScope = "https://www.googleapis.com/auth/youtube.force-ssl";
export const youtubeCaptionProofVersion = "phase3b2-official-youtube-captions-v1";

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const captionIdPattern = /^[A-Za-z0-9_-]{1,200}$/;
const timestampPattern = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})$/;
const timestampOnlyPattern = /^\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{3})?)(?:\s*(?:-->|→)\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{3})?))?\s*$/;
const wordPattern = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

export interface CaptionTrackMetadata {
  id: string;
  videoId: string;
  language: string;
  trackKind: string;
  audioTrackType: string;
  status: string;
  isDraft: boolean;
  lastUpdated: string | null;
}

export interface PilotVideoOwnerMetadata {
  videoId: string;
  channelId: string;
}

export type CaptionTrackSelection =
  | { outcome: "selected"; track: CaptionTrackMetadata; eligibleTrackCount: number }
  | { outcome: "ambiguous_track"; priority: "standard" | "asr"; eligibleTrackCount: number }
  | { outcome: "no_eligible_track"; eligibleTrackCount: 0 };

export interface CaptionAnalysis {
  format: "vtt" | "studio_plain_text";
  characterCount: number;
  visibleCharacterCount: number;
  wordCount: number;
  cueCount: number | null;
  firstCueTimeMs: number | null;
  finalCueTimeMs: number | null;
  normalizedWords: string[];
  normalizedWordSequenceSha256: string;
}

export interface CaptionComparison {
  normalizedWordSequenceMatches: boolean;
  meaningfulWordingDifference: boolean;
  commonPrefixWordCount: number;
  commonSuffixWordCount: number;
  officialCharacterCount: number;
  studioCharacterCount: number;
  officialVisibleCharacterCount: number;
  studioVisibleCharacterCount: number;
  officialWordCount: number;
  studioWordCount: number;
  officialCueCount: number | null;
  studioCueCount: number | null;
  officialFirstCueTimeMs: number | null;
  studioFirstCueTimeMs: number | null;
  officialFinalCueTimeMs: number | null;
  studioFinalCueTimeMs: number | null;
  requiresManualReview: boolean;
}

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function assertExactVideoScope(
  requested: readonly string[],
  allowlist: readonly string[]
): void {
  if (requested.length !== allowlist.length || new Set(requested).size !== allowlist.length) {
    throw new Error("The command must use the exact unique pilot-video allowlist");
  }
  if (requested.some((id) => !videoIdPattern.test(id)) || requested.some((id) => !allowlist.includes(id))) {
    throw new Error("The command includes a video outside the exact pilot allowlist");
  }
}

export function requireCommonPilotOwner(
  requestedVideoIds: readonly string[],
  videos: readonly PilotVideoOwnerMetadata[]
): string {
  assertExactVideoScope(requestedVideoIds, requestedVideoIds);
  if (videos.length !== requestedVideoIds.length) {
    throw new Error("The owner check did not return every pilot video exactly once");
  }
  const returnedIds = videos.map((video) => video.videoId);
  if (new Set(returnedIds).size !== requestedVideoIds.length || returnedIds.some((id) => !requestedVideoIds.includes(id))) {
    throw new Error("The owner check returned a missing, duplicate or unexpected video");
  }
  if (videos.some((video) => !video.channelId.trim())) {
    throw new Error("The owner check returned an empty channel identity");
  }
  const channelIds = new Set(videos.map((video) => video.channelId));
  if (channelIds.size !== 1) {
    throw new Error("The pilot videos do not have one common owner channel");
  }
  return videos[0]!.channelId;
}

function normalizedTrackKind(value: string): "standard" | "asr" | "other" {
  const kind = value.trim().toLocaleLowerCase("en-AU");
  if (kind === "standard") return "standard";
  if (kind === "asr") return "asr";
  return "other";
}

function isEligibleEnglishPrimaryTrack(track: CaptionTrackMetadata): boolean {
  return track.status.trim().toLocaleLowerCase("en-AU") === "serving" &&
    !track.isDraft &&
    /^en(?:-|$)/iu.test(track.language.trim()) &&
    track.audioTrackType.trim().toLocaleLowerCase("en-AU") === "primary" &&
    normalizedTrackKind(track.trackKind) !== "other";
}

export function selectCaptionTrack(
  videoId: string,
  tracks: readonly CaptionTrackMetadata[]
): CaptionTrackSelection {
  if (!videoIdPattern.test(videoId)) throw new Error("Invalid video identity");
  if (tracks.some((track) => track.videoId !== videoId)) {
    throw new Error("Caption-track results crossed video identities");
  }
  if (tracks.some((track) => !captionIdPattern.test(track.id))) {
    throw new Error("YouTube returned an invalid caption-track identity");
  }
  const eligible = tracks.filter(isEligibleEnglishPrimaryTrack);
  if (eligible.length === 0) return { outcome: "no_eligible_track", eligibleTrackCount: 0 };
  for (const priority of ["standard", "asr"] as const) {
    const matching = eligible.filter((track) => normalizedTrackKind(track.trackKind) === priority);
    if (matching.length > 1) {
      return { outcome: "ambiguous_track", priority, eligibleTrackCount: eligible.length };
    }
    if (matching.length === 1) {
      return { outcome: "selected", track: matching[0]!, eligibleTrackCount: eligible.length };
    }
  }
  return { outcome: "no_eligible_track", eligibleTrackCount: 0 };
}

function parseTimestamp(value: string): number {
  const match = timestampPattern.exec(value.trim());
  if (!match) throw new Error("Malformed caption timestamp");
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  if (minutes > 59 || seconds > 59) throw new Error("Caption timestamp is out of range");
  return (((hours * 60) + minutes) * 60 + seconds) * 1_000 + milliseconds;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu, (entity, code: string) => {
    const lower = code.toLocaleLowerCase("en-AU");
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    if (lower === "nbsp") return " ";
    const numeric = lower.startsWith("#x")
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    return Number.isSafeInteger(numeric) ? String.fromCodePoint(numeric) : entity;
  });
}

function visibleCueText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/gu, "")).replace(/[\t ]+/gu, " ").trim();
}

export function normalizedWords(value: string): string[] {
  return (value.normalize("NFC").match(wordPattern) ?? [])
    .map((word) => word.toLocaleLowerCase("en-AU"));
}

function sequenceHash(words: readonly string[]): string {
  return sha256(words.join("\n"));
}

export function parseVttBytes(bytes: Uint8Array): CaptionAnalysis {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/u, "");
  } catch {
    throw new Error("Caption download is not valid UTF-8");
  }
  const normalized = source.replace(/\r\n?/gu, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "WEBVTT") throw new Error("Caption download is not a WEBVTT file");
  const cues: Array<{ start: number; end: number; text: string }> = [];
  let index = 1;
  while (index < lines.length && lines[index]!.trim() !== "") index += 1;
  while (index < lines.length) {
    while (index < lines.length && lines[index]!.trim() === "") index += 1;
    if (index >= lines.length) break;
    if (/^(NOTE|STYLE|REGION)(?:\s|$)/u.test(lines[index]!)) {
      while (index < lines.length && lines[index]!.trim() !== "") index += 1;
      continue;
    }
    let timingLine = lines[index]!;
    if (!timingLine.includes("-->")) {
      index += 1;
      timingLine = lines[index] ?? "";
    }
    const timing = timingLine.match(/^\s*([^\s]+)\s*-->\s*([^\s]+)(?:\s+.*)?$/u);
    if (!timing) throw new Error("Caption download contains a malformed cue");
    const start = parseTimestamp(timing[1]!);
    const end = parseTimestamp(timing[2]!);
    if (end < start) throw new Error("Caption cue ends before it starts");
    index += 1;
    const textLines: string[] = [];
    while (index < lines.length && lines[index]!.trim() !== "") {
      textLines.push(lines[index]!);
      index += 1;
    }
    const text = visibleCueText(textLines.join(" "));
    if (!text) throw new Error("Caption download contains an empty cue");
    cues.push({ start, end, text });
  }
  if (cues.length === 0) throw new Error("Caption download contains no cues");
  const words: string[] = [];
  for (const cue of cues) words.push(...normalizedWords(cue.text));
  if (words.length === 0) throw new Error("Caption download contains no readable words");
  return {
    format: "vtt",
    characterCount: normalized.length,
    visibleCharacterCount: cues.map((cue) => cue.text).join("\n").length,
    wordCount: words.length,
    cueCount: cues.length,
    firstCueTimeMs: cues[0]!.start,
    finalCueTimeMs: cues.at(-1)!.end,
    normalizedWords: words,
    normalizedWordSequenceSha256: sequenceHash(words)
  };
}

export function analyzeStudioExport(source: string): CaptionAnalysis {
  const normalized = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  if (normalized.trimStart().startsWith("WEBVTT")) {
    return parseVttBytes(new TextEncoder().encode(normalized));
  }
  const retainedLines: string[] = [];
  const cueTimes: Array<{ start: number; end: number | null }> = [];
  for (const line of normalized.split("\n")) {
    if (timestampOnlyPattern.test(line)) {
      const parts = line.split(/\s*(?:-->|→)\s*/u);
      const startValue = parts[0]?.trim();
      if (startValue?.includes(".") || startValue?.includes(",")) {
        cueTimes.push({
          start: parseTimestamp(startValue),
          end: parts[1] ? parseTimestamp(parts[1]) : null
        });
      }
      continue;
    }
    const retained = line.replace(/[\t ]+/gu, " ").trim();
    if (retained) retainedLines.push(retained);
  }
  const words: string[] = [];
  for (const line of retainedLines) words.push(...normalizedWords(line));
  if (words.length === 0) throw new Error("Studio export contains no readable words");
  return {
    format: "studio_plain_text",
    characterCount: normalized.length,
    visibleCharacterCount: retainedLines.join("\n").length,
    wordCount: words.length,
    cueCount: cueTimes.length > 0 ? cueTimes.length : null,
    firstCueTimeMs: cueTimes[0]?.start ?? null,
    finalCueTimeMs: cueTimes.at(-1)?.end ?? cueTimes.at(-1)?.start ?? null,
    normalizedWords: words,
    normalizedWordSequenceSha256: sequenceHash(words)
  };
}

export function compareCaptionAnalyses(
  official: CaptionAnalysis,
  studio: CaptionAnalysis
): CaptionComparison {
  const matches = official.normalizedWords.length === studio.normalizedWords.length &&
    official.normalizedWords.every((word, index) => word === studio.normalizedWords[index]);
  let commonPrefixWordCount = 0;
  while (
    commonPrefixWordCount < official.normalizedWords.length &&
    commonPrefixWordCount < studio.normalizedWords.length &&
    official.normalizedWords[commonPrefixWordCount] === studio.normalizedWords[commonPrefixWordCount]
  ) commonPrefixWordCount += 1;
  let commonSuffixWordCount = 0;
  while (
    commonSuffixWordCount < official.normalizedWords.length - commonPrefixWordCount &&
    commonSuffixWordCount < studio.normalizedWords.length - commonPrefixWordCount &&
    official.normalizedWords[official.normalizedWords.length - 1 - commonSuffixWordCount] ===
      studio.normalizedWords[studio.normalizedWords.length - 1 - commonSuffixWordCount]
  ) commonSuffixWordCount += 1;
  return {
    normalizedWordSequenceMatches: matches,
    meaningfulWordingDifference: !matches,
    commonPrefixWordCount,
    commonSuffixWordCount,
    officialCharacterCount: official.characterCount,
    studioCharacterCount: studio.characterCount,
    officialVisibleCharacterCount: official.visibleCharacterCount,
    studioVisibleCharacterCount: studio.visibleCharacterCount,
    officialWordCount: official.wordCount,
    studioWordCount: studio.wordCount,
    officialCueCount: official.cueCount,
    studioCueCount: studio.cueCount,
    officialFirstCueTimeMs: official.firstCueTimeMs,
    studioFirstCueTimeMs: studio.firstCueTimeMs,
    officialFinalCueTimeMs: official.finalCueTimeMs,
    studioFinalCueTimeMs: studio.finalCueTimeMs,
    requiresManualReview: !matches
  };
}

export async function persistExactCaptionBytes(
  privateRoot: string,
  videoId: string,
  captionId: string,
  bytes: Uint8Array
): Promise<{ path: string; sha256: string; byteCount: number; persistence: "created" | "unchanged" }> {
  if (!videoIdPattern.test(videoId) || !captionIdPattern.test(captionId)) {
    throw new Error("Unsafe caption persistence identity");
  }
  const root = resolve(privateRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Unsafe private caption directory");
  const videoDirectory = resolve(root, videoId);
  if (resolve(videoDirectory, "..") !== root) throw new Error("Unsafe private video directory");
  await mkdir(videoDirectory, { recursive: true, mode: 0o700 });
  const videoStat = await lstat(videoDirectory);
  if (!videoStat.isDirectory() || videoStat.isSymbolicLink()) throw new Error("Unsafe private video directory");
  const digest = sha256(bytes);
  const filename = `${captionId}.${digest}.vtt`;
  if (basename(filename) !== filename) throw new Error("Unsafe caption filename");
  const path = join(videoDirectory, filename);
  let createdHandle: Awaited<ReturnType<typeof open>> | null = null;
  let createdPath = false;
  try {
    createdHandle = await open(path, "wx", 0o600);
    createdPath = true;
    try {
      await createdHandle.writeFile(bytes);
      await createdHandle.sync();
    } finally {
      await createdHandle.close();
      createdHandle = null;
    }
    return { path, sha256: digest, byteCount: bytes.byteLength, persistence: "created" };
  } catch (error) {
    if (createdHandle) await createdHandle.close().catch(() => undefined);
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
      if (createdPath) await unlink(path).catch(() => undefined);
      throw error;
    }
    const existing = await readFile(path);
    if (!existing.equals(Buffer.from(bytes))) throw new Error("Caption persistence hash collision or conflict");
    return { path, sha256: digest, byteCount: bytes.byteLength, persistence: "unchanged" };
  }
}

import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export const pilotYouTubeVideoIds = ["RAMFOAOWwMA", "--U52ZfBC48", "H2-Rh_w8Dfg"] as const;
export const expectedYouTubeChannelTitle = "Saving Grace Bible Church";
export const youtubeForceSslScope = "https://www.googleapis.com/auth/youtube.force-ssl";
export const youtubeCaptionProofVersion = "phase3b2-official-youtube-captions-v3";

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const captionIdPattern = /^[A-Za-z0-9_-]{1,200}$/;
const timestampPattern = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})$/;
const timestampOnlyPattern = /^\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{3})?)(?:\s*(?:-->|→)\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{3})?))?\s*$/;

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

export const audioTrackTypeUnverifiedWarning = "audio_track_type_unverified" as const;
export type CaptionProvenanceWarning = typeof audioTrackTypeUnverifiedWarning;

export type CaptionTrackSelection =
  | {
    outcome: "selected";
    track: CaptionTrackMetadata;
    eligibleTrackCount: number;
    warnings: CaptionProvenanceWarning[];
  }
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
  normalizedWordCueTimes: Array<{ startMs: number; endMs: number }> | null;
}

export type AlignmentOperationKind = "match" | "substitution" | "insertion" | "deletion";

export interface AlignmentOperation {
  kind: AlignmentOperationKind;
  officialIndex: number | null;
  studioIndex: number | null;
}

export interface DifferenceRegionSummary {
  operationStart: number;
  operationEndExclusive: number;
  changedTokenCount: number;
  insertionCount: number;
  deletionCount: number;
  substitutionCount: number;
}

export interface CaptionComparison {
  outcome: "normalized_exact_match" | "differences_detected_manual_review_required";
  normalizedWordSequenceMatches: boolean;
  meaningfulWordingDifference: boolean;
  exactMatchedTokenCount: number;
  insertionCount: number;
  deletionCount: number;
  substitutionCount: number;
  totalChangedTokenCount: number;
  wordErrorRate: number;
  normalizedDifferenceRate: number;
  overallSimilarityPercentage: number;
  differenceRegionCount: number;
  largestConsecutiveDifferenceRegion: number;
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

export interface CaptionAlignmentResult {
  comparison: CaptionComparison;
  operations: AlignmentOperation[];
  differenceRegions: DifferenceRegionSummary[];
}

export interface PrivateCaptionReviewArtifact {
  schemaVersion: 1;
  processingVersion: string;
  privateContent: true;
  videoId: string;
  captionSha256: string;
  studioSourceSha256: string;
  comparisonFingerprint: string;
  comparison: CaptionComparison;
  differenceRegions: Array<{
    regionNumber: number;
    summary: DifferenceRegionSummary;
    officialCueReference: { startMs: number; endMs: number } | null;
    alignedPassage: Array<{
      kind: AlignmentOperationKind;
      officialTokenIndex: number | null;
      studioTokenIndex: number | null;
      officialToken: string | null;
      studioToken: string | null;
      officialCueStartMs: number | null;
      officialCueEndMs: number | null;
    }>;
  }>;
}

const captionParseFailures = new Map<string, string>([
  ["Caption download is not valid UTF-8", "invalid_utf8"],
  ["Caption download is not a WEBVTT file", "invalid_webvtt_header"],
  ["Caption download contains a malformed cue", "malformed_cue"],
  ["Malformed caption timestamp", "malformed_timestamp"],
  ["Caption timestamp is out of range", "timestamp_out_of_range"],
  ["Caption cue ends before it starts", "cue_time_reversed"],
  ["Caption download contains no cues", "no_cues"],
  ["Caption download contains no readable words", "no_readable_words"]
]);

export function captionParseFailureCode(error: unknown): string {
  return error instanceof Error ? captionParseFailures.get(error.message) ?? "invalid_vtt" : "invalid_vtt";
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

function isServingEnglishTrackWithSupportedKind(track: CaptionTrackMetadata): boolean {
  return track.status.trim().toLocaleLowerCase("en-AU") === "serving" &&
    !track.isDraft &&
    /^en(?:-|$)/iu.test(track.language.trim()) &&
    normalizedTrackKind(track.trackKind) !== "other";
}

function isEligibleEnglishPrimaryTrack(track: CaptionTrackMetadata): boolean {
  return isServingEnglishTrackWithSupportedKind(track) &&
    track.audioTrackType.trim().toLocaleLowerCase("en-AU") === "primary";
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
  for (const priority of ["standard", "asr"] as const) {
    const matching = eligible.filter((track) => normalizedTrackKind(track.trackKind) === priority);
    if (matching.length > 1) {
      return { outcome: "ambiguous_track", priority, eligibleTrackCount: eligible.length };
    }
    if (matching.length === 1) {
      return { outcome: "selected", track: matching[0]!, eligibleTrackCount: eligible.length, warnings: [] };
    }
  }
  const onlyTrack = tracks.length === 1 ? tracks[0]! : null;
  if (
    onlyTrack && isServingEnglishTrackWithSupportedKind(onlyTrack) &&
    onlyTrack.audioTrackType.trim().toLocaleLowerCase("en-AU") === "unknown"
  ) {
    return {
      outcome: "selected",
      track: onlyTrack,
      eligibleTrackCount: 1,
      warnings: [audioTrackTypeUnverifiedWarning]
    };
  }
  return { outcome: "no_eligible_track", eligibleTrackCount: 0 };
}

export function captionAudioAssociationProvenance(
  selection: Extract<CaptionTrackSelection, { outcome: "selected" }>
): {
  audioTrackType: string;
  primaryAudioAssociationConfirmed: boolean;
  warnings: CaptionProvenanceWarning[];
} {
  return {
    audioTrackType: selection.track.audioTrackType,
    primaryAudioAssociationConfirmed:
      selection.track.audioTrackType.trim().toLocaleLowerCase("en-AU") === "primary",
    warnings: [...selection.warnings]
  };
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
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-AU")
    .split(/\s+/u)
    .map((token) => token.replace(/[^\p{L}\p{N}\p{M}]/gu, ""))
    .filter((token) => token.length > 0);
}

function sequenceHash(words: readonly string[]): string {
  return sha256(words.join("\n"));
}

function rollingCueOverlapLength(target: readonly string[], next: readonly string[]): number {
  const maximum = Math.min(target.length, next.length);
  for (let length = maximum; length > 0; length -= 1) {
    let equal = true;
    for (let index = 0; index < length; index += 1) {
      if (target[target.length - length + index] !== next[index]) {
        equal = false;
        break;
      }
    }
    if (equal) return length;
  }
  return 0;
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
  if (!/^WEBVTT(?:[\t ].*)?$/u.test(lines[0]?.trim() ?? "")) {
    throw new Error("Caption download is not a WEBVTT file");
  }
  const cues: Array<{ start: number; end: number; text: string }> = [];
  let index = 1;
  while (index < lines.length && lines[index] !== "") index += 1;
  while (index < lines.length) {
    while (index < lines.length && lines[index] === "") index += 1;
    if (index >= lines.length) break;
    if (/^(NOTE|STYLE|REGION)(?:\s|$)/u.test(lines[index]!)) {
      while (index < lines.length && lines[index] !== "") index += 1;
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
    while (index < lines.length && lines[index] !== "") {
      textLines.push(lines[index]!);
      index += 1;
    }
    const text = visibleCueText(textLines.join(" "));
    cues.push({ start, end, text });
  }
  if (cues.length === 0) throw new Error("Caption download contains no cues");
  const words: string[] = [];
  const normalizedWordCueTimes: Array<{ startMs: number; endMs: number }> = [];
  for (let cueIndex = 0; cueIndex < cues.length; cueIndex += 1) {
    const cue = cues[cueIndex]!;
    const cueWords = normalizedWords(cue.text);
    const previous = cues[cueIndex - 1];
    const overlap = previous && cue.start <= previous.end
      ? rollingCueOverlapLength(words, cueWords)
      : 0;
    const appended = cueWords.slice(overlap);
    words.push(...appended);
    normalizedWordCueTimes.push(...appended.map(() => ({ startMs: cue.start, endMs: cue.end })));
  }
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
    normalizedWordSequenceSha256: sequenceHash(words),
    normalizedWordCueTimes
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
    normalizedWordSequenceSha256: sequenceHash(words),
    normalizedWordCueTimes: null
  };
}

function alignmentScoreRow(official: readonly string[], studio: readonly string[]): Uint32Array {
  let previous = new Uint32Array(studio.length + 1);
  for (let studioIndex = 0; studioIndex <= studio.length; studioIndex += 1) {
    previous[studioIndex] = studioIndex;
  }
  for (let officialIndex = 1; officialIndex <= official.length; officialIndex += 1) {
    const current = new Uint32Array(studio.length + 1);
    current[0] = officialIndex;
    for (let studioIndex = 1; studioIndex <= studio.length; studioIndex += 1) {
      const diagonal = previous[studioIndex - 1]! +
        (official[officialIndex - 1] === studio[studioIndex - 1] ? 0 : 1);
      const insertion = previous[studioIndex]! + 1;
      const deletion = current[studioIndex - 1]! + 1;
      current[studioIndex] = Math.min(diagonal, insertion, deletion);
    }
    previous = current;
  }
  return previous;
}

function alignSmall(
  official: readonly string[],
  studio: readonly string[],
  officialOffset: number,
  studioOffset: number
): AlignmentOperation[] {
  const width = studio.length + 1;
  const matrix = new Uint32Array((official.length + 1) * width);
  for (let index = 0; index <= official.length; index += 1) matrix[index * width] = index;
  for (let index = 0; index <= studio.length; index += 1) matrix[index] = index;
  for (let officialIndex = 1; officialIndex <= official.length; officialIndex += 1) {
    for (let studioIndex = 1; studioIndex <= studio.length; studioIndex += 1) {
      const diagonal = matrix[(officialIndex - 1) * width + studioIndex - 1]! +
        (official[officialIndex - 1] === studio[studioIndex - 1] ? 0 : 1);
      const insertion = matrix[(officialIndex - 1) * width + studioIndex]! + 1;
      const deletion = matrix[officialIndex * width + studioIndex - 1]! + 1;
      matrix[officialIndex * width + studioIndex] = Math.min(diagonal, insertion, deletion);
    }
  }

  const reversed: AlignmentOperation[] = [];
  let officialIndex = official.length;
  let studioIndex = studio.length;
  while (officialIndex > 0 || studioIndex > 0) {
    const current = matrix[officialIndex * width + studioIndex]!;
    if (officialIndex > 0 && studioIndex > 0) {
      const same = official[officialIndex - 1] === studio[studioIndex - 1];
      const diagonal = matrix[(officialIndex - 1) * width + studioIndex - 1]! + (same ? 0 : 1);
      if (current === diagonal) {
        reversed.push({
          kind: same ? "match" : "substitution",
          officialIndex: officialOffset + officialIndex - 1,
          studioIndex: studioOffset + studioIndex - 1
        });
        officialIndex -= 1;
        studioIndex -= 1;
        continue;
      }
    }
    if (officialIndex > 0 && current === matrix[(officialIndex - 1) * width + studioIndex]! + 1) {
      reversed.push({
        kind: "insertion",
        officialIndex: officialOffset + officialIndex - 1,
        studioIndex: null
      });
      officialIndex -= 1;
      continue;
    }
    reversed.push({
      kind: "deletion",
      officialIndex: null,
      studioIndex: studioOffset + studioIndex - 1
    });
    studioIndex -= 1;
  }
  return reversed.reverse();
}

function alignHirschberg(
  official: readonly string[],
  studio: readonly string[],
  officialOffset = 0,
  studioOffset = 0
): AlignmentOperation[] {
  if (official.length === 0) {
    return studio.map((_, index) => ({
      kind: "deletion" as const,
      officialIndex: null,
      studioIndex: studioOffset + index
    }));
  }
  if (studio.length === 0) {
    return official.map((_, index) => ({
      kind: "insertion" as const,
      officialIndex: officialOffset + index,
      studioIndex: null
    }));
  }
  if (official.length === 1 || studio.length === 1 || official.length * studio.length <= 4_096) {
    return alignSmall(official, studio, officialOffset, studioOffset);
  }

  const officialMiddle = Math.floor(official.length / 2);
  const forward = alignmentScoreRow(official.slice(0, officialMiddle), studio);
  const backward = alignmentScoreRow(
    [...official.slice(officialMiddle)].reverse(),
    [...studio].reverse()
  );
  let studioMiddle = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= studio.length; index += 1) {
    const score = forward[index]! + backward[studio.length - index]!;
    if (score < bestScore) {
      bestScore = score;
      studioMiddle = index;
    }
  }
  return [
    ...alignHirschberg(
      official.slice(0, officialMiddle),
      studio.slice(0, studioMiddle),
      officialOffset,
      studioOffset
    ),
    ...alignHirschberg(
      official.slice(officialMiddle),
      studio.slice(studioMiddle),
      officialOffset + officialMiddle,
      studioOffset + studioMiddle
    )
  ];
}

function summarizeDifferenceRegions(operations: readonly AlignmentOperation[]): DifferenceRegionSummary[] {
  const regions: DifferenceRegionSummary[] = [];
  let start: number | null = null;
  for (let index = 0; index <= operations.length; index += 1) {
    const changed = index < operations.length && operations[index]!.kind !== "match";
    if (changed && start === null) start = index;
    if (!changed && start !== null) {
      const regionOperations = operations.slice(start, index);
      regions.push({
        operationStart: start,
        operationEndExclusive: index,
        changedTokenCount: regionOperations.length,
        insertionCount: regionOperations.filter((operation) => operation.kind === "insertion").length,
        deletionCount: regionOperations.filter((operation) => operation.kind === "deletion").length,
        substitutionCount: regionOperations.filter((operation) => operation.kind === "substitution").length
      });
      start = null;
    }
  }
  return regions;
}

export function alignCaptionAnalyses(
  official: CaptionAnalysis,
  studio: CaptionAnalysis
): CaptionAlignmentResult {
  const operations = alignHirschberg(official.normalizedWords, studio.normalizedWords);
  const exactMatchedTokenCount = operations.filter((operation) => operation.kind === "match").length;
  const insertionCount = operations.filter((operation) => operation.kind === "insertion").length;
  const deletionCount = operations.filter((operation) => operation.kind === "deletion").length;
  const substitutionCount = operations.filter((operation) => operation.kind === "substitution").length;
  const totalChangedTokenCount = insertionCount + deletionCount + substitutionCount;
  const matches = totalChangedTokenCount === 0;
  const differenceRegions = summarizeDifferenceRegions(operations);
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
  const referenceWordCount = studio.normalizedWords.length;
  const largerWordCount = Math.max(official.normalizedWords.length, referenceWordCount);
  const normalizedDifferenceRate = largerWordCount === 0 ? 0 : totalChangedTokenCount / largerWordCount;
  const comparison: CaptionComparison = {
    outcome: matches ? "normalized_exact_match" : "differences_detected_manual_review_required",
    normalizedWordSequenceMatches: matches,
    meaningfulWordingDifference: !matches,
    exactMatchedTokenCount,
    insertionCount,
    deletionCount,
    substitutionCount,
    totalChangedTokenCount,
    wordErrorRate: referenceWordCount === 0
      ? (totalChangedTokenCount === 0 ? 0 : 1)
      : totalChangedTokenCount / referenceWordCount,
    normalizedDifferenceRate,
    overallSimilarityPercentage: Math.max(0, (1 - normalizedDifferenceRate) * 100),
    differenceRegionCount: differenceRegions.length,
    largestConsecutiveDifferenceRegion: differenceRegions.reduce(
      (largest, region) => Math.max(largest, region.changedTokenCount),
      0
    ),
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
  return { comparison, operations, differenceRegions };
}

export function compareCaptionAnalyses(
  official: CaptionAnalysis,
  studio: CaptionAnalysis
): CaptionComparison {
  return alignCaptionAnalyses(official, studio).comparison;
}

export function buildPrivateCaptionReviewArtifact(input: {
  videoId: string;
  captionSha256: string;
  studioSourceSha256: string;
  official: CaptionAnalysis;
  studio: CaptionAnalysis;
  alignment: CaptionAlignmentResult;
  contextOperationCount?: number;
}): PrivateCaptionReviewArtifact {
  if (!videoIdPattern.test(input.videoId)) throw new Error("Unsafe private review video identity");
  if (!/^[a-f0-9]{64}$/u.test(input.captionSha256) || !/^[a-f0-9]{64}$/u.test(input.studioSourceSha256)) {
    throw new Error("Unsafe private review source hash");
  }
  if (!input.alignment.comparison.requiresManualReview || input.alignment.differenceRegions.length === 0) {
    throw new Error("A private review artifact is only valid for a non-exact comparison");
  }
  const contextOperationCount = input.contextOperationCount ?? 8;
  if (!Number.isSafeInteger(contextOperationCount) || contextOperationCount < 0 || contextOperationCount > 100) {
    throw new Error("Unsafe private review context size");
  }
  const differenceRegions = input.alignment.differenceRegions.map((summary, index) => {
    const passageStart = Math.max(0, summary.operationStart - contextOperationCount);
    const passageEnd = Math.min(
      input.alignment.operations.length,
      summary.operationEndExclusive + contextOperationCount
    );
    const alignedPassage = input.alignment.operations.slice(passageStart, passageEnd).map((operation) => {
      const timing = operation.officialIndex === null
        ? null
        : input.official.normalizedWordCueTimes?.[operation.officialIndex] ?? null;
      return {
        kind: operation.kind,
        officialTokenIndex: operation.officialIndex,
        studioTokenIndex: operation.studioIndex,
        officialToken: operation.officialIndex === null
          ? null
          : input.official.normalizedWords[operation.officialIndex] ?? null,
        studioToken: operation.studioIndex === null
          ? null
          : input.studio.normalizedWords[operation.studioIndex] ?? null,
        officialCueStartMs: timing?.startMs ?? null,
        officialCueEndMs: timing?.endMs ?? null
      };
    });
    const regionTimings = input.alignment.operations
      .slice(summary.operationStart, summary.operationEndExclusive)
      .flatMap((operation) => {
        if (operation.officialIndex === null) return [];
        const timing = input.official.normalizedWordCueTimes?.[operation.officialIndex];
        return timing ? [timing] : [];
      });
    return {
      regionNumber: index + 1,
      summary,
      officialCueReference: regionTimings.length === 0
        ? null
        : {
          startMs: Math.min(...regionTimings.map((timing) => timing.startMs)),
          endMs: Math.max(...regionTimings.map((timing) => timing.endMs))
        },
      alignedPassage
    };
  });
  const comparisonFingerprint = sha256(JSON.stringify({
    processingVersion: youtubeCaptionProofVersion,
    videoId: input.videoId,
    captionSha256: input.captionSha256,
    studioSourceSha256: input.studioSourceSha256,
    comparison: input.alignment.comparison,
    differenceRegions: input.alignment.differenceRegions
  }));
  return {
    schemaVersion: 1,
    processingVersion: youtubeCaptionProofVersion,
    privateContent: true,
    videoId: input.videoId,
    captionSha256: input.captionSha256,
    studioSourceSha256: input.studioSourceSha256,
    comparisonFingerprint,
    comparison: input.alignment.comparison,
    differenceRegions
  };
}

export async function persistPrivateCaptionReviewArtifact(
  privateRoot: string,
  artifact: PrivateCaptionReviewArtifact
): Promise<{ path: string; sha256: string; persistence: "created" | "unchanged" }> {
  if (!videoIdPattern.test(artifact.videoId) || !/^[a-f0-9]{64}$/u.test(artifact.comparisonFingerprint)) {
    throw new Error("Unsafe private review persistence identity");
  }
  const root = resolve(privateRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Unsafe private review directory");
  const videoDirectory = resolve(root, artifact.videoId);
  if (resolve(videoDirectory, "..") !== root) throw new Error("Unsafe private review video directory");
  await mkdir(videoDirectory, { recursive: true, mode: 0o700 });
  const videoStat = await lstat(videoDirectory);
  if (!videoStat.isDirectory() || videoStat.isSymbolicLink()) {
    throw new Error("Unsafe private review video directory");
  }
  const filename = `comparison.${artifact.comparisonFingerprint}.review.private.json`;
  if (basename(filename) !== filename) throw new Error("Unsafe private review filename");
  const path = join(videoDirectory, filename);
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  const digest = sha256(bytes);
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
    return { path, sha256: digest, persistence: "created" };
  } catch (error) {
    if (createdHandle) await createdHandle.close().catch(() => undefined);
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
      if (createdPath) await unlink(path).catch(() => undefined);
      throw error;
    }
    const existing = await readFile(path);
    if (!existing.equals(bytes)) throw new Error("Private review persistence hash collision or conflict");
    return { path, sha256: digest, persistence: "unchanged" };
  }
}

export async function processItemsIndependently<T, R>(input: {
  items: readonly T[];
  process: (item: T) => Promise<R>;
  unavailable: (item: T, error: unknown) => Promise<R> | R;
  isGlobalFailure?: (error: unknown) => boolean;
}): Promise<R[]> {
  const results: R[] = [];
  for (const item of input.items) {
    try {
      results.push(await input.process(item));
    } catch (error) {
      if (input.isGlobalFailure?.(error)) throw error;
      results.push(await input.unavailable(item, error));
    }
  }
  return results;
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

import { createHash } from "node:crypto";
import { parseVttBytes, normalizedWords } from "../youtube/pilot-caption-proof";
import { compareRetainedCaptionTranscript } from "./remaining-caption-comparison";

// Punctuation/paragraphing only. Every output must pass both capture-word and
// independent marker/position/numeric-preservation checks before persistence.
interface Cue {
  start: number;
  end: number;
  text: string;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseTime(value: string): number {
  const parts = value.split(":");
  if (parts.length !== 2 && parts.length !== 3) throw new Error("malformed_vtt_timestamp");
  const secondsPart = parts.at(-1)!;
  const [secondsText, millisecondsText = "0"] = secondsPart.split(/[.,]/u);
  const seconds = Number(secondsText);
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  const milliseconds = Number(millisecondsText.padEnd(3, "0").slice(0, 3));
  if (![hours, minutes, seconds, milliseconds].every(Number.isFinite)) throw new Error("malformed_vtt_timestamp");
  return (((hours * 60 + minutes) * 60) + seconds) * 1000 + milliseconds;
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
    const numeric = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    return Number.isSafeInteger(numeric) ? String.fromCodePoint(numeric) : entity;
  });
}

function visibleText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/gu, "")).replace(/[\t ]+/gu, " ").trim();
}

function parseCues(bytes: Uint8Array): Cue[] {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  const lines = source.split("\n");
  if (!/^WEBVTT(?:[\t ].*)?$/u.test(lines[0]?.trim() ?? "")) throw new Error("not_webvtt");
  const cues: Cue[] = [];
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
    if (!timing) throw new Error("malformed_vtt_cue");
    const start = parseTime(timing[1]!);
    const end = parseTime(timing[2]!);
    if (end < start) throw new Error("malformed_vtt_cue_time");
    index += 1;
    const textLines: string[] = [];
    while (index < lines.length && lines[index] !== "") {
      textLines.push(lines[index]!);
      index += 1;
    }
    cues.push({ start, end, text: visibleText(textLines.join(" ")) });
  }
  if (cues.length === 0) throw new Error("no_vtt_cues");
  return cues;
}

function overlapLength(target: readonly string[], next: readonly string[]): number {
  for (let length = Math.min(target.length, next.length); length > 0; length -= 1) {
    if (next.slice(0, length).every((word, index) => word === target[target.length - length + index])) return length;
  }
  return 0;
}

interface PreservedToken { key: string; start: number; }
function preservedTokens(text: string): PreservedToken[] {
  return [...text.matchAll(/\[[^\[\]]*\]|\?{2,}|[^\s\[\]]+/gu)].flatMap(match => {
    const raw = match[0];
    if (/^\[|^\?{2,}/u.test(raw)) return [{start:match.index!, key:"marker:"+raw.normalize("NFKC").toLocaleLowerCase("en-AU").replace(/\s+/gu," ").replace(/^\[ /u,"[").replace(/ \]$/u,"]")}];
    const normalized = normalizedWords(raw)[0];
    const numeric = raw.match(/[+\-\u2212]?\p{N}+(?:[.,:/\-\u2013\u2014]\p{N}+)*/gu);
    return normalized ? [{start:match.index!,key:"word:"+normalized+":"+JSON.stringify(numeric)}] : [];
  });
}
function appendableFragment(cueText: string, overlap: number): string {
  if (overlap === 0) return cueText;
  const next = preservedTokens(cueText)[overlap];
  return next ? cueText.slice(next.start) : "";
}

function capitalizeBoundaries(value: string): string {
  return value.replace(/(^|[.!?]["'’)]?\s+)([a-z])/gmu, (_match, boundary: string, letter: string) =>
    `${boundary}${letter.toUpperCase()}`
  );
}

export function prepareCaptionTranscript(bytes: Uint8Array): { text: string; words: number; cues: number; durationMs: number } {
  const authoritative = parseVttBytes(bytes);
  const cues = parseCues(bytes);
  const accumulatedWords: string[] = [];
  const paragraphs: string[] = [];
  let paragraphSentences: string[] = [];
  let paragraphWords = 0;
  let sentenceFragments: string[] = [];
  let sentenceWords = 0;
  let previous: Cue | undefined;
  for (const cue of cues) {
    const cueWords = preservedTokens(cue.text).map(token => token.key);
    const overlap = previous && cue.start <= previous.end ? overlapLength(accumulatedWords, cueWords) : 0;
    const appendedWords = cueWords.slice(overlap);
    const fragment = appendableFragment(cue.text, overlap);
    if (fragment) {
      sentenceFragments.push(fragment);
      sentenceWords += normalizedWords(fragment).length;
      paragraphWords += normalizedWords(fragment).length;
    }
    accumulatedWords.push(...appendedWords);
    const precedingGap = previous ? cue.start - previous.end : 0;
    const sourceSentenceBoundary = /[.!?]["'’)]?$/u.test(fragment);
    const inferredSentenceBoundary = sentenceWords >= 28 || (sentenceWords >= 12 && precedingGap >= 900);
    if (sentenceFragments.length > 0 && (sourceSentenceBoundary || inferredSentenceBoundary)) {
      let sentence = sentenceFragments.join(" ").replace(/\s+/gu, " ").trim();
      if (!/[.!?]["'’)]?$/u.test(sentence)) sentence += ".";
      paragraphSentences.push(capitalizeBoundaries(sentence));
      sentenceFragments = [];
      sentenceWords = 0;
    }
    if (paragraphSentences.length > 0 && paragraphWords >= 150 && sentenceFragments.length === 0) {
      paragraphs.push(paragraphSentences.join(" "));
      paragraphSentences = [];
      paragraphWords = 0;
    }
    previous = cue;
  }
  if (sentenceFragments.length > 0) {
    let sentence = sentenceFragments.join(" ").replace(/\s+/gu, " ").trim();
    if (!/[.!?]["'’)]?$/u.test(sentence)) sentence += ".";
    paragraphSentences.push(capitalizeBoundaries(sentence));
  }
  if (paragraphSentences.length > 0) paragraphs.push(paragraphSentences.join(" "));
  const text = paragraphs.filter(Boolean).join("\n\n");
  const actualWords = normalizedWords(text);
  if (actualWords.length !== authoritative.normalizedWords.length ||
      actualWords.some((word, index) => word !== authoritative.normalizedWords[index])) {
    throw new Error("prepared_transcript_word_sequence_mismatch");
  }
  if (authoritative.cueCount === null || authoritative.firstCueTimeMs === null || authoritative.finalCueTimeMs === null) {
    throw new Error("caption_structural_metrics_incomplete");
  }
  if (actualWords.length < 500 || authoritative.finalCueTimeMs - authoritative.firstCueTimeMs < 300_000) {
    throw new Error("caption_not_sufficiently_complete_for_grounded_generation");
  }
  const preservation = compareRetainedCaptionTranscript({ sourceBytes: bytes, transcript: text, expectedSourceSha256: sha256(bytes), expectedTranscriptSha256: sha256(text) });
  if (preservation.receipt.outcome !== "exact_word_sequence") throw new Error("prepared_transcript_marker_or_word_mismatch");
  return {
    text,
    words: actualWords.length,
    cues: authoritative.cueCount,
    durationMs: authoritative.finalCueTimeMs - authoritative.firstCueTimeMs
  };
}

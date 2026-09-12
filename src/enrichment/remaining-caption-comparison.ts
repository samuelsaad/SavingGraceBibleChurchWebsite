import { createHash } from "node:crypto";
import { canonicalReviewJson } from "../domain/delegated-ai-review";
import { normalizedWords } from "../youtube/pilot-caption-proof";

export const retainedCaptionComparisonAlgorithm = "retained-caption-word-preservation-v1" as const;
type Outcome = "exact_word_sequence" | "unexplained_difference" | "source_unavailable";
type FailureCode = "source_missing" | "source_hash_mismatch" | "transcript_hash_mismatch" |
  "invalid_utf8" | "invalid_webvtt" | "invalid_cue" | "cue_order_invalid" |
  "unsupported_markup" | "invalid_entity" | "invalid_marker" | "unreadable_content";
type Token = { kind: "word"; value: string; numericForm: string | null } | { kind: "marker"; value: string };
type Cue = { start: number; end: number; tokens: Token[]; captureWords: string[] };

export interface RetainedCaptionSequenceMetrics {
  tokenCount: number;
  wordCount: number;
  markerCount: number;
  redactionCount: number;
  uncertaintyCount: number;
  tokenSequenceSha256: string;
  wordSequenceSha256: string;
  markerSequenceSha256: string;
  /** Hash binds each marker's value, ordinal and preceding lexical-word count. */
  markerPositionsSha256: string;
}

export interface RetainedCaptionComparisonReceipt {
  schemaVersion: 1;
  algorithm: typeof retainedCaptionComparisonAlgorithm;
  sourceFormat: "vtt";
  sourceSha256: string | null;
  rawSourceSha256: string | null;
  expectedSourceSha256: string | null;
  transcriptSha256: string;
  expectedTranscriptSha256: string | null;
  sourceByteCount: number | null;
  transcriptCharacterCount: number;
  outcome: Outcome;
  failureCode: FailureCode | null;
  completeSourceCompared: boolean;
  source: RetainedCaptionSequenceMetrics | null;
  transcript: RetainedCaptionSequenceMetrics | null;
  cueCount: number | null;
  rawCueTokenCount: number | null;
  rawCueMarkerCount: number | null;
  overlapRemovedTokenCount: number | null;
  overlapRemovedMarkerCount: number | null;
  /** Exact position comparison, not an edit-distance/alignment estimate. */
  mismatchingTokenPositions: number | null;
  firstMismatchTokenIndex: number | null;
  wordSequenceMatches: boolean | null;
  markerSequenceMatches: boolean | null;
  markerPositionsMatch: boolean | null;
  /** Independent original capture-contract normalization must also match. */
  captureWordSequenceMatches: boolean | null;
  sourceCaptureWordSequenceSha256: string | null;
  transcriptCaptureWordSequenceSha256: string | null;
  semanticReadingAssessed: false;
  audioVerified: false;
}

export interface RetainedCaptionComparison {
  deterministicComparison: {
    sourceSha256: string | null;
    transcriptSha256: string;
    algorithm: typeof retainedCaptionComparisonAlgorithm;
    outcome: Outcome;
    completeSourceCompared: boolean;
    comparisonReceiptSha256: string;
  };
  /** Counts and hashes only. This helper never returns retained source wording. */
  receipt: RetainedCaptionComparisonReceipt;
}

class ComparisonFailure extends Error {
  constructor(readonly code: FailureCode) { super(code); }
}
const fail = (code: FailureCode): never => { throw new ComparisonFailure(code); };
const hash = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const objectHash = (value: unknown): string => hash(canonicalReviewJson(value));
const sameToken = (a: Token | undefined, b: Token | undefined): boolean =>
  a !== undefined && b !== undefined && a.kind === b.kind && a.value === b.value &&
  (a.kind !== "word" || b.kind === "word" && a.numericForm === b.numericForm);

function markerTokens(value: string): Token[] {
  value = value.normalize("NFKC");
  if (/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(value)) fail("unsupported_markup");
  const result: Token[] = [];
  const appendWords = (text: string) => {
    // An unmatched/nested bracket must not disappear as ordinary punctuation.
    if (/[\[\]]/u.test(text)) fail("invalid_marker");
    for (const raw of text.split(/\s+/u)) {
      const word = normalizedWords(raw)[0];
      if (!word) continue;
      // Numeric punctuation can change quantities/references and is not merely
      // presentation: 1.2, 12, -12 and 1:2 must not become interchangeable.
      const numeric = raw.match(/[+\-\u2212]?\p{N}+(?:[.,:/\-\u2013\u2014]\p{N}+)*/gu);
      result.push({ kind: "word", value: word, numericForm: numeric ? canonicalReviewJson(numeric) : null });
    }
  };
  let cursor = 0;
  for (const match of value.matchAll(/\[[^\[\]]*\]|\?{2,}/gu)) {
    appendWords(value.slice(cursor, match.index));
    const marker = match[0].normalize("NFKC").toLocaleLowerCase("en-AU")
      .replace(/\s+/gu, " ").replace(/^\[ /u, "[").replace(/ \]$/u, "]");
    result.push({ kind: "marker", value: marker });
    cursor = match.index + match[0].length;
  }
  appendWords(value.slice(cursor));
  return result;
}

function visibleCaptionText(value: string): string {
  // Only documented VTT presentation tags and inline timestamps are removable.
  // In particular, unknown angle-bracket uncertainty cannot silently disappear.
  const withoutTags = value.replace(/<[^>]*>/gu, tag => {
    if (!/^<(?:\/?(?:b|i|u|ruby|rt|c)|c(?:\.[^\s.<>]+)+|v(?: [^<>]+)?|\/v|lang(?: [^<>]+)?|\/lang)>$/u.test(tag) &&
        !/^<(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3}>$/u.test(tag)) fail("unsupported_markup");
    return "";
  });
  return withoutTags.replace(/&([^;\s]+);/gu, (_entity, code: string) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    const lower = code.toLocaleLowerCase("en-AU");
    if (Object.hasOwn(named, lower)) return named[lower]!;
    if (!/^#(?:x[\da-f]+|\d+)$/u.test(lower)) return fail("invalid_entity");
    const numeric = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    if (!Number.isSafeInteger(numeric) || numeric < 1 || numeric > 0x10ffff || numeric >= 0xd800 && numeric <= 0xdfff) return fail("invalid_entity");
    return String.fromCodePoint(numeric);
  });
}

function timestamp(value: string): number {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})$/u.exec(value);
  if (!m || Number(m[2]) > 59 || Number(m[3]) > 59) return fail("invalid_cue");
  return (((Number(m[1] ?? 0) * 60 + Number(m[2])) * 60) + Number(m[3])) * 1000 + Number(m[4]);
}

function parseRetainedVtt(bytes: Uint8Array): Cue[] {
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return fail("invalid_utf8"); }
  const lines = source.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n").split("\n");
  if (!/^WEBVTT(?:[\t ].*)?$/u.test(lines[0]?.trim() ?? "")) fail("invalid_webvtt");
  let index = 1;
  while (index < lines.length && lines[index] !== "") {
    if (lines[index]!.includes("-->")) fail("invalid_webvtt");
    index++;
  }
  const cues: Cue[] = [];
  while (index < lines.length) {
    while (lines[index] === "") index++;
    if (index >= lines.length) break;
    if (/^(?:NOTE|STYLE|REGION)(?:\s|$)/u.test(lines[index]!)) {
      while (index < lines.length && lines[index] !== "") index++;
      continue;
    }
    if (!lines[index]!.includes("-->")) index++;
    const timing = /^\s*(\S+)\s*-->\s*(\S+)(?:\s+.*)?$/u.exec(lines[index] ?? "");
    if (!timing) return fail("invalid_cue");
    const start = timestamp(timing[1]!), end = timestamp(timing[2]!);
    if (end < start) fail("invalid_cue");
    if (cues.length && start < cues.at(-1)!.start) fail("cue_order_invalid");
    index++;
    const payload: string[] = [];
    while (index < lines.length && lines[index] !== "") payload.push(lines[index++]!);
    const text = visibleCaptionText(payload.join(" "));
    cues.push({ start, end, tokens: markerTokens(text), captureWords: normalizedWords(text) });
  }
  if (!cues.length) fail("invalid_webvtt");
  return cues;
}

function rollingOverlap<T>(target: T[], next: T[], equal: (a: T | undefined, b: T | undefined) => boolean): number {
  // Same longest exact suffix/prefix rule as the retained-capture contract,
  // including marker values. Never remove repetition across a positive time gap.
  for (let count = Math.min(target.length, next.length); count > 0; count--) {
    if (next.slice(0, count).every((token, i) => equal(token, target[target.length - count + i]))) return count;
  }
  return 0;
}

function metrics(tokens: Token[]): RetainedCaptionSequenceMetrics {
  let words = 0;
  const positions: Array<{ ordinal: number; precedingWords: number; marker: string }> = [];
  for (const token of tokens) {
    if (token.kind === "word") words++;
    else positions.push({ ordinal: positions.length, precedingWords: words, marker: token.value });
  }
  const markers = positions.map(p => p.marker);
  return {
    tokenCount: tokens.length, wordCount: words, markerCount: markers.length,
    redactionCount: markers.filter(m => /^\[\s*_+\s*\]$/u.test(m) || /^\[redacted(?:\s|\])/u.test(m)).length,
    uncertaintyCount: markers.filter(m => /^\[(?:inaudible|unintelligible|unclear)(?:\b|\])/u.test(m) || /^\?{2,}$/u.test(m)).length,
    tokenSequenceSha256: objectHash(tokens),
    wordSequenceSha256: objectHash(tokens.filter(t => t.kind === "word").map(t => t.value)),
    markerSequenceSha256: objectHash(markers), markerPositionsSha256: objectHash(positions)
  };
}

/** Pure full-file evidence comparison. It neither reads files nor edits content,
 * infers human corrections, verifies source identity, or attests semantic/audio accuracy.
 * Expected hashes bind retained bytes to the caller's separately verified source. */
export function compareRetainedCaptionTranscript(input: {
  sourceBytes: Uint8Array | null;
  transcript: string;
  expectedSourceSha256?: string;
  expectedTranscriptSha256?: string;
}): RetainedCaptionComparison {
  for (const expected of [input.expectedSourceSha256, input.expectedTranscriptSha256]) {
    if (expected !== undefined && !/^[a-f0-9]{64}$/u.test(expected)) throw new Error("comparison_expected_hash_invalid");
  }
  const rawSourceSha256 = input.sourceBytes === null ? null : hash(input.sourceBytes);
  const receipt: RetainedCaptionComparisonReceipt = {
    schemaVersion: 1, algorithm: retainedCaptionComparisonAlgorithm, sourceFormat: "vtt",
    sourceSha256: rawSourceSha256 ?? input.expectedSourceSha256 ?? null, rawSourceSha256,
    expectedSourceSha256: input.expectedSourceSha256 ?? null,
    transcriptSha256: hash(input.transcript), expectedTranscriptSha256: input.expectedTranscriptSha256 ?? null,
    sourceByteCount: input.sourceBytes?.byteLength ?? null, transcriptCharacterCount: input.transcript.length,
    outcome: "source_unavailable", failureCode: null, completeSourceCompared: false,
    source: null, transcript: null, cueCount: null, rawCueTokenCount: null, rawCueMarkerCount: null,
    overlapRemovedTokenCount: null, overlapRemovedMarkerCount: null,
    mismatchingTokenPositions: null, firstMismatchTokenIndex: null,
    wordSequenceMatches: null, markerSequenceMatches: null, markerPositionsMatch: null,
    captureWordSequenceMatches: null, sourceCaptureWordSequenceSha256: null, transcriptCaptureWordSequenceSha256: null,
    semanticReadingAssessed: false, audioVerified: false
  };
  try {
    if (input.expectedTranscriptSha256 && input.expectedTranscriptSha256 !== receipt.transcriptSha256) fail("transcript_hash_mismatch");
    if (input.expectedSourceSha256 && rawSourceSha256 && input.expectedSourceSha256 !== rawSourceSha256) fail("source_hash_mismatch");
    const transcriptTokens = markerTokens(input.transcript);
    receipt.transcript = metrics(transcriptTokens);
    if (!receipt.transcript.wordCount) fail("unreadable_content");
    if (input.sourceBytes === null) throw new ComparisonFailure("source_missing");
    const cues = parseRetainedVtt(input.sourceBytes);
    const sourceTokens: Token[] = [];
    const sourceCaptureWords: string[] = [];
    receipt.cueCount = cues.length;
    receipt.rawCueTokenCount = 0; receipt.rawCueMarkerCount = 0;
    receipt.overlapRemovedTokenCount = 0; receipt.overlapRemovedMarkerCount = 0;
    for (const [index, cue] of cues.entries()) {
      const touching = index > 0 && cue.start <= cues[index - 1]!.end;
      const overlap = touching ? rollingOverlap(sourceTokens, cue.tokens, sameToken) : 0;
      const captureOverlap = touching ? rollingOverlap(sourceCaptureWords, cue.captureWords, (a, b) => a === b) : 0;
      receipt.rawCueTokenCount += cue.tokens.length;
      receipt.rawCueMarkerCount += cue.tokens.filter(t => t.kind === "marker").length;
      receipt.overlapRemovedTokenCount += overlap;
      receipt.overlapRemovedMarkerCount += cue.tokens.slice(0, overlap).filter(t => t.kind === "marker").length;
      sourceTokens.push(...cue.tokens.slice(overlap));
      sourceCaptureWords.push(...cue.captureWords.slice(captureOverlap));
    }
    receipt.source = metrics(sourceTokens);
    if (!receipt.source.wordCount) fail("unreadable_content");
    let mismatches = 0;
    for (let index = 0; index < Math.max(sourceTokens.length, transcriptTokens.length); index++) {
      if (!sameToken(sourceTokens[index], transcriptTokens[index])) {
        receipt.firstMismatchTokenIndex ??= index;
        mismatches++;
      }
    }
    receipt.mismatchingTokenPositions = mismatches;
    receipt.wordSequenceMatches = receipt.source.wordSequenceSha256 === receipt.transcript.wordSequenceSha256;
    receipt.markerSequenceMatches = receipt.source.markerSequenceSha256 === receipt.transcript.markerSequenceSha256;
    receipt.markerPositionsMatch = receipt.source.markerPositionsSha256 === receipt.transcript.markerPositionsSha256;
    receipt.sourceCaptureWordSequenceSha256 = objectHash(sourceCaptureWords);
    receipt.transcriptCaptureWordSequenceSha256 = objectHash(normalizedWords(input.transcript));
    receipt.captureWordSequenceMatches = receipt.sourceCaptureWordSequenceSha256 === receipt.transcriptCaptureWordSequenceSha256;
    receipt.completeSourceCompared = true;
    receipt.outcome = mismatches === 0 && receipt.captureWordSequenceMatches ? "exact_word_sequence" : "unexplained_difference";
  } catch (error) {
    if (!(error instanceof ComparisonFailure)) throw new Error("retained_caption_comparison_failed");
    receipt.failureCode = error.code;
    receipt.outcome = ["source_hash_mismatch", "transcript_hash_mismatch"].includes(error.code)
      ? "unexplained_difference" : "source_unavailable";
  }
  return {
    deterministicComparison: {
      sourceSha256: receipt.sourceSha256, transcriptSha256: receipt.transcriptSha256,
      algorithm: retainedCaptionComparisonAlgorithm, outcome: receipt.outcome,
      completeSourceCompared: receipt.completeSourceCompared, comparisonReceiptSha256: objectHash(receipt)
    },
    receipt
  };
}

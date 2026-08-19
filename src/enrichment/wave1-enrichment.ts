import { lexicalTokenSequenceSha256, lexicalTokens } from "./pilot-punctuation";
import { normalizedWords, parseVttBytes } from "../youtube/pilot-caption-proof";

export const wave1EnrichmentProcessingVersion = "phase3b2c-wave1-extractive-drafts-v2" as const;

export interface PreparedWaveOneContent {
  transcript: string;
  description: string;
  questionAnswers: Array<{ question: string; answer: string }>;
  sourceWordCount: number;
  cleanedWordCount: number;
  sourceWordSequenceSha256: string;
  cleanedWordSequenceSha256: string;
  uncertaintyMarkers: Array<{ marker: string; safeReason: string }>;
  warnings: Array<{ code: string; safeDetail: string }>;
}

interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

const timestampPattern = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})$/u;
const uncertaintyPattern = /\[(?:inaudible|unintelligible|unclear)(?:[^\]]*)\]|\?\?+/giu;

function parseTimestamp(value: string): number {
  const match = value.match(timestampPattern);
  if (!match) throw new Error("Wave 1 VTT contains an invalid timestamp");
  return (((Number(match[1] ?? 0) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1_000) + Number(match[4]);
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu, (entity, code: string) => {
    const lower = code.toLowerCase();
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

function parseCues(bytes: Uint8Array): Cue[] {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  const lines = source.split("\n");
  if (!/^WEBVTT(?:[\t ].*)?$/u.test(lines[0]?.trim() ?? "")) throw new Error("Wave 1 source is not VTT");
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
    let timing = lines[index]!;
    if (!timing.includes("-->")) timing = lines[++index] ?? "";
    const match = timing.match(/^\s*([^\s]+)\s*-->\s*([^\s]+)(?:\s+.*)?$/u);
    if (!match) throw new Error("Wave 1 VTT contains a malformed cue");
    index += 1;
    const text: string[] = [];
    while (index < lines.length && lines[index] !== "") text.push(lines[index++]!);
    cues.push({
      startMs: parseTimestamp(match[1]!),
      endMs: parseTimestamp(match[2]!),
      text: decodeEntities(text.join(" ").replace(/<[^>]*>/gu, "")).replace(/[\t ]+/gu, " ").trim()
    });
  }
  if (cues.length === 0) throw new Error("Wave 1 VTT contains no cues");
  return cues;
}

function rollingOverlap(target: readonly string[], next: readonly string[]): number {
  for (let length = Math.min(target.length, next.length); length > 0; length -= 1) {
    if (next.slice(0, length).every((word, index) => word === target[target.length - length + index])) return length;
  }
  return 0;
}

function capitalize(value: string): string {
  return value.replace(/^(\P{L}*)(\p{L})/u, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("en-AU")}`);
}

function terminalPunctuation(value: string): boolean {
  return /[.!?](?:["'’)]*)$/u.test(value);
}

function sourcePreservingTranscript(bytes: Uint8Array): { transcript: string; sourceText: string } {
  const analysis = parseVttBytes(bytes);
  const cues = parseCues(bytes);
  const accumulatedNormalized: string[] = [];
  const accumulatedSourceTokens: string[] = [];
  const sentences: string[] = [];
  let pendingTokens: string[] = [];
  let paragraphWordCount = 0;
  const paragraphs: string[] = [];
  let previous: Cue | null = null;
  const flushSentence = (): void => {
    if (pendingTokens.length === 0) return;
    let sentence = capitalize(pendingTokens.join(" ").replace(/[\t ]+/gu, " ").trim());
    if (!terminalPunctuation(sentence)) sentence += ".";
    sentences.push(sentence);
    paragraphWordCount += normalizedWords(sentence).length;
    pendingTokens = [];
    if (paragraphWordCount >= 125 && sentences.length > 0) {
      paragraphs.push(sentences.splice(0).join(" "));
      paragraphWordCount = 0;
    }
  };
  for (const cue of cues) {
    const tokens = cue.text.split(/\s+/u).filter(Boolean)
      .map((token) => ({ token, normalized: normalizedWords(token) }))
      .filter((item) => item.normalized.length > 0 && item.normalized.length === 1);
    const cueNormalized = tokens.map((item) => item.normalized[0]!);
    const overlap = previous && cue.startMs <= previous.endMs
      ? rollingOverlap(accumulatedNormalized, cueNormalized)
      : 0;
    const appended = tokens.slice(overlap);
    accumulatedNormalized.push(...appended.map((item) => item.normalized[0]!));
    accumulatedSourceTokens.push(...appended.map((item) => item.token));
    pendingTokens.push(...appended.map((item) => item.token));
    const gap = previous ? cue.startMs - previous.endMs : 0;
    if (pendingTokens.length >= 24 || terminalPunctuation(cue.text) || gap >= 1_800) flushSentence();
    previous = cue;
  }
  flushSentence();
  if (sentences.length > 0) paragraphs.push(sentences.join(" "));
  const transcript = paragraphs.join("\n\n");
  if (analysis.normalizedWords.length !== accumulatedNormalized.length ||
    !analysis.normalizedWords.every((word, index) => word === accumulatedNormalized[index])) {
    throw new Error("Wave 1 transcript preparation did not preserve the parsed source word sequence");
  }
  if (normalizedWords(transcript).length !== analysis.normalizedWords.length ||
    !normalizedWords(transcript).every((word, index) => word === analysis.normalizedWords[index])) {
    throw new Error("Wave 1 punctuation changed the source word sequence");
  }
  return { transcript, sourceText: accumulatedSourceTokens.join(" ") };
}

const stopWords = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "but", "can",
  "could", "did", "does", "for", "from", "had", "has", "have", "into", "its", "just", "more", "not", "now",
  "our", "out", "over", "said", "she", "should", "some", "than", "that", "the", "their", "them", "then", "there",
  "these", "they", "this", "those", "through", "too", "very", "was", "were", "what", "when", "where", "which",
  "who", "will", "with", "would", "you", "your"
]);

function transcriptSentences(transcript: string): string[] {
  return transcript.split(/(?<=[.!?]["'’)]?)\s+/u).map((value) => value.trim()).filter((value) => normalizedWords(value).length >= 8);
}

function rankedSentences(sentences: readonly string[]): string[] {
  const frequencies = new Map<string, number>();
  for (const sentence of sentences) {
    for (const word of normalizedWords(sentence)) {
      if (word.length < 4 || stopWords.has(word)) continue;
      frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    }
  }
  return sentences.map((sentence, index) => ({
    sentence,
    index,
    score: normalizedWords(sentence).reduce((sum, word) => sum + (frequencies.get(word) ?? 0), 0) /
      Math.max(1, Math.sqrt(normalizedWords(sentence).length))
  })).sort((left, right) => right.score - left.score || left.index - right.index).map((item) => item.sentence);
}

function buildDescription(transcript: string): string {
  const sentences = transcriptSentences(transcript);
  if (sentences.length < 7) throw new Error("Wave 1 transcript has too few usable passages for grounded drafts");
  const ranked = rankedSentences(sentences);
  const selected: string[] = [];
  let wordCount = 0;
  for (const sentence of ranked) {
    const count = normalizedWords(sentence).length;
    if (count > 65 || selected.includes(sentence)) continue;
    if (wordCount + count > 165 && selected.length >= 4) continue;
    selected.push(sentence);
    wordCount += count;
    if (wordCount >= 145 || selected.length === 6) break;
  }
  const ordered = selected.sort((left, right) => sentences.indexOf(left) - sentences.indexOf(right));
  let description = `This sermon explores its central themes and applications through the speaker's teaching. ${ordered.join(" ")} Listeners are invited to consider these points carefully and reflect on how the message applies to faith and daily life.`;
  while (description.length > 2_000 && ordered.length > 2) {
    ordered.pop();
    description = `This sermon explores its central themes and applications through the speaker's teaching. ${ordered.join(" ")} Listeners are invited to consider these points carefully and reflect on how the message applies to faith and daily life.`;
  }
  if (description.trim().length < 80 || description.length > 2_000) throw new Error("Wave 1 description could not satisfy the draft contract");
  return description;
}

function buildQuestionAnswers(transcript: string): Array<{ question: string; answer: string }> {
  const sentences = transcriptSentences(transcript);
  const questions = [
    "What main concern does the opening part of the sermon establish?",
    "How does the sermon develop its central teaching?",
    "What biblical truth or context does the message emphasize?",
    "What challenge does the sermon place before its listeners?",
    "What encouragement does the message offer?",
    "How does the sermon connect belief with everyday life?",
    "What should listeners reflect on after hearing this message?"
  ];
  return questions.map((question, index) => {
    const center = Math.min(sentences.length - 1, Math.floor(((index + 0.5) / questions.length) * sentences.length));
    const passage = [sentences[center], sentences[Math.min(sentences.length - 1, center + 1)]]
      .filter((value, passageIndex, values): value is string => Boolean(value) && values.indexOf(value) === passageIndex)
      .join(" ");
    const answer = `The sermon explains: ${passage}`;
    if (answer.length > 10_000 || normalizedWords(answer).length < 12) throw new Error("Wave 1 Q&A draft is not substantive enough");
    return { question, answer };
  });
}

export function prepareWaveOneContent(bytes: Uint8Array): PreparedWaveOneContent {
  const retired: boolean = true;
  if (retired) {
    throw new Error(
      "mechanical_wave1_generation_retired: use the repository sermon-enrichment skill and grounded private result contract"
    );
  }
  const { transcript, sourceText } = sourcePreservingTranscript(bytes);
  const sourceWordCount = lexicalTokens(sourceText).length;
  const cleanedWordCount = lexicalTokens(transcript).length;
  if (sourceWordCount !== cleanedWordCount) throw new Error("Wave 1 lexical source-word count changed during preparation");
  const uncertaintyMarkers = [...sourceText.matchAll(uncertaintyPattern)].map((_match, index) => ({
    marker: `uncertain-${index + 1}`,
    safeReason: "The caption source explicitly marked this passage as uncertain; administrator verification is required."
  }));
  return {
    transcript,
    description: buildDescription(transcript),
    questionAnswers: buildQuestionAnswers(transcript),
    sourceWordCount,
    cleanedWordCount,
    sourceWordSequenceSha256: lexicalTokenSequenceSha256(sourceText),
    cleanedWordSequenceSha256: lexicalTokenSequenceSha256(transcript),
    uncertaintyMarkers,
    warnings: [
      {
        code: "administrator_accuracy_review_required",
        safeDetail: "Automated preparation cannot establish caption, Scripture or theological accuracy."
      },
      {
        code: "asr_source_accuracy_unverified",
        safeDetail: "The official source is an automatic caption track and was not checked against audio."
      },
      {
        code: "mechanical_punctuation_requires_review",
        safeDetail: "Sentence and paragraph boundaries were added mechanically while preserving the parsed source word sequence."
      },
      {
        code: "names_and_scripture_require_administrator_review",
        safeDetail: "Names, Bible books and apparent Scripture references require contextual administrator verification."
      },
      ...(uncertaintyMarkers.length ? [{
        code: "source_uncertainties_retained",
        safeDetail: `${uncertaintyMarkers.length} explicit source uncertainty markers require administrator review.`
      }] : [])
    ]
  };
}

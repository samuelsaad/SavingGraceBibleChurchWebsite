import { createHash } from "node:crypto";

export const phase3b2ProcessingVersion = "phase3b2-caption-v1";

export interface SafePilotWarning {
  code: string;
  safeDetail: string;
}

export interface CaptionMetrics {
  sourceCharacterCount: number;
  cleanedCharacterCount: number;
  sourceWordCount: number;
  cleanedWordCount: number;
  uncertaintyMarkerCount: number;
  sourceContentSha256: string;
}

export type CaptionPreparationResult =
  | {
      usable: true;
      cleanedText: string;
      metrics: CaptionMetrics;
      warnings: SafePilotWarning[];
      unresolvedPassages: Array<{ marker: string; safeReason: string }>;
      apparentCompleteness: "apparently_complete" | "requires_manual_review";
    }
  | {
      usable: false;
      failure: { code: string; safeDetail: string };
      metrics: Omit<CaptionMetrics, "cleanedCharacterCount" | "cleanedWordCount">;
      warnings: SafePilotWarning[];
    };

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const timestampLinePattern = /^\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{3})?\s*(?:-->|→)\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{3})?)|(?:\d{1,2}:)?\d{1,2}:\d{2})\s*$/;
const unsafeMarkupPattern = /<[^>]+>/;
const uncertaintyPattern = /\[(?:inaudible|unintelligible|unclear)(?:[^\]]*)\]|\?\?+/giu;

export function canonicalYouTubeIdentity(
  input: string,
  allowlistedVideoIds: readonly string[]
): { videoId: string; canonicalUrl: string } {
  const url = new URL(input);
  if (url.protocol !== "https:" || !new Set(["youtube.com", "www.youtube.com"]).has(url.hostname)) {
    throw new Error("Only HTTPS youtube.com watch URLs are accepted for the pilot");
  }
  if (url.pathname !== "/watch") {
    throw new Error("Only YouTube watch URLs are accepted for the pilot");
  }
  const videoId = url.searchParams.get("v") ?? "";
  if (!videoIdPattern.test(videoId)) throw new Error("The YouTube video ID is invalid");
  if (!allowlistedVideoIds.includes(videoId)) {
    throw new Error(`Video ID ${videoId} is not in the private pilot allowlist`);
  }
  return { videoId, canonicalUrl: `https://www.youtube.com/watch?v=${videoId}` };
}

function words(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
}

function capitalizeBoundaries(value: string): string {
  return value.replace(/(^|[.!?]\s+)([a-z])/gmu, (_match, boundary: string, letter: string) =>
    `${boundary}${letter.toUpperCase()}`
  );
}

function normalizedWordSequence(value: string): string[] {
  return words(value).map((word) => word.toLocaleLowerCase("en-AU"));
}

function sameWordSequence(left: string, right: string): boolean {
  const leftWords = normalizedWordSequence(left);
  const rightWords = normalizedWordSequence(right);
  return leftWords.length === rightWords.length && leftWords.every((word, index) => word === rightWords[index]);
}

export function prepareExistingCaptionText(sourceText: string): CaptionPreparationResult {
  const source = sourceText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const sourceWords = words(source);
  const sourceContentSha256 = createHash("sha256").update(source, "utf8").digest("hex");
  const baseMetrics = {
    sourceCharacterCount: source.length,
    sourceWordCount: sourceWords.length,
    uncertaintyMarkerCount: [...source.matchAll(uncertaintyPattern)].length,
    sourceContentSha256
  };
  const warnings: SafePilotWarning[] = [
    {
      code: "administrator_accuracy_review_required",
      safeDetail: "Automated preparation cannot establish caption, Scripture or theological accuracy."
    }
  ];

  if (source.length < 2_000 || sourceWords.length < 500) {
    return {
      usable: false,
      failure: {
        code: "caption_source_too_short",
        safeDetail: "The supplied caption export is too short to treat as a complete sermon transcript."
      },
      metrics: baseMetrics,
      warnings
    };
  }
  if (unsafeMarkupPattern.test(source)) {
    return {
      usable: false,
      failure: {
        code: "unsafe_caption_markup",
        safeDetail: "The caption export contains markup and requires manual plain-text review."
      },
      metrics: baseMetrics,
      warnings
    };
  }

  const paragraphs: string[] = [];
  let removedTimestampLines = 0;
  let removedDuplicateParagraphs = 0;
  for (const rawParagraph of source.split(/\n\s*\n/g)) {
    const retainedLines = rawParagraph.split("\n").filter((line) => {
      if (timestampLinePattern.test(line)) {
        removedTimestampLines += 1;
        return false;
      }
      return true;
    });
    const paragraph = retainedLines.join(" ").replace(/[\t ]+/g, " ").trim();
    if (!paragraph) continue;
    if (paragraphs.at(-1) === paragraph) {
      removedDuplicateParagraphs += 1;
      continue;
    }
    paragraphs.push(paragraph);
  }
  const retainedSource = paragraphs.join("\n\n");
  const sentenceBoundaryCount = (retainedSource.match(/[.!?](?:["'’)]|\s|$)/g) ?? []).length;
  if (sentenceBoundaryCount < Math.max(5, Math.floor(sourceWords.length / 80))) {
    warnings.push({
      code: "insufficient_sentence_boundaries",
      safeDetail: "The export has too few sentence boundaries for safe non-generative punctuation preparation."
    });
    return {
      usable: false,
      failure: {
        code: "manual_punctuation_required",
        safeDetail: "A human or separately approved non-billable language model must establish sentence boundaries before processing."
      },
      metrics: baseMetrics,
      warnings
    };
  }

  if (removedTimestampLines > 0) {
    warnings.push({
      code: "timestamp_lines_removed",
      safeDetail: `${removedTimestampLines} timestamp-only caption lines were removed.`
    });
  }
  if (removedDuplicateParagraphs > 0) {
    warnings.push({
      code: "exact_duplicate_overlap_removed",
      safeDetail: `${removedDuplicateParagraphs} exact adjacent duplicate caption paragraphs were removed.`
    });
  }
  const cleanedText = paragraphs.map(capitalizeBoundaries).join("\n\n");
  if (!sameWordSequence(retainedSource, cleanedText)) {
    throw new Error("Caption preparation changed the retained source word sequence");
  }
  const unresolvedPassages = [...source.matchAll(uncertaintyPattern)].map((_match, index) => ({
    marker: `uncertain-${index + 1}`,
    safeReason: "The source export explicitly marks this passage as uncertain; administrator verification is required."
  }));
  if (unresolvedPassages.length > 0) {
    warnings.push({
      code: "source_uncertainties_retained",
      safeDetail: `${unresolvedPassages.length} explicit source uncertainty markers remain for administrator review.`
    });
  }
  return {
    usable: true,
    cleanedText,
    metrics: {
      ...baseMetrics,
      cleanedCharacterCount: cleanedText.length,
      cleanedWordCount: words(cleanedText).length
    },
    warnings,
    unresolvedPassages,
    apparentCompleteness: unresolvedPassages.length ? "requires_manual_review" : "apparently_complete"
  };
}

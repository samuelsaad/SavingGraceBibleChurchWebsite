import { extractPrimaryPassageFromTitle, type PrimaryPassageCoordinates } from "./bible-passage";

export const sermonTitlePolicyVersion = "corroborated-passage-boundary-v1";

export interface TitleEvidence {
  passages?: readonly PrimaryPassageCoordinates[];
  passageTexts?: readonly string[];
  // Only original titles from a verified local source/import, never a guessed title.
  sourceTitles?: readonly string[];
}

export interface TitleAssessment {
  outcome: "correctable" | "clean" | "manual_review";
  title: string;
  reason: string;
}

const samePassage = (a: PrimaryPassageCoordinates, b: PrimaryPassageCoordinates): boolean =>
  a.canonicalBookId === b.canonicalBookId && a.startChapter === b.startChapter &&
  a.startVerse === b.startVerse && a.endChapter === b.endChapter && a.endVerse === b.endVerse;

/** Delimiter-only removal: never rewrites title wording or creates passage decisions. */
export function assessSermonTitle(title: string, evidence: TitleEvidence = {}): TitleAssessment {
  const result = extractPrimaryPassageFromTitle(title);
  const manual = (reason: string): TitleAssessment => ({ outcome: "manual_review", title, reason });
  if (result.outcome === "no_reference") return { outcome: "clean", title, reason: "no_reference" };
  if (result.outcome !== "one_valid_reference") return manual(result.reason);
  const reference = result.passage.originalReferenceText;
  const index = title.indexOf(reference);
  // Do not map normalized offsets back onto different Unicode bytes.
  if (index < 0 || title.indexOf(reference, index + 1) !== -1) return manual("uncertain_reference_bytes");
  const before = title.slice(0, index);
  const after = title.slice(index + reference.length);
  if (!before.trim() && !after.trim()) return manual("passage_only");
  let remaining: string | undefined;
  if (!after.trim() && /\s+[—–|:-]\s*$/.test(before)) {
    remaining = before.replace(/\s+[—–|:-]\s*$/, "");
  } else if (!before.trim() && /^\s*[—–|:-]\s+/.test(after)) {
    remaining = after.replace(/^\s*[—–|:-]\s+/, "");
  } else if (/\s+\(\s*$/.test(before) && /^\s*\)\s*$/.test(after)) {
    remaining = before.replace(/\s+\(\s*$/, "");
  } else if (/\s+\[\s*$/.test(before) && /^\s*\]\s*$/.test(after)) {
    remaining = before.replace(/\s+\[\s*$/, "");
  } else if (/^\s*\(\s*$/.test(before) && /^\s*\)\s+(?:[—–|:-]\s+)?/.test(after)) {
    remaining = after.replace(/^\s*\)\s+(?:[—–|:-]\s+)?/, "");
  } else if (/^\s*\[\s*$/.test(before) && /^\s*\]\s+(?:[—–|:-]\s+)?/.test(after)) {
    remaining = after.replace(/^\s*\]\s+(?:[—–|:-]\s+)?/, "");
  }
  if (remaining === undefined) return manual("ambiguous_boundary");
  remaining = remaining.trim();
  if (!/[\p{L}\p{N}]/u.test(remaining)) return manual("empty_remaining_title");
  const passages = [...(evidence.passages ?? [])];
  for (const text of evidence.passageTexts ?? []) {
    const extracted = extractPrimaryPassageFromTitle(text);
    if (extracted.outcome === "one_valid_reference") passages.push(extracted.passage);
  }
  const corroborated = passages.some((item) => samePassage(item, result.passage)) ||
    (evidence.sourceTitles ?? []).some((item) => item === title);
  if (!corroborated) return manual("missing_corroboration");
  return { outcome: "correctable", title: remaining, reason: "corroborated_boundary_reference" };
}

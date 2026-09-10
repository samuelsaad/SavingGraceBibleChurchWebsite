/** Metadata suggestions never constitute an administrator decision. */
export const reviewMetadataPolicy = "source-backed-review-metadata-v1";

export interface SourceSpeakerEvidence {
  sourceWordPressId: number;
  relationshipCount: number;
  termIds: number[];
  evidenceSha256: string;
}
export interface CanonicalSourceSpeaker { id: string; sourceTermId: number | null }

export function resolveSourceSpeaker(existing: string | null, evidence: SourceSpeakerEvidence | null,
  catalogue: CanonicalSourceSpeaker[], explicitlyCleared = false) {
  if (existing !== null) return { speakerId: existing, reason: "existing_selection_preserved" };
  if (explicitlyCleared) return { speakerId: null, reason: "human_clearing_preserved" };
  if (!evidence || !/^[a-f0-9]{64}$/.test(evidence.evidenceSha256) ||
      !Number.isSafeInteger(evidence.sourceWordPressId) || evidence.sourceWordPressId < 1) {
    return { speakerId: null, reason: "source_evidence_unavailable" };
  }
  if (evidence.relationshipCount !== 1 || evidence.termIds.length !== 1 ||
      !Number.isSafeInteger(evidence.termIds[0]) || evidence.termIds[0]! < 1) {
    return { speakerId: null, reason: "source_speaker_missing_or_ambiguous" };
  }
  const matches = catalogue.filter(s => s.sourceTermId === evidence.termIds[0]);
  return matches.length === 1
    ? { speakerId: matches[0]!.id, reason: "verified_source_term_mapping" }
    : { speakerId: null, reason: matches.length ? "canonical_mapping_conflict" : "source_name_evidence_required" };
}

interface ReviewBook { id: string; canonicalBookId: number | null }
interface ReviewReference { canonicalBookId: number | null; relationshipRole: string; isLead: boolean; reviewStatus: string }

/** Keep a saved legacy classification visible without offering unrelated legacy choices. */
export function reviewBookOptions<T extends ReviewBook>(existing: Array<{id: string}>, catalogue: T[]): T[] {
  const saved = new Set(existing.map(book => book.id));
  return catalogue.filter(book => book.canonicalBookId !== null || saved.has(book.id));
}

/** Existing classifications, including human choices, win. No default first book. */
export function selectedReviewBook(existing: Array<{id: string}>, references: ReviewReference[], catalogue: ReviewBook[]): string {
  if (existing.length) return existing[0]!.id;
  const primary = references.filter(r => r.relationshipRole === "primary" && r.isLead && r.reviewStatus !== "rejected");
  if (primary.length !== 1 || primary[0]!.canonicalBookId === null) return "";
  const matches = catalogue.filter(b => b.canonicalBookId === primary[0]!.canonicalBookId);
  return matches.length === 1 ? matches[0]!.id : "";
}

/** A display-only primary-book projection must not silently rewrite taxonomy on Save. */
export function changedReviewBookSelection(initial: string, selected: string): {bookClassificationIds?: string[]} {
  return selected === initial ? {} : { bookClassificationIds: selected ? [selected] : [] };
}

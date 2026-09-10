import { resolveBibleBook, extractPrimaryPassageFromTitle, validateBiblePassage,
  type PrimaryPassageCoordinates } from "./bible-passage";

export const primaryBookResolutionVersion = "explicit-primary-book-v1";
export type PassageResolution = { passage: PrimaryPassageCoordinates; originalText: string };

/** Exact field parsing, not thematic inference. A title is never interpreted as a book-only field. */
export function resolveExplicitPassage(text: string, title = false): PassageResolution | null {
  const book = !title && resolveBibleBook(text);
  if (book) return { passage: { canonicalBookId: book.id, startChapter: null, startVerse: null,
    endChapter: null, endVerse: null }, originalText: text };
  const parsed = extractPrimaryPassageFromTitle(text);
  if (parsed.outcome !== "one_valid_reference") return null;
  // A dedicated passage field must contain only that reference, not additional prose/references.
  if (!title && parsed.passage.originalReferenceText !== text.normalize("NFKC").trim()) return null;
  return { passage: { canonicalBookId: parsed.passage.canonicalBookId,
    startChapter: parsed.passage.startChapter, startVerse: parsed.passage.startVerse,
    endChapter: parsed.passage.endChapter, endVerse: parsed.passage.endVerse },
    originalText: parsed.passage.originalReferenceText };
}

/** Fill a missing canonical ID only; existing coordinates and explicit human choices win. */
export function fillExplicitPrimaryBook<T extends { displayText: string; canonicalBookId: number | null;
  startChapter: number | null; startVerse: number | null; endChapter: number | null; endVerse: number | null;
  relationshipRole: string }>(reference: T): T {
  if (reference.relationshipRole !== "primary" || reference.canonicalBookId !== null) return reference;
  const result = resolveExplicitPassage(reference.displayText);
  if (!result) return reference;
  const candidate = { ...reference, canonicalBookId: result.passage.canonicalBookId };
  return validateBiblePassage(candidate).valid ? candidate : reference;
}

export interface PrimaryBookEvidence {
  reviewStatus: string | null;
  references: Array<Omit<PrimaryPassageCoordinates, "canonicalBookId"> & { id: string; canonicalBookId: number | null;
    displayText: string; relationshipRole: string; isLead: boolean; reviewStatus: string; provenance: string }>;
  sourceTitles: string[];
  sourcePassages: string[];
}
export interface PrimaryBookAssessment {
  outcome: "newly_assigned" | "already_correct" | "preserved_human_selection" | "unresolved";
  reason: string;
  passage: PrimaryPassageCoordinates | null;
  referenceId: string | null;
  originalText: string | null;
}
export function assessPrimaryBook(evidence: PrimaryBookEvidence): PrimaryBookAssessment {
  const result = (outcome: PrimaryBookAssessment["outcome"], reason: string,
    passage: PrimaryPassageCoordinates | null = null, referenceId: string | null = null,
    originalText: string | null = null): PrimaryBookAssessment => ({ outcome, reason, passage, referenceId, originalText });
  const primary = evidence.references.filter(r => r.relationshipRole === "primary" && r.reviewStatus !== "rejected");
  const lead = primary.filter(r => r.isLead);
  const existing = lead.length === 1 ? lead[0] : primary.length === 1 ? primary[0] : undefined;
  const human = evidence.reviewStatus !== null && evidence.reviewStatus !== "pending" ||
    primary.some(r => r.reviewStatus === "confirmed" || r.provenance === "administrator" || r.provenance === "administrator_correction");
  const titleResults = evidence.sourceTitles.map(t => resolveExplicitPassage(t, true));
  if (human) {
    const conflict = existing?.canonicalBookId !== null && existing !== undefined && titleResults.some(r =>
      r !== null && r.passage.canonicalBookId !== existing.canonicalBookId);
    return result("preserved_human_selection", conflict ? "human_selection_source_conflict" : "human_decision_preserved",
      existing?.canonicalBookId && validateBiblePassage({ ...existing, canonicalBookId: existing.canonicalBookId }).valid
        ? { ...existing, canonicalBookId: existing.canonicalBookId } : null);
  }
  if (primary.length && !existing) return result("unresolved", "multiple_primary_without_unique_lead");
  if (existing?.canonicalBookId !== null && existing !== undefined) {
    const coordinates = { ...existing, canonicalBookId: existing.canonicalBookId };
    if (!validateBiblePassage(coordinates).valid) return result("unresolved", "invalid_existing_coordinates");
    if (titleResults.some(r => r && r.passage.canonicalBookId !== existing.canonicalBookId))
      return result("unresolved", "existing_assignment_source_conflict");
    return result("already_correct", "existing_primary_preserved", coordinates, existing.id);
  }
  if (existing) {
    const parsed = resolveExplicitPassage(existing.displayText);
    const coordinates = parsed && { ...existing, canonicalBookId: parsed.passage.canonicalBookId };
    return coordinates && validateBiblePassage(coordinates).valid
      ? result("newly_assigned", "explicit_primary_field", coordinates, existing.id, existing.displayText)
      : result("unresolved", "invalid_explicit_primary_field");
  }
  const fields = evidence.sourcePassages.map(t => resolveExplicitPassage(t));
  if (fields.some(r => !r)) return result("unresolved", "invalid_or_ambiguous_source_passage");
  const sources = [...fields, ...titleResults.filter((r): r is PassageResolution => r !== null)];
  if (!sources.length) return result("unresolved", evidence.sourceTitles.some(t => extractPrimaryPassageFromTitle(t).outcome === "manual_review_required")
    ? "ambiguous_or_invalid_source_title" : "missing_explicit_passage");
  if (titleResults.some(r => !r) && evidence.sourceTitles.length > 1) return result("unresolved", "inconsistent_source_titles");
  if (new Set(sources.map(r => r!.passage.canonicalBookId)).size !== 1) return result("unresolved", "multiple_books_without_primary_designation");
  const first = sources[0]!;
  if (sources.some(r => JSON.stringify(r!.passage) !== JSON.stringify(first.passage)))
    return result("unresolved", "conflicting_passage_ranges");
  return result("newly_assigned", fields.length ? "explicit_source_passage" : "preserved_source_title", first.passage, null, first.originalText);
}

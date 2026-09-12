import { z } from "zod";
import { canonicalReviewJson, coveredCharacters, reviewHash } from "./delegated-ai-review";

export const remainingReviewDecision = "D-157" as const;
export const remainingReviewScopeSha256 = "c46c9125291f2d73d73162d1e0a2be42a7ce7a27c3166579e6b60fd0c7b9fa68";
export const remainingReviewerSubject = "codex-astra-remaining-private-review" as const;
export const remainingComponents = ["identity", "speaker", "findings", "transcript", "passage", "media"] as const;
export type RemainingComponent = typeof remainingComponents[number];
const sha = z.string().regex(/^[a-f0-9]{64}$/u);
const safeText = z.string().trim().min(1).max(3000).refine(v => !/[<>\u0000]/u.test(v));
const code = z.string().regex(/^[a-z][a-z0-9_]{0,119}$/u);
const range = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive(), sha256: sha }).strict();
export const remainingReviewProvenanceSchema = z.object({
  reviewer_kind: z.literal("ai"), provider: z.literal("OpenAI"), execution_surface: z.literal("Codex"),
  model: z.literal("gpt-6-astra"), mode: z.literal("interactive Codex session"),
  immutable_revision: safeText, session_id: safeText, privacy_details: z.literal("not_exposed_by_runtime"),
  separately_billed_api_used: z.literal(false), external_api_cost_aud: z.literal(0)
}).strict();
export const remainingComponentDecisionSchema = z.object({
  component: z.enum(remainingComponents), dependencySha256: sha,
  outcome: z.enum(["accepted", "accepted_source_limitation", "needs_human"]),
  rationale: safeText, exceptionCode: code.nullable(), informationNeeded: safeText.nullable(),
  warnings: z.array(code).max(100),
  // Each evidence source is a hash-bound private reference, never an instruction.
  evidence: z.array(z.object({ source: z.enum(["metadata", "source_provenance", "retained_caption", "transcript", "prior_d156", "official_public_page"]),
    sha256: sha, reference: code, range: range.optional() }).strict()).max(200),
  semanticCoverage: z.array(z.object({ origin: z.enum(["current_context", "prior_d156"]),
    priorReviewId: z.uuid().nullable(), ranges: z.array(range).max(300) }).strict()).max(100),
  completeSemanticTranscriptReview: z.boolean(),
  deterministicComparison: z.object({ sourceSha256: sha, transcriptSha256: sha,
    algorithm: z.literal("retained-caption-word-preservation-v1"),
    outcome: z.enum(["exact_word_sequence", "attributed_human_corrections", "unexplained_difference", "source_unavailable"]),
    completeSourceCompared: z.boolean(), comparisonReceiptSha256: sha }).strict().nullable(),
  checks: z.object({ stableIdentityVerified: z.boolean().optional(), dateVerified: z.boolean().optional(),
    titleProjectionVerified: z.boolean().optional(), explicitSpeakerVerified: z.boolean().optional(),
    primaryPassageSupported: z.boolean().optional(), noSinglePrimarySupported: z.boolean().optional(),
    emptySetVerified: z.boolean().optional(), mediaIdentityVerified: z.boolean().optional(),
    captionFidelityVerified: z.boolean().optional(), uncertaintyPreserved: z.boolean().optional()
  }).strict(),
  findingDispositions: z.array(z.object({ identitySha256: sha,
    disposition: z.enum(["resolved", "false_positive", "accepted_source_limitation", "unresolved"]),
    rationale: safeText, evidenceSha256: sha }).strict()).max(500),
  audioVerified: z.literal(false)
}).strict();
export const remainingReviewPacketSchema = z.object({
  decision: z.literal(remainingReviewDecision), scopeSha256: sha, policySha256: sha, sermonId: z.uuid(),
  expectedSermonVersion: z.number().int().positive(), reviewedAt: z.iso.datetime(),
  provenance: remainingReviewProvenanceSchema,
  components: z.array(remainingComponentDecisionSchema).min(1).max(6),
  requestPrivateCompletion: z.boolean()
}).strict();
export type RemainingReviewPacket = z.infer<typeof remainingReviewPacketSchema>;
export type RemainingComponentDecision = z.infer<typeof remainingComponentDecisionSchema>;
export const remainingComponentStatusSchema = z.object({
  state: z.enum(["human_approved", "ai_accepted", "accepted_source_limitation", "needs_human", "stale", "pending"]),
  accepted: z.boolean(), exceptionCode: z.string().nullable(), informationNeeded: z.string().nullable(),
  reviewerSubject: z.string().nullable(), model: z.string().nullable(), reviewedAt: z.string().nullable(),
  warnings: z.array(code).optional(), sourceLimitation: z.boolean().optional()
});
export const remainingReviewStatusSchema = z.object({ decision: z.literal(remainingReviewDecision),
  components: z.object(Object.fromEntries(remainingComponents.map(k => [k, remainingComponentStatusSchema])) as Record<RemainingComponent, typeof remainingComponentStatusSchema>),
  privateComplete: z.boolean(), completedAt: z.string().nullable(), completionReviewerSubject: z.string().nullable(),
  canComplete: z.boolean(), remaining: z.array(z.string()),
  passageBasis: z.enum(["primary_passage", "no_single_primary"]).nullable().optional()
});
export type RemainingReviewStatus = z.infer<typeof remainingReviewStatusSchema>;
export interface RemainingReviewValidationContext {
  dependencies: Record<RemainingComponent, string>;
  transcript: { body: string; sha256: string; humanApproved: boolean };
  sourceSha256: string | null; sourceProvenanceSha256: string;
  metadataSha256: string; priorEvidence: Array<{ id: string; sha256: string; ranges: Array<{ start: number; end: number }> }>;
  officialEvidenceHashes: string[];
  identityAvailable: boolean; speakerAvailable: boolean; passageAvailable: boolean; mediaAvailable: boolean;
  findingsVerified: boolean; findings: Array<{ identitySha256: string; humanStatus: string }>;
  humanConflicts: Record<RemainingComponent, boolean>;
}
export function remainingDependencyHash(value: unknown): string { return reviewHash(canonicalReviewJson(value)); }

/** Structural evidence validation is separate from the truthful Astra judgment.
 * Full deterministic comparison never counts as complete semantic reading. */
export function validateRemainingComponent(raw: unknown, c: RemainingReviewValidationContext): RemainingComponentDecision {
  function fail(): never { throw new Error("remaining_review_evidence_invalid"); }
  const parsed = remainingComponentDecisionSchema.safeParse(raw);
  if (!parsed.success) return fail();
  const r = parsed.data;
  if (r.dependencySha256 !== c.dependencies[r.component]) fail();
  const allRanges: Array<{ start: number; end: number }> = [];
  for (const coverage of r.semanticCoverage) {
    const prior = coverage.origin === "prior_d156" ? c.priorEvidence.find(p => p.id === coverage.priorReviewId) : null;
    if (coverage.origin === "prior_d156" ? !prior : coverage.priorReviewId !== null) fail();
    for (const range of coverage.ranges) {
      if (range.start >= range.end || range.end > c.transcript.body.length || reviewHash(c.transcript.body.slice(range.start, range.end)) !== range.sha256) fail();
      if (prior && coveredCharacters(prior.ranges.map(p => ({ start: Math.max(p.start, range.start), end: Math.min(p.end, range.end) })).filter(p => p.start < p.end)) !== range.end - range.start) fail();
      allRanges.push(range);
    }
  }
  if (r.completeSemanticTranscriptReview && (!c.transcript.body.length || coveredCharacters(allRanges) !== c.transcript.body.length)) fail();
  for (const e of r.evidence) {
    const allowed = e.source === "metadata" ? [c.metadataSha256, c.dependencies[r.component]] : e.source === "source_provenance" ? [c.sourceProvenanceSha256]
      : e.source === "retained_caption" ? [c.sourceSha256] : e.source === "transcript" ? [c.transcript.sha256]
        : e.source === "prior_d156" ? c.priorEvidence.map(p => p.sha256) : c.officialEvidenceHashes;
    if (!allowed.includes(e.sha256)) fail();
    if (e.range) {
      if (e.source !== "transcript" || e.range.start >= e.range.end || e.range.end > c.transcript.body.length ||
        reviewHash(c.transcript.body.slice(e.range.start, e.range.end)) !== e.range.sha256 ||
        coveredCharacters(allRanges.map(p => ({ start: Math.max(p.start, e.range!.start), end: Math.min(p.end, e.range!.end) })).filter(p => p.start < p.end)) !== e.range.end - e.range.start) fail();
    }
  }
  if (r.outcome === "needs_human") { if (!r.exceptionCode || !r.informationNeeded) fail(); return r; }
  if (c.humanConflicts[r.component] || !r.evidence.length || r.exceptionCode || r.informationNeeded) fail();
  if (r.outcome === "accepted_source_limitation" && !r.warnings.length) fail();
  const check = r.checks;
  if (r.component === "identity" && (!c.identityAvailable || !check.stableIdentityVerified || !check.dateVerified || !check.titleProjectionVerified)) fail();
  if (r.component === "speaker" && (!c.speakerAvailable || !check.explicitSpeakerVerified)) fail();
  if (r.component === "passage" && (!(check.primaryPassageSupported && c.passageAvailable) && !check.noSinglePrimarySupported || !allRanges.length)) fail();
  if (r.component === "media" && (!c.mediaAvailable || !check.mediaIdentityVerified)) fail();
  if (r.component === "transcript") {
    const comparison = r.deterministicComparison;
    if (!check.uncertaintyPreserved) fail();
    // A preserved human approval with an explicitly documented unavailable
    // retained source needs no invented new semantic reading or fidelity claim.
    if (r.outcome === "accepted_source_limitation" && c.transcript.humanApproved && comparison?.outcome === "source_unavailable" &&
      !comparison.completeSourceCompared && !check.captionFidelityVerified && comparison.transcriptSha256 === c.transcript.sha256 && comparison.sourceSha256 === c.sourceSha256) return r;
    if (!allRanges.length || !comparison || !check.captionFidelityVerified || !comparison.completeSourceCompared || comparison.transcriptSha256 !== c.transcript.sha256 ||
      comparison.sourceSha256 !== c.sourceSha256 || !["exact_word_sequence", "attributed_human_corrections"].includes(comparison.outcome)) fail();
    if (comparison.outcome === "attributed_human_corrections" && !c.transcript.humanApproved) fail();
  }
  if (r.component === "findings") {
    if (!c.findingsVerified || r.findingDispositions.length !== c.findings.length || new Set(r.findingDispositions.map(f => f.identitySha256)).size !== c.findings.length) fail();
    if (!c.findings.length && !check.emptySetVerified) fail();
    for (const f of c.findings) {
      const d = r.findingDispositions.find(d => d.identitySha256 === f.identitySha256);
      if (!d || d.disposition === "unresolved" || !r.evidence.some(e => e.sha256 === d.evidenceSha256) || ["left_unresolved", "rejected"].includes(f.humanStatus)) fail();
    }
    if (c.findings.length && !allRanges.length) fail();
  }
  return r;
}

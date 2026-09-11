import { createHash } from "node:crypto";
import { z } from "zod";
import { containsHtmlTag } from "./content-readiness";
import { inspectGeneratedText } from "../enrichment/generated-text-mechanical-qa";

export const delegatedReviewDecision = "D-156" as const;
export const delegatedReviewerSubject = "codex-astra-delegated-review" as const;
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const plain = (max: number) => z.string().min(1).max(max).refine(v => v.trim().length > 0 && !containsHtmlTag(v));
export const aiContentSchema = z.union([
  z.object({ description: plain(2000) }).strict(),
  z.object({ question: plain(1000), answer: plain(10000) }).strict()
]);
export type AiContent = z.infer<typeof aiContentSchema>;
// Rejected bytes remain private history, including the exact defects that made
// them ineligible as current content. They never pass through accepted output.
const rejectedContentSchema = z.union([
  z.object({ description: z.string().max(100_000) }).strict(),
  z.object({ question: z.string().max(100_000), answer: z.string().max(100_000) }).strict()
]);
const range = z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }).strict();
export const delegatedReviewResultSchema = z.object({
  decision: z.literal(delegatedReviewDecision), scopeSha256: hash, policySha256: hash,
  sermonId: z.uuid(), artifactKey: z.string().refine(v => v === "description" ||
    (v.startsWith("qa:") && v === v.toLowerCase() && z.uuid().safeParse(v.slice(3)).success)),
  expectedSermonVersion: z.number().int().positive(), inputVersion: z.number().int().positive(),
  displayOrder: z.number().int().min(1).max(10).nullable(),
  transcriptSha256: hash, groundingRevisionId: z.uuid(), sourceSha256: hash, sourceProvenanceSha256: hash,
  inputSha256: hash, outputSha256: hash,
  original: aiContentSchema, output: aiContentSchema,
  outcome: z.enum(["accepted", "corrected_accepted", "needs_human"]),
  correctionRound: z.number().int().min(0).max(1),
  reviewedAt: z.iso.datetime(),
  provenance: z.object({
    reviewer_kind: z.literal("ai"), provider: z.literal("OpenAI"),
    execution_surface: z.literal("Codex"), model: z.literal("gpt-6-astra"),
    mode: z.literal("interactive Codex session"),
    immutable_revision: plain(200), session_id: plain(200),
    privacy_details: z.literal("not_exposed_by_runtime"),
    separately_billed_api_used: z.literal(false), external_api_cost_aud: z.literal(0)
  }).strict(),
  evidence: z.array(range.extend({ sha256: hash, purpose: z.enum(["subject", "reasoning", "application", "claim", "qualification", "scripture", "ordering"]) })).max(100),
  coverage: z.array(range).min(1).max(300),
  assessment: z.object({
    fullArtifactRead: z.literal(true),
    centralArgumentChecked: z.boolean(), substantiveClaimsSupported: z.boolean(),
    qualificationsPreserved: z.boolean(), questionAnswersDirectly: z.boolean(),
    scriptureAttributionChecked: z.boolean(), readabilityChecked: z.boolean(),
    orderingChecked: z.boolean(),
    integrity: z.enum(["verified", "human_edits_preserved", "source_unavailable", "unexplained_drift"]),
    rationale: plain(3000), exceptionCode: z.string().regex(/^[a-z_]+$/u).nullable(),
    informationNeeded: plain(2000).nullable(),
    standingWarnings: z.array(plain(150)).max(100),
    rejectedCorrection: z.object({
      content: rejectedContentSchema, sha256: hash,
      failureCodes: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,149}$/u)).min(1).max(100)
    }).strict().optional(),
    audioVerified: z.literal(false), completeSemanticTranscriptReview: z.boolean()
  }).strict()
}).strict();
export type DelegatedReviewResult = z.infer<typeof delegatedReviewResultSchema>;

export function canonicalReviewJson(value: unknown): string {
  if (Array.isArray(value)) return `[${Array.from(value, canonicalReviewJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new Error("delegated_review_canonical_json_required");
    }
    return `{${Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([k,v]) => `${JSON.stringify(k)}:${canonicalReviewJson(v)}`).join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value) ||
    !["string", "number", "boolean"].includes(typeof value) && value !== null) {
    throw new Error("delegated_review_canonical_json_required");
  }
  return JSON.stringify(value);
}
export function reviewHash(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
export function contentHash(value: AiContent): string { return reviewHash(canonicalReviewJson(value)); }
// Pass PostgreSQL's to_jsonb(source_row) result so timestamps are hashed exactly
// as stored JSON, independently of the Node PostgreSQL Date conversion.
export function sourceProvenanceHash(value: unknown): string { return reviewHash(canonicalReviewJson(value)); }
export function coveredCharacters(ranges: Array<{start:number;end:number}>): number {
  const ordered = [...ranges].sort((a,b) => a.start-b.start);
  let total=0, end=0;
  for (const r of ordered) { total += Math.max(0, r.end-Math.max(end,r.start)); end=Math.max(end,r.end); }
  return total;
}
export function validateDelegatedReview(raw: unknown, transcript: string): DelegatedReviewResult {
  const fail = () => { throw new Error("delegated_review_validation_failed"); };
  const parsed = delegatedReviewResultSchema.safeParse(raw);
  if (!parsed.success) return fail();
  const r = parsed.data;
  if (reviewHash(transcript)!==r.transcriptSha256 || contentHash(r.original)!==r.inputSha256 || contentHash(r.output)!==r.outputSha256) fail();
  const description = r.artifactKey === "description";
  if (description !== ("description" in r.original) || description !== ("description" in r.output) || description !== (r.displayOrder===null)) fail();
  if ((r.outcome === "corrected_accepted") !== (r.inputSha256 !== r.outputSha256)) fail();
  if (r.outcome === "corrected_accepted" && r.correctionRound !== 1) fail();
  if (r.outcome === "accepted" && r.correctionRound !== 0) fail();
  const rejected = r.assessment.rejectedCorrection;
  if (r.outcome === "needs_human" && r.correctionRound === 1) {
    if (!rejected || description !== ("description" in rejected.content) ||
      contentHash(rejected.content) !== rejected.sha256) fail();
  } else if (rejected) fail();
  for (const q of [...r.coverage, ...r.evidence]) if (q.start>=q.end || q.end>transcript.length) fail();
  for (const e of r.evidence) {
    const readIntersection = r.coverage.map(c => ({ start: Math.max(c.start, e.start), end: Math.min(c.end, e.end) }))
      .filter(c => c.start < c.end);
    if (reviewHash(transcript.slice(e.start,e.end))!==e.sha256 || coveredCharacters(readIntersection)!==e.end-e.start) fail();
  }
  if (r.assessment.completeSemanticTranscriptReview && coveredCharacters(r.coverage)!==transcript.length) fail();
  if (r.outcome === "needs_human") {
    if (!r.assessment.exceptionCode || !r.assessment.informationNeeded) fail();
    return r;
  }
  const a=r.assessment;
  if (!r.evidence.length || !a.centralArgumentChecked || !a.substantiveClaimsSupported || !a.qualificationsPreserved || !a.questionAnswersDirectly || !a.scriptureAttributionChecked || !a.readabilityChecked || !a.orderingChecked || a.exceptionCode || a.informationNeeded || !["verified","human_edits_preserved"].includes(a.integrity)) fail();
  if ("description" in r.output) {
    const words=r.output.description.trim().split(/\s+/u).length;
    if (words<180 || words>220 || inspectGeneratedText(r.output.description,[]).blockingIssueCount>0) fail();
  } else if (inspectGeneratedText("",[r.output]).blockingIssueCount>0) fail();
  return r;
}

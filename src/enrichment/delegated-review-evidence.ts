/** D-156 local evidence only: no provider, database, generation or automatic judgment. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  aiContentSchema, canonicalReviewJson, contentHash, coveredCharacters, reviewHash, sourceProvenanceHash,
  validateDelegatedReview, type AiContent, type DelegatedReviewResult
} from "../domain/delegated-ai-review";
import { inspectGeneratedText } from "./generated-text-mechanical-qa";
import { persistNoClobber } from "./pilot-punctuation";

export const delegatedEvidenceAuthority = {
  count: 155,
  scopeSha256: "818a92928c0307d89742dceb6e207944741c218fb69f1304ad9f1236477a1197",
  policySha256: "d7729bb84bc43369dd1a2d58538cf6d661303a7f24532d99cc95db54252d82d5"
} as const;
export const delegatedEvidenceInstructionFiles = [
  "AGENTS.md", ".agents/skills/sermon-enrichment/SKILL.md",
  ".agents/skills/sermon-enrichment/references/grounding-contract.md",
  ".agents/skills/sermon-enrichment/references/delegated-review-contract.md"
] as const;
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const integer = z.number().int().positive();
const rangeSchema = z.object({ start: z.number().int().nonnegative(), end: integer }).strict();
const keySchema = z.string().regex(/^(description|qa:(?:[1-9]|10))$/u);
const failureCode = z.string().regex(/^[a-z][a-z0-9_]{0,149}$/u);
const contentSchema = z.union([
  z.object({ description: z.string().max(100_000) }).strict(),
  z.object({ question: z.string().max(100_000), answer: z.string().max(100_000) }).strict()
]);
const purposeSchema = z.enum(["subject", "reasoning", "application", "claim", "qualification", "scripture", "ordering"]);
const rubricSchema = z.object({
  fullArtifactRead: z.literal(true), centralArgumentChecked: z.boolean(), substantiveClaimsSupported: z.boolean(),
  qualificationsPreserved: z.boolean(), questionAnswersDirectly: z.boolean(), scriptureAttributionChecked: z.boolean(),
  readabilityChecked: z.boolean(), orderingChecked: z.boolean()
}).strict();
export const delegatedAssessmentSchema = z.object({
  schemaVersion: z.literal(1), sequence: integer.max(155),
  runtime: z.object({
    model: z.literal("gpt-6-astra"), modelEvidence: z.literal("current_turn_metadata"),
    immutableRevision: z.literal("not_exposed_by_runtime"), sessionId: z.literal("not_exposed_by_runtime")
  }).strict(),
  coverage: z.array(rangeSchema).max(300), completeSemanticTranscriptReview: z.boolean(),
  previousPrivateContext: z.object({
    origin: z.literal("direct_frozen_packet_read_before_helper_available"), actuallyRead: z.literal(true),
    coverage: z.array(rangeSchema).min(1).max(300), artifactKeys: z.array(keySchema).min(1).max(11)
  }).strict().optional(),
  artifacts: z.array(rubricSchema.extend({
    key: keySchema, outcome: z.enum(["accepted", "corrected_accepted", "needs_human"]),
    rationale: z.string().min(1).max(3000),
    evidence: z.array(rangeSchema.extend({ purpose: purposeSchema })).max(100),
    exceptionCode: failureCode.nullable(), informationNeeded: z.string().min(1).max(2000).nullable(),
    correctedOutput: contentSchema.optional(),
    failedCorrection: z.object({ content: contentSchema, failureCodes: z.array(failureCode).min(1).max(100) }).strict().optional()
  }).strict()).max(11)
}).strict();
export type DelegatedAssessment = z.infer<typeof delegatedAssessmentSchema>;

const scopeSchema = z.object({
  decision: z.literal("D-156"), privateContent: z.literal(true), ids: z.array(z.uuid()),
  scopeSha256: hash, policySha256: hash,
  packets: z.array(z.object({ sequence: integer, sha256: hash }).strict())
}).strict();
const packetSchema = z.object({
  schemaVersion: z.literal(1), privateContent: z.literal(true), sequence: integer,
  sermon: z.looseObject({ id: z.uuid(), status: z.literal("draft"), published_at: z.null(), deleted_at: z.null(),
    row_version: integer, summary: z.string(), summary_row_version: integer, summary_status: z.string(), summary_approved_at: z.string().nullable() }),
  transcript: z.looseObject({ sermon_id: z.uuid(), body_text: z.string().min(1).max(2_000_000),
    grounding_revision_id: z.uuid(), status: z.string(), row_version: integer }),
  source: z.looseObject({ sermon_id: z.uuid(), source_content_sha256: hash, warnings: z.array(z.unknown()),
    caption_language: z.string(), caption_track_type: z.string(), apparent_completeness: z.string(), uncertainty_marker_count: z.number().int().nonnegative() }),
  pairs: z.array(z.looseObject({ id: z.uuid(), sermon_id: z.uuid(), display_order: integer.max(10), row_version: integer,
    question_text: z.string(), answer_text: z.string(), status: z.string(), approved_at: z.string().nullable() })).max(10),
  review: z.unknown(), findings: z.array(z.unknown()), passages: z.array(z.unknown()), speaker: z.string().nullable(),
  transcriptSha256: hash, sourceProvenanceSha256: hash, originalRecordSha256: hash
}).strict();
const integritySchema = z.object({
  sequence: integer, sourceFound: z.boolean(), sourcePath: z.string().nullable(), sourceSha256: hash,
  parsed: z.boolean(), cues: integer.nullable(), normalizedWordMatch: z.boolean(), transcriptSha256: hash,
  transcriptCharacters: integer, transcriptWords: integer,
  integrity: z.enum(["verified", "human_edits_preserved", "source_unavailable", "unexplained_drift"]),
  humanApprovalPreserved: z.boolean(), audioVerified: z.literal(false)
}).strict();
type Packet = z.infer<typeof packetSchema>;
type Range = z.infer<typeof rangeSchema>;
type LoadedEvidence = Awaited<ReturnType<DelegatedEvidenceStore["load"]>>;
type PendingArtifact = { key: string; artifactKey: string; content: AiContent; version: number; displayOrder: number | null };

export class DelegatedEvidenceError extends Error {
  constructor(readonly code: string) { super(code); this.name = "DelegatedEvidenceError"; }
}
function fail(code: string): never { throw new DelegatedEvidenceError(code); }
function parse<T extends z.ZodType>(schema: T, raw: unknown, code: string): z.infer<T> {
  const result = schema.safeParse(raw); if (!result.success) return fail(code); return result.data;
}
function bytesHash(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
function json(bytes: Buffer): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return fail("private_json_invalid"); }
}
function tag(sequence: number): string { return String(sequence).padStart(3, "0"); }
function fileName(kind: string, sequence: number): string { return `${kind}-${tag(sequence)}.private.json`; }
function humanApproved(status: string, approvedAt: string | null): boolean { return status === "approved" || approvedAt !== null; }
function pendingArtifacts(packet: Packet): PendingArtifact[] {
  const result: PendingArtifact[] = [];
  if (!humanApproved(packet.sermon.summary_status, packet.sermon.summary_approved_at)) {
    result.push({ key: "description", artifactKey: "description", content: { description: packet.sermon.summary }, version: packet.sermon.summary_row_version, displayOrder: null });
  }
  for (const pair of packet.pairs) if (!humanApproved(pair.status, pair.approved_at)) {
    result.push({ key: `qa:${pair.display_order}`, artifactKey: `qa:${pair.id}`, content: { question: pair.question_text, answer: pair.answer_text }, version: pair.row_version, displayOrder: pair.display_order });
  }
  return result;
}
function mergedRanges(ranges: Range[]): Range[] {
  const merged: Range[] = [];
  for (const next of [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = merged.at(-1);
    if (last && next.start <= last.end) last.end = Math.max(last.end, next.end);
    else merged.push({ start: next.start, end: next.end });
  }
  return merged;
}
function rangeCovered(available: Range[], wanted: Range): boolean {
  const intersections = available.map(r => ({ start: Math.max(r.start, wanted.start), end: Math.min(r.end, wanted.end) })).filter(r => r.end > r.start);
  return coveredCharacters(intersections) === wanted.end - wanted.start;
}
function warningCodes(packet: Packet): string[] {
  const codes = packet.source.warnings.map(w => typeof w === "string" ? w : w && typeof w === "object" && "code" in w ? w.code : undefined)
    .map(code => typeof code === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,149}$/u.test(code) ? code : "SOURCE_WARNING_DETAIL_RETAINED_PRIVATELY");
  return [...new Set([...codes, "MODEL_REVISION_UNAVAILABLE_LIMITED_REPRODUCIBILITY"])];
}

/** Caller-supplied bindings support anonymized fixtures; the executable uses only the fixed authority above. */
export class DelegatedEvidenceStore {
  readonly repositoryRoot: string;
  readonly privateRoot: string;
  constructor(repositoryRoot: string, readonly authority: { count: number; scopeSha256: string; policySha256: string } = delegatedEvidenceAuthority) {
    this.repositoryRoot = resolve(repositoryRoot); this.privateRoot = join(this.repositoryRoot, "private", "delegated-ai-review");
  }
  private async safePath(name: string, missingAllowed = false): Promise<string> {
    if (!/^[a-z0-9-]+\.private\.json$/u.test(name)) fail("private_path_invalid");
    for (const directory of [this.repositoryRoot, join(this.repositoryRoot, "private"), this.privateRoot]) {
      const stat = await lstat(directory).catch(() => fail("private_directory_missing"));
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail("private_path_invalid");
    }
    const path = join(this.privateRoot, name);
    try { execFileSync("git", ["-C", this.repositoryRoot, "check-ignore", "--quiet", "--", relative(this.repositoryRoot, path)], { stdio: "pipe" }); }
    catch { fail("private_storage_not_ignored"); }
    const stat = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (missingAllowed && error.code === "ENOENT") return null;
      return fail("private_file_missing");
    });
    if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.size > 10_000_000)) fail("private_path_invalid");
    return path;
  }
  private async read(name: string): Promise<Buffer> { return readFile(await this.safePath(name)); }
  private async optional(name: string): Promise<Buffer | null> {
    const path = await this.safePath(name, true);
    return readFile(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null; return fail("private_read_failed");
    });
  }
  private async persist(name: string, value: unknown): Promise<"created" | "unchanged"> {
    try { return await persistNoClobber(await this.safePath(name, true), canonicalReviewJson(value) + "\n"); }
    catch (error) { if (error instanceof DelegatedEvidenceError) throw error; return fail("private_persistence_conflict"); }
  }
  async load(sequence: number) {
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > this.authority.count || sequence > 155) fail("sequence_invalid");
    const scope = parse(scopeSchema, json(await this.read("scope.private.json")), "scope_schema_invalid");
    const policy = reviewHash(canonicalReviewJson(await Promise.all(delegatedEvidenceInstructionFiles.map(async path => ({ path, sha256: reviewHash(await readFile(join(this.repositoryRoot, path), "utf8")) })))));
    if (scope.ids.length !== this.authority.count || new Set(scope.ids).size !== this.authority.count || scope.packets.length !== this.authority.count ||
      scope.scopeSha256 !== this.authority.scopeSha256 || reviewHash(canonicalReviewJson(scope.ids)) !== scope.scopeSha256 ||
      scope.policySha256 !== this.authority.policySha256 || scope.policySha256 !== policy || scope.packets.some((p, index) => p.sequence !== index + 1)) fail("scope_or_policy_drift");
    const packetBytes = await this.read(fileName("record", sequence));
    const packetSha256 = bytesHash(packetBytes);
    if (scope.packets[sequence - 1]?.sha256 !== packetSha256) fail("packet_hash_drift");
    const packet = parse(packetSchema, json(packetBytes), "packet_schema_invalid");
    const { schemaVersion: _schema, privateContent: _private, sequence: _sequence, transcriptSha256: _transcript, sourceProvenanceSha256: _source, originalRecordSha256, ...original } = packet;
    if (packet.sequence !== sequence || packet.sermon.id !== scope.ids[sequence - 1] || packet.transcript.sermon_id !== packet.sermon.id || packet.source.sermon_id !== packet.sermon.id ||
      packet.pairs.some((q, i) => q.sermon_id !== packet.sermon.id || q.display_order !== i + 1) || new Set(packet.pairs.map(q => q.id)).size !== packet.pairs.length ||
      reviewHash(canonicalReviewJson(original)) !== originalRecordSha256 || reviewHash(packet.transcript.body_text) !== packet.transcriptSha256 || sourceProvenanceHash(packet.source) !== packet.sourceProvenanceSha256) fail("packet_identity_or_content_drift");
    const integrityBytes = await this.read(fileName("integrity", sequence));
    const integrity = parse(integritySchema, json(integrityBytes), "integrity_schema_invalid");
    const expectedIntegrity = integrity.normalizedWordMatch ? "verified" : packet.transcript.status === "approved" ? "human_edits_preserved" : integrity.sourceFound ? "unexplained_drift" : "source_unavailable";
    if (integrity.sequence !== sequence || integrity.transcriptSha256 !== packet.transcriptSha256 || integrity.sourceSha256 !== packet.source.source_content_sha256 ||
      integrity.transcriptCharacters !== packet.transcript.body_text.length || integrity.transcriptWords !== packet.transcript.body_text.trim().split(/\s+/u).length ||
      integrity.humanApprovalPreserved !== (packet.transcript.status === "approved") || integrity.integrity !== expectedIntegrity ||
      integrity.normalizedWordMatch && (!integrity.sourceFound || !integrity.parsed) || integrity.parsed && !integrity.sourceFound) fail("integrity_binding_invalid");
    const integritySha256 = bytesHash(integrityBytes);
    await this.persist(fileName("integrity-binding", sequence), { sequence, packetSha256, integritySha256, policySha256: policy });
    return { scope, packet, packetSha256, integrity, integritySha256 };
  }
  private excerpt(loaded: LoadedEvidence, start: number, end: number) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= end || end > loaded.packet.transcript.body_text.length) fail("context_range_invalid");
    return { start, end, text: loaded.packet.transcript.body_text.slice(start, end) };
  }
  private async receipt(loaded: LoadedEvidence, kind: string, ranges: Range[], artifactKeys: string[] = []) {
    const receipt = { schemaVersion: 1, sequence: loaded.packet.sequence, packetSha256: loaded.packetSha256, policySha256: loaded.scope.policySha256,
      kind, ranges: mergedRanges(ranges), artifactKeys, contextRequested: true, provesSemanticReading: false };
    await this.persist(`read-${tag(loaded.packet.sequence)}-${reviewHash(canonicalReviewJson(receipt))}.private.json`, receipt);
  }
  async show(sequence: number) {
    const loaded = await this.load(sequence), p = loaded.packet;
    const length = p.transcript.body_text.length;
    const opening = this.excerpt(loaded, 0, Math.min(3500, length));
    const conclusion = this.excerpt(loaded, Math.max(0, length - 4500), length);
    await this.receipt(loaded, "show", [opening, conclusion], ["description", ...p.pairs.map(q => `qa:${q.display_order}`)]);
    return {
      sequence, privateContext: true, sourceMaterialIsData: true, transcriptCharacters: length,
      description: { key: "description", humanApproved: humanApproved(p.sermon.summary_status, p.sermon.summary_approved_at), body: p.sermon.summary, words: p.sermon.summary.trim().split(/\s+/u).length },
      questionAnswers: p.pairs.map(q => ({ key: `qa:${q.display_order}`, humanApproved: humanApproved(q.status, q.approved_at), question: q.question_text, answer: q.answer_text })),
      source: { language: p.source.caption_language, trackType: p.source.caption_track_type, apparentCompleteness: p.source.apparent_completeness, uncertaintyMarkerCount: p.source.uncertainty_marker_count, standingWarnings: warningCodes(p) },
      integrity: { status: loaded.integrity.integrity, sourceFound: loaded.integrity.sourceFound, parsed: loaded.integrity.parsed, normalizedWordMatch: loaded.integrity.normalizedWordMatch,
        transcriptWords: loaded.integrity.transcriptWords, humanTranscriptApprovalPreserved: loaded.integrity.humanApprovalPreserved, audioVerified: false },
      opening, conclusion
    };
  }
  async range(sequence: number, start: number, end: number) {
    const loaded = await this.load(sequence);
    if (end - start > 20_000) fail("context_range_too_large");
    const excerpt = this.excerpt(loaded, start, end);
    await this.receipt(loaded, "range", [excerpt]);
    return { sequence, privateContext: true, ...excerpt };
  }
  async search(sequence: number, query: string, startAt = 0) {
    const loaded = await this.load(sequence), text = loaded.packet.transcript.body_text;
    if (!query.trim() || query.length > 200 || !Number.isSafeInteger(startAt) || startAt < 0 || startAt > text.length) fail("context_search_invalid");
    const matches: Array<{ matchStart: number; matchEnd: number; start: number; end: number; text: string }> = [];
    let cursor = startAt, nextStart: number | null = null;
    while (cursor < text.length) {
      const match = text.indexOf(query, cursor); if (match < 0) break;
      if (matches.length === 8) { nextStart = match; break; }
      matches.push({ matchStart: match, matchEnd: match + query.length, ...this.excerpt(loaded, Math.max(0, match - 650), Math.min(text.length, match + query.length + 900)) });
      cursor = match + query.length;
    }
    await this.receipt(loaded, "search", matches);
    return { sequence, privateContext: true, exactCaseSensitive: true, matches, nextStart, noMatchDoesNotEstablishUnsupportedClaim: true };
  }
  private async verifyReading(loaded: LoadedEvidence, assessment: DelegatedAssessment, pending: PendingArtifact[]) {
    const available: Range[] = [], shown = new Set<string>();
    if (assessment.previousPrivateContext) {
      // Three already-completed source readings were reported before this reader
      // was available. This is an explicit AI attestation, never an emission receipt.
      if (![1, 4, 5].includes(assessment.sequence)) fail("prior_context_attestation_out_of_scope");
      const prior = assessment.previousPrivateContext;
      if (prior.coverage.some(r => r.start >= r.end || r.end > loaded.packet.transcript.body_text.length)) fail("prior_context_range_invalid");
      const attestation = { schemaVersion: 1, sequence: assessment.sequence, packetSha256: loaded.packetSha256,
        policySha256: loaded.scope.policySha256, ...prior, helperEmittedEarlierContext: false };
      await this.persist(`prior-context-${tag(assessment.sequence)}-${reviewHash(canonicalReviewJson(attestation))}.private.json`, attestation);
      available.push(...prior.coverage); for (const key of prior.artifactKeys) shown.add(key);
    }
    for (const name of await readdir(this.privateRoot)) {
      if (!new RegExp(`^read-${tag(assessment.sequence)}-[a-f0-9]{64}\\.private\\.json$`, "u").test(name)) continue;
      const value = json(await this.read(name));
      const r = parse(z.object({ schemaVersion: z.literal(1), sequence: integer, packetSha256: hash, policySha256: hash,
        kind: z.enum(["show", "range", "search"]), ranges: z.array(rangeSchema), artifactKeys: z.array(keySchema), contextRequested: z.literal(true), provesSemanticReading: z.literal(false) }).strict(), value, "reading_receipt_invalid");
      if (name !== `read-${tag(assessment.sequence)}-${reviewHash(canonicalReviewJson(r))}.private.json` || r.sequence !== assessment.sequence || r.packetSha256 !== loaded.packetSha256 || r.policySha256 !== loaded.scope.policySha256) fail("reading_receipt_invalid");
      available.push(...r.ranges); for (const key of r.artifactKeys) shown.add(key);
    }
    if (pending.some(p => !shown.has(p.key))) fail("full_artifact_context_missing");
    if (assessment.coverage.some(r => r.start >= r.end || r.end > loaded.packet.transcript.body_text.length || !rangeCovered(available, r))) fail("reading_coverage_not_requested");
    if (pending.length && !assessment.coverage.length) fail("reading_coverage_missing");
  }
  async assemble(sequence: number) {
    const loaded = await this.load(sequence), pending = pendingArtifacts(loaded.packet);
    const assessmentBytes = await this.read(fileName("assessment", sequence)), assessmentSha256 = bytesHash(assessmentBytes);
    const attemptName = `assessment-attempt-${tag(sequence)}-${assessmentSha256}.private.json`;
    const existingAttempt = await this.optional(attemptName);
    const attempt = existingAttempt ? json(existingAttempt) as { reviewedAt: string } : {
      schemaVersion: 1, sequence, packetSha256: loaded.packetSha256, integritySha256: loaded.integritySha256,
      policySha256: loaded.scope.policySha256, assessmentSha256, reviewedAt: new Date().toISOString(), inputBase64: assessmentBytes.toString("base64")
    };
    // Preserve exact assessment bytes before any validator can reject them.
    if (existingAttempt) {
      const saved = parse(z.object({ schemaVersion: z.literal(1), sequence: integer, packetSha256: hash, integritySha256: hash, policySha256: hash,
        assessmentSha256: hash, reviewedAt: z.iso.datetime(), inputBase64: z.string() }).strict(), attempt, "assessment_attempt_invalid");
      if (saved.sequence !== sequence || saved.packetSha256 !== loaded.packetSha256 || saved.integritySha256 !== loaded.integritySha256 || saved.policySha256 !== loaded.scope.policySha256 || saved.assessmentSha256 !== assessmentSha256 || !Buffer.from(saved.inputBase64, "base64").equals(assessmentBytes)) fail("assessment_attempt_invalid");
    } else await this.persist(attemptName, attempt);
    const assessment = parse(delegatedAssessmentSchema, json(assessmentBytes), "assessment_schema_invalid");
    if (assessment.sequence !== sequence) fail("assessment_sequence_mismatch");
    if (new Set(assessment.artifacts.map(a => a.key)).size !== assessment.artifacts.length ||
      canonicalReviewJson(assessment.artifacts.map(a => a.key).sort()) !== canonicalReviewJson(pending.map(a => a.key).sort())) fail("pending_artifact_set_mismatch");
    await this.verifyReading(loaded, assessment, pending);
    const decisions: DelegatedReviewResult[] = [];
    const failures: Array<{ key: string; codes: string[] }> = [];
    let corrections = 0;
    for (const original of pending) {
      const a = assessment.artifacts.find(item => item.key === original.key)!;
      if (a.correctedOutput && a.failedCorrection || a.correctedOutput && a.outcome !== "corrected_accepted" || a.failedCorrection && a.outcome !== "needs_human" || a.outcome === "corrected_accepted" && !a.correctedOutput) fail("correction_outcome_mismatch");
      const candidate = a.correctedOutput ?? a.failedCorrection?.content;
      const correctionName = fileName(`correction-${original.key.replace(":", "-")}`, sequence);
      if (candidate) {
        if (("description" in original.content) !== ("description" in candidate)) fail("correction_artifact_mismatch");
        // One immutable candidate per artifact; same-byte structural retries are safe.
        await this.persist(correctionName, { sequence, key: original.key, packetSha256: loaded.packetSha256, content: candidate, sha256: contentHash(candidate) });
      } else if (await this.optional(correctionName)) fail("correction_attempt_must_be_retained");
      const output = a.correctedOutput ?? original.content;
      const r = {
        decision: "D-156", scopeSha256: loaded.scope.scopeSha256, policySha256: loaded.scope.policySha256,
        sermonId: loaded.packet.sermon.id, artifactKey: original.artifactKey, expectedSermonVersion: loaded.packet.sermon.row_version + corrections,
        inputVersion: original.version, displayOrder: original.displayOrder, transcriptSha256: loaded.packet.transcriptSha256,
        groundingRevisionId: loaded.packet.transcript.grounding_revision_id, sourceSha256: loaded.packet.source.source_content_sha256,
        sourceProvenanceSha256: loaded.packet.sourceProvenanceSha256, inputSha256: contentHash(original.content), outputSha256: contentHash(output),
        original: original.content, output, outcome: a.outcome, correctionRound: candidate ? 1 : 0, reviewedAt: attempt.reviewedAt,
        provenance: { reviewer_kind: "ai", provider: "OpenAI", execution_surface: "Codex", model: assessment.runtime.model, mode: "interactive Codex session",
          immutable_revision: assessment.runtime.immutableRevision, session_id: assessment.runtime.sessionId, privacy_details: "not_exposed_by_runtime", separately_billed_api_used: false, external_api_cost_aud: 0 },
        evidence: a.evidence.map(e => ({ ...e, sha256: reviewHash(loaded.packet.transcript.body_text.slice(e.start, e.end)) })), coverage: mergedRanges(assessment.coverage),
        assessment: { ...rubricSchema.strip().parse(a), rationale: a.rationale, exceptionCode: a.exceptionCode, informationNeeded: a.informationNeeded,
          integrity: loaded.integrity.integrity, standingWarnings: warningCodes(loaded.packet), audioVerified: false, completeSemanticTranscriptReview: assessment.completeSemanticTranscriptReview,
          ...(a.failedCorrection ? { rejectedCorrection: { ...a.failedCorrection, sha256: contentHash(a.failedCorrection.content) } } : {}) }
      };
      try { decisions.push(validateDelegatedReview(r, loaded.packet.transcript.body_text)); }
      catch {
        const codes: string[] = [];
        if (!aiContentSchema.safeParse(output).success) codes.push("content_shape_invalid");
        if (a.evidence.some(e => e.start >= e.end || e.end > loaded.packet.transcript.body_text.length || !rangeCovered(assessment.coverage, e))) codes.push("evidence_not_within_read_coverage");
        if (a.outcome !== "needs_human" && Object.values(rubricSchema.strip().parse(a)).some(value => value !== true)) codes.push("substantive_judgments_incomplete");
        if (a.outcome !== "needs_human" && !a.evidence.length) codes.push("support_evidence_missing");
        if (a.outcome === "needs_human" && (!a.exceptionCode || !a.informationNeeded)) codes.push("human_exception_details_missing");
        if ("description" in output) {
          const words = output.description.trim().split(/\s+/u).length;
          if (a.outcome !== "needs_human" && (words < 180 || words > 220)) codes.push("description_word_count_out_of_range");
        }
        const qa = inspectGeneratedText("description" in output ? output.description : "", "question" in output ? [output] : []);
        if (a.outcome !== "needs_human") codes.push(...qa.issues.filter(i => i.severity === "blocking").map(i => i.code));
        failures.push({ key: original.key, codes: codes.length ? [...new Set(codes)] : ["delegated_review_validation_failed"] });
      }
      if (a.outcome === "corrected_accepted") corrections++;
    }
    if (failures.length) {
      await this.persist(`validation-${tag(sequence)}-${assessmentSha256}.private.json`, { sequence, outcome: "validation_failed", failures });
      return { sequence, outcome: "validation_failed", failures };
    }
    const bundle = { schemaVersion: 1, privateContent: true, decision: "D-156", sequence, sermonId: loaded.packet.sermon.id,
      scopeSha256: loaded.scope.scopeSha256, policySha256: loaded.scope.policySha256, packetSha256: loaded.packetSha256,
      integritySha256: loaded.integritySha256, assessmentSha256, decisions };
    const persisted = await this.persist(fileName("decisions", sequence), bundle);
    return { sequence, outcome: persisted === "created" ? "assembled" : "unchanged", decisions: decisions.length,
      accepted: decisions.filter(d => d.outcome === "accepted").length, corrected: decisions.filter(d => d.outcome === "corrected_accepted").length,
      needsHuman: decisions.filter(d => d.outcome === "needs_human").length, preservedHuman: 1 + loaded.packet.pairs.length - pending.length };
  }
}

export async function runDelegatedEvidenceCommand(args: string[], repositoryRoot = process.cwd()): Promise<unknown> {
  const [command, sequenceText, ...rest] = args;
  if (!sequenceText || !/^(?:[1-9]\d?|1[0-4]\d|15[0-5])$/u.test(sequenceText)) fail("sequence_invalid");
  const sequence = Number(sequenceText), store = new DelegatedEvidenceStore(repositoryRoot);
  if (command === "show" && !rest.length) return store.show(sequence);
  if (command === "range" && rest.length === 2 && rest.every(v => /^\d+$/u.test(v))) return store.range(sequence, Number(rest[0]), Number(rest[1]));
  if (command === "search" && (rest.length === 1 || rest.length === 2) && (rest[1] === undefined || /^\d+$/u.test(rest[1]))) return store.search(sequence, rest[0]!, rest[1] === undefined ? 0 : Number(rest[1]));
  if ((command === "assemble" || command === "persist") && !rest.length) return store.assemble(sequence);
  return fail("command_not_authorised");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runDelegatedEvidenceCommand(process.argv.slice(2)).then(result => {
    // Prose is returned only by the three explicitly selected context commands.
    process.stdout.write(canonicalReviewJson(result) + "\n");
  }).catch(error => {
    process.stderr.write(JSON.stringify({ outcome: "failed", code: error instanceof DelegatedEvidenceError ? error.code : "private_evidence_operation_failed" }) + "\n");
    process.exitCode = 1;
  });
}

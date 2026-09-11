import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalReviewJson, reviewHash, sourceProvenanceHash } from "../src/domain/delegated-ai-review";
import { DelegatedEvidenceStore, delegatedAssessmentSchema, delegatedEvidenceInstructionFiles, type DelegatedAssessment } from "../src/enrichment/delegated-review-evidence";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
const roots: string[] = [];
const text = Array.from({ length: 1000 }, (_, i) => `Fictional paragraph ${i} describes careful listening before a neighbour responds.`).join("\n");
const description = Array(20).fill("A fictional speaker helps careful listeners understand an unfamiliar concern.").join(" ");
const jsonBytes = (value: unknown) => canonicalReviewJson(value) + "\n";
const id = (index: number) => `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "delegated-evidence-fixture-")); roots.push(root);
  const privateRoot = join(root, "private", "delegated-ai-review"); await mkdir(privateRoot, { recursive: true });
  const policies = await Promise.all(delegatedEvidenceInstructionFiles.map(async path => {
    const full = join(root, path); await mkdir(join(full, ".."), { recursive: true });
    const body = `Fictional instruction for ${path}.`; await writeFile(full, body);
    return { path, sha256: reviewHash(body) };
  }));
  const policySha256 = reviewHash(canonicalReviewJson(policies));
  const source = { sermon_id: id(1), source_content_sha256: reviewHash("fictional retained source"),
    warnings: [{ code: "audio_track_type_unverified", safeDetail: "Identity-bearing detail stays in the packet." }],
    caption_language: "en", caption_track_type: "automatic", apparent_completeness: "apparently_complete", uncertainty_marker_count: 0,
    video_id: "PRIVATE0001", original_filename: "PRIVATE-SOURCE-NAME.vtt" };
  const row = {
    sermon: { id: id(1), status: "draft", published_at: null, deleted_at: null, row_version: 10, summary: description, summary_row_version: 2, summary_status: "draft", summary_approved_at: null as string | null },
    transcript: { sermon_id: id(1), body_text: text, grounding_revision_id: id(3), status: "draft", row_version: 2 },
    source, review: null, findings: [], passages: [], speaker: null,
    pairs: Array.from({ length: 5 }, (_, i) => ({ id: id(10 + i), sermon_id: id(1), display_order: i + 1, row_version: 2,
      question_text: `Why does fictional listener ${i + 1} pause?`, answer_text: "The listener pauses to understand a neighbour before responding.", status: "draft", approved_at: null as string | null }))
  };
  const packet = { schemaVersion: 1, privateContent: true, sequence: 1, ...row, transcriptSha256: reviewHash(text), sourceProvenanceSha256: sourceProvenanceHash(source), originalRecordSha256: reviewHash(canonicalReviewJson(row)) };
  const ids = Array.from({ length: 155 }, (_, i) => id(i + 1)), scopeSha256 = reviewHash(canonicalReviewJson(ids));
  const scope = { decision: "D-156", privateContent: true, ids, scopeSha256, policySha256,
    packets: ids.map((_, i) => ({ sequence: i + 1, sha256: i === 0 ? reviewHash(jsonBytes(packet)) : reviewHash(`fictional packet ${i + 1}`) })) };
  const integrity = { sequence: 1, sourceFound: true, sourcePath: "PRIVATE-SOURCE-PATH.vtt", sourceSha256: source.source_content_sha256,
    parsed: true, cues: 1000, normalizedWordMatch: true, transcriptSha256: reviewHash(text), transcriptCharacters: text.length,
    transcriptWords: text.trim().split(/\s+/u).length, integrity: "verified", humanApprovalPreserved: false, audioVerified: false };
  await writeFile(join(privateRoot, "scope.private.json"), jsonBytes(scope));
  await writeFile(join(privateRoot, "record-001.private.json"), jsonBytes(packet));
  await writeFile(join(privateRoot, "integrity-001.private.json"), jsonBytes(integrity));
  const store = new DelegatedEvidenceStore(root, { count: 155, scopeSha256, policySha256 });
  return { root, privateRoot, scope, packet, integrity, store };
}

async function replaceFixturePacket(f: Awaited<ReturnType<typeof fixture>>) {
  const { schemaVersion: _schema, privateContent: _private, sequence: _sequence, transcriptSha256: _transcript,
    sourceProvenanceSha256: _source, originalRecordSha256: _original, ...row } = f.packet;
  f.packet.originalRecordSha256 = reviewHash(canonicalReviewJson(row));
  f.scope.packets[0]!.sha256 = reviewHash(jsonBytes(f.packet));
  await writeFile(join(f.privateRoot, "record-001.private.json"), jsonBytes(f.packet));
  await writeFile(join(f.privateRoot, "scope.private.json"), jsonBytes(f.scope));
}

function assessment(): DelegatedAssessment {
  const artifacts = ["description", "qa:1", "qa:2", "qa:3", "qa:4", "qa:5"].map(key => ({
    key, outcome: "accepted" as const, rationale: "The fictional claim matches the source context and preserves its qualification.",
    evidence: [{ start: 0, end: 1000, purpose: "claim" as const }], fullArtifactRead: true as const,
    centralArgumentChecked: true, substantiveClaimsSupported: true, qualificationsPreserved: true, questionAnswersDirectly: true,
    scriptureAttributionChecked: true, readabilityChecked: true, orderingChecked: true, exceptionCode: null, informationNeeded: null
  }));
  return { schemaVersion: 1, sequence: 1, runtime: { model: "gpt-6-astra", modelEvidence: "current_turn_metadata", immutableRevision: "not_exposed_by_runtime", sessionId: "not_exposed_by_runtime" },
    coverage: [{ start: 0, end: 3500 }, { start: text.length - 4500, end: text.length }], completeSemanticTranscriptReview: false, artifacts };
}

afterEach(async () => {
  vi.clearAllMocks();
  // Each target is the exact fresh disposable fixture returned by mkdtemp.
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("private delegated evidence context", () => {
  it("shows complete artifacts and exact opening/conclusion without identity metadata", async () => {
    const { store, privateRoot } = await fixture();
    const shown = await store.show(1);
    expect(shown.description.body).toBe(description);
    expect(shown.questionAnswers).toHaveLength(5);
    expect(shown.opening).toEqual({ start: 0, end: 3500, text: text.slice(0, 3500) });
    expect(shown.conclusion.text).toBe(text.slice(-4500));
    const serialized = JSON.stringify(shown);
    for (const excluded of [id(1), "PRIVATE0001", "PRIVATE-SOURCE-NAME", "PRIVATE-SOURCE-PATH", "Identity-bearing detail"]) expect(serialized).not.toContain(excluded);
    expect(shown.source.standingWarnings).toContain("audio_track_type_unverified");
    const receiptName = (await readdir(privateRoot)).find(name => name.startsWith("read-"))!;
    const receipt = JSON.parse(await readFile(join(privateRoot, receiptName), "utf8"));
    expect(receipt.provesSemanticReading).toBe(false);
    expect(receipt.ranges).toEqual(assessment().coverage);
    expect(JSON.stringify(receipt)).not.toContain("Fictional paragraph");
    expect(execFileSync).toHaveBeenCalled();
  });

  it("returns only the exact requested range and bounds", async () => {
    const { store } = await fixture();
    expect(await store.range(1, 40, 270)).toEqual({ sequence: 1, privateContext: true, start: 40, end: 270, text: text.slice(40, 270) });
    await expect(store.range(1, -1, 270)).rejects.toThrow("context_range_invalid");
    await expect(store.range(1, 0, 20_001)).rejects.toThrow("context_range_too_large");
  });

  it("uses bounded exact searches without declaring an unlocated claim unsupported", async () => {
    const { store } = await fixture();
    const result = await store.search(1, "careful listening");
    expect(result.matches).toHaveLength(8); expect(result.nextStart).not.toBeNull();
    expect(result.matches[0]!.text).toBe(text.slice(result.matches[0]!.start, result.matches[0]!.end));
    const absent = await store.search(1, "CAREFUL LISTENING");
    expect(absent.matches).toEqual([]); expect(absent.noMatchDoesNotEstablishUnsupportedClaim).toBe(true);
  });

  it("rejects changed packet bytes before returning any prose", async () => {
    const f = await fixture();
    await writeFile(join(f.privateRoot, "record-001.private.json"), jsonBytes({ ...f.packet, sequence: 2 }));
    await expect(f.store.show(1)).rejects.toThrow("packet_hash_drift");
  });

  it("rejects policy changes without automatically rebinding authority", async () => {
    const f = await fixture(); await writeFile(join(f.root, "AGENTS.md"), "A changed fictional rule.");
    await expect(f.store.show(1)).rejects.toThrow("scope_or_policy_drift");
  });

  it("rejects mismatched source-integrity identity and later integrity receipt changes", async () => {
    const f = await fixture();
    await writeFile(join(f.privateRoot, "integrity-001.private.json"), jsonBytes({ ...f.integrity, sourceSha256: reviewHash("changed") }));
    await expect(f.store.show(1)).rejects.toThrow("integrity_binding_invalid");
    await writeFile(join(f.privateRoot, "integrity-001.private.json"), jsonBytes(f.integrity)); await f.store.show(1);
    await writeFile(join(f.privateRoot, "integrity-001.private.json"), jsonBytes({ ...f.integrity, cues: 999 }));
    await expect(f.store.show(1)).rejects.toThrow("private_persistence_conflict");
  });

  it("rejects a source identity that differs from its frozen scope even with a recomputed packet receipt", async () => {
    const f = await fixture(); f.packet.source.sermon_id = id(2); await replaceFixturePacket(f);
    await expect(f.store.show(1)).rejects.toThrow("packet_identity_or_content_drift");
  });
});

describe("explicit assessment assembly", () => {
  it("assembles only explicit judgments, exact source evidence and private version-bound decisions", async () => {
    const { store, privateRoot } = await fixture(); await store.show(1);
    const input = assessment(); expect(delegatedAssessmentSchema.safeParse(input).success).toBe(true);
    await writeFile(join(privateRoot, "assessment-001.private.json"), jsonBytes(input));
    expect(await store.assemble(1)).toMatchObject({ outcome: "assembled", decisions: 6, accepted: 6, corrected: 0 });
    const before = await readFile(join(privateRoot, "decisions-001.private.json"), "utf8");
    const bundle = JSON.parse(before);
    expect(bundle.decisions[0].expectedSermonVersion).toBe(10);
    expect(bundle.decisions[1].artifactKey).toBe(`qa:${id(10)}`);
    expect(bundle.decisions[0].evidence[0].sha256).toBe(reviewHash(text.slice(0, 1000)));
    expect(bundle.decisions[0].provenance.model).toBe("gpt-6-astra");
    expect(await store.assemble(1)).toMatchObject({ outcome: "unchanged", decisions: 6 });
    expect(await readFile(join(privateRoot, "decisions-001.private.json"), "utf8")).toBe(before);
  });

  it("requires the exact pending set and does not invent omitted judgments", async () => {
    const f = await fixture(); await f.store.show(1);
    const input = assessment(); input.artifacts.pop();
    await writeFile(join(f.privateRoot, "assessment-001.private.json"), jsonBytes(input));
    await expect(f.store.assemble(1)).rejects.toThrow("pending_artifact_set_mismatch");
    expect((await readdir(f.privateRoot)).some(name => name.startsWith("decisions-"))).toBe(false);
  });

  it("preserves approved artifacts and refuses an AI judgment for them", async () => {
    const f = await fixture(); f.packet.sermon.summary_status = "approved"; f.packet.sermon.summary_approved_at = "2026-09-01T00:00:00Z";
    f.packet.pairs[0]!.status = "approved"; f.packet.pairs[0]!.approved_at = "2026-09-01T00:00:00Z";
    await replaceFixturePacket(f); await f.store.show(1);
    const input = assessment(); await writeFile(join(f.privateRoot, "assessment-001.private.json"), jsonBytes(input));
    await expect(f.store.assemble(1)).rejects.toThrow("pending_artifact_set_mismatch");
    input.artifacts = input.artifacts.filter(a => !["description", "qa:1"].includes(a.key));
    await writeFile(join(f.privateRoot, "assessment-001.private.json"), jsonBytes(input));
    expect(await f.store.assemble(1)).toMatchObject({ decisions: 4, accepted: 4, preservedHuman: 2 });
  });

  it("requires actually-read coverage to stay within explicitly requested context", async () => {
    const f = await fixture(); await f.store.show(1);
    const input = assessment(); input.coverage = [{ start: 0, end: text.length }]; input.completeSemanticTranscriptReview = true;
    await writeFile(join(f.privateRoot, "assessment-001.private.json"), jsonBytes(input));
    await expect(f.store.assemble(1)).rejects.toThrow("reading_coverage_not_requested");
  });

  it("records already-completed readings as retrospective attestations, never fabricated helper emissions", async () => {
    const f = await fixture(); const input = assessment();
    input.coverage = [{ start: 0, end: text.length }]; input.completeSemanticTranscriptReview = true;
    input.previousPrivateContext = { origin: "direct_frozen_packet_read_before_helper_available", actuallyRead: true,
      coverage: input.coverage, artifactKeys: input.artifacts.map(a => a.key) };
    await writeFile(join(f.privateRoot, "assessment-001.private.json"), jsonBytes(input));
    expect(await f.store.assemble(1)).toMatchObject({ outcome: "assembled", accepted: 6 });
    const names = await readdir(f.privateRoot);
    expect(names.some(name => name.startsWith("read-"))).toBe(false);
    const attestation = JSON.parse(await readFile(join(f.privateRoot, names.find(name => name.startsWith("prior-context-"))!), "utf8"));
    expect(attestation.helperEmittedEarlierContext).toBe(false);
  });

  it("preserves malformed assessment bytes privately without an automatic decision", async () => {
    const f = await fixture(); const invalid = '{"private fictional unfinished input":';
    await writeFile(join(f.privateRoot, "assessment-001.private.json"), invalid);
    await expect(f.store.assemble(1)).rejects.toThrow("private_json_invalid");
    const names = await readdir(f.privateRoot);
    const attempt = JSON.parse(await readFile(join(f.privateRoot, names.find(name => name.startsWith("assessment-attempt-"))!), "utf8"));
    expect(Buffer.from(attempt.inputBase64, "base64").toString("utf8")).toBe(invalid);
    expect(names.some(name => name.startsWith("decisions-"))).toBe(false);
  });

  it("derives sermon versions from earlier successful corrections in original artifact order", async () => {
    const f = await fixture(); await f.store.show(1); const input = assessment();
    input.artifacts[0]!.outcome = "corrected_accepted";
    input.artifacts[0]!.correctedOutput = { description: description.replace("unfamiliar", "familiar") };
    input.artifacts[3]!.outcome = "corrected_accepted";
    input.artifacts[3]!.correctedOutput = { question: "Why does the fictional neighbour pause before answering?", answer: "The neighbour pauses to understand what the listener means." };
    await writeFile(join(f.privateRoot, "assessment-001.private.json"), jsonBytes(input));
    expect(await f.store.assemble(1)).toMatchObject({ decisions: 6, corrected: 2 });
    const bundle = JSON.parse(await readFile(join(f.privateRoot, "decisions-001.private.json"), "utf8"));
    expect(bundle.decisions.map((d: { expectedSermonVersion: number }) => d.expectedSermonVersion)).toEqual([10, 11, 11, 11, 12, 12]);
    expect(bundle.decisions[0].original.description).toBe(description);
  });

  it("preserves an invalid correction, refuses a different second candidate, and permits an explicit needs-human outcome", async () => {
    const f = await fixture(); await f.store.show(1); const input = assessment();
    const rejected = { description: "The fictional candidate is too short to pass the description requirement." };
    input.artifacts[0]!.outcome = "corrected_accepted"; input.artifacts[0]!.correctedOutput = rejected;
    await writeFile(join(f.privateRoot, "assessment-001.private.json"), jsonBytes(input));
    expect(await f.store.assemble(1)).toMatchObject({ outcome: "validation_failed", failures: [{ key: "description", codes: ["description_word_count_out_of_range"] }] });
    input.artifacts[0]!.correctedOutput = { description: description.replace("unfamiliar", "familiar") };
    await writeFile(join(f.privateRoot, "assessment-001.private.json"), jsonBytes(input));
    await expect(f.store.assemble(1)).rejects.toThrow("private_persistence_conflict");
    delete input.artifacts[0]!.correctedOutput;
    input.artifacts[0]!.outcome = "needs_human"; input.artifacts[0]!.exceptionCode = "description_word_count_out_of_range";
    input.artifacts[0]!.informationNeeded = "A human decision is required after the sole correction failed.";
    input.artifacts[0]!.failedCorrection = { content: rejected, failureCodes: ["description_word_count_out_of_range"] };
    await writeFile(join(f.privateRoot, "assessment-001.private.json"), jsonBytes(input));
    expect(await f.store.assemble(1)).toMatchObject({ outcome: "assembled", needsHuman: 1, corrected: 0 });
    const bundle = JSON.parse(await readFile(join(f.privateRoot, "decisions-001.private.json"), "utf8"));
    expect(bundle.decisions[0].output.description).toBe(description);
    expect(bundle.decisions[0].assessment.rejectedCorrection.content).toEqual(rejected);
    expect(bundle.decisions[0].correctionRound).toBe(1);
  });
});

describe("explicit AI assessment schema", () => {
  it("requires model provenance and every rubric judgment without defaults", () => {
    const input = assessment();
    expect(delegatedAssessmentSchema.safeParse({ ...input, runtime: { ...input.runtime, model: "another-model" } }).success).toBe(false);
    const { orderingChecked: _ordering, ...missing } = input.artifacts[0]!;
    expect(delegatedAssessmentSchema.safeParse({ ...input, artifacts: [missing, ...input.artifacts.slice(1)] }).success).toBe(false);
  });
});

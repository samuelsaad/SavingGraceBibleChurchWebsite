import { describe, expect, it } from "vitest";
import {
  canonicalReviewJson, contentHash, coveredCharacters, reviewHash,
  sourceProvenanceHash, validateDelegatedReview, type DelegatedReviewResult
} from "../src/domain/delegated-ai-review";

// Entirely fictional content; these fixtures test enforcement, not review quality.
const transcript = "The fictional speaker asks listeners to hear a neighbour carefully before responding.\n\nThe closing illustration shows a listener checking an assumption and then offering practical help.";
const source = { source_content_sha256: reviewHash("fictional source"), created_at: "2026-09-10T00:00:00+00:00", source_kind: "fixture" };

function validReview(): DelegatedReviewResult {
  const content = {
    question: "Why does the fictional listener check an assumption?",
    answer: "Checking the assumption helps the listener understand the neighbour before offering practical help."
  };
  return {
    decision: "D-156", scopeSha256: reviewHash("fictional scope"), policySha256: reviewHash("fictional policy"),
    sermonId: "10000000-0000-4000-8000-000000000001",
    artifactKey: "qa:20000000-0000-4000-8000-000000000001",
    expectedSermonVersion: 8, inputVersion: 3, displayOrder: 1,
    transcriptSha256: reviewHash(transcript), groundingRevisionId: "30000000-0000-4000-8000-000000000001",
    sourceSha256: source.source_content_sha256, sourceProvenanceSha256: sourceProvenanceHash(source),
    inputSha256: contentHash(content), outputSha256: contentHash(content), original: { ...content }, output: { ...content },
    outcome: "accepted", correctionRound: 0, reviewedAt: "2026-09-10T00:00:00Z",
    provenance: {
      reviewer_kind: "ai", provider: "OpenAI", execution_surface: "Codex", model: "gpt-6-astra",
      mode: "interactive Codex session", immutable_revision: "not_exposed_by_runtime",
      session_id: "not_exposed_by_runtime", privacy_details: "not_exposed_by_runtime",
      separately_billed_api_used: false, external_api_cost_aud: 0
    },
    evidence: [{ start: 0, end: transcript.length, sha256: reviewHash(transcript), purpose: "claim" }],
    coverage: [{ start: 0, end: transcript.length }],
    assessment: {
      fullArtifactRead: true, centralArgumentChecked: true, substantiveClaimsSupported: true,
      qualificationsPreserved: true, questionAnswersDirectly: true, scriptureAttributionChecked: true,
      readabilityChecked: true, orderingChecked: true, integrity: "verified",
      rationale: "The fictional answer preserves the supported reason and its practical qualification.",
      exceptionCode: null, informationNeeded: null,
      standingWarnings: ["CAPTION_AUDIO_ASSOCIATION_UNKNOWN_ACCEPTED_BY_BOUNDED_DECISION"],
      audioVerified: false, completeSemanticTranscriptReview: true
    }
  };
}

function descriptionReview(words = 200): DelegatedReviewResult {
  const r = validReview();
  const sentence = "A fictional speaker helps careful listeners understand an unfamiliar concern.".split(" ");
  const content = { description: Array.from({ length: words }, (_, i) => sentence[i % sentence.length]).join(" ") };
  return { ...r, artifactKey: "description", displayOrder: null, original: { ...content }, output: { ...content }, inputSha256: contentHash(content), outputSha256: contentHash(content) };
}

function needsHuman(): DelegatedReviewResult {
  const r = validReview();
  r.outcome = "needs_human";
  r.assessment.substantiveClaimsSupported = false;
  r.assessment.exceptionCode = "uncertain_attribution";
  r.assessment.informationNeeded = "Clarify the speaker attribution in the cited closing illustration.";
  return r;
}

describe("delegated AI review exact binding and private authority", () => {
  it("accepts a completely read artifact with exact evidence while preserving standing audio uncertainty", () => {
    const r = validReview();
    expect(validateDelegatedReview(r, transcript)).toEqual(r);
    expect(r.assessment.audioVerified).toBe(false);
    expect(r.provenance.reviewer_kind).toBe("ai");
    expect(r.assessment.standingWarnings).toHaveLength(1);
  });

  it.each([180, 200, 220])("accepts a mechanically valid %i-word fictional description", words => {
    expect(validateDelegatedReview(descriptionReview(words), transcript).outcome).toBe("accepted");
  });

  it.each([179, 221])("refuses a %i-word description without claiming semantic review failure", words => {
    expect(() => validateDelegatedReview(descriptionReview(words), transcript)).toThrow("delegated_review_validation_failed");
  });

  const invalidBindings: Array<[string, (r: DelegatedReviewResult) => void]> = [
    ["transcript hash", r => { r.transcriptSha256 = reviewHash("different transcript"); }],
    ["original content hash", r => { r.inputSha256 = reviewHash("different original"); }],
    ["output content hash", r => { r.outputSha256 = reviewHash("different output"); }],
    ["malformed grounding UUID", r => { r.groundingRevisionId = "not-a-uuid"; }],
    ["malformed Q&A UUID", r => { r.artifactKey = "qa:" + "-".repeat(36); }],
    ["missing source provenance hash", r => { delete (r as Partial<DelegatedReviewResult>).sourceProvenanceSha256; }],
    ["zero content version", r => { r.inputVersion = 0; }],
    ["fractional sermon version", r => { r.expectedSermonVersion = 1.5; }],
    ["Q&A missing display order", r => { r.displayOrder = null; }],
    ["description key with Q&A bodies", r => { r.artifactKey = "description"; r.displayOrder = null; }],
    ["unread artifact", r => { Object.assign(r.assessment, { fullArtifactRead: false }); }],
    ["claimed audio verification", r => { Object.assign(r.assessment, { audioVerified: true }); }],
    ["human reviewer attribution", r => { Object.assign(r.provenance, { reviewer_kind: "human" }); }],
    ["unapproved model", r => { Object.assign(r.provenance, { model: "another-model" }); }],
    ["separate API use", r => { Object.assign(r.provenance, { separately_billed_api_used: true }); }],
    ["invented privacy mode", r => { Object.assign(r.provenance, { privacy_details: "verified_private" }); }],
    ["public eligibility request", r => { Object.assign(r, { publicEligible: true }); }],
    ["hidden source mutation request", r => { Object.assign(r, { transcript: "replacement" }); }],
    ["blank rationale", r => { r.assessment.rationale = "  \n "; }]
  ];
  it.each(invalidBindings)("refuses %s with a safe diagnostic", (_name, change) => {
    const r = validReview();
    change(r);
    expect(() => validateDelegatedReview(r, transcript)).toThrow(/^delegated_review_validation_failed$/u);
  });

  it("binds transcript bytes without Unicode or whitespace normalization", () => {
    expect(() => validateDelegatedReview(validReview(), transcript + " ")).toThrow();
    expect(reviewHash("caf\u00e9")).not.toBe(reviewHash("cafe\u0301"));
  });

  const judgments = [
    "centralArgumentChecked", "substantiveClaimsSupported", "qualificationsPreserved",
    "questionAnswersDirectly", "scriptureAttributionChecked", "readabilityChecked", "orderingChecked"
  ] as const;
  it.each(judgments)("requires an affirmative %s judgment for acceptance", judgment => {
    const r = validReview();
    r.assessment[judgment] = false;
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });

  it.each(["source_unavailable", "unexplained_drift"] as const)("refuses accepted %s integrity", integrity => {
    const r = validReview();
    r.assessment.integrity = integrity;
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });

  it("allows explicitly attributable preserved human transcript edits as source context", () => {
    const r = validReview();
    r.assessment.integrity = "human_edits_preserved";
    expect(validateDelegatedReview(r, transcript).assessment.integrity).toBe("human_edits_preserved");
  });

  it("rejects mechanical defects in the exact accepted text", () => {
    const r = validReview();
    const content = { question: "Why does the listener  check?", answer: "The fictional answer is complete." };
    r.original = content; r.output = { ...content };
    r.inputSha256 = contentHash(content); r.outputSha256 = contentHash(content);
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });
});

describe("contextual reading and evidence", () => {
  it("counts only the union of overlapping, repeated and disordered ranges", () => {
    expect(coveredCharacters([{ start: 10, end: 20 }, { start: 0, end: 15 }, { start: 0, end: 15 }, { start: 30, end: 35 }])).toBe(25);
  });

  it("permits evidence supported by the exact union of adjoining read ranges", () => {
    const r = validReview();
    r.coverage = [{ start: 0, end: 70 }, { start: 70, end: transcript.length }];
    expect(validateDelegatedReview(r, transcript)).toEqual(r);
  });

  it("records targeted reading honestly without claiming complete semantic coverage", () => {
    const r = validReview();
    const start = transcript.indexOf("The closing");
    r.coverage = [{ start, end: transcript.length }];
    r.evidence = [{ start, end: transcript.length, sha256: reviewHash(transcript.slice(start)), purpose: "claim" }];
    r.assessment.completeSemanticTranscriptReview = false;
    expect(validateDelegatedReview(r, transcript).assessment.completeSemanticTranscriptReview).toBe(false);
    r.assessment.completeSemanticTranscriptReview = true;
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });

  const invalidRanges: Array<[string, (r: DelegatedReviewResult) => void]> = [
    ["missing evidence", r => { r.evidence = []; }],
    ["empty evidence range", r => { r.evidence[0]!.start = r.evidence[0]!.end; }],
    ["reversed coverage", r => { r.coverage = [{ start: 10, end: 5 }]; }],
    ["out of bounds evidence", r => { r.evidence[0]!.end++; }],
    ["fractional coverage", r => { r.coverage[0]!.start = 0.5; }],
    ["negative coverage", r => { r.coverage[0]!.start = -1; }],
    ["wrong evidence hash", r => { r.evidence[0]!.sha256 = reviewHash("unsupported"); }],
    ["unread gap", r => { r.coverage = [{ start: 0, end: 70 }, { start: 71, end: transcript.length }]; r.assessment.completeSemanticTranscriptReview = false; }]
  ];
  it.each(invalidRanges)("refuses %s", (_name, change) => {
    const r = validReview(); change(r);
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });
});

describe("one correction round and explicit exceptions", () => {
  it("accepts exactly one changed and revalidated correction while preserving original bytes", () => {
    const r = validReview();
    const before = canonicalReviewJson(r.original);
    r.output = { question: "Why does the fictional listener check the neighbour's meaning?", answer: "The listener checks the meaning before offering practical help." };
    r.outputSha256 = contentHash(r.output); r.outcome = "corrected_accepted"; r.correctionRound = 1;
    expect(validateDelegatedReview(r, transcript).original).toEqual(r.original);
    expect(canonicalReviewJson(r.original)).toBe(before);
    r.correctionRound = 0;
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });

  it("refuses an unchanged corrected acceptance and accepted round one", () => {
    const r = validReview();
    r.correctionRound = 1;
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
    r.outcome = "corrected_accepted";
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });

  it("refuses a second correction round", () => {
    const r = validReview();
    r.correctionRound = 2;
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });

  it("records a precise exception without changing or accepting the original", () => {
    const r = needsHuman();
    expect(validateDelegatedReview(r, transcript).outcome).toBe("needs_human");
    r.assessment.informationNeeded = null;
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });

  it("preserves rejected correction evidence and consumes its sole round without applying it", () => {
    const r = needsHuman();
    r.correctionRound = 1;
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
    const content = { question: "Why does a fictional listener respond?", answer: "The attempted answer still leaves an unclear attribution." };
    r.assessment.rejectedCorrection = { content, sha256: contentHash(content), failureCodes: ["uncertain_attribution"] };
    const result = validateDelegatedReview(r, transcript);
    expect(result.output).toEqual(result.original);
    expect(result.assessment.rejectedCorrection?.content).toEqual(content);
    r.assessment.rejectedCorrection.sha256 = reviewHash("wrong");
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });

  it("counts a failed correction attempt even when it did not change the original bytes", () => {
    const r = needsHuman(); r.correctionRound = 1;
    r.assessment.rejectedCorrection = { content: r.original, sha256: r.inputSha256, failureCodes: ["invalid"] };
    expect(validateDelegatedReview(r, transcript).correctionRound).toBe(1);
  });

  it("refuses a rejected correction for another content area", () => {
    const r = needsHuman(); r.correctionRound = 1;
    const content = { description: "A different fictional content area." };
    r.assessment.rejectedCorrection = { content, sha256: contentHash(content), failureCodes: ["invalid"] };
    expect(() => validateDelegatedReview(r, transcript)).toThrow();
  });

  it("preserves structurally defective rejected text without making it accepted output", () => {
    const r = needsHuman(); r.correctionRound = 1;
    const content = { question: "", answer: "<p>A rejected private candidate.</p>".repeat(500) };
    r.assessment.rejectedCorrection = { content, sha256: contentHash(content), failureCodes: ["invalid_content_shape"] };
    const result = validateDelegatedReview(r, transcript);
    expect(result.assessment.rejectedCorrection?.content).toEqual(content);
    expect(result.output).toEqual(r.original);
  });
});

describe("deterministic private hashes", () => {
  it("canonicalizes object keys but preserves array order and exact source fields", () => {
    expect(sourceProvenanceHash(source)).toBe(sourceProvenanceHash({ created_at: source.created_at, source_kind: "fixture", source_content_sha256: source.source_content_sha256 }));
    expect(sourceProvenanceHash({ ...source, source_kind: "changed" })).not.toBe(sourceProvenanceHash(source));
    expect(canonicalReviewJson([1, 2])).not.toBe(canonicalReviewJson([2, 1]));
  });

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, new Date("2026-09-10T00:00:00Z"), { field: undefined }, Array(2)])("rejects non-JSON canonical inputs instead of silently dropping data", value => {
    expect(() => canonicalReviewJson(value)).toThrow("delegated_review_canonical_json_required");
  });
});

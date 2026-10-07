import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  analyzeEvaluation, calibrateAndLockEvaluationPolicy, createBlindedReviewerPack, createRelatedThemesEvaluation,
  evaluateLockedHoldout, importEvaluationRatings, renderRelatedThemesEvaluationHtml,
  type EvaluationAdjudication, type EvaluationPhase, type EvaluationPolicyLock,
  type RelatedThemesEvaluationPlan, type RelatedThemesRatings
} from "../src/semantic/related-themes-evaluation";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const sources = Array.from({ length: 18 }, (_, index) => {
  const description = `An entirely fictional evaluation description number ${index + 1} considers patient kindness and a synthetic example. No actual sermon is represented.`;
  return { sermonId: id(index + 1), sourceIdentity: `fictional-source-${index + 1}`, description, descriptionSha256: sha(description) };
});
const input = {
  sources, pipelineFingerprint: "b".repeat(64), modelRevision: "c".repeat(40), seed: "fixed-fictional-evaluation-seed-v1",
  reviewerIds: ["reviewer-alpha", "reviewer-beta"] as [string, string], anchorsPerPartition: 6,
  semanticCandidates: sources.flatMap((source, index) => [1, 2, 3, 4, 5].map((offset, rank) => ({
    anchorId: source.sermonId, candidateId: id((index + offset) % sources.length + 1), score: .96 - index * .015 - rank * .06
  }))),
  metadataCandidates: sources.flatMap((source, index) => [2, 6, 7].map((offset, rank) => ({
    anchorId: source.sermonId, candidateId: id((index + offset) % sources.length + 1), rank: rank + 1
  })))
};
const makePlan = () => createRelatedThemesEvaluation(input);
function ratings(plan: RelatedThemesEvaluationPlan, phase: EvaluationPhase = "calibration", lock?: EvaluationPolicyLock): RelatedThemesRatings[] {
  return plan.reviewerIds.map(reviewerId => {
    const pack = createBlindedReviewerPack(plan, reviewerId, phase, lock);
    return {
      contract: "related-themes-ratings-v1", evaluationFingerprint: pack.evaluationFingerprint,
      packFingerprint: pack.packFingerprint, reviewerId, phase, policyLockFingerprint: pack.policyLockFingerprint,
      reviewerKind: "human", independentlyReviewed: true, blindedToMethodsAndScores: true,
      completedAt: phase === "calibration" ? "2026-01-01T12:00:00.000Z" : "2026-01-03T12:00:00.000Z",
      anchors: pack.anchors.map(anchor => ({ anchorToken: anchor.anchorToken,
        candidates: anchor.candidates.map(candidate => ({ candidateToken: candidate.candidateToken, usefulness: 3,
          theologicalRisk: false, riskNote: "", redundant: false, note: "Synthetic test rating only." })),
        missingRelationships: "", preference: anchor.lists.A.length === 5 ? "A" : "B", preferenceReason: "Synthetic preference only." }))
    };
  });
}
const lockAt = "2026-01-02T12:00:00.000Z";

describe("frozen blinded Related themes evaluation", () => {
  it("freezes a deterministic corpus and disjoint score-spread/contrast anchor splits", () => {
    const plan = makePlan();
    const reverse = createRelatedThemesEvaluation({ ...input, sources: [...input.sources].reverse(),
      semanticCandidates: [...input.semanticCandidates].reverse(), metadataCandidates: [...input.metadataCandidates].reverse() });
    expect(reverse).toEqual(plan);
    expect(plan.anchors).toHaveLength(12);
    for (const phase of ["calibration", "holdout"]) {
      const group = plan.anchors.filter(item => item.phase === phase);
      expect(group).toHaveLength(6);
      expect(new Set(group.map(item => item.stratum)).size).toBe(3);
    }
    expect(new Set(plan.anchors.map(item => item.anchorId)).size).toBe(12);
  });
  it("keeps reversed semantic or baseline relationships inside one partition without pruning candidate lists", () => {
    const semanticCandidates = sources.slice(0, 6).flatMap((source, index) => [
      { anchorId: source.sermonId, candidateId: id(index % 2 === 0 ? index + 2 : index), score: .9 - index * .03 },
      { anchorId: source.sermonId, candidateId: id(7), score: .5 }
    ]);
    const metadataCandidates = [{ anchorId: id(1), candidateId: id(3), rank: 1 }];
    const plan = createRelatedThemesEvaluation({ ...input, sources: sources.slice(0, 7), semanticCandidates, metadataCandidates, anchorsPerPartition: 2 });
    const pairKeys = (phase: EvaluationPhase) => plan.anchors.filter(anchor => anchor.phase === phase).flatMap(anchor =>
      [...anchor.semantic.map(item => item.candidateId), ...anchor.metadata].map(candidate => [anchor.anchorId, candidate].sort().join("/")));
    const calibration = new Set(pairKeys("calibration"));
    expect(pairKeys("holdout").some(pair => calibration.has(pair))).toBe(false);
    expect(plan.anchors).toHaveLength(4);
    for (const anchor of plan.anchors) {
      expect(anchor.semantic).toEqual(semanticCandidates.filter(item => item.anchorId === anchor.anchorId).map(({ candidateId, score }) => ({ candidateId, score })));
      expect(anchor.metadata).toEqual(metadataCandidates.filter(item => item.anchorId === anchor.anchorId).map(item => item.candidateId));
    }
    expect(createRelatedThemesEvaluation({ ...input, sources: sources.slice(0, 7).reverse(), semanticCandidates: [...semanticCandidates].reverse(), metadataCandidates, anchorsPerPartition: 2 })).toEqual(plan);
  });
  it("fails closed when only a reciprocal pair is available, including a metadata-only reverse", () => {
    const first = { anchorId: id(1), candidateId: id(2), score: .9 };
    const second = { anchorId: id(2), candidateId: id(1), score: .9 };
    for (const reverseInMetadata of [false, true]) {
      expect(() => createRelatedThemesEvaluation({ ...input, sources: sources.slice(0, 2), anchorsPerPartition: 1,
        semanticCandidates: reverseInMetadata ? [first] : [first, second],
        metadataCandidates: reverseInMetadata ? [{ anchorId: id(2), candidateId: id(1), rank: 1 }] : [] })).toThrow(/pair-independent/);
    }
  });
  it("allows shared candidates for different held-out relationships, without claiming unseen-document evaluation", () => {
    const plan = createRelatedThemesEvaluation({ ...input, sources: sources.slice(0, 3), anchorsPerPartition: 1,
      semanticCandidates: [1, 2].map(index => ({ anchorId: id(index), candidateId: id(3), score: .9 })), metadataCandidates: [] });
    expect(plan.anchors).toHaveLength(2);
    expect(new Set(plan.anchors.map(anchor => anchor.phase)).size).toBe(2);
    expect(plan.anchors.every(anchor => anchor.semantic[0]!.candidateId === id(3))).toBe(true);
  });
  it("rejects an integrity-valid imported plan whose opposite partitions expose the same unordered pair", () => {
    const plan = makePlan();
    const calibration = plan.anchors.find(anchor => anchor.phase === "calibration")!;
    const holdout = plan.anchors.find(anchor => anchor.phase === "holdout")!;
    calibration.semantic[0]!.candidateId = holdout.anchorId;
    holdout.metadata = [calibration.anchorId];
    const { fingerprint: _fingerprint, ...frozen } = plan;
    plan.fingerprint = sha(JSON.stringify(frozen));
    expect(() => createBlindedReviewerPack(plan, "reviewer-alpha", "calibration")).toThrow(/reversed pair/);
  });
  it("rejects duplicate source identities, changed description hashes, self and foreign candidates", () => {
    expect(() => createRelatedThemesEvaluation({ ...input, sources: [...sources, sources[0]!] })).toThrow(/duplicate/);
    expect(() => createRelatedThemesEvaluation({ ...input, sources: sources.map((s, index) => index ? s : { ...s, description: "Changed" }) })).toThrow(/hash/);
    expect(() => createRelatedThemesEvaluation({ ...input, semanticCandidates: [{ anchorId: id(1), candidateId: id(1), score: .5 }] })).toThrow(/self/);
    expect(() => createRelatedThemesEvaluation({ ...input, semanticCandidates: [{ anchorId: id(1), candidateId: id(99), score: .5 }] })).toThrow(/ineligible/);
  });
  it("rejects identical reviewer assignment and duplicate recommendation pairs", () => {
    expect(() => createRelatedThemesEvaluation({ ...input, reviewerIds: ["reviewer-alpha", "reviewer-alpha"] })).toThrow(/distinct/);
    expect(() => createRelatedThemesEvaluation({ ...input, semanticCandidates: [...input.semanticCandidates, input.semanticCandidates[0]!] })).toThrow(/duplicate/);
  });
  it("exports randomized description-only candidate unions with no identity, scores or method key", () => {
    const plan = makePlan();
    const pack = createBlindedReviewerPack(plan, "reviewer-alpha", "calibration");
    const second = createBlindedReviewerPack(plan, "reviewer-beta", "calibration");
    expect(pack).toEqual(createBlindedReviewerPack(plan, "reviewer-alpha", "calibration"));
    expect(second.anchors.map(anchor => anchor.description)).not.toEqual(pack.anchors.map(anchor => anchor.description));
    const serialized = JSON.stringify(pack);
    for (const forbidden of ["score", "semantic", "metadata", "sourceIdentity", "sermonId", "stratum", "title"]) expect(serialized).not.toContain(`"${forbidden}"`);
    expect(serialized).not.toContain(id(1));
    expect(pack.anchors.every(anchor => new Set(anchor.candidates.map(item => item.candidateToken)).size === 7)).toBe(true);
  });
  it("locks holdout before evidence-derived calibration and rejects altered frozen descriptions", () => {
    const plan = makePlan();
    expect(() => createBlindedReviewerPack(plan, "reviewer-alpha", "holdout")).toThrow(/locked/);
    const changed = structuredClone(plan); changed.sources[0]!.description = "Altered";
    expect(() => createBlindedReviewerPack(changed, "reviewer-alpha", "calibration")).toThrow(/integrity/);
  });
  it("imports complete human ratings idempotently and refuses overwrite", () => {
    const plan = makePlan(), evidence = ratings(plan)[0]!;
    expect(importEvaluationRatings(plan, evidence).status).toBe("new");
    expect(importEvaluationRatings(plan, evidence, [evidence]).status).toBe("unchanged");
    const edited = structuredClone(evidence); edited.anchors[0]!.candidates[0]!.note = "Changed later";
    expect(() => importEvaluationRatings(plan, edited, [evidence])).toThrow(/preserve/);
  });
  it("rejects missing, duplicate, stale and non-independent ratings", () => {
    const plan = makePlan(), evidence = ratings(plan)[0]!;
    const missing = structuredClone(evidence); missing.anchors[0]!.candidates.pop();
    expect(() => importEvaluationRatings(plan, missing)).toThrow(/missing/);
    const duplicate = structuredClone(evidence); duplicate.anchors[0]!.candidates[1] = duplicate.anchors[0]!.candidates[0]!;
    expect(() => importEvaluationRatings(plan, duplicate)).toThrow(/duplicate/);
    expect(() => importEvaluationRatings(plan, { ...evidence, packFingerprint: "f".repeat(64) })).toThrow(/stale/);
    expect(() => importEvaluationRatings(plan, { ...evidence, independentlyReviewed: false })).toThrow();
  });
  it("does not count AI assessments as either required human reviewer", () => {
    const plan = makePlan();
    const evidence = ratings(plan).map(item => ({ ...item, reviewerKind: "ai_assessment" as const }));
    expect(analyzeEvaluation(plan, evidence, "calibration")).toMatchObject({ status: "awaiting_human_evaluation", humanReviewerCount: 0, aiAssessmentCount: 2 });
    expect(() => calibrateAndLockEvaluationPolicy(plan, evidence, [], lockAt)).toThrow(/awaiting_human/);
    expect(analyzeEvaluation(plan, [ratings(plan)[0]!], "calibration").status).toBe("awaiting_human_evaluation");
  });
  it("reports agreement and requires preserved adjudication for discrepant judgments", () => {
    const plan = makePlan(), evidence = ratings(plan);
    evidence[0]!.anchors[0]!.candidates[0]!.usefulness = 1;
    const first = analyzeEvaluation(plan, evidence, "calibration");
    expect(first.status).toBe("awaiting_adjudication");
    expect(first.exactAgreement).toBeLessThan(1);
    const issue = first.disagreements[0]!;
    const adjudication: EvaluationAdjudication = { ...issue, evaluationFingerprint: plan.fingerprint, phase: "calibration",
      reviewerEvidenceFingerprint: first.evidenceFingerprint, adjudicatorId: "adjudicator-1", adjudicatorKind: "human",
      usefulness: 2, theologicalRisk: false, redundant: false, rationale: "Synthetic disagreement resolution." };
    const result = analyzeEvaluation(plan, evidence, "calibration", [adjudication]);
    expect(result.status).toBe("complete");
    expect(result.disagreements[0]!.adjudicated).toBe(true);
    expect(evidence[0]!.anchors[0]!.candidates[0]!.usefulness).toBe(1);
    expect(() => analyzeEvaluation(plan, evidence, "calibration", [{ ...adjudication, reviewerEvidenceFingerprint: "f".repeat(64) }])).toThrow(/stale/);
  });
  it("derives a threshold only from observed calibration scores and considers ranks 1–5", () => {
    const plan = makePlan(), evidence = ratings(plan);
    const lock = calibrateAndLockEvaluationPolicy(plan, evidence, [], lockAt);
    expect(plan.anchors.filter(anchor => anchor.phase === "calibration").flatMap(anchor => anchor.semantic.map(item => item.score))).toContain(lock.minimumCosineScore);
    expect(lock.maximumResults).toBe(5);
    expect(lock.calibrationSelectedPairs).toBe(30);
    expect(lock.corpusFingerprint).toBe(plan.corpusFingerprint);
    expect(createBlindedReviewerPack(plan, "reviewer-alpha", "holdout", lock).policyLockFingerprint).toBe(lock.fingerprint);
  });
  it("supports zero useful matches by refusing a manufactured calibration policy", () => {
    const plan = makePlan();
    for (const field of ["usefulness", "theologicalRisk", "redundant"] as const) {
      const evidence = ratings(plan);
      for (const person of evidence) for (const anchor of person.anchors) for (const item of anchor.candidates) {
        if (field === "usefulness") item.usefulness = 0;
        else if (field === "theologicalRisk") { item.theologicalRisk = true; item.riskNote = "Fictional risk"; }
        else item.redundant = true;
      }
      expect(() => calibrateAndLockEvaluationPolicy(plan, evidence, [], lockAt)).toThrow(/no useful/);
    }
  });
  it("cannot calibrate on holdout or accept a lock predating its evidence", () => {
    const plan = makePlan(), calibration = ratings(plan);
    const lock = calibrateAndLockEvaluationPolicy(plan, calibration, [], lockAt);
    expect(() => calibrateAndLockEvaluationPolicy(plan, [...calibration, ...ratings(plan, "holdout", lock)], [], lockAt)).toThrow(/holdout evidence/);
    expect(() => calibrateAndLockEvaluationPolicy(plan, calibration, [], "2025-01-01T12:00:00.000Z")).toThrow(/predates/);
    expect(() => createBlindedReviewerPack(plan, "reviewer-alpha", "holdout", { ...lock, maximumResults: 4 })).toThrow(/altered/);
  });
  it("requires actual complete positive holdout evidence before a normal feature release", () => {
    const plan = makePlan(), lock = calibrateAndLockEvaluationPolicy(plan, ratings(plan), [], lockAt);
    expect(evaluateLockedHoldout(plan, lock, []).normalFeatureMayBeEnabled).toBe(false);
    const holdout = ratings(plan, "holdout", lock);
    const result = evaluateLockedHoldout(plan, lock, holdout);
    expect(result).toMatchObject({ status: "passed", normalFeatureMayBeEnabled: true, failedPairs: 0 });
    expect(result.selectedPairs).toBeGreaterThan(0);
    holdout[0]!.anchors[0]!.missingRelationships = "A fictional missing connection needs consideration.";
    expect(evaluateLockedHoldout(plan, lock, holdout).normalFeatureMayBeEnabled).toBe(false);
  });
  it("fails holdout risk, stale evidence and preference against semantic recommendations", () => {
    const plan = makePlan(), lock = calibrateAndLockEvaluationPolicy(plan, ratings(plan), [], lockAt);
    const holdout = ratings(plan, "holdout", lock);
    for (const person of holdout) for (const anchor of person.anchors) anchor.preference = "neither";
    expect(evaluateLockedHoldout(plan, lock, holdout).status).toBe("failed");
    const early = structuredClone(holdout[0]!); early.completedAt = "2025-01-01T12:00:00.000Z";
    expect(() => importEvaluationRatings(plan, early, [], lock)).toThrow(/predate/);
    expect(() => evaluateLockedHoldout(plan, { ...lock, corpusFingerprint: "a".repeat(64) }, holdout)).toThrow(/altered/);
  });
  it("escapes private descriptions and provides a local-only accessible review form", () => {
    const changedSources = sources.map((source, index) => {
      const description = index === 0 ? '<script>alert("fictional")</script> Entirely fictional content.' : source.description;
      return { ...source, description, descriptionSha256: sha(description) };
    });
    const plan = createRelatedThemesEvaluation({ ...input, sources: changedSources, anchorsPerPartition: 9 });
    const pack = createBlindedReviewerPack(plan, "reviewer-alpha", "calibration");
    const html = renderRelatedThemesEvaluationHtml(pack);
    expect(html).toContain('name="viewport"');
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Download completed ratings");
    expect(html).not.toContain('<script>alert("fictional")');
    expect(html).not.toMatch(/fetch\(|XMLHttpRequest|https?:\/\//);
    expect(html).not.toContain("rawCosineScore");
    expect(html).not.toContain("sourceIdentity");
    expect(html).not.toContain(plan.modelRevision);
    for (const anchor of pack.anchors) {
      expect(html).toContain(`id="comparison-${anchor.anchorToken}" tabindex="-1"`);
      for (const candidate of anchor.candidates) {
        expect(html).toContain(`id="candidate-${candidate.candidateToken}" tabindex="-1"`);
        expect(html).toContain(`href="#candidate-${candidate.candidateToken}"`);
      }
      expect(html).toContain(`href="#comparison-${anchor.anchorToken}"`);
    }
    expect(html).toContain("Back to list comparison");
  });
});

import { createHash } from "node:crypto";
import { z } from "zod";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{3,100}$/);
const proseSchema = z.string().max(8_000);
const sourceSchema = z.object({
  sermonId: z.uuid(), sourceIdentity: z.string().min(1).max(240),
  description: z.string().min(1).max(20_000), descriptionSha256: hashSchema
}).strict();
const semanticSchema = z.object({ anchorId: z.uuid(), candidateId: z.uuid(), score: z.number().finite().min(-1).max(1) }).strict();
const metadataSchema = z.object({ anchorId: z.uuid(), candidateId: z.uuid(), rank: z.number().int().positive() }).strict();
export type EvaluationSource = z.infer<typeof sourceSchema>;
export type EvaluationPhase = "calibration" | "holdout";
export interface EvaluationAnchor {
  anchorId: string;
  stratum: "repeated_theme" | "contrasting_subject" | "difficult_negative";
  phase: EvaluationPhase;
  semantic: Array<{ candidateId: string; score: number }>;
  metadata: string[];
}
export interface RelatedThemesEvaluationPlan {
  contract: "related-themes-evaluation-v1";
  fingerprint: string;
  corpusFingerprint: string;
  pipelineFingerprint: string;
  modelRevision: string;
  seed: string;
  reviewerIds: [string, string];
  sources: EvaluationSource[];
  anchors: EvaluationAnchor[];
}
export interface BlindedReviewerPack {
  contract: "related-themes-review-pack-v1";
  evaluationFingerprint: string;
  packFingerprint: string;
  reviewerId: string;
  phase: EvaluationPhase;
  policyLockFingerprint: string | null;
  anchors: Array<{
    anchorToken: string;
    description: string;
    candidates: Array<{ candidateToken: string; description: string }>;
    lists: { A: string[]; B: string[] };
  }>;
}
const candidateRatingSchema = z.object({
  candidateToken: idSchema,
  usefulness: z.number().int().min(0).max(3),
  theologicalRisk: z.boolean(), riskNote: proseSchema,
  redundant: z.boolean(), note: proseSchema
}).strict().refine(value => !value.theologicalRisk || value.riskNote.trim().length > 0, "Risk findings need an explanation");
export const relatedThemesRatingSchema = z.object({
  contract: z.literal("related-themes-ratings-v1"),
  evaluationFingerprint: hashSchema, packFingerprint: hashSchema,
  reviewerId: idSchema, phase: z.enum(["calibration", "holdout"]),
  policyLockFingerprint: hashSchema.nullable(),
  reviewerKind: z.enum(["human", "ai_assessment"]),
  independentlyReviewed: z.literal(true), blindedToMethodsAndScores: z.literal(true),
  completedAt: z.iso.datetime(),
  anchors: z.array(z.object({
    anchorToken: idSchema,
    candidates: z.array(candidateRatingSchema),
    missingRelationships: proseSchema,
    preference: z.enum(["A", "B", "tie", "neither"]),
    preferenceReason: proseSchema
  }).strict())
}).strict();
export type RelatedThemesRatings = z.infer<typeof relatedThemesRatingSchema>;
export interface EvaluationAdjudication {
  anchorId: string;
  candidateId: string;
  evaluationFingerprint: string;
  phase: EvaluationPhase;
  reviewerEvidenceFingerprint: string;
  adjudicatorId: string;
  adjudicatorKind: "human";
  usefulness: 0 | 1 | 2 | 3;
  theologicalRisk: boolean;
  redundant: boolean;
  rationale: string;
}
export interface EvaluationPolicyLock {
  contract: "related-themes-policy-lock-v1";
  evaluationFingerprint: string;
  corpusFingerprint: string;
  pipelineFingerprint: string;
  calibrationEvidenceFingerprint: string;
  minimumCosineScore: number;
  maximumResults: number;
  calibrationSelectedPairs: number;
  lockedAt: string;
  fingerprint: string;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
function textHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function fail(message: string): never { throw new Error(`Related themes evaluation: ${message}`); }
function token(...parts: unknown[]): string { return hash(parts).slice(0, 24); }
function ordered<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b)));
}
function relationshipKeys(anchor: Pick<EvaluationAnchor, "anchorId" | "semantic" | "metadata">): string[] {
  // A→B and B→A expose the same relationship even when their usefulness is directional.
  return [...new Set([...anchor.semantic.map(item => item.candidateId), ...anchor.metadata])]
    .map(candidateId => [anchor.anchorId, candidateId].sort().join("/"));
}
function validatePartitionIndependence(anchors: readonly EvaluationAnchor[]): void {
  if (new Set(anchors.map(anchor => anchor.anchorId)).size !== anchors.length) fail("anchor appears in more than one partition");
  const calibration = anchors.filter(anchor => anchor.phase === "calibration");
  const holdout = anchors.filter(anchor => anchor.phase === "holdout");
  if (!calibration.length || !holdout.length) fail("both independent evaluation partitions are required");
  const exposed = new Set(calibration.flatMap(relationshipKeys));
  if (holdout.some(anchor => relationshipKeys(anchor).some(pair => exposed.has(pair)))) {
    fail("calibration and holdout reuse a rated relationship, including a reversed pair");
  }
}
function validatePlan(plan: RelatedThemesEvaluationPlan): void {
  const { fingerprint, ...frozen } = plan;
  if (hash(frozen) !== fingerprint) fail("frozen plan integrity mismatch");
  for (const source of plan.sources) {
    sourceSchema.parse(source);
    if (textHash(source.description) !== source.descriptionSha256) fail("description hash mismatch");
  }
  validatePartitionIndependence(plan.anchors);
}
function validateLock(plan: RelatedThemesEvaluationPlan, lock: EvaluationPolicyLock): void {
  const { fingerprint, ...frozen } = lock;
  if (lock.contract !== "related-themes-policy-lock-v1" || hash(frozen) !== fingerprint ||
      lock.evaluationFingerprint !== plan.fingerprint || lock.corpusFingerprint !== plan.corpusFingerprint ||
      lock.pipelineFingerprint !== plan.pipelineFingerprint || !Number.isFinite(lock.minimumCosineScore) ||
      lock.minimumCosineScore < -1 || lock.minimumCosineScore > 1 ||
      !Number.isInteger(lock.maximumResults) || lock.maximumResults < 1 || lock.maximumResults > 5) {
    fail("locked policy is missing, altered or belongs to another frozen corpus");
  }
}

/** Freeze this output in private storage before presenting any ratings. No metadata enters scoring. */
export function createRelatedThemesEvaluation(input: {
  sources: readonly EvaluationSource[];
  pipelineFingerprint: string;
  modelRevision: string;
  semanticCandidates: readonly z.infer<typeof semanticSchema>[];
  metadataCandidates: readonly z.infer<typeof metadataSchema>[];
  seed: string;
  reviewerIds: [string, string];
  anchorsPerPartition?: number;
}): RelatedThemesEvaluationPlan {
  hashSchema.parse(input.pipelineFingerprint);
  z.string().regex(/^[a-f0-9]{40}$/).parse(input.modelRevision);
  z.string().min(16).max(200).parse(input.seed);
  const reviewerIds = z.tuple([idSchema, idSchema]).parse(input.reviewerIds);
  if (reviewerIds[0] === reviewerIds[1]) fail("two distinct reviewer assignments are required");
  const sources = ordered(input.sources.map(source => sourceSchema.parse(source)), source => source.sermonId);
  const ids = new Set(sources.map(source => source.sermonId));
  if (ids.size !== sources.length || new Set(sources.map(source => source.sourceIdentity)).size !== sources.length) {
    fail("duplicate sermon or source identity");
  }
  for (const source of sources) if (textHash(source.description) !== source.descriptionSha256) fail("description hash mismatch");
  const semantic = input.semanticCandidates.map(candidate => semanticSchema.parse(candidate));
  const metadata = input.metadataCandidates.map(candidate => metadataSchema.parse(candidate));
  for (const candidates of [semantic, metadata]) {
    const pairs = new Set<string>();
    for (const candidate of candidates) {
      if (!ids.has(candidate.anchorId) || !ids.has(candidate.candidateId) || candidate.anchorId === candidate.candidateId) fail("ineligible or self candidate");
      const pair = `${candidate.anchorId}/${candidate.candidateId}`;
      if (pairs.has(pair)) fail("duplicate candidate pair");
      pairs.add(pair);
    }
  }
  const perPartition = z.number().int().min(1).max(100).parse(input.anchorsPerPartition ?? 12);
  const profiles = sources.map(source => {
    const ranked = semantic.filter(candidate => candidate.anchorId === source.sermonId)
      .sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId)).slice(0, 5);
    const baseline = metadata.filter(candidate => candidate.anchorId === source.sermonId)
      .sort((a, b) => a.rank - b.rank || a.candidateId.localeCompare(b.candidateId)).slice(0, 5).map(candidate => candidate.candidateId);
    return { anchorId: source.sermonId, semantic: ranked.map(({ candidateId, score }) => ({ candidateId, score })), metadata: baseline };
  }).filter(profile => profile.semantic.length > 0 || profile.metadata.length > 0);
  if (profiles.length < 2) fail("at least two independent anchor descriptions are required");
  // Relative score/disagreement strata aid sampling, not ranking or an invented topic taxonomy.
  const byTopScore = [...profiles].sort((a, b) => (b.semantic[0]?.score ?? -1) - (a.semantic[0]?.score ?? -1) || a.anchorId.localeCompare(b.anchorId));
  const topIds = new Set(byTopScore.slice(0, Math.ceil(profiles.length / 3)).map(profile => profile.anchorId));
  const contrastingIds = new Set(byTopScore.slice(-Math.floor(profiles.length / 3)).map(profile => profile.anchorId));
  const stratified = profiles.map(profile => ({ ...profile,
    stratum: (topIds.has(profile.anchorId) ? "repeated_theme" :
      contrastingIds.has(profile.anchorId) ? "contrasting_subject" : "difficult_negative") as EvaluationAnchor["stratum"]
  }));
  const buckets = (["repeated_theme", "contrasting_subject", "difficult_negative"] as const).map(stratum =>
    ordered(stratified.filter(item => item.stratum === stratum), item => `${stratum === "difficult_negative" ?
      (item.metadata.some(id => !item.semantic.some(candidate => candidate.candidateId === id)) ? "0" : "1") : ""}${token(input.seed, stratum, item.anchorId)}`));
  const selected: typeof stratified = [];
  while (buckets.some(bucket => bucket.length)) {
    for (const bucket of buckets) { const next = bucket.shift(); if (next) selected.push(next); }
  }
  const anchors: EvaluationAnchor[] = [];
  const counts = { calibration: 0, holdout: 0 };
  const pairs = { calibration: new Set<string>(), holdout: new Set<string>() };
  for (const profile of selected) {
    const preferred = counts.calibration <= counts.holdout ? "calibration" : "holdout";
    const phases: EvaluationPhase[] = preferred === "calibration" ? ["calibration", "holdout"] : ["holdout", "calibration"];
    const keys = relationshipKeys(profile);
    for (const phase of phases) {
      const other = phase === "calibration" ? "holdout" : "calibration";
      if (counts[phase] >= perPartition || keys.some(pair => pairs[other].has(pair))) continue;
      // Keep the complete top-five/baseline union; never remove a negative to fit the split.
      anchors.push({ ...profile, phase }); counts[phase] += 1;
      for (const key of keys) pairs[phase].add(key);
      break;
    }
    if (counts.calibration === perPartition && counts.holdout === perPartition) break;
  }
  if (counts.calibration !== perPartition || counts.holdout !== perPartition) {
    fail("insufficient pair-independent anchors for the requested partition sizes; do not freeze a contaminated or undersized holdout");
  }
  validatePartitionIndependence(anchors);
  const corpusFingerprint = hash(sources.map(({ sermonId, sourceIdentity, descriptionSha256 }) => ({ sermonId, sourceIdentity, descriptionSha256 })));
  const frozen = { contract: "related-themes-evaluation-v1" as const, corpusFingerprint,
    pipelineFingerprint: input.pipelineFingerprint, modelRevision: input.modelRevision,
    seed: input.seed, reviewerIds, sources, anchors };
  return { ...frozen, fingerprint: hash(frozen) };
}

function methodOrder(plan: RelatedThemesEvaluationPlan, reviewerId: string, anchorId: string): boolean {
  return Number.parseInt(token(plan.seed, reviewerId, anchorId, "method").slice(0, 2), 16) % 2 === 0;
}
function candidateToken(plan: RelatedThemesEvaluationPlan, reviewerId: string, anchorId: string, id: string): string {
  return token(plan.fingerprint, reviewerId, anchorId, id);
}
export function createBlindedReviewerPack(plan: RelatedThemesEvaluationPlan, reviewerId: string,
  phase: EvaluationPhase, lock?: EvaluationPolicyLock): BlindedReviewerPack {
  validatePlan(plan);
  if (!plan.reviewerIds.includes(reviewerId)) fail("reviewer is not assigned to this evaluation");
  if (phase === "holdout") { if (!lock) fail("holdout stays locked until calibration is frozen"); validateLock(plan, lock); }
  const sources = new Map(plan.sources.map(source => [source.sermonId, source]));
  const anchors = ordered(plan.anchors.filter(anchor => anchor.phase === phase), anchor => token(plan.seed, reviewerId, anchor.anchorId)).map(anchor => {
    const semantic = phase === "holdout" && lock ? anchor.semantic.filter(item => item.score >= lock.minimumCosineScore).slice(0, lock.maximumResults) : anchor.semantic;
    // Always judge ranks 1–5 in the blinded union, even when a locked policy omits them.
    const union = [...new Set([...anchor.semantic.map(item => item.candidateId), ...anchor.metadata])];
    const mapping = (id: string) => candidateToken(plan, reviewerId, anchor.anchorId, id);
    const semanticTokens = semantic.map(item => mapping(item.candidateId));
    const metadataTokens = anchor.metadata.map(mapping);
    return { anchorToken: token(plan.fingerprint, reviewerId, anchor.anchorId), description: sources.get(anchor.anchorId)!.description,
      candidates: ordered(union, id => token(plan.seed, reviewerId, anchor.anchorId, id)).map(id => ({ candidateToken: mapping(id), description: sources.get(id)!.description })),
      lists: methodOrder(plan, reviewerId, anchor.anchorId) ? { A: semanticTokens, B: metadataTokens } : { A: metadataTokens, B: semanticTokens } };
  });
  const frozen = { contract: "related-themes-review-pack-v1" as const, evaluationFingerprint: plan.fingerprint,
    reviewerId, phase, policyLockFingerprint: phase === "holdout" ? lock!.fingerprint : null, anchors };
  return { ...frozen, packFingerprint: hash(frozen) };
}

/** Import into private storage only; this validates, never authenticates a human or writes to a DB. */
export function importEvaluationRatings(plan: RelatedThemesEvaluationPlan, raw: unknown,
  existing: readonly RelatedThemesRatings[] = [], lock?: EvaluationPolicyLock): { rating: RelatedThemesRatings; status: "new" | "unchanged" } {
  const rating = relatedThemesRatingSchema.parse(raw);
  const pack = createBlindedReviewerPack(plan, rating.reviewerId, rating.phase, lock);
  if (rating.evaluationFingerprint !== plan.fingerprint || rating.packFingerprint !== pack.packFingerprint ||
      rating.policyLockFingerprint !== pack.policyLockFingerprint) fail("ratings refer to another or stale reviewer pack");
  if (rating.phase === "holdout" && Date.parse(rating.completedAt) < Date.parse(lock!.lockedAt)) fail("holdout ratings predate the policy lock");
  const anchorMap = new Map(rating.anchors.map(anchor => [anchor.anchorToken, anchor]));
  if (anchorMap.size !== rating.anchors.length || anchorMap.size !== pack.anchors.length) fail("missing or duplicate anchor ratings");
  for (const anchor of pack.anchors) {
    const received = anchorMap.get(anchor.anchorToken);
    if (!received) fail("unknown or missing anchor rating");
    const ids = received.candidates.map(item => item.candidateToken);
    if (new Set(ids).size !== ids.length || ids.length !== anchor.candidates.length || anchor.candidates.some(item => !ids.includes(item.candidateToken))) fail("missing, extra or duplicate candidate rating");
  }
  const prior = existing.find(item => item.reviewerId === rating.reviewerId && item.phase === rating.phase);
  if (prior && hash(prior) !== hash(rating)) fail("reviewer already submitted different evidence; preserve it and explicitly version the evaluation");
  return { rating, status: prior ? "unchanged" : "new" };
}

type ResolvedJudgment = { usefulness: number; theologicalRisk: boolean; redundant: boolean };
export function analyzeEvaluation(plan: RelatedThemesEvaluationPlan, inputs: readonly RelatedThemesRatings[], phase: EvaluationPhase,
  adjudications: readonly EvaluationAdjudication[] = [], lock?: EvaluationPolicyLock) {
  validatePlan(plan);
  const ratings: RelatedThemesRatings[] = [];
  for (const input of inputs.filter(item => item.phase === phase)) {
    const imported = importEvaluationRatings(plan, input, ratings, lock);
    if (imported.status === "new") ratings.push(imported.rating);
  }
  const humans = ratings.filter(item => item.reviewerKind === "human");
  const complete = plan.reviewerIds.every(id => humans.some(item => item.reviewerId === id));
  const evidenceFingerprint = hash(ordered(humans, item => item.reviewerId));
  const discrepancies: Array<{ anchorId: string; candidateId: string; adjudicated: boolean }> = [];
  const judgments = new Map<string, ResolvedJudgment>();
  const pairs: Array<[number, number]> = [];
  const adjudicationKeys = new Set<string>();
  for (const item of adjudications) {
    if (item.phase !== phase) continue;
    const key = `${item.anchorId}/${item.candidateId}`;
    if (adjudicationKeys.has(key) || item.evaluationFingerprint !== plan.fingerprint || item.reviewerEvidenceFingerprint !== evidenceFingerprint ||
      item.adjudicatorKind !== "human" || !idSchema.safeParse(item.adjudicatorId).success || !item.rationale.trim() ||
      !Number.isInteger(item.usefulness) || item.usefulness < 0 || item.usefulness > 3 || typeof item.theologicalRisk !== "boolean" || typeof item.redundant !== "boolean") fail("invalid, duplicate or stale human adjudication");
    adjudicationKeys.add(key);
  }
  const preferences = { semantic: 0, metadata: 0, tie: 0, neither: 0 };
  let missingRelationshipReports = 0;
  const anchors = plan.anchors.filter(anchor => anchor.phase === phase);
  for (const anchor of anchors) {
    const union = [...new Set([...anchor.semantic.map(item => item.candidateId), ...anchor.metadata])];
    for (const human of humans) {
      const received = human.anchors.find(item => item.anchorToken === token(plan.fingerprint, human.reviewerId, anchor.anchorId))!;
      if (received.missingRelationships.trim()) missingRelationshipReports += 1;
      if (received.preference === "tie" || received.preference === "neither") preferences[received.preference] += 1;
      else preferences[(received.preference === "A") === methodOrder(plan, human.reviewerId, anchor.anchorId) ? "semantic" : "metadata"] += 1;
    }
    if (!complete) continue;
    for (const id of union) {
      const pair = humans.map(human => human.anchors.find(item => item.anchorToken === token(plan.fingerprint, human.reviewerId, anchor.anchorId))!
        .candidates.find(item => item.candidateToken === candidateToken(plan, human.reviewerId, anchor.anchorId, id))!);
      const first = pair[0]!, second = pair[1]!;
      pairs.push([first.usefulness, second.usefulness]);
      const key = `${anchor.anchorId}/${id}`;
      const differs = first.usefulness !== second.usefulness || first.theologicalRisk !== second.theologicalRisk || first.redundant !== second.redundant;
      if (differs) {
        const resolved = adjudications.find(item => item.phase === phase && item.anchorId === anchor.anchorId && item.candidateId === id);
        discrepancies.push({ anchorId: anchor.anchorId, candidateId: id, adjudicated: Boolean(resolved) });
        if (resolved) judgments.set(key, resolved);
      } else judgments.set(key, first);
    }
  }
  for (const key of adjudicationKeys) if (!discrepancies.some(item => `${item.anchorId}/${item.candidateId}` === key)) fail("adjudication does not correspond to an observed disagreement");
  const exactAgreement = pairs.length ? pairs.filter(([a, b]) => a === b).length / pairs.length : null;
  const observedDistance = pairs.length ? pairs.reduce((sum, [a, b]) => sum + (a - b) ** 2 / 9, 0) / pairs.length : null;
  let expectedDistance = 0;
  if (pairs.length) for (let a = 0; a < 4; a += 1) for (let b = 0; b < 4; b += 1) {
    expectedDistance += pairs.filter(pair => pair[0] === a).length / pairs.length * pairs.filter(pair => pair[1] === b).length / pairs.length * (a - b) ** 2 / 9;
  }
  const weightedKappa = observedDistance === null || expectedDistance === 0 ? null : 1 - observedDistance / expectedDistance;
  return { status: !complete ? "awaiting_human_evaluation" as const : discrepancies.some(item => !item.adjudicated) ? "awaiting_adjudication" as const : "complete" as const,
    phase, humanReviewerCount: humans.length, aiAssessmentCount: ratings.length - humans.length, evidenceFingerprint,
    anchorsReviewed: complete ? anchors.length : 0, candidatePairsReviewed: pairs.length, exactAgreement, weightedKappa,
    disagreements: discrepancies, judgments, preferences, missingRelationshipReports };
}

export function calibrateAndLockEvaluationPolicy(plan: RelatedThemesEvaluationPlan, ratings: readonly RelatedThemesRatings[],
  adjudications: readonly EvaluationAdjudication[] = [], lockedAt = new Date().toISOString()): EvaluationPolicyLock {
  if (ratings.some(item => item.phase === "holdout")) fail("holdout evidence cannot be used for calibration");
  z.iso.datetime().parse(lockedAt);
  const analysis = analyzeEvaluation(plan, ratings, "calibration", adjudications);
  if (analysis.status !== "complete") fail(analysis.status);
  if (ratings.some(item => Date.parse(item.completedAt) > Date.parse(lockedAt))) fail("policy lock predates calibration evidence");
  const anchors = plan.anchors.filter(item => item.phase === "calibration");
  const thresholds = [...new Set(anchors.flatMap(anchor => anchor.semantic.map(item => item.score)))].sort((a, b) => b - a);
  const options: Array<{ threshold: number; maximum: number; selected: number; utility: number }> = [];
  for (const threshold of thresholds) for (let maximum = 1; maximum <= 5; maximum += 1) {
    const selected = anchors.flatMap(anchor => anchor.semantic.filter(item => item.score >= threshold).slice(0, maximum)
      .map(item => analysis.judgments.get(`${anchor.anchorId}/${item.candidateId}`)!));
    if (!selected.length || selected.some(item => !item || item.usefulness < 2 || item.theologicalRisk || item.redundant)) continue;
    options.push({ threshold, maximum, selected: selected.length, utility: selected.reduce((sum, item) => sum + item.usefulness, 0) });
  }
  options.sort((a, b) => b.utility - a.utility || b.selected - a.selected || a.maximum - b.maximum || b.threshold - a.threshold);
  const selected = options[0];
  if (!selected) fail("calibration supports no useful, non-risky, nonredundant policy; normal release remains disabled");
  const frozen = { contract: "related-themes-policy-lock-v1" as const, evaluationFingerprint: plan.fingerprint,
    corpusFingerprint: plan.corpusFingerprint, pipelineFingerprint: plan.pipelineFingerprint,
    calibrationEvidenceFingerprint: hash({ ratings: analysis.evidenceFingerprint, adjudications: ordered(adjudications, item => `${item.anchorId}/${item.candidateId}`) }),
    minimumCosineScore: selected.threshold, maximumResults: selected.maximum, calibrationSelectedPairs: selected.selected, lockedAt };
  return { ...frozen, fingerprint: hash(frozen) };
}

export function evaluateLockedHoldout(plan: RelatedThemesEvaluationPlan, lock: EvaluationPolicyLock,
  ratings: readonly RelatedThemesRatings[], adjudications: readonly EvaluationAdjudication[] = []) {
  validatePlan(plan); validateLock(plan, lock);
  const analysis = analyzeEvaluation(plan, ratings, "holdout", adjudications, lock);
  const selected = plan.anchors.filter(anchor => anchor.phase === "holdout").flatMap(anchor =>
    anchor.semantic.filter(item => item.score >= lock.minimumCosineScore).slice(0, lock.maximumResults)
      .map(item => analysis.judgments.get(`${anchor.anchorId}/${item.candidateId}`)));
  const failedPairs = selected.filter(item => !item || item.usefulness < 2 || item.theologicalRisk || item.redundant).length;
  // A positive comparison, no selected harmful/weak/redundant pair, and no unresolved missing-neighbour report.
  const passed = analysis.status === "complete" && selected.length > 0 && failedPairs === 0 &&
    analysis.preferences.semantic > analysis.preferences.metadata && analysis.preferences.neither === 0 && analysis.missingRelationshipReports === 0;
  return { status: analysis.status === "complete" ? passed ? "passed" as const : "failed" as const : analysis.status,
    normalFeatureMayBeEnabled: passed, policyLockFingerprint: lock.fingerprint, selectedPairs: selected.length,
    failedPairs, analysis, reason: passed ? "Independent blinded human holdout evidence passes the frozen policy" :
      "Normal release requires complete independent human holdout evidence, adjudication, useful safe nonredundant matches, positive baseline preference and no unexplained missing relationships" };
}

function escape(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }

/** Private description-only pack. It performs no network request or server-side mutation. */
export function renderRelatedThemesEvaluationHtml(pack: BlindedReviewerPack): string {
  const { packFingerprint, ...frozen } = pack;
  if (hash(frozen) !== packFingerprint) fail("reviewer pack integrity mismatch");
  const anchors = pack.anchors.map((anchor, anchorIndex) => {
    const comparisonId = `comparison-${escape(anchor.anchorToken)}`;
    const candidates = anchor.candidates.map((candidate, index) => `<fieldset id="candidate-${escape(candidate.candidateToken)}" tabindex="-1" data-candidate="${escape(candidate.candidateToken)}">
      <legend>Candidate ${index + 1}</legend><p class="description" dir="auto">${escape(candidate.description)}</p>
      <label>Usefulness<select name="usefulness" required><option value="">Choose a rating</option><option value="0">0 — Not related or misleading</option><option value="1">1 — Weak or incidental connection</option><option value="2">2 — Useful thematic connection</option><option value="3">3 — Strong, useful connection</option></select></label>
      <label class="check"><input name="risk" type="checkbox">Potential theological risk or misleading association</label>
      <label>Risk explanation<textarea name="riskNote" maxlength="8000" rows="2"></textarea></label>
      <label class="check"><input name="redundant" type="checkbox">Redundant with another candidate</label>
      <label>Other review notes<textarea name="note" maxlength="8000" rows="2"></textarea></label>
      <a class="jump-link" href="#${comparisonId}" aria-label="Back to list comparison for Anchor ${anchorIndex + 1}">Back to list comparison</a>
    </fieldset>`).join("");
    const lists = (["A", "B"] as const).map(label => `<p><strong>List ${label}:</strong> ${anchor.lists[label].length
      ? anchor.lists[label].map(id => `<a class="jump-link" href="#candidate-${escape(id)}" aria-label="Review Candidate ${anchor.candidates.findIndex(item => item.candidateToken === id) + 1} for Anchor ${anchorIndex + 1}">Candidate ${anchor.candidates.findIndex(item => item.candidateToken === id) + 1}</a>`).join(" · ")
      : "No recommendations"}</p>`).join("");
    return `<section data-anchor="${escape(anchor.anchorToken)}"><h2>Anchor ${anchorIndex + 1} of ${pack.anchors.length}</h2><p class="description" dir="auto">${escape(anchor.description)}</p><h3>Rate each possible connection</h3>${candidates}
      <div class="comparison" id="${comparisonId}" tabindex="-1" aria-labelledby="${comparisonId}-heading"><h3 id="${comparisonId}-heading">Compare the two recommendation lists</h3><p>Finish the individual ratings first. Follow any candidate link to reread its description, then use “Back to list comparison” to return. The methods and scores remain hidden.</p>${lists}
      <label>Overall preference<select name="preference" required><option value="">Choose a preference</option><option value="A">List A</option><option value="B">List B</option><option value="tie">Equally useful</option><option value="neither">Neither is useful</option></select></label>
      <label>Why?<textarea name="preferenceReason" rows="2" maxlength="8000"></textarea></label>
      <label>Missing obvious relationships (leave blank if none)<textarea name="missingRelationships" rows="2" maxlength="8000"></textarea></label></div></section>`;
  }).join("");
  const data = JSON.stringify({ evaluationFingerprint: pack.evaluationFingerprint, packFingerprint: pack.packFingerprint,
    reviewerId: pack.reviewerId, phase: pack.phase, policyLockFingerprint: pack.policyLockFingerprint }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private Related themes evaluation</title><style>
  label{min-width:0}select{width:100%;min-width:0}
  .jump-link{display:inline-flex;align-items:center;min-height:44px;color:var(--accent);text-underline-offset:.2em}.jump-link:hover{color:var(--ink)}[id^="candidate-"],.comparison{scroll-margin-top:1rem}
  :root{color-scheme:light;--ink:#183d50;--soft:#3e5360;--paper:#fff;--sky:#eef3f4;--rule:#6b7b84;--accent:#90411f}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:1rem/1.65 "Segoe UI",sans-serif;overflow-wrap:anywhere}main{width:min(72rem,100% - 2rem);margin:2rem auto 5rem}h1{font-size:2rem;line-height:1.2}h2{font-size:1.5rem}h3{font-size:1.125rem}header,.comparison{background:var(--sky);padding:1.5rem}header p,.description{max-width:70ch}section{margin-top:3rem;border-top:1px solid #ccd7dc;padding-top:1rem}.description{white-space:pre-wrap}fieldset{margin:2rem 0;padding:1.5rem;border:1px solid var(--rule);min-width:0}legend{font-weight:700;padding:0 .5rem}label{display:grid;gap:.35rem;margin:1rem 0;font-weight:600}.check{display:flex;align-items:center;gap:.75rem;min-height:44px}.check input{width:1.25rem;height:1.25rem;flex:none;accent-color:var(--accent)}select,textarea,button{font:inherit;border:1px solid var(--rule);border-radius:.25rem;padding:.65rem;max-width:100%;min-height:44px;background:white;color:var(--ink)}textarea{resize:vertical;width:100%;caret-color:var(--accent)}button{background:var(--ink);color:white;padding:.75rem 1.25rem;cursor:pointer}button:hover{background:var(--accent)}:focus-visible{outline:3px solid var(--ink);outline-offset:3px}::selection{background:#dbe8ec;color:var(--ink)}.actions{margin-top:3rem}#result{min-height:2rem;color:var(--soft)}@media(max-width:40rem){header,fieldset,.comparison{padding:1rem}button{width:100%}main{margin-top:1rem}h1{font-size:1.75rem}}@media print{button,.actions{display:none}}
  </style></head><body><main><header><h1>Related themes evaluation</h1><p>Read the complete anchor description and each candidate. Judge thematic usefulness, not shared wording. Work independently without comparing answers with another reviewer. Titles, identities, selection methods and scores are deliberately hidden.</p><p>Your ratings remain on this page until you download the JSON file. Nothing is submitted to the server. Keep the downloaded file private and return it through the agreed protected channel.</p></header><noscript><p>The descriptions remain readable without JavaScript. To download structured ratings, enable JavaScript on this protected page or request the private JSON reviewer pack.</p></noscript><form id="evaluation">${anchors}<div class="actions"><label class="check"><input id="independent" type="checkbox" required>I am the assigned human reviewer and completed this independently, blind to methods and scores.</label><button type="submit">Download completed ratings</button><p id="result" role="status" aria-live="polite"></p></div></form></main><script>
  (()=>{const identity=${data};const form=document.getElementById('evaluation');function validateRisk(){for(const field of form.querySelectorAll('[data-candidate]')){const risk=field.querySelector('[name=risk]');const note=field.querySelector('[name=riskNote]');note.setCustomValidity(risk.checked&&!note.value.trim()?'Explain the risk before downloading.':'');}}form.addEventListener('submit',event=>{event.preventDefault();validateRisk();if(!form.reportValidity())return;const anchors=Array.from(form.querySelectorAll('[data-anchor]')).map(section=>({anchorToken:section.dataset.anchor,candidates:Array.from(section.querySelectorAll('[data-candidate]')).map(field=>({candidateToken:field.dataset.candidate,usefulness:Number(field.querySelector('[name=usefulness]').value),theologicalRisk:field.querySelector('[name=risk]').checked,riskNote:field.querySelector('[name=riskNote]').value,redundant:field.querySelector('[name=redundant]').checked,note:field.querySelector('[name=note]').value})),missingRelationships:section.querySelector('[name=missingRelationships]').value,preference:section.querySelector('[name=preference]').value,preferenceReason:section.querySelector('[name=preferenceReason]').value}));const payload={contract:'related-themes-ratings-v1',...identity,reviewerKind:'human',independentlyReviewed:true,blindedToMethodsAndScores:true,completedAt:new Date().toISOString(),anchors};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='related-themes-'+identity.phase+'-'+identity.reviewerId+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById('result').textContent='Ratings downloaded. Keep the file private; no server submission has occurred.';});form.addEventListener('input',validateRisk);})();
  </script></body></html>`;
}

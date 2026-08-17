import { describe, expect, it } from "vitest";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import {
  buildDescriptionSemanticPlan,
  descriptionSha256,
  descriptionSemanticPipelineFingerprint,
  rebuildDescriptionSemanticRelationships,
  type DescriptionEmbeddingModel,
  type DescriptionSemanticPipeline,
  type EligibleDescriptionSemanticSource
} from "../src/semantic/description-related-themes";
import {
  buildPublishedSermonListQuery,
  buildRelatedPublishedSermonsQuery
} from "../src/server/queries/public-sermons";

const pipeline: DescriptionSemanticPipeline = {
  pipelineVersion: "description-only-semantic-v1",
  inputField: "approved_public_description",
  inputMode: "symmetric_document",
  queryPrefix: null,
  documentPrefix: null,
  textNormalisation: "exact_utf8",
  modelIdentifier: "synthetic-fixed-vector-mechanics-v1",
  modelSha256: "1".repeat(64),
  tokenizerIdentifier: "synthetic-no-tokenizer-v1",
  tokenizerSha256: "2".repeat(64),
  pooling: "mean",
  normalisation: "l2_float32",
  truncationMaxTokens: 128,
  dimensions: 3
};

const policy = {
  corpusBuildVersion: "synthetic-corpus-v1",
  qualityPolicyId: "synthetic-mechanics-threshold-v1",
  minimumCosineScore: 0.8,
  maximumResults: 3
};

const descriptions = {
  first: "An anonymised approved description explores patient hope, faithful endurance, and compassionate care within an entirely synthetic example.",
  second: "A separate anonymised approved description considers enduring hope, steady faith, and caring service in a synthetic congregation.",
  third: "This anonymised approved description discusses a deliberately unrelated mechanical fixture without any real sermon or private material.",
  changed: "This changed anonymised approved description now focuses on restoration, reconciliation, and mercy solely for deterministic testing."
};

function source(sermonId: string, approvedDescription: string): EligibleDescriptionSemanticSource {
  return {
    sermonId,
    approvedDescription,
    descriptionSha256: descriptionSha256(approvedDescription)
  };
}

class FixedVectorModel implements DescriptionEmbeddingModel {
  readonly calls: string[][] = [];

  constructor(private readonly vectors: Map<string, Float32Array>) {}

  async embedApprovedDescriptions(approvedDescriptions: readonly string[]) {
    this.calls.push([...approvedDescriptions]);
    return approvedDescriptions.map((description) => this.vectors.get(description)!);
  }
}

describe("description-only Related themes mechanics", () => {
  it("admits only approved description strings to the symmetric model boundary", async () => {
    const sources = [
      source("11111111-1111-4111-8111-111111111111", descriptions.first),
      source("22222222-2222-4222-8222-222222222222", descriptions.second)
    ];
    const model = new FixedVectorModel(new Map([
      [descriptions.first, new Float32Array([1, 0, 0])],
      [descriptions.second, new Float32Array([0.9, 0.1, 0])]
    ]));
    const plan = await buildDescriptionSemanticPlan({
      sources,
      model,
      pipeline,
      policy,
      generatedAt: new Date("2026-08-17T00:00:00.000Z")
    });

    expect(model.calls).toEqual([[descriptions.first, descriptions.second]]);
    expect(plan.pipeline).toMatchObject({
      inputField: "approved_public_description",
      inputMode: "symmetric_document",
      queryPrefix: null,
      documentPrefix: null,
      normalisation: "l2_float32"
    });
    expect(plan.pipelineFingerprint).toBe(descriptionSemanticPipelineFingerprint(pipeline));
    expect(JSON.stringify(plan.relationships)).not.toContain(descriptions.first);
    expect(JSON.stringify(plan.relationships)).not.toContain(descriptions.second);
  });

  it("is invariant when title, Scripture, speaker, series, topics, dates and other metadata change", async () => {
    const originalRecords = [
      { ...source("11111111-1111-4111-8111-111111111111", descriptions.first), title: "Synthetic A", scripture: "Example 1", speaker: "Speaker A", series: "Series A", topics: ["A"], date: "2026-01-01" },
      { ...source("22222222-2222-4222-8222-222222222222", descriptions.second), title: "Synthetic B", scripture: "Example 2", speaker: "Speaker B", series: "Series B", topics: ["B"], date: "2026-01-02" }
    ];
    const changedMetadata = originalRecords.map((record) => ({
      ...record,
      title: "Completely changed title",
      scripture: "Completely changed Scripture",
      speaker: "Different speaker",
      series: "Different series",
      topics: ["Different topic"],
      date: "2030-12-31"
    }));
    const semanticProjection = (record: typeof originalRecords[number]) => source(
      record.sermonId,
      record.approvedDescription
    );
    const vectors = new Map([
      [descriptions.first, new Float32Array([1, 0, 0])],
      [descriptions.second, new Float32Array([0.9, 0.1, 0])]
    ]);
    const first = await buildDescriptionSemanticPlan({
      sources: originalRecords.map(semanticProjection),
      model: new FixedVectorModel(vectors), pipeline, policy,
      generatedAt: new Date("2026-08-17T00:00:00.000Z")
    });
    const second = await buildDescriptionSemanticPlan({
      sources: changedMetadata.map(semanticProjection),
      model: new FixedVectorModel(vectors), pipeline, policy,
      generatedAt: new Date("2026-08-17T00:00:00.000Z")
    });
    expect(second).toEqual(first);
  });

  it("changes provenance and ranking only when the approved description changes", async () => {
    const fixedId = "11111111-1111-4111-8111-111111111111";
    const neighbourId = "22222222-2222-4222-8222-222222222222";
    const before = await buildDescriptionSemanticPlan({
      sources: [source(fixedId, descriptions.first), source(neighbourId, descriptions.second)],
      model: new FixedVectorModel(new Map([
        [descriptions.first, new Float32Array([1, 0, 0])],
        [descriptions.second, new Float32Array([1, 0, 0])]
      ])),
      pipeline, policy,
      generatedAt: new Date("2026-08-17T00:00:00.000Z")
    });
    const after = await buildDescriptionSemanticPlan({
      sources: [source(fixedId, descriptions.changed), source(neighbourId, descriptions.second)],
      model: new FixedVectorModel(new Map([
        [descriptions.changed, new Float32Array([-1, 0, 0])],
        [descriptions.second, new Float32Array([1, 0, 0])]
      ])),
      pipeline, policy,
      generatedAt: new Date("2026-08-17T00:00:00.000Z")
    });
    expect(after.buildFingerprint).not.toBe(before.buildFingerprint);
    expect(after.relationships).toEqual([]);
    expect(after.sources[0]?.descriptionSha256).not.toBe(before.sources[0]?.descriptionSha256);
  });

  it("excludes self, deduplicates, orders equal scores by stable ID and does not pad weak candidates", async () => {
    const sources = [
      source("33333333-3333-4333-8333-333333333333", descriptions.first),
      source("11111111-1111-4111-8111-111111111111", descriptions.second),
      source("22222222-2222-4222-8222-222222222222", descriptions.third)
    ];
    const equalModel = new FixedVectorModel(new Map([
      [descriptions.first, new Float32Array([1, 0, 0])],
      [descriptions.second, new Float32Array([1, 0, 0])],
      [descriptions.third, new Float32Array([1, 0, 0])]
    ]));
    const equal = await buildDescriptionSemanticPlan({
      sources, model: equalModel, pipeline, policy,
      generatedAt: new Date("2026-08-17T00:00:00.000Z")
    });
    const forThird = equal.relationships.filter(
      (relationship) => relationship.sourceSermonId === "33333333-3333-4333-8333-333333333333"
    );
    expect(forThird.map((relationship) => relationship.neighbourSermonId)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    ]);
    expect(equal.relationships.some((item) => item.sourceSermonId === item.neighbourSermonId)).toBe(false);
    expect(new Set(equal.relationships.map((item) => `${item.sourceSermonId}:${item.neighbourSermonId}`)).size)
      .toBe(equal.relationships.length);

    const weak = await buildDescriptionSemanticPlan({
      sources,
      model: new FixedVectorModel(new Map([
        [descriptions.first, new Float32Array([1, 0, 0])],
        [descriptions.second, new Float32Array([0.9, 0.1, 0])],
        [descriptions.third, new Float32Array([0, 1, 0])]
      ])),
      pipeline, policy,
      generatedAt: new Date("2026-08-17T00:00:00.000Z")
    });
    expect(weak.relationships.filter((item) => item.sourceSermonId === sources[0]!.sermonId)).toHaveLength(1);
  });

  it("replaces storage even for an empty eligible corpus instead of leaving stale rows", async () => {
    let replaceCalls = 0;
    let modelCalls = 0;
    const plan = await rebuildDescriptionSemanticRelationships({
      store: {
        async listEligibleApprovedDescriptions() { return []; },
        async replaceAllRelationships(received) {
          replaceCalls += 1;
          expect(received.sources).toEqual([]);
          expect(received.relationships).toEqual([]);
        }
      },
      model: {
        async embedApprovedDescriptions() {
          modelCalls += 1;
          return [];
        }
      },
      pipeline,
      policy,
      generatedAt: new Date("2026-08-17T00:00:00.000Z")
    });
    expect(plan.relationships).toEqual([]);
    expect(replaceCalls).toBe(1);
    expect(modelCalls).toBe(0);
  });

  it("keeps Romans 8 on the existing parameterized keyword and structured-search path", () => {
    const query = buildPublishedSermonListQuery(
      publicSermonListQuerySchema.parse({ query: "Romans 8" })
    );
    expect(query.values).toContain("Romans 8");
    expect(query.values).toContain("%Romans 8%");
    expect(query.text).toContain("s.search_vector @@");
    expect(query.text).toContain("priority_reference.display_text");
    expect(query.text).not.toMatch(/semantic|embedding|cosine/i);
  });

  it("preserves the existing metadata-based related-sermon scoring contract", () => {
    const query = buildRelatedPublishedSermonsQuery(
      "11111111-1111-4111-8111-111111111111",
      3
    );
    expect(query.text).toContain("CASE WHEN score.same_series THEN 100");
    expect(query.text).toContain("CASE WHEN score.overlapping_scripture THEN 70");
    expect(query.text).toContain("CASE WHEN score.same_bible_book THEN 35");
    expect(query.text).toContain("CASE WHEN score.same_speaker THEN 15");
    expect(query.text).not.toMatch(/description_semantic|embedding/i);
  });
});

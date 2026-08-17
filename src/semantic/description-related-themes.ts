import { createHash } from "node:crypto";
import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const descriptionSemanticPipelineSchema = z.object({
  pipelineVersion: z.literal("description-only-semantic-v1"),
  inputField: z.literal("approved_public_description"),
  inputMode: z.literal("symmetric_document"),
  queryPrefix: z.null(),
  documentPrefix: z.null(),
  textNormalisation: z.literal("exact_utf8"),
  modelIdentifier: z.string().trim().min(1).max(240),
  modelSha256: sha256Schema,
  tokenizerIdentifier: z.string().trim().min(1).max(240),
  tokenizerSha256: sha256Schema,
  pooling: z.enum(["mean", "cls"]),
  normalisation: z.literal("l2_float32"),
  truncationMaxTokens: z.number().int().min(1).max(65_536),
  dimensions: z.number().int().min(1).max(4_096)
}).strict();

export type DescriptionSemanticPipeline = z.infer<typeof descriptionSemanticPipelineSchema>;

export const descriptionSemanticBuildPolicySchema = z.object({
  corpusBuildVersion: z.string().trim().min(1).max(200),
  qualityPolicyId: z.string().trim().min(1).max(200),
  minimumCosineScore: z.number().min(-1).max(1),
  maximumResults: z.number().int().min(1).max(20)
}).strict();

export type DescriptionSemanticBuildPolicy = z.infer<
  typeof descriptionSemanticBuildPolicySchema
>;

export const eligibleDescriptionSemanticSourceSchema = z.object({
  sermonId: z.uuid(),
  approvedDescription: z.string().min(80).max(2_000),
  descriptionSha256: sha256Schema
}).strict();

export type EligibleDescriptionSemanticSource = z.infer<
  typeof eligibleDescriptionSemanticSourceSchema
>;

export interface DescriptionEmbeddingModel {
  embedApprovedDescriptions(
    approvedDescriptions: readonly string[],
    pipeline: Readonly<DescriptionSemanticPipeline>
  ): Promise<readonly Float32Array[]>;
}

export interface DescriptionSemanticRelationship {
  sourceSermonId: string;
  neighbourSermonId: string;
  sourceDescriptionSha256: string;
  neighbourDescriptionSha256: string;
  rank: number;
  rawCosineScore: number;
  generatedAt: string;
}

export interface DescriptionSemanticBuildPlan {
  buildFingerprint: string;
  pipelineFingerprint: string;
  pipeline: DescriptionSemanticPipeline;
  policy: DescriptionSemanticBuildPolicy;
  sources: EligibleDescriptionSemanticSource[];
  relationships: DescriptionSemanticRelationship[];
  generatedAt: string;
}

export interface DescriptionSemanticStore {
  listEligibleApprovedDescriptions(): Promise<EligibleDescriptionSemanticSource[]>;
  replaceAllRelationships(plan: DescriptionSemanticBuildPlan): Promise<void>;
}

export class DescriptionSemanticError extends Error {
  constructor(
    public readonly code:
      | "source_integrity_failure"
      | "model_output_failure"
      | "vector_normalisation_failure",
    message: string
  ) {
    super(message);
    this.name = "DescriptionSemanticError";
  }
}

export function descriptionSha256(approvedDescription: string): string {
  return createHash("sha256").update(approvedDescription, "utf8").digest("hex");
}

function stableSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function descriptionSemanticPipelineFingerprint(
  input: DescriptionSemanticPipeline
): string {
  return stableSha256(descriptionSemanticPipelineSchema.parse(input));
}

function l2NormaliseFloat32(vector: Float32Array, dimensions: number): Float32Array {
  if (vector.length !== dimensions) {
    throw new DescriptionSemanticError(
      "model_output_failure",
      "The embedding model returned an unexpected vector dimension"
    );
  }
  let squaredMagnitude = Math.fround(0);
  const values = new Float32Array(dimensions);
  for (let index = 0; index < dimensions; index += 1) {
    const value = Math.fround(vector[index]!);
    if (!Number.isFinite(value)) {
      throw new DescriptionSemanticError(
        "model_output_failure",
        "The embedding model returned a non-finite value"
      );
    }
    values[index] = value;
    squaredMagnitude = Math.fround(
      squaredMagnitude + Math.fround(value * value)
    );
  }
  if (!Number.isFinite(squaredMagnitude) || squaredMagnitude <= 0) {
    throw new DescriptionSemanticError(
      "vector_normalisation_failure",
      "The embedding model returned a zero-magnitude vector"
    );
  }
  const magnitude = Math.fround(Math.sqrt(squaredMagnitude));
  const normalised = new Float32Array(dimensions);
  for (let index = 0; index < dimensions; index += 1) {
    normalised[index] = Math.fround(values[index]! / magnitude);
  }
  return normalised;
}

export function exactFloat32Cosine(
  leftNormalised: Float32Array,
  rightNormalised: Float32Array
): number {
  if (leftNormalised.length !== rightNormalised.length || leftNormalised.length === 0) {
    throw new DescriptionSemanticError(
      "model_output_failure",
      "Cosine comparison requires equal non-empty vector dimensions"
    );
  }
  let score = Math.fround(0);
  for (let index = 0; index < leftNormalised.length; index += 1) {
    score = Math.fround(
      score + Math.fround(leftNormalised[index]! * rightNormalised[index]!)
    );
  }
  return Math.fround(Math.max(-1, Math.min(1, score)));
}

function validatedSources(
  input: readonly EligibleDescriptionSemanticSource[]
): EligibleDescriptionSemanticSource[] {
  const parsed = input.map((source) => eligibleDescriptionSemanticSourceSchema.parse(source));
  const ids = new Set<string>();
  for (const source of parsed) {
    if (ids.has(source.sermonId)) {
      throw new DescriptionSemanticError(
        "source_integrity_failure",
        "The eligible semantic source set contains a duplicate sermon identity"
      );
    }
    ids.add(source.sermonId);
    if (descriptionSha256(source.approvedDescription) !== source.descriptionSha256) {
      throw new DescriptionSemanticError(
        "source_integrity_failure",
        "An approved description hash does not match its semantic input"
      );
    }
  }
  return parsed.sort((left, right) => left.sermonId.localeCompare(right.sermonId));
}

export async function buildDescriptionSemanticPlan(input: {
  sources: readonly EligibleDescriptionSemanticSource[];
  model: DescriptionEmbeddingModel;
  pipeline: DescriptionSemanticPipeline;
  policy: DescriptionSemanticBuildPolicy;
  generatedAt?: Date | undefined;
}): Promise<DescriptionSemanticBuildPlan> {
  const pipeline = descriptionSemanticPipelineSchema.parse(input.pipeline);
  const policy = descriptionSemanticBuildPolicySchema.parse(input.policy);
  const sources = validatedSources(input.sources);
  const pipelineFingerprint = descriptionSemanticPipelineFingerprint(pipeline);
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const vectors = sources.length
    ? await input.model.embedApprovedDescriptions(
        sources.map((source) => source.approvedDescription),
        pipeline
      )
    : [];
  if (vectors.length !== sources.length) {
    throw new DescriptionSemanticError(
      "model_output_failure",
      "The embedding model returned an unexpected vector count"
    );
  }
  const normalised = vectors.map((vector) => l2NormaliseFloat32(vector, pipeline.dimensions));
  const relationships: DescriptionSemanticRelationship[] = [];
  const minimum = Math.fround(policy.minimumCosineScore);

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
    const source = sources[sourceIndex]!;
    const candidates = sources
      .map((neighbour, neighbourIndex) => ({
        neighbour,
        score: sourceIndex === neighbourIndex
          ? null
          : exactFloat32Cosine(normalised[sourceIndex]!, normalised[neighbourIndex]!)
      }))
      .filter(
        (candidate): candidate is { neighbour: EligibleDescriptionSemanticSource; score: number } =>
          candidate.score !== null && candidate.score >= minimum
      )
      .sort((left, right) =>
        right.score - left.score || left.neighbour.sermonId.localeCompare(right.neighbour.sermonId)
      )
      .slice(0, policy.maximumResults);

    for (const [index, candidate] of candidates.entries()) {
      relationships.push({
        sourceSermonId: source.sermonId,
        neighbourSermonId: candidate.neighbour.sermonId,
        sourceDescriptionSha256: source.descriptionSha256,
        neighbourDescriptionSha256: candidate.neighbour.descriptionSha256,
        rank: index + 1,
        rawCosineScore: candidate.score,
        generatedAt
      });
    }
  }

  const buildFingerprint = stableSha256({
    contract: "description-semantic-build-v1",
    pipelineFingerprint,
    policy,
    sources: sources.map((source) => ({
      sermonId: source.sermonId,
      descriptionSha256: source.descriptionSha256
    }))
  });

  return {
    buildFingerprint,
    pipelineFingerprint,
    pipeline,
    policy,
    sources,
    relationships,
    generatedAt
  };
}

export async function rebuildDescriptionSemanticRelationships(input: {
  store: DescriptionSemanticStore;
  model: DescriptionEmbeddingModel;
  pipeline: DescriptionSemanticPipeline;
  policy: DescriptionSemanticBuildPolicy;
  generatedAt?: Date | undefined;
}): Promise<DescriptionSemanticBuildPlan> {
  const sources = await input.store.listEligibleApprovedDescriptions();
  const plan = await buildDescriptionSemanticPlan({
    sources,
    model: input.model,
    pipeline: input.pipeline,
    policy: input.policy,
    ...(input.generatedAt ? { generatedAt: input.generatedAt } : {})
  });
  await input.store.replaceAllRelationships(plan);
  return plan;
}

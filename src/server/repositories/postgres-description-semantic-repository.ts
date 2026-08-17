import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  descriptionSha256,
  eligibleDescriptionSemanticSourceSchema,
  type DescriptionSemanticBuildPlan,
  type DescriptionSemanticStore,
  type EligibleDescriptionSemanticSource
} from "../../semantic/description-related-themes";

const selectionRequestSchema = z.object({
  sourceSermonId: z.uuid(),
  pipelineFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  corpusBuildVersion: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20)
}).strict();

export interface DescriptionSemanticSelection {
  neighbourSermonId: string;
  rank: number;
  rawCosineScore: number;
}

export class DescriptionSemanticPersistenceError extends Error {
  constructor(
    public readonly code: "eligible_corpus_changed" | "relationship_integrity_failure",
    message: string
  ) {
    super(message);
    this.name = "DescriptionSemanticPersistenceError";
  }
}

interface EligibilityRow {
  sermon_id: string;
  approved_description: string;
  description_sha256: string;
}

function sourceFromRow(row: EligibilityRow): EligibleDescriptionSemanticSource {
  return eligibleDescriptionSemanticSourceSchema.parse({
    sermonId: row.sermon_id,
    approvedDescription: row.approved_description,
    descriptionSha256: row.description_sha256
  });
}

async function eligibleSources(client: Pool | PoolClient): Promise<EligibleDescriptionSemanticSource[]> {
  const result = await client.query<EligibilityRow>(
    `SELECT sermon_id, approved_description, description_sha256
     FROM sermon_description_semantic_eligibility
     ORDER BY sermon_id`
  );
  return result.rows.map(sourceFromRow);
}

function assertCurrentCorpus(
  current: readonly EligibleDescriptionSemanticSource[],
  planned: readonly EligibleDescriptionSemanticSource[]
): void {
  if (current.length !== planned.length) {
    throw new DescriptionSemanticPersistenceError(
      "eligible_corpus_changed",
      "The eligible description corpus changed before semantic persistence"
    );
  }
  for (let index = 0; index < current.length; index += 1) {
    const currentSource = current[index]!;
    const plannedSource = planned[index]!;
    if (
      currentSource.sermonId !== plannedSource.sermonId
      || currentSource.descriptionSha256 !== plannedSource.descriptionSha256
      || currentSource.approvedDescription !== plannedSource.approvedDescription
      || descriptionSha256(currentSource.approvedDescription) !== currentSource.descriptionSha256
    ) {
      throw new DescriptionSemanticPersistenceError(
        "eligible_corpus_changed",
        "The eligible description corpus changed before semantic persistence"
      );
    }
  }
}

function assertRelationshipPlan(plan: DescriptionSemanticBuildPlan): void {
  const sources = new Map(plan.sources.map((source) => [source.sermonId, source]));
  const identities = new Set<string>();
  const ranks = new Set<string>();
  for (const relationship of plan.relationships) {
    const source = sources.get(relationship.sourceSermonId);
    const neighbour = sources.get(relationship.neighbourSermonId);
    const identity = `${relationship.sourceSermonId}:${relationship.neighbourSermonId}`;
    const rank = `${relationship.sourceSermonId}:${relationship.rank}`;
    if (
      !source
      || !neighbour
      || source.sermonId === neighbour.sermonId
      || source.descriptionSha256 !== relationship.sourceDescriptionSha256
      || neighbour.descriptionSha256 !== relationship.neighbourDescriptionSha256
      || identities.has(identity)
      || ranks.has(rank)
    ) {
      throw new DescriptionSemanticPersistenceError(
        "relationship_integrity_failure",
        "The semantic relationship plan failed integrity validation"
      );
    }
    identities.add(identity);
    ranks.add(rank);
  }
}

export class PostgresDescriptionSemanticRepository implements DescriptionSemanticStore {
  constructor(private readonly pool: Pool) {}

  async listEligibleApprovedDescriptions(): Promise<EligibleDescriptionSemanticSource[]> {
    return eligibleSources(this.pool);
  }

  async replaceAllRelationships(plan: DescriptionSemanticBuildPlan): Promise<void> {
    assertRelationshipPlan(plan);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [1_397_176_899, 1_397_168_307]);
      assertCurrentCorpus(await eligibleSources(client), plan.sources);
      await client.query("DELETE FROM description_semantic_builds");
      const build = await client.query<{ id: string }>(
        `INSERT INTO description_semantic_builds (
           build_fingerprint, pipeline_fingerprint, pipeline_version, input_field,
           input_mode, query_prefix, document_prefix, text_normalisation,
           model_identifier, model_sha256, tokenizer_identifier, tokenizer_sha256,
           pooling, normalisation, truncation_max_tokens, dimensions,
           corpus_build_version, quality_policy_id, minimum_cosine_score,
           maximum_results, eligible_sermon_count, relationship_count, generated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
           $15, $16, $17, $18, $19, $20, $21, $22, $23
         ) RETURNING id`,
        [
          plan.buildFingerprint,
          plan.pipelineFingerprint,
          plan.pipeline.pipelineVersion,
          plan.pipeline.inputField,
          plan.pipeline.inputMode,
          plan.pipeline.queryPrefix,
          plan.pipeline.documentPrefix,
          plan.pipeline.textNormalisation,
          plan.pipeline.modelIdentifier,
          plan.pipeline.modelSha256,
          plan.pipeline.tokenizerIdentifier,
          plan.pipeline.tokenizerSha256,
          plan.pipeline.pooling,
          plan.pipeline.normalisation,
          plan.pipeline.truncationMaxTokens,
          plan.pipeline.dimensions,
          plan.policy.corpusBuildVersion,
          plan.policy.qualityPolicyId,
          plan.policy.minimumCosineScore,
          plan.policy.maximumResults,
          plan.sources.length,
          plan.relationships.length,
          plan.generatedAt
        ]
      );
      const buildId = build.rows[0]!.id;
      for (const relationship of plan.relationships) {
        const inserted = await client.query(
          `INSERT INTO description_semantic_relationships (
             build_id, source_sermon_id, neighbour_sermon_id,
             source_description_sha256, neighbour_description_sha256,
             rank, raw_cosine_score, generated_at
           )
           SELECT $1, source.sermon_id, neighbour.sermon_id,
                  source.description_sha256, neighbour.description_sha256,
                  $6, $7, $8
           FROM sermon_description_semantic_eligibility source
           CROSS JOIN sermon_description_semantic_eligibility neighbour
           WHERE source.sermon_id = $2
             AND neighbour.sermon_id = $3
             AND source.description_sha256 = $4
             AND neighbour.description_sha256 = $5`,
          [
            buildId,
            relationship.sourceSermonId,
            relationship.neighbourSermonId,
            relationship.sourceDescriptionSha256,
            relationship.neighbourDescriptionSha256,
            relationship.rank,
            relationship.rawCosineScore,
            relationship.generatedAt
          ]
        );
        if (inserted.rowCount !== 1) {
          throw new DescriptionSemanticPersistenceError(
            "eligible_corpus_changed",
            "The eligible description corpus changed during semantic persistence"
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listQualityApprovedRelated(input: {
    sourceSermonId: string;
    pipelineFingerprint: string;
    corpusBuildVersion: string;
    limit: number;
  }): Promise<DescriptionSemanticSelection[]> {
    const request = selectionRequestSchema.parse(input);
    const result = await this.pool.query<{
      neighbour_sermon_id: string;
      rank: number;
      raw_cosine_score: number;
    }>(
      `SELECT relationship.neighbour_sermon_id,
              relationship.rank,
              relationship.raw_cosine_score
       FROM description_semantic_relationships relationship
       JOIN description_semantic_builds build ON build.id = relationship.build_id
       JOIN sermon_description_semantic_eligibility source
         ON source.sermon_id = relationship.source_sermon_id
        AND source.description_sha256 = relationship.source_description_sha256
       JOIN sermon_description_semantic_eligibility neighbour
         ON neighbour.sermon_id = relationship.neighbour_sermon_id
        AND neighbour.description_sha256 = relationship.neighbour_description_sha256
       WHERE relationship.source_sermon_id = $1
         AND build.pipeline_fingerprint = $2
         AND build.corpus_build_version = $3
         AND build.quality_status = 'approved'
       ORDER BY relationship.rank, relationship.neighbour_sermon_id
       LIMIT $4`,
      [
        request.sourceSermonId,
        request.pipelineFingerprint,
        request.corpusBuildVersion,
        request.limit
      ]
    );
    return result.rows.map((row) => ({
      neighbourSermonId: row.neighbour_sermon_id,
      rank: row.rank,
      rawCosineScore: row.raw_cosine_score
    }));
  }
}

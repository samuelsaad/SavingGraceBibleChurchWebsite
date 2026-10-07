import { createHash } from "node:crypto";
import { z } from "zod";
import { descriptionSha256, descriptionSemanticPipelineFingerprint, descriptionSemanticPipelineSchema, exactFloat32Cosine, type DescriptionEmbeddingModel, type DescriptionSemanticPipeline } from "./description-related-themes";

export const acceptedSemanticEnvironmentSchema = z.enum(["local", "staging_public", "staging_protected"]);
export type AcceptedSemanticEnvironment = z.infer<typeof acceptedSemanticEnvironmentSchema>;
export const acceptedSemanticScopeSchema = z.enum(["d175_local_completed", "d175_completed"]);
export type AcceptedSemanticScope = z.infer<typeof acceptedSemanticScopeSchema>;
const sha = z.string().regex(/^[a-f0-9]{64}$/u);
export const acceptedSemanticSourceSchema = z.object({
  sermonId: z.uuid(), sourceIdentity: z.string().regex(/^(?:wordpress:[1-9][0-9]*|local:[a-f0-9-]{36})$/u),
  description: z.string().min(1).max(100_000), descriptionSha256: sha,
  language: z.string().min(2).max(20)
}).strict();
export type AcceptedSemanticSource = z.infer<typeof acceptedSemanticSourceSchema>;
export const acceptedSemanticMemberSchema = acceptedSemanticSourceSchema.omit({ description: true }).extend({
  state: z.enum(["indexed", "unsupported_language", "duplicate_source", "conflicting_source", "input_too_long", "unusable_input"])
}).strict();
export type AcceptedSemanticMember = z.infer<typeof acceptedSemanticMemberSchema>;
export const acceptedSemanticRelationshipSchema = z.object({ sourceIdentity: z.string(), neighbourIdentity: z.string(), rank: z.number().int().min(1).max(5), score: z.number().finite().min(-1).max(1) }).strict();
export const acceptedSemanticPlanSchema = z.object({
  schemaVersion: z.literal("accepted-description-index-v2"), environment: acceptedSemanticEnvironmentSchema,
  scope: acceptedSemanticScopeSchema, pipeline: descriptionSemanticPipelineSchema,
  pipelineFingerprint: sha, corpusSha256: sha, buildFingerprint: sha,
  sources: z.array(acceptedSemanticMemberSchema), relationships: z.array(acceptedSemanticRelationshipSchema),
  generatedAt: z.iso.datetime()
}).strict();
export type AcceptedDescriptionIndexPlan = z.infer<typeof acceptedSemanticPlanSchema>;
export interface AcceptedDescriptionVectorCache {
  get(pipelineFingerprint: string, descriptionHash: string): Promise<Float32Array | null>;
  put(pipelineFingerprint: string, descriptionHash: string, vector: Float32Array): Promise<void>;
}
function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  return value;
}
export function semanticHash(value: unknown): string { return createHash("sha256").update(JSON.stringify(canonical(value)), "utf8").digest("hex"); }
export function assertAcceptedSemanticTarget(environment: AcceptedSemanticEnvironment, scope: AcceptedSemanticScope): void {
  acceptedSemanticEnvironmentSchema.parse(environment); acceptedSemanticScopeSchema.parse(scope);
  if (environment !== "local" && scope !== "d175_completed") throw Error("semantic_environment_scope_mismatch");
}
export function acceptedCorpusFingerprint(sources: readonly AcceptedSemanticSource[]): string {
  const validated = sources.map(source => acceptedSemanticSourceSchema.parse(source)).sort((a,b) => a.sermonId.localeCompare(b.sermonId));
  const ids = new Set<string>();
  for (const source of validated) {
    if (ids.has(source.sermonId) || descriptionSha256(source.description) !== source.descriptionSha256) throw Error("semantic_source_integrity_failure");
    ids.add(source.sermonId);
  }
  return semanticHash(validated.map(({ description: _description, ...source }) => source));
}
export function validateSemanticVector(vector: Float32Array, dimensions: number): Float32Array {
  if (!(vector instanceof Float32Array) || vector.length !== dimensions) throw Error("semantic_vector_dimensions_invalid");
  let norm = 0;
  for (const value of vector) { if (!Number.isFinite(value)) throw Error("semantic_vector_nonfinite"); norm += value * value; }
  if (!Number.isFinite(norm) || norm <= 0 || Math.abs(Math.sqrt(norm) - 1) > 0.0001) throw Error("semantic_vector_unusable");
  return vector;
}
export function acceptedBuildFingerprint(plan: Omit<AcceptedDescriptionIndexPlan, "buildFingerprint" | "generatedAt">): string {
  return semanticHash(plan);
}
export function validateAcceptedIndexPlan(input: AcceptedDescriptionIndexPlan): AcceptedDescriptionIndexPlan {
  const plan = acceptedSemanticPlanSchema.parse(input);
  assertAcceptedSemanticTarget(plan.environment, plan.scope);
  if (plan.pipeline.pipelineVersion !== "accepted-description-semantic-v2" || plan.pipeline.inputField !== "accepted_description" || descriptionSemanticPipelineFingerprint(plan.pipeline) !== plan.pipelineFingerprint) throw Error("semantic_pipeline_mismatch");
  const {buildFingerprint, generatedAt: _time, ...body} = plan;
  if (acceptedBuildFingerprint(body) !== buildFingerprint) throw Error("semantic_build_integrity_failure");
  const indexed = new Set(plan.sources.filter(s=>s.state === "indexed").map(s=>s.sourceIdentity));
  if (indexed.size !== plan.sources.filter(s=>s.state === "indexed").length) throw Error("semantic_duplicate_source");
  if(new Set(plan.sources.map(s=>s.sermonId)).size!==plan.sources.length||plan.sources.some(s=>s.state==="indexed"&&s.language!=="en"))throw Error("semantic_member_integrity_failure");
  const pairs = new Set<string>(); const ranks = new Set<string>();
  for (const row of plan.relationships) {
    const pair = `${row.sourceIdentity}|${row.neighbourIdentity}`; const rank = `${row.sourceIdentity}|${row.rank}`;
    if (!indexed.has(row.sourceIdentity) || !indexed.has(row.neighbourIdentity) || row.sourceIdentity === row.neighbourIdentity || pairs.has(pair) || ranks.has(rank)) throw Error("semantic_relationship_integrity_failure");
    pairs.add(pair); ranks.add(rank);
  }
  return plan;
}
export function rankAcceptedVectors(vectors:ReadonlyMap<string,Float32Array>):AcceptedDescriptionIndexPlan["relationships"] {
  const relationships:AcceptedDescriptionIndexPlan["relationships"]=[];
  const identities=[...vectors.keys()].sort();
  for(const sourceIdentity of identities) {
    const rows=identities.filter(id=>id!==sourceIdentity).map(neighbourIdentity=>({sourceIdentity,neighbourIdentity,score:exactFloat32Cosine(vectors.get(sourceIdentity)!,vectors.get(neighbourIdentity)!)}))
      .sort((a,b)=>b.score-a.score || a.neighbourIdentity.localeCompare(b.neighbourIdentity)).slice(0,5);
    rows.forEach((row,index)=>relationships.push({...row,rank:index+1}));
  }
  return relationships;
}
/** Top-five candidates are evaluation material, not a calibrated visitor policy. */
export async function buildAcceptedDescriptionIndex(input: {
  environment: AcceptedSemanticEnvironment; scope: AcceptedSemanticScope; sources: readonly AcceptedSemanticSource[];
  model: DescriptionEmbeddingModel; pipeline: DescriptionSemanticPipeline; cache: AcceptedDescriptionVectorCache;
  generatedAt?: Date; onProgress?: (completed: number, total: number, state: AcceptedSemanticMember["state"]) => Promise<void> | void;
}): Promise<AcceptedDescriptionIndexPlan> {
  assertAcceptedSemanticTarget(input.environment, input.scope);
  const pipeline = descriptionSemanticPipelineSchema.parse(input.pipeline);
  if (pipeline.pipelineVersion !== "accepted-description-semantic-v2") throw Error("semantic_accepted_pipeline_required");
  const corpusSha256 = acceptedCorpusFingerprint(input.sources);
  const ordered = [...input.sources].sort((a,b)=>a.sermonId.localeCompare(b.sermonId));
  const pipelineFingerprint = descriptionSemanticPipelineFingerprint(pipeline);
  const groups = new Map<string, AcceptedSemanticSource[]>();
  for (const source of ordered) groups.set(source.sourceIdentity,[...(groups.get(source.sourceIdentity) ?? []),source]);
  const sources: AcceptedSemanticMember[]=[]; const vectors = new Map<string,Float32Array>();
  for (const source of ordered) {
    const {description,...member}=source;
    const group=groups.get(source.sourceIdentity)!;
    let state: AcceptedSemanticMember["state"]="indexed";
    if (new Set(group.map(s=>s.descriptionSha256)).size>1) state="conflicting_source";
    else if (group[0]!.sermonId!==source.sermonId) state="duplicate_source";
    else if (source.language!=="en") state="unsupported_language";
    else if (!description.trim()) state="unusable_input";
    if (state==="indexed") {
      let vector=await input.cache.get(pipelineFingerprint,source.descriptionSha256);
      if (!vector) {
        try {
          const produced=await input.model.embedApprovedDescriptions([description],pipeline);
          if(produced.length!==1)throw Error("semantic_vector_count_invalid");
          vector=validateSemanticVector(produced[0]!,pipeline.dimensions);
          await input.cache.put(pipelineFingerprint,source.descriptionSha256,vector);
        } catch(error) {
          if(error && typeof error==="object" && "code" in error && error.code==="input_too_long") state="input_too_long";
          else throw error;
        }
      }
      if(vector) vectors.set(source.sourceIdentity,validateSemanticVector(vector,pipeline.dimensions));
    }
    sources.push({...member,state}); await input.onProgress?.(sources.length,ordered.length,state);
  }
  const relationships=rankAcceptedVectors(vectors);
  const body={schemaVersion:"accepted-description-index-v2" as const,environment:input.environment,scope:input.scope,pipeline,pipelineFingerprint,corpusSha256,sources,relationships};
  return validateAcceptedIndexPlan({...body,buildFingerprint:acceptedBuildFingerprint(body),generatedAt:(input.generatedAt??new Date()).toISOString()});
}

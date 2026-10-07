import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { d175PortableSummaryNamespace, d175SourceNamespace } from "../../domain/sermonaudio-completion";
import { frontendSermonEligibilitySql } from "../queries/public-sermons";
import {
  acceptedCorpusFingerprint, acceptedSemanticPlanSchema, acceptedSemanticSourceSchema, assertAcceptedSemanticTarget,
  buildAcceptedDescriptionIndex, rankAcceptedVectors, semanticHash, validateAcceptedIndexPlan, validateSemanticVector,
  type AcceptedDescriptionIndexPlan, type AcceptedDescriptionVectorCache, type AcceptedSemanticEnvironment,
  type AcceptedSemanticScope, type AcceptedSemanticSource
} from "../../semantic/accepted-description-index";

const hash = z.string().regex(/^[a-f0-9]{64}$/u);
export const acceptedSemanticSyncPacketSchema = z.object({ schemaVersion:z.literal("accepted-semantic-sync-v1"), plan:acceptedSemanticPlanSchema,
  vectors:z.array(z.object({descriptionSha256:hash, vector:z.array(z.number().finite()).min(1).max(4096)}).strict()) }).strict();
export type AcceptedSemanticSyncPacket=z.infer<typeof acceptedSemanticSyncPacketSchema>;
export function parseAcceptedSemanticSyncPacket(input:unknown):AcceptedSemanticSyncPacket {
  const packet=acceptedSemanticSyncPacketSchema.parse(input);validateAcceptedIndexPlan(packet.plan);
  const expected=[...new Set(packet.plan.sources.filter(s=>s.state==="indexed").map(s=>s.descriptionSha256))].sort();
  const received=packet.vectors.map(v=>v.descriptionSha256).sort();
  if(JSON.stringify(expected)!==JSON.stringify(received))throw Error("semantic_sync_vector_scope_mismatch");
  for(const row of packet.vectors)validateSemanticVector(new Float32Array(row.vector),packet.plan.pipeline.dimensions);
  return packet;
}
export interface AcceptedSemanticSelection { neighbourSermonId:string; rank:number; rawCosineScore:number }
/** Caller supplies an already guarded local/staging connection; scope is never request input. */
export class PostgresAcceptedSemanticRepository implements AcceptedDescriptionVectorCache {
  constructor(private readonly pool:Pool, readonly target:{environment:AcceptedSemanticEnvironment;scope:AcceptedSemanticScope}) {
    assertAcceptedSemanticTarget(target.environment,target.scope);
  }
  async listCurrentSources(client:Pool|PoolClient=this.pool):Promise<AcceptedSemanticSource[]> {
    const result=await client.query<{
      sermon_id:string;source_identity:string;description:string;description_sha256:string;language:string
    }>(`SELECT s.id::text AS sermon_id,
      CASE WHEN s.source_wordpress_id IS NOT NULL THEN 'wordpress:'||s.source_wordpress_id::text ELSE 'local:'||s.id::text END AS source_identity,
      s.summary AS description,encode(digest(convert_to(s.summary,'UTF8'),'sha256'),'hex') AS description_sha256,
      COALESCE((SELECT payload->>'language' FROM sermon_extensions WHERE sermon_id=s.id
        AND namespace IN ('${d175SourceNamespace}','${d175PortableSummaryNamespace}')
        ORDER BY CASE WHEN namespace='${d175SourceNamespace}' THEN 0 ELSE 1 END LIMIT 1),'en') AS language
      FROM sermons s WHERE ${frontendSermonEligibilitySql("s",this.target.scope)}
        AND s.summary IS NOT NULL AND length(trim(s.summary))>0 ORDER BY s.id`);
    return result.rows.map(row=>acceptedSemanticSourceSchema.parse({sermonId:row.sermon_id,sourceIdentity:row.source_identity,
      description:row.description,descriptionSha256:row.description_sha256,language:row.language}));
  }
  async get(pipelineFingerprint:string,descriptionHash:string):Promise<Float32Array|null> {
    hash.parse(pipelineFingerprint);hash.parse(descriptionHash);
    const row=(await this.pool.query<{vector:number[];dimensions:number}>(`SELECT vector,dimensions FROM accepted_description_semantic_vectors WHERE pipeline_fingerprint=$1 AND description_sha256=$2`,[pipelineFingerprint,descriptionHash])).rows[0];
    return row?validateSemanticVector(new Float32Array(row.vector),row.dimensions):null;
  }
  async put(pipelineFingerprint:string,descriptionHash:string,vector:Float32Array):Promise<void> {
    hash.parse(pipelineFingerprint);hash.parse(descriptionHash);validateSemanticVector(vector,vector.length);
    await this.pool.query(`INSERT INTO accepted_description_semantic_vectors(pipeline_fingerprint,description_sha256,dimensions,vector)
      VALUES($1,$2,$3,$4::real[]) ON CONFLICT DO NOTHING`,[pipelineFingerprint,descriptionHash,vector.length,Array.from(vector)]);
    const saved=await this.get(pipelineFingerprint,descriptionHash);
    if(!saved||saved.length!==vector.length||saved.some((value,index)=>value!==vector[index]))throw Error("semantic_cached_vector_conflict");
  }
  async activate(input:AcceptedDescriptionIndexPlan):Promise<"created"|"unchanged"> {
    const plan=validateAcceptedIndexPlan(input);
    if(plan.environment!==this.target.environment||plan.scope!==this.target.scope)throw Error("semantic_environment_scope_mismatch");
    const client=await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`accepted-semantics:${plan.environment}:${plan.scope}`]);
      const current=await this.listCurrentSources(client);
      if(acceptedCorpusFingerprint(current)!==plan.corpusSha256)throw Error("semantic_eligible_corpus_changed");
      if(current.length!==plan.sources.length||current.some(source=>!plan.sources.some(member=>member.sermonId===source.sermonId&&member.sourceIdentity===source.sourceIdentity&&member.descriptionSha256===source.descriptionSha256&&member.language===source.language)))throw Error("semantic_member_integrity_failure");
      const verifiedVectors=new Map<string,Float32Array>();
      for(const member of plan.sources.filter(source=>source.state==="indexed")) {
        const cached=(await client.query<{vector:number[]}>("SELECT vector FROM accepted_description_semantic_vectors WHERE pipeline_fingerprint=$1 AND description_sha256=$2",[plan.pipelineFingerprint,member.descriptionSha256])).rows[0];
        if(!cached)throw Error("semantic_index_cache_missing");
        verifiedVectors.set(member.sourceIdentity,validateSemanticVector(new Float32Array(cached.vector),plan.pipeline.dimensions));
      }
      if(semanticHash(rankAcceptedVectors(verifiedVectors))!==semanticHash(plan.relationships))throw Error("semantic_relationship_score_mismatch");
      const active=(await client.query<{build_fingerprint:string}>("SELECT build_fingerprint FROM accepted_description_semantic_active WHERE environment=$1 AND frontend_scope=$2",[plan.environment,plan.scope])).rows[0];
      if(active?.build_fingerprint===plan.buildFingerprint){await client.query("COMMIT");return "unchanged";}
      await client.query(`INSERT INTO accepted_description_semantic_builds(build_fingerprint,environment,frontend_scope,corpus_sha256,pipeline_fingerprint,plan,generated_at)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT DO NOTHING`,[plan.buildFingerprint,plan.environment,plan.scope,plan.corpusSha256,plan.pipelineFingerprint,JSON.stringify(plan),plan.generatedAt]);
      for(const member of plan.sources) await client.query(`INSERT INTO accepted_description_semantic_members(build_fingerprint,sermon_id,source_identity,description_sha256,state)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[plan.buildFingerprint,member.sermonId,member.sourceIdentity,member.descriptionSha256,member.state]);
      await client.query(`INSERT INTO accepted_description_semantic_active(environment,frontend_scope,build_fingerprint) VALUES($1,$2,$3)
        ON CONFLICT(environment,frontend_scope) DO UPDATE SET build_fingerprint=EXCLUDED.build_fingerprint,activated_at=now()
        WHERE accepted_description_semantic_active.build_fingerprint<>EXCLUDED.build_fingerprint`,[plan.environment,plan.scope,plan.buildFingerprint]);
      await client.query("COMMIT");return "created";
    }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
  }
  async activePlan():Promise<AcceptedDescriptionIndexPlan|null> {
    const row=(await this.pool.query<{plan:unknown}>(`SELECT b.plan FROM accepted_description_semantic_active a
      JOIN accepted_description_semantic_builds b USING(build_fingerprint,environment,frontend_scope)
      WHERE a.environment=$1 AND a.frontend_scope=$2`,[this.target.environment,this.target.scope])).rows[0];
    if(!row)return null;
    const plan=validateAcceptedIndexPlan(row.plan as AcceptedDescriptionIndexPlan);
    if(plan.environment!==this.target.environment||plan.scope!==this.target.scope)throw Error("semantic_environment_scope_mismatch");
    return plan;
  }
  /** Evaluation reader only. No score or quality approval is a publication grant. */
  async listPreviewRelated(anchorId:string):Promise<AcceptedSemanticSelection[]> {
    z.uuid().parse(anchorId);
    const plan=await this.activePlan();if(!plan)return [];
    const current=new Map((await this.listCurrentSources()).map(source=>[source.sermonId,source]));
    const anchor=plan.sources.find(source=>source.sermonId===anchorId&&source.state==="indexed");
    const valid=(member:typeof anchor)=>!!member&&current.get(member.sermonId)?.descriptionSha256===member.descriptionSha256&&current.get(member.sermonId)?.sourceIdentity===member.sourceIdentity&&current.get(member.sermonId)?.language===member.language;
    if(!valid(anchor))return [];
    return plan.relationships.filter(row=>row.sourceIdentity===anchor!.sourceIdentity).flatMap(row=>{
      const member=plan.sources.find(source=>source.sourceIdentity===row.neighbourIdentity&&source.state==="indexed");
      return valid(member)?[{neighbourSermonId:member!.sermonId,rank:row.rank,rawCosineScore:row.score}]:[];
    }).sort((a,b)=>a.rank-b.rank||a.neighbourSermonId.localeCompare(b.neighbourSermonId));
  }
  async exportPacket(allowedSourceIdentities?:readonly string[]):Promise<AcceptedSemanticSyncPacket> {
    let plan=await this.activePlan();if(!plan)throw Error("semantic_active_index_missing");
    const current=await this.listCurrentSources();
    if(acceptedCorpusFingerprint(current)!==plan.corpusSha256)throw Error("semantic_export_corpus_changed");
    if(allowedSourceIdentities){
      const allowed=new Set(allowedSourceIdentities);
      if(allowed.size!==allowedSourceIdentities.length||[...allowed].some(id=>!current.some(source=>source.sourceIdentity===id)))throw Error("semantic_export_scope_invalid");
      const overlong=new Set(plan.sources.filter(s=>s.state==="input_too_long").map(s=>s.descriptionSha256));
      plan=await buildAcceptedDescriptionIndex({...this.target,sources:current.filter(s=>allowed.has(s.sourceIdentity)),pipeline:plan.pipeline,cache:this,
        model:{async embedApprovedDescriptions(descriptions){if(descriptions.every(d=>overlong.has(createDescriptionHash(d))))throw Object.assign(Error("Complete description exceeds model limit"),{code:"input_too_long"});throw Error("semantic_export_missing_current_vector");}}});
    }
    const vectors:AcceptedSemanticSyncPacket["vectors"]=[];
    for(const descriptionSha256 of [...new Set(plan.sources.filter(s=>s.state==="indexed").map(s=>s.descriptionSha256))].sort()) {
      const vector=await this.get(plan.pipelineFingerprint,descriptionSha256);if(!vector)throw Error("semantic_index_cache_missing");
      vectors.push({descriptionSha256,vector:Array.from(vector)});
    }
    return parseAcceptedSemanticSyncPacket({schemaVersion:"accepted-semantic-sync-v1",plan,vectors});
  }
  /** Re-rank inside the destination corpus. Source UUIDs never create records. */
  async importPacket(input:AcceptedSemanticSyncPacket):Promise<{outcome:"created"|"unchanged";plan:AcceptedDescriptionIndexPlan}> {
    const packet=parseAcceptedSemanticSyncPacket(input);
    if(packet.plan.environment!==this.target.environment||packet.plan.scope!==this.target.scope)throw Error("semantic_environment_scope_mismatch");
    const current=await this.listCurrentSources();
    const members=new Map(packet.plan.sources.filter(s=>s.state==="indexed").map(s=>[s.sourceIdentity,s]));
    const vectors=new Map(packet.vectors.map(row=>[row.descriptionSha256,row.vector]));
    const projection=(rows:readonly {sourceIdentity:string;descriptionSha256:string;language:string}[])=>rows.map(({sourceIdentity,descriptionSha256,language})=>({sourceIdentity,descriptionSha256,language})).sort((a,b)=>a.sourceIdentity.localeCompare(b.sourceIdentity));
    if(semanticHash(projection(current))!==semanticHash(projection(packet.plan.sources)))throw Error("semantic_sync_membership_conflict");
    const pending:Array<{hash:string;vector:Float32Array}>=[];
    for(const source of current) {
      const member=members.get(source.sourceIdentity);
      const original=packet.plan.sources.find(s=>s.sourceIdentity===source.sourceIdentity);
      if(original?.descriptionSha256!==source.descriptionSha256||original.language!==source.language)throw Error("semantic_sync_source_conflict");
      if(!member)continue;
      const vector=vectors.get(source.descriptionSha256);if(!vector)throw Error("semantic_sync_vector_missing");
      pending.push({hash:source.descriptionSha256,vector:validateSemanticVector(new Float32Array(vector),packet.plan.pipeline.dimensions)});
    }
    // Complete identity/hash/language/vector preflight precedes every cache write.
    for(const item of pending)await this.put(packet.plan.pipelineFingerprint,item.hash,item.vector);
    const excluded=new Map(packet.plan.sources.filter(s=>s.state==="input_too_long").map(s=>[s.descriptionSha256,s]));
    const plan=await buildAcceptedDescriptionIndex({...this.target,sources:current,pipeline:packet.plan.pipeline,cache:this,
      model:{async embedApprovedDescriptions(descriptions){if(descriptions.every(d=>excluded.has(createDescriptionHash(d))))throw Object.assign(Error("Complete description exceeds model limit"),{code:"input_too_long"});throw Error("semantic_sync_missing_current_vector");}}});
    return {outcome:await this.activate(plan),plan};
  }
}

import { descriptionSha256 as createDescriptionHash } from "../../semantic/description-related-themes";

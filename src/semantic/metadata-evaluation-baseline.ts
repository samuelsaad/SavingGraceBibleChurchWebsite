import type { Pool } from "pg";
import { z } from "zod";
import { buildRelatedPublishedSermonsQuery, frontendSermonEligibilitySql } from "../server/queries/public-sermons";
import { PostgresAcceptedSemanticRepository } from "../server/repositories/postgres-accepted-semantic-repository";
import { acceptedCorpusFingerprint, assertAcceptedSemanticTarget, type AcceptedSemanticEnvironment, type AcceptedSemanticScope, type AcceptedSemanticSource } from "./accepted-description-index";

export interface MetadataEvaluationCandidate { anchorId:string;candidateId:string;rank:number }
/** Reuses the visitor baseline's exact weights, predicates, date/ID tie-break and
 * limit. Only the expensive eligibility guards and unused card hydration differ.
 * This is private evaluation tooling, never a visitor query or embedding input. */
export function buildFrozenMetadataEvaluationQuery(input:{scope:AcceptedSemanticScope;eligibleIds:readonly string[];anchorIds:readonly string[];limit:number}):{text:string;values:unknown[]} {
  const ids=z.array(z.uuid()).parse(input.eligibleIds),anchors=z.array(z.uuid()).parse(input.anchorIds);
  z.number().int().min(1).max(5).parse(input.limit);
  if(new Set(ids).size!==ids.length||new Set(anchors).size!==anchors.length||anchors.some(id=>!ids.includes(id)))throw Error("metadata_evaluation_identity_scope_invalid");
  const original=buildRelatedPublishedSermonsQuery("00000000-0000-4000-8000-000000000001",input.limit,input.scope);
  const projection="\n      SELECT s.id, s.title, s.slug,";
  const tail="\n      FROM ranked s\n";
  const projectionAt=original.text.indexOf(projection),tailAt=original.text.lastIndexOf(tail);
  if(projectionAt<0||tailAt<=projectionAt)throw Error("metadata_evaluation_baseline_shape_changed");
  let ranked=original.text.slice(0,projectionAt)+"\n      SELECT s.id, s.related_score, s.service_date"+original.text.slice(tailAt);
  for(const alias of ["sermons","candidate"] as const){
    const guard=frontendSermonEligibilitySql(alias,input.scope);
    if(!ranked.includes(guard))throw Error("metadata_evaluation_baseline_guard_changed");
    ranked=ranked.replace(guard,`${alias}.id = ANY($3::uuid[])`);
  }
  if(!ranked.includes("id = $1::uuid"))throw Error("metadata_evaluation_baseline_anchor_changed");
  ranked=ranked.replace("id = $1::uuid","id = requested_anchor.id");
  return {text:`SELECT requested_anchor.id::text AS anchor_id,selected.id::text AS candidate_id,
    row_number() OVER(PARTITION BY requested_anchor.id ORDER BY selected.related_score DESC,selected.service_date DESC,selected.id)::integer AS rank
    FROM unnest($1::uuid[]) AS requested_anchor(id)
    CROSS JOIN LATERAL (${ranked}) AS selected
    ORDER BY requested_anchor.id,rank`,values:[anchors,input.limit,ids]};
}

/** Freeze eligibility once under a stable read-only snapshot, then calculate the
 * unchanged metadata baseline for every requested anchor in one server query. */
export async function collectMetadataEvaluationBaseline(pool:Pool,input:{
  environment:AcceptedSemanticEnvironment;scope:AcceptedSemanticScope;
  expectedSources:readonly AcceptedSemanticSource[];anchorIds:readonly string[];limit?:number;
}):Promise<{candidates:MetadataEvaluationCandidate[];eligibleCount:number;elapsedMs:number}> {
  assertAcceptedSemanticTarget(input.environment,input.scope);
  const started=Date.now(),client=await pool.connect();
  try{
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const repository=new PostgresAcceptedSemanticRepository(pool,{environment:input.environment,scope:input.scope});
    const current=await repository.listCurrentSources(client);
    if(acceptedCorpusFingerprint(current)!==acceptedCorpusFingerprint(input.expectedSources))throw Error("metadata_evaluation_corpus_changed");
    const statement=buildFrozenMetadataEvaluationQuery({scope:input.scope,eligibleIds:current.map(s=>s.sermonId),anchorIds:input.anchorIds,limit:input.limit??3});
    const result=await client.query<{anchor_id:string;candidate_id:string;rank:number}>(statement.text,statement.values);
    await client.query("COMMIT");
    return {candidates:result.rows.map(row=>({anchorId:row.anchor_id,candidateId:row.candidate_id,rank:row.rank})),eligibleCount:current.length,elapsedMs:Date.now()-started};
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
}

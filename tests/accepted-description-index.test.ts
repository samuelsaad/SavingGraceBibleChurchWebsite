import { describe,expect,it } from "vitest";
import { acceptedCorpusFingerprint,buildAcceptedDescriptionIndex,validateSemanticVector,validateAcceptedIndexPlan,type AcceptedSemanticSource,type AcceptedDescriptionVectorCache } from "../src/semantic/accepted-description-index";
import { descriptionSha256,type DescriptionSemanticPipeline } from "../src/semantic/description-related-themes";
import { acceptedDescriptionSemanticPipeline,assertCompleteAcceptedDescriptionInput,loadApprovedLocalModelManifest } from "../src/semantic/local-description-embedding-model";
import { parseAcceptedSemanticSyncPacket,PostgresAcceptedSemanticRepository } from "../src/server/repositories/postgres-accepted-semantic-repository";
import type {Pool} from "pg";

const pipeline:DescriptionSemanticPipeline={pipelineVersion:"accepted-description-semantic-v2",inputField:"accepted_description",inputMode:"symmetric_document",queryPrefix:null,documentPrefix:null,textNormalisation:"exact_utf8",modelIdentifier:"synthetic",modelRevision:"0".repeat(40),modelSha256:"1".repeat(64),tokenizerIdentifier:"synthetic-tokenizer",tokenizerSha256:"2".repeat(64),runtimeIdentifier:"synthetic-runtime",runtimeVersion:"1",runtimePackageIntegrity:`sha512-${"A".repeat(86)}==`,pooling:"cls",normalisation:"l2_float32",truncationMaxTokens:512,dimensions:3};
function source(n:number,overrides:Partial<AcceptedSemanticSource>={}):AcceptedSemanticSource {
 const description=`Entirely synthetic description number ${n} for anonymous mechanical similarity tests. No real sermon material is used.`;
 return {sermonId:`a0000000-0000-4000-8000-${String(n).padStart(12,"0")}`,sourceIdentity:`wordpress:${n}`,description,descriptionSha256:descriptionSha256(description),language:"en",...overrides};
}
function harness(){
 const map=new Map<string,Float32Array>();const calls:string[][]=[];
 const cache:AcceptedDescriptionVectorCache={async get(p,h){return map.get(`${p}:${h}`)??null;},async put(p,h,v){map.set(`${p}:${h}`,v);}};
 const model={async embedApprovedDescriptions(text:readonly string[]){calls.push([...text]);return text.map(()=>new Float32Array([1,0,0]));}};
 return {cache,model,calls,map};
}
const target={environment:"local" as const,scope:"d175_local_completed" as const,pipeline};
describe("accepted description semantic v2 index",()=>{
 it("uses complete descriptions only and caches by model/pipeline plus exact hash",async()=>{
  const h=harness();const sources=[source(2),source(1)];
  const a=await buildAcceptedDescriptionIndex({...target,...h,sources});
  const b=await buildAcceptedDescriptionIndex({...target,...h,sources,generatedAt:new Date("2030-01-01")});
  expect(h.calls).toEqual([[sources[1]!.description],[sources[0]!.description]]);
  expect(a.buildFingerprint).toBe(b.buildFingerprint);expect(a.relationships).toEqual(b.relationships);
  expect(JSON.stringify(a)).not.toContain(sources[0]!.description);
 });
 it("resumes after an interrupted per-record checkpoint without repeating inference",async()=>{
  const h=harness();let progress=0;
  await expect(buildAcceptedDescriptionIndex({...target,...h,sources:[source(1),source(2)],onProgress(){if(++progress===1)throw Error("synthetic-interruption");}})).rejects.toThrow("synthetic-interruption");
  const plan=await buildAcceptedDescriptionIndex({...target,...h,sources:[source(1),source(2)]});
  expect(h.calls).toHaveLength(2);expect(plan.sources.every(s=>s.state==="indexed")).toBe(true);
 });
 it("excludes unsupported language and deduplicates canonical source identities",async()=>{
  const a=source(1);const h=harness();
  const plan=await buildAcceptedDescriptionIndex({...target,...h,sources:[a,source(2,{sourceIdentity:a.sourceIdentity,description:a.description,descriptionSha256:a.descriptionSha256}),source(3,{language:"ar"})]});
  expect(plan.sources.map(s=>s.state)).toEqual(["indexed","duplicate_source","unsupported_language"]);
  expect(plan.relationships).toEqual([]);expect(h.calls).toHaveLength(1);
 });
 it("excludes conflicting descriptions for the same preserved source instead of guessing",async()=>{
  const h=harness();const plan=await buildAcceptedDescriptionIndex({...target,...h,sources:[source(1),source(2,{sourceIdentity:"wordpress:1"})]});
  expect(plan.sources.map(s=>s.state)).toEqual(["conflicting_source","conflicting_source"]);expect(h.calls).toEqual([]);
 });
 it("does not silently truncate long input and continues unrelated records",async()=>{
  const h=harness();const model={async embedApprovedDescriptions(text:readonly string[]){if(text[0]===source(1).description)throw Object.assign(Error("synthetic token-limit"),{code:"input_too_long"});return [new Float32Array([1,0,0])];}};
  const plan=await buildAcceptedDescriptionIndex({...target,cache:h.cache,model,sources:[source(1),source(2)]});
  expect(plan.sources.map(s=>s.state)).toEqual(["input_too_long","indexed"]);expect(plan.relationships).toEqual([]);
 });
 it("keeps evaluation top-five candidates separate from any released cutoff",async()=>{
  const h=harness();const plan=await buildAcceptedDescriptionIndex({...target,...h,sources:Array.from({length:8},(_,i)=>source(i+1))});
  const rows=plan.relationships.filter(r=>r.sourceIdentity==="wordpress:1");
  expect(rows.map(r=>r.neighbourIdentity)).toEqual(["wordpress:2","wordpress:3","wordpress:4","wordpress:5","wordpress:6"]);
  expect(plan.relationships.every(r=>r.sourceIdentity!==r.neighbourIdentity)).toBe(true);
  expect(JSON.stringify(plan)).not.toMatch(/minimumCosineScore|qualityApproved|approvedBy/);
 });
 it("fails closed on stale input hashes, duplicate IDs, bad vectors and pipeline changes",async()=>{
  expect(()=>acceptedCorpusFingerprint([source(1,{descriptionSha256:"0".repeat(64)})])).toThrow();
  expect(()=>acceptedCorpusFingerprint([source(1),source(1)])).toThrow();
  for(const vector of [new Float32Array([]),new Float32Array([0,0,0]),new Float32Array([NaN,0,0]),new Float32Array([Infinity,0,0]),new Float32Array([2,0,0])])expect(()=>validateSemanticVector(vector,3)).toThrow();
  const h=harness();const plan=await buildAcceptedDescriptionIndex({...target,...h,sources:[source(1)]});
  expect(()=>validateAcceptedIndexPlan({...plan,pipelineFingerprint:"0".repeat(64)})).toThrow();
  expect(()=>validateAcceptedIndexPlan({...plan,environment:"staging_public"})).toThrow();
  const other=await buildAcceptedDescriptionIndex({...target,...h,sources:[source(1)],pipeline:{...pipeline,modelRevision:"3".repeat(40)}});
  expect(other.pipelineFingerprint).not.toBe(plan.pipelineFingerprint);expect(h.calls).toHaveLength(2);
 });
 it("uses distinct fingerprints for environment/scope without changing raw cosine ranking",async()=>{
  const h=harness();const sources=[source(1),source(2)];
  const local=await buildAcceptedDescriptionIndex({...target,...h,sources});
  const remote=await buildAcceptedDescriptionIndex({...target,...h,sources,environment:"staging_protected",scope:"d175_completed"});
  expect(remote.buildFingerprint).not.toBe(local.buildFingerprint);expect(remote.relationships).toEqual(local.relationships);
 });
 it("retains a truthful separately versioned accepted pipeline for the existing locked local model",async()=>{
  const manifest=await loadApprovedLocalModelManifest();const accepted=acceptedDescriptionSemanticPipeline(manifest);
  expect(accepted).toMatchObject({pipelineVersion:"accepted-description-semantic-v2",inputField:"accepted_description",dimensions:384,pooling:"cls",truncationMaxTokens:512});
 });
 it("checks every complete token sequence including special tokens before inference",()=>{
  const received:string[]=[];expect(()=>assertCompleteAcceptedDescriptionInput(["complete synthetic text"],512,text=>{received.push(text);return 512;})).not.toThrow();
  expect(received).toEqual(["complete synthetic text"]);
  expect(()=>assertCompleteAcceptedDescriptionInput(["synthetic long input"],512,()=>513)).toThrow(/no truncated embedding/);
  expect(()=>assertCompleteAcceptedDescriptionInput(["synthetic"],512,undefined)).toThrow(/unavailable/);
  expect(()=>assertCompleteAcceptedDescriptionInput(["synthetic"],512,()=>NaN)).toThrow(/invalid token count/);
 });
 it("rejects sync vectors outside the exact indexed set and checks excluded-language membership before writes",async()=>{
  const h=harness(),sources=[source(1),source(2,{language:"ar"})];
  const plan=await buildAcceptedDescriptionIndex({...target,...h,sources});
  const packet={schemaVersion:"accepted-semantic-sync-v1" as const,plan,vectors:[{descriptionSha256:sources[0]!.descriptionSha256,vector:[1,0,0]}]};
  expect(parseAcceptedSemanticSyncPacket(packet)).toEqual(packet);
  expect(()=>parseAcceptedSemanticSyncPacket({...packet,vectors:[...packet.vectors,{descriptionSha256:sources[1]!.descriptionSha256,vector:[1,0,0]}]})).toThrow(/scope_mismatch/);
  expect(()=>parseAcceptedSemanticSyncPacket({...packet,vectors:[]})).toThrow(/scope_mismatch/);
  const changed=[sources[0]!,source(2,{language:"ar",description:"Changed anonymous text",descriptionSha256:descriptionSha256("Changed anonymous text")})];
  let writes=0;
  class FixtureRepository extends PostgresAcceptedSemanticRepository {
   override async listCurrentSources(){return changed;}
   override async put(){writes++;}
  }
  const store=new FixtureRepository({} as Pool,{environment:"local",scope:"d175_local_completed"});
  await expect(store.importPacket(packet)).rejects.toThrow(/membership_conflict/);expect(writes).toBe(0);
 });
});

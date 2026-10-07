import { readFile } from "node:fs/promises";
import type { Pool,PoolClient } from "pg";
import { expect,it } from "vitest";
import { assertDisposableIntegrationTestDatabase } from "../src/migration/local-database-safety";
import { completedSchemaMigrations } from "../src/staging/completed-schema";
import { PostgresAcceptedSemanticRepository } from "../src/server/repositories/postgres-accepted-semantic-repository";
import { buildAcceptedDescriptionIndex,type AcceptedSemanticSource } from "../src/semantic/accepted-description-index";
import { descriptionSha256,type DescriptionSemanticPipeline } from "../src/semantic/description-related-themes";
import { d175AcceptanceSql,d175DependencySql,d175ManifestSha256,d175SourceMembershipSha256,d175SourceNamespace,d175ReviewNamespace,d175AcceptanceNamespace,d175Actor,d175AcceptanceAction } from "../src/domain/sermonaudio-completion";
import { buildRelatedPublishedSermonsQuery } from "../src/server/queries/public-sermons";
import { collectMetadataEvaluationBaseline } from "../src/semantic/metadata-evaluation-baseline";

const pipeline:DescriptionSemanticPipeline={pipelineVersion:"accepted-description-semantic-v2",inputField:"accepted_description",inputMode:"symmetric_document",queryPrefix:null,documentPrefix:null,textNormalisation:"exact_utf8",modelIdentifier:"synthetic",modelRevision:"0".repeat(40),modelSha256:"1".repeat(64),tokenizerIdentifier:"synthetic",tokenizerSha256:"2".repeat(64),runtimeIdentifier:"synthetic",runtimeVersion:"1",runtimePackageIntegrity:`sha512-${"A".repeat(86)}==`,pooling:"cls",normalisation:"l2_float32",truncationMaxTokens:512,dimensions:3};
const ids=[1,2,3].map(n=>`a1780000-0000-4000-8000-${String(n).padStart(12,"0")}`);
const description=(n:number)=>`This entirely anonymous semantic integration fixture number ${n} contains no actual sermon content and is used only for guarded disposable database tests.`;

export function registerAcceptedDescriptionPostgresTests(getPool:()=>Pool){
 it("D178 semantic schema independently applies, rolls back, reapplies and constrains vectors",async()=>{
  assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE);
  const pool=getPool(),up=await readFile("db/migrations/0026_accepted_description_semantics.sql","utf8"),down=await readFile("db/migrations/0026_accepted_description_semantics.down.sql","utf8");
  try{
   await pool.query(up);
   expect((await pool.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_name LIKE 'accepted_description_semantic_%'")).rows[0].n).toBe(4);
   await expect(pool.query("INSERT INTO accepted_description_semantic_vectors VALUES($1,$2,3,ARRAY['NaN'::real,0,0])",["1".repeat(64),"2".repeat(64)])).rejects.toThrow();
   await expect(pool.query("INSERT INTO accepted_description_semantic_vectors VALUES($1,$2,3,ARRAY[1::real,0])",["1".repeat(64),"2".repeat(64)])).rejects.toThrow();
   await pool.query(down);expect((await pool.query("SELECT to_regclass('accepted_description_semantic_vectors') absent")).rows[0].absent).toBeNull();
   await pool.query(up);expect((await pool.query("SELECT count(*)::int n FROM accepted_description_semantic_vectors")).rows[0].n).toBe(0);
  }finally{await pool.query(down);}
 });
 it("D178 resumes vectors, atomically activates unchanged plans, invalidates stale/revoked sources and isolates environments",async()=>{
  assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE);
  const pool=getPool(),suffix=(await completedSchemaMigrations()).slice(22),up=await readFile("db/migrations/0026_accepted_description_semantics.sql","utf8"),down=await readFile("db/migrations/0026_accepted_description_semantics.down.sql","utf8");
  const speaker="a1780000-0000-4000-8000-000000000099",series="a1780000-0000-4000-8000-000000000098";
  try{
   for(const m of suffix)await pool.query(m.upBody);await pool.query(up);
   await pool.query("INSERT INTO speakers(id,name,slug)VALUES($1,'Anonymous semantic fixture','anonymous-semantic-fixture')",[speaker]);
   await pool.query("INSERT INTO series(id,name,slug)VALUES($1,'Anonymous semantic series','anonymous-semantic-series')",[series]);
   for(const [index,id]of ids.entries()){
    const wp=9178000+index,recording=`917800000000${index}`;
    await pool.query("INSERT INTO sermons(id,title,slug,summary,status,service_date,source_wordpress_id,speaker_id,summary_status) VALUES($1,'Anonymous semantic fixture',$2,$3,'draft','2026-01-01',$4,$5,'draft')",[id,`anonymous-semantic-fixture-${index}`,description(index),wp,speaker]);
    await pool.query("INSERT INTO sermon_media(sermon_id,media_type,provider,external_id,display_order,is_primary,canonical_url)VALUES($1,'audio','sermonaudio',$2,0,true,$3)",[id,recording,`https://www.sermonaudio.com/sermons/${recording}`]);
    if(index!==1)await pool.query("INSERT INTO sermon_series_map(sermon_id,series_id)VALUES($1,$2)",[id,series]);
    const source={manifestSha256:d175ManifestSha256,broadcaster:"savinggrace",sourceWordPressId:wp,sermonAudioId:recording,audioVerified:false,language:"en"};
    const review={manifestSha256:d175ManifestSha256,outcome:"accepted",completeSourceRead:true,completeTranscriptRead:true,completeDescriptionRead:true,everyOrderedQuestionAnswerRead:true,humanApprovalClaimed:false,audioVerified:false};
    for(const [namespace,payload]of [[d175SourceNamespace,source],[d175ReviewNamespace,review]] as const)await pool.query("INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload)VALUES($1,$2,1,$3)",[id,namespace,payload]);
    await pool.query(`INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload)
     SELECT s.id,$2,1,jsonb_build_object('decision','D-175','manifestSha256',$3::text,'sourceMembershipSha256',$4::text,'outcome','accepted','authorizedBy','Samuel','humanApprovalClaimed',false,'publicationAuthority',false,'rowVersion',s.row_version,'dependencySha256',${d175DependencySql("s")},'reviewSha256',(SELECT encode(digest(payload::text,'sha256'),'hex') FROM sermon_extensions WHERE sermon_id=s.id AND namespace=$5)) FROM sermons s WHERE id=$1`,[id,d175AcceptanceNamespace,d175ManifestSha256,d175SourceMembershipSha256,d175ReviewNamespace]);
    await pool.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,request_correlation_id) SELECT $2,'system',$3,'sermon',$1,'succeeded',$4||':'||encode(digest(payload::text,'sha256'),'hex') FROM sermon_extensions WHERE sermon_id=$1 AND namespace=$5",[id,d175Actor,d175AcceptanceAction,d175ManifestSha256,d175AcceptanceNamespace]);
   }
   // Genuine SQL acceptance/freshness predicate on anonymized disposable receipts.
   // Staging's production cohort membership is intentionally not manufactured in tests.
   class FixtureRepository extends PostgresAcceptedSemanticRepository{
    override async listCurrentSources(client:Pool|PoolClient=pool):Promise<AcceptedSemanticSource[]>{
     const rows=(await client.query(`SELECT s.id,s.source_wordpress_id,s.summary FROM sermons s WHERE s.id=ANY($1::uuid[]) AND ${d175AcceptanceSql("s")} ORDER BY s.id`,[ids])).rows;
     return rows.map(r=>({sermonId:r.id,sourceIdentity:`wordpress:${r.source_wordpress_id}`,description:r.summary,descriptionSha256:descriptionSha256(r.summary),language:"en"}));
    }
   }
   const repository=new FixtureRepository(pool,{environment:"local",scope:"d175_local_completed"});
   let inference=0;const model={async embedApprovedDescriptions(texts:readonly string[]){inference+=texts.length;return texts.map(()=>new Float32Array([1,0,0]));}};
   const make=async()=>buildAcceptedDescriptionIndex({...repository.target,cache:repository,model,pipeline,sources:await repository.listCurrentSources()});
   const first=await make();expect(first.sources).toHaveLength(3);expect(await repository.activate(first)).toBe("created");
   const actualRepository=new PostgresAcceptedSemanticRepository(pool,{environment:"local",scope:"d175_local_completed"});
   const frozenSources=await actualRepository.listCurrentSources();
   const baseline=await collectMetadataEvaluationBaseline(pool,{...actualRepository.target,expectedSources:frozenSources,anchorIds:ids});
   for(const anchorId of ids){
    const existing=buildRelatedPublishedSermonsQuery(anchorId,3,"d175_local_completed");
    const original=(await pool.query(existing.text,existing.values)).rows.map(row=>row.id);
    expect(baseline.candidates.filter(row=>row.anchorId===anchorId).map(row=>row.candidateId)).toEqual(original);
   }
   expect(baseline.candidates.find(row=>row.anchorId===ids[0])?.candidateId).toBe(ids[2]);
   await expect(collectMetadataEvaluationBaseline(pool,{...actualRepository.target,expectedSources:[],anchorIds:ids})).rejects.toThrow("corpus_changed");
   const before=(await pool.query("SELECT to_jsonb(a) body FROM accepted_description_semantic_active a")).rows;
   expect(await repository.activate(await make())).toBe("unchanged");expect(inference).toBe(3);
   expect((await pool.query("SELECT to_jsonb(a) body FROM accepted_description_semantic_active a")).rows).toEqual(before);
   expect(await repository.listPreviewRelated(ids[0]!)).toHaveLength(2);
   const remote=new FixtureRepository(pool,{environment:"staging_protected",scope:"d175_completed"});
   expect(await remote.listPreviewRelated(ids[0]!)).toEqual([]);
   await expect(remote.activate(first)).rejects.toThrow("scope_mismatch");
   const localPacket=await repository.exportPacket();await expect(remote.importPacket(localPacket)).rejects.toThrow("scope_mismatch");
   const remotePlan=await buildAcceptedDescriptionIndex({...remote.target,cache:repository,model,pipeline,sources:await remote.listCurrentSources()});
   const packet={...localPacket,plan:remotePlan};expect((await remote.importPacket(packet)).outcome).toBe("created");
   expect((await remote.importPacket(packet)).outcome).toBe("unchanged");
   expect(await remote.listPreviewRelated(ids[0]!)).toHaveLength(2);
   await expect(pool.query("UPDATE accepted_description_semantic_vectors SET dimensions=dimensions")).rejects.toThrow("immutable");
   await pool.query("UPDATE sermons SET summary=$2 WHERE id=$1",[ids[1],"Changed anonymous description invalidates this fixture receipt."]);
   expect(await repository.listPreviewRelated(ids[1]!)).toEqual([]);expect(await repository.listPreviewRelated(ids[0]!)).toHaveLength(1);
   await expect(repository.activate(first)).rejects.toThrow("corpus_changed");
   await pool.query("DELETE FROM sermon_extensions WHERE sermon_id=$1 AND namespace=$2",[ids[2],d175AcceptanceNamespace]);
   expect(await repository.listPreviewRelated(ids[0]!)).toEqual([]);
   expect((await pool.query("SELECT count(*)::int n FROM sermons WHERE id=ANY($1::uuid[]) AND status='draft' AND published_at IS NULL",[ids])).rows[0].n).toBe(3);
   await expect(repository.put(first.pipelineFingerprint,first.sources[0]!.descriptionSha256,new Float32Array([0,1,0]))).rejects.toThrow("conflict");
  }finally{
   await pool.query(down);await pool.query("DELETE FROM audit_events WHERE entity_id=ANY($1::uuid[])",[ids]);await pool.query("DELETE FROM sermons WHERE id=ANY($1::uuid[])",[ids]);await pool.query("DELETE FROM speakers WHERE id=$1",[speaker]);await pool.query("DELETE FROM series WHERE id=$1",[series]);
   for(const m of [...suffix].reverse())await pool.query(m.downBody);
  }
 });
}

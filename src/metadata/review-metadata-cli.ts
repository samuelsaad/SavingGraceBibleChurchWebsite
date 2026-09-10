import {readFile,writeFile,mkdir,lstat} from "node:fs/promises";
import {resolve} from "node:path";
import {execFileSync} from "node:child_process";
import {Pool,type PoolClient} from "pg";
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from "../migration/protected-local-postgres";
import {guardedTitleTransaction,preservationSnapshot} from "./sermon-title-correction";
import {inspectSpeakerMetadata,applySpeakerPlan,reviewMetadataActor,reviewMetadataAction,type SpeakerPlanRecord} from "./automatic-review-metadata";
import {reviewMetadataPolicy,type SourceSpeakerEvidence} from "../domain/review-metadata";
import {inspectPrimaryBooks,bookHash} from "../scripture/automatic-primary-book";

const root=resolve("private/review-metadata-reconciliation");
const planPath=resolve(root,"comparison.private.json"), receiptPath=resolve(root,"applied.private.json");
const counts=(v:string[])=>Object.fromEntries([...new Set(v)].sort().map(k=>[k,v.filter(x=>x===k).length]));
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
async function fingerprint(c:PoolClient,targets:string[]=[]) {
  const result=await preservationSnapshot(c,[]);
  result.sermons=(await c.query(`SELECT encode(digest(COALESCE(string_agg(j::text,E'\n' ORDER BY j::text),''),'sha256'),'hex') hash
    FROM (SELECT CASE WHEN id=ANY($1::uuid[]) THEN to_jsonb(s)-ARRAY['speaker_id','row_version','updated_at','updated_by_subject','search_terms','search_vector'] ELSE to_jsonb(s) END j FROM sermons s) q`,[targets])).rows[0].hash;
  result.audit_events=(await c.query(`SELECT encode(digest(COALESCE(string_agg(to_jsonb(a)::text,E'\n' ORDER BY id),''),'sha256'),'hex') hash
    FROM audit_events a WHERE NOT ($1 AND actor_subject=$2 AND action=$3)`,[targets.length>0,reviewMetadataActor,reviewMetadataAction])).rows[0].hash;
  // No guided-review effects are permitted by this exact plan: every target is already pending.
  return result;
}
async function main(){
  const mode=process.argv[2]; if(mode!=="plan"&&mode!=="apply")throw Error("metadata_invalid_mode");
  for(const path of [resolve("private"),root,planPath,receiptPath]) {
    const s=await lstat(path).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});
    if(s?.isSymbolicLink())throw Error("metadata_private_symlink");
  }
  for(const path of [planPath,`${planPath}.sha256`,receiptPath]){
    execFileSync("git",["check-ignore","--quiet","--no-index",path],{stdio:"ignore"});
    if(execFileSync("git",["ls-files","--",path],{encoding:"utf8"}).trim())throw Error("metadata_private_path_tracked");
  }
  const pool=new Pool({host:"127.0.0.1",port:5432,database:"savinggrace_sermons_test",user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1});
  try {
    if(mode==="plan"){
      const sourcePath=process.env.REVIEW_METADATA_INVENTORY_PATH;
      if(!sourcePath)throw Error("metadata_inventory_locator_required");
      if((await lstat(sourcePath)).isSymbolicLink())throw Error("metadata_source_symlink");
      const bytes=await readFile(sourcePath,"utf8"); const inventory=JSON.parse(bytes);
      const {integrity,...payload}=inventory;
      if(bookHash(JSON.stringify(payload))!==integrity?.contentSha256)throw Error("metadata_inventory_integrity");
      const expected="52b544e0a1620eb536c37a6e5cc2344593ee76619ff1222ed0348d1183602ddc";
      if(integrity.contentSha256!==expected||inventory.rows.length!==454)throw Error("metadata_inventory_scope");
      const evidence:SourceSpeakerEvidence[]=inventory.rows.map((r:{sourceId:number;speaker:{relationshipCount:number;relationshipTermIds:unknown}})=>({
        sourceWordPressId:r.sourceId,relationshipCount:r.speaker.relationshipCount,
        termIds:r.speaker.relationshipTermIds===null?[]:String(r.speaker.relationshipTermIds).split(',').map(Number),evidenceSha256:integrity.contentSha256}));
      const plan=await guardedTitleTransaction(pool,false,async c=>{
        const records=await inspectSpeakerMetadata(c,evidence);if(records.length!==155)throw Error("metadata_collection_scope");
        const targets=records.filter(r=>r.speakerId===null&&r.assessment.speakerId!==null).map(r=>r.id);
        const inappropriate=await c.query("SELECT 1 FROM sermon_enrichment_reviews WHERE sermon_id=ANY($1::uuid[]) AND (identity_status<>'pending' OR completed_at IS NOT NULL)",[targets]);
        if(inappropriate.rowCount)throw Error("metadata_intervening_review");
        return {policy:reviewMetadataPolicy,createdAt:new Date().toISOString(),sourceFileSha256:bookHash(bytes),sourceContentSha256:integrity.contentSha256,
          records,passages:await inspectPrimaryBooks(c),before:await fingerprint(c),protected:await fingerprint(c,targets),
          externalEvidence:{publicPageStatus:"connection_timeout",readOnlyWebStatus:"http_403",unresolvedRecordsNotAssigned:true}};
      });
      const serialized=JSON.stringify(plan,null,2)+"\n";
      await mkdir(root,{recursive:true});await writeFile(planPath,serialized,{flag:"wx",mode:0o600});await writeFile(`${planPath}.sha256`,bookHash(serialized),{flag:"wx",mode:0o600});
      console.log(JSON.stringify({status:"frozen",records:plan.records.length,sha256:bookHash(serialized),speakers:counts(plan.records.map(r=>r.assessment.reason)),passages:counts(plan.passages.map(r=>r.assessment.outcome))}));return;
    }
    const bytes=await readFile(planPath,"utf8"),hash=bookHash(bytes);
    if(hash!==(await readFile(`${planPath}.sha256`,"utf8")).trim())throw Error("metadata_plan_hash");
    const plan=JSON.parse(bytes) as {policy:string;records:SpeakerPlanRecord[];protected:Record<string,string>};
    if(plan.policy!==reviewMetadataPolicy||plan.records.length!==155)throw Error("metadata_plan_scope");
    const result=await guardedTitleTransaction(pool,true,async c=>{
      const evidence=plan.records.flatMap(r=>r.evidence?[r.evidence]:[]);
      const current=await inspectSpeakerMetadata(c,evidence);
      if(!same(current.map(r=>r.id),plan.records.map(r=>r.id)))throw Error("metadata_identity_scope_drift");
      const targets=plan.records.filter(r=>r.speakerId===null&&r.assessment.speakerId!==null).map(r=>r.id);
      const before=await fingerprint(c),protectedBefore=await fingerprint(c,targets);
      const applied=await applySpeakerPlan(c,plan.records,hash);
      if(!same(protectedBefore,await fingerprint(c,targets)))throw Error("metadata_preservation_failed");
      const after=await fingerprint(c),changed=applied.results.filter(r=>r.outcome==='assigned').length;
      if(!changed&&!same(before,after))throw Error("metadata_idempotency_failed");
      return {...applied,changed,before,after,afterRecords:await inspectSpeakerMetadata(c,evidence)};
    });
    if(result.changed)await writeFile(receiptPath,JSON.stringify(result,null,2),{flag:"wx",mode:0o600});
    console.log(JSON.stringify({status:"verified",changed:result.changed,outcomes:counts(result.results.map(r=>r.outcome)),populated:result.afterRecords.filter(r=>r.speakerId!==null).length,preservation:true,idempotent:result.changed===0}));
  } finally {await pool.end();}
}
main().catch((error:unknown)=>{const message=error instanceof Error?error.message:"";console.error(JSON.stringify({status:"blocked",code:/^(metadata|title)_[a-z_]+$/.test(message)?message:"metadata_operation_failed_details_withheld"}));process.exitCode=1;});

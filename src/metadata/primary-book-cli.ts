import { readFile, writeFile, mkdir, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { Pool, type PoolClient } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import { guardedTitleTransaction, preservationSnapshot } from "./sermon-title-correction";
import { inspectPrimaryBooks, applyBookPlan, bookHash, automaticBookAction, automaticBookActor, type BookPlanRecord } from "../scripture/automatic-primary-book";
import { primaryBookResolutionVersion } from "../domain/primary-book-resolution";

const root = resolve("private/primary-book-assignment");
const planPath = resolve(root,"comparison.private.json");
const receiptPath = resolve(root,"applied.private.json");
const equal = (a: unknown,b: unknown) => JSON.stringify(a)===JSON.stringify(b);
const counts = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map(k=>[k,values.filter(v=>v===k).length]));

async function preserved(client: PoolClient, targets: string[]) {
  const ordinary = await preservationSnapshot(client,[]);
  for (const table of ["sermons","scripture_references","sermon_primary_passage_reviews","audit_events"]) {
    const expression = table === "sermons" ? "CASE WHEN id=ANY($1::uuid[]) THEN to_jsonb(t)-ARRAY['row_version','updated_at','updated_by_subject'] ELSE to_jsonb(t) END" : "to_jsonb(t)";
    const where = table === "scripture_references" ? "WHERE parser_version IS DISTINCT FROM $1" :
      table === "sermon_primary_passage_reviews" ? "WHERE parser_version<>$1" :
      table === "audit_events" ? "WHERE NOT (action=$1 AND actor_subject=$2)" : "";
    const params: unknown[] = table === "sermons" ? [targets] : table === "audit_events" ? [automaticBookAction,automaticBookActor] : [primaryBookResolutionVersion];
    ordinary[table]=(await client.query<{hash:string}>(`SELECT encode(digest(COALESCE(string_agg(j::text,E'\\n' ORDER BY j::text),''),'sha256'),'hex') hash
      FROM (SELECT ${expression} j FROM ${table} t ${where}) q`,params)).rows[0]!.hash;
  }
  return ordinary;
}
async function fullSnapshot(client: PoolClient) {
  const snapshot = await preservationSnapshot(client,[]);
  snapshot.audit_events=(await client.query("SELECT encode(digest(COALESCE(string_agg(to_jsonb(a)::text,E'\\n' ORDER BY id),''),'sha256'),'hex') hash FROM audit_events a")).rows[0].hash;
  return snapshot;
}
async function main() {
  const mode=process.argv[2];
  if (mode!=="plan"&&mode!=="apply") throw Error("book_invalid_mode");
  for (const path of [resolve("private"),root,planPath,receiptPath]) {
    const stat=await lstat(path).catch((e: NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});
    if(stat?.isSymbolicLink())throw Error("book_private_symlink");
  }
  for(const path of [planPath,`${planPath}.sha256`,receiptPath]) {
    execFileSync("git",["check-ignore","--quiet","--no-index",path],{stdio:"ignore"});
    if(execFileSync("git",["ls-files","--",path],{encoding:"utf8"}).trim())throw Error("book_private_path_tracked");
  }
  const pool=new Pool({host:"127.0.0.1",port:5432,database:"savinggrace_sermons_test",user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1});
  try {
    if(mode==="plan") {
      const records=await guardedTitleTransaction(pool,false,c=>inspectPrimaryBooks(c));
      const bytes=JSON.stringify({policy:primaryBookResolutionVersion,createdAt:new Date().toISOString(),records},null,2)+"\n";
      await mkdir(root,{recursive:true});
      await writeFile(planPath,bytes,{flag:"wx",mode:0o600});
      await writeFile(`${planPath}.sha256`,bookHash(bytes),{flag:"wx",mode:0o600});
      console.log(JSON.stringify({status:"frozen",sha256:bookHash(bytes),inspected:records.length,outcomes:counts(records.map(r=>r.assessment.outcome)),reasons:counts(records.map(r=>r.assessment.reason))}));
      return;
    }
    const bytes=await readFile(planPath,"utf8"),hash=bookHash(bytes);
    if(hash!==await readFile(`${planPath}.sha256`,"utf8"))throw Error("book_plan_hash_mismatch");
    const plan=JSON.parse(bytes) as {policy:string;records:BookPlanRecord[]};
    if(plan.policy!==primaryBookResolutionVersion)throw Error("book_plan_policy_mismatch");
    const result=await guardedTitleTransaction(pool,true,async c=>{
      const current=await inspectPrimaryBooks(c);
      if(!equal(current.map(r=>r.id),plan.records.map(r=>r.id)))throw Error("book_collection_scope_changed");
      const targets=plan.records.filter(r=>r.assessment.outcome==="newly_assigned"||r.assessment.outcome==="unresolved").map(r=>r.id);
      const before=await preserved(c,targets),fullBefore=await fullSnapshot(c);
      const outcomes=await applyBookPlan(c,plan.records,hash);
      if(!equal(before,await preserved(c,targets)))throw Error("book_preservation_failed");
      const changed=outcomes.filter(o=>o.result==="changed").length;
      const fullAfter=await fullSnapshot(c);
      if(changed===0&&!equal(fullBefore,fullAfter))throw Error("book_idempotency_failed");
      const after=await inspectPrimaryBooks(c);
      return {outcomes,changed,before:fullBefore,after:fullAfter,records:after,preservation:true,idempotent:changed===0};
    });
    if(result.changed)await writeFile(receiptPath,JSON.stringify({planSha256:hash,appliedAt:new Date().toISOString(),...result},null,2),{flag:"wx",mode:0o600});
    console.log(JSON.stringify({status:"verified",inspected:result.records.length,changed:result.changed,
      results:counts(result.outcomes.map(o=>o.result)),after:counts(result.records.map(r=>r.assessment.outcome)),preservation:result.preservation,idempotent:result.idempotent}));
  } finally {await pool.end();}
}
main().catch((e:unknown)=>{const message=e instanceof Error?e.message:"";console.error(JSON.stringify({status:"blocked",code:/^(book|title)_[a-z_]+$/.test(message)?message:"book_operation_failed_details_withheld"}));process.exitCode=1;});

/** Local private persistence only. No provider client, generation or auto-acceptance. */
import { readFile, readdir, mkdir, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import { persistNoClobber } from "./pilot-punctuation";
import { normalizedWords, parseVttBytes } from "../youtube/pilot-caption-proof";
import { canonicalReviewJson, reviewHash } from "../domain/delegated-ai-review";
import { bindDelegatedReviewScope, applyDelegatedReview } from "../application/delegated-ai-review-service";

const root=resolve("private/delegated-ai-review");
const scopePath=join(root,"scope.private.json");
const packetPath=(n:number)=>join(root,`record-${String(n).padStart(3,"0")}.private.json`);
const instructionFiles=["AGENTS.md",".agents/skills/sermon-enrichment/SKILL.md",".agents/skills/sermon-enrichment/references/grounding-contract.md",".agents/skills/sermon-enrichment/references/delegated-review-contract.md"];
export async function delegatedPolicyHash() {
  return reviewHash(canonicalReviewJson(await Promise.all(instructionFiles.map(async p=>({path:p,sha256:reviewHash(await readFile(p,"utf8"))})))));
}
async function privateWrite(path:string,value:unknown) {
  if ((await lstat(root)).isSymbolicLink()) throw new Error("unsafe_storage");
  const relative=path.slice(process.cwd().length+1).replaceAll("\\","/");
  execFileSync("git",["check-ignore","--quiet","--",relative],{stdio:"pipe"});
  return persistNoClobber(path,Buffer.from(canonicalReviewJson(value)+"\n"));
}
function pool(readOnly=true) {
  return new Pool({host:"127.0.0.1",port:5432,database:"savinggrace_sermons_test",user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1,
    ...(readOnly?{options:"-c default_transaction_read_only=on"}:{})});
}
async function assertTarget(p:Pool) {
  const r=await p.query("SELECT current_database()='savinggrace_sermons_test' AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AS safe");
  if(!r.rows[0]?.safe) throw new Error("target_mismatch");
}
async function prepare() {
  await mkdir(root,{recursive:true});
  const p=pool();
  try {
    await assertTarget(p);await p.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const rows=(await p.query(`SELECT to_jsonb(s) AS sermon,to_jsonb(t) AS transcript,to_jsonb(e) AS source,to_jsonb(r) AS review,
      COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY display_order) FROM sermon_question_answers q WHERE q.sermon_id=s.id),'[]') AS pairs,
      COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY display_order) FROM sermon_enrichment_review_items f WHERE f.sermon_id=s.id),'[]') AS findings,
      COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY display_order) FROM scripture_references x WHERE x.sermon_id=s.id),'[]') AS passages,
      (SELECT name FROM speakers WHERE id=s.speaker_id) AS speaker
      FROM sermons s LEFT JOIN sermon_transcripts t ON t.sermon_id=s.id LEFT JOIN sermon_enrichment_sources e ON e.sermon_id=s.id
      LEFT JOIN sermon_enrichment_reviews r ON r.sermon_id=s.id WHERE s.deleted_at IS NULL ORDER BY s.service_date DESC,s.id`)).rows;
    if(rows.length!==155 || rows.some(r=>r.sermon.status!=="draft" || !r.transcript || !r.source)) throw new Error("collection_mismatch");
    const ids=rows.map(r=>r.sermon.id), policySha256=await delegatedPolicyHash();
    const packets=[];
    for(const [i,row]of rows.entries()){
      const packet={schemaVersion:1,privateContent:true,sequence:i+1,...row,
        transcriptSha256:reviewHash(row.transcript.body_text),sourceProvenanceSha256:reviewHash(canonicalReviewJson(row.source)),
        originalRecordSha256:reviewHash(canonicalReviewJson(row))};
      await privateWrite(packetPath(i+1),packet);packets.push({sequence:i+1,sha256:reviewHash(canonicalReviewJson(packet)+"\n")});
    }
    const scope={decision:"D-156",privateContent:true,ids,scopeSha256:reviewHash(canonicalReviewJson(ids)),policySha256,packets};
    await privateWrite(scopePath,scope);
    await p.query("ROLLBACK");
    console.log(JSON.stringify({outcome:"private_scope_prepared",count:ids.length,scopeSha256:scope.scopeSha256,policySha256,
      humanDescriptions:rows.filter(r=>r.sermon.summary_status==="approved").length,humanPairs:rows.reduce((n,r)=>n+r.pairs.filter((q:{status:string})=>q.status==="approved").length,0)}));
  } finally {await p.end();}
}
async function scope() {
  const s=JSON.parse(await readFile(scopePath,"utf8"));
  if(s.decision!=="D-156" || s.ids.length!==155 || new Set(s.ids).size!==155 || reviewHash(canonicalReviewJson(s.ids))!==s.scopeSha256 || s.policySha256!==await delegatedPolicyHash()) throw new Error("scope_drift");
  return s;
}
async function packet(n:number) {
  const s=await scope();const bytes=await readFile(packetPath(n),"utf8");
  if(s.packets[n-1]?.sha256!==reviewHash(bytes)) throw new Error("packet_drift");
  return JSON.parse(bytes);
}
async function integrity() {
  const s=await scope();
  const packets=await Promise.all(s.packets.map((r:{sequence:number})=>packet(r.sequence)));
  const names=new Set(packets.map(p=>p.source.original_filename));
  const matched=new Map<string,{path:string;bytes:Buffer}>();
  const desired=new Set(packets.map(p=>p.source.source_content_sha256));
  const base=resolve("..");
  const roots=["SavingGraceBibleChurchWebsite","SavingGraceBibleChurchWebsite-sermon-enrichment-evaluation-36","SavingGraceBibleChurchWebsite-sermon-enrichment-evaluation-36-batch-2","SavingGraceBibleChurchWebsite-sermon-enrichment-evaluation-36-batch-3","SavingGraceBibleChurchWebsite-sermon-enrichment-evaluation-36-batch-4"].map(p=>join(base,p,"private"));
  async function visit(dir:string) {
    let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch{return;}
    for(const e of entries){if(e.isSymbolicLink())continue;const path=join(dir,e.name);
      if(e.isDirectory()) await visit(path);
      else if(e.isFile() && (names.has(e.name) || e.name.endsWith(".vtt"))){
        const bytes=await readFile(path);const hash=createHash("sha256").update(bytes).digest("hex");
        if(desired.has(hash)&&!matched.has(hash)) matched.set(hash,{path,bytes});
      }
    }
  }
  for(const r of roots)await visit(r);
  const results=[];
  for(const r of packets){
    const found=matched.get(r.source.source_content_sha256);
    let parsed=false,wordMatch=false,cues:number|null=null;
    if(found){try{const vtt=parseVttBytes(found.bytes);parsed=true;cues=vtt.cueCount;wordMatch=canonicalReviewJson(vtt.normalizedWords)===canonicalReviewJson(normalizedWords(r.transcript.body_text));}catch{/* structured unavailable/parse failure only */}}
    const result={sequence:r.sequence,sourceFound:!!found,sourcePath:found?.path??null,sourceSha256:r.source.source_content_sha256,parsed,cues,
      normalizedWordMatch:wordMatch,transcriptSha256:r.transcriptSha256,transcriptCharacters:r.transcript.body_text.length,
      transcriptWords:r.transcript.body_text.trim().split(/\s+/u).length,
      integrity:wordMatch?"verified":r.transcript.status==="approved"?"human_edits_preserved":found?"unexplained_drift":"source_unavailable",
      humanApprovalPreserved:r.transcript.status==="approved",audioVerified:false};
    await privateWrite(join(root,`integrity-${String(r.sequence).padStart(3,"0")}.private.json`),result);results.push(result);
  }
  console.log(JSON.stringify({count:results.length,found:results.filter(r=>r.sourceFound).length,parsed:results.filter(r=>r.parsed).length,normalizedWordMatch:results.filter(r=>r.normalizedWordMatch).length,unapprovedDrift:results.filter(r=>r.integrity==="unexplained_drift").length,sourceUnavailable:results.filter(r=>!r.sourceFound).length,humanApprovedWithoutSourceMatch:results.filter(r=>r.humanApprovalPreserved&&!r.normalizedWordMatch).length}));
}
async function main() {
  const [command,arg]=process.argv.slice(2);
  if(command==="prepare")return prepare();
  if(command==="integrity")return integrity();
  if(command==="bind") {const s=await scope();const p=pool(false);try{console.log(JSON.stringify(await bindDelegatedReviewScope(p,s.ids,s.policySha256)));}finally{await p.end();}return;}
  if(command==="apply"){
    const n=Number(arg);if(!Number.isInteger(n)||n<1||n>155)throw new Error("sequence_invalid");
    const s=await scope();const r=await packet(n);
    const raw=JSON.parse(await readFile(join(root,`decisions-${String(n).padStart(3,"0")}.private.json`),"utf8"));
    if(raw.sermonId!==r.sermon.id || raw.scopeSha256!==s.scopeSha256 || !Array.isArray(raw.decisions))throw new Error("scope_invalid");
    const p=pool(false);try{
      const outcomes=[];
      for(const decision of raw.decisions){
        if(decision.sermonId!==r.sermon.id || decision.scopeSha256!==s.scopeSha256)throw new Error("decision_scope");
        outcomes.push(await applyDelegatedReview(p,decision));
      }
      await privateWrite(join(root,`receipt-${String(n).padStart(3,"0")}.private.json`),{sequence:n,decisionsSha256:reviewHash(canonicalReviewJson(raw)),count:outcomes.length});
      console.log(JSON.stringify({sequence:n,recorded:outcomes.filter(o=>o==="recorded").length,unchanged:outcomes.filter(o=>o==="unchanged").length}));
    }finally{await p.end();}return;
  }
  throw new Error("command_not_authorised");
}
main().catch(()=>{console.error("delegated_review_operation_failed_details_withheld");process.exitCode=1;});

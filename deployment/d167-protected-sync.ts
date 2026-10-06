import {readFile,writeFile} from "node:fs/promises";
import {isAbsolute} from "node:path";
import {Pool,type PoolClient} from "pg";
import {z} from "zod";
import {canonicalReviewJson,reviewHash} from "../src/domain/delegated-ai-review";
import {d167SourceManifest} from "../src/domain/d167-review";
import {frontendSermonEligibilitySql} from "../src/server/queries/public-sermons";
import {protectedLocalPostgresUser,protectedLocalPostgresPassword} from "../src/migration/protected-local-postgres";
import {stagingConfiguration,stagingPassword,verifyStagingIdentity} from "../src/staging/guard";
import {verifyReleaseSchema,databaseFingerprint} from "../src/staging/database-verification";
import {loadSchemaMigrations} from "../src/migration/schema-migrations";

export const protectedTables=[
 "media_assets","speakers","series","bible_books","book_classifications","source_taxonomy_terms",
 "sermons","sermon_enrichment_sources","sermon_transcripts","sermon_transcript_legacy_grounding_bindings",
 "sermon_media","sermon_primary_passage_reviews","scripture_references","scripture_reference_sources",
 "sermon_question_answers","sermon_enrichment_draft_imports","sermon_enrichment_reviews","sermon_enrichment_review_items",
 "sermon_extensions","sermon_legacy_metrics","sermon_resources","sermon_series_map","sermon_book_classifications","sermon_source_terms",
 "delegated_ai_review_scopes","remaining_ai_review_scopes","delegated_ai_review_members","remaining_ai_review_members",
 "sermon_ai_content_reviews","sermon_ai_metadata_assignments","sermon_ai_component_reviews",
 "sermon_restricted_acceptances","sermon_d161_restricted_acceptances","sermon_d162_restricted_acceptances","sermon_d167_restricted_acceptances",
 "sermon_media_source_audit","audit_events"
] as const;
type Table=typeof protectedTables[number];type Row=Record<string,any>;
type TablePacket={primaryKey:string[];rows:Row[]};
export type ProtectedPacket={schemaVersion:1;decision:"D-167";processingManifestSha256:typeof d167SourceManifest;exportedAt:string;eligibleIds:string[];membershipSha256:string;tables:Record<Table,TablePacket>;packageSha256:string};
const hash=(v:unknown)=>reviewHash(canonicalReviewJson(v));
export const protectedPacketHash=(p:ProtectedPacket)=>hash({...p,packageSha256:""});
const identifier=z.string().regex(/^[a-z][a-z0-9_]*$/u);
const safeName=(v:string)=>{identifier.parse(v);return '"'+v+'"';};
const marker="D-167 isolated protected runtime "+d167SourceManifest;
export function validateProtectedPacket(raw:unknown):ProtectedPacket{
 const p=raw as ProtectedPacket;
 if(!p||p.schemaVersion!==1||p.decision!=="D-167"||p.processingManifestSha256!==d167SourceManifest||
 !Array.isArray(p.eligibleIds)||p.eligibleIds.length<1||p.eligibleIds.length>183||
 p.eligibleIds.some(id=>!z.uuid().safeParse(id).success)||new Set(p.eligibleIds).size!==p.eligibleIds.length||
 p.eligibleIds.some((id,i)=>i>0&&p.eligibleIds[i-1]!>=id)||p.membershipSha256!==hash(p.eligibleIds)||
 !p.tables||Object.keys(p.tables).length!==protectedTables.length||Object.keys(p.tables).some(t=>!protectedTables.includes(t as Table))||
 p.packageSha256!==protectedPacketHash(p))throw Error("d167_protected_package_invalid");
 const ids=new Set(p.eligibleIds);
 for(const t of protectedTables){const x=p.tables[t];if(!x||!Array.isArray(x.rows)||!x.primaryKey.length||x.primaryKey.some(k=>!identifier.safeParse(k).success))throw Error("d167_protected_package_invalid");
  if(t==="sermons"&&(x.rows.length!==ids.size||x.rows.some(r=>!ids.has(r.id))))throw Error("d167_protected_package_invalid");
  if(x.rows.some(r=>r.sermon_id!==undefined&&!ids.has(r.sermon_id)))throw Error("d167_protected_scope_invalid");
  if(t==="sermon_extensions"&&x.rows.some(r=>r.namespace==="website.d172-local-completion"))throw Error("d167_protected_local_completion_refused");
  if(t==="audit_events"&&x.rows.some(r=>r.action==="sermon.d172_local_completion"))throw Error("d167_protected_local_completion_refused");
 }
 return p;
}
async function pk(c:PoolClient,t:Table){const r=await c.query("SELECT a.attname column_name FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=('public.'||$1)::regclass AND i.indisprimary ORDER BY array_position(i.indkey,a.attnum)",[t]);if(!r.rows.length)throw Error("d167_protected_primary_key_missing");return r.rows.map(x=>x.column_name as string);}
function clause(t:Table):string{
 if(t==="sermons")return "id=ANY($1::uuid[])";
 if(t==="bible_books")return "true";
 if(t==="speakers")return "id IN(SELECT speaker_id FROM sermons WHERE id=ANY($1::uuid[]))";
 if(t==="series")return "id IN(SELECT series_id FROM sermon_series_map WHERE sermon_id=ANY($1::uuid[]))";
 if(t==="book_classifications")return "id IN(SELECT book_classification_id FROM sermon_book_classifications WHERE sermon_id=ANY($1::uuid[]))";
 if(t==="source_taxonomy_terms")return "id IN(SELECT source_taxonomy_term_id FROM sermon_source_terms WHERE sermon_id=ANY($1::uuid[]))";
 if(t==="media_assets")return "id IN(SELECT featured_asset_id FROM sermons WHERE id=ANY($1::uuid[]) UNION SELECT thumbnail_asset_id FROM sermon_media WHERE sermon_id=ANY($1::uuid[]) UNION SELECT asset_id FROM sermon_resources WHERE sermon_id=ANY($1::uuid[]) UNION SELECT image_asset_id FROM speakers WHERE id IN(SELECT speaker_id FROM sermons WHERE id=ANY($1::uuid[])) UNION SELECT image_asset_id FROM series WHERE id IN(SELECT series_id FROM sermon_series_map WHERE sermon_id=ANY($1::uuid[])))";
 if(t.endsWith("_scopes"))return "id IN(SELECT scope_id FROM "+(t.startsWith("delegated")?"delegated":"remaining")+"_ai_review_members WHERE sermon_id=ANY($1::uuid[]))";
 if(t==="sermon_media_source_audit")return "sermon_media_id IN(SELECT id FROM sermon_media WHERE sermon_id=ANY($1::uuid[]))";
 if(t==="sermon_extensions")return "sermon_id=ANY($1::uuid[]) AND namespace<>'website.d172-local-completion'";
 if(t==="audit_events")return "entity_type='sermon' AND entity_id=ANY($1::uuid[]) AND action<>'sermon.d172_local_completion'";
 return "sermon_id=ANY($1::uuid[])";
}
async function exportLocal(path:string){
 const db=new Pool({host:"127.0.0.1",port:5432,database:"savinggrace_sermons_test",user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1,options:"-c default_transaction_read_only=on -c timezone=UTC"}),c=await db.connect();
 try{await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
 const ok=(await c.query("SELECT current_database()='savinggrace_sermons_test' AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 ok")).rows[0]?.ok;if(!ok)throw Error("d167_protected_source_refused");
 await verifyReleaseSchema(c,22);
 const ids=(await c.query("SELECT s.id FROM sermons s WHERE "+frontendSermonEligibilitySql("s","d167_restricted_accepted")+" ORDER BY s.id")).rows.map(r=>r.id as string);
 const p:ProtectedPacket={schemaVersion:1,decision:"D-167",processingManifestSha256:d167SourceManifest,exportedAt:new Date().toISOString(),eligibleIds:ids,membershipSha256:hash(ids),tables:{} as ProtectedPacket["tables"],packageSha256:""};
 for(const t of protectedTables){const primaryKey=await pk(c,t);const condition=clause(t),args=condition.includes("$1")?[ids]:[];p.tables[t]={primaryKey,rows:(await c.query("SELECT to_jsonb(t) row FROM "+safeName(t)+" t WHERE "+condition+" ORDER BY "+primaryKey.map(safeName).join(","),args)).rows.map(r=>r.row)};
 }
 p.packageSha256=protectedPacketHash(p);validateProtectedPacket(p);
 await writeFile(path,JSON.stringify(p),{flag:"wx",mode:0o600});await c.query("ROLLBACK");
 console.log(JSON.stringify({outcome:"exported",eligible:ids.length,membershipSha256:p.membershipSha256,packageSha256:p.packageSha256,rows:Object.fromEntries(protectedTables.map(t=>[t,p.tables[t].rows.length]))}));
 }finally{c.release();await db.end();}
}
async function isolated(c:PoolClient){await verifyStagingIdentity(c,true);const m=(await c.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0]?.marker;if(m!==marker)throw Error("d167_protected_isolation_marker_missing");}
async function initialize(c:PoolClient){
 await verifyStagingIdentity(c,true);const n=(await c.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0]?.n;
 if(n!==0){await isolated(c);await verifyReleaseSchema(c,22);return "unchanged";}
 await c.query("CREATE TABLE schema_migrations(migration_order integer PRIMARY KEY,migration_id text NOT NULL UNIQUE,checksum_sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
 for(const m of await loadSchemaMigrations()){await c.query(m.upBody);await c.query("INSERT INTO schema_migrations(migration_order,migration_id,checksum_sha256)VALUES($1,$2,$3)",[m.order,m.id,m.checksumSha256]);}
 await c.query("COMMENT ON DATABASE savinggrace_staging IS '"+marker+"'");await verifyReleaseSchema(c,22);return "initialized";
}
async function importRow(c:PoolClient,t:Table,x:TablePacket,original:Row){
 const row={...original};if(t==="sermon_restricted_acceptances")row.environment="sealed_staging";
 if(["sermon_d161_restricted_acceptances","sermon_d162_restricted_acceptances","sermon_d167_restricted_acceptances"].includes(t))row.environment="sealed_staging";
 const where=x.primaryKey.map((k,i)=>safeName(k)+"=$"+(i+1)).join(" AND ");
 const prior=(await c.query("SELECT to_jsonb(t) row FROM "+safeName(t)+" t WHERE "+where,x.primaryKey.map(k=>row[k]))).rows[0]?.row;
 if(prior){if(hash(prior)!==hash(row))throw Error("d167_protected_newer_or_conflicting_record");return "unchanged";}
 const columns=(await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER' AND identity_generation IS NULL ORDER BY ordinal_position",[t])).rows.map(r=>r.column_name as string);
 const cols=columns.map(safeName).join(",");await c.query("WITH x AS(SELECT * FROM jsonb_populate_record(NULL::"+safeName(t)+",$1::jsonb)) INSERT INTO "+safeName(t)+"("+cols+") SELECT "+cols+" FROM x",[JSON.stringify(row)]);return "inserted";
}
async function staging(operation:string,path:string){
 if(process.env.ALLOW_STAGING_D167_SYNC!=="1"||process.env.D167_ISOLATED_RUNTIME!=="1")throw Error("d167_protected_gate_required");
 const config=stagingConfiguration(process.env,true),db=new Pool({...config,password:stagingPassword(config.passwordFile),max:1}),c=await db.connect();
 try{await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");await c.query("SET LOCAL savinggrace.application_request='on'");
 if(operation==="initialize"){const outcome=await initialize(c);await c.query("COMMIT");console.log(JSON.stringify({outcome,migrations:22}));return;}
 await isolated(c);await verifyReleaseSchema(c,22);
 const p=validateProtectedPacket(JSON.parse(await readFile(path,"utf8")));
 const existing=(await c.query("SELECT id FROM sermons ORDER BY id")).rows.map(r=>r.id);
 if(existing.length&&hash(existing)!==p.membershipSha256)throw Error("d167_protected_existing_scope_conflict");
 const before=await databaseFingerprint(c);await writeFile(path+".before-"+Date.now()+".private.json",JSON.stringify(before),{flag:"wx",mode:0o600});
 let inserted=0,unchanged=0;
 for(const t of protectedTables){
  if(t==="sermon_enrichment_reviews"&&existing.length===0)await c.query("DELETE FROM sermon_enrichment_reviews WHERE sermon_id=ANY($1::uuid[])",[p.eligibleIds]);
  for(const row of p.tables[t].rows){const result=await importRow(c,t,p.tables[t],row);if(result==="inserted")inserted++;else unchanged++;}
 }
 const eligible=(await c.query("SELECT s.id FROM sermons s WHERE "+frontendSermonEligibilitySql("s","d167_restricted_accepted")+" ORDER BY s.id")).rows.map(r=>r.id);
 if(hash(eligible)!==p.membershipSha256)throw Error("d167_protected_freshness_or_membership_failed");
 const after=await databaseFingerprint(c);if(existing.length&&before.sha256!==after.sha256)throw Error("d167_protected_idempotency_failed");
 await c.query("COMMIT");console.log(JSON.stringify({outcome:inserted?"imported":"unchanged",inserted,unchanged,eligible:eligible.length,membershipSha256:p.membershipSha256,databaseFingerprint:after.sha256}));
 }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();await db.end();}
}
export async function runProtectedSync(operation:string,path:string){
 if(!isAbsolute(path)||!path.endsWith(".private.json"))throw Error("d167_protected_path_refused");
 if(operation==="export")await exportLocal(path);else if(operation==="initialize"||operation==="import")await staging(operation,path);else throw Error("d167_protected_operation_refused");
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("/d167-protected-sync.ts")||process.argv[1]?.endsWith("d167-protected-sync.cjs")){
 runProtectedSync(process.argv[2]??"",process.env.D167_SYNC_PACKAGE??"").catch(e=>{console.error(JSON.stringify({outcome:"stopped_safely",code:e instanceof Error&&/^d167_protected_[a-z_]+$/.test(e.message)?e.message:"d167_protected_unrecognized_or_unavailable",sqlState:/^[A-Z0-9]{5}$/.test(e?.code??"")?e.code:null,detailsSuppressed:true}));process.exitCode=1;});
}

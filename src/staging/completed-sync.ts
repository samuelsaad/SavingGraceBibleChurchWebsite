import {readFile,writeFile} from 'node:fs/promises';
import {Pool,type PoolClient} from 'pg';
import {stagingConfiguration,stagingPassword,verifyStagingIdentity} from './guard';
import {completedSchemaMigrations,verifyCompletedSchema} from './completed-schema';
import {validateSchemaMigrationJournal} from '../migration/schema-migrations';
import {databaseFingerprint} from './database-verification';
import {completedTables,sharedTables,digest,quoted,primaryKeys,validateCompletedPacket,type TransferPacket,type TransferRow,type TransferTable} from './completed-packet';
import {completedMembershipSha256,validateCompletedIds,configureCompletedCohort,completedEligibilitySql,membershipHash} from '../domain/completed-staging';

export const protectedMarker='D-167 isolated protected runtime 0218989d1c09224ed301caecb915cefc787a5017f28f6253aee3020a7c3b3ae5';
export const previousMembership='4bf7dbdb97d7ef98e9dd1aa9153f0e04c977776f08e0ba0a420fb266304f1731';
type State={ids:string[];tables:Record<string,{keys:string[];rows:{key:string;hash:string}[]}>;sequenceHash:string;sha256:string};
type Baseline={decision:'D-171';membershipSha256:string;state:State;sha256:string};
function fail(s:string):never{throw Error('d171_'+s);}
async function state(c:PoolClient):Promise<State>{
 const fp=await databaseFingerprint(c),tables:State['tables']={};
 for(const {table} of fp.tables){const keys=await primaryKeys(c,table);const rows=(await c.query('SELECT jsonb_build_array('+keys.map(quoted).join(',')+") pk,encode(digest(to_jsonb(t)::text,'sha256'),'hex') hash FROM "+quoted(table)+' t')).rows.map(r=>({key:digest(r.pk),hash:String(r.hash)})).sort((a,b)=>a.key.localeCompare(b.key));tables[table]={keys,rows};}
 return {ids:(await c.query('SELECT id FROM sermons ORDER BY id')).rows.map(r=>String(r.id)),tables,sequenceHash:fp.sequenceHash,sha256:fp.sha256};
}
export function assertPreserved(before:State,after:State){
 if(before.sequenceHash!==after.sequenceHash)fail('sequence_changed');
 for(const [table,old] of Object.entries(before.tables)){const current=after.tables[table];if(!current||digest(current.keys)!==digest(old.keys))fail('existing_schema_changed');const hashes=new Map(current.rows.map(r=>[r.key,r.hash]));if(old.rows.some(r=>hashes.get(r.key)!==r.hash))fail('existing_row_changed');}
}
function parseBaseline(raw:unknown):Baseline{const b=raw as Baseline;if(!b||b.decision!=='D-171'||b.membershipSha256!==completedMembershipSha256||b.sha256!==digest({...b,sha256:''})||b.state.ids.length!==148||membershipHash(b.state.ids)!==previousMembership)fail('baseline_invalid');return b;}
const path=(file:string)=>'/verification/'+(file==='003-baseline.private.json'?'output/':'')+file;
async function privateRead(file:string){return JSON.parse(await readFile(path(file),'utf8'));}
async function privateSave(file:string,value:unknown){await writeFile(path(file),JSON.stringify(value),{flag:'wx',mode:0o600});}
async function target(c:PoolClient){await verifyStagingIdentity(c,true);const marker=(await c.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0]?.marker;if(marker!==protectedMarker)fail('target_marker_mismatch');}
async function schemaPrefix(c:PoolClient){const defs=await completedSchemaMigrations();const rows=(await c.query('SELECT migration_order,migration_id,checksum_sha256 FROM schema_migrations ORDER BY migration_order')).rows;const count=validateSchemaMigrationJournal(defs,rows);if(![22,25].includes(count))fail('unexpected_schema_prefix');return{defs,count};}
async function row(c:PoolClient,t:TransferTable,keys:string[],value:TransferRow){return (await c.query('SELECT to_jsonb(t) row FROM '+quoted(t)+' t WHERE '+keys.map((k,i)=>quoted(k)+'=$'+(i+1)).join(' AND '),keys.map(k=>value[k]))).rows[0]?.row as TransferRow|undefined;}
export function additionRows(p:TransferPacket,oldIds:readonly string[]):Record<TransferTable,TransferRow[]>{
 const additions=new Set(p.ids.filter(id=>!oldIds.includes(id)));if(additions.size!==131)fail('addition_scope_mismatch');
 const media=new Set(p.tables.sermon_media.rows.filter(r=>additions.has(String(r.sermon_id))).map(r=>r.id));
 return Object.fromEntries(completedTables.map(t=>[t,p.tables[t].rows.filter(r=>sharedTables.has(t)||t==='sermons'?sharedTables.has(t)||additions.has(String(r.id)):t==='audit_events'?additions.has(String(r.entity_id)):t==='sermon_media_source_audit'?media.has(r.sermon_media_id):additions.has(String(r.sermon_id)))])) as Record<TransferTable,TransferRow[]>;
}
export async function insertExactCompletedRow(c:PoolClient,t:TransferTable,keys:string[],value:TransferRow){
 const prior=await row(c,t,keys,value);
 if(prior){if(digest(prior)!==digest(value))fail('concurrent_or_seeded_conflict');return false;}
 const columns=(await c.query("SELECT column_name,is_generated,identity_generation FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[t])).rows;
 if(digest(columns.map(r=>r.column_name).sort())!==digest(Object.keys(value).sort())||digest(await primaryKeys(c,t))!==digest(keys))fail('column_or_key_mismatch');
 const names=columns.filter(r=>r.is_generated==='NEVER'&&r.identity_generation===null).map(r=>quoted(String(r.column_name))).join(',');
 await c.query('WITH x AS(SELECT * FROM jsonb_populate_record(NULL::'+quoted(t)+',$1::jsonb)) INSERT INTO '+quoted(t)+'('+names+') SELECT '+names+' FROM x',[JSON.stringify(value)]);
 return true;
}
export async function appendCompleted(c:PoolClient,p:TransferPacket,b:Baseline,write:boolean){
 validateCompletedPacket(p);configureCompletedCohort(p.ids);await target(c);await verifyCompletedSchema(c);
 await c.query("SET LOCAL savinggrace.application_request='on'");
 await c.query('SELECT pg_advisory_xact_lock(171,279)');
 if(write)for(const {tablename} of (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows)await c.query('LOCK TABLE '+quoted(tablename)+' IN SHARE ROW EXCLUSIVE MODE');
 const before=await state(c);assertPreserved(b.state,before);
 if(before.ids.length!==148&&before.ids.length!==279)fail('target_population_conflict');
 if(before.ids.some(id=>!p.ids.includes(id)))fail('unrelated_target_records');
 const rows=additionRows(p,b.state.ids),adds=p.ids.filter(id=>!b.state.ids.includes(id));
 const conflicts:Record<string,number>={};let missing=0,same=0;
 // Entire preflight runs before the first write. Existing unequal data is never replaced.
 for(const t of completedTables)for(const value of rows[t]){const prior=await row(c,t,p.tables[t].keys,value);if(prior){if(digest(prior)!==digest(value))conflicts[t]=(conflicts[t]??0)+1;else same++;}else missing++;}
 if(Object.keys(conflicts).length)return {outcome:'conflict',conflicts,missing,unchanged:same};
 if(!write)return {outcome:'ready',missing,unchanged:same,additions:adds.length};
 let inserted=0;
 for(const t of completedTables){
  if(t==='sermon_enrichment_reviews'&&before.ids.length===148)await c.query('DELETE FROM sermon_enrichment_reviews WHERE sermon_id=ANY($1::uuid[])',[adds]);
  for(const value of rows[t])if(await insertExactCompletedRow(c,t,p.tables[t].keys,value))inserted++;
 }
 for(const t of completedTables)for(const value of rows[t]){if(digest(await row(c,t,p.tables[t].keys,value))!==digest(value))fail('stored_row_mismatch');}
 const after=await state(c);assertPreserved(b.state,after);validateCompletedIds(after.ids);
 const eligible=(await c.query('SELECT s.id FROM sermons s WHERE '+completedEligibilitySql('s')+' ORDER BY s.id')).rows.map(r=>String(r.id));validateCompletedIds(eligible);
 if(before.ids.length===279&&before.sha256!==after.sha256)fail('idempotency_failed');
 return{outcome:inserted?'imported':'unchanged',inserted,eligible:eligible.length,databaseFingerprint:after.sha256};
}
async function main(){
 const operation=process.argv[2];if(!['baseline','upgrade','plan','import','verify'].includes(operation??''))fail('operation_refused');
 if(process.env.ALLOW_STAGING_D171_SYNC!=='1'||process.env.D171_TARGET!=='existing-protected')fail('gate_required');
 const config=stagingConfiguration(process.env,true),db=new Pool({...config,password:stagingPassword(config.passwordFile),max:1,statement_timeout:120000}),c=await db.connect();
 try{await c.query(operation==='baseline'||operation==='plan'||operation==='verify'?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN ISOLATION LEVEL SERIALIZABLE');await target(c);
  if(operation==='baseline'){await schemaPrefix(c);const s=await state(c);if(s.ids.length!==148||membershipHash(s.ids)!==previousMembership)fail('baseline_membership_mismatch');const b:Baseline={decision:'D-171',membershipSha256:completedMembershipSha256,state:s,sha256:''};b.sha256=digest({...b,sha256:''});await privateSave('003-baseline.private.json',b);console.log(JSON.stringify({outcome:'baseline',sermons:s.ids.length,sha256:b.sha256,databaseFingerprint:s.sha256}));}
  else{const b=parseBaseline(await privateRead('003-baseline.private.json'));
   if(operation==='upgrade'){const {defs,count}=await schemaPrefix(c);const before=await state(c);assertPreserved(b.state,before);for(const m of defs.slice(count)){await c.query(m.upBody);await c.query('INSERT INTO schema_migrations(migration_order,migration_id,checksum_sha256)VALUES($1,$2,$3)',[m.order,m.id,m.checksumSha256]);}await c.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO staging_reader');await verifyCompletedSchema(c);const after=await state(c);assertPreserved(b.state,after);console.log(JSON.stringify({outcome:count===25?'unchanged':'upgraded',migrations:25,priorRowsPreserved:true}));}
   else{const p=validateCompletedPacket(await privateRead('001-source.private.json'));const result=await appendCompleted(c,p,b,operation==='import');if(result.outcome==='conflict'){console.log(JSON.stringify(result));fail('preflight_conflict');}if(operation==='verify'){if(result.missing!==0)fail('incomplete_import');validateCompletedIds((await c.query('SELECT s.id FROM sermons s WHERE '+completedEligibilitySql('s')+' ORDER BY s.id')).rows.map(r=>r.id));}console.log(JSON.stringify(result));}
  }
  await c.query(operation==='baseline'||operation==='plan'||operation==='verify'?'ROLLBACK':'COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await db.end();}
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/completed-sync.ts')||process.argv[1]?.endsWith('completed-sync.cjs'))main().catch(e=>{console.error(JSON.stringify({outcome:'stopped_safely',code:e instanceof Error&&/^d171_[a-z_]+$/u.test(e.message)?e.message:'d171_sync_failed',sqlState:/^[A-Z0-9]{5}$/u.test(e?.code??'')?e.code:null}));process.exitCode=1;});

import {readFile,writeFile} from 'node:fs/promises';
import {Pool,type PoolClient} from 'pg';
import {stagingConfiguration,stagingPassword,verifyStagingIdentity} from './guard';
import {verifyCompletedSchema} from './completed-schema';
import {databaseFingerprint} from './database-verification';
import {digest,quoted,primaryKeys,type TransferRow} from './completed-packet';
import {insertExactCompletedRow,protectedMarker} from './completed-sync';
import {d175ManifestSha256,d175AcceptanceSql} from '../domain/sermonaudio-completion';
import {loadCompletedCohort} from './completed-cohort';
import {completedEligibilitySql} from '../domain/completed-staging';
import {validateSermonAudioCompletionPacket,sermonAudioCompletionTables,sermonAudioTargetRows,type SermonAudioCompletionPacket,type SermonAudioCompletionTable} from './sermonaudio-completion-packet';

export type SermonAudioTransferState={ids:string[];tables:Record<string,{keys:string[];rows:{key:string;hash:string}[]}>;sequenceHash:string;sha256:string};
type Baseline={decision:'D-175';manifestSha256:string;packetSha256:string;state:SermonAudioTransferState;sha256:string};
function fail(code:string):never{throw Error('d175_sync_'+code);}
export async function captureSermonAudioTransferState(c:PoolClient):Promise<SermonAudioTransferState>{
 const fingerprint=await databaseFingerprint(c),tables:SermonAudioTransferState['tables']={};
 for(const {table} of fingerprint.tables){const keys=await primaryKeys(c,table);const rows=(await c.query('SELECT jsonb_build_array('+keys.map(quoted).join(',')+") pk,encode(digest(to_jsonb(t)::text,'sha256'),'hex') hash FROM "+quoted(table)+' t')).rows.map(r=>({key:digest(r.pk),hash:String(r.hash)})).sort((a,b)=>a.key.localeCompare(b.key));tables[table]={keys,rows};}
 return{ids:(await c.query('SELECT id FROM sermons ORDER BY id')).rows.map(r=>String(r.id)),tables,sequenceHash:fingerprint.sequenceHash,sha256:fingerprint.sha256};
}
export function assertSermonAudioTransferPreserved(before:SermonAudioTransferState,after:SermonAudioTransferState){
 if(before.sequenceHash!==after.sequenceHash)fail('existing_sequence_changed');
 for(const [table,old] of Object.entries(before.tables)){const current=after.tables[table];if(!current||digest(old.keys)!==digest(current.keys))fail('existing_schema_changed');const hashes=new Map(current.rows.map(r=>[r.key,r.hash]));if(old.rows.some(r=>hashes.get(r.key)!==r.hash))fail('existing_row_changed');}
}
async function stored(c:PoolClient,t:SermonAudioCompletionTable,keys:string[],value:TransferRow){return(await c.query('SELECT to_jsonb(t) row FROM '+quoted(t)+' t WHERE '+keys.map((k,i)=>quoted(k)+'=$'+(i+1)).join(' AND '),keys.map(k=>value[k]))).rows[0]?.row as TransferRow|undefined;}
/** Caller supplies one SERIALIZABLE transaction and verified destination. Exact
 * inserts only: never UPDATE/DELETE, grant changes, migrations or approval. */
export async function appendSermonAudioTarget(c:PoolClient,p:SermonAudioCompletionPacket,id:string,write:boolean){
 const data=sermonAudioTargetRows(p,id),identity=data.sermons[0]!;
 const collision=(await c.query('SELECT id FROM sermons WHERE source_wordpress_id=$1 OR slug=$2',[identity.source_wordpress_id,identity.slug])).rows;
 if(collision.some(r=>r.id!==id))return{outcome:'conflict' as const,conflicts:{sermons:1},missing:0,unchanged:0};
 const conflicts:Record<string,number>={};let missing=0,unchanged=0;
 for(const t of sermonAudioCompletionTables)for(const value of data[t]){const prior=await stored(c,t,p.tables[t].keys,value);if(prior){if(digest(prior)!==digest(value))conflicts[t]=(conflicts[t]??0)+1;else unchanged++;}else missing++;}
 if(Object.keys(conflicts).length)return{outcome:'conflict' as const,conflicts,missing,unchanged};
 if(!write)return{outcome:'ready' as const,missing,unchanged};
 let inserted=0;
 for(const t of sermonAudioCompletionTables)for(const value of data[t])if(await insertExactCompletedRow(c,t,p.tables[t].keys,value))inserted++;
 for(const t of sermonAudioCompletionTables)for(const value of data[t])if(digest(await stored(c,t,p.tables[t].keys,value))!==digest(value))fail('stored_row_mismatch');
 if(!(await c.query('SELECT '+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE id=$1',[id])).rows[0]?.accepted)fail('acceptance_dependency_mismatch');
 return{outcome:inserted?'imported' as const:'unchanged' as const,inserted,missing:0,unchanged};
}
async function target(c:PoolClient){
 await verifyStagingIdentity(c,true);await verifyCompletedSchema(c);
 const marker=(await c.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0]?.marker;
 if(marker!==protectedMarker)fail('target_marker_mismatch');
}
function baseline(raw:unknown,p:SermonAudioCompletionPacket){const b=raw as Baseline;if(!b||b.decision!=='D-175'||b.manifestSha256!==d175ManifestSha256||b.packetSha256!==p.sha256||b.sha256!==digest({...b,sha256:''}))fail('baseline_invalid');return b;}
async function main(){
 const operation=process.argv[2];if(!['baseline','plan','import','verify'].includes(operation??''))fail('operation_refused');
 if(process.env.ALLOW_STAGING_D175_SYNC!=='1'||process.env.D175_TARGET!=='existing-protected')fail('explicit_gate_required');
 const p=validateSermonAudioCompletionPacket(JSON.parse(await readFile('/verification/source.private.json','utf8')));
 await loadCompletedCohort('/verification/cohort.private.json');
 const config=stagingConfiguration(process.env,true),pool=new Pool({...config,password:stagingPassword(config.passwordFile),max:1,statement_timeout:120000}),c=await pool.connect();
 try{
  if(operation==='baseline'){
   await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await target(c);
   const state=await captureSermonAudioTransferState(c);
   const oldEligible=(await c.query('SELECT s.id FROM sermons s WHERE '+completedEligibilitySql('s')+' ORDER BY s.id')).rows;
   if(oldEligible.length!==279)fail('previous_cohort_not_fresh');
   const b:Baseline={decision:'D-175',manifestSha256:d175ManifestSha256,packetSha256:p.sha256,state,sha256:''};b.sha256=digest({...b,sha256:''});
   await writeFile('/verification/output/baseline.private.json',JSON.stringify(b),{flag:'wx',mode:0o600});await c.query('ROLLBACK');
   console.log(JSON.stringify({outcome:'baseline',sermons:state.ids.length,previousEligible:oldEligible.length,databaseFingerprint:state.sha256,baselineSha256:b.sha256}));return;
  }
  const b=baseline(JSON.parse(await readFile('/verification/output/baseline.private.json','utf8')),p);
  let imported=0,unchanged=0,ready=0,conflicted=0,failed=0;
  for(const [index,id] of p.ids.entries()){
   try{
    const write=operation==='import';await c.query(write?'BEGIN ISOLATION LEVEL SERIALIZABLE':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await target(c);
    if(write){await c.query("SET LOCAL savinggrace.application_request='on'");await c.query('SELECT pg_advisory_xact_lock(175,119)');for(const {tablename} of(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows)await c.query('LOCK TABLE '+quoted(tablename)+' IN SHARE ROW EXCLUSIVE MODE');}
    const before=await captureSermonAudioTransferState(c);assertSermonAudioTransferPreserved(b.state,before);
    const result=await appendSermonAudioTarget(c,p,id,write);
    if(result.outcome==='conflict'){conflicted++;await c.query('ROLLBACK');console.log(JSON.stringify({position:index+1,outcome:'conflict',tables:result.conflicts}));continue;}
    if(operation==='verify'&&result.missing!==0)fail('target_incomplete');
    const after=await captureSermonAudioTransferState(c);assertSermonAudioTransferPreserved(b.state,after);assertSermonAudioTransferPreserved(before,after);
    if(result.outcome==='unchanged'&&before.sha256!==after.sha256)fail('idempotency_failed');
    await c.query(write?'COMMIT':'ROLLBACK');
    if(result.outcome==='imported')imported++;else if(result.outcome==='unchanged')unchanged++;else ready++;
    console.log(JSON.stringify({position:index+1,outcome:result.outcome,inserted:'inserted' in result?result.inserted:0}));
   }catch(error){await c.query('ROLLBACK');failed++;console.log(JSON.stringify({position:index+1,outcome:'failed',code:error instanceof Error&&/^(d175|d171)_[a-z_]+$/u.test(error.message)?error.message:'d175_sync_record_failed',sqlState:/^[A-Z0-9]{5}$/u.test((error as {code?:string})?.code??'')?(error as {code:string}).code:null}));}
  }
  console.log(JSON.stringify({outcome:failed||conflicted?'partial':'verified',targets:p.ids.length,imported,unchanged,ready,conflicted,failed}));if(failed||conflicted)process.exitCode=1;
 }finally{await c.query('ROLLBACK');c.release();await pool.end();}
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/sermonaudio-completion-sync.ts')||process.argv[1]?.endsWith('sermonaudio-completion-sync.cjs'))main().catch(error=>{console.error(JSON.stringify({outcome:'stopped_safely',code:error instanceof Error&&/^(d175|d171|staging)_[a-z_]+$/u.test(error.message)?error.message:'d175_sync_failed'}));process.exitCode=1;});

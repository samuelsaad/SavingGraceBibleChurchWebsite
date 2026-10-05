import {Pool} from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {validateAudioPacket} from './sermonaudio-packet';
import {stagingConfiguration,stagingPassword,verifyStagingIdentity} from './guard';
import {databaseFingerprint,verifyReleaseSchema} from './database-verification';
import {applyReviewedSermonAudioLink} from '../metadata/sermonaudio-review-refresh';
import {frontendSermonEligibilitySql} from '../server/queries/public-sermons';

async function main(){
 if(process.env.ALLOW_STAGING_SERMONAUDIO_SYNC!=='1'||!['public','protected'].includes(process.env.SERMONAUDIO_SYNC_RUNTIME??''))throw Error('audio_sync_gate_refused');
 const input=process.env.SERMONAUDIO_SYNC_PACKET,output=process.env.SERMONAUDIO_SYNC_RECEIPT;
 if(!input||!output||!isAbsolute(input)||!isAbsolute(output)||!input.endsWith('.private.json')||!output.endsWith('.private.json'))throw Error('audio_sync_paths_refused');
 const packet=validateAudioPacket(JSON.parse(await readFile(input,'utf8')));
 const config=stagingConfiguration(process.env,true),pool=new Pool({...config,password:stagingPassword(config.passwordFile),max:1,statement_timeout:60000});
 const c=await pool.connect();try{
  await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await c.query("SET LOCAL savinggrace.application_request='on'");
  await verifyStagingIdentity(c,true);
  const publicRuntime=process.env.SERMONAUDIO_SYNC_RUNTIME==='public';await verifyReleaseSchema(c,publicRuntime?21:22);
  const before=await databaseFingerprint(c);
  if(before.counts.sermons!==(publicRuntime?191:148))throw Error('audio_sync_membership_conflict');
  const scope=publicRuntime?'d161_restricted_accepted':'d167_restricted_accepted';
  const eligibility=frontendSermonEligibilitySql('s',scope);
  const membership=(await c.query(`SELECT s.id FROM sermons s ORDER BY s.id`)).rows.map(r=>r.id);
  const eligible=(await c.query(`SELECT s.id FROM sermons s WHERE ${eligibility} ORDER BY s.id`)).rows.map(r=>r.id);
  if(eligible.length!==148)throw Error('audio_sync_prior_eligibility_conflict');
  const preserved=await preservation(c),results=[];
  // Recovery is captured before writes; the caller's explicit protected output
  // path is outside images/Git. No accounts, sessions or whole database export.
  const recovery={version:1,packetSha256:packet.sha256,before,preserved,membership,eligible,
   media:(await c.query('SELECT to_jsonb(m) row FROM sermon_media m ORDER BY id')).rows.map(r=>r.row)};
  await writeFile(output.replace('.private.json','-recovery.private.json'),JSON.stringify(recovery),{flag:'wx',mode:0o600});
  for(const r of packet.records){
   if(!membership.includes(r.link.sermonId)){results.push({sermonId:r.link.sermonId,outcome:'not_present'});continue;}
   const result=await applyReviewedSermonAudioLink(c,r.link,r.assessment);results.push({sermonId:r.link.sermonId,...result});
  }
  const after=await databaseFingerprint(c),afterPreserved=await preservation(c);
  if(JSON.stringify(preserved)!==JSON.stringify(afterPreserved))throw Error('audio_sync_original_content_or_reviews_changed');
  const newEligible=(await c.query(`SELECT s.id FROM sermons s WHERE ${eligibility} ORDER BY s.id`)).rows.map(r=>r.id);
  if(JSON.stringify(newEligible)!==JSON.stringify(eligible))throw Error('audio_sync_eligibility_changed');
  const afterMembership=(await c.query('SELECT id FROM sermons ORDER BY id')).rows.map(r=>r.id);
  if(JSON.stringify(membership)!==JSON.stringify(afterMembership))throw Error('audio_sync_membership_changed');
  const mutable=new Set(['sermons','sermon_media','sermon_media_source_audit','sermon_extensions','audit_events']);
  for(const table of before.tables)if(!mutable.has(table.table)&&JSON.stringify(table)!==JSON.stringify(after.tables.find(t=>t.table===table.table)))throw Error('audio_sync_unrelated_table_changed');
  await c.query('COMMIT');
  const receipt={status:'scoped_media_sync_verified',runtime:process.env.SERMONAUDIO_SYNC_RUNTIME,packetSha256:packet.sha256,results,
   beforeFingerprint:before.sha256,afterFingerprint:after.sha256,sermons:after.counts.sermons,eligible:newEligible.length,
   originalContentAndReviewsPreserved:true,membershipPreserved:true};
  await writeFile(output,JSON.stringify(receipt),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({...receipt,results:undefined,outcomes:results.reduce((a:Record<string,number>,r)=>{a[r.outcome]=(a[r.outcome]??0)+1;return a;},{})}));
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
}
async function preservation(c:any){
 const rows=(await c.query("SELECT id,encode(digest((to_jsonb(s)-'row_version'-'updated_at'-'updated_by_subject')::text,'sha256'),'hex') hash FROM sermons s ORDER BY id")).rows;
 return rows;
}
main().catch(e=>{console.log(JSON.stringify({status:'stopped_safely',code:/^[a-z_]+$/.test(e?.message??'')?e.message:'audio_sync_failed',sqlState:/^[A-Z0-9]{5}$/.test(e?.code??'')?e.code:null,detailsSuppressed:true}));process.exitCode=1;});

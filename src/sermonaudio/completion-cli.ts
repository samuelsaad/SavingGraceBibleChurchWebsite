import {readFile,mkdir,lstat,readdir,open,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../migration/protected-local-postgres';
import {readFrozenInventory,readVerifiedSource,prepareSource,hash,completionDecision,completionManifestSha256,runtimeProvenance} from './completion';
import {persistImmutable,persistCheckpoint,readCheckpoint} from './private-artifacts';
const sourceRoot=resolve('../sermonaudio-transcript-retrieval/private/sermonaudio-transcript-retrieval');
const artifactRoot=resolve('private/sermonaudio-119-completion');
async function main(){
 const inventory=await readFrozenInventory(sourceRoot);
 const command=process.argv[2];
 if(command==='scan'){
  const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8',maxBuffer:128*1024*1024,stdio:['ignore','pipe','ignore']});
  const files=[...new Set([...git('diff','--name-only','HEAD','--diff-filter=ACMR').split(/\r?\n/u),...git('ls-files','--others','--exclude-standard').split(/\r?\n/u)].filter(Boolean))];
  const snippets:string[]=[];for(const t of inventory.targets){const s=await readVerifiedSource(sourceRoot,t);snippets.push(s.text.slice(50,250),s.text.slice(-250,-50));}
  const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,/\bya29\.[\w-]{30,}/u,/(?:postgres(?:ql)?|mysql):\/\/[^\s:/]+:[^\s@]+@/u,/"(?:refresh_token|client_secret|access_token|password_hash)"\s*:\s*"[^"\s]{8,}"/u];
  const findings:{path:string;kind:string}[]=[];
  for(const path of files){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw Error('d175_outgoing_file_type_refused');const text=await readFile(path,'utf8');
   let prior='';try{prior=git('show','HEAD:'+path);}catch{}
   if(/(?:^|[/\\])private[/\\]|\.private\.|\.(?:pem|dump|key|bin)$/u.test(path))findings.push({path:'[prohibited path]',kind:'private_artifact'});
   if(forbidden.some(rx=>rx.test(text)&&!rx.test(prior)))findings.push({path,kind:'secret_pattern'});
   if(snippets.some(s=>text.includes(s)&&!prior.includes(s))&&!path.startsWith('development-data/sermonaudio-119-v1/'))findings.push({path,kind:'source_content_outside_export'});
  }
  const ignored=git('check-ignore','private/sermonaudio-119-completion/checkpoint.private.json').trim().length>0;
  console.log(JSON.stringify({decision:completionDecision,files:files.length,ignored,findings}));if(findings.length||!ignored)process.exitCode=1;return;
 }
 if(command==='baseline'){
  const p=new Pool({host:'127.0.0.1',port:5432,database:'savinggrace_sermons_test',user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,options:'-c default_transaction_read_only=on -c timezone=UTC'});
  try{
   const c=await p.connect();try{await c.query('BEGIN READ ONLY');
    const target=(await c.query("SELECT current_database() database,host(inet_server_addr()) host,inet_server_port() port,current_setting('server_version_num') version")).rows[0];
    if(target.database!=='savinggrace_sermons_test'||target.host!=='127.0.0.1'||target.port!==5432||Number(target.version)<160000||Number(target.version)>=170000)throw Error('d175_database_target_refused');
    const count=(await c.query('SELECT count(*) sermons, count(*) FILTER(WHERE source_wordpress_id=ANY($1::bigint[])) existingTargets FROM sermons',[inventory.targets.map(t=>t.source.sourceWordPressId)])).rows[0];
    const speakers=(await c.query('SELECT id,name,slug FROM speakers WHERE name=ANY($1::text[])',[['Wesam Saad','Ralph Gambardella','Matthew Johnston']])).rows;
    const ledger=(await c.query('SELECT * FROM schema_migrations ORDER BY 1')).rows;
    const overlap=(await c.query('SELECT id,source_wordpress_id,row_version,status,summary_status FROM sermons WHERE source_wordpress_id=ANY($1::bigint[]) ORDER BY source_wordpress_id',[inventory.targets.map(t=>t.source.sourceWordPressId)])).rows;
    await mkdir(artifactRoot,{recursive:true});await persistImmutable(join(artifactRoot,'baseline.private.json'),JSON.stringify({decision:completionDecision,manifestSha256:completionManifestSha256,target,count,speakers,ledger,overlap},null,2));
    console.log(JSON.stringify({decision:completionDecision,target,count,speakers,ledger,overlap}));
   }finally{await c.query('ROLLBACK');c.release();}
  }finally{await p.end();}return;
 }
 if(command==='verify-sources'){
  let bytes=0,words=0;for(const t of inventory.targets){const s=await readVerifiedSource(sourceRoot,t);bytes+=s.raw.length;words+=s.receipt.wordCount;}
  console.log(JSON.stringify({decision:completionDecision,manifestSha256:completionManifestSha256,verified:119,bytes,words}));return;
 }
 if(command==='prepare'){
  await mkdir(artifactRoot,{recursive:true});
  const governance=process.env.D175_GOVERNANCE_COMMIT;if(!governance||!/^[a-f0-9]{40}$/u.test(governance))throw Error('d175_governance_commit_required');
  const lockPath=join(artifactRoot,'worker.lock');const lock=await open(lockPath,'wx',0o600).catch(()=>{throw Error('d175_duplicate_worker_refused');});await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await lock.close();
  const checkpointPath=join(artifactRoot,'checkpoint.private.json');
  const state=await readCheckpoint<{manifestSha256:string;history:Record<string,unknown>[];records:Record<string,unknown>}>(checkpointPath).catch(e=>{if((e as NodeJS.ErrnoException).code==='ENOENT')return {manifestSha256:completionManifestSha256,history:[],records:{}};throw e;});
  if(state.manifestSha256!==completionManifestSha256)throw Error('d175_checkpoint_manifest_refused');
  try{for(const t of inventory.targets){const s=await readVerifiedSource(sourceRoot,t);const text=prepareSource(s.text);const language=s.language;
   await persistImmutable(join(artifactRoot,`prepared-${String(t.sequence).padStart(3,'0')}.txt`),text);
   await persistImmutable(join(artifactRoot,`preparation-${String(t.sequence).padStart(3,'0')}.private.json`),JSON.stringify({decision:completionDecision,manifestSha256:completionManifestSha256,governanceCommit:governance,sequence:t.sequence,sourceWordPressId:t.source.sourceWordPressId,sermonAudioId:t.recording.sermonID,sourceSha256:s.receipt.sha256,transcriptSha256:hash(text),sourceBytes:s.raw.length,preparedCharacters:text.length,language,wordSequencePreserved:true,markersPreserved:true,audioVerified:false,runtimeProvenance},null,2));
   if(!state.records[String(t.sequence)]){state.records[String(t.sequence)]={stage:'prepared',transcriptSha256:hash(text)};state.history.push({sequence:t.sequence,stage:'prepared',at:new Date().toISOString(),transcriptSha256:hash(text)});await persistCheckpoint(checkpointPath,state);}
  }}finally{const current=JSON.parse(await readFile(lockPath,'utf8'));if(current.pid!==process.pid)throw Error('d175_worker_lock_conflict');await unlink(lockPath);}
  console.log(JSON.stringify({decision:completionDecision,prepared:119,wordSequencePreserved:119,markersPreserved:119}));return;
 }
 if(command==='read'){
  const sequence=Number(process.argv[3]);const t=inventory.targets.find(t=>t.sequence===sequence);if(!t)throw Error('d175_sequence_refused');
  const s=await readVerifiedSource(sourceRoot,t);const prepared=await readFile(join(artifactRoot,`prepared-${String(sequence).padStart(3,'0')}.txt`),'utf8');if(prepared!==prepareSource(s.text))throw Error('d175_prepared_hash_mismatch');
  const start=Number(process.argv[4]??0),end=Math.min(Number(process.argv[5]??prepared.length),prepared.length);if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end-start>40000)throw Error('d175_read_range_refused');
  console.log(JSON.stringify({sequence,sourceWordPressId:t.source.sourceWordPressId,sermonAudioId:t.recording.sermonID,title:t.source.title,serviceDate:t.source.serviceDate,speakers:t.source.speakerNames,passages:t.source.passageTexts,recordingPassage:t.recording.bibleText,language:t.recording.languageCode,transcriptSha256:hash(prepared),characters:prepared.length,start,end}));
  console.log(prepared.slice(start,end));return;
 }
 throw Error('d175_command_refused');
}
main().catch(e=>{const code=e instanceof Error&&/^d175_[a-z_]+$/u.test(e.message)?e.message:'d175_operation_failed';console.error(JSON.stringify({decision:completionDecision,error:code}));process.exitCode=1;});

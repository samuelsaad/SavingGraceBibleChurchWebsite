/** D-181 private restoration proof. Never restores over the source database. */
import {createHash,randomBytes} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,lstat,realpath,chmod,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Pool,type PoolClient} from 'pg';
import {assertReadOnlyLocalDatabase} from '../src/migration/local-database-safety';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../src/migration/protected-local-postgres';
import {createVersionedSourceHandler} from '../src/seo/runtime-snapshot';
import {readSourcePublicPages} from '../src/seo/source-public-store';
import {sourceOrigin} from '../src/seo/source-public-model';
import {restoreConstraintCanonical} from './seo-restore-constraint-equivalence';

const sourceDatabase='savinggrace_sermons_test';
const sourceUrl='postgresql://127.0.0.1:5432/'+sourceDatabase;
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const executeFile=promisify(execFile);
export interface TableFingerprint {rows:number;sha256:string}
export type DatabaseFingerprint=Record<string,TableFingerprint>;

export function recoveryTarget(token:string,env:NodeJS.ProcessEnv):string {
 if(env.ALLOW_LOCAL_DB_WRITE!=='1'||env.ALLOW_LOCAL_SEO_RESTORE!=='1')throw Error('seo_restore_opt_in_required');
 if(token!=='seo_restore_20261011')throw Error('seo_restore_target_refused');
 return 'savinggrace_test_run_seo_restore_20261011';
}
export function assertRecoveryAuthority(governance:string):void {
 const start=governance.indexOf('## D-182'),end=governance.indexOf('\n## ',start+1),scope=governance.slice(start,end<0?undefined:end);
 if(start<0||!scope.includes('backup/restoration demonstration only')||!scope.includes('savinggrace_test_run_seo_restore_20261011')||!scope.includes('ALLOW_LOCAL_SEO_RESTORE=1')||!scope.includes('Never restore over the source'))throw Error('seo_restore_governance_required');
}
export function fingerprintSql(table:string):string {
 if(!/^[a-z][a-z0-9_]*$/u.test(table))throw Error('seo_restore_table_identifier');
 const digest="encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')";
 return `SELECT count(*)::text AS rows,encode(sha256(convert_to(COALESCE(string_agg(${digest},'' ORDER BY ${digest}),''),'UTF8')),'hex') AS sha256 FROM public."${table}" t`;
}
export function compareFingerprints(source:DatabaseFingerprint,restored:DatabaseFingerprint):void {
 const names=Object.keys(source).sort();
 if(JSON.stringify(names)!==JSON.stringify(Object.keys(restored).sort())||names.some(name=>source[name]!.rows!==restored[name]!.rows||source[name]!.sha256!==restored[name]!.sha256))throw Error('seo_restore_fingerprint_mismatch');
 for(const name of ['sermons','cms_entities','cms_revisions','cms_routes','schema_migrations'])if(!source[name])throw Error('seo_restore_required_table_missing');
 const sourceTables=['source_public_versions','source_public_routes','source_public_imports'].filter(name=>source[name]);
 if(sourceTables.length!==0&&sourceTables.length!==3)throw Error('seo_restore_partial_source_schema');
}
async function identity(client:Pick<PoolClient,'query'>,database:string,readOnly:boolean):Promise<void>{
 const row=(await client.query(`SELECT current_database() AS database,current_setting('server_version_num')::integer AS version,inet_server_addr()='127.0.0.1'::inet AS loopback,inet_server_port() AS port,current_setting('transaction_read_only') AS read_only,version() LIKE 'PostgreSQL%' AS postgres`)).rows[0];
 if(!row||row.database!==database||row.version<160000||row.version>=170000||!row.loopback||row.port!==5432||!row.postgres||(readOnly&&row.read_only!=='on'))throw Error('seo_restore_server_identity');
}
async function fingerprints(client:Pick<PoolClient,'query'>):Promise<DatabaseFingerprint>{
 const tables=(await client.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 const result:DatabaseFingerprint={};
 for(const {tablename}of tables){const row=(await client.query<{rows:string;sha256:string}>(fingerprintSql(tablename))).rows[0]!;const count=Number(row.rows);if(!Number.isSafeInteger(count)||count<0||! /^[a-f0-9]{64}$/u.test(row.sha256))throw Error('seo_restore_invalid_fingerprint');result[tablename]={rows:count,sha256:row.sha256};}
 return result;
}
async function schemaFingerprint(client:Pick<PoolClient,'query'>,receipt?:string):Promise<string>{
 const definitions=await client.query(`SELECT 'constraint' AS kind,c.conrelid::regclass::text AS parent,c.conname AS name,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'
 UNION ALL SELECT 'index',tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'
 UNION ALL SELECT 'column',table_name,column_name,concat_ws('|',data_type,udt_name,is_nullable,column_default) FROM information_schema.columns WHERE table_schema='public'
 UNION ALL SELECT 'trigger',event_object_table,trigger_name,action_statement FROM information_schema.triggers WHERE trigger_schema='public'
 ORDER BY kind,parent,name,definition`);
 const sequences=(await client.query("SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")).rows;
 const values=[];for(const {sequencename}of sequences){if(!/^[a-z][a-z0-9_]*$/u.test(sequencename))throw Error('seo_restore_sequence_identifier');values.push({name:sequencename,...(await client.query(`SELECT last_value::text,is_called FROM public."${sequencename}"`)).rows[0]});}
 const captured={definitions:definitions.rows,sequences:values};if(receipt)await privateFile(receipt,captured);
 return hash(JSON.stringify({...captured,definitions:definitions.rows.map(row=>({...row,definition:row.kind==='constraint'?restoreConstraintCanonical(row.name,row.definition):row.definition}))}));
}
async function restoreAssets(source:string,destination:string):Promise<{files:number;bytes:number;sha256:string}>{
 const root=await realpath(source),items:Array<{path:string;sha256:string;bytes:number}>=[];
 const visit=async(path:string)=>{for(const entry of await readdir(path,{withFileTypes:true})){
  const absolute=join(path,entry.name),stat=await lstat(absolute);if(stat.isSymbolicLink()||await realpath(absolute)!==absolute)throw Error('seo_restore_asset_symlink');
  const name=relative(root,absolute);if(name.startsWith('..')||isAbsolute(name))throw Error('seo_restore_asset_escape');
  const output=join(destination,name);
  if(stat.isDirectory()){await mkdir(output,{recursive:true,mode:0o700});await visit(absolute);}
  else if(stat.isFile()){
   const bytes=await readFile(absolute);await writeFile(output,bytes,{flag:'wx',mode:0o600});
   if(hash(await readFile(output))!==hash(bytes))throw Error('seo_restore_asset_hash');items.push({path:name.replaceAll('\\','/'),sha256:hash(bytes),bytes:bytes.length});
  }else throw Error('seo_restore_asset_type');
 }};await mkdir(destination,{mode:0o700});await visit(root);items.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 return {files:items.length,bytes:items.reduce((n,item)=>n+item.bytes,0),sha256:hash(JSON.stringify(items))};
}
async function applicationProof(pool:Pool,directory:string):Promise<{resourceRoutes:number;httpChecks:number}>{
 const pages=await readSourcePublicPages(pool),handler=await createVersionedSourceHandler({reader:pool,assetDirectory:directory,releaseIdentity:'0'.repeat(40),policy:{environment:'production',canonicalOrigin:sourceOrigin}});
 let resources=0;for(const page of pages.filter(page=>page.asset)){
  const response=await handler(new Request(sourceOrigin+page.path));const bytes=Buffer.from(await response.arrayBuffer());
  if(response.status!==200||hash(bytes)!==page.asset!.sha256||bytes.length!==page.asset!.bytes||response.headers.get('Content-Type')?.split(';')[0]!==page.asset!.contentType)throw Error('seo_restore_resource_response');resources++;
 }
 const server=createServer(async(req,res)=>{try{if(req.method!=='GET'||req.headers.host!=='127.0.0.1:4446')throw Error();const response=await handler(new Request(sourceOrigin+(req.url??'/')));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(503);res.end();}});
 await new Promise<void>((done,reject)=>{server.once('error',reject);server.listen(4446,'127.0.0.1',done);});
 let checks=0;try{const targets=['/','/sermons/','/robots.txt','/sitemap.xml','/admin/','/frontend-preview/',pages.find(page=>page.kind==='sermon')!.path,pages.find(page=>page.kind==='event')!.path];
  for(const path of targets){const response=await fetch('http://127.0.0.1:4446'+path,{redirect:'manual'});const expected=/^\/(?:admin|frontend-preview)/u.test(path)?404:200;if(response.status!==expected)throw Error('seo_restore_http_response');const body=await response.text();if(expected===200&&response.headers.get('Content-Type')?.includes('text/html')&&!body.includes(sourceOrigin))throw Error('seo_restore_canonical_response');checks++;}
 }finally{await new Promise<void>(done=>server.close(()=>done()));}
 return {resourceRoutes:resources,httpChecks:checks};
}
async function privateFile(path:string,value:unknown):Promise<void>{await writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
async function runTool(binary:string,args:string[],env:NodeJS.ProcessEnv):Promise<void>{
 await new Promise<void>((done,reject)=>{
  const child=spawn(binary,args,{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
  // PostgreSQL errors can include source values. Drain them without logging.
  child.stderr?.on('data',()=>{});
  const timer=setTimeout(()=>{child.kill();reject(Error('seo_restore_tool_timeout'));},15*60*1000);
  child.once('error',()=>{clearTimeout(timer);reject(Error('seo_restore_tool_failed'));});
  child.once('exit',code=>{clearTimeout(timer);code===0?done():reject(Error('seo_restore_tool_failed'));});
 });
}
async function toolDirectory():Promise<string>{
 const path=process.platform==='win32'?'C:/Program Files/PostgreSQL/16/bin':'/usr/lib/postgresql/16/bin';
 const directory=await realpath(path);
 for(const name of ['pg_dump','pg_restore']){
  const binary=join(directory,name+(process.platform==='win32'?'.exe':'')),stat=await lstat(binary);if(!stat.isFile()||stat.isSymbolicLink())throw Error('seo_restore_tool_file');
  const {stdout}=await executeFile(binary,['--version'],{windowsHide:true,timeout:5000});if(!new RegExp('^'+name+' \\(PostgreSQL\\) 16\\.').test(stdout))throw Error('seo_restore_tool_version');
 }
 return directory;
}

export async function runLocalRecoveryProof():Promise<void>{
 assertRecoveryAuthority(await readFile('AGENTS.md','utf8'));
 const token='seo_restore_20261011',runId=new Date().toISOString().replace(/\D/gu,'')+randomBytes(8).toString('hex'),target=recoveryTarget(token,process.env);
 assertReadOnlyLocalDatabase(sourceUrl);
 const tools=await toolDirectory(),suffix=process.platform==='win32'?'.exe':'',password=await protectedLocalPostgresPassword();
 const connection={host:'127.0.0.1',port:5432,user:protectedLocalPostgresUser,password,max:1,connectionTimeoutMillis:5000,statement_timeout:120000,options:'-c timezone=UTC',application_name:'d181-private-local-recovery-proof'};
 const admin=new Pool({...connection,database:'postgres'}),source=new Pool({...connection,database:sourceDatabase}),restored=new Pool({...connection,database:target});
 const root=await realpath(process.cwd()),directory=resolve(root,'private/seo-recovery',runId),relativePath=relative(root,directory);
 if(relativePath.startsWith('..')||isAbsolute(relativePath))throw Error('seo_restore_private_directory');
 await mkdir(directory,{recursive:true,mode:0o700});
 // The fixed private tree is ignored; refuse symlinked ancestors or output files.
 for(let current=directory;current!==root;current=resolve(current,'..'))if((await lstat(current)).isSymbolicLink())throw Error('seo_restore_private_symlink');
 const archive=join(directory,'local-before.private.dump');
 const childEnv:NodeJS.ProcessEnv=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/^PG/iu.test(name)));
 childEnv.PGPASSWORD=password;childEnv.PGCONNECT_TIMEOUT='5';childEnv.PGOPTIONS='-c timezone=UTC';
 const args=['--host=127.0.0.1','--port=5432','--username='+protectedLocalPostgresUser,'--no-password'];
 let created=false,createdOid:string|undefined,removed=false,sourceClient:PoolClient|undefined,sourceTransaction=false,proof:Record<string,unknown>|undefined;
 let failure:unknown;
 try{
  await identity(admin,'postgres',false);
  if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rowCount)throw Error('seo_restore_target_exists');
  sourceClient=await source.connect();await sourceClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');sourceTransaction=true;await identity(sourceClient,sourceDatabase,true);
  const snapshot=(await sourceClient.query<{snapshot:string}>('SELECT pg_export_snapshot() AS snapshot')).rows[0]!.snapshot;
  if(!/^[A-Fa-f0-9-]+$/u.test(snapshot))throw Error('seo_restore_snapshot_identity');
  await runTool(join(tools,'pg_dump'+suffix),[...args,'--dbname='+sourceDatabase,'--format=custom','--snapshot='+snapshot,'--file='+archive],childEnv);await chmod(archive,0o600);
  const bytes=await readFile(archive);if(bytes.subarray(0,5).toString()!=='PGDMP')throw Error('seo_restore_dump_header');
  const before=await fingerprints(sourceClient),beforeSchema=await schemaFingerprint(sourceClient,join(directory,'schema-before.private.json'));await sourceClient.query('ROLLBACK');sourceTransaction=false;sourceClient.release();sourceClient=undefined;
  compareFingerprints(before,before);
  await privateFile(join(directory,'source-snapshot.private.json'),{snapshot,sourceDatabase,tables:before,archiveSha256:hash(bytes),archiveBytes:bytes.length});
  recoveryTarget(token,process.env);await identity(admin,'postgres',false);
  if((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rowCount)throw Error('seo_restore_target_exists');
  await admin.query(`CREATE DATABASE "${target}" TEMPLATE template0 ENCODING 'UTF8'`);created=true;
  createdOid=(await admin.query<{oid:string}>('SELECT oid::text AS oid FROM pg_database WHERE datname=$1',[target])).rows[0]?.oid;
  if(!createdOid)throw Error('seo_restore_created_target_missing');
  await privateFile(join(directory,'created-database.private.json'),{token,database:target,oid:createdOid,createdByThisRun:true});
  // Keep owner/ACL metadata in the archive; isolated proof maps objects to the
  // existing local owner and does not create or alter global roles.
  await runTool(join(tools,'pg_restore'+suffix),[...args,'--dbname='+target,'--exit-on-error','--single-transaction','--no-owner','--no-acl',archive],childEnv);
  const restoredClient=await restored.connect();let after:DatabaseFingerprint;
  try{await restoredClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await identity(restoredClient,target,true);after=await fingerprints(restoredClient);await restoredClient.query('ROLLBACK');}finally{restoredClient.release();}
  compareFingerprints(before,after);
  const afterSchema=await schemaFingerprint(restored,join(directory,'schema-after.private.json'));if(beforeSchema!==afterSchema)throw Error('seo_restore_schema_mismatch');
  if(!process.env.CMS_STORAGE_DIRECTORY)throw Error('seo_restore_assets_required');
  const assetDirectory=join(directory,'assets'),assetProof=await restoreAssets(process.env.CMS_STORAGE_DIRECTORY,assetDirectory);
  await restored.query('SET default_transaction_read_only=on');const application=await applicationProof(restored,assetDirectory);
  proof={outcome:'local_recovery_proven',sourceDatabase,archiveSha256:hash(bytes),archiveBytes:bytes.length,tables:after,tableCount:Object.keys(after).length,sourceSnapshotConsistent:true,fingerprintsMatch:true,schemaFingerprint:afterSchema,constraintsIndexesTriggersSequencesMatch:true,assetProof,application,outboundIntegrationsEnabled:false,wordpressRecovery:'not_tested_backup_unavailable',ownershipAndAclRecreation:'not_tested_on_isolated_local_target'};
 }catch(error){failure=error;}
 finally{
  if(sourceClient){if(sourceTransaction)await sourceClient.query('ROLLBACK');sourceClient.release();}
  await restored.end();await source.end();
  try{
   if(created){recoveryTarget(token,process.env);await identity(admin,'postgres',false);const current=(await admin.query<{oid:string}>('SELECT oid::text AS oid FROM pg_database WHERE datname=$1',[target])).rows[0];if(!createdOid||current?.oid!==createdOid)throw Error('seo_restore_cleanup_identity');await admin.query(`DROP DATABASE "${target}" WITH (FORCE)`);removed=!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rowCount;if(!removed)throw Error('seo_restore_cleanup_failed');}
  }finally{await admin.end();}
  await privateFile(join(directory,'result.private.json'),proof&&!failure?{...proof,createdTargetRemoved:removed}:{outcome:'stopped_safely',createdByThisRun:created,createdTargetRemoved:removed});
 }
 if(failure)throw failure;
 process.stdout.write(JSON.stringify({outcome:'local_recovery_proven',tableCount:proof?.tableCount,fingerprintsMatch:true,createdTargetRemoved:removed,receiptDirectory:relativePath.replaceAll('\\','/')})+'\n');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 if(process.argv.length!==3||process.argv[2]!=='--prove'){process.stderr.write('seo_restore_arguments_refused\n');process.exitCode=1;}
 else void runLocalRecoveryProof().catch(error=>{const code=error instanceof Error&&/^seo_restore_[a-z_]+$/u.test(error.message)?error.message:'seo_restore_stopped_safely';process.stderr.write(code+'\n');process.exitCode=1;});
}

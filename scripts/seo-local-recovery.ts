/** D-181 private restoration proof. Never restores over the source database. */
import {createHash,randomBytes} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,lstat,realpath,chmod} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Pool,type PoolClient} from 'pg';
import {assertReadOnlyLocalDatabase,assertDisposableIntegrationTestDatabase,disposableIntegrationDatabaseName} from '../src/migration/local-database-safety';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../src/migration/protected-local-postgres';

const sourceDatabase='savinggrace_sermons_test';
const sourceUrl='postgresql://127.0.0.1:5432/'+sourceDatabase;
const hash=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const executeFile=promisify(execFile);
export interface TableFingerprint {rows:number;sha256:string}
export type DatabaseFingerprint=Record<string,TableFingerprint>;

export function recoveryTarget(token:string,env:NodeJS.ProcessEnv):string {
 if(env.ALLOW_LOCAL_DB_WRITE!=='1'||env.ALLOW_LOCAL_SEO_RESTORE!=='1')throw Error('seo_restore_opt_in_required');
 const name=disposableIntegrationDatabaseName(token);
 assertDisposableIntegrationTestDatabase('postgresql://127.0.0.1:5432/'+name,token,env.ALLOW_LOCAL_DB_WRITE);
 return name;
}
export function assertRecoveryAuthority(governance:string):void {
 const start=governance.indexOf('## D-181'),end=governance.indexOf('\n## ',start+1),scope=governance.slice(start,end<0?undefined:end);
 if(start<0||!scope.includes('backup/restoration demonstration only')||!scope.includes('savinggrace_test_run_<run-token>')||!scope.includes('ALLOW_LOCAL_SEO_RESTORE=1')||!scope.includes('Never restore over the source'))throw Error('seo_restore_governance_required');
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
 const token=new Date().toISOString().replace(/\D/gu,'')+randomBytes(8).toString('hex'),target=recoveryTarget(token,process.env);
 assertReadOnlyLocalDatabase(sourceUrl);
 const tools=await toolDirectory(),suffix=process.platform==='win32'?'.exe':'',password=await protectedLocalPostgresPassword();
 const connection={host:'127.0.0.1',port:5432,user:protectedLocalPostgresUser,password,max:1,connectionTimeoutMillis:5000,statement_timeout:120000,options:'-c timezone=UTC',application_name:'d181-private-local-recovery-proof'};
 const admin=new Pool({...connection,database:'postgres'}),source=new Pool({...connection,database:sourceDatabase}),restored=new Pool({...connection,database:target});
 const root=await realpath(process.cwd()),directory=resolve(root,'private/seo-recovery',token),relativePath=relative(root,directory);
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
  const before=await fingerprints(sourceClient);await sourceClient.query('ROLLBACK');sourceTransaction=false;sourceClient.release();sourceClient=undefined;
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
  proof={outcome:'local_recovery_proven',sourceDatabase,archiveSha256:hash(bytes),archiveBytes:bytes.length,tables:after,tableCount:Object.keys(after).length,sourceSnapshotConsistent:true,fingerprintsMatch:true,ownershipAndAclRecreation:'not_tested_on_isolated_local_target'};
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

/** D-179 supplement. Read-only, local-only; emits safe counts and manifest hashes,
 * never matching text, file names, database rows, credentials, or sermon identities.
 * This does not replace the incumbent Related-themes scanner. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,lstat,readdir,realpath,writeFile} from 'node:fs/promises';
import {resolve,relative,join,dirname} from 'node:path';
import {siteAssetPaths,siteAssetResponse} from '../src/server/http/site-assets';
import {pathToFileURL} from 'node:url';
import {Pool} from 'pg';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../src/migration/protected-local-postgres';

export const cmsReleaseScanBase='b259a16f7eaf41e0fd086f3feae679160a3c7c75';
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8',maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});
const normalize=(value:string)=>value.normalize('NFKC').replace(/\\u([a-f0-9]{4})/giu,(_,code:string)=>String.fromCharCode(parseInt(code,16))).replace(/\\[nrt]/gu,' ').replace(/&(?:lt|gt|quot|apos|amp|#39|#34);/gu,' ').replace(/<[^>]{0,1000}>/gu,' ').toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
const fragmentSize=16;
export function fragmentHashes(value:string):string[]{const words=normalize(value),result:string[]=[];for(let i=0;i+fragmentSize<=words.length;i++)result.push(digest(words.slice(i,i+fragmentSize).join(' ')));return result;}
export function excludedCmsPath(path:string):boolean{
 return /(?:^|\/)(?:private|migration-inputs|migration-exports|node_modules|\.git|\.aws|youtube-oath|advanced-sermons(?:-pro)?)(?:\/|$)|\.private\.|\.production\.|\.snapshot\.|(?:^|\/)(?:\.env(?:\..+)?|\.pgpass|pgpass\.conf|id_rsa[^/]*|id_ed25519[^/]*|credentials|cookies?\.json|token\.json|client_secret[^/]*)$|\.(?:pem|key|p12|pfx|jks|kdbx|dump|backup|bak|sqlite3?|vtt|srt|onnx|safetensors|pt|zip|7z|tar|tgz|gz)$/iu.test(path);
}
export function cmsSecretClasses(body:string):string[]{
 const patterns:Record<string,RegExp>={
  private_key:/-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/u,
  cloud_key:/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bAIza[\w-]{35}\b/u,
  database_credentials:/(?:postgres(?:ql)?|mysql|mariadb):\/\/[^\s/:]+:[^\s@]+@/iu,
  provider_token:/\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b|\bya29\.[A-Za-z0-9_-]{25,}|\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}/u,
  password_hash:/\$(?:2[aby]\$\d{2}\$[./A-Za-z0-9]{53}|argon2(?:id|i)\$[^\s"']{30,})/u,
  session_material:/(?:sgbc_cms_admin|__Host-[A-Za-z_-]+)=[A-Za-z0-9_-]{35,}|\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}/u,
  authorization_header:/\bBearer[ \t]+[A-Za-z0-9_.-]{30,}|AWS_SECRET_ACCESS_KEY[ \t]*[=:][ \t]*["']?[A-Za-z0-9/+=]{40}/u,
  database_export:/^-- PostgreSQL database dump|^PGDMP|^COPY public\.[a-z_]+[^\n]*FROM stdin;/mu,
  credential_export:/["'](?:access_token|refresh_token|client_secret|private_key|aws_secret_access_key|session_token)["']\s*:\s*["'][^"']{12,}["']|["']type["']\s*:\s*["']service_account["']/iu,
  caption_export:/^WEBVTT\s*$|^\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[.,]\d{3}/mu,
  proprietary_source:/^[ \t/*#]*Plugin\s+Name:\s*Advanced\s+Sermons|^[ \t/*#]*Copyright[^\r\n]{0,100}(?:Darko|Advanced Sermons)/imu,
  private_host_path:/(?:[A-Z]:[\\/]+Users[\\/]+[^\s"'<>\\/]+[\\/]+(?:\.codex|\.aws|AppData)[\\/]|\/home\/[^\s/]+\/\.aws\/)/iu
 };
 return Object.entries(patterns).filter(([,pattern])=>pattern.test(body)).map(([name])=>name);
}
async function collect(root:string,path:string):Promise<string[]>{
 const stat=await lstat(path);if(stat.isSymbolicLink())throw Error('cms_scan_symlink');
 if(relative(root,await realpath(path)).startsWith('..'))throw Error('cms_scan_outside_root');
 if(stat.isDirectory()){const entries=await readdir(path);return(await Promise.all(entries.sort().map(name=>collect(root,join(path,name))))).flat();}
 if(!stat.isFile())throw Error('cms_scan_nonregular_file');return [path];
}
function collectDatasetBodies(value:unknown,result:string[],key=''):void{
 if(typeof value==='string'&&['summary','body','description','transcript','body_text','question_text','answer_text','question','answer'].includes(key)){if(value.trim())result.push(value);return;}
 if(value&&typeof value==='object')for(const [name,child]of Object.entries(value))collectDatasetBodies(child,result,name);
}
async function main(){
 const root=await realpath(process.cwd());git('merge-base','--is-ancestor',cmsReleaseScanBase,'HEAD');
 const changed=git('diff','--name-only','-z','--diff-filter=ACMRTUXB',cmsReleaseScanBase).split('\0').filter(Boolean);
 const untracked=git('ls-files','--others','--exclude-standard','-z').split('\0').filter(Boolean);
 const sources=[...new Set([...changed,...untracked])].sort();
 if(sources.some(path=>path.startsWith('development-data/')))throw Error('cms_scan_dataset_change_not_authorized');
 const knownDatasets=[['preview-sermons-v1',15],['project-sermon-snapshot-v1',279],['sermonaudio-119-v1',119]] as const;
 const referenceBodies:string[]=[];let verifiedDatasetRecords=0,canonicalDatasetNewlineConversions=0;
 for(const [name,count]of knownDatasets){
  const directory=`development-data/${name}`;
  for(const file of ['sermons.json','manifest.json']){const path=`${directory}/${file}`;const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||git('hash-object','--path='+path,path).trim()!==git('rev-parse',`${cmsReleaseScanBase}:${path}`).trim())throw Error('cms_scan_dataset_baseline_changed');}
  const workingBytes=await readFile(`${directory}/sermons.json`),bytes=Buffer.from(git('show',`${cmsReleaseScanBase}:${directory}/sermons.json`)),manifest=JSON.parse(await readFile(`${directory}/manifest.json`,'utf8')) as {contentFile:string;contentSha256:string};
  if(manifest.contentFile!=='sermons.json'||digest(bytes)!==manifest.contentSha256)throw Error('cms_scan_dataset_integrity');
  if(!workingBytes.equals(bytes)){if(workingBytes.toString('utf8').replaceAll('\r\n','\n')!==bytes.toString('utf8'))throw Error('cms_scan_dataset_bytes_changed');canonicalDatasetNewlineConversions++;}
  const dataset=JSON.parse(bytes.toString('utf8'));if((dataset.sermons??dataset.tables?.sermons)?.length!==count)throw Error('cms_scan_dataset_scope');verifiedDatasetRecords+=count;collectDatasetBodies(dataset,referenceBodies);
 }
 const databasePassword=await protectedLocalPostgresPassword();
 const pool=new Pool({host:'127.0.0.1',port:5432,database:'savinggrace_sermons_test',user:protectedLocalPostgresUser,password:databasePassword,max:1,options:'-c default_transaction_read_only=on -c jit=off',statement_timeout:15000,application_name:'cms-release-readonly-scan'});
 let databaseBodies=0;
 try{
  const client=await pool.connect();try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const identity=(await client.query("SELECT current_database() db,current_setting('server_version_num')::int version,inet_server_port() port,host(inet_server_addr()) address,current_setting('transaction_read_only') read_only")).rows[0];
   if(identity.db!=='savinggrace_sermons_test'||identity.version<160000||identity.version>=170000||identity.port!==5432||!['127.0.0.1','::1'].includes(identity.address)||identity.read_only!=='on')throw Error('cms_scan_database_identity');
   for(const query of ['SELECT summary,body FROM sermons','SELECT body_text FROM sermon_transcripts','SELECT question_text,answer_text FROM sermon_question_answers'])for(const row of (await client.query(query)).rows)for(const value of Object.values(row))if(typeof value==='string'&&value.trim()){referenceBodies.push(value);databaseBodies++;}
  }finally{await client.query('ROLLBACK');client.release();}
 }finally{await pool.end();}
 if(!databaseBodies)throw Error('cms_scan_reference_corpus_missing');
 const fragments=new Set<string>();for(const body of referenceBodies)for(const hash of fragmentHashes(body))fragments.add(hash);
 if(!fragments.size)throw Error('cms_scan_reference_corpus_empty');
 // Existing church quotations are not private sermon exports. Each allowed overlap
 // is bound to the exact baseline file, its relevant source/build lineage, and the
 // scanned output file hash. No general exception exists for new church wording.
 const baselineChurchSources=new Map<string,{sha256:string;fragments:Set<string>}>();
 const churchRouteSources=new Map<string,string>();
 const sourcePaths=git('ls-tree','-r','--name-only',cmsReleaseScanBase,'--','src/frontend/content','src/frontend/pages/home.ts','src/frontend/shell.ts').trim().split(/\r?\n/u).filter(path=>path.endsWith('.ts'));
 for(const path of sourcePaths){const body=git('show',`${cmsReleaseScanBase}:${path}`);baselineChurchSources.set(path,{sha256:digest(body),fragments:new Set(fragmentHashes(body))});for(const match of body.matchAll(/\bpath:\s*["'](\/[^"']*)["']/gu))churchRouteSources.set(match[1]!,path);}
 const commonSources=['src/frontend/content/navigation.ts','src/frontend/shell.ts'];
 const extractedSources=['src/frontend/pages/home.ts',...commonSources];
 const sourceLineage=(path:string):string[]=>path==='src/frontend/content/site-snapshot.ts'?extractedSources:baselineChurchSources.has(path)?[path]:[];
 async function lineage(scope:'source'|'build',path:string):Promise<string[]>{
  if(scope==='source')return sourceLineage(path);
  if(/^dist-staging\/(?:server|draft-preview|cms-maintenance)\.cjs$/u.test(path)){
   const inputs:unknown=JSON.parse(await readFile(path.replace(/\.cjs$/u,'.inputs.json'),'utf8'));if(!Array.isArray(inputs)||inputs.some(input=>typeof input!=='string'))throw Error('cms_scan_build_lineage');
   return [...new Set(inputs.flatMap(input=>sourceLineage(input as string)))];
  }
  if(path.startsWith('dist/')&&path.endsWith('/index.html')){
   const route='/'+path.slice(5,-'index.html'.length),page=churchRouteSources.get(route);
   return [...commonSources,...(route==='/'?['src/frontend/pages/home.ts']:page?[page]:[])];
  }
  return [];
 }
 // Every permitted binary build artifact must exactly equal an incumbent embedded asset.
 for(const name of ['logo.ts','media.ts','media-bytes.ts','fonts.ts','font-bytes.ts']){const path='src/frontend/assets/'+name;if(git('hash-object','--path='+path,path).trim()!==git('rev-parse',`${cmsReleaseScanBase}:${path}`).trim())throw Error('cms_scan_embedded_assets_changed');}
 const embeddedAssetHashes=new Set<string>();for(const path of siteAssetPaths){const response=siteAssetResponse(new Request('http://127.0.0.1'+path));if(response)embeddedAssetHashes.add(digest(new Uint8Array(await response.arrayBuffer())));}
 const artifactFiles:string[]=[];for(const directory of ['dist','dist-staging']){const path=resolve(root,directory);if(!(await lstat(path)).isDirectory())throw Error('cms_scan_build_missing');artifactFiles.push(...await collect(root,path));}
 const manifest:Array<{scope:'source'|'build';path:string;sha256:string;bytes:number}>=[];const inheritedCopyEvidence:Array<{path:string;outputSha256:string;matchedFragments:number;lineage:Array<{path:string;sha256:string}>}>=[];const counts:Record<string,number>={};let excludedPaths=0,bodyMatches=0,binaryFiles=0,existingChurchCopyMatchFiles=0;
 for(const entry of [...sources.map(path=>({scope:'source' as const,path})),...artifactFiles.map(path=>({scope:'build' as const,path:relative(root,path).replaceAll('\\','/')}))]){
  if(excludedCmsPath(entry.path)){excludedPaths++;continue;}
  const target=resolve(root,entry.path),stat=await lstat(target);if(!stat.isFile()||stat.isSymbolicLink()||relative(root,await realpath(target)).startsWith('..'))throw Error('cms_scan_source_file_refused');
  const bytes=await readFile(target);manifest.push({...entry,sha256:digest(bytes),bytes:bytes.length});
  let body:string;try{body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(body.includes('\0'))throw Error('binary');}catch{binaryFiles++;if(entry.scope!=='build'||!embeddedAssetHashes.has(digest(bytes)))counts.unexpected_binary=(counts.unexpected_binary??0)+1;continue;}
  for(const name of cmsSecretClasses(body))counts[name]=(counts[name]??0)+1;
  if(databasePassword.length>=8&&body.includes(databasePassword))counts.protected_database_secret=(counts.protected_database_secret??0)+1;
  const matches=[...new Set(fragmentHashes(body).filter(hash=>fragments.has(hash)))];
  if(matches.length){
   const parents=await lineage(entry.scope,entry.path),allowed=new Set(parents.flatMap(path=>[...(baselineChurchSources.get(path)?.fragments??[])]));
   if(matches.some(hash=>!allowed.has(hash)))bodyMatches++;
   const inherited=matches.filter(hash=>allowed.has(hash));if(inherited.length){existingChurchCopyMatchFiles++;inheritedCopyEvidence.push({path:entry.path,outputSha256:digest(bytes),matchedFragments:inherited.length,lineage:parents.flatMap(path=>{const source=baselineChurchSources.get(path);return source?[{path,sha256:source.sha256}]:[]})});}
  }
 }
 const args=process.argv.slice(2);if(args.length){if(args.length!==2||args[0]!=='--manifest'||!args[1]?.endsWith('.private.json'))throw Error('cms_scan_manifest_arguments');const target=resolve(root,args[1]);if(relative(root,target).startsWith('..')||relative(root,await realpath(dirname(target))).startsWith('..'))throw Error('cms_scan_manifest_location');git('check-ignore','--',relative(root,target));await writeFile(target,JSON.stringify({baseline:cmsReleaseScanBase,files:manifest,inheritedCopyEvidence},null,2)+'\n',{flag:'wx',mode:0o600});}
 console.log(JSON.stringify({scan:'cms-release-v1',baseline:cmsReleaseScanBase,sourceFiles:sources.length,buildFiles:artifactFiles.length,manifestFiles:manifest.length,manifestSha256:digest(JSON.stringify(manifest)),verifiedDatasetRecords,canonicalDatasetNewlineConversions,referenceBodies:referenceBodies.length,databaseBodies,fragmentWords:fragmentSize,referenceFragments:fragments.size,bodyMatchingScope:'current local summary/body/transcript/Q&A and unchanged approved datasets; normalized exact 16-word windows',excludedPaths,privateBodyMatches:bodyMatches,existingChurchCopyMatchFiles,churchCopyException:'exact baseline fragments in mapped source/compiled-input/route lineage only',inheritedCopyEvidenceSha256:digest(JSON.stringify(inheritedCopyEvidence)),binaryFiles,embeddedAssetHashes:embeddedAssetHashes.size,secretOrSourceClasses:counts,passed:excludedPaths===0&&bodyMatches===0&&Object.keys(counts).length===0}));
 if(excludedPaths||bodyMatches||Object.keys(counts).length)process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)void main().catch(error=>{console.error(error instanceof Error&&/^cms_scan_[a-z_]+$/.test(error.message)?error.message:'cms_release_scan_failed');process.exitCode=1;});

/** Offline runtime package bound to committed source and the outgoing privacy scan. */
import {execFileSync} from 'node:child_process';
import {readFile,lstat,realpath,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
export const cmsRuntimeEntries=['server','database','cms-maintenance','sermonaudio-sync','completed-sync','sermonaudio-completion-sync','sermon-durations-sync','related-themes-sync','draft-preview','d160-sync','d161-sync','d167-protected-sync'];
export function permittedCmsRuntimePath(path){return cmsRuntimeEntries.some(name=>path===`app/${name}.cjs`)||['app/admin/index.html','app/admin/_astro/cms-admin.js','app/admin/_astro/cms-admin.css'].includes(path)||/^app\/db\/migrations\/[0-9]{4}_[a-z0-9_]+(?:\.down)?\.sql$/.test(path);}
const hash=value=>createHash('sha256').update(value).digest('hex');
const git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024,stdio:['ignore','pipe','pipe']});
async function regular(path){const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink())throw Error('cms_runtime_nonfile');return readFile(path);}
async function main(){
 const directory=process.env.STAGING_PACKAGE_DIRECTORY,scanPath=process.env.CMS_RUNTIME_SCAN_MANIFEST;
 if(!directory||!isAbsolute(directory)||!scanPath?.endsWith('.private.json'))throw Error('cms_runtime_package_paths');
 const destination=await realpath(directory);if(!relative(process.cwd(),destination).startsWith('..'))throw Error('cms_runtime_external_directory_required');
 const commit=git('rev-parse','HEAD').toString().trim();if(!/^[a-f0-9]{40}$/.test(commit)||git('status','--porcelain','--untracked-files=all','--','src','deployment','db','package.json','package-lock.json').toString().trim())throw Error('cms_runtime_clean_commit_required');
 const sourceArchive=await regular(resolve(destination,'release.tar'));
 if(execFileSync('git',['get-tar-commit-id'],{input:sourceArchive,encoding:'utf8'}).trim()!==commit)throw Error('cms_runtime_source_commit_mismatch');
 const sourcePaths=new Set(execFileSync('tar',['-tf',resolve(destination,'release.tar')],{encoding:'utf8'}).trim().split(/\r?\n/));
 execFileSync(process.execPath,['deployment/build.mjs'],{stdio:['ignore','pipe','pipe']});
 const provenance=[];for(const name of ['cms-admin',...cmsRuntimeEntries]){const inputs=JSON.parse(await regular(`dist-staging/${name}.inputs.json`));for(const path of inputs.filter(path=>path.startsWith('src/')||path.startsWith('deployment/'))){if(!sourcePaths.has(path)|| (await regular(path)).toString().replaceAll('\r\n','\n')!==git('show',commit+':'+path).toString())throw Error('cms_runtime_input_source_drift');}provenance.push({name,inputs});}
 const provenanceBytes=JSON.stringify({commit,bundles:provenance})+'\n';await writeFile(resolve(destination,'cms-runtime-provenance.private.json'),provenanceBytes,{flag:'wx',mode:0o600});
 const scan=JSON.parse(execFileSync(process.execPath,['--import','tsx','scripts/scan-cms-release.ts','--manifest',scanPath],{encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']}));
 if(scan.passed!==true)throw Error('cms_runtime_scan_refused');
 const scanBytes=await regular(scanPath),scanManifest=JSON.parse(scanBytes);
 const manifest={version:1,commit,sourceArchiveSha256:hash(sourceArchive),scanManifestSha256:hash(scanBytes),provenanceSha256:hash(provenanceBytes),files:[]};
 const directoryPath=resolve(destination,'runtime');await mkdir(directoryPath);
 const outputs=[...cmsRuntimeEntries.map(name=>[`dist-staging/${name}.cjs`,`app/${name}.cjs`]),...['index.html','_astro/cms-admin.js','_astro/cms-admin.css'].map(name=>[`dist-staging/admin/${name}`,`app/admin/${name}`])];
 const migrations=git('ls-files','db/migrations').toString().trim().split(/\r?\n/).filter(Boolean);
 for(const path of migrations)outputs.push([path,'app/'+path]);
 for(const [input,path]of outputs){
  if(!permittedCmsRuntimePath(path))throw Error('cms_runtime_path_refused');
  let bytes=await regular(input);
  if(input.startsWith('dist-staging/')){const receipt=scanManifest.files.find(item=>item.scope==='build'&&item.path===input);if(!receipt||receipt.sha256!==hash(bytes))throw Error('cms_runtime_scan_hash_mismatch');}
  else{const committed=git('show',commit+':'+input);if(bytes.toString().replaceAll('\r\n','\n')!==committed.toString())throw Error('cms_runtime_source_drift');bytes=committed;}
  const output=resolve(directoryPath,path);await mkdir(dirname(output),{recursive:true});await writeFile(output,bytes,{flag:'wx',mode:0o600});manifest.files.push({path,sha256:hash(bytes),bytes:bytes.length});
 }
 manifest.files.sort((a,b)=>a.path.localeCompare(b.path));const manifestBytes=JSON.stringify(manifest)+'\n';await writeFile(resolve(directoryPath,'runtime-manifest.json'),manifestBytes,{flag:'wx',mode:0o600});
 if(git('rev-parse','HEAD').toString().trim()!==commit||git('status','--porcelain','--untracked-files=all','--','src','deployment','db','package.json','package-lock.json').toString().trim())throw Error('cms_runtime_source_changed_during_build');
 const archive=resolve(destination,'runtime.tar');if(await lstat(archive).then(()=>true,()=>false))throw Error('cms_runtime_existing_archive');
 execFileSync('tar',['-cf',archive,'-C',directoryPath,'runtime-manifest.json',...manifest.files.map(file=>file.path)],{stdio:['ignore','pipe','pipe']});
 console.log(JSON.stringify({outcome:'cms_offline_runtime_packaged',commit,files:manifest.files.length,sha256:hash(await regular(archive)),manifestSha256:hash(manifestBytes),sourceArchiveSha256:manifest.sourceArchiveSha256,scanPassed:scan.passed,scanManifestSha256:manifest.scanManifestSha256}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{console.error('cms_runtime_package_refused');process.exitCode=1;});

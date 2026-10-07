/** D-178 outgoing changed-file and build scan. Prints counts, never matched text. */
import {execFileSync} from 'node:child_process';
import {readFile,lstat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {Pool} from 'pg';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../src/migration/protected-local-postgres';
import {createHash} from 'node:crypto';
import {PostgresAcceptedSemanticRepository} from '../src/server/repositories/postgres-accepted-semantic-repository';
const base='4a453d4356a5435195d803184b95c7a7ca51777a';
const words=(text:string)=>text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)??[];
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
async function walk(path:string):Promise<string[]>{const rows=await readdir(path,{withFileTypes:true});return(await Promise.all(rows.map(row=>row.isDirectory()?walk(join(path,row.name)):Promise.resolve([join(path,row.name)])))).flat();}
async function main(){
 const files=[...new Set([...execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split(/\r?\n/),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/)].filter(Boolean))];
 const prohibited=files.filter(path=>/(?:^|\/)(?:private|development-data|node_modules)(?:\/|$)|\.private\.|\.onnx$|\.dump$|\.pem$|(?:^|\/)\.env$/i.test(path));if(prohibited.length)throw Error('outgoing_private_path');
 const pool=new Pool({host:'127.0.0.1',port:5432,database:'savinggrace_sermons_test',user:protectedLocalPostgresUser,password:await protectedLocalPostgresPassword(),max:1,options:'-c default_transaction_read_only=on -c jit=off'});
 const shingles=new Set<string>();try{const rows=await new PostgresAcceptedSemanticRepository(pool,{environment:'local',scope:'d175_local_completed'}).listCurrentSources();for(const row of rows){const tokens=words(row.description);for(let i=0;i+12<=tokens.length;i++)shingles.add(digest(tokens.slice(i,i+12).join(' ')));}}finally{await pool.end();}
 const artifacts=(await walk('dist')).filter(path=>/\.(html|js|json|xml|txt)$/i.test(path));
 let secretMatches=0,contentMatches=0,symlinks=0,scanned=0;
 for(const path of [...files,...artifacts]){
  const stat=await lstat(path);if(stat.isSymbolicLink()){symlinks++;continue;}if(!stat.isFile())continue;
  const body=await readFile(path,'utf8');scanned++;
  if(/-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----|AKIA[A-Z0-9]{16}|AIza[\w-]{35}|(?:postgres(?:ql)?|mysql):\/\/[^\s/:]+:[^\s@]+@|gh[pousr]_[A-Za-z0-9]{30,}/u.test(body))secretMatches++;
  const tokens=words(body);for(let i=0;i+12<=tokens.length;i++)if(shingles.has(digest(tokens.slice(i,i+12).join(' ')))){contentMatches++;break;}
 }
 console.log(JSON.stringify({scanned,changedFiles:files.length,buildArtifacts:artifacts.length,secretMatches,privateDescriptionMatches:contentMatches,symlinks,privatePaths:prohibited.length}));
 if(secretMatches||contentMatches||symlinks)throw Error('outgoing_scan_failed');
}
main().catch(()=>{console.error('related_themes_outgoing_scan_failed');process.exitCode=1;});

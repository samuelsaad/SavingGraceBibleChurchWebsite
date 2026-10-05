import {execFileSync} from 'node:child_process';
import {readFile,lstat,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {validateCompletedPacket} from '../src/staging/completed-packet';
import {loadTrackedProjectSermonSnapshot} from '../src/development-data/project-sermon-snapshot';
import {completedDisplayProjection} from '../src/development-data/completed-sermon-export';
import {digest} from '../src/staging/completed-packet';
async function main(){
 const p=validateCompletedPacket(JSON.parse(await readFile('private/d171/001-source.private.json','utf8'))),tracked=await loadTrackedProjectSermonSnapshot();
 const expected=completedDisplayProjection(p);
 if(digest(expected.tables)!==digest(tracked.snapshot.tables))throw Error('d171_projection_drift');
 const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8',maxBuffer:128*1024*1024,stdio:['ignore','pipe','ignore']});
 const files=[...new Set([...git('diff','--name-only','HEAD','--diff-filter=ACMR').trim().split(/\r?\n/),...git('ls-files','--others','--exclude-standard').trim().split(/\r?\n/)].filter(Boolean))];
 const outputs:string[]=[];async function walk(dir:string){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isSymbolicLink())throw Error('d171_output_symlink');if(e.isDirectory())await walk(path);else outputs.push(path);}}
 await walk('dist');await walk('dist-staging');
 const bodies=[...p.tables.sermons.rows.map(r=>r.summary),...p.tables.sermon_transcripts.rows.map(r=>r.body_text),...p.tables.sermon_question_answers.rows.flatMap(r=>[r.question_text,r.answer_text])].filter((x):x is string=>typeof x==='string'&&x.length>60);
 const subjects=new Set<string>();for(const t of Object.values(p.tables))for(const r of t.rows)for(const [key,value] of Object.entries(r))if(/subject|authorized_by|executed_by/u.test(key)&&typeof value==='string')subjects.add(value);
 const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,/\bya29\.[\w-]{30,}/u,/(?:postgres(?:ql)?|mysql):\/\/[^\s:/]+:[^\s@]+@/u,/"(?:refresh_token|client_secret|access_token|password_hash)"\s*:\s*"[^"\s]{8,}"/u];
 const findings:{path:string;kind:string}[]=[];
 for(const path of [...files,...outputs]){
  if(!(await lstat(path)).isFile())throw Error('d171_nonregular_file');
  const text=await readFile(path,'utf8');let prior='';try{prior=git('show','HEAD:'+path.replaceAll('\\','/'));}catch{}
  const dataset=path.replaceAll('\\','/')==='development-data/project-sermon-snapshot-v1/sermons.json';
  if(patterns.some(rx=>rx.test(text)&&!rx.test(prior)))findings.push({path,kind:'secret_pattern'});
  if(/(?:^|[/\\])private[/\\]|\.private\.|\.(?:pem|dump|key)$/u.test(path))findings.push({path:'[prohibited path]',kind:'prohibited_file'});
  if(dataset){if([...subjects].some(s=>text.includes(s))||/[A-Z]:\\\\(?:Users|ProgramData)\\\\/u.test(text)||/-----BEGIN/u.test(text))findings.push({path,kind:'private_value_in_export'});}
  else if(bodies.some(b=>text.includes(b)&&!prior.includes(b)))findings.push({path,kind:'sermon_body_outside_export'});
 }
 const ignored=git('check-ignore','private/d171/001-source.private.json','private/d171/002-cohort.private.json').trim().split(/\r?\n/).length===2;
 if(!ignored)throw Error('d171_private_not_ignored');
 console.log(JSON.stringify({scope:279,heldExcluded:32,files:files.length,outputs:outputs.length,ignored,findings}));if(findings.length)process.exitCode=1;
}
main().catch(()=>{console.error('d171_scan_failed_no_private_output');process.exitCode=1;});

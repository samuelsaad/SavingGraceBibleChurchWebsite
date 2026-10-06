import {readFile,mkdir,lstat,open,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Pool} from 'pg';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../migration/protected-local-postgres';
import {readFrozenInventory,readVerifiedSource,prepareSource,hash,completionDecision,completionManifestSha256,runtimeProvenance,validateCandidate,candidateInputSchema,substantiveReviewInputSchema} from './completion';
import {persistImmutable,persistCheckpoint,readCheckpoint} from './private-artifacts';
import {applySermonAudioCompletion} from '../application/sermonaudio-completion-service';
import {primaryKeys,quoted,digest} from '../staging/completed-packet';
const sourceRoot=resolve('../sermonaudio-transcript-retrieval/private/sermonaudio-transcript-retrieval');
const artifactRoot=resolve('private/sermonaudio-119-completion');
async function main(){
 const inventory=await readFrozenInventory(sourceRoot);
 const command=process.argv[2];
 if(command==='preservation-baseline'){
  const p=new Pool({host:'127.0.0.1',port:5432,database:'savinggrace_sermons_test',user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,options:'-c default_transaction_read_only=on -c timezone=UTC'}),c=await p.connect();
  try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const target=(await c.query("SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port,current_setting('server_version_num')::int version")).rows[0];if(target.db!=='savinggrace_sermons_test'||target.host!=='127.0.0.1'||target.port!==5432||target.version<160000||target.version>=170000)throw Error('d175_local_target_refused');
   const tables:Record<string,unknown>={};for(const {tablename} of (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows){const keys=await primaryKeys(c,tablename);const rows=(await c.query('SELECT jsonb_build_array('+keys.map(quoted).join(',')+") pk,encode(digest(to_jsonb(t)::text,'sha256'),'hex') hash FROM "+quoted(tablename)+' t')).rows.map(r=>({key:digest(r.pk),hash:r.hash})).sort((a,b)=>a.key.localeCompare(b.key));tables[tablename]={keys,rows};}
   const baseline={decision:completionDecision,manifestSha256:completionManifestSha256,tables,sermons:(await c.query('SELECT count(*)::int n FROM sermons')).rows[0].n};const fingerprint=digest(baseline);await persistImmutable(join(artifactRoot,'prior-row-fingerprints.private.json'),JSON.stringify({...baseline,fingerprint},null,2));console.log(JSON.stringify({decision:completionDecision,baselineSermons:baseline.sermons,tables:Object.keys(tables).length,fingerprint}));
  }finally{await c.query('ROLLBACK');c.release();await p.end();}return;
 }
 if(command==='import'){
  const sequence=Number(process.argv[3]),tag=String(sequence).padStart(3,'0'),t=inventory.targets.find(t=>t.sequence===sequence);if(!t)throw Error('d175_sequence_refused');
  const state=await readCheckpoint<{manifestSha256:string;records:Record<string,any>;history:Record<string,unknown>[]}>(join(artifactRoot,'checkpoint.private.json'));if(state.manifestSha256!==completionManifestSha256)throw Error('d175_checkpoint_manifest_refused');
  const record=state.records[String(sequence)];if(!record?.reviewHash)throw Error('d175_accepted_review_required');
  const version=String(record.version).padStart(3,'0');
  const candidateArtifact=JSON.parse(await readFile(join(artifactRoot,`candidate-${tag}-v${version}.private.json`),'utf8'));
  const review=JSON.parse(await readFile(join(artifactRoot,`review-${tag}-v${version}.private.json`),'utf8'));
  if(review.outcome!=='accepted'||review.reviewHash!==record.reviewHash||candidateArtifact.candidateHash!==record.candidateHash)throw Error('d175_current_review_conflict');
  const input=JSON.parse(await readFile(join(artifactRoot,`input-${tag}.private.json`),'utf8'));
  const transcript=await readFile(join(artifactRoot,`prepared-${tag}.txt`),'utf8'),source=await readVerifiedSource(sourceRoot,t);
  const capture=JSON.parse(await readFile(join(sourceRoot,'wordpress-source.private.json'),'utf8'));
  const operator=JSON.parse(await readFile(join(artifactRoot,'operator.private.json'),'utf8'));
  if(typeof operator.retainedWordPressExport!=='string'||!(await lstat(operator.retainedWordPressExport)).isFile())throw Error('d175_retained_source_configuration_refused');
  const metadataBytes=await readFile(operator.retainedWordPressExport);
  if(hash(metadataBytes)!==capture.artifactHashes?.['wordpress-media-evidence.private.json'])throw Error('d175_retained_source_export_hash_mismatch');
  const wp=JSON.parse(metadataBytes.toString('utf8')).records.find((r:any)=>r.sourceWordPressId===t.source.sourceWordPressId);
  if(!wp||wp.title!==t.source.title||wp.serviceDateLocal.slice(0,10)!==t.source.serviceDate||wp.status!==t.source.status)throw Error('d175_source_capture_identity_conflict');
  const baseline=JSON.parse(await readFile(join(artifactRoot,'baseline.private.json'),'utf8'));
  const existing=baseline.overlap.find((r:any)=>Number(r.source_wordpress_id)===t.source.sourceWordPressId);
  const p=new Pool({host:'127.0.0.1',port:5432,database:'savinggrace_sermons_test',user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1,options:'-c timezone=UTC'});
  try{
   const result=await applySermonAudioCompletion(p,inventory,{decision:'D-175',manifestSha256:completionManifestSha256,sequence,sourceWordPressId:t.source.sourceWordPressId,title:t.source.title,slug:wp.slug,serviceDate:t.source.serviceDate,sourceStatus:t.source.status,canonicalSpeaker:t.source.speakerNames[0],series:wp.terms.filter((term:any)=>term.taxonomy==='sermon_series').map((term:any)=>({name:term.name,slug:term.slug})),passageTexts:t.source.passageTexts.length?t.source.passageTexts:[t.recording.bibleText].filter(Boolean),sermonAudioId:t.recording.sermonID,broadcaster:'savinggrace',language:source.language,sourceSha256:source.receipt.sha256,metadataSha256:t.metadataSha256,sourceCaptureSha256:hash(metadataBytes),transcript,transcriptSha256:hash(transcript),candidate:input,candidateArtifact,candidateHash:record.candidateHash,review,reviewHash:record.reviewHash,expectedRowVersion:existing?.row_version??null,sourceRetrievedAt:source.receipt.retrievedAt,sourceVersion:source.receipt.sourceVersion,governanceCommit:candidateArtifact.preparation.governanceCommit});
   await persistImmutable(join(artifactRoot,`import-${tag}-${result.outcome}.private.json`),JSON.stringify({...result,decision:'D-175',manifestSha256:completionManifestSha256,candidateHash:record.candidateHash,reviewHash:record.reviewHash},null,2));
   if(result.outcome!=='unchanged'){state.records[String(sequence)]={...record,stage:'imported_and_ai_accepted',sermonId:result.sermonId};state.history.push({sequence,stage:'imported_and_ai_accepted',at:new Date().toISOString(),sermonId:result.sermonId,candidateHash:record.candidateHash,reviewHash:record.reviewHash});await persistCheckpoint(join(artifactRoot,'checkpoint.private.json'),state);}
   console.log(JSON.stringify({sequence,...result}));
  }finally{await p.end();}return;
 }
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
  const state:{manifestSha256:string;history:Record<string,unknown>[];records:Record<string,unknown>}=await readCheckpoint<{manifestSha256:string;history:Record<string,unknown>[];records:Record<string,unknown>}>(checkpointPath).catch(e=>{if((e as NodeJS.ErrnoException).code==='ENOENT')return {manifestSha256:completionManifestSha256,history:[] as Record<string,unknown>[],records:{} as Record<string,unknown>};throw e;});
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
 if(command==='save-candidate'){
  const inputPath=resolve(process.argv[3]??'');if(!inputPath.startsWith(artifactRoot+'/')&&!inputPath.startsWith(artifactRoot+'\\'))throw Error('d175_candidate_path_refused');
  const input=JSON.parse(await readFile(inputPath,'utf8'));const candidate=candidateInputSchema.parse(input);
  const t=inventory.targets.find(t=>t.sequence===candidate.sequence);if(!t)throw Error('d175_sequence_refused');
  const s=await readVerifiedSource(sourceRoot,t),tag=String(t.sequence).padStart(3,'0');
  const preparation=JSON.parse(await readFile(join(artifactRoot,`preparation-${tag}.private.json`),'utf8'));
  const transcript=await readFile(join(artifactRoot,`prepared-${tag}.txt`),'utf8');if(hash(transcript)!==preparation.transcriptSha256)throw Error('d175_prepared_hash_mismatch');
  const state=await readCheckpoint<{manifestSha256:string;records:Record<string,any>;history:Record<string,unknown>[]}>(join(artifactRoot,'checkpoint.private.json'));
  if(state.manifestSha256!==completionManifestSha256)throw Error('d175_checkpoint_manifest_refused');
  const current=state.records[tag]??state.records[String(t.sequence)];
  const correctionCode=process.argv[4],expectedPreviousHash=process.argv[5];
  if(current?.candidateHash&&(expectedPreviousHash!==current.candidateHash||!correctionCode||!/^support_[a-z_]+$|^content_[a-z_]+$/u.test(correctionCode)))throw Error('d175_existing_candidate_requires_explicit_revision');
  // Preserve the exact supplied original before validation, including rejected input.
  const originalHash=hash(JSON.stringify(candidate));const originalPath=join(artifactRoot,`candidate-${tag}-original.private.json`);
  const previous=await readFile(originalPath,'utf8').then(v=>JSON.parse(v)).catch(e=>{if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;});
  const corrected=previous&&previous.originalHash!==originalHash;
  if(corrected&&(!correctionCode||!/^support_[a-z_]+$|^content_[a-z_]+$/u.test(correctionCode)))throw Error('d175_correction_lineage_required');
  const version=corrected?(current?.correctionCount??0)+1:0;
  await persistImmutable(corrected?join(artifactRoot,`candidate-${tag}-revision-${originalHash.slice(0,16)}.private.json`):originalPath,JSON.stringify({decision:completionDecision,manifestSha256:completionManifestSha256,preparation,sourceSha256:s.receipt.sha256,originalHash,runtimeProvenance,candidate,...(corrected?{previousOriginalHash:previous.originalHash,correctionCode,version}:{})},null,2));
  const checked=validateCandidate(transcript,candidate,s.language);
  const currentArtifact={decision:completionDecision,manifestSha256:completionManifestSha256,preparation,sourceSha256:s.receipt.sha256,originalHash,sourceTranscriptApprovalState:'unapproved',humanApprovalClaimed:false,generatedAt:new Date().toISOString(),runtimeProvenance,description:candidate.description,descriptionSupport:checked.descriptionSupport,questionAnswers:candidate.questionAnswers.map((q,i)=>({displayOrder:i+1,question:q.question,answer:q.answer,support:checked.questionSupport[i]})),internalUncertainty:candidate.internalUncertainty,mechanicalProofread:checked.proofread,...(current?.candidateHash?{previousCandidateHash:current.candidateHash}:{})};
  const candidateHash=hash(JSON.stringify(currentArtifact));await persistImmutable(join(artifactRoot,`candidate-${tag}-v${String(version).padStart(3,'0')}.private.json`),JSON.stringify({...currentArtifact,candidateHash,version,...(corrected?{previousOriginalHash:previous.originalHash,correctionCode}:{})},null,2));
  state.records[String(t.sequence)]={...current,stage:'candidate_validated',candidateHash,version,correctionCount:version,reviewHash:null,previousReviewHash:current?.reviewHash??null};state.history.push({sequence:t.sequence,stage:'candidate_validated',at:new Date().toISOString(),candidateHash,version,...(corrected?{previousOriginalHash:previous.originalHash,correctionCode}:{})});await persistCheckpoint(join(artifactRoot,'checkpoint.private.json'),state);
  console.log(JSON.stringify({decision:completionDecision,sequence:t.sequence,stage:'candidate_validated',candidateHash,descriptionWords:checked.descriptionWords,questions:candidate.questionAnswers.length,editorialFlags:checked.proofread.reviewIssueCount}));return;
 }
 if(command==='read-candidate'||command==='save-review'){
  const inputPath=resolve(process.argv[3]??'');
  const input=command==='save-review'?substantiveReviewInputSchema.parse(JSON.parse(await readFile(inputPath,'utf8'))):null;
  if(input&&!inputPath.startsWith(artifactRoot+'/')&&!inputPath.startsWith(artifactRoot+'\\'))throw Error('d175_review_path_refused');
  const sequence=input?.sequence??Number(process.argv[3]),tag=String(sequence).padStart(3,'0');const t=inventory.targets.find(t=>t.sequence===sequence);if(!t)throw Error('d175_sequence_refused');
  const state=await readCheckpoint<{manifestSha256:string;records:Record<string,any>;history:Record<string,unknown>[]}>(join(artifactRoot,'checkpoint.private.json'));if(state.manifestSha256!==completionManifestSha256)throw Error('d175_checkpoint_manifest_refused');
  const record=state.records[String(sequence)];if(!record?.candidateHash)throw Error('d175_candidate_missing');
  const artifact=JSON.parse(await readFile(join(artifactRoot,`candidate-${tag}-v${String(record.version).padStart(3,'0')}.private.json`),'utf8'));
  const {candidateHash,version,previousOriginalHash,correctionCode,...body}=artifact;if(hash(JSON.stringify(body))!==candidateHash||candidateHash!==record.candidateHash)throw Error('d175_candidate_hash_mismatch');
  const source=await readVerifiedSource(sourceRoot,t),transcript=await readFile(join(artifactRoot,`prepared-${tag}.txt`),'utf8');if(hash(transcript)!==artifact.preparation.transcriptSha256||source.receipt.sha256!==artifact.sourceSha256)throw Error('d175_review_source_stale');
  for(const ranges of [artifact.descriptionSupport,...artifact.questionAnswers.map((q:any)=>q.support)])for(const r of ranges)if(r.start<0||r.end<=r.start||r.end>transcript.length||hash(transcript.slice(r.start,r.end))!==r.sha256)throw Error('d175_review_support_stale');
  if(command==='read-candidate'){console.log(JSON.stringify({sequence,candidateHash,description:artifact.description,questionAnswers:artifact.questionAnswers,internalUncertainty:artifact.internalUncertainty,mechanicalProofread:artifact.mechanicalProofread},null,2));return;}
  if(!input||input.candidateHash!==candidateHash||input.transcriptCharactersRead!==transcript.length||input.questionAssessments.length!==artifact.questionAnswers.length)throw Error('d175_review_coverage_or_version_refused');
  if(record.reviewHash)throw Error('d175_existing_review_requires_explicit_revision');
  const review={decision:completionDecision,manifestSha256:completionManifestSha256,sourceSha256:source.receipt.sha256,transcriptSha256:hash(transcript),descriptionSha256:hash(artifact.description),questionAnswersSha256:hash(JSON.stringify(artifact.questionAnswers.map((q:any)=>({displayOrder:q.displayOrder,question:q.question,answer:q.answer})))),reviewedAt:new Date().toISOString(),reviewer:runtimeProvenance,independentReviewer:false,samuelAuthorizedAcceptance:true,publicationAuthority:false,...input};
  const reviewHash=hash(JSON.stringify(review));await persistImmutable(join(artifactRoot,`review-${tag}-v${String(record.version).padStart(3,'0')}.private.json`),JSON.stringify({...review,reviewHash},null,2));
  state.records[String(sequence)]={...record,stage:input.outcome==='accepted'?'ai_review_accepted':'ai_review_failed',reviewHash};state.history.push({sequence,stage:state.records[String(sequence)].stage,at:new Date().toISOString(),candidateHash,reviewHash});await persistCheckpoint(join(artifactRoot,'checkpoint.private.json'),state);
  console.log(JSON.stringify({decision:completionDecision,sequence,outcome:input.outcome,reviewHash,questionAnswersReviewed:input.questionAssessments.length}));return;
 }
 throw Error('d175_command_refused');
}
main().catch(e=>{const code=e instanceof Error&&/^d175_[a-z_]+$/u.test(e.message)?e.message:'d175_operation_failed';console.error(JSON.stringify({decision:completionDecision,error:code}));process.exitCode=1;});

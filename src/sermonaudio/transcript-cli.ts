import {readFile,mkdir,open,unlink,lstat} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {SermonAudioReader,SafeRetrievalError,sha256,assertAuthorizedTranscriptManifest,verifyBroadcaster,inventoryCandidate,verifyRecording,originalLanguage,transcriptDownloadUrl,inspectTranscriptBytes,type WordPressTranscriptSource,type RecordingTranscriptMetadata} from './transcript-retrieval';
import {retrieveWordPressMetadata,retainedWordPressMetadata} from './wordpress-transcript-inventory';
import {persistImmutable,persistCheckpoint,readCheckpoint} from './private-artifacts';

const privateRoot=resolve('private/sermonaudio-transcript-retrieval');
const credentialPath='C:/Users/samue/AppData/Local/SavingGraceBibleChurch/sermonaudio/api-key.txt';
interface Target {sequence:number;source:WordPressTranscriptSource;recording:RecordingTranscriptMetadata;metadataSha256:string;}
interface Inventory {schemaVersion:string;privateContent:true;decision:'D-174';createdAt:string;sourceSha256:string;apiSpecificationSha256:string;sourceCount:number;validYouTubeExcluded:number;ineligibleExcluded:number;unresolved:Record<string,unknown>[];targets:Target[];}
interface Receipt {sequence:number;wordpressId:number;sermonAudioId:string;outcome:'downloaded'|'unavailable'|'failed';reason:string;retrievedAt:string;sourceFile?:string;sha256?:string;byteCount?:number;wordCount?:number;characterCount?:number;sourceUrl?:string;language?:string;sourceVersion?:Record<string,unknown>;contentType?:string;format?:string;}
interface Checkpoint {manifestSha256:string;receipts:Receipt[];history:Record<string,unknown>[];}
const exists=async(path:string)=>Boolean(await lstat(path).catch(()=>null));
const immutable=persistImmutable;
async function checkpoint(value:Checkpoint){await persistCheckpoint(join(privateRoot,'checkpoint.private.json'),value);}
async function loadCheckpoint(hash:string):Promise<Checkpoint>{
 const path=join(privateRoot,'checkpoint.private.json');if(!await exists(path))return {manifestSha256:hash,receipts:[],history:[]};
 const value=await readCheckpoint<Checkpoint>(path);
 if(value.manifestSha256!==hash)throw new SafeRetrievalError('checkpoint_integrity_conflict');return value;
}
function safeSourcePath(name:string):string{const path=resolve(privateRoot,name),rel=relative(privateRoot,path);if(rel.startsWith('..')||isAbsolute(rel))throw new SafeRetrievalError('private_artifact_path_rejected');return path;}
async function verifiedReceipt(receipt:Receipt):Promise<boolean>{if(receipt.outcome!=='downloaded')return false;if(!receipt.sourceFile||!receipt.sha256)throw new SafeRetrievalError('source_receipt_incomplete');const bytes=await readFile(safeSourcePath(receipt.sourceFile));const checked=inspectTranscriptBytes(bytes);if(sha256(bytes)!==receipt.sha256||bytes.length!==receipt.byteCount||!checked.valid||checked.words!==receipt.wordCount)throw new SafeRetrievalError('saved_transcript_integrity_conflict');return true;}
async function acquireLock(){
 const path=join(privateRoot,'worker.lock');let file;
 try{file=await open(path,'wx',0o600);}catch{throw new SafeRetrievalError('existing_worker_lock_requires_reconciliation');}
 await file.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));await file.close();
 return async()=>{const current=JSON.parse(await readFile(path,'utf8'));if(current.pid!==process.pid)throw new SafeRetrievalError('worker_lock_ownership_conflict');await unlink(path);};
}
async function main(){
 const mode=process.argv[2];if(!['inventory','retrieve','verify'].includes(mode??''))throw new SafeRetrievalError('command_required_inventory_retrieve_or_verify');
 await mkdir(privateRoot,{recursive:true});
 if(execFileSync('git',['check-ignore','private/sermonaudio-transcript-retrieval/checkpoint.private.json'],{encoding:'utf8'}).trim()==='')throw new SafeRetrievalError('private_storage_not_ignored');
 const release=await acquireLock();
 try{
 const manifestPath=join(privateRoot,'manifest.private.json');
 if(mode==='inventory'){
  if(await exists(manifestPath)){const bytes=await readFile(manifestPath);assertAuthorizedTranscriptManifest(bytes);const inv=JSON.parse(bytes.toString()) as Inventory;await loadCheckpoint(sha256(bytes));console.log(JSON.stringify({status:'frozen_inventory_reused',targetCount:inv.targets.length,manifestSha256:sha256(bytes)}));return;}
  const key=(await readFile(credentialPath,'utf8')).trim(),api=new SermonAudioReader(key);
  const broadcaster=await api.metadata<unknown>('/v2/node/broadcasters/savinggrace');if(!verifyBroadcaster(broadcaster.value))throw new SafeRetrievalError('church_broadcaster_identity_conflict');
  await immutable(join(privateRoot,'broadcaster.private.json'),broadcaster.bytes);
  const sourcePath=join(privateRoot,'wordpress-source.private.json');
  const retainedAt=process.argv.indexOf('--retained-evidence');
  const retained=retainedAt>=0?process.argv[retainedAt+1]:undefined;
  const source=await exists(sourcePath)?JSON.parse(await readFile(sourcePath,'utf8')) as Awaited<ReturnType<typeof retrieveWordPressMetadata>>:retained?await retainedWordPressMetadata(resolve(retained)):await retrieveWordPressMetadata();
  await immutable(sourcePath,JSON.stringify(source));
  const specification=await fetch('https://api.sermonaudio.com/v2/openapi.json',{redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!specification.ok)throw new SafeRetrievalError('official_specification_unavailable',specification.status);
  const specBytes=new Uint8Array(await specification.arrayBuffer());const spec=JSON.parse(new TextDecoder().decode(specBytes));
  if(spec.components?.securitySchemes?.['x-api-key']?.name!=='X-Api-Key'||!spec.paths?.['/v2/node/sermons/{sermon_id}']?.get||!spec.components?.all_schemas?.TranscriptMedia?.properties?.downloadURL)throw new SafeRetrievalError('official_transcript_contract_changed');
  await immutable(join(privateRoot,'official-openapi.private.json'),specBytes);
  const inv:Inventory={schemaVersion:'sermonaudio-transcript-inventory/v1',privateContent:true,decision:'D-174',createdAt:new Date().toISOString(),sourceSha256:sha256(await readFile(sourcePath)),apiSpecificationSha256:sha256(specBytes),sourceCount:source.sources.length,validYouTubeExcluded:0,ineligibleExcluded:0,unresolved:[],targets:[]};
  const duplicateIds=new Map<string,number>();for(const s of source.sources){const c=inventoryCandidate(s);if(c.eligible)duplicateIds.set(c.recordingId!,(duplicateIds.get(c.recordingId!)??0)+1);}
  let checked=0;
  for(const s of source.sources){const c=inventoryCandidate(s);if(!c.eligible){if(c.reason==='valid_youtube_mapping_present')inv.validYouTubeExcluded++;else if(c.reason==='source_status_or_title_ineligible')inv.ineligibleExcluded++;else inv.unresolved.push({wordpressId:s.sourceWordPressId,title:s.title,date:s.serviceDate,outcome:c.reason==='conflicting_explicit_recordings'?'conflicting':'unavailable',reason:c.reason});continue;}
   if(duplicateIds.get(c.recordingId!)!==1){inv.unresolved.push({wordpressId:s.sourceWordPressId,outcome:'conflicting',reason:'recording_reused_by_multiple_source_records'});continue;}
   try{
    const evidencePath=join(privateRoot,'metadata-'+s.sourceWordPressId+'.private.json');
    const result=await exists(evidencePath)?{value:JSON.parse(await readFile(evidencePath,'utf8')) as RecordingTranscriptMetadata,bytes:new Uint8Array(await readFile(evidencePath))}:await api.metadata<RecordingTranscriptMetadata>('/v2/node/sermons/'+c.recordingId);
    await immutable(evidencePath,result.bytes);const verified=verifyRecording(s,result.value);
    if(!verified.valid){inv.unresolved.push({wordpressId:s.sourceWordPressId,sermonAudioId:c.recordingId,outcome:'conflicting',reason:verified.reason});continue;}
    inv.targets.push({sequence:inv.targets.length+1,source:s,recording:result.value,metadataSha256:sha256(result.bytes)});
   }catch(e){if(e instanceof SafeRetrievalError&&['authentication_or_permission_failure','rate_limited'].includes(e.classification))throw e;inv.unresolved.push({wordpressId:s.sourceWordPressId,sermonAudioId:c.recordingId,outcome:'unavailable',reason:e instanceof SafeRetrievalError?e.classification:'metadata_unavailable'});}
   checked++;if(checked%10===0)console.log(JSON.stringify({stage:'recording_identity_verification',checked,verified:inv.targets.length,unresolved:inv.unresolved.length}));
  }
  const bytes=JSON.stringify(inv);await immutable(manifestPath,bytes);await checkpoint(await loadCheckpoint(sha256(bytes)));
  console.log(JSON.stringify({status:'inventory_frozen',sourceCount:inv.sourceCount,targetCount:inv.targets.length,validYouTubeExcluded:inv.validYouTubeExcluded,ineligibleExcluded:inv.ineligibleExcluded,unresolved:inv.unresolved.length,manifestSha256:sha256(bytes),broadcasterVerified:true}));return;
 }
 const bytes=await readFile(manifestPath);assertAuthorizedTranscriptManifest(bytes);const inv=JSON.parse(bytes.toString()) as Inventory;const state=await loadCheckpoint(sha256(bytes));
 if(inv.decision!=='D-174'||inv.privateContent!==true||sha256(await readFile(join(privateRoot,'wordpress-source.private.json')))!==inv.sourceSha256)throw new SafeRetrievalError('frozen_inventory_source_conflict');
 if(new Set(inv.targets.map(t=>t.source.sourceWordPressId)).size!==inv.targets.length||new Set(inv.targets.map(t=>t.recording.sermonID)).size!==inv.targets.length||inv.targets.some((t,i)=>t.sequence!==i+1||!verifyRecording(t.source,t.recording).valid))throw new SafeRetrievalError('manifest_membership_conflict');
 if(new Set(state.receipts.map(r=>r.sequence)).size!==state.receipts.length||state.receipts.some(r=>!inv.targets.some(t=>t.sequence===r.sequence&&t.source.sourceWordPressId===r.wordpressId&&t.recording.sermonID===r.sermonAudioId)))throw new SafeRetrievalError('checkpoint_membership_conflict');
 for(const t of inv.targets){if(sha256(await readFile(join(privateRoot,'metadata-'+t.source.sourceWordPressId+'.private.json')))!==t.metadataSha256)throw new SafeRetrievalError('recording_metadata_integrity_conflict');}
 const priorCount=state.receipts.filter(r=>r.outcome==='downloaded').length;let newDownloads=0;
 const retryIndex=process.argv.indexOf('--retry-sequence');const retrySequence=retryIndex>=0?Number(process.argv[retryIndex+1]):null;
 if(retrySequence!==null){const old=state.receipts.find(r=>r.sequence===retrySequence);if(mode!=='retrieve'||!Number.isInteger(retrySequence)||!old||old.outcome!=='failed'||!['verification_failed','transport_failure','response_body_transport_failure','temporary_provider_failure'].includes(old.reason)||state.history.some(h=>h.sequence===retrySequence&&h.operation==='focused_retry'))throw new SafeRetrievalError('focused_retry_not_eligible');}
 let api:SermonAudioReader|undefined;
 if(mode==='retrieve'&&(retrySequence!==null||inv.targets.some(t=>!state.receipts.some(r=>r.sequence===t.sequence)))){
  api=new SermonAudioReader((await readFile(credentialPath,'utf8')).trim(),fetch,ms=>new Promise(r=>setTimeout(r,ms)),1000,retrySequence!==null?1:3);
  const b=await api.metadata<unknown>('/v2/node/broadcasters/savinggrace');if(!verifyBroadcaster(b.value))throw new SafeRetrievalError('church_broadcaster_identity_conflict');
 }
 const firstOnly=mode==='retrieve'&&process.argv.includes('--first');
 for(const target of firstOnly?inv.targets.slice(0,1):inv.targets){
  const saved=state.receipts.find(r=>r.sequence===target.sequence);
  if(saved){if(saved.wordpressId!==target.source.sourceWordPressId||saved.sermonAudioId!==target.recording.sermonID)throw new SafeRetrievalError('receipt_manifest_identity_conflict');await verifiedReceipt(saved);if(target.sequence!==retrySequence)continue;
   state.history.push({sequence:target.sequence,time:new Date().toISOString(),operation:'focused_retry',previousReceiptSha256:sha256(JSON.stringify(saved)),priorFailureReason:saved.reason,additionalRequestLimit:1,originalFailureDetailsUnavailable:true});await checkpoint(state);}
  if(mode==='verify')throw new SafeRetrievalError('inventory_not_fully_attempted');
  const r=target.recording;const receipt:Receipt={sequence:target.sequence,wordpressId:target.source.sourceWordPressId,sermonAudioId:r.sermonID,outcome:'unavailable',reason:'transcript_not_available',retrievedAt:new Date().toISOString()};
  try{
   if(r.transcript?.downloadURL){
    const language=originalLanguage(r);if(!language)throw new SafeRetrievalError('original_language_not_verified');
    const url=transcriptDownloadUrl(r.transcript.downloadURL),download=await api!.get(url,false),checked=inspectTranscriptBytes(download.bytes);
    if(!checked.valid)throw new SafeRetrievalError(checked.reason);
    const file='source-'+String(target.sequence).padStart(3,'0')+'.bin';await immutable(join(privateRoot,file),download.bytes);
    Object.assign(receipt,{outcome:'downloaded',reason:checked.reason,sourceFile:file,sourceUrl:url.href,sha256:sha256(download.bytes),byteCount:download.bytes.length,wordCount:checked.words,characterCount:checked.characters,format:checked.format,contentType:download.contentType,language,
      broadcaster:'savinggrace',metadataSha256:target.metadataSha256,sourceVersion:{recordingUpdateDate:r.updateDate,providerTranscriptApproveTimestamp:r.transcript.approveTimestamp,autoGenerated:r.transcript.autoGenerated,etag:download.etag,lastModified:download.lastModified},approvalState:'unapproved',audioVerified:false});
    newDownloads++;
   }
  }catch(e){if(e instanceof SafeRetrievalError&&['authentication_or_permission_failure','rate_limited'].includes(e.classification)){state.history.push({sequence:target.sequence,time:new Date().toISOString(),classification:e.classification,httpStatus:e.httpStatus});await checkpoint(state);throw e;}
   receipt.outcome='failed';receipt.reason=e instanceof SafeRetrievalError?e.classification:'verification_failed';}
  if(saved)state.receipts[state.receipts.indexOf(saved)]=receipt;else state.receipts.push(receipt);
  state.history.push({sequence:receipt.sequence,time:receipt.retrievedAt,outcome:receipt.outcome,reason:receipt.reason});
  await immutable(join(privateRoot,'receipt-'+String(receipt.sequence).padStart(3,'0')+(saved?'-retry-01':'')+'.private.json'),JSON.stringify(receipt));await checkpoint(state);
  console.log(JSON.stringify({sequence:receipt.sequence,outcome:receipt.outcome,reason:receipt.reason,bytes:receipt.byteCount??0,words:receipt.wordCount??0}));
 }
 const successes=state.receipts.filter(r=>r.outcome==='downloaded');
 const complete=state.receipts.length===inv.targets.length;
 const report={status:complete?'all_targets_attempted':'first_target_attempted',manifestSha256:sha256(bytes),sourceCount:inv.sourceCount,targetCount:inv.targets.length,attempted:state.receipts.length,previouslyRetrieved:priorCount,newDownloads,successful:successes.length,unavailable:state.receipts.filter(r=>r.outcome==='unavailable').length,failed:state.receipts.filter(r=>r.outcome==='failed').length,conflictingMappings:inv.unresolved.filter(r=>r.outcome==='conflicting').length,unavailableMappings:inv.unresolved.filter(r=>r.outcome==='unavailable').length,totalBytes:successes.reduce((n,r)=>n+(r.byteCount??0),0),totalWords:successes.reduce((n,r)=>n+(r.wordCount??0),0),hashesReverified:true};
 console.log(JSON.stringify(report));
 // A no-op replay reports newDownloads=0 but must not overwrite its original
 // completion evidence or turn an idempotent operation into a file conflict.
 if(mode==='retrieve'&&complete&&!await exists(join(privateRoot,'completion.private.json')))await immutable(join(privateRoot,'completion.private.json'),JSON.stringify({...report,completedAt:new Date().toISOString()}));
 if(retrySequence!==null)await immutable(join(privateRoot,'completion-retry-'+retrySequence+'.private.json'),JSON.stringify({...report,completedAt:new Date().toISOString(),originalCompletionPreserved:true}));
 }finally{await release();}
}
main().catch(e=>{console.error(JSON.stringify({status:'stopped',classification:e instanceof SafeRetrievalError?e.classification:'details_suppressed',httpStatus:e instanceof SafeRetrievalError?e.httpStatus:null,rawDiagnosticsSuppressed:true}));process.exitCode=1;});

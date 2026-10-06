import {createHash} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {inspectGeneratedText} from '../enrichment/generated-text-mechanical-qa';
import {verifyRecording,verifyBroadcaster,originalLanguage} from './transcript-retrieval';

export const completionDecision='D-175';
export const completionManifestSha256='a4fa3627682043c4b06aa65ddbebdab75f1fc29aec93e2d250bda537d9b0cd2b';
export const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
export const runtimeProvenance={provider:'OpenAI',product:'Codex',mode:'current interactive session',model:'not_exposed_by_runtime',immutableRevision:'not_exposed_by_runtime',sessionIdentifier:'not_exposed_by_runtime',separatelyBilledApiUsed:false} as const;
export interface FrozenTarget {sequence:number;source:{sourceWordPressId:number;title:string;serviceDate:string;status:string;sourceModifiedAt:string;speakerNames:string[];passageTexts:string[]};recording:{sermonID:string;fullTitle:string;preachDate:string;languageCode:string;languageCode3:string;broadcaster:{broadcasterID:string};speaker:{displayName:string};bibleText?:string;series?:unknown};metadataSha256:string;}
export interface FrozenInventory {targets:FrozenTarget[];sourceSha256:string;}
async function regularFile(path:string){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw Error('d175_file_type_refused');return readFile(path);}
export async function readFrozenInventory(root:string):Promise<FrozenInventory>{
 const raw=await regularFile(join(root,'manifest.private.json'));
 if(hash(raw)!==completionManifestSha256)throw Error('d175_manifest_hash_mismatch');
 const inventory=JSON.parse(raw.toString('utf8')) as FrozenInventory;
 if(inventory.targets.length!==119||new Set(inventory.targets.map(t=>t.source.sourceWordPressId)).size!==119||new Set(inventory.targets.map(t=>t.recording.sermonID)).size!==119)throw Error('d175_manifest_scope_refused');
 for(const [i,t] of inventory.targets.entries())if(t.sequence!==i+1||t.recording.broadcaster.broadcasterID!=='savinggrace'||!/^\d+$/u.test(t.recording.sermonID)||!Number.isSafeInteger(t.source.sourceWordPressId)||t.source.sourceWordPressId<=0||!verifyRecording(t.source as Parameters<typeof verifyRecording>[0],t.recording as Parameters<typeof verifyRecording>[1]).valid)throw Error('d175_source_identity_refused');
 if(!verifyBroadcaster(JSON.parse((await regularFile(join(root,'broadcaster.private.json'))).toString('utf8'))))throw Error('d175_broadcaster_refused');
 return inventory;
}
export async function readVerifiedSource(root:string,t:FrozenTarget){
 const checkpoint=JSON.parse((await regularFile(join(root,'checkpoint.private.json'))).toString('utf8')) as Record<string,any>;
 const {integritySha256,...payload}=checkpoint;
 if(hash(JSON.stringify(payload))!==integritySha256||payload.manifestSha256!==completionManifestSha256)throw Error('d175_retrieval_checkpoint_conflict');
 const receipt=Object.values(payload.receipts).find((r:any)=>r.sequence===t.sequence) as any;
 if(!receipt||receipt.outcome!=='downloaded'||receipt.wordpressId!==t.source.sourceWordPressId||String(receipt.sermonAudioId)!==t.recording.sermonID||receipt.broadcaster!=='savinggrace'||receipt.metadataSha256!==t.metadataSha256||!/^source-\d{3}\.bin$/u.test(receipt.sourceFile))throw Error('d175_source_receipt_refused');
 const raw=await regularFile(join(root,receipt.sourceFile));
 if(hash(raw)!==receipt.sha256||raw.length!==receipt.byteCount)throw Error('d175_source_hash_mismatch');
 const metadata=await regularFile(join(root,`metadata-${t.source.sourceWordPressId}.private.json`));
 if(hash(metadata)!==t.metadataSha256)throw Error('d175_metadata_hash_mismatch');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);
 if(!text.trim()||/<(?:html|script|iframe)\b/iu.test(text))throw Error('d175_source_text_refused');
 const language=originalLanguage(t.recording as Parameters<typeof originalLanguage>[0]);
 if(!language||language!==receipt.language||!['en','eng','ar','ara'].includes(language))throw Error('d175_source_language_refused');
 return {raw,text,receipt,language:(language==='ar'||language==='ara'?'ar':'en') as 'en'|'ar',providerLanguage:language};
}
export const lexicalWords=(s:string)=>s.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)??[];
/** Whitespace-only readability preparation; never synthesize source wording. */
export function prepareSource(text:string){
 const normalized=text.replace(/^\uFEFF/u,'').replace(/\r\n?/gu,'\n').trim();
 const paragraphs=normalized.split(/\n\s*\n/u).flatMap(block=>{
  const sentences=block.replace(/\s+/gu,' ').match(/[^.!?؟]+[.!?؟]+["'”’)]*|[^.!?؟]+$/gu)??[block];
  const groups:string[]=[];let group='';
  for(const sentence of sentences){if(group&&lexicalWords(group).length>=90){groups.push(group.trim());group='';}group+=(group?' ':'')+sentence.trim();}
  if(group.trim())groups.push(group.trim());return groups;
 });
 const prepared=paragraphs.join('\n\n');
 if(JSON.stringify(lexicalWords(text))!==JSON.stringify(lexicalWords(prepared)))throw Error('d175_preparation_word_preservation_failed');
 const markers=(s:string)=>s.match(/\[[^\]\n]*\]|\([^\)\n]*(?:inaudible|unclear)[^\)\n]*\)/giu)??[];
 if(JSON.stringify(markers(text))!==JSON.stringify(markers(prepared)))throw Error('d175_preparation_marker_preservation_failed');
 return prepared;
}
const plain=(max:number)=>z.string().trim().min(1).max(max).refine(s=>!/<\/?[a-z][^>]*>/iu.test(s));
export const candidateInputSchema=z.object({
 sequence:z.number().int().min(1).max(119),description:plain(2000),descriptionSupport:z.array(plain(2000)).min(1).max(12),
 questionAnswers:z.array(z.object({question:plain(1000),answer:plain(10000),support:z.array(plain(2000)).min(1).max(8)}).strict()).min(5).max(10),
 internalUncertainty:z.array(plain(2000)).max(100)
}).strict();
export type CandidateInput=z.infer<typeof candidateInputSchema>;
export function resolveSupport(text:string,anchors:string[]){return anchors.map(anchor=>{const start=text.indexOf(anchor);if(start<0)throw Error('d175_support_not_found');if(text.indexOf(anchor,start+1)>=0)throw Error('d175_support_ambiguous');return {start,end:start+anchor.length,sha256:hash(anchor)};});}
export function validateCandidate(text:string,raw:unknown,language:'en'|'ar'){
 const c=candidateInputSchema.parse(raw);const descriptionWords=lexicalWords(c.description).length;
 if(descriptionWords<180||descriptionWords>220)throw Error('d175_description_word_limit');
 if(language==='ar'&&(!/\p{Script=Arabic}/u.test(c.description)||c.questionAnswers.some(q=>!/\p{Script=Arabic}/u.test(q.question+q.answer))))throw Error('d175_original_language_refused');
 const descriptionSupport=resolveSupport(text,c.descriptionSupport);
 const questionSupport=c.questionAnswers.map(q=>{
  if(lexicalWords(q.question).length<8||lexicalWords(q.question).length>35||lexicalWords(q.answer).length<35||lexicalWords(q.answer).length>160)throw Error('d175_question_answer_word_limit');
  return resolveSupport(text,q.support);
 });
 const proofread=inspectGeneratedText(c.description,c.questionAnswers);
 if(proofread.outcome==='failed')throw Error('d175_mechanical_validation_failed');
 return {candidate:c,descriptionWords,descriptionSupport,questionSupport,proofread};
}

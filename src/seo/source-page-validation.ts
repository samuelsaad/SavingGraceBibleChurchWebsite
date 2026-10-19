/** Per-runtime immutable validation reuse; every read still checks exact wire bytes. */
import {sourcePageSchema,sourceVersionHash,sha256,stableJson,type SourcePublicPage} from './source-public-model';
const certifiedPages=new WeakSet<object>();
const contentJson=new WeakMap<object,string>();
/** Exact canonical JSON is reusable only for version-certified immutable pages. */
export function sourcePageContentJson(page:SourcePublicPage):string{
 if(!certifiedPages.has(page))return stableJson(page.content);
 const previous=contentJson.get(page);if(previous!==undefined)return previous;
 const value=stableJson(page.content);contentJson.set(page,value);return value;
}
export type SourcePageValidator=(payload:unknown,version:string)=>SourcePublicPage;
const cacheStates=new WeakMap<SourcePageValidator,{manifest:()=>Record<string,string>;reuse:(version:string,wireSha256:string)=>SourcePublicPage}>();
export function sourcePageValidationManifest(cache:SourcePageValidator):Record<string,string>{
 const state=cacheStates.get(cache);if(!state)throw Error('source_validation_cache_identity');return state.manifest();
}
/** PostgreSQL hashes current UTF-8 payload bytes even when it omits known wire bodies. */
export function readCertifiedSourcePage(cache:SourcePageValidator,payload:unknown,version:string,wireSha256:unknown):SourcePublicPage{
 const state=cacheStates.get(cache);if(!state)throw Error('source_validation_cache_identity');
 if(typeof wireSha256!=='string'||!/^[a-f0-9]{64}$/u.test(wireSha256))throw Error('source_public_wire_integrity');
 if(payload===null)return state.reuse(version,wireSha256);
 if(typeof payload!=='string'||sha256(payload)!==wireSha256)throw Error('source_public_wire_integrity');
 return cache(payload,version);
}
export function validateSourcePagePayload(payload:unknown,version:string):SourcePublicPage{
 const page=sourcePageSchema.parse(typeof payload==='string'?JSON.parse(payload):payload);
 if(sourceVersionHash(page)!==version)throw Error('source_public_version_integrity');
 return page;
}
/** Unknown or mutable inputs still cross the complete schema boundary. */
export function previouslyValidatedSourcePage(input:unknown):SourcePublicPage{
 return input!==null&&typeof input==='object'&&certifiedPages.has(input)?input as SourcePublicPage:sourcePageSchema.parse(input);
}
function freeze(value:unknown):void{
 if(value===null||typeof value!=='object'||Object.isFrozen(value))return;
 for(const child of Object.values(value))freeze(child);
 Object.freeze(value);
}
export function createSourcePageValidationCache(maxEntries=8192):SourcePageValidator{
 if(!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>16384)throw Error('source_validation_cache_bound');
 const entries=new Map<string,{wireSha256:string;page:SourcePublicPage}>();
 const validate:SourcePageValidator=(payload,version)=>{
  if(!/^[a-f0-9]{64}$/u.test(version))throw Error('source_public_version_integrity');
  const wire=typeof payload==='string'?payload:JSON.stringify(payload),wireSha256=sha256(wire),existing=entries.get(version);
  if(existing?.wireSha256===wireSha256){entries.delete(version);entries.set(version,existing);return existing.page;}
  const page=validateSourcePagePayload(wire,version);freeze(page);certifiedPages.add(page);
  entries.delete(version);entries.set(version,{wireSha256,page});
  while(entries.size>maxEntries)entries.delete(entries.keys().next().value!);
  return page;
 };
 cacheStates.set(validate,{manifest:()=>Object.fromEntries([...entries].map(([version,entry])=>[version,entry.wireSha256])),reuse:(version,wireSha256)=>{const entry=entries.get(version);if(!entry||entry.wireSha256!==wireSha256)throw Error('source_public_cached_payload_missing');entries.delete(version);entries.set(version,entry);return entry.page;}});
 return validate;
}

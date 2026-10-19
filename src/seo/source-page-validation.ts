/** Per-runtime immutable validation reuse; every read still checks exact wire bytes. */
import {sourcePageSchema,sourceVersionHash,sha256,type SourcePublicPage} from './source-public-model';
const certifiedPages=new WeakSet<object>();
export type SourcePageValidator=(payload:unknown,version:string)=>SourcePublicPage;
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
 return (payload,version)=>{
  if(!/^[a-f0-9]{64}$/u.test(version))throw Error('source_public_version_integrity');
  const wire=typeof payload==='string'?payload:JSON.stringify(payload),wireSha256=sha256(wire),existing=entries.get(version);
  if(existing?.wireSha256===wireSha256){entries.delete(version);entries.set(version,existing);return existing.page;}
  const page=validateSourcePagePayload(wire,version);freeze(page);certifiedPages.add(page);
  entries.delete(version);entries.set(version,{wireSha256,page});
  while(entries.size>maxEntries)entries.delete(entries.keys().next().value!);
  return page;
 };
}

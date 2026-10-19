/** Preserve valid rendered dates; repair invalid date metadata only from one matching primary WebPage. */
export interface SourceDateCapture{url:string;sourcePostId?:number|null;canonicalUrls?:readonly string[];publishedAt?:string|null;modifiedAt?:string|null;meta?:Record<string,string[]>;schema?:unknown[];}
function valid(value:unknown):string|null{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/u.test(value)||!Number.isFinite(Date.parse(value)))return null;return new Date(value).toISOString();}
function own(value:string):URL|null{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&['savinggrace.org.au','www.savinggrace.org.au'].includes(url.hostname)&&!url.username&&!url.password&&!url.port?url:null;}catch{return null;}}
export function sourcePageDate(capture:SourceDateCapture,key:'publishedAt'|'modifiedAt'):string|null{
 const original=capture[key],preserved=valid(original);if(preserved)return preserved;
 const field=key==='publishedAt'?'article:published_time':'article:modified_time',rendered=capture.meta?.[field];
 if(!original||rendered?.length!==1||rendered[0]!==original||!Number.isSafeInteger(capture.sourcePostId)||capture.sourcePostId!<=0)return null;
 const canonicals=[...new Set(capture.canonicalUrls??[])];if(canonicals.length!==1)return null;
 const canonical=own(canonicals[0]!),observed=own(capture.url);if(!canonical||!observed||canonical.hash||canonical.pathname!==observed.pathname)return null;
 const matches:string[]=[];let count=0;
 const visit=(value:unknown,depth=0):void=>{if(depth>30||++count>20000)throw Error('source_page_date_schema_limit');if(Array.isArray(value)){for(const child of value)visit(child,depth+1);return;}if(!value||typeof value!=='object')return;const node=value as Record<string,unknown>;
  if(node['@type']==='WebPage'&&typeof node.url==='string'&&typeof node['@id']==='string'){const url=own(node.url),id=own(node['@id']);if(url&&id&&url.pathname+url.search===canonical.pathname+canonical.search&&id.pathname+id.search===canonical.pathname+canonical.search&&id.hash==='#webpage'){const date=valid(node[key==='publishedAt'?'datePublished':'dateModified']);if(date)matches.push(date);}}
  for(const child of Object.values(node))if(child&&typeof child==='object')visit(child,depth+1);
 };visit(capture.schema??[]);const unique=[...new Set(matches)];return unique.length===1?unique[0]!:null;
}

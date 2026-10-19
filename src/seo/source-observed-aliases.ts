import type {SourcePublicPage} from './source-public-model';
export interface ObservedSourceAlias {
 readonly alias:string;readonly target:string;readonly sourceId:number|null;readonly kind:SourcePublicPage['kind'];readonly responseSha256:string;
 readonly dispositionEvidence?:{readonly reason:string;readonly sourceResponseSha256:string;readonly sourceRecordSha256:string;readonly memberPaths:readonly string[]};
 readonly chain:readonly {readonly urlSha256:string;readonly recordSha256:string;readonly status:number}[];
}
/** A retained source redirect is active only while its exact target identity exists.
 * Current editorial ownership of the alias wins; target withdrawals propagate.
 */
export function bindObservedSourceAliases(pages:readonly SourcePublicPage[],aliases:readonly ObservedSourceAlias[],owned:ReadonlySet<string>,canonical:(path:string)=>string|null|undefined,sermonPaths:Readonly<Record<string,string>>={}){
 const source=new Map(pages.map(page=>[page.path,page]));const result:Record<string,string|null>={};
 for(const row of aliases){
  if(owned.has(row.alias))continue;
  const page=source.get(row.target);
  if(!page||page.issues.length||page.sourceId!==row.sourceId||page.kind!==row.kind||page.responseSha256!==row.responseSha256)continue;
  if(row.dispositionEvidence&&!row.dispositionEvidence.memberPaths.every(path=>page.links.some(href=>{try{return new URL(href,'https://www.savinggrace.org.au').pathname===path;}catch{return false;}})))continue;
  const target=canonical(page.kind==='sermon'?(sermonPaths[String(page.sourceId)]??page.path):page.path);
  if(target===undefined||target===row.alias)continue;
  result[row.alias]=target;
 }
 return result;
}
/** Match exact semantic parameters; campaign values retain their original bytes. */
export function observedAlias(url:URL,aliases:Readonly<Record<string,string|null>>):{target:string|null}|null{
 const exact=url.pathname+url.search;
 if(Object.hasOwn(aliases,exact))return {target:aliases[exact]!};
 const campaign:string[]=[],semantic:string[]=[];
 for(const part of url.search.slice(1).split('&').filter(Boolean)){
  const key=[...new URLSearchParams(part).keys()][0]??'';
  (/^(?:utm_[a-z_]+|gclid|wbraid|gbraid)$/u.test(key)?campaign:semantic).push(part);
 }
 const semanticKey=url.pathname+(semantic.length?'?'+semantic.join('&'):'');
 if(Object.hasOwn(aliases,semanticKey)){
  const target=aliases[semanticKey]!;
  return {target:target===null?null:target+(campaign.length?(target.includes('?')?'&':'?')+campaign.join('&'):'')};
 }
 if(Object.hasOwn(aliases,url.pathname)){
  const target=aliases[url.pathname]!;
  return {target:target===null?null:target+(url.search?(target.includes('?')?'&':'?')+url.search.slice(1):'')};
 }
 return null;
}

/** Bounded corrections to captured archive canonical signals, never source content. */
import {legacyDisposition} from '../frontend/content/registry';
import {publicRenderContext,type FrontendRenderContext} from '../frontend/routes';
import {sourceHosts,stableJson,type SourcePublicPage} from './source-public-model';
export interface SourceRoutePresentation {canonicalPath:string;indexable:boolean;reason:'source_self'|'distinct_pagination'|'distinct_source_archive'|'calendar_navigation'|'verified_equivalent_source'}
function capturedCanonicalPath(page:SourcePublicPage):string|null{
 if(!page.canonicalSource)return null;
 try{const url=new URL(page.canonicalSource);return ['http:','https:'].includes(url.protocol)&&sourceHosts.has(url.hostname)&&!url.username&&!url.password&&!url.port&&!url.hash?url.pathname+url.search:null;}catch{return null;}
}
function calendarBase(path:string):string|null{
 const match=/^(\/events\/(?:(?:category|tag)\/[^/]+\/)?)(.+)\/$/u.exec(path);if(!match)return null;
 const suffix=match[2]!;
 return /^(?:(?:list|month|week|day|today)(?:\/(?:\d{4}-\d{2}(?:-\d{2})?|page\/[1-9][0-9]*))?|\d{4}-\d{2}(?:-\d{2})?)$/u.test(suffix)?match[1]!:null;
}
export function sourcePresentationPolicy(pages:readonly SourcePublicPage[],context:FrontendRenderContext=publicRenderContext){
 const current=new Map(pages.filter(page=>!page.issues.length).map(page=>[page.path,page]));
 return(page:SourcePublicPage):SourceRoutePresentation=>{
  const original=capturedCanonicalPath(page),base:SourceRoutePresentation={canonicalPath:page.path,indexable:page.indexable,reason:original&&original!==page.path?'distinct_source_archive':'source_self'};
  if(page.kind!=='archive')return base;
  // Pagination identifies a different captured result set. Preserve source noindex where present.
  if(/\/page\/(?:[2-9]|[1-9][0-9]+)\/$/u.test(page.path))return {...base,reason:'distinct_pagination'};
  const collection=calendarBase(page.path);
  if(collection){
   let canonicalPath=page.path;
   if(current.has(collection)){
    const disposition=legacyDisposition(collection,context);
    const destination=disposition?.kind==='redirect'?disposition.location:disposition?null:collection;
    if(destination&&(current.has(destination)||context.siteContent?.routes.some(route=>route.path===destination&&route.status===200)))canonicalPath=destination;
   }
   return {canonicalPath,indexable:false,reason:'calendar_navigation'};
  }
  // No event-tag -> blog-tag or all-instances -> first-instance inference.
  // A different original canonical is kept only for a nonempty identical source projection.
  if(original&&original!==page.path){
   const target=current.get(original);
   if(target&&target.kind===page.kind&&target.indexable&&target.content.length>0&&page.heading===target.heading
    &&stableJson(page.content)===stableJson(target.content)&&capturedCanonicalPath(target)===target.path
    &&!legacyDisposition(target.path,context))return {canonicalPath:target.path,indexable:page.indexable,reason:'verified_equivalent_source'};
  }
  return base;
 };
}

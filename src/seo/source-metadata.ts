import {originalCalendarGroups} from '../frontend/content/calendar-groups';
import type {FrontendSiteSnapshot} from '../frontend/content/site-snapshot';
import type {ContentSeo} from '../frontend/seo';
import type {SourcePublicPage} from './source-public-model';
import {sha256} from './source-public-model';
import {legacyDisposition} from '../frontend/content/registry';
import {publicRenderContext} from '../frontend/routes';
import {valuableOriginalTaxonomyQuery} from './source-query-indexing';
/** Captured public metadata supplies defaults; explicit versioned CMS overrides win. */
const sourcePhotoId=(page:SourcePublicPage)=>'source-photo-'+sha256(page.path);
export function sourceSocialAssets(pages:readonly SourcePublicPage[],registered:FrontendSiteSnapshot['assets']={}){return Object.fromEntries(pages.flatMap(page=>{if(!page.asset?.contentType.startsWith('image/')||page.issues.length)return [];const known=Object.values(registered).find(image=>image.path.endsWith('/'+page.asset!.storageKey)&&image.type===page.asset!.contentType);return known&&known.width>0&&known.height>0?[[sourcePhotoId(page),{...known,id:sourcePhotoId(page),path:page.path}]]:[];}));}
export function sourceSeo(page:SourcePublicPage,pages:readonly SourcePublicPage[]=[]):ContentSeo{
 let image:string|undefined;if(page.socialImageSource){try{const url=new URL(page.socialImageSource);if(url.hostname==='stage.savinggrace.org.au'&&/SGBC-Logo/iu.test(url.pathname))image='church-logo';}catch{}}
 if(!image&&page.socialImageSource){try{const url=new URL(page.socialImageSource);if(['www.savinggrace.org.au','savinggrace.org.au'].includes(url.hostname)){const verified=pages.find(p=>p.path===url.pathname+url.search&&p.asset?.contentType.startsWith('image/')&&!p.issues.length);if(verified)image=sourcePhotoId(verified);}}catch{}}
 return{title:page.title,...(page.socialType?{socialType:page.socialType}:{}),description:page.description??'',...(page.socialTitle?{socialTitle:page.socialTitle}:{}),...(page.socialDescription?{socialDescription:page.socialDescription}:{}),...(image?{image}:{}),...(!page.indexable?{noindex:true}:{})};
}
export function preserveSourceMetadata(snapshot:FrontendSiteSnapshot,pages:readonly SourcePublicPage[]):FrontendSiteSnapshot{
 // Metadata overlay replaces containers; immutable content trees stay shared.
 const result={...snapshot,home:snapshot.home?{...snapshot.home}:null},source=new Map(pages.filter(p=>p.kind!=='asset'&&p.issues.length===0).map(p=>[p.path,p]));
 result.assets={...result.assets,...sourceSocialAssets(pages,result.assets)};
 result.cmsExplicitSeoByPath={...Object.fromEntries([...snapshot.pages,...snapshot.posts,...snapshot.events].filter(page=>page.seo).map(page=>[page.path,page.seo!])),...(snapshot.home?.seo?{'/':snapshot.home.seo}:{})};
 const merge=<T extends {path:string;seo?:ContentSeo}>(page:T):T=>{const original=source.get(page.path);return original?{...page,seo:{...sourceSeo(original,pages),...page.seo}}:page;};
 result.sourceSeoByPath=Object.fromEntries(pages.filter(p=>p.kind!=='asset'&&p.issues.length===0).map(p=>[p.path,sourceSeo(p,pages)]));
 result.sourceArchiveHeadingsByPath=Object.fromEntries(pages.filter(p=>p.kind==='archive'&&!p.issues.length&&valuableOriginalTaxonomyQuery(p.path,p.content)).map(p=>[p.path,p.heading]));
 result.pages=result.pages.map(merge);result.posts=result.posts.map(merge);result.events=result.events.map(merge);
 const home=source.get('/');if(result.home&&home)result.home.seo={...sourceSeo(home,pages),...result.home.seo};
 const sourceContentByPath:Record<string,SourcePublicPage[]>={};
 for(const page of pages){
  if(!['page','post','event','attachment','archive'].includes(page.kind)||page.kind==='archive'&&page.path.startsWith('/sermons/')||page.issues.length)continue;
  let path=page.path;
  const owner=[...result.pages,...result.posts,...result.events].find(item=>(item as {legacyPaths?:readonly string[]}).legacyPaths?.includes(page.path));if(owner&&!result.routes.some(route=>route.path===page.path))path=owner.path;
  const seen=new Set<string>();
  while(!seen.has(path)){seen.add(path);const route=result.routes.find(r=>r.path===path);if(route?.status===410){path='';break;}if(route?.status===301){if(!route.targetPath){path='';break;}path=route.targetPath;continue;}if(route?.status===200)break;const legacy=legacyDisposition(path,{...publicRenderContext,siteContent:result});if(!legacy)break;if(legacy.kind!=='redirect'){path='';break;}path=legacy.location;}
  if(path)(sourceContentByPath[path]??=[]).push(page);
 }
 result.sourceContentByPath=sourceContentByPath;
 const scopes:Record<string,string[]>={};
 for(const event of result.events.filter(e=>e.calendarVisible!==false)){
  const sourcePages=event.tag===undefined?pages.filter(p=>p.kind==='event'&&(event.sourceIds.includes(p.sourceId??-1)||event.legacyPaths.some(path=>p.path===path||p.path.startsWith(path)&&/^\d{4}-\d{2}-\d{2}\/$/u.test(p.path.slice(path.length))))):[];
  for(const original of sourcePages)for(const href of original.links){try{const u=new URL(href,'https://www.savinggrace.org.au');if(['www.savinggrace.org.au','savinggrace.org.au'].includes(u.hostname)&&/^\/events\/(?:category|tag)\/[^/]+\/$/u.test(u.pathname)){const ids=scopes[u.pathname]??=[];if(!ids.includes(event.id))ids.push(event.id);}}catch{}}
  const group=originalCalendarGroups.find(group=>group.tag===event.tag?.toUpperCase());
  if(group)for(const scope of ['/events/category/'+group.categorySlug+'/','/events/tag/'+group.tagSlug+'/',group.organizerPath]){const ids=scopes[scope]??=[];if(!ids.includes(event.id))ids.push(event.id);}
 }
 result.eventScopeIds=scopes;
 result.sourceCalendarIdentityPaths=Object.fromEntries(pages.filter(p=>p.sourceId!==null&&!p.issues.length&&/^\/(?:venue|organiser)\/[^/]+\/$/u.test(p.path)).map(p=>[String(p.sourceId),p.path]));
 for(const [path,originals]of Object.entries(sourceContentByPath)){const primary=originals.filter(page=>page.kind!=='archive'),original=originals.length===1?originals[0]:primary.length===1?primary[0]:undefined;if(original&&!result.sourceSeoByPath?.[path])result.sourceSeoByPath={...result.sourceSeoByPath,[path]:sourceSeo(original,pages)};}
 const dates={...result.modifiedAtByPath};for(const [path,originals]of Object.entries(sourceContentByPath))if(originals.length===1&&originals[0]!.modifiedAt&&!dates[path])dates[path]=originals[0]!.modifiedAt;for(const page of pages)if(page.modifiedAt&&!dates[page.path]&&result.routes.some(r=>r.path===page.path&&r.status===200))dates[page.path]=page.modifiedAt;result.modifiedAtByPath=dates;
 return result;
}

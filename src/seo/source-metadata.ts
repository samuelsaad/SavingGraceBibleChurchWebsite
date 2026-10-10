import type {FrontendSiteSnapshot} from '../frontend/content/site-snapshot';
import type {ContentSeo} from '../frontend/seo';
import type {SourcePublicPage} from './source-public-model';
/** Captured public metadata supplies defaults; explicit versioned CMS overrides win. */
export function sourceSeo(page:SourcePublicPage):ContentSeo{
 let image:string|undefined;if(page.socialImageSource){try{const url=new URL(page.socialImageSource);if(url.hostname==='stage.savinggrace.org.au'&&/SGBC-Logo/iu.test(url.pathname))image='church-logo';}catch{}}
 return{title:page.title,...(page.socialType?{socialType:page.socialType}:{}),description:page.description??'',...(page.socialTitle?{socialTitle:page.socialTitle}:{}),...(page.socialDescription?{socialDescription:page.socialDescription}:{}),...(image?{image}:{}),...(!page.indexable?{noindex:true}:{})};
}
export function preserveSourceMetadata(snapshot:FrontendSiteSnapshot,pages:readonly SourcePublicPage[]):FrontendSiteSnapshot{
 const result=structuredClone(snapshot),source=new Map(pages.filter(p=>p.kind!=='asset'&&p.issues.length===0).map(p=>[p.path,p]));
 result.cmsExplicitSeoByPath={...Object.fromEntries([...snapshot.pages,...snapshot.posts,...snapshot.events].filter(page=>page.seo).map(page=>[page.path,page.seo!])),...(snapshot.home?.seo?{'/':snapshot.home.seo}:{})};
 const merge=<T extends {path:string;seo?:ContentSeo}>(page:T):T=>{const original=source.get(page.path);return original?{...page,seo:{...sourceSeo(original),...page.seo}}:page;};
 result.sourceSeoByPath=Object.fromEntries(pages.filter(p=>p.kind!=='asset'&&p.issues.length===0).map(p=>[p.path,sourceSeo(p)]));
 result.pages=result.pages.map(merge);result.posts=result.posts.map(merge);result.events=result.events.map(merge);
 const home=source.get('/');if(result.home&&home)result.home.seo={...sourceSeo(home),...result.home.seo};
 const sourceContentByPath:Record<string,SourcePublicPage[]>={};
 for(const page of pages){
  if(!['page','post','event','attachment','archive'].includes(page.kind)||page.kind==='archive'&&page.path.startsWith('/sermons/')||page.issues.length)continue;
  let path=page.path;
  const owner=[...result.pages,...result.posts,...result.events].find(item=>(item as {legacyPaths?:readonly string[]}).legacyPaths?.includes(page.path));if(owner&&!result.routes.some(route=>route.path===page.path))path=owner.path;
  const seen=new Set<string>();
  while(!seen.has(path)){seen.add(path);const route=result.routes.find(r=>r.path===path);if(route?.status===410){path='';break;}if(route?.status!==301)break;if(!route.targetPath){path='';break;}path=route.targetPath;}
  if(path)(sourceContentByPath[path]??=[]).push(page);
 }
 result.sourceContentByPath=sourceContentByPath;
 for(const [path,originals]of Object.entries(sourceContentByPath)){const primary=originals.filter(page=>page.kind!=='archive'),original=originals.length===1?originals[0]:primary.length===1?primary[0]:undefined;if(original&&!result.sourceSeoByPath?.[path])result.sourceSeoByPath={...result.sourceSeoByPath,[path]:sourceSeo(original)};}
 const dates={...result.modifiedAtByPath};for(const [path,originals]of Object.entries(sourceContentByPath))if(originals.length===1&&originals[0]!.modifiedAt&&!dates[path])dates[path]=originals[0]!.modifiedAt;for(const page of pages)if(page.modifiedAt&&!dates[page.path]&&result.routes.some(r=>r.path===page.path&&r.status===200))dates[page.path]=page.modifiedAt;result.modifiedAtByPath=dates;
 return result;
}

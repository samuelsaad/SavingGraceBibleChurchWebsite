import {latestSitemapDate} from './sitemap-dates';
import{maintainedLegacyCalendarQuery}from'./calendar-subscriptions';
import {resolveHref} from '../frontend/content/markup';
import {sourcePresentationPolicy} from './source-route-policy';
import {sourceSeo} from './source-metadata';
import {valuableOriginalTaxonomyQuery} from './source-query-indexing';
import {html} from '../frontend/html';
import {pageShell} from '../frontend/shell';
import {renderSourceContent} from '../frontend/source-content';
import type {FrontendRenderContext} from '../frontend/routes';
import {frontendResponse} from '../server/http/frontend-response';
import type {SourcePublicPage} from './source-public-model';
export function createSourcePublicPageHandler(pages:readonly SourcePublicPage[],queryOnly=false){
 const table=new Map(pages.filter(page=>page.kind!=='sermon'&&page.kind!=='feed'&&page.kind!=='asset'&&page.issues.length===0).map(page=>[page.path,page]));
 return async(request:Request,context:FrontendRenderContext):Promise<Response|null>=>{const url=new URL(request.url),path=url.pathname;if(queryOnly&&(!url.search||!table.has(path+url.search)))return null;const page=table.get(path+url.search)??table.get(path);if(!page){const canonical=table.get(path+'/');return canonical?new Response(null,{status:301,headers:{Location:path+'/'+new URL(request.url).search}}):null;}
  // Observed sermon facets retain the selected native archive design and its
  // real pagination. Their captured metadata is supplied by the snapshot.
  if(page.kind==='archive'&&valuableOriginalTaxonomyQuery(page.path,page.content))return null;
  const presentation=sourcePresentationPolicy(pages,context)(page);
  return frontendResponse(pageShell({sourceContentRendered:true,title:page.heading,seo:{...sourceSeo(page,pages),noindex:!presentation.indexable},canonicalPath:presentation.canonicalPath,sourceMetadata:{language:page.language,publishedAt:page.publishedAt,modifiedAt:page.modifiedAt,...(page.structuredData?{primary:page.structuredData.primary,breadcrumbs:page.structuredData.breadcrumbs}:{})},robots:presentation.indexable?'index, follow':'noindex, follow',styles:['sermon'],body:html`<article class="sermon"><div class="sermon__body" lang="${page.language}" dir="${page.language.startsWith('ar')?'rtl':'ltr'}"><header class="sermon__head"><h1 class="sermon__title">${page.heading}</h1></header><div class="prose">${renderSourceContent(page.content,href=>resolveHref(href,context))}</div></div></article>`},context));
 };
}
/** Original XML associations are source-bound data, never remote fetches. Current
 * published ownership and explicit content replacement govern their inclusion. */
export function sourcePublicSitemap(pages:readonly SourcePublicPage[],context?:FrontendRenderContext){
 const policy=sourcePresentationPolicy(pages,context),entries=new Map<string,import('./http-sitemap').SitemapUrl>();
 for(const p of pages){const presentation=policy(p),legacy=context?.siteContent?maintainedLegacyCalendarQuery(new Request('https://www.savinggrace.org.au'+p.path),context):null;
  if((!legacy||legacy.status===200)&&presentation.indexable&&presentation.canonicalPath===p.path&&!p.issues.length&&!['sermon','feed','asset'].includes(p.kind))entries.set(p.path,{path:p.path,...(p.modifiedAt?{lastModified:p.modifiedAt}:{})});
 }
 const assets=new Map(pages.filter(p=>p.kind==='asset'&&!p.issues.length&&p.asset?.contentType.startsWith('image/')&&p.asset.bytes>0).map(p=>[p.path,p.asset!.sha256]));
 const groups=context?.siteContent?.sourceContentByPath??Object.fromEntries(pages.map(p=>[p.path,[p]]));
 for(const [path,originals]of Object.entries(groups)){
  const explicit=context?.siteContent?.cmsExplicitSeoByPath?.[path];if(explicit?.noindex||explicit?.replaceSourceContent)continue;
  const current=context?.siteContent?.routes.find(route=>route.path===path);
  if(current&&current.status!==200)continue;
  if(!current&&!entries.has(path))continue;
  const sourceImages=originals.filter(p=>policy(p).indexable&&!p.issues.length).flatMap(p=>p.sitemapImages??[]);
  for(const image of sourceImages)if(assets.get(image.path)!==image.sha256)throw Error('source_sitemap_image_asset_unverified');
  const featured=explicit?.image?context?.siteContent?.assets[explicit.image]?.path:undefined;
  const images=[...new Set([...sourceImages.map(image=>image.path),...(featured?[featured]:[])])];
  const modified=latestSitemapDate([entries.get(path)?.lastModified,...originals.filter(p=>policy(p).indexable&&!p.issues.length).map(p=>p.modifiedAt)]);
  if(images.length||modified)entries.set(path,{...(entries.get(path)??{path}),...(modified?{lastModified:modified}:{}),...(images.length?{images}:{})});
 }
 return [...entries.values()];
}

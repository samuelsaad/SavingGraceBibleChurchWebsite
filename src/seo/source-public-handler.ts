import {resolveHref} from '../frontend/content/markup';
import {sourcePresentationPolicy} from './source-route-policy';
import {sourceSeo} from './source-metadata';
import {html} from '../frontend/html';
import {pageShell} from '../frontend/shell';
import {renderSourceContent} from '../frontend/source-content';
import type {FrontendRenderContext} from '../frontend/routes';
import {frontendResponse} from '../server/http/frontend-response';
import type {SourcePublicPage} from './source-public-model';
export function createSourcePublicPageHandler(pages:readonly SourcePublicPage[],queryOnly=false){
 const table=new Map(pages.filter(page=>page.kind!=='sermon'&&page.kind!=='feed'&&page.kind!=='asset'&&page.issues.length===0).map(page=>[page.path,page]));
 return async(request:Request,context:FrontendRenderContext):Promise<Response|null>=>{const url=new URL(request.url),path=url.pathname;if(queryOnly&&(!url.search||!table.has(path+url.search)))return null;const page=table.get(path+url.search)??table.get(path);if(!page){const canonical=table.get(path+'/');return canonical?new Response(null,{status:301,headers:{Location:path+'/'+new URL(request.url).search}}):null;}
  const presentation=sourcePresentationPolicy(pages,context)(page);
  return frontendResponse(pageShell({sourceContentRendered:true,title:page.heading,seo:{...sourceSeo(page),noindex:!presentation.indexable},canonicalPath:presentation.canonicalPath,sourceMetadata:{language:page.language,publishedAt:page.publishedAt,modifiedAt:page.modifiedAt,...(page.structuredData?{primary:page.structuredData.primary,breadcrumbs:page.structuredData.breadcrumbs}:{})},robots:presentation.indexable?'index, follow':'noindex, follow',styles:['sermon'],body:html`<article class="sermon"><div class="sermon__body" lang="${page.language}" dir="${page.language.startsWith('ar')?'rtl':'ltr'}"><header class="sermon__head"><h1 class="sermon__title">${page.heading}</h1></header><div class="prose">${renderSourceContent(page.content,href=>resolveHref(href,context))}</div></div></article>`},context));
 };
}
export function sourcePublicSitemap(pages:readonly SourcePublicPage[],context?:FrontendRenderContext){const policy=sourcePresentationPolicy(pages,context);return pages.filter(p=>{const presentation=policy(p);return presentation.indexable&&presentation.canonicalPath===p.path&&p.issues.length===0&&p.kind!=='sermon'&&p.kind!=='feed'&&p.kind!=='asset';}).map(p=>({path:p.path,...(p.modifiedAt?{lastModified:p.modifiedAt.slice(0,10)}:{})}));}

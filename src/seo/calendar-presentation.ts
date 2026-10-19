/** Shared HTTP/sitemap ownership gate for computed source calendars. */
import {simplifySourceNodes} from './source-cms-adoption';
import {sha256,stableJson} from './source-public-model';
import type {FrontendRenderContext} from '../frontend/routes';
export function calendarEditorAllowsProjection(path:string,context:FrontendRenderContext):boolean{
 const content=context.siteContent;if(!content||content.cmsExplicitSeoByPath?.[path]?.replaceSourceContent)return false;
 let target=path;const seen=new Set<string>();
 for(;;){if(seen.has(target))return false;seen.add(target);const route=content.routes.find(route=>route.path===target);if(!route){if(target!==path)return false;break;}if(route.status===410)return false;if(route.status===200)break;if(!route.targetPath)return false;target=route.targetPath;}
 const occurrence=/^\/event\/[^/]+\/20[0-9]{2}-[0-9]{2}-[0-9]{2}\/$/u.test(path);
 if(occurrence&&content.routes.some(route=>route.path===path&&route.status===301))return false;
 const ownedEvent=content.events.find(event=>event.path===path);if(occurrence&&ownedEvent&&ownedEvent.calendarVisible===false&&((ownedEvent.calendarRevision?.sequence??0)>1||!content.sourceContentAdoptedByPath?.[path]))return false;
 const original=content.sourceContentByPath?.[path]?.find(page=>page.path===path),page=content.pages.find(page=>page.path===path),owner=page??ownedEvent,blocks=page?.blocks??ownedEvent?.modules,block=blocks?.find(block=>block.kind==='source-content'&&'cmsInstanceId'in block&&block.cmsInstanceId==='original-content');
 if(content.sourceContentAdoptedByPath?.[path]&&owner&&(!block||block.kind!=='source-content'||original&&sha256(stableJson(block.nodes))!==sha256(stableJson(simplifySourceNodes(original.content)))))return false;
 return true;
}
export function maintainedIndexableCalendar(path:string,context:FrontendRenderContext):boolean{
 const seo=context.siteContent?.sourceSeoByPath?.[path];
 return ['/events/list/','/events/month/','/events/today/'].includes(path)&&Boolean(seo&&!seo.noindex&&context.siteContent?.events.length)&&calendarEditorAllowsProjection(path,context);
}

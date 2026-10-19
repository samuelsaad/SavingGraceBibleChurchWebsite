/** Retained empty WordPress discussion feeds follow their event's publication boundary. */
import type{SourcePublicPage}from'./source-public-model';
import type{FrontendRenderContext}from'../frontend/routes';
import{maintainedCalendarView}from'./calendar-subscriptions';
export function createSourceDiscussionFeedGuard(pages:readonly SourcePublicPage[],context:FrontendRenderContext){
 const parents=new Map(pages.filter(page=>page.kind==='asset'&&!page.issues.length&&page.asset?.contentType==='application/rss+xml'&&/^\/event\/[^/]+\/20[0-9]{2}-[0-9]{2}-[0-9]{2}\/feed\/$/u.test(page.path)).map(page=>[page.path,page.path.slice(0,-5)]));
 return(request:Request):Response|null=>{
  const url=new URL(request.url),parent=parents.get(url.pathname);if(!parent)return null;
  const content=context.siteContent;if(!content)return null;
  let target=parent;const seen=new Set<string>();let owner:string|undefined;
  for(;;){if(seen.has(target))throw Error('source_discussion_parent_redirect_loop');seen.add(target);const route=content.routes.find(row=>row.path===target);if(!route)break;
   if(owner&&route.entityId!==owner)throw Error('source_discussion_parent_identity_changed');owner=route.entityId;
   if(route.status===410)return gone();if(route.status!==301)break;if(!route.targetPath)throw Error('source_discussion_parent_redirect_missing');target=route.targetPath;
  }
  if(content.cancelledCalendarEvents?.some(event=>event.path===target&&event.calendarRevision?.cancelled))return gone();
  const projected=maintainedCalendarView(new Request('https://www.savinggrace.org.au'+target),context);
  return projected?.status===410?gone():null;
 };
}
function gone(){return new Response(null,{status:410,headers:{'X-Robots-Tag':'noindex','Cache-Control':'no-store'}});}

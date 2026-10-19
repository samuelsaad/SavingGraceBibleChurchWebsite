/** Exact visible historical Event facts, never recurrence extrapolation or invented UIDs. */
import type {FrontendRenderContext} from '../frontend/routes';
import type {ChurchEvent} from '../frontend/content/events';
import {html,type Html} from '../frontend/html';
import {formatLongDate,formatTimeRange} from '../frontend/content/events';
import {resolveHref} from '../frontend/content/markup';
import {calendarEditorAllowsProjection} from './calendar-presentation';
export interface SourceCalendarHistoryRow{eventId:string;path:string;date:string;start:string;title:string;description:readonly string[];location:string;body:Html;}
export function sourceCalendarHistory(context:FrontendRenderContext,events:readonly ChurchEvent[],today:string):SourceCalendarHistoryRow[]{
 const output=new Map<string,SourceCalendarHistoryRow>();
 for(const pages of Object.values(context.siteContent?.sourceContentByPath??{}))for(const page of pages){
  const fact=page.structuredData?.primary,match=/^(\/event\/[^/]+\/)(20[0-9]{2}-[0-9]{2}-[0-9]{2})\/$/u.exec(page.path);
  if(page.kind!=='event'||page.issues.length||!page.sourceId||!match||fact?.type!=='Event'||fact.path!==page.path||fact.startDate.slice(0,10)!==match[2]||!fact.endDate||fact.endDate.slice(0,10)!==match[2])continue;
  const owners=events.filter(event=>event.calendarVisible!==false&&!event.calendarRevision?.cancelled&&(event.path===match[1]||event.legacyPaths.includes(match[1]!)));
  if(owners.length!==1)continue;
  // A published source occurrence may acquire a new address/title/date. Keep
  // that exact CMS identity; an unrelated replacement is not historical evidence.
  const resolved=resolveHref(page.path,context),route=context.siteContent?.routes.find(route=>route.path===page.path),destination=context.siteContent?.routes.find(route=>route.path===resolved);
  if(route?.status===410||route?.status===301&&(!destination||destination.status!==200||destination.entityId!==route.entityId))continue;
  const details=context.siteContent?.events.filter(event=>event.path===resolved&&event.sourceIds.includes(page.sourceId!))??[];
  if(details.length>1)throw Error('source_calendar_history_detail_conflict');
  const detail=details[0];if(detail&&(detail.calendarRevision?.cancelled||detail.schedule.kind!=='single'))continue;
  if(!detail&&!calendarEditorAllowsProjection(page.path,context))continue;
  const date=detail?.schedule.kind==='single'?detail.schedule.date:match[2]!,start=detail?.start??fact.startDate.slice(11,16),end=detail?.end??fact.endDate.slice(11,16),title=detail?.title??page.heading,description=detail?.description??(fact.description?[fact.description]:[]),path=resolved;
  const originalLocation=[fact.location?.name,...Object.values(fact.location?.address??{})].filter(Boolean).join(', '),venue=detail&&context.siteContent?.venues[detail.venue],currentLocation=venue?[venue.name,venue.address,venue.locality].filter(Boolean).join(', '):originalLocation,venueWords=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/\b(?:australia|victoria|vic)\b/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim(),location=venueWords(originalLocation)===venueWords(currentLocation)?originalLocation:currentLocation;
  if(date>=today||end<start)continue;
  const body=html`<li class="event"><div class="event__body"><time datetime="${date}T${start}">${formatLongDate(date)}, ${formatTimeRange(start,end)}</time><h2 class="event__title"><a href="${resolveHref(path,context)}">${title}</a></h2>${location?html`<p>${location}</p>`:null}${description.map(text=>html`<p>${text}</p>`)}</div></li>`;
  const row={eventId:owners[0]!.id,path,date,start,title,description,location,body},previous=output.get(path);
  if(previous&&(previous.date!==date||previous.start!==start||previous.title!==title))throw Error('source_calendar_history_identity_conflict');
  output.set(path,row);
 }
 return [...output.values()];
}

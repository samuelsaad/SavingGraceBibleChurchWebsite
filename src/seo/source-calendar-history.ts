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
  if(page.kind!=='event'||page.issues.length||!page.sourceId||!match||fact?.type!=='Event'||fact.path!==page.path||fact.startDate.slice(0,10)!==match[2]||match[2]!>=today||!fact.endDate||fact.endDate.slice(0,10)!==match[2]||!calendarEditorAllowsProjection(page.path,context))continue;
  const owners=events.filter(event=>event.calendarVisible!==false&&!event.calendarRevision?.cancelled&&(event.path===match[1]||event.legacyPaths.includes(match[1]!)));
  if(owners.length!==1)continue;
  const date=match[2]!,start=fact.startDate.slice(11,16),end=fact.endDate.slice(11,16),title=page.heading,description=fact.description?[fact.description]:[],location=[fact.location?.name,...Object.values(fact.location?.address??{})].filter(Boolean).join(', '),path=page.path;
  if(end<start)continue;
  const body=html`<li class="event"><div class="event__body"><time datetime="${fact.startDate}">${formatLongDate(date)}, ${formatTimeRange(start,end)}</time><h2 class="event__title"><a href="${resolveHref(path,context)}">${title}</a></h2>${location?html`<p>${location}</p>`:null}${description.map(text=>html`<p>${text}</p>`)}</div></li>`;
  const row={eventId:owners[0]!.id,path,date,start,title,description,location,body},previous=output.get(path);
  if(previous&&(previous.date!==date||previous.start!==start||previous.title!==title))throw Error('source_calendar_history_identity_conflict');
  output.set(path,row);
 }
 return [...output.values()];
}

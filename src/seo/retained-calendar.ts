/** Historical occurrence facts come from verified retained iCalendar bytes only. */
import type {LegacyCalendarOccurrence} from './legacy-calendar-identities';
import type {FrontendRenderContext} from '../frontend/routes';
import {html,type Html} from '../frontend/html';
import {pageShell} from '../frontend/shell';
import {frontendResponse} from '../server/http/frontend-response';
import {formatLongDate,formatTimeRange,melbourneToday,monthAbbreviation,dayOfMonth} from '../frontend/content/events';
export interface RetainedCalendarFact {record:LegacyCalendarOccurrence;title:string;date:string;start:string;end:string;location:string;description:string[];}
const unescape=(value:string)=>value.replace(/\\([nN,;\\])/gu,(_,char:string)=>char==='n'||char==='N'?'\n':char);
export function retainedCalendarFact(record:LegacyCalendarOccurrence):RetainedCalendarFact|null{
 const get=(name:string)=>{const values=record.lines.filter(line=>line.startsWith(name+':')||line.startsWith(name+';'));return values.length===1?values[0]!.slice(values[0]!.indexOf(':')+1):undefined;};
 const time=(name:string)=>{const line=record.lines.find(line=>line.startsWith(name+':')||line.startsWith(name+';')),value=get(name);if(!line||!value||!/^\d{8}T\d{6}$/u.test(value)||line.includes('TZID=')&&!line.startsWith(name+';TZID=Australia/Melbourne:'))return null;const date=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8),clock=value.slice(9,11)+':'+value.slice(11,13);if(!Number.isFinite(Date.parse(date+'T'+clock+':00Z'))||new Date(date+'T'+clock+':00Z').toISOString().slice(0,16)!==date+'T'+clock)return null;return{date,clock};};
 const title=get('SUMMARY'),start=time('DTSTART'),end=time('DTEND');if(!title||!start||!end||start.date!==record.date||end.date!==start.date||end.clock<start.clock)return null;
 return{record,title:unescape(title),date:start.date,start:start.clock,end:end.clock,location:unescape(get('LOCATION')??''),description:unescape(get('DESCRIPTION')??'').split(/\n\s*\n/u).filter(Boolean)};
}
export function retainedCalendarRow(fact:RetainedCalendarFact):Html{return html`<li class="event"><span class="event__date"><span class="event__month">${monthAbbreviation(fact.date)}</span><span class="event__day">${dayOfMonth(fact.date)}</span></span><div class="event__body"><time datetime="${fact.date}T${fact.start}">${formatLongDate(fact.date)}, ${formatTimeRange(fact.start,fact.end)}</time><h2 class="event__title"><a href="${new URL(fact.record.url).pathname}">${fact.title}</a></h2>${fact.location?html`<p>${fact.location}</p>`:null}${fact.description.map(text=>html`<p>${text}</p>`)}</div></li>`;}
/** Only an exact captured UID/date/URL can supply an otherwise missing old page. */
export function retainedCalendarOccurrence(request:Request,context:FrontendRenderContext):Response|null{
 const url=new URL(request.url);if(url.search||!/^\/event\/[^/]+\/20\d{2}-\d{2}-\d{2}\/$/u.test(url.pathname))return null;
 const records=context.siteContent?.legacyCalendarOccurrences?.filter(record=>new URL(record.url).pathname===url.pathname&&record.date<melbourneToday());if(records?.length!==1)return null;
 const record=records[0]!,event=context.siteContent!.events.find(item=>item.id===record.eventId);if(!event||event.calendarRevision?.cancelled||context.siteContent!.routes.some(route=>route.path===url.pathname&&route.status!==200))return null;
 const fact=retainedCalendarFact(record);if(!fact)return null;
 const known=context.siteContent?.sourceSeoByPath?.[url.pathname];return frontendResponse(pageShell({sourceContentRendered:true,title:fact.title,...(known?{seo:known}:{}),canonicalPath:url.pathname,robots:known&&!known.noindex?'index, follow':'noindex, follow',styles:['church'],body:html`<article class="section"><h1>${fact.title}</h1><p><time datetime="${fact.date}T${fact.start}">${formatLongDate(fact.date)}, ${formatTimeRange(fact.start,fact.end)}</time></p>${fact.location?html`<address>${fact.location}</address>`:null}${fact.description.map(text=>html`<p>${text}</p>`)}<p><a href="${event.path}">This gathering</a> · <a href="/events/">All gatherings</a></p></article>`},context));
}

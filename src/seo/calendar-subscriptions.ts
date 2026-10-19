import {originalCalendarGroups} from '../frontend/content/calendar-groups';
/** Known calendar scopes stay live without creating an arbitrary crawl space. */
import {occurrencesBetween,melbourneToday,venues,type ChurchEvent} from '../frontend/content/events';
import {renderCalendarFeed,occurrenceRow} from '../frontend/pages/church';
import {pageShell} from '../frontend/shell';
import {html} from '../frontend/html';
import {frontendResponse} from '../server/http/frontend-response';
import type {FrontendRenderContext} from '../frontend/routes';
function selectedScope(path:string,context:FrontendRenderContext):ChurchEvent[]|null{
 const literal=/(?:^|\/)(20\d{2}-\d{2}(?:-\d{2})?)(?:\/|$)/u.exec(path)?.[1];
 if(literal){const value=literal.length===7?literal+'-01':literal;const time=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)return null;}
 const all=[...(context.siteContent?.events??[]),...(context.siteContent?.cancelledCalendarEvents??[])];
 if(path==='/events/calendar.ics'||path==='/events/'||/^\/events\/(?:\d{4}-\d{2}(?:-\d{2})?|(?:day|list|month|week|today)(?:\/(?:\d{4}-\d{2}(?:-\d{2})?|page\/[1-9]\d{0,2}))?)\/$/u.test(path))return all;
 const venue=Object.values(context.siteContent?.venues??{}).find(v=>v.legacyPath===path);if(venue)return all.filter(e=>e.venue===venue.id);
 const organizer=context.siteContent?.eventScopeIds?.[path];if(path.startsWith('/organiser/')&&organizer)return all.filter(e=>organizer.includes(e.id));
 const facetMatch=/^(\/events\/(?:category|tag)\/[^/]+\/)(.*)$/u.exec(path);const facet=facetMatch?.[1];if(facetMatch&&!/^(?:(?:(?:list|month|week|day|today)(?:\/(?:20\d{2}-\d{2}(?:-\d{2})?|page\/[1-9]\d{0,2}))?|20\d{2}-\d{2}(?:-\d{2})?|page\/[1-9]\d{0,2})\/)?$/u.test(facetMatch[2]!))return null;
 if(facet){const ids=context.siteContent?.eventScopeIds?.[facet];return ids?all.filter(e=>ids.includes(e.id)):null;}
 const event=all.find(e=>e.path===path||e.legacyPaths.includes(path));return event?[event]:null;
}
function calendarWindow(url:URL,defaultList=false):{from:string;until:string}|null{
 const literal=/(20\d{2}-\d{2}(?:-\d{2})?)/u.exec(url.pathname)?.[1],requested=literal??url.searchParams.get('tribe-bar-date');
 const view=url.searchParams.get('eventDisplay'),month=literal?.length===7||/\/month\//u.test(url.pathname)||view==='month';
 const day=literal?.length===10&&!/\/(?:list|week)\//u.test(url.pathname)||/\/(?:day|today)\//u.test(url.pathname)||view==='day';
 const week=/\/week\//u.test(url.pathname)||view==='week';
 if(!requested&&!month&&!day&&!week&&!defaultList)return null;
 let from=requested?.length===7?requested+'-01':requested??melbourneToday();
 if(!/^20\d{2}-\d{2}-\d{2}$/u.test(from)||!Number.isFinite(Date.parse(from+'T00:00:00Z'))||new Date(from).toISOString().slice(0,10)!==from)throw Error('calendar_invalid_date');
 if(month)from=from.slice(0,7)+'-01';
 const until=month?new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),0)).toISOString().slice(0,10):new Date(Date.parse(from+'T00:00:00Z')+(day?0:week?6:365)*86400000).toISOString().slice(0,10);
 return {from,until};
}
function filteredEvents(url:URL,context:FrontendRenderContext,initial:ChurchEvent[]):ChurchEvent[]|null{
 let events=initial;const related=url.searchParams.get('related_series');
 if(related){if(!/^[1-9][0-9]*$/u.test(related))return null;events=events.filter(e=>e.sourceIds.includes(Number(related)));if(!events.length)return null;}
 for(const key of ['tribe_events_cat','tag','tribe_venue','tribe_organizer']){
  const value=url.searchParams.get(key);if(!value)continue;let path:string|undefined;
  if(key==='tribe_events_cat'||key==='tag'){const group=originalCalendarGroups.find(g=>key==='tag'?g.tagSlug===value||String(g.tagId)===value:g.categorySlug===value||String(g.categoryId)===value);if(group)path=key==='tag'?'/events/tag/'+group.tagSlug+'/':'/events/category/'+group.categorySlug+'/';}
  else path=context.siteContent?.sourceCalendarIdentityPaths?.[value];
  const matches=path?selectedScope(path,context):null;if(!matches)return null;const ids=new Set(matches.map(e=>e.id));events=events.filter(e=>ids.has(e.id));
 }return events;
}
/** Explicit past/upcoming exports retain the requested temporal membership. */
function displayedEvents(events:ChurchEvent[],url:URL):ChurchEvent[]{
 const display=url.searchParams.get('eventDisplay');if(display!=='past'&&display!=='upcoming')return events;
 const now=new Date(),today=melbourneToday(now),clock=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 const shift=(days:number)=>new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
 return events.flatMap(event=>{
  const boundary=display==='past'?(event.end<=clock?today:shift(-1)):(event.end>clock?today:shift(1)),schedule=event.schedule;
  if(schedule.kind==='single')return (display==='past'?schedule.date<=boundary:schedule.date>=boundary)?[event]:[];
  const from=display==='upcoming'&&schedule.from<boundary?boundary:schedule.from,until=display==='past'&&(!schedule.until||schedule.until>boundary)?boundary:schedule.until;
  return until&&from>until?[]:[{...event,schedule:{...schedule,from,...(until?{until}:{})}}];
 });
}
export function calendarSubscription(request:Request,context:FrontendRenderContext):Response|null{
 if(!context.siteContent)return null;
 const url=new URL(request.url),flags=['ical','outlook-ical'].filter(k=>url.searchParams.has(k));
 if(url.pathname!=='/events/calendar.ics'&&(flags.length!==1||url.searchParams.get(flags[0]!)!=='1'))return null;
 let events=selectedScope(url.pathname==='/'&&url.searchParams.get('post_type')==='tribe_events'?'/events/':url.pathname,context);if(!events)return null;
 events=filteredEvents(url,context,events);if(!events)return null;
 events=displayedEvents(events,url);
 let window;try{window=calendarWindow(url);}catch{return null;}
 if(window){const selected=window;events=events.flatMap(event=>occurrencesBetween(event,selected.from,selected.until,100).map(o=>({...event,id:event.id+'-'+o.date,schedule:{kind:'single' as const,date:o.date}})));}
 const feed=renderCalendarFeed({...context,siteContent:{...context.siteContent,events:events.filter(e=>!e.calendarRevision?.cancelled),cancelledCalendarEvents:events.filter(e=>e.calendarRevision?.cancelled)}});
 return new Response(request.method==='HEAD'?null:feed,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="saving-grace-bible-church-events.ics"','Cache-Control':'no-cache, max-age=0, must-revalidate','X-Robots-Tag':'noindex, follow','X-Content-Type-Options':'nosniff'}});
}
/** Called only after an exact retained source page is unavailable. */
export function futureCalendarPage(request:Request,context:FrontendRenderContext):Response|null{
 if(!context.siteContent)return null;const url=new URL(request.url),selected=selectedScope(url.pathname,context);if(!selected||!url.pathname.startsWith('/events/'))return null;
 if(url.pathname==='/events/'&&!url.search||/^\/events\/[^/]+\/$/u.test(url.pathname)&&!/^\/events\/(?:20\d{2}-\d{2}(?:-\d{2})?|list|month|week|day|today)\/$/u.test(url.pathname))return null;
 if(url.searchParams.get('eventDisplay')==='past')return null;
 const filtered=filteredEvents(url,context,selected);if(!filtered)return null;
 let window;try{window=calendarWindow(url,true);}catch{return null;}if(!window)return null;const {from,until}=window;
 const rawPage=/\/page\/([1-9][0-9]{0,2})\/$/u.exec(url.pathname)?.[1]??url.searchParams.get('paged')??url.searchParams.get('page')??'1';
 if(!/^[1-9][0-9]{0,2}$/u.test(rawPage))return null;const page=Number(rawPage);
 const occurrences=filtered.filter(e=>e.calendarVisible!==false&&!e.calendarRevision?.cancelled).flatMap(e=>occurrencesBetween(e,from,until,100)).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
 if(page>Math.max(1,Math.ceil(occurrences.length/20)))return null;
 const current=occurrences.slice((page-1)*20,page*20),metadataPath=url.pathname+url.search;
 const original=context.siteContent.sourceContentByPath?.[metadataPath]?.find(p=>p.path===metadataPath),known=context.siteContent.sourceSeoByPath?.[metadataPath];
 const content={...context.siteContent,venues:{...venues,...context.siteContent.venues}},renderContext={...context,siteContent:content};
 return frontendResponse(pageShell({sourceContentRendered:true,sourcePath:metadataPath,title:original?.heading??'Church events',canonicalPath:known&&!known.noindex?metadataPath:url.pathname,robots:known&&!known.noindex?'index, follow':'noindex, follow',styles:['church'],body:html`<section class="section"><h1>${original?.heading??"Church events"}</h1><p>From ${from} to ${until}</p>${occurrences.length?html`<ol class="events">${current.map(o=>occurrenceRow(o,renderContext,true))}</ol>`:html`<p>No gathering is scheduled for these dates.</p>`}<nav aria-label="Calendar pages">${page>1?html`<a href="${(()=>{const next=new URL(url);if(/\/page\/[1-9]\d*\/$/u.test(next.pathname))next.pathname=next.pathname.replace(/\/page\/[1-9]\d*\/$/u,'/page/'+(page-1)+'/');else next.searchParams.set('paged',String(page-1));return next.pathname+next.search;})()}">Previous dates</a>`:null} ${page*20<occurrences.length?html`<a href="${(()=>{const next=new URL(url);if(/\/page\/[1-9]\d*\/$/u.test(next.pathname))next.pathname=next.pathname.replace(/\/page\/[1-9]\d*\/$/u,'/page/'+(page+1)+'/');else next.searchParams.set('paged',String(page+1));return next.pathname+next.search;})()}">More dates</a>`:null}</nav><p><a href="/events/">All gatherings</a> · <a href="${(()=>{const feed=new URL(url);feed.searchParams.delete("paged");feed.searchParams.delete("page");feed.searchParams.set("ical","1");return feed.pathname+feed.search;})()}">Subscribe to this calendar</a></p></section>`},renderContext));
}

/** Captured future date views must react to CMS edits instead of freezing a calendar. */
export function maintainedCalendarView(request:Request,context:FrontendRenderContext):Response|null{
 const url=new URL(request.url),literal=/(20\d{2}-\d{2}(?:-\d{2})?)/u.exec(url.pathname)?.[1]??url.searchParams.get('tribe-bar-date');
 if(!literal||literal<'2026-10'||!url.pathname.startsWith('/events/'))return null;
 return futureCalendarPage(request,context);
}

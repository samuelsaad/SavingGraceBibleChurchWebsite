import {retainedCalendarFact,retainedCalendarOccurrence,retainedCalendarRow} from './retained-calendar';
import {simplifySourceNodes} from './source-cms-adoption';
import {sha256,stableJson} from './source-public-model';
import {renderBlocks} from '../frontend/components/blocks';
import {emptyFilterOptions} from '../frontend/pages/sermons-v1';
import {calendarOccurrenceEvents} from './legacy-calendar-identities';
import {originalCalendarGroups} from '../frontend/content/calendar-groups';
/** Known calendar scopes stay live without creating an arbitrary crawl space. */
import {occurrencesBetween,melbourneToday,venues,type ChurchEvent} from '../frontend/content/events';
import {renderCalendarFeed,renderEventPage,occurrenceRow} from '../frontend/pages/church';
import {pageShell} from '../frontend/shell';
import {html} from '../frontend/html';
import {frontendResponse} from '../server/http/frontend-response';
import type {FrontendRenderContext} from '../frontend/routes';
function selectedScope(path:string,context:FrontendRenderContext):ChurchEvent[]|null{
 const literal=/(?:^|\/)(20\d{2}-\d{2}(?:-\d{2})?)(?:\/|$)/u.exec(path)?.[1];
 if(literal){const value=literal.length===7?literal+'-01':literal;const time=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)return null;}
 const all=[...(context.siteContent?.events??[]),...(context.siteContent?.cancelledCalendarEvents??[])];
 if(path==='/events/calendar.ics'||path==='/events/'||/^\/events\/(?:\d{4}-\d{2}(?:-\d{2})?|(?:day|list|month|week|today|summary)(?:\/(?:\d{4}-\d{2}(?:-\d{2})?|page\/[1-9]\d{0,2}))?)\/$/u.test(path))return all;
 const scopePath=path.replace(/(?:page\/[1-9]\d{0,2}\/)$/u,'');
 const venue=Object.values(context.siteContent?.venues??{}).find(v=>v.legacyPath===scopePath);if(venue)return all.filter(e=>e.venue===venue.id);
 const organizer=context.siteContent?.eventScopeIds?.[scopePath];if(path.startsWith('/organiser/')&&organizer)return all.filter(e=>organizer.includes(e.id));
 const facetMatch=/^(\/events\/(?:category|tag)\/[^/]+\/)(.*)$/u.exec(path);const facet=facetMatch?.[1];if(facetMatch&&!/^(?:(?:(?:list|month|week|day|today)(?:\/(?:20\d{2}-\d{2}(?:-\d{2})?|page\/[1-9]\d{0,2}))?|20\d{2}-\d{2}(?:-\d{2})?|page\/[1-9]\d{0,2})\/)?$/u.test(facetMatch[2]!))return null;
 if(facet){const ids=context.siteContent?.eventScopeIds?.[facet];return ids?all.filter(e=>ids.includes(e.id)):null;}
 const eventPath=path.startsWith('/event/')?path.replace(/(?:all|20\d{2}-\d{2}-\d{2})\/$/u,''):path;
 const event=all.find(e=>e.calendarVisible!==false&&(e.path===eventPath||e.legacyPaths.includes(eventPath)))??all.find(e=>e.calendarVisible!==false&&(e.path===path||e.legacyPaths.includes(path)));return event?[event]:null;
}
function calendarWindow(url:URL,defaultList=false):{from:string;until:string}|null{
 const literal=/(20\d{2}-\d{2}(?:-\d{2})?)/u.exec(url.pathname)?.[1],requested=literal??url.searchParams.get('tribe-bar-date')??url.searchParams.get('eventDate');
 for(const name of ['tribe-bar-date','eventDate']){const values=url.searchParams.getAll(name);if(values.length>1||values.some(value=>!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/u.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw Error('calendar_invalid_date');}
 if(url.searchParams.has('tribe-bar-date')&&url.searchParams.has('eventDate')&&url.searchParams.get('tribe-bar-date')!==url.searchParams.get('eventDate'))throw Error('calendar_invalid_date');
 const view=url.searchParams.get('eventDisplay'),month=literal?.length===7||/\/month\//u.test(url.pathname)||view==='month';
 const day=literal?.length===10&&!/\/(?:list|week)\//u.test(url.pathname)||/\/(?:day|today)\//u.test(url.pathname)||view==='day';
 const week=/\/week\//u.test(url.pathname)||view==='week';
 if(!requested&&!month&&!day&&!week&&!defaultList)return null;
 let from=requested?.length===7?requested+'-01':requested??melbourneToday();
 if(!/^20\d{2}-\d{2}-\d{2}$/u.test(from)||!Number.isFinite(Date.parse(from+'T00:00:00Z'))||new Date(from).toISOString().slice(0,10)!==from)throw Error('calendar_invalid_date');
 if(month)from=from.slice(0,7)+'-01';
 // The retained original October grid starts Monday (28 September).
 if(week){const weekday=new Date(from+'T00:00:00Z').getUTCDay();from=new Date(Date.parse(from+'T00:00:00Z')-((weekday+6)%7)*86400000).toISOString().slice(0,10);}
 const until=month?new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),0)).toISOString().slice(0,10):new Date(Date.parse(from+'T00:00:00Z')+(day?0:week?6:365)*86400000).toISOString().slice(0,10);
 return {from,until};
}
function filteredEvents(url:URL,context:FrontendRenderContext,initial:ChurchEvent[]):ChurchEvent[]|null{
 let events=initial;
 for(const field of ['search','location']){const values=['tribe-bar-'+field,'tribe-events-views[tribe-bar-'+field+']'].flatMap(key=>url.searchParams.getAll(key));if(values.length>1||values.some(value=>value.length>120||/[\x00-\x1f\x7f]/u.test(value)))return null;}
 const related=url.searchParams.get('related_series');
 if(related){if(!/^[1-9][0-9]*$/u.test(related))return null;events=events.filter(e=>e.sourceIds.includes(Number(related)));if(!events.length)return null;}
 for(const key of ['tribe_events_cat','tag','tribe_venue','tribe_organizer']){
  const value=url.searchParams.get(key);if(!value)continue;let path:string|undefined;
  if(key==='tribe_events_cat'||key==='tag'){const group=originalCalendarGroups.find(g=>key==='tag'?g.tagSlug===value||String(g.tagId)===value:g.categorySlug===value||String(g.categoryId)===value);if(group)path=key==='tag'?'/events/tag/'+group.tagSlug+'/':'/events/category/'+group.categorySlug+'/';}
  else path=context.siteContent?.sourceCalendarIdentityPaths?.[value];
  const matches=path?selectedScope(path,context):null;if(!matches)return null;const ids=new Set(matches.map(e=>e.id));events=events.filter(e=>ids.has(e.id));
 }return events;
}
function matchesSearch(url:URL,title:string,description:readonly string[],location:string):boolean{
 return ['search','location'].every(field=>{const value=url.searchParams.get('tribe-bar-'+field)??url.searchParams.get('tribe-events-views[tribe-bar-'+field+']')??'',terms=value.normalize('NFKC').toLocaleLowerCase('en-AU').trim().split(/\s+/u).filter(Boolean),text=(field==='search'?[title,...description].join(' '):location).normalize('NFKC').toLocaleLowerCase('en-AU');return terms.every(term=>text.includes(term));});
}
function matchesEventSearch(url:URL,event:ChurchEvent,context:FrontendRenderContext):boolean{
 const original=event.calendarIdentity?.originalLines,record=original&&event.schedule.kind==='single'?{eventId:event.id,uid:event.calendarIdentity!.uid,url:event.calendarIdentity!.url,date:event.schedule.date,sequence:event.calendarIdentity!.sequence,lines:original}:null,fact=record?retainedCalendarFact(record):null,venue=context.siteContent?.venues[event.venue]??venues[event.venue];return matchesSearch(url,fact?.title??event.title,fact?.description??event.description,fact?.location??[venue?.name,venue?.address,venue?.locality].filter(Boolean).join(' '));
}
/** Explicit past/upcoming exports retain the requested temporal membership. */
function displayedEvents(events:ChurchEvent[],url:URL):ChurchEvent[]{
 const display=url.searchParams.get('eventDisplay');if(display!=='past'&&display!=='upcoming')return events;
 const now=new Date(),actualToday=melbourneToday(now),anchor=url.searchParams.get('tribe-bar-date')??url.searchParams.get('eventDate'),validAnchor=anchor&&/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/u.test(anchor)&&Number.isFinite(Date.parse(anchor+'T00:00:00Z'))&&new Date(anchor+'T00:00:00Z').toISOString().slice(0,10)===anchor?anchor:null,today=validAnchor??actualToday,clock=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 const shift=(days:number)=>new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
 return events.flatMap(event=>{
  const boundary=validAnchor?(display==='past'?shift(-1):today):display==='past'?(event.end<=clock?today:shift(-1)):(event.end>clock?today:shift(1)),schedule=event.schedule;
  if(schedule.kind==='single')return (display==='past'?schedule.date<=boundary:schedule.date>=boundary)?[event]:[];
  const from=display==='upcoming'&&schedule.from<boundary?boundary:schedule.from,until=display==='past'&&(!schedule.until||schedule.until>boundary)?boundary:schedule.until;
  return until&&from>until?[]:[{...event,schedule:{...schedule,from,...(until?{until}:{})}}];
 });
}
export function calendarSubscription(request:Request,context:FrontendRenderContext):Response|null{
 if(!context.siteContent)return null;
 const url=new URL(request.url),flags=['ical','outlook-ical'].filter(k=>url.searchParams.has(k));
 if(url.pathname!=='/events/calendar.ics'&&(flags.length!==1||url.searchParams.get(flags[0]!)!=='1'))return null;
 let events=selectedScope((url.pathname==='/'||/^\/page\/[1-9]\d{0,2}\/$/u.test(url.pathname))&&url.searchParams.get('post_type')==='tribe_events'?'/events/':url.pathname,context);if(!events)return null;
 events=filteredEvents(url,context,events);if(!events)return null;
 const scopedEvents=events,legacy=context.siteContent.legacyCalendarOccurrences;
 if(!legacy)events=displayedEvents(events,url);
 let window;try{window=calendarWindow(url);}catch{return null;}
 if(url.searchParams.get('eventDisplay')==='past'&&url.searchParams.has('tribe-bar-date')){const anchor=url.searchParams.get('tribe-bar-date')!,until=new Date(Date.parse(anchor+'T00:00:00Z')-86400000).toISOString().slice(0,10),dates=legacy?legacy.filter(r=>scopedEvents.some(e=>e.id===r.eventId)&&r.date<=until).map(r=>r.date):events.map(e=>e.schedule.kind==='single'?e.schedule.date:e.schedule.from);window={from:dates.sort()[0]??until,until};}
 if(legacy){const today=melbourneToday(),past=url.searchParams.get('eventDisplay')==='past',shift=(days:number)=>new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);const singles=events.every(e=>e.schedule.kind==='single'),dates=singles?events.map(e=>(e.schedule as {kind:'single';date:string}).date).sort():[];const range=window??{from:singles&&dates.length?dates[0]!:past?[...legacy.filter(r=>scopedEvents.some(e=>e.id===r.eventId)).map(r=>r.date),shift(-365)].sort()[0]!:today,until:singles&&dates.length?dates.at(-1)!:past?today:shift(365)};events=calendarOccurrenceEvents(events,legacy,range);events=displayedEvents(events,url);}
 else if(window){const selected=window;events=events.flatMap(event=>occurrencesBetween(event,selected.from,selected.until,100).map(o=>({...event,id:event.id+'-'+o.date,schedule:{kind:'single' as const,date:o.date}})));}
 events=events.filter(event=>matchesEventSearch(url,event,context));
 const feed=renderCalendarFeed({...context,siteContent:{...context.siteContent,events:events.filter(e=>!e.calendarRevision?.cancelled),cancelledCalendarEvents:events.filter(e=>e.calendarRevision?.cancelled)}});
 return new Response(request.method==='HEAD'?null:feed,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="saving-grace-bible-church-events.ics"','Cache-Control':'no-cache, max-age=0, must-revalidate','X-Robots-Tag':'noindex, follow','X-Content-Type-Options':'nosniff'}});
}
/** Only a real occurrence of one currently published schedule gets a new detail page. */
export function futureCalendarOccurrence(request:Request,context:FrontendRenderContext):Response|null{
 const url=new URL(request.url),match=/^(\/event\/[^/]+\/)(20\d{2}-\d{2}-\d{2})\/$/u.exec(url.pathname);if(!match||!context.siteContent)return null;
 const date=match[2]!,today=melbourneToday(),until=new Date(Date.parse(today+'T00:00:00Z')+366*86400000).toISOString().slice(0,10);if(date<today||date>until)return null;
 const all=[...context.siteContent.events,...(context.siteContent.cancelledCalendarEvents??[])],matching=all.filter(event=>event.calendarVisible!==false&&(event.path===match[1]||event.legacyPaths.includes(match[1]!)));if(matching.length!==1)return null;
 const event=matching[0]!;if(event.calendarRevision?.cancelled)return new Response('This gathering has been cancelled.',{status:410,headers:{'Content-Type':'text/plain; charset=utf-8','X-Robots-Tag':'noindex','Cache-Control':'no-store'}});
 if(!occurrencesBetween(event,date,date,1).length)return null;
 const source=context.siteContent.sourceSeoByPath?.[url.pathname],content={...event,path:url.pathname,schedule:{kind:'single' as const,date},seo:{...source,noindex:source?Boolean(source.noindex):true}};
 return frontendResponse(renderEventPage(content,{today,sermons:[],options:emptyFilterOptions},context));
}

const englishMonths='January|February|March|April|May|June|July|August|September|October|November|December';
function rollingCalendarText(value:string,from:string,until:string):string{
 const label=(iso:string,style:'us'|'au'|'month')=>{const date=new Date(iso+'T12:00:00Z'),month=new Intl.DateTimeFormat('en-AU',{month:'long',timeZone:'UTC'}).format(date),day=String(Number(iso.slice(8))),year=iso.slice(0,4);return style==='us'?month+' '+day+', '+year:style==='au'?day+' '+month+' '+year:month+' '+year;};
 for(const [pattern,style]of [[new RegExp('\\b(?:'+englishMonths+') [0-9]{1,2}, [0-9]{4}\\b','gu'),'us'],[new RegExp('\\b[0-9]{1,2} (?:'+englishMonths+') [0-9]{4}\\b','gu'),'au'],[new RegExp('\\b(?:'+englishMonths+') [0-9]{4}\\b','gu'),'month']]as const){
  const found=[...value.matchAll(pattern)];if(found.length===1)return value.slice(0,found[0]!.index)+label(from,style)+value.slice(found[0]!.index!+found[0]![0].length);
  if(found.length===2&&/^\s*(?:[-–—]|to|through)\s*$/u.test(value.slice(found[0]!.index!+found[0]![0].length,found[1]!.index))){const last=found[1]!,first=found[0]!;return value.slice(0,first.index)+label(from,style)+value.slice(first.index!+first[0].length,last.index)+label(until,style)+value.slice(last.index!+last[0].length);}
  if(found.length)return value;
 }return value;
}

/** Maintained calendar projection; explicit editor replacements retain precedence. */
export function futureCalendarPage(request:Request,context:FrontendRenderContext):Response|null{
 const occurrence=futureCalendarOccurrence(request,context)??retainedCalendarOccurrence(request,context);if(occurrence)return occurrence;
 if(!context.siteContent)return null;const url=new URL(request.url),root=(url.pathname==='/'||/^\/page\/[1-9][0-9]{0,2}\/$/u.test(url.pathname))&&url.searchParams.get('post_type')==='tribe_events',selected=selectedScope(root?'/events/':url.pathname,context);if(!selected||!root&&!/^\/(?:events|venue|organiser)\//u.test(url.pathname))return null;
 if(url.pathname==='/events/'&&!url.search||/^\/events\/[^/]+\/$/u.test(url.pathname)&&!/^\/events\/(?:20\d{2}-\d{2}(?:-\d{2})?|list|month|week|day|today|summary)\/$/u.test(url.pathname))return null;
 const accepted=new Set(['post_type','eventDisplay','paged','page','related_series','tribe_events_cat','tag','tribe_venue','tribe_organizer','tribe-bar-date','eventDate','tribe-bar-search','tribe-bar-location','tribe-events-views[tribe-bar-search]','tribe-events-views[tribe-bar-location]']);
 if([...url.searchParams.keys()].some(key=>!accepted.has(key)&&!/^utm_[a-z_]+$|^(?:gclid|wbraid|gbraid)$/u.test(key))||[...accepted].some(key=>url.searchParams.getAll(key).length>1)||url.searchParams.has('post_type')&&url.searchParams.get('post_type')!=='tribe_events')return null;
 if(url.searchParams.has('eventDisplay')&&!['list','month','week','day','today','upcoming','past','summary'].includes(url.searchParams.get('eventDisplay')!))return null;
 if(url.searchParams.has('eventDate')&&url.searchParams.has('tribe-bar-date')&&url.searchParams.get('eventDate')!==url.searchParams.get('tribe-bar-date'))return null;
 const past=url.searchParams.get('eventDisplay')==='past';
 const filtered=filteredEvents(url,context,selected);if(!filtered)return null;
 let window;try{window=calendarWindow(url,true);}catch{return null;}if(!window)return null;let {from,until}=window;const today=melbourneToday(),legacy=context.siteContent.legacyCalendarOccurrences??[];
 if(past){const dates=legacy.filter(row=>filtered.some(event=>event.id===row.eventId)&&row.date<=(url.searchParams.get('tribe-bar-date')??today)).map(row=>row.date).sort();if(!dates.length)return null;from=dates[0]!;until=url.searchParams.has('tribe-bar-date')?new Date(Date.parse(url.searchParams.get('tribe-bar-date')!+'T00:00:00Z')-86400000).toISOString().slice(0,10):today;}
 const rawPage=/\/page\/([1-9][0-9]{0,2})\/$/u.exec(url.pathname)?.[1]??url.searchParams.get('paged')??url.searchParams.get('page')??'1';
 if(!/^[1-9][0-9]{0,2}$/u.test(rawPage))return null;const page=Number(rawPage);
 const visible=displayedEvents(filtered,url).filter(e=>e.calendarVisible!==false&&!e.calendarRevision?.cancelled),ids=new Set(visible.map(event=>event.id));
 const retained=legacy.filter(record=>ids.has(record.eventId)&&record.date>=from&&record.date<=until&&record.date<today).flatMap(record=>{const fact=retainedCalendarFact(record);return fact&&matchesSearch(url,fact.title,fact.description,fact.location)?[{date:fact.date,start:fact.start,body:retainedCalendarRow(fact)}]:[];});
 const upcoming=visible.flatMap(e=>occurrencesBetween(e,from,until,100)).filter(o=>(o.date>=today||!legacy.some(record=>record.eventId===o.event.id))&&matchesEventSearch(url,o.event,context)).map(o=>({date:o.date,start:o.start,occurrence:o}));
 if(until<today&&legacy.length&&!legacy.some(record=>ids.has(record.eventId)&&record.date>=from&&record.date<=until))return null;
 const occurrences=[...retained,...upcoming].sort((a,b)=>(past?-1:1)*(a.date.localeCompare(b.date)||a.start.localeCompare(b.start)));
 if(page>Math.max(1,Math.ceil(occurrences.length/20)))return null;
 const current=occurrences.slice((page-1)*20,page*20),metadataPath=url.pathname+url.search;
 const scopePath=root?'/events/':url.pathname.replace(/(?:\/(?:list|month|week|day|today|summary)(?:\/(?:20[0-9]{2}-[0-9]{2}(?:-[0-9]{2})?|page\/[1-9][0-9]*))?|\/20[0-9]{2}-[0-9]{2}(?:-[0-9]{2})?|\/page\/[1-9][0-9]*)\/$/u,'/');
 const viewLink=(view:string)=>{const target=new URL(url);target.pathname=scopePath;for(const key of ['paged','page','eventDate'])target.searchParams.delete(key);target.searchParams.set('eventDisplay',view);target.searchParams.set('tribe-bar-date',from);return target.pathname+target.search;};
 const selectedView=url.searchParams.get('eventDisplay')??/\/(month|week|day|today|list|summary)(?:\/|$)/u.exec(url.pathname)?.[1]??'list';
 const calendarControls=html`<nav aria-label="Calendar views"><a href="${viewLink('list')}">List</a> · <a href="${viewLink('month')}">Month</a> · <a href="${viewLink('day')}">Day</a></nav><form method="get" action="${scopePath}" aria-label="Search church events">${url.searchParams.has('eventDisplay')?null:html`<input type="hidden" name="eventDisplay" value="${selectedView}" />`}${[...url.searchParams].filter(([key])=>!['paged','page','eventDate','tribe-bar-date','tribe-bar-search','tribe-bar-location','tribe-events-views[tribe-bar-search]','tribe-events-views[tribe-bar-location]'].includes(key)).map(([key,value])=>html`<input type="hidden" name="${key}" value="${value}" />`)}<label>Search events <input type="search" name="tribe-bar-search" maxlength="120" value="${url.searchParams.get('tribe-bar-search')??url.searchParams.get('tribe-events-views[tribe-bar-search]')??''}" /></label> <label>Location <input type="text" name="tribe-bar-location" maxlength="120" value="${url.searchParams.get('tribe-bar-location')??url.searchParams.get('tribe-events-views[tribe-bar-location]')??''}" /></label> <label>Date <input type="date" name="tribe-bar-date" value="${from}" required /></label> <button type="submit">View dates</button></form>`;
 const original=context.siteContent.sourceContentByPath?.[metadataPath]?.find(p=>p.path===metadataPath),known=context.siteContent.sourceSeoByPath?.[metadataPath],pageContent=context.siteContent.pages.find(p=>p.path===url.pathname),originalBlock=pageContent?.blocks.find(block=>block.kind==='source-content'&&'cmsInstanceId'in block&&block.cmsInstanceId==='original-content');
 const explicit=context.siteContent.cmsExplicitSeoByPath?.[metadataPath];if(explicit?.replaceSourceContent)return null;
 if(context.siteContent.sourceContentAdoptedByPath?.[metadataPath]&&pageContent){
  // An explicitly hidden or manually replaced calendar remains the editor's content.
  if(!originalBlock||originalBlock.kind!=='source-content'||original&&sha256(stableJson(originalBlock.nodes))!==sha256(stableJson(simplifySourceNodes(original.content))))return null;
 }
 const rolling=!/(20\d{2}-\d{2}(?:-\d{2})?)/u.test(url.pathname)&&!(url.searchParams.has('tribe-bar-date')||url.searchParams.has('eventDate')),initial=context.siteContent.initialMetadataByPath?.[metadataPath],titleEdited=Boolean(pageContent&&initial&&pageContent.title!==initial.heading);
 const heading=titleEdited?pageContent!.title:rolling?rollingCalendarText(original?.heading??'Church events',from,until):original?.heading??'Church events';
 const seo=known?{...known,...Object.fromEntries(['title','socialTitle'].flatMap(key=>{const value=known[key as keyof typeof known];return rolling&&typeof value==='string'?[[key,rollingCalendarText(value,from,until)]]:[];}))}:undefined;
 const sourceContentByPath={...context.siteContent.sourceContentByPath},initialMetadataByPath={...context.siteContent.initialMetadataByPath},sourceSeoByPath={...context.siteContent.sourceSeoByPath};
 // This response represents a computed calendar, not a frozen source article.
 delete sourceContentByPath[metadataPath];if(!titleEdited)delete initialMetadataByPath[metadataPath];if(seo)sourceSeoByPath[metadataPath]=seo;
 const content={...context.siteContent,sourceContentByPath,initialMetadataByPath,sourceSeoByPath,venues:{...venues,...context.siteContent.venues}},renderContext={...context,siteContent:content};
 const blockIndex=originalBlock&&pageContent?pageContent.blocks.indexOf(originalBlock):-1,blockContext={context:renderContext,today:melbourneToday(),sermons:[]};
 const beforeContent=renderBlocks(blockIndex>=0?pageContent!.blocks.slice(0,blockIndex):[],blockContext),afterContent=renderBlocks(blockIndex>=0?pageContent!.blocks.slice(blockIndex+1):[],blockContext);
 return frontendResponse(pageShell({sourceContentRendered:true,sourcePath:metadataPath,title:heading,...(seo?{seo}:{}),canonicalPath:known&&!known.noindex?metadataPath:url.pathname,robots:known&&!known.noindex?'index, follow':'noindex, follow',styles:['church'],body:html`<section class="section"><h1>${heading}</h1>${beforeContent}${calendarControls}<p>From ${from} to ${until}</p>${occurrences.length?html`<ol class="events">${current.map(o=>'body'in o?o.body:occurrenceRow(o.occurrence,renderContext,true))}</ol>`:html`<p>No gathering is scheduled for these dates.</p>`}<nav aria-label="Calendar pages">${page>1?html`<a href="${(()=>{const next=new URL(url);if(/\/page\/[1-9]\d*\/$/u.test(next.pathname))next.pathname=next.pathname.replace(/\/page\/[1-9]\d*\/$/u,'/page/'+(page-1)+'/');else next.searchParams.set('paged',String(page-1));return next.pathname+next.search;})()}">Previous dates</a>`:null} ${page*20<occurrences.length?html`<a href="${(()=>{const next=new URL(url);if(/\/page\/[1-9]\d*\/$/u.test(next.pathname))next.pathname=next.pathname.replace(/\/page\/[1-9]\d*\/$/u,'/page/'+(page+1)+'/');else next.searchParams.set('paged',String(page+1));return next.pathname+next.search;})()}">More dates</a>`:null}</nav><p><a href="/events/">All gatherings</a> · <a href="${(()=>{const feed=new URL(url);feed.searchParams.delete("paged");feed.searchParams.delete("page");feed.searchParams.set("ical","1");return feed.pathname+feed.search;})()}">Subscribe to this calendar</a></p>${afterContent}</section>`},renderContext));
}

/** Captured future date views must react to CMS edits instead of freezing a calendar. */
export function maintainedCalendarView(request:Request,context:FrontendRenderContext):Response|null{
 const url=new URL(request.url);if(url.pathname.startsWith('/event/')){const parent=url.pathname.replace(/20\d{2}-\d{2}-\d{2}\/$/u,'');const event=[...(context.siteContent?.events??[]),...(context.siteContent?.cancelledCalendarEvents??[])].find(e=>e.path===parent||e.legacyPaths.includes(parent));if(event&&(event.calendarRevision?.sequence??0)>1)return futureCalendarOccurrence(request,context);}
 const literal=/(20\d{2}-\d{2}(?:-\d{2})?)/u.exec(url.pathname)?.[1]??url.searchParams.get('tribe-bar-date');
 if(!url.pathname.startsWith('/events/'))return null;
 if(literal)return literal<'2026-10'?null:futureCalendarPage(request,context);
 if(url.searchParams.get('eventDisplay')==='past'||url.searchParams.has('post_type')&&url.searchParams.get('post_type')!=='tribe_events')return null;
 const rolling=/^\/events\/(?:(?:list|month|week|day|today|summary)(?:\/page\/[1-9]\d{0,2})?\/|(?:category|tag)\/[^/]+\/(?:.*)?$)/u.test(url.pathname)||url.pathname==='/events/'&&['eventDisplay','related_series','paged','page','tribe_events_cat','tag','tribe_venue','tribe_organizer','tribe-bar-search','tribe-bar-location','tribe-events-views[tribe-bar-search]','tribe-events-views[tribe-bar-location]'].some(key=>url.searchParams.has(key));
 return rolling?futureCalendarPage(request,context):null;
}

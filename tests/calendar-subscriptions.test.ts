import{sourcePublicSitemap}from'../src/seo/source-public-handler';
import {describe,it,expect,vi} from 'vitest';
import {renderCalendarFeed} from '../src/frontend/pages/church';
import {calendarSubscription,futureCalendarPage,futureCalendarOccurrence,maintainedCalendarView} from '../src/seo/calendar-subscriptions';
import {events,venues} from '../src/frontend/content/events';
import {defaultSiteSettings} from '../src/frontend/content/site-snapshot';
import type {FrontendRenderContext} from '../src/frontend/routes';
const event={...events[0],id:'anonymous-event',title:'Anonymous gathering',path:'/events/anonymous/',legacyPaths:['/event/old-anonymous/'],schedule:{kind:'weekly' as const,weekday:0,from:'2026-09-27',until:'2026-10-11',exclusions:['2026-10-04']},calendarRevision:{modifiedAt:'2026-10-19T02:00:00Z',sequence:2}};
function context(cancelled=false):FrontendRenderContext{return {mode:'restricted',basePath:'',siteContent:{pages:[],posts:[],events:cancelled?[]:[event],cancelledCalendarEvents:cancelled?[{...event,calendarRevision:{...event.calendarRevision,sequence:3,cancelled:true}}]:[],venues,home:null,settings:defaultSiteSettings,assets:{},routes:[]}};}
describe('live calendar subscriptions',()=>{
 it('keeps date exports within the selected month and updates retained future views',async()=>{
  const c=context();const month=await calendarSubscription(new Request('https://www.example.test/events/month/2026-10/?ical=1'),c)!.text();
  expect(month).toContain('DTSTART;TZID=Australia/Melbourne:20261011T173000');expect(month).not.toContain('DTSTART;TZID=Australia/Melbourne:20260927T173000');
  const request=new Request('https://www.example.test/events/day/2026-10-11/');const before=await maintainedCalendarView(request,c)!.text();expect(before).toContain('Anonymous gathering');expect(before).toContain('2026-10-11');
  c.siteContent!.events=[{...event,title:'Changed published gathering'}];expect(await maintainedCalendarView(request,c)!.text()).toContain('Changed published gathering');
  for(const path of ['/events/month/2026-99/','/events/day/2026-02-31/','/events/category/unknown/day/2026-10-11/','/events/list/page/999/','/events/anonymous/'])expect(futureCalendarPage(new Request('https://www.example.test'+path),c)).toBeNull();
 });
 it('retains the exact category and venue scope when a new CMS event is assigned to that calendar',async()=>{
  const c=context();c.siteContent!.events=[event,{...event,id:'other',title:'Unrelated gathering',venue:'rye-civic-hall'}];c.siteContent!.eventScopeIds={'/events/category/bible-study/':[event.id]};c.siteContent!.sourceCalendarIdentityPaths={'42':'/venue/saving-grace-bible-church/'};
  const category=await calendarSubscription(new Request('https://www.example.test/events/?tribe_events_cat=8&ical=1'),c)!.text();expect(category).toContain('Anonymous gathering');expect(category).not.toContain('Unrelated gathering');
  const venue=await calendarSubscription(new Request('https://www.example.test/venue/saving-grace-bible-church/?ical=1'),c)!.text();expect(venue).not.toContain('Unrelated gathering');
  expect(calendarSubscription(new Request('https://www.example.test/events/?tribe_events_cat=999999&ical=1'),c)).toBeNull();
 });
 it('preserves recurring identity, DST-aware UTC limits and exclusions',()=>{const feed=renderCalendarFeed(context());expect(feed).toContain('UID:anonymous-event@www.savinggrace.org.au');expect(feed).toContain('SEQUENCE:2');expect(feed).toContain('LAST-MODIFIED:20261019T020000Z');expect(feed).toContain('UNTIL=20261011T080000Z');expect(feed).toContain('EXDATE;TZID=Australia/Melbourne:20261004T173000');expect(feed).toContain('STATUS:CONFIRMED');});
 it('updates edits and cancellations through the same legacy subscription URL',async()=>{const request=new Request('https://www.example.test/event/old-anonymous/?ical=1');const current=calendarSubscription(request,context())!;expect(current.headers.get('Content-Type')).toContain('text/calendar');expect(await current.text()).toContain('STATUS:CONFIRMED');const updated=context();updated.siteContent!.events=[{...event,title:'Edited gathering'}];expect(await calendarSubscription(request,updated)!.text()).toContain('Edited gathering');const removed=await calendarSubscription(request,context(true))!.text();expect(removed).toContain('STATUS:CANCELLED');expect(removed).toContain('SEQUENCE:3');expect(removed).not.toContain('STATUS:CONFIRMED');});
 it('folds at UTF-8 octet boundaries and refuses unknown event subscriptions',()=>{const c=context();c.siteContent!.events=[{...event,title:'مرحبا '.repeat(40)}];for(const line of renderCalendarFeed(c).split('\r\n'))expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);expect(calendarSubscription(new Request('https://www.example.test/event/unknown/?ical=1'),c)).toBeNull();});
});


it('honors past and upcoming membership without discarding the temporal query',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T04:00:00Z'));
 try{
  const c=context();c.siteContent!.events=[event,{...event,id:'ongoing',title:'Ongoing gathering',schedule:{kind:'weekly',weekday:0,from:'2026-09-27'}},{...event,id:'future',title:'Future gathering',schedule:{kind:'single',date:'2026-11-01'}}];
  const past=await calendarSubscription(new Request('https://www.example.test/events/?eventDisplay=past&ical=1'),c)!.text();expect(past).not.toContain('Future gathering');expect(past).toContain('Ongoing gathering');expect(past).toContain('UNTIL=20261018T080000Z');
  const upcoming=await calendarSubscription(new Request('https://www.example.test/events/?eventDisplay=upcoming&ical=1'),c)!.text();expect(upcoming).toContain('Future gathering');expect(upcoming).toContain('Ongoing gathering');expect(upcoming).not.toContain('SUMMARY:Anonymous gathering');
 }finally{vi.useRealTimers();}
});


it('updates rolling view dates and published content while retaining historical captures and explicit replacements',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-02T02:00:00Z'));
 try{
  const c=context();c.mode='public';c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:0,from:'2026-09-27'},title:'Current published gathering'}];c.siteContent!.sourceSeoByPath={'/events/month/':{title:'Events for October 2026 | Anonymous church',socialTitle:'October 2026 events',description:'Preserved original description.'}};c.siteContent!.sourceContentByPath={'/events/month/':[{path:'/events/month/',heading:'October 2026',hasOriginalHeading:true}]as never};
  const request=new Request('https://www.example.test/events/month/'),first=await maintainedCalendarView(request,c)!.text();expect(first).toContain('<title>Events for November 2026 | Anonymous church</title>');expect(first).toContain('<h1>November 2026</h1>');expect(first).toContain('Current published gathering');expect(first).toContain('Preserved original description.');expect(first).toContain('aria-label="Calendar views"');expect(first).toContain('name="tribe-bar-date"');
  c.siteContent!.events=[{...c.siteContent!.events[0]!,title:'New published title'}];expect(await maintainedCalendarView(request,c)!.text()).toContain('New published title');
  c.siteContent!.cmsExplicitSeoByPath={'/events/month/':{replaceSourceContent:true}};expect(maintainedCalendarView(request,c)).toBeNull();expect(maintainedCalendarView(new Request('https://www.example.test/events/month/2024-01/'),c)).toBeNull();expect(maintainedCalendarView(new Request('https://www.example.test/events/list/?eventDisplay=past'),c)).toBeNull();expect(maintainedCalendarView(new Request('https://www.example.test/events/'),c)).toBeNull();
 }finally{vi.useRealTimers();}
});
it('keeps the verified Monday week boundary in HTML and calendar exports',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-21T02:00:00Z'));
 try{const c=context();c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:1,from:'2026-10-01'}}];const request=new Request('https://www.example.test/events/week/2026-10-21/'),html=await maintainedCalendarView(request,c)!.text();expect(html).toContain('From 2026-10-19 to 2026-10-25');const feed=await calendarSubscription(new Request(request.url+'?ical=1'),c)!.text();expect(feed).toContain('20261019T173000');expect(feed).not.toContain('20261026T173000');}finally{vi.useRealTimers();}
});

it('preserves editor modules, explicit metadata and replaced or hidden source calendars',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-02T02:00:00Z'));
 try{
  const c=context(),path='/events/month/',nodes=[{tag:'p',text:'Captured event rows.'}];
  c.mode='public';c.siteContent!.sourceContentByPath={[path]:[{path,heading:'October 2026',content:nodes}]as never};
  c.siteContent!.sourceContentAdoptedByPath={[path]:true};c.siteContent!.sourceSeoByPath={[path]:{title:'October 2026 events'}};
  c.siteContent!.initialMetadataByPath={[path]:{title:'October 2026',heading:'October 2026',seeded:true}};
  const original={kind:'source-content' as const,nodes,cmsInstanceId:'original-content'};
  const page={id:'anonymous-calendar',path,title:'October 2026',section:'events',status:'published',description:'',legacyPaths:[],blocks:[{kind:'paragraph',text:'Editor introduction.'},original,{kind:'paragraph',text:'Editor conclusion.'}]}as never;
  c.siteContent!.pages=[page];c.siteContent!.cmsExplicitSeoByPath={[path]:{title:'Editor SEO title'}};
  const request=new Request('https://www.example.test'+path),rendered=await maintainedCalendarView(request,c)!.text();
  expect(rendered).toContain('<title>Editor SEO title</title>');expect(rendered).toContain('<h1>November 2026</h1>');expect(rendered.indexOf('Editor introduction.')).toBeLessThan(rendered.indexOf('From 2026-11-01'));expect(rendered.indexOf('Editor conclusion.')).toBeGreaterThan(rendered.indexOf('From 2026-11-01'));expect(rendered).not.toContain('Captured event rows.');
  c.siteContent!.pages=[{...c.siteContent!.pages[0]!,title:'Editor heading'}];expect(await maintainedCalendarView(request,c)!.text()).toContain('<h1>Editor heading</h1>');
  c.siteContent!.pages=[{...c.siteContent!.pages[0]!,blocks:[]}];expect(maintainedCalendarView(request,c)).toBeNull();
  c.siteContent!.pages=[{...c.siteContent!.pages[0]!,blocks:[{...original,nodes:[{tag:'p',text:'Editor replacement.'}]}]}];expect(maintainedCalendarView(request,c)).toBeNull();
 }finally{vi.useRealTimers();}
});

it('searches published event wording and venue details in HTML and subscriptions without external geocoding',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T02:00:00Z'));
 try{const c=context();c.siteContent!.events=[{...event,title:'Anonymous fellowship',description:['Shared meal and conversation.'],schedule:{kind:'single',date:'2026-10-25'}},{...event,id:'other',title:'Unrelated workshop',description:[],venue:'rye-civic-hall',schedule:{kind:'single',date:'2026-10-25'}}];
 const path='/events/list/?tribe-bar-search=shared+meal&tribe-bar-location=Westmeadows',page=await futureCalendarPage(new Request('https://www.example.test'+path),c)!.text();expect(page).toContain('Anonymous fellowship');expect(page).not.toContain('Unrelated workshop');expect(page).toContain('aria-label="Search church events"');const feed=await calendarSubscription(new Request('https://www.example.test'+path+'&ical=1'),c)!.text();expect(feed).toContain('Anonymous fellowship');expect(feed).not.toContain('Unrelated workshop');
 const nested=await futureCalendarPage(new Request('https://www.example.test/events/list/?tribe-events-views[tribe-bar-search]=shared'),c)!.text();expect(nested).toContain('Anonymous fellowship');expect(nested).not.toContain('Unrelated workshop');expect(futureCalendarPage(new Request('https://www.example.test'+path+'&tribe-events-views[tribe-bar-search]=other'),c)).toBeNull();
 }finally{vi.useRealTimers();}
});

it('returns gone only for an explicitly excluded occurrence, leaving unknown dates missing',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T02:00:00Z'));
 try{const c=context();c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:0,from:'2026-10-01',exclusions:['2026-10-25']}}];expect(futureCalendarOccurrence(new Request('https://www.example.test/event/old-anonymous/2026-10-25/'),c)?.status).toBe(410);expect(futureCalendarOccurrence(new Request('https://www.example.test/event/old-anonymous/2026-10-26/'),c)).toBeNull();expect(futureCalendarOccurrence(new Request('https://www.example.test/event/old-anonymous/2026-11-01/'),c)?.status).toBe(200);}finally{vi.useRealTimers();}
});

it('paginates twelve real monthly occurrences across years without an artificial one-year truncation',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T02:00:00Z'));
 try{const c=context();c.siteContent!.events=[{...event,schedule:{kind:'monthly-first',weekday:6,from:'2026-10-01'}}];
 c.siteContent!.sourceSeoByPath={'/events/list/page/3/':{title:'Events from October 7, 2028 to September 1, 2029'}};
 const first=await futureCalendarPage(new Request('https://www.example.test/events/list/'),c)!.text(),third=await futureCalendarPage(new Request('https://www.example.test/events/list/page/3/'),c)!.text();
 expect((first.match(/class="event"/g)??[]).length).toBe(12);expect(third).toContain('<title>Events from October 7, 2028 to September 1, 2029</title>');expect(third).toContain('2028-10-07');expect(third).not.toContain('2026-10-03');expect(first).toContain('More dates');
 expect(futureCalendarOccurrence(new Request('https://www.example.test/event/old-anonymous/2028-10-07/'),c)?.status).toBe(200);expect(futureCalendarOccurrence(new Request('https://www.example.test/event/old-anonymous/2040-10-06/'),c)).toBeNull();
 }finally{vi.useRealTimers();}
});
it('keeps linked empty historical date views truthful without extrapolating past recurrence',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T02:00:00Z'));
 try{const c=context();c.mode='public';c.siteContent!.legacyCalendarOccurrences=[{eventId:event.id,uid:'anonymous-original',date:'2026-09-27',url:'https://www.savinggrace.org.au/event/old-anonymous/2026-09-27/',sequence:0,lines:[]}];
 const response=futureCalendarPage(new Request('https://www.example.test/events/day/2026-10-10/'),c)!,html=await response.text();expect(response.status).toBe(200);expect(html).toContain('No verified historical entry');expect(html).toContain('not a complete historical record');expect(html).not.toContain('class="event"');expect(html).toContain('noindex, follow');
 expect(futureCalendarPage(new Request('https://www.example.test/events/day/2020-01-01/'),c)).toBeNull();
 }finally{vi.useRealTimers();}
});

it('keeps verified historical membership when the current recurrence begins after the requested past window',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T02:00:00Z'));
 try{const c=context();c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:0,from:'2026-10-01'}}];
 c.siteContent!.legacyCalendarOccurrences=Array.from({length:30},(_,i)=>{const date=new Date(Date.UTC(2026,0,4+i*7)).toISOString().slice(0,10);return{eventId:event.id,uid:'original-'+i,date,url:'https://www.savinggrace.org.au/event/old-anonymous/'+date+'/',sequence:0,lines:['UID:original-'+i,'SUMMARY:Verified historical gathering','DTSTART;TZID=Australia/Melbourne:'+date.replaceAll('-','')+'T173000','DTEND;TZID=Australia/Melbourne:'+date.replaceAll('-','')+'T190000','URL:https://www.savinggrace.org.au/event/old-anonymous/'+date+'/']};});
 const html=await futureCalendarPage(new Request('https://www.example.test/events/list/page/3/?tribe-bar-date=2026-09-01&eventDisplay=past'),c)!.text();expect(html).toContain('Verified historical gathering');expect(html).toContain('2026-01-');expect(html).not.toContain('Anonymous gathering');
 }finally{vi.useRealTimers();}
});

it('cancels a verified future occurrence removed by a published recurrence edit and preserves its feed UID',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T02:00:00Z'));
 try{const c=context(),path='/event/old-anonymous/2026-10-25/';c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:1,from:'2026-10-01'}}];c.siteContent!.legacyCalendarOccurrences=[{eventId:event.id,uid:'verified-original-uid',date:'2026-10-25',url:'https://www.savinggrace.org.au'+path,sequence:0,lines:[]}];
 expect(futureCalendarOccurrence(new Request('https://www.example.test'+path),c)?.status).toBe(410);const feed=await calendarSubscription(new Request('https://www.example.test/events/?ical=1'),c)!.text();expect(feed).toContain('UID:verified-original-uid');expect(feed).toContain('STATUS:CANCELLED');
 expect(futureCalendarOccurrence(new Request('https://www.example.test/event/old-anonymous/2026-10-27/'),c)).toBeNull();
 }finally{vi.useRealTimers();}
});
it('retains explicit occurrence edits, module hiding and slug dispositions instead of replacing them with a computed series page',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T02:00:00Z'));
 try{const c=context(),path='/event/old-anonymous/2026-10-25/',nodes=[{tag:'p',text:'Original occurrence wording.'}],source={path,kind:'event',content:nodes};c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:0,from:'2026-10-01'}},{...event,id:'specific-occurrence',path,legacyPaths:[],calendarVisible:false,schedule:{kind:'single',date:'2026-10-25'},modules:[{kind:'source-content',nodes,cmsInstanceId:'original-content'}],calendarRevision:{modifiedAt:'2026-10-19T02:00:00Z',sequence:1}}as never];c.siteContent!.sourceContentByPath={[path]:[source]as never};c.siteContent!.sourceContentAdoptedByPath={[path]:true};
 expect(futureCalendarOccurrence(new Request('https://www.example.test'+path),c)?.status).toBe(200);
 c.siteContent!.events[1]!.calendarRevision!.sequence=2;expect(futureCalendarOccurrence(new Request('https://www.example.test'+path),c)).toBeNull();c.siteContent!.events[1]!.calendarRevision!.sequence=1;c.siteContent!.events[1]!.modules=[];expect(futureCalendarOccurrence(new Request('https://www.example.test'+path),c)).toBeNull();
 c.siteContent!.routes=[{path,entityId:'specific-occurrence',status:301,targetPath:'/moved-occurrence/'},{path:'/moved-occurrence/',entityId:'specific-occurrence',status:200,targetPath:null}];expect(futureCalendarOccurrence(new Request('https://www.example.test'+path),c)).toBeNull();
 }finally{vi.useRealTimers();}
});


it('renders complete selected months when opened from a middle date, with the same feed membership',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T02:00:00Z'));
 try{const c=context();c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:0,from:'2026-09-27',until:'2026-11-08'}}];const url='https://www.example.test/events/?eventDisplay=month&tribe-bar-date=2026-10-21';const html=await maintainedCalendarView(new Request(url),c)!.text();expect(html).toContain('From 2026-10-01 to 2026-10-31');expect(html).toContain('2026-10-04T17:30');expect(html).not.toContain('Calendar days');const feed=await calendarSubscription(new Request(url+'&ical=1'),c)!.text();expect(feed).toContain('20261004T173000');expect(feed).toContain('20261025T173000');expect(feed).not.toContain('20261101T173000');}finally{vi.useRealTimers();}
});
it('restores real adjacent-day links and scoped live client subscriptions without leaking loopback URLs',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-19T02:00:00Z'));
 try{const c=context();c.mode='public';c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:0,from:'2026-10-01'}}];const request=new Request('https://www.example.test/events/day/2026-10-21/?utm_source=example&paged=1');const html=await maintainedCalendarView(request,c)!.text();expect(html).toContain('/events/day/2026-10-20/?utm_source=example');expect(html).toContain('/events/day/2026-10-22/?utm_source=example');for(const label of ['Google Calendar','iCalendar','Outlook 365','Outlook Live','Export .ics file','Export Outlook .ics file'])expect(html).toContain(label);expect(html).not.toContain('cid=webcal%3A%2F%2Fwww.example.test');c.mode='restricted';const privateHtml=await maintainedCalendarView(request,c)!.text();expect(privateHtml).not.toContain('https://www.google.com/calendar/render');expect(privateHtml).toContain('Export .ics file');}finally{vi.useRealTimers();}
});

it('retains a verified future subscription UID beyond the default year while respecting explicit windows and scope',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-20T02:00:00Z'));
 try{const c=context();c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:2,from:'2026-10-20'}}];c.siteContent!.eventScopeIds={'/events/category/bible-study/':[event.id]};c.siteContent!.legacyCalendarOccurrences=[{eventId:event.id,uid:'verified-future-uid',date:'2027-10-26',url:'https://www.savinggrace.org.au/event/old-anonymous/2027-10-26/',sequence:0,lines:[]}];
 const request=(path:string)=>calendarSubscription(new Request('https://www.example.test'+path),c)!.text();
 const feed=await request('/events/category/bible-study/page/3/?ical=1');expect(feed).toContain('UID:verified-future-uid');expect(feed).toContain('DTSTART;TZID=Australia/Melbourne:20271026T173000');
 expect(await request('/events/category/bible-study/day/2027-10-19/?ical=1')).not.toContain('verified-future-uid');expect(await request('/events/category/bible-study/?eventDisplay=past&ical=1')).not.toContain('verified-future-uid');
 c.siteContent!.legacyCalendarOccurrences=[{...c.siteContent!.legacyCalendarOccurrences[0]!,eventId:'unrelated'}];expect(await request('/events/category/bible-study/?ical=1')).not.toContain('20271026T');
 c.siteContent!.legacyCalendarOccurrences=[{...c.siteContent!.legacyCalendarOccurrences[0]!,eventId:event.id,date:'2037-10-27'}];expect(await request('/events/category/bible-study/?ical=1')).not.toContain('20371027T');
 }finally{vi.useRealTimers();}
});

it('keeps captured legacy query calendars live and rejects only proved exhausted current pagination',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
 try{const c=context(),path='/?post_type=tribe_events&eventDisplay=list';const request=new Request('https://www.savinggrace.org.au'+path);expect(await maintainedCalendarView(request,c)!.text()).toContain('Anonymous gathering');c.siteContent!.events=[{...event,title:'Updated published gathering'}];expect(await maintainedCalendarView(request,c)!.text()).toContain('Updated published gathering');expect(maintainedCalendarView(new Request(request.url+'&paged=2'),c)?.status).toBe(404);expect(maintainedCalendarView(new Request(request.url+'&tag=unknown'),c)).toBeNull();expect(maintainedCalendarView(new Request(request.url+'&tribe-bar-date=2024-01-01'),c)).toBeNull();}finally{vi.useRealTimers();}
});

it('retains captured Day-selector semantics and uses native URLs for real daily pagination',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
 try{const c=context(),path='/?post_type=tribe_events&eventDisplay=day&eventDate=2026-10-11&paged=5';c.siteContent!.sourceSeoByPath={[path]:{title:'Original day title'}};c.siteContent!.events=Array.from({length:17},(_,i)=>({...event,id:'daily-'+i,path:'/events/daily-'+i+'/',legacyPaths:[],title:'Daily gathering '+i,schedule:{kind:'single',date:'2026-10-11'}}));const response=maintainedCalendarView(new Request('https://www.savinggrace.org.au'+path),c)!;expect(response.status).toBe(200);const doc=await response.text();expect(doc).toContain('Daily gathering 0');expect(doc).not.toContain('Daily gathering 16');expect(doc).toContain('href="/events/day/2026-10-11/?paged=2"');const next=await futureCalendarPage(new Request('https://www.savinggrace.org.au/events/day/2026-10-11/?paged=2'),c)!.text();expect(next).toContain('Daily gathering 16');expect(next).not.toContain('Daily gathering 0');const alias=maintainedCalendarView(new Request('https://www.savinggrace.org.au/page/2/?post_type=tribe_events&eventDisplay=day&eventDate=2026-10-11'),c)!;expect(alias.status).toBe(301);expect(alias.headers.get('location')).toBe('/events/day/2026-10-11/');}finally{vi.useRealTimers();}
});

it('excludes a witnessed but exhausted live legacy page from the sitemap without excluding its working collection',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));try{const c=context(),path='/?post_type=tribe_events&eventDisplay=list',second=path+'&paged=2';c.siteContent!.sourceSeoByPath={[path]:{title:'Collection'},[second]:{title:'Collection page two'}};const pages=[path,second].map(path=>({path,kind:'archive',indexable:true,issues:[],canonicalSource:null,content:[],sourceUrl:'https://www.savinggrace.org.au'+path}));expect(sourcePublicSitemap(pages as never,c).map(row=>row.path)).toEqual([path]);}finally{vi.useRealTimers();}});


it('keeps a distinct noindex calendar query canonical instead of the homepage and removes only campaign identity',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-01T00:00:00Z'));
 try{const c=context();c.mode='public';c.siteContent!.events=[{...event,schedule:{kind:'weekly',weekday:0,from:'2026-10-01',until:'2027-10-01'}}];const path='/?post_type=tribe_events&eventDisplay=list&paged=2';c.siteContent!.sourceSeoByPath={[path]:{title:'Original calendar page two',noindex:true}};const response=maintainedCalendarView(new Request('https://www.savinggrace.org.au'+path+'&utm_source=example'),c)!;expect(response.status).toBe(200);const doc=await response.text(),escaped=path.replaceAll('&','&amp;');expect(doc).toContain('rel="canonical" href="https://www.savinggrace.org.au'+escaped+'"');expect(doc).toContain('property="og:url" content="https://www.savinggrace.org.au'+escaped+'"');expect(doc).toContain('name="robots" content="noindex, follow"');expect(doc).not.toContain('rel="canonical" href="https://www.savinggrace.org.au/"');expect(doc).toContain('utm_source=example');expect(doc).toContain('Original calendar page two');
 }finally{vi.useRealTimers();}
});

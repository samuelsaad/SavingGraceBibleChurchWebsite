import {describe,it,expect} from 'vitest';
import {renderCalendarFeed} from '../src/frontend/pages/church';
import {calendarSubscription,futureCalendarPage,maintainedCalendarView} from '../src/seo/calendar-subscriptions';
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

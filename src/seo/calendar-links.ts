/** Original calendar clients receive the same live, scoped subscription resource. */
import {sourceOrigin} from './source-public-model';
export function calendarSubscriptionTargets(request:URL,publicClients:boolean,title:string){
 const feed=new URL(request.pathname+request.search,sourceOrigin);
 for(const key of ['paged','page','outlook-ical'])feed.searchParams.delete(key);
 feed.searchParams.set('ical','1');
 const download=feed.pathname+feed.search,outlook=new URL(feed);outlook.searchParams.delete('ical');outlook.searchParams.set('outlook-ical','1');
 const webcal=feed.href.replace(/^https:/u,'webcal:');
 const clients=publicClients?[
  {label:'Google Calendar',href:'https://www.google.com/calendar/render?'+new URLSearchParams({cid:webcal}).toString()},
  {label:'iCalendar',href:webcal},
  ...[['Outlook 365','https://outlook.office.com/owa'],['Outlook Live','https://outlook.live.com/owa']].map(([label,base])=>({label:label!,href:base+'?'+new URLSearchParams({path:'/calendar/action/compose',rru:'addsubscription',url:feed.href,name:title}).toString()}))
 ]:[];
 return {download,outlookDownload:outlook.pathname+outlook.search,clients};
}
export function adjacentCalendarDay(request:URL,scopePath:string,date:string,offset:-1|1){
 const value=new Date(Date.parse(date+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10),target=new URL(request);
 target.pathname=scopePath+'day/'+value+'/';
 for(const key of ['paged','page','eventDate','tribe-bar-date','eventDisplay'])target.searchParams.delete(key);
 return {date:value,href:target.pathname+target.search};
}

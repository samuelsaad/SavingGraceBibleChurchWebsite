/** Source-backed iCalendar identity continuity. No WordPress UID is synthesized. */
import {occurrencesBetween,melbourneToday,type ChurchEvent} from '../frontend/content/events';
import type {SourcePublicPage} from './source-public-model';
export interface LegacyCalendarOccurrence{eventId:string;uid:string;date:string;url:string;sequence:number;modifiedAt?:string;lines:readonly string[];}
const stampDate=(value:string)=>/^(\d{4})(\d{2})(\d{2})T/u.exec(value)?.slice(1).join('-');
export function parseLegacyCalendar(body:string,events:readonly ChurchEvent[]):LegacyCalendarOccurrence[]{
 if(!body.startsWith('BEGIN:VCALENDAR')||body.length>4*1024*1024)return [];
 const result:LegacyCalendarOccurrence[]=[];
 for(const part of body.replace(/\r?\n[ \t]/gu,'').split('BEGIN:VEVENT').slice(1)){
  const lines=part.split('END:VEVENT')[0]!.split(/\r?\n/u).filter(Boolean),get=(name:string)=>lines.find(line=>line.startsWith(name+':')||line.startsWith(name+';'))?.split(/:(.*)/su)[1];
  const uid=get('UID'),url=get('URL'),date=stampDate(get('DTSTART')??'');
  if(!uid||!url||!date||uid.length>512||/[\x00-\x20]/u.test(uid)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)continue;
  let parsed:URL;try{parsed=new URL(url);}catch{continue;}
  if(parsed.origin!=='https://www.savinggrace.org.au'||parsed.search||parsed.hash)continue;
  const parent=parsed.pathname.replace(/20\d{2}-\d{2}-\d{2}\/$/u,'');
  const matches=events.filter(e=>e.calendarVisible!==false&&(e.path===parent||e.legacyPaths.includes(parent)||e.path===parsed.pathname||e.legacyPaths.includes(parsed.pathname)));
  if(matches.length!==1)continue;
  const last=get('LAST-MODIFIED'),modifiedAt=last&&/^\d{8}T\d{6}Z$/u.test(last)?last.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u,'$1-$2-$3T$4:$5:$6Z'):undefined;
  const sequence=get('SEQUENCE');if(sequence&&!/^\d{1,9}$/u.test(sequence))continue;
  result.push({eventId:matches[0]!.id,uid,date,url:parsed.href,sequence:sequence?Number(sequence):0,...(modifiedAt&&Number.isFinite(Date.parse(modifiedAt))?{modifiedAt}:{}),lines});
 }return result;
}
export async function loadLegacyCalendarOccurrences(pages:readonly SourcePublicPage[],asset:(request:Request)=>Promise<Response|null>,events:readonly ChurchEvent[]){
 const records=new Map<string,LegacyCalendarOccurrence>(),seen=new Set<string>();
 for(const page of pages){if(page.kind!=='asset'||!page.asset||page.asset.contentType.split(';')[0]!=='text/calendar'||!page.asset.bytes||seen.has(page.asset.sha256))continue;seen.add(page.asset.sha256);
  const response=await asset(new Request('https://www.savinggrace.org.au'+page.path));if(response?.status!==200)throw Error('source_calendar_identity_asset_unavailable');
  for(const record of parseLegacyCalendar(await response.text(),events)){const key=record.eventId+':'+record.date,previous=records.get(key);if(previous&&previous.uid!==record.uid)throw Error('source_calendar_occurrence_uid_conflict');if(!previous||(record.modifiedAt??'')>(previous.modifiedAt??''))records.set(key,record);}
 }return [...records.values()];
}
/** WordPress exported separate occurrences. Continue that format with live CMS rules. */
export function calendarOccurrenceEvents(events:readonly ChurchEvent[],records:readonly LegacyCalendarOccurrence[],window:{from:string;until:string},now=new Date()):ChurchEvent[]{
 const today=melbourneToday(now),output:ChurchEvent[]=[];
 for(const event of events){if(event.calendarVisible===false)continue;const known=records.filter(r=>r.eventId===event.id&&r.date>=window.from&&r.date<=window.until),byDate=new Map(known.map(r=>[r.date,r]));
  const actual=occurrencesBetween(event,window.from,window.until,500),dates=new Set(actual.map(o=>o.date));
  const append=(date:string,original:LegacyCalendarOccurrence|undefined,cancelled=false)=>{const edited=(event.calendarRevision?.sequence??0)>1,sequence=Math.max(original?.sequence??0,event.calendarRevision?.sequence??0);output.push({...event,id:event.id+'-'+date,schedule:{kind:'single',date},calendarRevision:{...event.calendarRevision,modifiedAt:event.calendarRevision?.modifiedAt??now.toISOString(),sequence,...(cancelled||event.calendarRevision?.cancelled?{cancelled:true}:{})},calendarIdentity:{uid:original?.uid??event.id+'-'+date+'@www.savinggrace.org.au',url:original?.url??'https://www.savinggrace.org.au'+event.path,sequence:edited?sequence:original?.sequence??sequence,...(edited&&event.calendarRevision?{modifiedAt:event.calendarRevision.modifiedAt}:original?.modifiedAt?{modifiedAt:original.modifiedAt}:{}),...(original&&date<today&&!event.calendarRevision?.cancelled?{originalLines:original.lines}:{})}});};
  // Historical facts come only from captured occurrences, never extrapolated rules.
  for(const original of known)if(original.date<today||!dates.has(original.date))append(original.date,original,original.date>=today&&!dates.has(original.date));
  for(const occurrence of actual)if(occurrence.date>=today||!records.some(r=>r.eventId===event.id))append(occurrence.date,byDate.get(occurrence.date));
 }return output;
}

import type {ChurchEvent,Venue} from './content/events';
import type {SourcePrimaryStructuredData} from '../domain/source-content';
/** Match Melbourne wall time against both real offsets; ambiguity stays unresolved. */
export function melbourneWallTime(date:string,time:string):string|null{
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const matches=[10,11].map(offset=>`${date}T${time}:00+${offset}:00`).filter(value=>{const parsed=new Date(value);if(!Number.isFinite(parsed.getTime()))return false;const p=Object.fromEntries(formatter.formatToParts(parsed).map(part=>[part.type,part.value]));return `${p.year}-${p.month}-${p.day}`===date&&`${p.hour}:${p.minute}`===time;});return matches.length===1?matches[0]!:null;
}
export function adoptedEventMetadata(event:ChurchEvent,venue:Venue,original?:SourcePrimaryStructuredData):SourcePrimaryStructuredData|null{
 if(event.schedule.kind!=='single')return null;const start=melbourneWallTime(event.schedule.date,event.start),end=melbourneWallTime(event.schedule.date,event.end);if(!start||!end||Date.parse(end)<Date.parse(start))return null;
 const retained=original?.type==='Event'&&original.location?.name===venue.name&&original.location.address?.streetAddress===venue.address?original.location:{name:venue.name};
 return {type:'Event',path:event.path,name:event.title,startDate:start,endDate:end,location:retained};
}

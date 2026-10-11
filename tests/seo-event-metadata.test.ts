import {describe,expect,it} from 'vitest';
import {melbourneWallTime,adoptedEventMetadata} from '../src/frontend/event-source-metadata';
describe('published event facts',()=>{
 it('keeps real Melbourne date/time, summer/winter offsets and refuses ambiguous or nonexistent times',()=>{
  expect(melbourneWallTime('2026-10-11','10:30')).toBe('2026-10-11T10:30:00+11:00');
  expect(melbourneWallTime('2026-07-12','10:30')).toBe('2026-07-12T10:30:00+10:00');
  expect(melbourneWallTime('2026-10-04','02:30')).toBeNull();expect(melbourneWallTime('2026-04-05','02:30')).toBeNull();
 });
 it('uses published date/title/path and retains only unchanged verified venue facts',()=>{
  const event={id:'anonymous',path:'/event/anonymous/2026-10-11/',title:'Published anonymous title',schedule:{kind:'single' as const,date:'2026-10-11'},start:'10:30',end:'11:30',venue:'fixture',description:[],legacyPaths:[],sourceIds:[]};
  const venue={id:'fixture',name:'Anonymous venue',address:'Example address',locality:'Example locality',legacyPath:'/venue/fixture/'};
  expect(adoptedEventMetadata(event,venue)).toMatchObject({type:'Event',path:event.path,name:event.title,startDate:'2026-10-11T10:30:00+11:00',location:{name:venue.name}});
 });
});

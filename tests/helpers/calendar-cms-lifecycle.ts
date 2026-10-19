import{createServer}from'node:http';
import {expect} from 'vitest';
import type {CmsRepository} from '../../src/cms/repository';
import type {CmsAuditActor} from '../../src/cms/model';
import {createCmsFrontendSnapshot} from '../../src/cms/frontend-adapter';
import {calendarSubscription} from '../../src/seo/calendar-subscriptions';
export async function verifyCalendarCmsLifecycle(repository:CmsRepository,actor:CmsAuditActor){
 const payload={id:'anonymous-live-calendar',path:'/events/anonymous-live-calendar/',title:'Anonymous calendar gathering',schedule:{kind:'weekly',weekday:0,from:'2026-10-01',exclusions:['2026-10-11']},start:'10:00',end:'11:00',venue:'anonymous-venue',description:['Anonymous public calendar wording.'],legacyPaths:[],sourceIds:[]};
 let event=await repository.create({key:'event:anonymous-live-calendar',kind:'event',content:payload},actor);
 const server=createServer(async(incoming,outgoing)=>{try{if(incoming.method!=='GET'||incoming.url!=='/events/?ical=1'){outgoing.writeHead(404);outgoing.end();return;}const snapshot=createCmsFrontendSnapshot(await repository.getPublishedSnapshot()),response=calendarSubscription(new Request('https://www.example.test/events/?ical=1'),{mode:'restricted',basePath:'',siteContent:snapshot})!;outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(await response.text());}catch{outgoing.writeHead(500);outgoing.end('anonymous_calendar_test_failed');}});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const address=server.address();if(!address||typeof address==='string')throw Error('calendar_test_listener');
 const feed=async()=>{const response=await fetch('http://127.0.0.1:'+address.port+'/events/?ical=1');expect(response.status).toBe(200);expect(response.headers.get('content-type')).toContain('text/calendar');expect(response.headers.get('x-robots-tag')).toContain('noindex');return response.text();};
 try{
 expect(await feed()).not.toContain(payload.title);
 event=await repository.publish(event.id,{expectedRowVersion:event.rowVersion,revisionId:event.draftRevisionId},actor);const original=event.publishedRevisionId!;
 const first=await feed();expect(first).toContain(payload.title);expect(first).toContain('EXDATE;TZID=Australia/Melbourne:20261011T100000');
 event=await repository.save(event.id,{expectedRowVersion:event.rowVersion,content:{...payload,title:'Anonymous edited gathering',path:'/events/anonymous-live-calendar-renamed/'}},actor);expect(await feed()).toBe(first);
 event=await repository.publish(event.id,{expectedRowVersion:event.rowVersion,revisionId:event.draftRevisionId},actor);
 const second=await feed();expect(second).toContain('Anonymous edited gathering');expect(second).toContain('SEQUENCE:2');expect((await repository.getPublishedSnapshot()).routes).toContainEqual({path:payload.path,entityId:event.id,status:301,targetPath:'/events/anonymous-live-calendar-renamed/'});
 event=await repository.unpublish(event.id,{expectedRowVersion:event.rowVersion,disposition:'gone'},actor);const cancelled=await feed();expect(cancelled).toContain('STATUS:CANCELLED');expect(cancelled).toContain('Anonymous edited gathering');expect(cancelled).toContain('SEQUENCE:3');
 event=await repository.save(event.id,{expectedRowVersion:event.rowVersion,content:{...payload,title:'Private unpublished future edit'}},actor);const stillCancelled=await feed();expect(stillCancelled).toBe(cancelled);expect(stillCancelled).not.toContain('Private unpublished future edit');
 event=await repository.restore(event.id,{expectedRowVersion:event.rowVersion,revisionId:original},actor);
 event=await repository.publish(event.id,{expectedRowVersion:event.rowVersion,revisionId:event.draftRevisionId},actor);const restored=await feed();expect(restored).toContain(payload.title);expect(restored).toContain('SEQUENCE:4');expect(restored).not.toContain('Anonymous edited gathering');expect(restored).not.toContain('UID:anonymous-live-calendar@www.savinggrace.org.au\r\nSTATUS:CANCELLED');
 const seededPayload={...payload,id:'anonymous-initially-published',path:'/events/anonymous-initially-published/',title:'Anonymous seeded gathering'};
 await repository.seed([{key:'event:anonymous-initially-published',kind:'event',title:seededPayload.title,path:seededPayload.path,payload:seededPayload,publish:true}]);
 let seeded=(await repository.list()).find(item=>item.key==='event:anonymous-initially-published')!;expect((await repository.getPublishedSnapshot()).entities.find(item=>item.id===seeded.id)?.calendarSequence).toBe(1);
 seeded=await repository.save(seeded.id,{expectedRowVersion:seeded.rowVersion,content:{...seededPayload,title:'First genuine seeded edit'}},actor);seeded=await repository.publish(seeded.id,{expectedRowVersion:seeded.rowVersion,revisionId:seeded.draftRevisionId},actor);expect((await repository.getPublishedSnapshot()).entities.find(item=>item.id===seeded.id)?.calendarSequence).toBe(2);expect(await feed()).toContain('First genuine seeded edit');
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}

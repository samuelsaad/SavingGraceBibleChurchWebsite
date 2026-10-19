import {expect} from 'vitest';
import type {CmsRepository} from '../../src/cms/repository';
import type {CmsAuditActor} from '../../src/cms/model';
import {createCmsFrontendSnapshot} from '../../src/cms/frontend-adapter';
import {calendarSubscription} from '../../src/seo/calendar-subscriptions';
export async function verifyCalendarCmsLifecycle(repository:CmsRepository,actor:CmsAuditActor){
 const payload={id:'anonymous-live-calendar',path:'/events/anonymous-live-calendar/',title:'Anonymous calendar gathering',schedule:{kind:'weekly',weekday:0,from:'2026-10-01',exclusions:['2026-10-11']},start:'10:00',end:'11:00',venue:'anonymous-venue',description:['Anonymous public calendar wording.'],legacyPaths:[],sourceIds:[]};
 let event=await repository.create({key:'event:anonymous-live-calendar',kind:'event',content:payload},actor);
 const feed=async()=>{const snapshot=createCmsFrontendSnapshot(await repository.getPublishedSnapshot());const response=calendarSubscription(new Request('https://www.example.test/events/?ical=1'),{mode:'restricted',basePath:'',siteContent:snapshot})!;expect(response.status).toBe(200);return response.text();};
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
}

import {describe,it,expect} from 'vitest';
import {cmsPreviewSnapshot} from '../src/cms/preview-snapshot';
import type {CmsSnapshot,CmsPublishedDocument} from '../src/cms/model';
const doc=(id:string,kind:CmsPublishedDocument['kind'],path:string,extra={})=>({id,key:id,kind,revisionId:id,content:{path,title:'Anonymous '+id,modules:[{id:'section',enabled:true,block:{kind:'paragraph',text:'Anonymous body'}}],...extra},payload:{}} as CmsPublishedDocument);
describe('bounded private preview snapshot',()=>{
 it('keeps the selected page, rendered venue/event dependency and discovery metadata without unrelated section trees',()=>{
  const selected=doc('selected','venue','/venue/anonymous/'),event=doc('event','event','/event/anonymous/',{venue:'selected'}),other=doc('other','page','/other/',{seo:{noindex:true}}),settings=doc('settings','settings','/');
  const snapshot:CmsSnapshot={entities:[selected,event,other,settings],documents:{},routes:[{path:'/other/',entityId:'other',status:410,targetPath:null}]},before=JSON.stringify(snapshot);
  const result=cmsPreviewSnapshot(snapshot,'selected','/event/anonymous/');
  expect(result.entities[0]).toBe(selected);expect(result.entities[1]).toBe(event);expect(result.entities[3]).toBe(settings);
  expect(result.entities[2]!.content.modules).toEqual([]);expect(result.entities[2]!.content.seo).toEqual({noindex:true});expect(result.routes).toEqual(snapshot.routes);
  expect(JSON.stringify(snapshot)).toBe(before);expect(result.documents.other).toBe(result.entities[2]!.content);
 });
});

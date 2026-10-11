import {describe,it,expect,vi} from 'vitest';
import {cmsDirectoryContent,cmsDirectoryEntity} from '../src/cms/directory';
import {createCmsApiHandler} from '../src/cms/api';
import type {CmsEntity} from '../src/cms/model';
import type {CmsRepository} from '../src/cms/repository';
const original:CmsEntity={id:'90000000-0000-4000-8000-000000000001',key:'page:directory-fixture',kind:'page',rowVersion:3,draftRevisionId:'90000000-0000-4000-8000-000000000002',publishedRevisionId:null,draft:{id:'90000000-0000-4000-8000-000000000002',revisionNumber:2,createdAt:'2026-01-01T00:00:00Z',actor:'anonymous-fixture',sourceRevisionId:null,content:{id:'directory-fixture',title:'Anonymous directory title',path:'/directory-fixture/',status:'draft',modules:[{id:'body',enabled:true,block:{kind:'paragraph',text:'Anonymous saved body must remain available only through the selected entity response.'}}],seo:{title:'Anonymous SEO override'}}},published:null};
describe('protected CMS directory',()=>{
 it('retains identity, publication and revision state without duplicating document bodies',()=>{
  const result=cmsDirectoryEntity(original);expect(result).toMatchObject({id:original.id,rowVersion:3,draftRevisionId:original.draftRevisionId,publishedRevisionId:null,draft:{id:original.draft.id,content:{id:'directory-fixture',title:'Anonymous directory title',path:'/directory-fixture/',status:'draft'}}});
  expect(result.draft.content).not.toHaveProperty('modules');expect(result.draft.content).not.toHaveProperty('seo');expect(original.draft.content).toHaveProperty('modules');
  expect(cmsDirectoryContent({title:'Title',description:'Private body',source:{body:'Private body'},asideModules:[]})).toEqual({title:'Title'});
 });
 it('uses the repository projection and preserves full selected reads under the same authentication gate',async()=>{
  const list=vi.fn(async()=>[original]),listDirectory=vi.fn(async()=>[cmsDirectoryEntity(original)]),get=vi.fn(async()=>original);
  const repo={list,listDirectory,get} as unknown as CmsRepository;
  const api=createCmsApiHandler(repo,{authenticate:async request=>request.headers.get('x-test-admin')==='yes'?{subject:'anonymous-directory-admin',role:'admin'}:null},{authorizeMutation:()=>false});
  const request=(path:string,admin=true)=>new Request('http://127.0.0.1:4999/api/v1/admin/cms/entities'+path,{headers:admin?{'x-test-admin':'yes'}:{}});
  const denied=await api(request('?projection=directory',false));expect(denied!.status).toBe(401);expect(listDirectory).not.toHaveBeenCalled();
  const directory=await api(request('?projection=directory'));expect(directory!.status).toBe(200);expect(directory!.headers.get('cache-control')).toBe('private, no-store');expect(directory!.headers.get('x-robots-tag')).toContain('noindex');expect(await directory!.text()).not.toContain('Anonymous saved body');expect(list).not.toHaveBeenCalled();expect(listDirectory).toHaveBeenCalledOnce();
  const selected=await api(request('/'+original.id));expect(await selected!.json()).toEqual(original);
  await api(request(''));expect(list).toHaveBeenCalledOnce();
  expect((await api(request('?projection=untrusted')))!.status).toBe(400);
 });
});

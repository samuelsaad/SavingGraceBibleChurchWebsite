import {describe,expect,it,vi} from 'vitest';
import {createCmsApiHandler} from '../src/cms/api';
import {validateCmsContent,safeCmsHref} from '../src/cms/validation';
import {buildCmsSeeds} from '../src/cms/seed';
import type {CmsRepository} from '../src/cms/repository';
import type {IdentityProvider} from '../src/server/auth/identity-provider';
const entityId='d1790000-0000-4000-8000-000000000001';
const revisionId='d1790000-0000-4000-8000-000000000002';
const admin:IdentityProvider={authenticate:async()=>({subject:'anonymous-cms-fixture',role:'admin'})};
const anonymous:IdentityProvider={authenticate:async()=>null};
function request(path='',method='GET',value?:unknown,extra:Record<string,string>={}){return new Request(`http://127.0.0.1:4490/api/v1/admin/cms/entities${path}`,{method,headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:4490',...extra},...(value?{body:JSON.stringify(value)}:{})});}
const page={id:'anonymous-page',path:'/anonymous-page/',title:'Anonymous page',description:'Anonymous page fixture',section:'about',modules:[{id:'text-1',enabled:true,block:{kind:'paragraph',text:'Anonymous editable wording.'}}]};
describe('CMS boundary validation',()=>{
 it('validates every migrated website entity without changing wording or section order',()=>{const seeds=buildCmsSeeds();expect(seeds.length).toBeGreaterThan(40);for(const seed of seeds)expect(validateCmsContent(seed.kind,seed.payload)).toEqual(seed.payload);});
 it('rejects unsafe links, traversal, active protocols and reserved sermon routes',()=>{for(const href of ['//evil.example/','javascript:alert(1)','data:text/html,x','/../admin/','/safe\\evil','https://a.example/\nnext','https://user:secret@example.test/'])expect(safeCmsHref(href)).toBe(false);for(const href of ['/about/','https://example.test/','mailto:hello@example.test','tel:+61450545589','#section'])expect(safeCmsHref(href)).toBe(true);expect(()=>validateCmsContent('page',{...page,path:'/sermons/a/'})).toThrow();expect(()=>validateCmsContent('page',{...page,modules:[{id:'a',enabled:true,block:{kind:'paragraph',text:'[Unsafe](javascript:alert)'}}]})).toThrow();});
 it('rejects unknown modules, duplicate module IDs and deeply nested content',()=>{expect(()=>validateCmsContent('page',{...page,modules:[{id:'one',enabled:true,block:{kind:'custom-script',text:'x'}}]})).toThrow();expect(()=>validateCmsContent('page',{...page,modules:[page.modules[0],page.modules[0]]})).toThrow();let block:unknown={kind:'paragraph',text:'x'};for(let n=0;n<20;n++)block={kind:'panel',blocks:[block]};expect(()=>validateCmsContent('page',{...page,modules:[{id:'one',enabled:true,block}]})).toThrow();});
 it('accepts safe formatted wording and preserves source-free new drafts',()=>{expect(validateCmsContent('page',page)).toMatchObject({...page,status:'draft',legacyPaths:[]});});
});
describe('CMS authenticated API',()=>{
 it('rejects duplicate main/aside section identities and duplicate explicit heading anchors',()=>{
  expect(()=>validateCmsContent('page',{...page,asideModules:page.modules})).toThrow('Section identities');
  expect(()=>validateCmsContent('page',{...page,modules:[{id:'one',enabled:true,block:{kind:'heading',id:'same-anchor',level:2,text:'One'}},{id:'two',enabled:true,block:{kind:'heading',id:'same-anchor',level:2,text:'Two'}}]})).toThrow('Heading anchors');
 });
 it('returns a validation error for malformed dates rather than an internal error',async()=>{
  const create=vi.fn(async(input:{kind:'event';content:unknown})=>validateCmsContent(input.kind,input.content));
  const route=createCmsApiHandler({create} as unknown as CmsRepository,admin,{authorizeMutation:()=>true});
  const event={id:'anonymous-event',title:'Anonymous event',path:'/events/anonymous-event/',schedule:{kind:'single',date:'2026-99-99'},start:'10:00',end:'11:00',venue:'anonymous-venue',description:[],legacyPaths:[],sourceIds:[]};
  const response=await route(request('','POST',{key:'event:anonymous-event',kind:'event',content:event}));expect(response?.status).toBe(400);expect(await response?.json()).toMatchObject({error:{code:'invalid_request'}});
 });
 it('rejects a non-admin identity before invoking any repository method',async()=>{
  const list=vi.fn();const provider:IdentityProvider={authenticate:async()=>({subject:'anonymous-reader',role:'viewer' as 'admin'})};
  const route=createCmsApiHandler({list} as unknown as CmsRepository,provider,{authorizeMutation:()=>true});expect((await route(request()))?.status).toBe(403);expect(list).not.toHaveBeenCalled();
 });
 it('permits curated sermon identities but refuses copied sermon content and arbitrary executable component fields',()=>{
  expect(()=>validateCmsContent('page',{...page,modules:[{id:'sermons',enabled:true,block:{kind:'sermon-cards',heading:'Sermons',linkLabel:'All sermons',sermonIds:[entityId]}}]})).not.toThrow();
  expect(()=>validateCmsContent('page',{...page,modules:[{id:'sermons',enabled:true,block:{kind:'sermon-cards',heading:'Sermons',linkLabel:'All sermons',sermonIds:[entityId],transcript:'Untrusted copied content'}}]})).toThrow();
 });
 it('denies unauthenticated reads and routes unrelated asset paths to their owner',async()=>{const repository={list:vi.fn()} as unknown as CmsRepository;const route=createCmsApiHandler(repository,anonymous,{authorizeMutation:()=>true});expect((await route(request()))?.status).toBe(401);expect(repository.list).not.toHaveBeenCalled();expect(await route(new Request('http://127.0.0.1:4490/api/v1/admin/cms/assets'))).toBeNull();});
 it('requires both same-origin and valid CSRF for mutations',async()=>{const save=vi.fn();const repository={save} as unknown as CmsRepository;const route=createCmsApiHandler(repository,admin,{authorizeMutation:()=>false});expect((await route(request('/'+entityId,'PUT',{expectedRowVersion:1,content:page})))?.status).toBe(403);const allowed=createCmsApiHandler(repository,admin,{authorizeMutation:()=>true});expect((await allowed(request('/'+entityId,'PUT',{expectedRowVersion:1,content:page},{Origin:'https://evil.example'})))?.status).toBe(403);expect(save).not.toHaveBeenCalled();});
 it('checks versions and publishes only an explicit selected revision',async()=>{const publish=vi.fn().mockResolvedValue({id:entityId});const route=createCmsApiHandler({publish} as unknown as CmsRepository,admin,{authorizeMutation:()=>true});expect((await route(request('/'+entityId+'/publish','POST',{expectedRowVersion:2})))?.status).toBe(400);const response=await route(request('/'+entityId+'/publish','POST',{expectedRowVersion:2,revisionId}));expect(response?.status).toBe(200);expect(publish).toHaveBeenCalledWith(entityId,{expectedRowVersion:2,revisionId},expect.objectContaining({subject:'anonymous-cms-fixture',role:'admin'}));expect(response?.headers.get('cache-control')).toContain('no-store');expect(response?.headers.get('x-robots-tag')).toContain('noindex');});
 it('rejects content-type confusion and oversized body before repository writes',async()=>{const create=vi.fn();const route=createCmsApiHandler({create} as unknown as CmsRepository,admin,{authorizeMutation:()=>true});expect((await route(request('','POST',{key:'x'},{'Content-Type':'text/plain'})))?.status).toBe(415);expect((await route(request('','POST',{key:'x'},{'Content-Length':'2000001'})))?.status).toBe(413);expect(create).not.toHaveBeenCalled();});
});

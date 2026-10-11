import {describe,expect,it} from 'vitest';
import {sourcePageSchema} from '../src/seo/source-public-model';
import {CompositeSourceSermonRepository} from '../src/seo/composite-sermon-repository';
import {sourceCmsAdoption} from '../src/seo/source-cms-adoption';
import {createCmsFrontendSnapshot} from '../src/cms/frontend-adapter';
import {originalSermonPreview} from '../src/cms/source-sermon-preview';
import type {CmsPublishedDocument} from '../src/cms/model';
import {validateCmsContent} from '../src/cms/validation';
const original=sourcePageSchema.parse({path:'/sermons/anonymous-source/',kind:'sermon',sourceUrl:'https://www.savinggrace.org.au/sermons/anonymous-source/',sourceId:998001,capturedAt:'2026-10-11T00:00:00Z',responseSha256:'a'.repeat(64),title:'Original source metadata title',heading:'Original anonymous heading',description:'Original source metadata',indexable:true,canonicalSource:null,publishedAt:'2000-01-01T00:00:00Z',modifiedAt:null,content:[{tag:'p',text:'Original anonymous source body'}],sermon:{id:'11111111-1111-4111-8111-111111111111',slug:'anonymous-source',title:'Original anonymous heading',serviceDate:'2000-01-01',summary:null,speaker:null,series:[],books:[],scriptureReferences:[],primaryPassages:[],primaryPassageState:'unresolved',primaryMedia:null,media:[],seoDescription:null,body:null,transcript:null,questionAnswers:[],relatedSermons:[]}});
function document():CmsPublishedDocument{const seed=sourceCmsAdoption([original],[],[]).seeds[0]!;return {id:'22222222-2222-4222-8222-222222222222',key:seed.key,kind:seed.kind,revisionId:'33333333-3333-4333-8333-333333333333',content:seed.payload as Record<string,unknown>,payload:seed.payload as Record<string,unknown>};}
describe('independent original sermon CMS',()=>{
 it('keeps original identity, dates and empty enrichment independent of published CMS wording',async()=>{
  const doc=document();doc.content.heading='Explicit original-page edit';doc.content.modules=[{id:'original-content',enabled:true,block:{kind:'source-content',nodes:[{tag:'p',text:'Explicit published original body'}]}}];
  const repository=await CompositeSourceSermonRepository.create([original],[],async()=>null,false,undefined,[doc]);const sermon=await repository.findPublishedBySlug('anonymous-source');
  expect(sermon?.id).toBe(original.sermon!.id);expect(sermon?.title).toBe('Explicit original-page edit');expect(sermon?.serviceDate).toBe('2000-01-01');expect(sermon?.summary).toBeNull();expect(sermon?.transcript).toBeNull();expect(sermon?.questionAnswers).toEqual([]);expect(sermon?.sourcePublic?.content[0]?.text).toBe('Explicit published original body');
 });
 it('preserves source removals and flattens source path changes without creating ordinary sermon pages',async()=>{
  const doc=document();doc.content.path='/sermons/renamed-anonymous/';const repository=await CompositeSourceSermonRepository.create([original],[],async()=>null,false,undefined,[doc]);
  expect(await repository.findPublicPathDisposition(original.path)).toEqual({kind:'redirect',location:'/sermons/renamed-anonymous/'});expect(repository.verifiedSourceShortlinks()['998001']).toBe('/sermons/renamed-anonymous/');
  const removed=await CompositeSourceSermonRepository.create([],[],async()=>({kind:'gone'}),false,undefined,[doc]);expect((await removed.listPublishedSitemapEntries()).length).toBe(0);
  expect(createCmsFrontendSnapshot({entities:[doc],documents:{},routes:[]}).pages).toEqual([]);
 });
 it('supports private preview and exact encoded Arabic paths without permitting arbitrary reserved pages',async()=>{
  const doc=document();const snapshot=createCmsFrontendSnapshot({entities:[doc],documents:{},routes:[]},[],true,true);const response=await originalSermonPreview(doc,[original],{mode:'preview',basePath:'/cms-preview',siteContent:snapshot,visualEditor:{entityId:doc.id,kind:'page'}},snapshot.pages[0]!.blocks);const body=await response.text();expect(body).toContain('Original anonymous source body');expect(body).toContain('data-cms-path');expect(body).toContain('noindex');expect(body).not.toContain('rel="canonical"');
  const arabic='/sermons/%d8%af%d8%b9%d9%88%d8%a9/';expect(()=>validateCmsContent('page',{...doc.content,path:arabic})).not.toThrow();expect(()=>validateCmsContent('page',{...doc.content,path:arabic,template:undefined})).toThrow();
 });
});

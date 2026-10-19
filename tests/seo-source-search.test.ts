import {describe,it,expect} from 'vitest';
import {createLegacySourceSearch} from '../src/seo/source-search';
import {sourcePageSchema} from '../src/seo/source-public-model';
import {defaultSiteSettings} from '../src/frontend/content/site-snapshot';
const source=(path:string,text:string)=>sourcePageSchema.parse({path,kind:'page',sourceUrl:'https://www.savinggrace.org.au'+path,sourceId:1,capturedAt:'2026-01-01T00:00:00Z',responseSha256:'a'.repeat(64),title:'Anonymous original site',heading:'Public page',description:null,indexable:true,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[{tag:'p',text}],sermon:null});
const snapshot={pages:[],posts:[],events:[],venues:{},home:null,settings:defaultSiteSettings,assets:{},routes:[]};
const sermons={listPublished:async()=>({data:[],totalItems:0})} as never;
const context={mode:'public' as const,basePath:'' as const,seo:{canonicalOrigin:'https://www.savinggrace.org.au',indexable:true}};
describe('legacy public keyword search',()=>{
 it('does not build a search corpus for unrelated or invalid requests, while valid results stay server rendered',async()=>{let reads=0;const p=source('/anonymous/','Visible keyword.');Object.defineProperty(p,'content',{get(){reads++;return [{tag:'p',text:'Visible keyword.'}];}});const handler=createLegacySourceSearch([p],snapshot,sermons,{});expect(reads).toBe(0);expect(await handler(new Request('https://www.savinggrace.org.au/about/'),context)).toBeNull();expect((await handler(new Request('https://www.savinggrace.org.au/?s='+ 'x'.repeat(121)),context))?.status).toBe(404);expect(reads).toBe(0);expect(await(await handler(new Request('https://www.savinggrace.org.au/?s=keyword'),context))!.text()).toContain('href="/anonymous/"');expect(reads).toBeGreaterThan(0);});
 it('serves real SSR keyword results with original noindex policy and no draft content',async()=>{
  const draft={id:'draft',path:'/draft/',title:'PRIVATE_DRAFT',status:'draft' as const,section:'about' as const,description:'',legacyPaths:[],source:{id:2,link:'https://www.savinggrace.org.au/draft/',status:'draft',modified:'2020-01-01'},blocks:[{type:'prose',paragraphs:['PRIVATE_DRAFT']}]} as never;
  const handler=createLegacySourceSearch([source('/public/','Public church information.')],{...snapshot,pages:[draft]},sermons,{});
  const response=await handler(new Request('https://www.savinggrace.org.au/?s=church'),context);const document=await response!.text();
  expect(response?.status).toBe(200);expect(document).toContain('href="/public/"');expect(document).toContain('noindex, follow');expect(document).not.toContain('rel="canonical"');expect(document).not.toContain('PRIVATE_DRAFT');
 });
 it('retains real pagination links and rejects invalid result pages',async()=>{
  const handler=createLegacySourceSearch(Array.from({length:21},(_,i)=>source('/public-'+i+'/','Shared keyword.')),snapshot,sermons,{});
  const first=await(await handler(new Request('https://www.savinggrace.org.au/?s=keyword'),context))!.text();expect(first).toContain('s=keyword&amp;paged=2');
  expect((await handler(new Request('https://www.savinggrace.org.au/?s=keyword&paged=3'),context))?.status).toBe(404);
 });
 it('excludes explicit withdrawals and preserves UTF8 query text safely',async()=>{
  const original=source('/removed/','Shared keyword.');const handler=createLegacySourceSearch([original],{...snapshot,routes:[{path:'/removed/',entityId:'1',status:410,targetPath:null}]},sermons,{});
  const document=await(await handler(new Request('https://www.savinggrace.org.au/?s=keyword'),context))!.text();expect(document).not.toContain('href="/removed/"');
  expect(await(await handler(new Request('https://www.savinggrace.org.au/?s=%D8%A5%D9%8A%D9%85%D8%A7%D9%86'),context))!.text()).toContain('إيمان');
  expect((await handler(new Request('https://www.savinggrace.org.au/?s=one&s=two'),context))?.status).toBe(404);
 });
});

import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSourcePublicAssetHandler} from '../src/seo/source-public-assets';
import {sourcePageSchema,sha256} from '../src/seo/source-public-model';
import {pageStructuredData} from '../src/frontend/structured-data';
import {preserveSourceMetadata} from '../src/seo/source-metadata';
import {createCmsFrontendSnapshot} from '../src/cms/frontend-adapter';
import {renderChurchPage} from '../src/frontend/pages/church';
import {renderSermonsV5Page,emptyFilterOptions} from '../src/frontend';
import {publicRenderContext} from '../src/frontend/routes';
import {publicSermonListQuerySchema} from '../src/api/contracts/public-sermons';
import type {SitePage} from '../src/frontend/content/types';

const syntheticCmsPage:SitePage={id:'anonymous-metadata',path:'/anonymous-metadata/',title:'Visible CMS heading',status:'published',section:'about',description:'Seeded CMS description must not invent missing source metadata.',legacyPaths:[],source:{id:1,link:'https://www.savinggrace.org.au/anonymous-metadata/',status:'publish',modified:'2020-01-01'},blocks:[]};
const syntheticSource=(path:string,kind:'page'|'archive'='page')=>sourcePageSchema.parse({path,kind,sourceUrl:'https://www.savinggrace.org.au'+path,sourceId:null,capturedAt:'2026-10-09T00:00:00Z',responseSha256:'b'.repeat(64),title:'Exact anonymous source title',heading:'Visible source heading',description:null,indexable:true,canonicalSource:'https://www.savinggrace.org.au'+path,publishedAt:null,modifiedAt:null,content:[],sermon:null});
const churchData={today:'2026-10-09',sermons:[],options:emptyFilterOptions};

describe('source asset identity and structured facts',()=>{
 it('serves only verified current bytes, handles HEAD, and refuses corrupt or missing assets',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'seo-asset-'));
  try{
   const bytes=Buffer.from('%PDF-1.7\nAnonymous fixture\n%%EOF'),hash=sha256(bytes),key=hash+'.pdf';
   await mkdir(join(directory,'source-public'));await writeFile(join(directory,'source-public',key),bytes);
   const source=sourcePageSchema.parse({path:'/wp-content/uploads/anonymous.pdf',kind:'asset',sourceUrl:'https://www.savinggrace.org.au/wp-content/uploads/anonymous.pdf',sourceId:null,capturedAt:'2026-10-09T00:00:00Z',responseSha256:hash,title:'Anonymous PDF',heading:'Anonymous PDF',description:null,indexable:false,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[],sermon:null,asset:{storageKey:key,sha256:hash,contentType:'application/pdf',bytes:bytes.length}});
   const handler=createSourcePublicAssetHandler([source],directory),url=source.sourceUrl;
   const response=await handler(new Request(url));expect(response?.status).toBe(200);expect(response?.headers.get('Content-Type')).toBe('application/pdf');expect(Buffer.from(await response!.arrayBuffer())).toEqual(bytes);
   expect(await (await handler(new Request(url,{method:'HEAD'})))!.text()).toBe('');
   expect(await handler(new Request(url+'-missing'))).toBeNull();
   await writeFile(join(directory,'source-public',key),'Corrupt');expect((await handler(new Request(url)))?.status).toBe(503);await writeFile(join(directory,'source-public',key),Buffer.alloc(bytes.length,0));await expect(handler(new Request(url))).rejects.toThrow('source_asset_integrity');
   await rm(join(directory,'source-public',key));expect((await handler(new Request(url)))?.status).toBe(503);
   expect(()=>sourcePageSchema.parse({...source,asset:{...source.asset,contentType:'text/html'}})).toThrow();
  }finally{await rm(directory,{recursive:true,force:true});}
 });
 it('escapes executable-looking text and includes only supplied real dates and breadcrumb identities',()=>{
  const value=String(pageStructuredData('https://www.savinggrace.org.au/example/','Example </script><script>bad</script>','Description',{language:'ar',publishedAt:'2004-01-01T00:00:00Z',modifiedAt:'invalid',breadcrumbs:[{name:'Archive',path:'/sermons/'},{name:'Example',path:'/example/'}]}));
  expect(value.match(/<script/g)).toHaveLength(1);const data=JSON.parse(value.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,''));
  expect(data[0]).toMatchObject({'@type':'WebPage',inLanguage:'ar',datePublished:'2004-01-01T00:00:00Z'});expect(data[0]).not.toHaveProperty('dateModified');expect(data[1].itemListElement[1].item).toBe('https://www.savinggrace.org.au/example/');expect(value).not.toContain('FAQPage');expect(value).not.toContain('VideoObject');
 });
 it('omits an absent captured description even when the CMS seed has a description',()=>{
  const snapshot=createCmsFrontendSnapshot({entities:[],documents:{},routes:[]});snapshot.pages=[structuredClone(syntheticCmsPage)];
  const content=preserveSourceMetadata(snapshot,[syntheticSource(syntheticCmsPage.path)]);
  const document=renderChurchPage(content.pages[0]!,churchData,{...publicRenderContext,siteContent:content});
  expect(content.pages[0]!.description).toBe(syntheticCmsPage.description);
  expect(content.pages[0]!.seo?.description).toBe('');
  expect(document).not.toContain('name="description"');expect(document).not.toContain('property="og:description"');expect(document).not.toContain('name="twitter:description"');
  expect(document).toContain('<title>Exact anonymous source title</title>');
  expect(snapshot.pages[0]).not.toHaveProperty('seo');
 });
 it('uses the captured archive title verbatim through sourceSeoByPath',()=>{
  const content=preserveSourceMetadata(createCmsFrontendSnapshot({entities:[],documents:{},routes:[]}),[syntheticSource('/sermons/','archive')]);
  expect(content.pages).toHaveLength(0);expect(content.sourceSeoByPath?.['/sermons/']?.title).toBe('Exact anonymous source title');
  const document=renderSermonsV5Page({sermons:[],totalItems:0,query:publicSermonListQuerySchema.parse({}),options:emptyFilterOptions,topicalSermons:[],seriesRepresentatives:[],hasQueryParameters:false},{...publicRenderContext,siteContent:content},{canonical:true});
  expect(document).toContain('<title>Exact anonymous source title</title>');expect(document).not.toContain('name="description"');
  expect(document).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/"');
 });
 it('keeps explicit versioned CMS metadata above captured source defaults',()=>{
  const snapshot=createCmsFrontendSnapshot({entities:[],documents:{},routes:[]});snapshot.pages=[{...structuredClone(syntheticCmsPage),seo:{title:'Explicit editorial title',description:'Explicit editorial description'}}];
  const content=preserveSourceMetadata(snapshot,[syntheticSource(syntheticCmsPage.path)]);
  expect(content.sourceSeoByPath?.[syntheticCmsPage.path]?.title).toBe('Exact anonymous source title');
  const document=renderChurchPage(content.pages[0]!,churchData,{...publicRenderContext,siteContent:content});
  expect(document).toContain('<title>Explicit editorial title</title>');expect(document).toContain('name="description" content="Explicit editorial description"');expect(document).not.toContain('<title>Exact anonymous source title</title>');
  expect(snapshot.pages[0]!.seo).toEqual({title:'Explicit editorial title',description:'Explicit editorial description'});
 });
});

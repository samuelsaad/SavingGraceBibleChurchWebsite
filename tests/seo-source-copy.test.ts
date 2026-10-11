import {describe,it,expect} from 'vitest';
import {html} from '../src/frontend/html';
import {retainedSourceCopy} from '../src/frontend/source-copy';
import {preserveSourceMetadata} from '../src/seo/source-metadata';
import {defaultSiteSettings} from '../src/frontend/content/site-snapshot';
import {pageShell} from '../src/frontend/shell';
import {extractSourceStructuredData} from '../src/seo/source-structured-data';
import {createSourcePublicPageHandler} from '../src/seo/source-public-handler';
import {pageStructuredData} from '../src/frontend/structured-data';
import type {SourcePublicPage} from '../src/seo/source-public-model';
import {renderSourceContent} from '../src/frontend/source-content';
import {sourceNodeSchema} from '../src/domain/source-content';
import {simplifySourceNodes} from '../src/seo/source-cms-adoption';
const source:SourcePublicPage={path:'/original/',kind:'page',sourceUrl:'https://www.savinggrace.org.au/original/',sourceId:1,capturedAt:'2026-01-01T00:00:00Z',responseSha256:'a'.repeat(64),title:'Original title',heading:'Original heading',description:'Original description',language:'en-AU',indexable:true,canonicalSource:null,publishedAt:'2020-01-01T00:00:00Z',modifiedAt:'2021-01-01T00:00:00Z',content:[{tag:'p',children:[{tag:'text',text:'Existing paragraph.'}]},{tag:'p',children:[{tag:'text',text:'Missing paragraph with '},{tag:'a',href:'/legacy/',children:[{tag:'text',text:'a resource'}]}]}],links:[],mediaReferences:[],passageTerms:[],sermon:null,issues:[]};
const snapshot={pages:[],posts:[],events:[],venues:{},home:null,settings:defaultSiteSettings,assets:{},routes:[{path:'/original/',entityId:'page',status:301 as const,targetPath:'/replacement/'},{path:'/replacement/',entityId:'page',status:200 as const,targetPath:null},{path:'/legacy/',entityId:'resource',status:301 as const,targetPath:'/resource/'},{path:'/resource/',entityId:'resource',status:200 as const,targetPath:null}]};
describe('verified original copy preservation',()=>{
 it('retains fragment targets, language direction and table cell spans through rendering and adoption',()=>{
  const nodes=[sourceNodeSchema.parse({tag:'div',id:'source-section',lang:'ar',dir:'rtl',children:[{tag:'a',href:'/original/#source-section',text:'Source link'},{tag:'table',children:[{tag:'tr',children:[{tag:'td',colspan:2,rowspan:3,title:'Source "caption"',text:'Cell'}]}]}]})];
  const rendered=renderSourceContent(simplifySourceNodes(nodes)).toString();expect(rendered).toContain('id="source-section" lang="ar" dir="rtl"');expect(rendered).toContain('href="/original/#source-section"');expect(rendered).toContain('colspan="2" rowspan="3"');expect(rendered).toContain('title="Source &quot;caption&quot;"');
  expect(sourceNodeSchema.safeParse({tag:'p',onclick:'alert(1)'}).success).toBe(false);expect(sourceNodeSchema.safeParse({tag:'td',colspan:-1}).success).toBe(false);
 });
 it('retains an original anchor even when its visible wording is already present',()=>{
  const content=preserveSourceMetadata(snapshot,[{...source,content:[{tag:'span',id:'original-anchor'}]}]);const output=retainedSourceCopy(html`<p>Existing paragraph.</p>`,'/replacement/',false,{mode:'public',basePath:'',siteContent:content}).toString();expect(output).toContain('id="original-anchor"');
 });
 it('preserves a real original heading while allowing subsequent CMS heading and title edits',()=>{
  const original={...source,path:'/replacement/',sourceUrl:'https://www.savinggrace.org.au/replacement/',hasOriginalHeading:true};
  const content=preserveSourceMetadata({...snapshot,initialMetadataByPath:{'/replacement/':{title:'Seed title',heading:'Seed heading',seeded:true}}},[original]);
  const context={mode:'public' as const,basePath:'' as const,siteContent:content};
  const initial=pageShell({title:'Seed title',canonicalPath:'/replacement/',robots:'index, follow',body:html`<h1>Seed heading</h1>`},context);expect(initial).toContain('<h1>Original heading</h1>');expect(initial).toContain('<title>Original title</title>');
  const edited=pageShell({title:'Edited title',canonicalPath:'/replacement/',robots:'index, follow',body:html`<h1>Edited heading</h1>`},context);expect(edited).toContain('<h1>Edited heading</h1>');expect(edited).toContain('<title>Edited title — Saving Grace Bible Church</title>');
 });
 it('serves only exact observed archive queries and keeps them excluded from indexing',async()=>{
  const original={...source,path:'/events/?tribe-bar-date=2026-01-01',sourceUrl:'https://www.savinggrace.org.au/events/?tribe-bar-date=2026-01-01',kind:'archive' as const,indexable:false};
  const handler=createSourcePublicPageHandler([original],true),context={mode:'public' as const,basePath:'' as const};
  const response=await handler(new Request(original.sourceUrl),context);expect(response?.status).toBe(200);expect(await response!.text()).toContain('noindex, follow');
  expect(await handler(new Request('https://www.savinggrace.org.au/events/?tribe-bar-date=2027-01-01'),context)).toBeNull();
 });
 it('retains lost original paragraphs and their final links without replacing the selected layout',()=>{
  const content=preserveSourceMetadata(snapshot,[source]),context={mode:'public' as const,basePath:'' as const,siteContent:content};
  const output=retainedSourceCopy(html`<article class="selected"><p>Existing paragraph.</p></article>`,'/replacement/',false,context).toString();
  expect(output).toContain('class="selected"');expect(output.match(/Existing paragraph/g)).toHaveLength(1);expect(output).toContain('Missing paragraph');expect(output).toContain('href="/resource/"');
  expect(retainedSourceCopy(html`<p>Edited copy.</p>`,'/replacement/',true,context).toString()).toBe('<p>Edited copy.</p>');
 });
 it('retains native non-sermon archive descriptions, links and dates without adding old sermon card layouts',()=>{
  const eventArchive={...source,kind:'archive' as const,path:'/events/',sourceUrl:'https://www.savinggrace.org.au/events/'};
  const sermonArchive={...source,kind:'archive' as const,path:'/sermons/',sourceUrl:'https://www.savinggrace.org.au/sermons/'};
  const content=preserveSourceMetadata({...snapshot,routes:[{path:'/events/',entityId:'events',status:200 as const,targetPath:null}]},[eventArchive,sermonArchive]);
  const context={mode:'public' as const,basePath:'' as const,siteContent:content};
  const document=pageShell({title:'Events',canonicalPath:'/events/',robots:'index, follow',body:html`<h1>Events</h1><p>Existing paragraph.</p>`},context);
  expect(document).toContain('Missing paragraph with');expect(document).toContain('href="/legacy/"');expect(document).toContain('2020-01-01T00:00:00Z');expect(content.sourceContentByPath?.['/sermons/']).toBeUndefined();
 });
 it('does not append the base calendar or override a dated fallback title when canonical policy points to the collection',async()=>{
  const base={...source,path:'/events/',kind:'archive' as const,title:'Base calendar title',content:[{tag:'p' as const,text:'Base month only.'}]};
  const dated={...source,path:'/events/2027-12/',sourceUrl:'https://www.savinggrace.org.au/events/2027-12/',kind:'archive' as const,title:'Exact dated calendar title',heading:'December 2027',content:[{tag:'p' as const,text:'Dated month only.'}]};
  const content=preserveSourceMetadata({...snapshot,initialMetadataByPath:{'/events/':{title:'Events',heading:'Events',seeded:true}}},[base,dated]);
  const response=await createSourcePublicPageHandler([base,dated])(new Request(dated.sourceUrl),{mode:'public',basePath:'',siteContent:content});
  const document=await response!.text();expect(document).toContain('<title>Exact dated calendar title</title>');expect(document).toContain('Dated month only.');expect(document).not.toContain('Base month only.');
 });
 it('never resurrects explicit gone content or exposes source text in an unrelated route',()=>{
  const content=preserveSourceMetadata({...snapshot,routes:[{path:'/original/',entityId:'page',status:410 as const,targetPath:null}]},[source]);
  expect(content.sourceContentByPath).toEqual({});expect(retainedSourceCopy(html`<p>Other</p>`,'/unrelated/',false,{mode:'public',basePath:'',siteContent:content}).toString()).toBe('<p>Other</p>');
 });
 it('deduplicates identical retained source blocks without inventing a venue redirect',()=>{
  const venue={...source,path:'/venue/anonymous-venue/',sourceUrl:'https://www.savinggrace.org.au/venue/anonymous-venue/'};
  const content=preserveSourceMetadata({...snapshot,routes:[]},[venue,structuredClone(venue)]);
  expect(content.sourceContentByPath?.[venue.path]).toHaveLength(2);
  const output=retainedSourceCopy(html`<p>Existing paragraph.</p>`,venue.path,false,{mode:'public',basePath:'',siteContent:content}).toString();expect(output.match(/Missing paragraph/g)).toHaveLength(1);
 });
 it('keeps original dates and absent metadata instead of assigning import time',()=>{
  const content=preserveSourceMetadata(snapshot,[{...source,description:null}]);const output=pageShell({title:'Edited title',canonicalPath:'/replacement/',robots:'index, follow',body:html`<h1>Edited title</h1>`},{mode:'public',basePath:'',siteContent:content});
  expect(output).toContain('2020-01-01T00:00:00Z');expect(output).toContain('2021-01-01T00:00:00Z');expect(output).not.toContain('name="description"');expect(output).toContain('<title>Original title</title>');
 });
 it('accepts only one exact, visibly grounded primary event and excludes related or fabricated properties',()=>{
  const capture={url:'https://www.savinggrace.org.au/event/example/2026-01-04/',primaryHeading:'Example gathering',template:'event',bodySha256:'a'.repeat(64),contentTree:[{tag:'p',text:'January 4 2026 10:30 am 12:30 pm'}],schema:[{'@type':'Event',url:'https://www.savinggrace.org.au/event/example/2026-01-04/',name:'Example gathering',startDate:'2026-01-04T10:30:00+11:00',endDate:'2026-01-04T12:30:00+11:00',aggregateRating:{ratingValue:5},performer:{name:'Unverified'}}]};
  const data=extractSourceStructuredData(capture).value;expect(data?.primary?.type).toBe('Event');const output=pageStructuredData(capture.url,capture.primaryHeading,'',{primary:data!.primary}).toString();expect(output).toContain('"@type":"Event"');expect(output).not.toContain('aggregateRating');expect(output).not.toContain('Unverified');
  expect(extractSourceStructuredData({...capture,schema:[{...capture.schema[0],startDate:'2026-01-05T10:30:00+11:00'}]}).value?.primary).toBeUndefined();
 });
});

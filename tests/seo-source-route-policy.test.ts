import {describe,expect,it} from 'vitest';
import {sourcePresentationPolicy} from '../src/seo/source-route-policy';
import {createSourcePublicPageHandler,sourcePublicSitemap} from '../src/seo/source-public-handler';
import type {SourcePublicPage} from '../src/seo/source-public-model';
import {publicRenderContext} from '../src/frontend/routes';
import {defaultSiteSettings} from '../src/frontend/content/site-snapshot';
const origin='https://www.savinggrace.org.au';
function page(path:string,override:Partial<SourcePublicPage>={}):SourcePublicPage{return {path,kind:'archive',sourceUrl:origin+path,sourceId:null,capturedAt:'2026-10-09T00:00:00Z',responseSha256:'a'.repeat(64),title:'Anonymous source document',heading:'Anonymous archive',description:'Original description.',language:'en',indexable:true,canonicalSource:origin+path,publishedAt:null,modifiedAt:null,content:[{tag:'p',text:'Anonymous original content.'}],passageTerms:[],links:[],mediaReferences:[],sermon:null,issues:[],...override};}
describe('bounded captured archive canonical corrections',()=>{
 it('keeps distinct pagination self-canonical and retains captured noindex',()=>{
  const base=page('/venue/example/'),next=page('/venue/example/page/2/',{canonicalSource:origin+base.path,indexable:false});
  const policy=sourcePresentationPolicy([base,next]);expect(policy(next)).toEqual({canonicalPath:next.path,indexable:false,reason:'distinct_pagination'});
  expect(sourcePublicSitemap([base,next]).map(p=>p.path)).toEqual([base.path]);
 });
 it('noindexes only recognized calendar derivatives with verified existing collection bases',()=>{
  const base=page('/events/category/example/');
  const paths=['/events/category/example/month/','/events/category/example/list/2026-10-10/','/events/category/example/2026-10/'];
  const pages=paths.map(path=>page(path)),policy=sourcePresentationPolicy([base,...pages]);
  for(const entry of pages)expect(policy(entry)).toEqual({canonicalPath:base.path,indexable:false,reason:'calendar_navigation'});
  const unknown=page('/events/category/absent/day/');expect(policy(unknown)).toEqual({canonicalPath:unknown.path,indexable:true,reason:'distinct_source_archive'});
  const unrelated=page('/events/category/example/annual/');expect(policy(unrelated)).toEqual({canonicalPath:unrelated.path,indexable:true,reason:'source_self'});
 });
 it('retains meaningful distinct captured calendar archives and their original noindex decisions',()=>{
  const base=page('/events/'),distinct=page('/events/month/2023-09/',{content:[{tag:'p',text:'A different historical event collection.'}]}),privateArchive=page('/events/month/2023-08/',{indexable:false});
  const policy=sourcePresentationPolicy([base,distinct,privateArchive]);expect(policy(distinct)).toEqual({canonicalPath:distinct.path,indexable:true,reason:'distinct_source_archive'});expect(policy(privateArchive).indexable).toBe(false);expect(sourcePublicSitemap([base,distinct,privateArchive]).map(p=>p.path)).toEqual([base.path,distinct.path]);
 });
 it('preserves distinct event-tag and all-occurrence collections rather than unrelated source canonicals',()=>{
  const blog=page('/tag/example/'),eventTag=page('/events/tag/example/',{canonicalSource:origin+blog.path,content:[{tag:'p',text:'Different event collection.'}]}),instance=page('/event/example/2026-01-01/',{kind:'event'}),all=page('/event/example/all/',{canonicalSource:origin+instance.path});
  const policy=sourcePresentationPolicy([blog,eventTag,instance,all]);
  for(const entry of [eventTag,all])expect(policy(entry)).toEqual({canonicalPath:entry.path,indexable:true,reason:'distinct_source_archive'});
 });
 it('keeps a different canonical only for verified identical nonempty source archives',()=>{
  const target=page('/equivalent/'),alias=page('/same-content/',{canonicalSource:origin+target.path}),outside=page('/external/',{canonicalSource:'https://outside.test/equivalent/'});
  const policy=sourcePresentationPolicy([target,alias,outside]);expect(policy(alias).canonicalPath).toBe(target.path);expect(policy(outside).canonicalPath).toBe(outside.path);
  const missing=page('/missing-target/',{canonicalSource:origin+'/absent/'});expect(policy(missing).canonicalPath).toBe(missing.path);
  const empty=page('/empty/',{content:[]}),emptyAlias=page('/empty-alias/',{content:[],canonicalSource:origin+empty.path});expect(sourcePresentationPolicy([empty,emptyAlias])(emptyAlias).canonicalPath).toBe(emptyAlias.path);
 });
 it('resolves calendar bases through current CMS disposition without canonicalizing to a tombstone',()=>{
  const base=page('/events/tag/example/'),calendar=page('/events/tag/example/month/'),target=page('/event-collection/');
  const content={pages:[],posts:[],events:[],venues:{},home:null,settings:structuredClone(defaultSiteSettings),assets:{},routes:[{path:base.path,entityId:'x',status:301 as const,targetPath:target.path},{path:target.path,entityId:'x',status:200 as const,targetPath:null}]};
  expect(sourcePresentationPolicy([base,calendar,target],{...publicRenderContext,siteContent:content})(calendar).canonicalPath).toBe(target.path);
  const gone={...content,routes:[{path:base.path,entityId:'x',status:410 as const,targetPath:null}]};expect(sourcePresentationPolicy([base,calendar],{...publicRenderContext,siteContent:gone})(calendar).canonicalPath).toBe(calendar.path);
 });
 it('renders the original page metadata and content with bounded canonical/noindex and excludes only derivatives from sitemap',async()=>{
  const base=page('/events/'),calendar=page('/events/month/',{title:'Original calendar title',description:'Original calendar description.'}),handler=createSourcePublicPageHandler([base,calendar]);
  const response=await handler(new Request(origin+calendar.path),publicRenderContext),html=await response!.text();
  expect(html).toContain('<title>Original calendar title</title>');expect(html).toContain('Original calendar description.');expect(html).toContain('Anonymous original content.');
  expect(html).toContain('name="robots" content="noindex, follow"');expect(html).toContain('rel="canonical" href="'+origin+base.path+'"');expect(sourcePublicSitemap([base,calendar]).map(p=>p.path)).toEqual([base.path]);
 });
});

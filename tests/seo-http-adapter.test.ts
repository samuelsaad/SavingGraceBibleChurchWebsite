import { describe, expect, it } from "vitest";
import {defaultSiteSettings} from "../src/frontend/content/site-snapshot";
import { createSeoHttpAdapter,legacySitemapPaths } from "../src/seo/http-adapter";
import { createSeoHttpPolicy } from "../src/seo/http-policy";
import { renderSeoSitemap } from "../src/seo/http-sitemap";
import { createPublicSermonSiteHandler } from "../src/server/http/public-sermon-page";
import { publicRenderContext, restrictedRenderContext } from "../src/frontend/routes";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";
import type { SermonDetail } from "../src/domain/sermon";
const origin="https://www.example.test";
const sermon:SermonDetail={id:"00000000-0000-4000-8000-000000000001",title:"Anonymous teaching",slug:"anonymous-teaching",serviceDate:"2026-01-01",summary:"Anonymous approved visible wording.",speaker:null,series:[],books:[],scriptureReferences:[],primaryPassages:[],primaryPassageState:"none",primaryMedia:null,seoDescription:null,body:null,media:[],transcript:null,questionAnswers:[],relatedSermons:[]};
const unicode="%d9%85%d8%ab%d8%a7%d9%84";
function repository():PublicSermonRepository{return {
  async listPublished(){return {data:[sermon],totalItems:10};},
  async findPublishedBySlug(slug){return slug===sermon.slug?sermon:slug===unicode?{...sermon,slug:unicode}:null;},
  async listPublishedFilterOptions(){return {speakers:[],series:[],books:[],passages:[],passageVerseAvailability:[]};},
  async listPublishedTopicalSermons(){return [];},async listPublishedSeriesRepresentatives(){return [];},
  async listPublishedSitemapEntries(){return [{slug:sermon.slug,lastModified:"2026-01-01"},{slug:unicode,lastModified:"2026-01-02"}];},
  async findPublicPathDisposition(path){return path==="/sermons/old-title/"?{kind:"redirect",location:"/sermons/anonymous-teaching/"}:path==="/sermons/removed/"?{kind:"gone"}:null;}
};}
const production=()=>createSeoHttpAdapter({policy:{environment:"production",canonicalOrigin:origin,redirectOrigins:["http://example.test","https://example.test","http://www.example.test"]},sermons:repository()});
describe("explicit production SEO adapter",()=>{
  it("refuses unsafe canonical origins and accidental production rehearsal origins",()=>{
    for(const canonicalOrigin of ["http://example.test","https://user:secret@example.test","https://example.test/path","https://example.test/?x=1","https://127.0.0.1","https://localhost"]) expect(()=>createSeoHttpPolicy({environment:"production",canonicalOrigin})).toThrow();
    expect(()=>createSeoHttpPolicy({environment:"production",canonicalOrigin:origin,rehearsalOrigins:["http://127.0.0.1:4450"]})).toThrow();
    expect(()=>createSeoHttpPolicy({environment:"staging",canonicalOrigin:origin})).toThrow();
  });
  it("serves canonical V5 and refuses unrecognized origins despite forwarded headers",async()=>{
    const route=production(),response=await route(new Request(origin+"/sermons/"));
    const html=await response.text();expect(response.status).toBe(200);expect(html).toContain('class="v5"');expect(html).toContain('href="'+origin+'/sermons/"');expect(html).toContain('name="robots" content="index, follow"');
    const refused=await route(new Request("https://untrusted.test/sermons/",{headers:{"x-forwarded-host":"www.example.test","x-forwarded-proto":"https"}}));expect(refused.status).toBe(421);expect(refused.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("never serves the homepage or calendar as a successful unsupported legacy query or export",async()=>{
    const route=production();
    for(const path of ['/?post_type=tribe_events&eventDisplay=day&paged=2','/?s=anonymous','/events/?ical=1','/events/?related_series=42']){
      const response=await route(new Request(origin+path));expect(response.status).toBe(404);expect(response.headers.get('X-Robots-Tag')).toContain('noindex');expect(await response.text()).not.toContain('rel="canonical"');
    }
    expect((await route(new Request(origin+'/?utm_source=church%20email'))).status).toBe(200);
    const captured=createSeoHttpAdapter({policy:{environment:'production',canonicalOrigin:origin},sermons:repository(),sourceQueryPage:async request=>new URL(request.url).search==='?related_series=42'?new Response('Anonymous captured archive'):null,publicAsset:async request=>new URL(request.url).search==='?ical=1'?new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR',{headers:{'Content-Type':'text/calendar'}}):null});
    expect(await(await captured(new Request(origin+'/events/?related_series=42'))).text()).toBe('Anonymous captured archive');
    expect((await captured(new Request(origin+'/events/?ical=1'))).headers.get('Content-Type')).toBe('text/calendar');
  });
  it("collapses host, slash, pagination and old-slug redirects to one final target",async()=>{
    const route=production();
    for(const [path,target] of [["/sermons/page/01?s=test","/sermons/?s=test"],["/sermons/page/02?s=test","/sermons/page/2/?s=test"],["/sermons/old-title?order=ASC","/sermons/anonymous-teaching/?order=ASC"],["/sermons-v5/page/02?sermon_book=romans","/sermons/page/2/?sermon_book=romans"],["/pages/lordsdayservice?x=1","/lords-day-service/?x=1"]]){
      const response=await route(new Request("http://example.test"+path));expect(response.status,path).toBe(301);expect(response.headers.get("location"),path).toBe(origin+target);
    }
  });
  it("preserves observed leading-only taxonomy slashes and campaign bytes",async()=>{
    const handler=production();
    const response=await handler(new Request(origin+"/sermons/?sermon_book=%2Fromans&utm_source=church%20email"));
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/sermons/?sermon_book=romans&utm_source=church%20email");
  });
  it("normalizes only one observed trailing slash on legacy taxonomy query values in one hop",async()=>{
    const route=production();
    for(const name of ["sermon_series","sermon_speaker","sermon_topics","sermon_book"]){
      const response=await route(new Request("http://example.test/sermons-v5/page/01?"+name+"=example%2F&utm_campaign=autumn%20study&s=faith%2F&custom=x%2fy"));
      expect(response.status).toBe(301);expect(response.headers.get("location")).toBe(origin+"/sermons/?"+name+"=example&utm_campaign=autumn%20study&s=faith%2F&custom=x%2fy");
    }
    for(const name of ["sermon_series","sermon_speaker","sermon_topics","sermon_book"]){
      const wrapped=await route(new Request("http://example.test/sermons-v5?"+name+"=%2Fexample%2F&utm_campaign=a%20b"));
      expect(wrapped.status).toBe(301);expect(wrapped.headers.get("location")).toBe(origin+"/sermons/?"+name+"=example&utm_campaign=a%20b");
    }
    const direct=await route(new Request(origin+"/sermons/?sermon_series=example/"));
    expect(direct.status).toBe(301);expect(direct.headers.get("location")).toBe("/sermons/?sermon_series=example");
    expect((await route(new Request(origin+"/sermons/?sermon_series=example//"))).status).toBe(400);
    expect((await route(new Request(origin+"/sermons/?sermon_series=//example/"))).status).toBe(400);
    expect((await route(new Request(origin+"/sermons/?sermon_series=example/chapter"))).status).toBe(400);
    expect((await route(new Request(origin+"/sermons/?s=faith%2F&utm_campaign=a%20b"))).status).toBe(200);
  });
  it("preserves only source-allowlisted taxonomy canonicals and sitemap query routes",async()=>{
    const path="/sermons/?sermon_book=romans";
    const route=createSeoHttpAdapter({policy:{environment:"production",canonicalOrigin:origin},sermons:repository(),indexableArchivePaths:[path],sourceSitemap:async()=>[{path}]});
    const page=await route(new Request(origin+path));const html=await page.text();
    expect(page.status).toBe(200);expect(html).toContain('rel="canonical" href="'+origin+path+'"');expect(html).toContain('name="robots" content="index, follow"');
    expect(await (await route(new Request(origin+path+"&utm_campaign=example"))).text()).toContain('name="robots" content="noindex, follow"');
    expect(await (await route(new Request(origin+"/sitemap.xml"))).text()).toContain("<loc>"+origin+path+"</loc>");
    expect(()=>renderSeoSitemap([],{...publicRenderContext,seo:{canonicalOrigin:origin,indexable:true}},false,[{path}])).toThrow("seo_sitemap_path_invalid");
  });
  it("resolves only verified single WordPress shortlinks to direct canonical paths",async()=>{
    const route=createSeoHttpAdapter({policy:{environment:"production",canonicalOrigin:origin,redirectOrigins:["http://example.test"]},sermons:repository(),sourceShortlinks:{"42":"/sermons/anonymous-teaching/"}});
    for(const key of ["p","page_id"]){
      const response=await route(new Request("http://example.test/?"+key+"=42"));expect(response.status).toBe(301);expect(response.headers.get("location")).toBe(origin+"/sermons/anonymous-teaching/");
      const head=await route(new Request(origin+"/?"+key+"=42",{method:"HEAD"}));expect(head.status).toBe(301);expect(await head.text()).toBe("");
    }
    for(const query of ["p=999","p=0","p=042","p=-42","p=","p=42&p=42","p=42&page_id=42","p=42&s=ambiguous"]){
      expect((await route(new Request(origin+"/?"+query))).status,query).toBe(404);
    }
    const campaign=await route(new Request("http://example.test/?utm_campaign=a%20b&p=42&custom=x%2fy"));
    expect(campaign.status).toBe(301);expect(campaign.headers.get("location")).toBe(origin+"/sermons/anonymous-teaching/?utm_campaign=a%20b&custom=x%2fy");
    const invalid=createSeoHttpAdapter({policy:{environment:"production",canonicalOrigin:origin},sermons:repository(),sourceShortlinks:{"42":"//outside.example/"}});
    expect((await invalid(new Request(origin+"/?p=42"))).status).toBe(503);
  });
  it("consolidates only the fifteen captured legacy XML indexes in one permanent hop",async()=>{
    const route=production();expect(legacySitemapPaths).toHaveLength(15);
    for(const path of legacySitemapPaths){
      const response=await route(new Request("http://example.test"+path+"?utm_campaign=a%20b",{method:"HEAD"}));
      expect(response.status,path).toBe(301);expect(response.headers.get("location")).toBe(origin+"/sitemap.xml?utm_campaign=a%20b");expect(await response.text()).toBe("");
    }
    expect((await route(new Request(origin+"/unobserved-sitemap.xml"))).status).toBe(404);
    expect((await route(new Request(origin+"/sitemap_index.xml"))).status).toBe(404);
    const staged=createSeoHttpAdapter({policy:{environment:"staging",canonicalOrigin:origin,rehearsalOrigins:["http://127.0.0.1:4441"]},sermons:repository()});
    expect((await staged(new Request("http://127.0.0.1:4441"+legacySitemapPaths[0]))).status).toBe(404);
  });
  it("allows verified source children after a native collection404 while preserving editorial dispositions",async()=>{
    const sourcePath="/events/category/anonymous/",oldPath="/events/category/retired/";
    const content={pages:[],posts:[],events:[],venues:{},home:null,settings:structuredClone(defaultSiteSettings),assets:{},routes:[{path:oldPath,entityId:"old",status:410 as const,targetPath:null}]};
    const route=createSeoHttpAdapter({policy:{environment:"production",canonicalOrigin:origin},sermons:repository(),content:async()=>content,
      sourceSitemap:async()=>[{path:sourcePath},{path:oldPath}],sourcePage:async(request)=>new URL(request.url).pathname.startsWith("/events/category/")?new Response("Verified anonymous source page"):null});
    const source=await route(new Request(origin+sourcePath));expect(source.status).toBe(200);expect(await source.text()).toBe("Verified anonymous source page");
    expect((await route(new Request(origin+oldPath))).status).toBe(410);
    expect((await route(new Request(origin+"/sermons/unknown/"))).status).toBe(404);
    expect((await route(new Request(origin+"/frontend-preview/events/category/anonymous/"))).status).toBe(404);
    const sitemap=await(await route(new Request(origin+"/sitemap.xml"))).text();expect(sitemap).toContain(origin+sourcePath);expect(sitemap).not.toContain(origin+oldPath);
  });
  it("gives source-only and nested fallback pages the published global CMS snapshot",async()=>{
    const content={pages:[],posts:[],events:[],venues:{},home:null,settings:structuredClone(defaultSiteSettings),assets:{},routes:[]};
    const route=createSeoHttpAdapter({policy:{environment:"production",canonicalOrigin:origin},sermons:repository(),content:async()=>content,
      sourcePage:async(_request,context)=>new Response(context.siteContent===content?"Current published settings":"Missing settings")});
    for(const path of ["/source-only/","/events/category/anonymous/"])expect(await(await route(new Request(origin+path))).text()).toBe("Current published settings");
  });
  it("serves GET-equivalent HEAD without a body including routes, redirects, sitemap and errors",async()=>{
    const route=production();
    for(const path of ["/sermons/","/sermons/page/2/","/sermons/anonymous-teaching/","/sermons/old-title","/about/","/sitemap.xml","/robots.txt","/unknown/"]){
      const get=await route(new Request(origin+path)),head=await route(new Request(origin+path,{method:"HEAD"}));
      expect(head.status,path).toBe(get.status);expect(head.headers.get("location"),path).toBe(get.headers.get("location"));expect(head.headers.get("content-type"),path).toBe(get.headers.get("content-type"));expect(await head.text()).toBe("");
    }
  });
  it("keeps unknown, removed, private and invalid paths nonindexable with real status",async()=>{
    const route=production();
    for(const [path,status] of [["/missing/",404],["/sermons/removed",410],["/sermons/unknown",404],["/admin/cms",404],["/a%64min/cms",404],["/sermons/%zz/",400],["/frontend-preview/sermons/",404],["/sermons/%2fsecret/",400]] as const){
      const response=await route(new Request(origin+path));expect(response.status,path).toBe(status);expect(response.headers.get("x-robots-tag")).toContain("noindex");expect(await response.text()).not.toContain('rel="canonical"');
    }
    expect((await route(new Request(origin+"/sermons/",{method:"POST"}))).status).toBe(405);
  });
  it("combines church pages and eligible encoded sermon URLs, excluding aliases and variants",async()=>{
    const response=await production()(new Request(origin+"/sitemap.xml")),xml=await response.text();
    expect(response.status).toBe(200);for(const path of ["/about/","/sermons/","/sermons/anonymous-teaching/","/sermons/"+unicode+"/"])expect(xml).toContain(origin+path);
    for(const path of ["/constitution/","/pages/lordsdayservice/","/sermons-v5/","/frontend-preview/"])expect(xml).not.toContain(path);
    const unicodePage=await production()(new Request(origin+"/sermons/"+unicode.toUpperCase()+"/"));expect(unicodePage.status).toBe(301);expect(unicodePage.headers.get("location")).toBe("/sermons/"+unicode+"/");
  });
  it("keeps isolated staging disallowed, nonindexable and free of production canonical metadata",async()=>{
    const rehearsal="http://127.0.0.1:4450",route=createSeoHttpAdapter({sermons:repository(),policy:{environment:"staging",canonicalOrigin:origin,rehearsalOrigins:[rehearsal]}});
    const response=await route(new Request(rehearsal+"/sermons/"));expect(response.status).toBe(200);expect(response.headers.get("x-robots-tag")).toContain("noindex");expect(await response.text()).not.toContain('rel="canonical"');
    expect(await (await route(new Request(rehearsal+"/robots.txt"))).text()).toBe("User-agent: *\nDisallow: /\n");
    expect((await route(new Request(rehearsal+"/sitemap.xml"))).status).toBe(404);
    expect((await route(new Request(rehearsal+"/sitemap-sermons.xml"))).status).toBe(404);
  });
  it("uses source fallback only after current routes and validates redirects",async()=>{
    let calls=0;const route=createSeoHttpAdapter({sermons:repository(),policy:{environment:"production",canonicalOrigin:origin},sourcePage:async request=>{calls++;return new URL(request.url).pathname==="/source-only/"?new Response("Proven original published wording"):null;},sourceDisposition:async path=>path==="/unsafe-source/"?{kind:"redirect",location:"//untrusted.test/"}:path==="/source-gone/"?{kind:"gone"}:null,sourceSitemap:async()=>[{path:"/source-only/"},{path:"/pages/lordsdayservice/"}]});
    expect((await route(new Request(origin+"/about/"))).status).toBe(200);expect(calls).toBe(0);
    expect(await (await route(new Request(origin+"/source-only/"))).text()).toContain("original");
    expect((await route(new Request(origin+"/source-gone/"))).status).toBe(410);expect((await route(new Request(origin+"/unsafe-source/"))).status).toBe(503);
    const xml=await (await route(new Request(origin+"/sitemap.xml"))).text();expect(xml).toContain(origin+"/source-only/");expect(xml).not.toContain("/pages/lordsdayservice/");
  });
  it("shared handlers implement HEAD and preserve private comparison surfaces",async()=>{
    const publicRoute=createPublicSermonSiteHandler(repository()),privateRoute=createPublicSermonSiteHandler(repository(),restrictedRenderContext);
    const response=await publicRoute(new Request(origin+"/sermons/anonymous-teaching/",{method:"HEAD"}));expect(response?.status).toBe(200);expect(await response?.text()).toBe("");
    const alternate=await privateRoute(new Request(origin+"/sermons-v5/"));expect(alternate?.status).toBe(200);expect(await alternate?.text()).toContain('class="v5"');
  });
  it("uses actual archive count while excluding preserved source-noindex pagination",async()=>{
    const content={pages:[],posts:[],events:[],venues:{},home:null,settings:structuredClone(defaultSiteSettings),assets:{},routes:[],sourceSeoByPath:{"/sermons/page/2/":{noindex:true}}};
    const xml=renderSeoSitemap([{slug:"anonymous",lastModified:"2026-01-01"}],{...publicRenderContext,siteContent:content},true,[],28);
    expect(xml).toContain("/sermons/page/4/");expect(xml).not.toContain("/sermons/page/2/");expect(xml).toContain("/sermons/page/3/");
    expect(()=>renderSeoSitemap([],publicRenderContext,true,[],-1)).toThrow("seo_sitemap_count_invalid");
  });
  it("rejects malformed sitemap provenance and untrusted additional paths",()=>{
    for(const entry of [{slug:"bad/slash",lastModified:"2026-01-01"},{slug:"ok",lastModified:"2026-02-30"}])expect(()=>renderSeoSitemap([entry],publicRenderContext)).toThrow();
    expect(()=>renderSeoSitemap([],publicRenderContext,false,[{path:"//untrusted.test/"}])).toThrow();
  });
});

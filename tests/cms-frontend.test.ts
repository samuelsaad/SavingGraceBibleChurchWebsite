import { describe,it,expect } from "vitest";
import { buildCmsSeeds,buildCmsEmbeddedAssetSeeds } from "../src/cms/seed";
import { createCmsFrontendSnapshot } from "../src/cms/frontend-adapter";
import { validateCmsContent } from "../src/cms/validation";
import type { CmsSnapshot,CmsDocument,CmsHomePayload,CmsSettingsPayload,CmsPagePayload,CmsEventPayload,CmsPostPayload } from "../src/cms/model";
import { churchPages,blogPosts } from "../src/frontend/content/pages";
import { events } from "../src/frontend/content/events";
import { defaultHomeContent } from "../src/frontend/content/site-snapshot";
import { publicRenderContext,previewRenderContext } from "../src/frontend/routes";
import { emptyFilterOptions,renderFrontendHomePage,renderChurchPage,renderCalendarFeed } from "../src/frontend";
import { createPublicSermonSiteHandler } from "../src/server/http/public-sermon-page";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import { createChurchSiteHandler } from "../src/server/http/church-site";
import { contentSecurityPolicy,embeddedStyleHashes } from "../src/server/http/frontend-response";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";
import type { SermonSummary } from "../src/domain/sermon";

function snapshot():CmsSnapshot {
 const entities=buildCmsSeeds().filter(seed=>seed.publish).map(seed=>({id:seed.key,key:seed.key,kind:seed.kind,revisionId:`${seed.key}-revision-1`,content:structuredClone(seed.payload) as CmsDocument,payload:structuredClone(seed.payload) as CmsDocument}));
 const routes=entities.flatMap(entity=>typeof entity.content.path==="string"?[{path:entity.content.path,entityId:entity.id,status:200 as const,targetPath:null}]:entity.kind==="home"?[{path:"/",entityId:entity.id,status:200 as const,targetPath:null}]:[]);
 return {entities,documents:Object.fromEntries(entities.map(entity=>[entity.key,entity.content])),routes};
}
function content<T>(source:CmsSnapshot,key:string):T {return source.entities.find(entity=>entity.key===key)!.content as T;}
const data={today:"2026-09-24",sermons:[],options:emptyFilterOptions,totalItems:0};
function summary(index:number):SermonSummary{return {id:`00000000-0000-4000-8000-${String(index).padStart(12,"0")}`,title:`Anonymous CMS sermon ${index}`,slug:`cms-sermon-${index}`,serviceDate:`2026-09-${String(index).padStart(2,"0")}`,summary:"Anonymous approved sermon summary.",speaker:{name:"Example Speaker",slug:"example-speaker"},series:[],scriptureReferences:[],primaryPassages:[],primaryPassageState:"unresolved",books:[],primaryMedia:null} as SermonSummary;}
function repository(records:SermonSummary[]=[]):PublicSermonRepository{return {
 async listPublished(query){const sorted=[...records].sort((a,b)=>query.order==="ASC"?a.serviceDate.localeCompare(b.serviceDate):b.serviceDate.localeCompare(a.serviceDate));return {data:sorted.slice((query.page-1)*query.pageSize,query.page*query.pageSize),totalItems:records.length};},
 async listPublishedFilterOptions(){return emptyFilterOptions;},async findPublishedBySlug(){return null;},async listPublishedSitemapEntries(){return [];},async findPublicPathDisposition(){return null;},async listPublishedSeriesRepresentatives(){return [];},async listPublishedTopicalSermons(){return [];}
};}
const pageBody=(value:string)=>value.slice(value.indexOf('<main'),value.indexOf('</main>')+7).replace(/\s+/gu," ").replace(/(?:[a-z-]+-\d{3}|page)-sermons-heading/gu,"sermons-heading").replace(/[a-z-]+-\d{3}-(giving-(?:bank|online)-heading)/gu,"$1");

describe("CMS migration and renderer projection",()=>{
 it("seeds every content-bearing page, collection and global setting without sermon bodies",()=>{
  const seeds=buildCmsSeeds();expect(seeds).toHaveLength(51);expect(new Set(seeds.map(seed=>seed.key)).size).toBe(51);
  for(const seed of seeds)expect(()=>validateCmsContent(seed.kind,seed.payload)).not.toThrow();
  expect(seeds.filter(seed=>seed.kind==="page")).toHaveLength(33);
  expect(seeds.filter(seed=>seed.kind==="page"&&!seed.publish)).toHaveLength(5);
  expect(seeds.filter(seed=>seed.kind==="post")).toHaveLength(3);expect(seeds.filter(seed=>seed.kind==="event")).toHaveLength(10);expect(seeds.filter(seed=>seed.kind==="venue")).toHaveLength(3);
  expect(buildCmsSeeds()).toEqual(seeds);expect(buildCmsEmbeddedAssetSeeds()).toHaveLength(46);
  expect(seeds.every(seed=>!JSON.stringify(seed).includes('"transcript"'))).toBe(true);
 });
 it("preserves every initial published page's content, images, order and home composition",()=>{
  const context={...publicRenderContext,siteContent:createCmsFrontendSnapshot(snapshot())};
  expect(context.siteContent.pages).toHaveLength(28);expect(context.siteContent.posts).toHaveLength(blogPosts.length);expect(context.siteContent.events).toHaveLength(events.length);
  expect(pageBody(renderFrontendHomePage(data,context))).toBe(pageBody(renderFrontendHomePage(data)));
  for(const page of churchPages.filter(item=>item.status==="published")){
   const projected=context.siteContent.pages.find(item=>item.id===page.id)!;
   expect(projected.blocks.map(block=>JSON.parse(JSON.stringify(block,(key,value)=>key==="cmsInstanceId"?undefined:value)))).toEqual(page.blocks);
   expect(pageBody(renderChurchPage(projected,data,context))).toBe(pageBody(renderChurchPage(page,data)));
  }
  expect(renderCalendarFeed(context)).toBe(renderCalendarFeed());
 });
 it("leaves immutable seed defaults and concurrent snapshots independent",()=>{
  const first=snapshot(),second=snapshot();
  content<CmsHomePayload>(first,"home").title="First visitor";
  content<CmsHomePayload>(second,"home").title="Second visitor";
  const one=createCmsFrontendSnapshot(first),two=createCmsFrontendSnapshot(second);
  expect(renderFrontendHomePage(data,{...publicRenderContext,siteContent:one})).toContain("First visitor");
  expect(renderFrontendHomePage(data,{...publicRenderContext,siteContent:two})).not.toContain("First visitor");
  expect(defaultHomeContent.title).toBe("Saving Grace Bible Church");
 });
 it("applies ordered and disabled modules and safe rich text, including uploaded images and documents",()=>{
  const source=snapshot();const home=content<CmsHomePayload>(source,"home");
  home.modules=home.modules.filter(module=>module.id!=="home-arrival");
  home.modules.unshift({id:"first-message",enabled:true,block:{kind:"paragraph",text:"**Published welcome** <script>alert(1)</script>"}});
  home.modules.push({id:"hidden-message",enabled:false,block:{kind:"paragraph",text:"Hidden CMS sentinel"}});
  home.modules.push({id:"document",enabled:true,block:{kind:"downloads",items:[{title:"Church document",text:"Read the document",label:"Download PDF",href:"/cms-assets/"+"a".repeat(64)+".pdf"}]}});
  const page=content<CmsPagePayload>(source,"page:about");page.hero={media:"uploaded-picture",treatment:"aside",alt:"Administrator supplied alternative",focalPoint:{x:30,y:65}};
  const projected=createCmsFrontendSnapshot(source,[{id:"uploaded-picture",path:"/cms-assets/"+"b".repeat(64)+".png",type:"image/png",width:800,height:600,alt:"Default picture alternative"}]);
  const context={...publicRenderContext,siteContent:projected};const html=renderFrontendHomePage(data,context);
  expect(html).toContain("<strong>Published welcome</strong>");expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");expect(html).not.toContain("Hidden CMS sentinel");expect(html).toContain("Download PDF");
  const rendered=renderChurchPage(projected.pages.find(item=>item.id==="about")!,data,context);
  expect(rendered).toContain('alt="Administrator supplied alternative"');expect(rendered).toContain('object-position:30% 65%');expect(rendered).not.toContain('style="object-position');
  for(const hash of embeddedStyleHashes(rendered))expect(contentSecurityPolicy(rendered)).toContain(hash);
 });
});

describe("live CMS route adaptation",()=>{
 it("shows newly published content immediately through the same handler without a restart",async()=>{
  let current=snapshot();const handler=createPublicSermonSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(current),today:()=>data.today});
  const request=()=>handler(new Request("http://127.0.0.1/"));expect(await (await request())!.text()).not.toContain("Fresh published title");
  current=structuredClone(current);content<CmsHomePayload>(current,"home").title="Fresh published title";
  expect(await (await request())!.text()).toContain("Fresh published title");
 });
 it("updates shared navigation and footer on Claude sermon archive routes",async()=>{
  const source=snapshot();const settings=content<CmsSettingsPayload>(source,"settings");settings.contactCopy.heading="CMS footer heading";settings.primaryMenu[0]!.label="CMS home navigation";settings.footerVisibility.services=false;
  const handler=createPublicSermonSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source)});
  const html=await (await handler(new Request("http://127.0.0.1/sermons/")))!.text();expect(html).toContain("CMS footer heading");expect(html).toContain("CMS home navigation");expect(html).not.toContain('id="footer-services-heading"');
 });
 it("uses live event revisions in listings, details and the same stable-identity calendar feed",async()=>{
  const source=snapshot();const event=content<CmsEventPayload>(source,"event:tuesday-bible-study");event.title="Updated weekly gathering";event.start="18:15";
  const handler=createChurchSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source),today:()=>data.today});
  for(const path of ["/events/","/events/tuesday-bible-study/"]){const html=await (await handler(new Request(`http://127.0.0.1${path}`)))!.text();expect(html).toContain("Updated weekly gathering");}
  const feed=await (await handler(new Request("http://127.0.0.1/events/calendar.ics")))!.text();expect(feed).toContain("UID:tuesday-bible-study@www.savinggrace.org.au");expect(feed).toContain("SUMMARY:Updated weekly gathering");expect(feed).toContain("T181500");
 });
 it("honors event-listing visibility without unpublishing its page",async()=>{
  const source=snapshot();const page=content<CmsPagePayload>(source,"page:events");for(const module of page.modules)if(module.block.kind==="events-calendar")module.enabled=false;
  const handler=createChurchSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source)});const response=await handler(new Request("http://127.0.0.1/events/"));expect(response!.status).toBe(200);expect(await response!.text()).not.toContain('class="events-jumps"');
 });
 it("preserves protected selected-revision preview and never adds withheld seed pages publicly",async()=>{
  const source=snapshot();let loaded=0;const provider=async()=>{loaded+=1;return createCmsFrontendSnapshot(source);};
  const guarded=createLocalFrontendPreviewHandler(repository(),{authorizes:()=>false},{church:{content:provider}});expect((await guarded(new Request("http://127.0.0.1/frontend-preview/")))!.status).toBe(401);expect(loaded).toBe(0);
  const handler=createChurchSiteHandler(repository(),publicRenderContext,{content:provider});expect(await handler(new Request("http://127.0.0.1/constitution/"))).toBeNull();
  const privateSeed=buildCmsSeeds().find(seed=>seed.key==="page:constitution")!;source.entities.push({id:privateSeed.key,key:privateSeed.key,kind:privateSeed.kind,revisionId:"selected-private",content:privateSeed.payload as CmsDocument,payload:privateSeed.payload as CmsDocument});
  const selected=createLocalFrontendPreviewHandler(repository(),{authorizes:()=>true},{root:"/cms-preview",context:{...previewRenderContext,basePath:"/cms-preview"},church:{content:provider}});
  const response=await selected(new Request("http://127.0.0.1/cms-preview/constitution/"));expect(response!.status).toBe(200);expect(response!.headers.get("cache-control")).toContain("no-store");expect(await response!.text()).toContain("noindex, nofollow, noarchive");
 });
 it("honors direct CMS redirects, gone records and published sitemap eligibility",async()=>{
  const source=snapshot();source.routes.push({path:"/old-church-page/",entityId:"page:about",status:301,targetPath:"/about/"},{path:"/retired-page/",entityId:"gone",status:410,targetPath:null});
  const handler=createChurchSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source)});
  const redirect=await handler(new Request("http://127.0.0.1/old-church-page/"));expect(redirect!.status).toBe(301);expect(redirect!.headers.get("location")).toBe("/about/");expect((await handler(new Request("http://127.0.0.1/retired-page/")))!.status).toBe(410);
  const xml=await (await handler(new Request("http://127.0.0.1/sitemap.xml")))!.text();expect(xml).toContain("/about/");expect(xml).not.toContain("/constitution/");expect(xml).not.toContain("/retired-page/");
 });
 it("excludes an unpublished event from its route, listings and calendar feed",async()=>{
  const source=snapshot();source.entities=source.entities.filter(entity=>entity.key!=="event:tuesday-bible-study");source.routes=source.routes.filter(route=>route.entityId!=="event:tuesday-bible-study");
  const handler=createChurchSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source),today:()=>data.today});
  expect((await handler(new Request("http://127.0.0.1/events/tuesday-bible-study/")))!.status).toBe(404);
  const listing=await (await handler(new Request("http://127.0.0.1/events/")))!.text();expect(pageBody(listing)).not.toContain("Tuesday Bible Study");
  const feed=await (await handler(new Request("http://127.0.0.1/events/calendar.ics")))!.text();expect(feed).not.toContain("UID:tuesday-bible-study@");
 });
 it("renders newly published page revisions and editable blog/sitemap section visibility",async()=>{
  const source=snapshot();const page={id:"new-page",path:"/new-page/",title:"New published page",status:"draft",section:"about",description:"A new page composed in the dashboard.",legacyPaths:[],modules:[{id:"new-copy",enabled:true,block:{kind:"paragraph",text:"New page content without a frontend rebuild."}}]};
  source.entities.push({id:"new-page",key:"page:new-page",kind:"page",revisionId:"new-revision",content:page,payload:page});source.routes.push({path:page.path,entityId:"new-page",status:200,targetPath:null});
  for(const key of ["page:blogs","page:sitemap"]){const item=content<CmsPagePayload>(source,key);item.modules.forEach(module=>module.enabled=false);item.modules.push({id:"replacement-intro",enabled:true,block:{kind:"paragraph",text:"Administrator controlled index introduction."}});}
  const handler=createChurchSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source),today:()=>data.today});
  const response=await handler(new Request("http://127.0.0.1/new-page/"));expect(response!.status).toBe(200);expect(await response!.text()).toContain('rel="canonical" href="https://www.savinggrace.org.au/new-page/"');
  for(const path of ["/blogs/","/sitemap/"]){const body=pageBody(await (await handler(new Request(`http://127.0.0.1${path}`)))!.text());expect(body).toContain("Administrator controlled index introduction.");expect(body).not.toContain('class="tiles tiles--3"');expect(body).not.toContain('class="sitemap__group"');}
 });
 it("applies ordinary-page and grouped sermon curation through the same eligibility boundary",async()=>{
  const source=snapshot();const page=content<CmsPagePayload>(source,"page:about");
  page.modules=[{id:"nested-sermons",enabled:true,block:{kind:"panel",blocks:[{kind:"sermon-cards",heading:"Curated teaching",linkLabel:"More teaching",limit:2,order:"ASC",sermonIds:[summary(2).id,summary(9).id]}]}}];
  const handler=createChurchSiteHandler(repository([summary(1),summary(2)]),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source)});
  const body=pageBody(await (await handler(new Request("http://127.0.0.1/about/")))!.text());expect(body).toContain("Anonymous CMS sermon 2");expect(body).not.toContain("Anonymous CMS sermon 1");expect(body).not.toContain("Anonymous CMS sermon 9");
 });
 it("keeps renamed menu destinations available and resolves slashless old URLs in one hop",async()=>{
  const source=snapshot(),page=content<CmsPagePayload>(source,"page:about");page.path="/renamed-about/";
  source.routes=source.routes.map(route=>route.entityId==="page:about"?{...route,status:301,targetPath:page.path}:route);
  source.routes.push({path:page.path,entityId:"page:about",status:200,targetPath:null});
  const handler=createChurchSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source)});
  for(const oldPath of ["/about","/about/"]){const response=await handler(new Request(`http://127.0.0.1${oldPath}?from=old-link`));expect(response!.status).toBe(301);expect(response!.headers.get("location")).toBe("/renamed-about/?from=old-link");}
  const html=await (await handler(new Request("http://127.0.0.1/renamed-about/")))!.text();expect(html).toMatch(/href="\/about\/"[^>]*>About Us/);
 });
 it("resolves static venue aliases directly to renamed or retired event dispositions",async()=>{
  const source=snapshot(),event=content<CmsEventPayload>(source,"event:sgbc-picnic-rye"),old=event.path;event.path="/events/renamed-picnic/";
  source.routes=source.routes.map(route=>route.path===old?{...route,status:301,targetPath:event.path}:route);
  source.routes.push({path:event.path,entityId:"event:sgbc-picnic-rye",status:200,targetPath:null});
  const handler=createChurchSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source)});
  for(const path of ["/venue/rye-civic-hall/","/venue/rye-civic-hall",old,old.slice(0,-1)]){const response=await handler(new Request(`http://127.0.0.1${path}`));expect(response!.status).toBe(301);expect(response!.headers.get("location")).toBe(event.path);}
  source.entities=source.entities.filter(entity=>entity.key!=="event:sgbc-picnic-rye");source.routes=source.routes.map(route=>route.entityId==="event:sgbc-picnic-rye"?{...route,status:410,targetPath:null}:route);
  for(const path of ["/venue/rye-civic-hall/","/venue/rye-civic-hall",old,old.slice(0,-1)])expect((await handler(new Request(`http://127.0.0.1${path}`)))!.status).toBe(410);
 });
 it("serves independently published event and blog details when their index pages are unpublished",async()=>{
  const source=snapshot();source.entities=source.entities.filter(entity=>!["page:events","page:blogs"].includes(entity.key));source.routes=source.routes.map(route=>["page:events","page:blogs"].includes(route.entityId)?{...route,status:410,targetPath:null}:route);
  const post=source.entities.find(entity=>entity.kind==="post")!.content as unknown as CmsPostPayload;
  const handler=createChurchSiteHandler(repository(),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source)});
  for(const [path,missingBacklink]of [["/events/sunday-evening-service/","All events"],[post.path,"All blog posts"]]){const response=await handler(new Request(`http://127.0.0.1${path}`));expect(response!.status).toBe(200);expect(pageBody(await response!.text())).not.toContain(missingBacklink);}
 });
 it("applies configured sermon selection in posts and both collection index renderers",async()=>{
  const source=snapshot(),post=source.entities.find(entity=>entity.kind==="post")!.content as unknown as CmsPostPayload;
  for(const document of [post,content<CmsPagePayload>(source,"page:blogs"),content<CmsPagePayload>(source,"page:sitemap")])document.modules=[{id:"curated-collection",enabled:true,block:{kind:"sermon-cards",heading:"Selected teaching",linkLabel:"More sermons",limit:1,order:"ASC",sermonIds:[summary(2).id,summary(9).id]}}];
  const eligible=repository([summary(1),summary(2)]),queries:unknown[]=[],list=eligible.listPublished;eligible.listPublished=async query=>{queries.push(query);return list(query);};
  const handler=createChurchSiteHandler(eligible,publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source)});
  for(const path of [post.path,"/blogs/","/sitemap/"]){const response=await handler(new Request(`http://127.0.0.1${path}`));expect(response!.status).toBe(200);const body=pageBody(await response!.text());expect(body).toContain("Anonymous CMS sermon 2");expect(body).not.toContain("Anonymous CMS sermon 1");expect(body).not.toContain("Anonymous CMS sermon 9");}
  expect(queries.filter(query=>(query as {pageSize:number}).pageSize===50)).toHaveLength(3);expect(queries).toContainEqual(expect.objectContaining({page:1,pageSize:50,order:"ASC"}));
 });
 it("resolves curated sermon IDs exclusively from the incumbent eligible repository",async()=>{
  const source=snapshot();const home=content<CmsHomePayload>(source,"home");const block=home.modules.find(module=>module.block.kind==="home-sermons")!.block;
  if(block.kind!=="home-sermons")throw new Error("fixture");block.sermonIds=[summary(2).id,summary(9).id];
  const handler=createChurchSiteHandler(repository([summary(1),summary(2)]),publicRenderContext,{content:async()=>createCmsFrontendSnapshot(source),today:()=>data.today});
  const html=await (await handler(new Request("http://127.0.0.1/")))!.text();const body=pageBody(html);expect(body).toContain("Anonymous CMS sermon 2");expect(body).not.toContain("Anonymous CMS sermon 1");expect(body).not.toContain("Anonymous CMS sermon 9");
 });
});


it("keeps duplicated giving sections independently labelled and their headings editable",()=>{
 const source=snapshot(),page=content<CmsPagePayload>(source,"page:giving");
 const original=page.modules.find(module=>module.block.kind==="giving-methods")!;
 if(original.block.kind!=="giving-methods")throw Error("giving fixture missing");
 original.block={...original.block,heading:"Our offering information"};
 page.modules.push({...structuredClone(original),id:"giving-second-instance"});
 validateCmsContent("page",page);
 const rendered=renderChurchPage(createCmsFrontendSnapshot(source).pages.find(item=>item.id==="giving")!,data,{...publicRenderContext,siteContent:createCmsFrontendSnapshot(source)});
 expect(rendered).toContain("Our offering information");
 const ids=[...rendered.matchAll(/id="([^"]*giving-(?:bank|online)-heading)"/g)].map(match=>match[1]);
 expect(ids).toHaveLength(4);expect(new Set(ids).size).toBe(4);
});

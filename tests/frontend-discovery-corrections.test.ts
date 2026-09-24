import { describe,expect,it } from "vitest";
import { sermonSummarySchema } from "../src/domain/sermon";
import { entry,primaryBook } from "../src/frontend/components/catalogue";
import { restrictedRenderContext,siteLinks } from "../src/frontend/routes";
import { renderFrontendHomePage,emptyFilterOptions } from "../src/frontend/pages/home";
import { frontendResponse } from "../src/server/http/frontend-response";
import { createSealedStagingHandler } from "../src/staging/handler";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";
const sermon=sermonSummarySchema.parse({id:"99999999-9999-4999-8999-999999999159",title:"An invented library example",slug:"invented-library-example",serviceDate:"2025-01-01",summary:null,speaker:null,series:[],scriptureReferences:[],primaryPassages:[{displayText:"1 Peter 2",isLead:true}],primaryPassageState:"assigned",books:[{name:"First Peter",slug:"first-peter"}],primaryMedia:null});
describe("reviewed discovery presentation",()=>{
 it.each(["card","row","related"] as const)("resolves a numbered alias without series in every %s entry",variant=>{
   expect(primaryBook(sermon)?.slug).toBe("1-peter");
   const markup=entry(sermon,{variant,headingLevel:3,links:siteLinks(restrictedRenderContext)}).toString();
   expect(markup).toContain('class="tab hue--general"');expect(markup).toContain('>1 Peter</span>');expect(markup).not.toContain('tab--ghost');
 });
 it("gives explicit topical classification precedence without changing Scripture or inferring from absence",()=>{
   const render=(s:typeof sermon)=>entry(s,{variant:"row",headingLevel:2,links:siteLinks(restrictedRenderContext)}).toString();
   const marked=render({...sermon,isTopical:true});expect(marked).toContain('tab hue--topical');expect(marked).toContain('>Topical</span>');expect(marked).toContain('1 Peter 2');
   for(const value of [{...sermon,books:[],primaryPassageState:"none" as const},{...sermon,books:[],series:[{name:"Topical",slug:"topical"}]}]){
     expect(render(value)).not.toContain('hue--topical');expect(render(value)).toContain('tab--ghost');
   }
 });
 it("delivers the original menu and hashed enhancement only to restricted or authenticated preview contexts",()=>{
   const input={sermons:[sermon],totalItems:1,options:emptyFilterOptions,today:"2026-09-24"};
   const html=renderFrontendHomePage(input,restrictedRenderContext),response=frontendResponse(html);
   for(const label of ["SermonsV1","SermonsV2","Speakers","Series","Books"])expect(html).toContain(`>${label}</a>`);
   expect(html).toContain('data-enhancement="navigation"');expect(html).toContain('data-sermon-menu');
   expect(response.headers.get('Content-Security-Policy')).toContain("'sha256-");
   expect(response.headers.get('Content-Security-Policy')).not.toContain("'unsafe-inline'");
   expect(html).not.toContain('rel="canonical"');expect(html).not.toContain('property="og:');
   expect(renderFrontendHomePage(input)).not.toContain('data-menu data-sermon-menu>');
 });
 it("restores sealed taxonomy indexes without enabling private routes or writes",async()=>{
   const repo={listPublishedFilterOptions:async()=>emptyFilterOptions} as PublicSermonRepository;
   const handler=createSealedStagingHandler(repo,async()=>{},"a".repeat(40));
   for(const path of ["/speakers/","/series/","/books/"]){const res=await handler(new Request(`http://127.0.0.1${path}`));expect(res.status).toBe(200);expect(res.headers.get('X-Robots-Tag')).toContain('noindex');expect(await res.text()).toContain('data-sermon-menu');}
   expect((await handler(new Request('http://127.0.0.1/admin'))).status).toBe(401);
   expect((await handler(new Request('http://127.0.0.1/books/',{method:'POST'}))).status).toBe(405);
 });
});

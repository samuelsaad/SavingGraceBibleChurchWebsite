import {describe,it,expect} from "vitest";
import {createCmsFrontendSnapshot} from "../src/cms/frontend-adapter";
import {buildCmsSeeds} from "../src/cms/seed";
import type {CmsDocument,CmsSnapshot,CmsPagePayload,CmsHomePayload} from "../src/cms/model";
import {renderChurchPage,renderEventPage,renderBlogPost} from "../src/frontend/pages/church";
import {renderFrontendHomePage,emptyFilterOptions} from "../src/frontend/pages/home";
import {renderBlock} from "../src/frontend/components/blocks";
import {defaultHomeContent} from "../src/frontend/content/site-snapshot";
import type {FrontendRenderContext} from "../src/frontend/routes";
import type {Block} from "../src/frontend/content/types";
const data={today:"2026-10-09",sermons:[],options:emptyFilterOptions,totalItems:0};
function snapshot():CmsSnapshot {const entities=buildCmsSeeds().filter(s=>s.publish).map(s=>({id:s.key,key:s.key,kind:s.kind,revisionId:s.key,content:structuredClone(s.payload)as CmsDocument,payload:structuredClone(s.payload)as CmsDocument}));return {entities,documents:Object.fromEntries(entities.map(e=>[e.key,e.content])),routes:[]};}
function contexts(source=snapshot(),kind="page") {return {visitor:{mode:"restricted",basePath:"",siteContent:createCmsFrontendSnapshot(source)}as FrontendRenderContext,editor:{mode:"restricted",basePath:"",siteContent:createCmsFrontendSnapshot(source,[],true),visualEditor:{entityId:"example",kind}}as FrontendRenderContext};}
function path(...parts:Array<string|number>){return JSON.stringify(parts.map(String)).replaceAll('"','&quot;');}
function selected(source:CmsSnapshot,key:string){return source.entities.find(e=>e.key===key)!.content;}
const main=(document:string)=>document.slice(document.indexOf('<main'),document.indexOf('</main>')+7);

describe("actual website visual-editor renderer",()=>{
 it("keeps existing DOM hierarchy and emits no editor markers or CSS for visitor pages",()=>{
  const source=snapshot(),page=selected(source,"page:about")as unknown as CmsPagePayload;
  page.modules=[{id:"first",enabled:true,block:{kind:"paragraph",text:"An anonymous paragraph."}}];
  const {visitor,editor}=contexts(source);
  const publicHtml=renderChurchPage(visitor.siteContent!.pages.find(p=>p.id==="about")!,data,visitor);
  const editorHtml=renderChurchPage(editor.siteContent!.pages.find(p=>p.id==="about")!,data,editor);
  expect(publicHtml).not.toContain("data-cms-");expect(publicHtml).not.toContain(".ve-selected");
  expect(publicHtml).toContain('<div class="page__body"><p>An anonymous paragraph.</p></div>');
  expect(editorHtml).toContain('<div class="page__body"><p data-cms-section-path=');
  expect(editorHtml).not.toContain('class="cms-editor-section"');expect(editorHtml).not.toContain('<script');expect(editorHtml).not.toContain('class="preview-band"');
  expect(editorHtml).toContain('data-cms-path="'+path("modules",0,"block","text")+'"');
 });
 it("preserves source indices for disabled modules and omits their body in every mode",()=>{
  const source=snapshot(),page=selected(source,"page:about")as unknown as CmsPagePayload;
  page.modules=[{id:"hidden",enabled:false,block:{kind:"paragraph",text:"NEVER EXPOSE HIDDEN BODY"}},{id:"visible",enabled:true,block:{kind:"heading",level:2,text:"Visible heading"}}];
  const {visitor,editor}=contexts(source);
  const publicHtml=renderChurchPage(visitor.siteContent!.pages.find(p=>p.id==="about")!,data,visitor),editorHtml=renderChurchPage(editor.siteContent!.pages.find(p=>p.id==="about")!,data,editor);
  expect(publicHtml).not.toContain("NEVER EXPOSE HIDDEN BODY");expect(editorHtml).not.toContain("NEVER EXPOSE HIDDEN BODY");
  expect(main(publicHtml)).not.toContain("Hidden section:");expect(editorHtml).toContain("Hidden section: Paragraph");
  expect(editorHtml).toContain('data-cms-module-path="'+path("modules",1)+'"');
  expect(editorHtml).toContain('data-cms-path="'+path("modules",1,"block","text")+'"');
 });
 it("maps nested panel blocks and applies responsive presentation to existing roots",()=>{
  const source=snapshot(),page=selected(source,"page:about")as unknown as CmsPagePayload;
  page.modules=[{id:"panel",enabled:true,presentation:{background:"soft",spacing:"roomy"},block:{kind:"panel",columns:2,title:"Panel",blocks:[{kind:"paragraph",text:"First child"},{kind:"figure",media:"congregation",alt:"An anonymous picture",focalPoint:{x:30,y:60}}]}}];
  const {visitor,editor}=contexts(source);
  const rendered=renderChurchPage(editor.siteContent!.pages.find(p=>p.id==="about")!,data,editor);
  expect(rendered).toContain('class="panel cms-panel-columns cms-panel-columns--2 cms-presentation cms-presentation--background-soft cms-presentation--spacing-roomy"');
  expect(rendered).toContain('data-cms-path="'+path("modules",0,"block","blocks",0,"text")+'"');
  expect(rendered).toContain('data-cms-path="'+path("modules",0,"block","blocks",1,"media")+'"');
  expect(rendered).toContain('alt="An anonymous picture"');expect(rendered).toContain("object-position:30% 60%");
  const published=renderChurchPage(visitor.siteContent!.pages.find(p=>p.id==="about")!,data,visitor);
  expect(published).toContain("cms-panel-columns--2");expect(published).not.toContain("data-cms-");expect(published).not.toContain('style="');
  expect(published).toContain('@media(max-width:45rem){.cms-panel-columns{grid-template-columns:1fr}');
 });
 it("maps home headings, paragraphs, service links and per-placement images",()=>{
  const source=snapshot(),home=selected(source,"home")as unknown as CmsHomePayload;
  const arrival=home.modules[0]!.block;if(arrival.kind!=="home-arrival")throw new Error("fixture");arrival.mediaAlt="Anonymous congregation image";arrival.mediaFocalPoint={x:25,y:50};
  const {editor}=contexts(source,"home"),rendered=renderFrontendHomePage(data,editor);
  for(const parts of [["modules",0,"block","hero","nameLine1"],["modules",0,"block","hero","join"],["modules",0,"block","services","items",0,"title"],["modules",1,"block","paragraph"],["modules",1,"block","pillars",0,"text"],["modules",1,"block","media"]])expect(rendered).toContain('data-cms-path="'+path(...parts)+'"');
  expect(rendered).toContain('alt="Anonymous congregation image"');expect(rendered).toContain("object-position:25% 50%");
  expect(defaultHomeContent.modules[0]!.block).not.toHaveProperty("mediaAlt");
 });
 it("identifies shared settings and isolates their paths from page content",()=>{
  const {editor}=contexts(snapshot(),"settings"),rendered=renderFrontendHomePage(data,editor);
  expect(rendered).toContain('data-cms-global="header"');expect(rendered).toContain('data-cms-global="navigation"');expect(rendered).toContain('data-cms-global="footer"');
  expect(rendered).toContain('data-cms-path="'+path("primaryMenu",0,"label")+'"');
  expect(rendered).toContain('data-cms-path="'+path("bottomBarCopy","copyright")+'"');
  expect(main(rendered)).not.toContain("data-cms-path");expect(main(rendered)).not.toContain("data-cms-module-path");
 });
 it("maps post/event details and contextual venue fields to their own document",()=>{
  const source=snapshot(),{editor}=contexts(source,"event"),event=editor.siteContent!.events[0]!;
  const rendered=renderEventPage(event,data,editor);expect(rendered).toContain('data-cms-path="'+path("title")+'"');expect(rendered).toContain('data-cms-path="'+path("description",0)+'"');
  const venue=renderEventPage(event,data,{...editor,visualEditor:{entityId:"venue",kind:"venue"}});expect(main(venue)).toContain('data-cms-path="'+path("name")+'"');expect(main(venue)).not.toContain('data-cms-path="'+path("title")+'"');
  const post=renderBlogPost(editor.siteContent!.posts[0]!,data,{...editor,visualEditor:{entityId:"post",kind:"post"}});expect(post).toContain('data-cms-path="'+path("date")+'"');
 });
 it("annotates safely escaped block values without introducing raw editing HTML",()=>{
  const context:FrontendRenderContext={mode:"restricted",basePath:"",visualEditor:{entityId:"page",kind:"page"}};
  const block={kind:"paragraph",text:'<img src=x onerror="bad()">',cmsPath:["modules",0,"block"],cmsInstanceId:"example",cmsModulePath:["modules",0]}as unknown as Block;
  const rendered=renderBlock(block,{context,today:data.today,sermons:[]}).toString();
  expect(rendered).toContain('&lt;img src=x onerror=&quot;bad()&quot;&gt;');expect(rendered).not.toContain('<img');expect(rendered.match(/data-cms-path=/gu)).toHaveLength(1);
 });
});

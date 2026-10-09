import {describe,it,expect,vi} from "vitest";
import {createCmsVisualRenderHandler,createCmsRenderSermonRepository} from "../src/cms/visual-render";
import {publicSermonListQuerySchema} from "../src/api/contracts/public-sermons";
import type {SermonSummary} from "../src/domain/sermon";
import {CmsSessionProvider} from "../src/cms/session";
import type {CmsEntity,CmsSnapshot} from "../src/cms/model";
import {validateCmsContent} from "../src/cms/validation";
import type {PublicSermonRepository} from "../src/server/repositories/sermon-repository";
const origin="http://127.0.0.1:4430",secret="ab".repeat(32),id="00000000-0000-4000-8000-000000000001",revisionId="00000000-0000-4000-8000-000000000002";
const content={id:"sample",path:"/sample/",title:"Example page",description:"Example description",section:"about",status:"published",legacyPaths:[],modules:[{id:"sample-copy",enabled:true,block:{kind:"paragraph",text:"Original sample copy"}}]};
const revision={id:revisionId,revisionNumber:1,content,createdAt:"2026-01-01T00:00:00Z",actor:"test",sourceRevisionId:null};
const entity:CmsEntity={id,key:"page:sample",kind:"page",rowVersion:3,draftRevisionId:revisionId,publishedRevisionId:revisionId,draft:revision,published:revision};
const snapshot:CmsSnapshot={documents:{"page:sample":content},entities:[{id,key:entity.key,kind:"page",revisionId,content,payload:content}],routes:[{path:"/sample/",entityId:id,status:200,targetPath:null}]};
const sermons:PublicSermonRepository={listPublished:async()=>({data:[],totalItems:0}),findPublishedBySlug:async()=>null,listPublishedFilterOptions:async()=>({books:[],speakers:[],series:[],passages:[],passageVerseAvailability:[]}),listPublishedTopicalSermons:async()=>[],listPublishedSeriesRepresentatives:async()=>[],listPublishedSitemapEntries:async()=>[],findPublicPathDisposition:async()=>null};
async function fixture(){
 let now=Date.now();const session=new CmsSessionProvider({origin,secret,environment:"local",now:()=>now});
 const login=async()=>{const page=await session.handle(new Request(origin+"/admin/login")),nonce=/name="nonce" value="([^"]+)"/.exec(await page!.text())![1]!;const response=await session.handle(new Request(origin+"/admin/session",{method:"POST",headers:{Origin:origin,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({secret,nonce})}));const cookie=response!.headers.get("set-cookie")!.split(";")[0]!;const info=await(await session.handle(new Request(origin+"/api/v1/admin/cms/session",{headers:{cookie}})))!.json();return{cookie,csrf:info.csrfToken as string};};
 const auth=await login(),repository={get:vi.fn(async()=>structuredClone(entity)),getPublishedSnapshot:vi.fn(async()=>structuredClone(snapshot))};
 const handler=createCmsVisualRenderHandler({repository,sermons,session,assets:async()=>[],environment:"local",now:()=>now});
 const headers={cookie:auth.cookie,Origin:origin,"Content-Type":"application/json","x-csrf-token":auth.csrf};
 const input={entityId:id,expectedRowVersion:3,content,mode:"edit"};
 const post=(value:unknown=input,override:Record<string,string>={})=>handler(new Request(origin+"/api/v1/admin/cms/render",{method:"POST",headers:{...headers,...override},body:JSON.stringify(value)}));
 const frame=(path:string,cookie=auth.cookie)=>handler(new Request(origin+path,{headers:{cookie}}));
 return{handler,session,repository,auth,headers,input,post,frame,login,advance:(milliseconds:number)=>{now+=milliseconds;}};
}
describe("authenticated transient visual render",()=>{
 it("renders unsaved validated copy through real website components without changing published snapshots",async()=>{
  const f=await fixture(),changed=structuredClone(content);changed.modules[0]!.block.text="Unsaved <script>alert(1)</script> copy";
  const response=await f.post({...f.input,content:changed});expect(response!.status).toBe(200);const result=await response!.json();expect(result).toMatchObject({environment:"local",path:"/sample/",currentRowVersion:3,kind:"page"});
  const canvas=await f.frame(result.frameUrl),html=await canvas!.text();expect(html).toContain("Unsaved &lt;script&gt;alert(1)&lt;/script&gt; copy");expect(html).toContain('class="masthead"');expect(html).toContain('<style>');expect(html).not.toContain('class="preview-band"');expect(html).not.toContain('<script>alert(1)</script>');expect(snapshot.entities[0]!.content.modules).toEqual(content.modules);expect(f.repository.get).toHaveBeenCalledTimes(2);
  expect(canvas!.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");expect(canvas!.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");expect(canvas!.headers.get("Cache-Control")).toContain("no-store");expect(canvas!.headers.get("X-Robots-Tag")).toContain("noindex");
 });
 it("requires authentication, exact Origin and the active session CSRF token",async()=>{
  const f=await fixture();expect((await f.post(f.input,{cookie:""}))!.status).toBe(401);expect((await f.post(f.input,{Origin:"https://other.invalid"}))!.status).toBe(403);expect((await f.post(f.input,{"x-csrf-token":""}))!.status).toBe(403);expect((await f.post(f.input,{"sec-fetch-site":"cross-site"}))!.status).toBe(403);expect(f.repository.get).not.toHaveBeenCalled();
 });
 it("isolates frame tokens by session and invalidates them on logout or expiry",async()=>{
  const f=await fixture(),result=await(await f.post())!.json(),other=await f.login();expect((await f.frame(result.frameUrl,other.cookie))!.status).toBe(404);expect((await f.frame(result.frameUrl,""))!.status).toBe(401);f.advance(300001);expect((await f.frame(result.frameUrl))!.status).toBe(404);
  const fresh=await(await f.post())!.json();await f.session.handle(new Request(origin+"/api/v1/admin/cms/session",{method:"DELETE",headers:f.headers}));expect((await f.frame(fresh.frameUrl))!.status).toBe(401);
 });
 it("evicts old canvases after the bounded per-session limit",async()=>{
  const f=await fixture(),first=await(await f.post())!.json();let last=first;for(let i=0;i<8;i++)last=await(await f.post())!.json();expect((await f.frame(first.frameUrl))!.status).toBe(404);expect((await f.frame(last.frameUrl))!.status).toBe(200);
 });
 it("refuses stale saves, in-flight changes, unknown fields, unsafe links and oversized JSON",async()=>{
  const f=await fixture();expect((await f.post({...f.input,expectedRowVersion:2}))!.status).toBe(409);
  expect((await f.post({...f.input,kind:"home"}))!.status).toBe(400);expect((await f.post({...f.input,content:{...content,modules:[{id:"x",enabled:true,block:{kind:"paragraph",text:"[unsafe](javascript:alert)"}}]}}))!.status).toBe(400);
  expect((await f.post(f.input,{"Content-Length":"2000001"}))!.status).toBe(413);
  f.repository.get.mockResolvedValueOnce(structuredClone(entity)).mockResolvedValueOnce({...entity,rowVersion:4});expect((await f.post())!.status).toBe(409);
 });
 it("refuses path spoofing and another entity's canonical route",async()=>{
  const f=await fixture();expect((await f.post({...f.input,path:"/other/"}))!.status).toBe(400);
  f.repository.getPublishedSnapshot.mockResolvedValueOnce({...structuredClone(snapshot),routes:[...snapshot.routes,{path:"/other/",entityId:"00000000-0000-4000-8000-000000000099",status:200,targetPath:null}]});expect((await f.post({...f.input,content:{...content,path:"/other/"}}))!.status).toBe(409);
 });
 it("retains ordinary enhancement scripts in interaction preview and excludes editor markers",async()=>{
  const f=await fixture(),result=await(await f.post({...f.input,mode:"preview"}))!.json(),canvas=await f.frame(result.frameUrl),html=await canvas!.text();expect(html).toContain('data-enhancement="navigation"');expect(html).not.toContain('data-cms-path=');expect(canvas!.headers.get("Content-Security-Policy")).toContain("script-src 'sha256-");
 });
});
describe("optional visual presentation validation",()=>{
 it("validates per-placement image text and finite bounded focal points",()=>{
  const value={...content,modules:[{id:"sample",enabled:true,block:{kind:"book",media:"sample-image",mediaAlt:"An example book",mediaFocalPoint:{x:25,y:75},text:"Sample copy"}}]};expect(validateCmsContent("page",value)).toEqual(value);
  expect(()=>validateCmsContent("page",{...value,modules:[{...value.modules[0],block:{...value.modules[0]!.block,mediaFocalPoint:{x:101,y:50}}}]})).toThrow();
  expect(()=>validateCmsContent("page",{...value,modules:[{...value.modules[0],block:{...value.modules[0]!.block,mediaFocalPoint:{x:50,y:50,css:"url(https://other.invalid)"}}}]})).toThrow();
 });
 it("keeps existing content unchanged and allows only supported responsive options",()=>{
  expect(validateCmsContent("page",content)).toEqual(content);
  const value={...content,modules:[{id:"sample",enabled:true,presentation:{background:"soft",spacing:"roomy",alignment:"center",width:"reading"},block:{kind:"panel",columns:2,blocks:[]}}]};expect(validateCmsContent("page",value)).toEqual(value);
  expect(()=>validateCmsContent("page",{...value,modules:[{...value.modules[0],presentation:{background:"url(https://other.invalid)"}}]})).toThrow();expect(()=>validateCmsContent("page",{...value,modules:[{...value.modules[0],block:{kind:"panel",columns:12,blocks:[]}}]})).toThrow();
  expect(()=>validateCmsContent("page",{...content,path:"/cms-editor-frame/example/"})).toThrow();
 });
});

describe("request-local eligible sermon reuse",()=>{
 it("reuses a larger first-page result for smaller sections without changing totals",async()=>{
  const data=Array.from({length:6},(_,index)=>({id:String(index)}as SermonSummary));
  const source={...sermons,listPublished:vi.fn(async()=>({data,totalItems:40}))};const request=createCmsRenderSermonRepository(source);
  const [six,three]=await Promise.all([request.listPublished(publicSermonListQuerySchema.parse({pageSize:6})),request.listPublished(publicSermonListQuerySchema.parse({pageSize:3}))]);
  expect(source.listPublished).toHaveBeenCalledTimes(1);expect(six.data).toHaveLength(6);expect(three.data.map(row=>row.id)).toEqual(['0','1','2']);expect(three.totalItems).toBe(40);expect(data).toHaveLength(6);
 });
 it("keeps orders, filters, and pagination offsets distinct",async()=>{
  const source={...sermons,listPublished:vi.fn(async()=>({data:[],totalItems:0}))};const request=createCmsRenderSermonRepository(source);
  for(const input of [{pageSize:6},{pageSize:6,order:'ASC'},{pageSize:6,book:'romans'},{pageSize:6,page:2},{pageSize:3,page:2},{pageSize:12}])await request.listPublished(publicSermonListQuerySchema.parse(input));
  expect(source.listPublished).toHaveBeenCalledTimes(6);
 });
 it("refreshes eligibility on every new render and never shares prior results",async()=>{
  const source={...sermons,listPublished:vi.fn().mockResolvedValueOnce({data:[{id:'previously-eligible'}],totalItems:1}).mockResolvedValueOnce({data:[],totalItems:0})};
  const query=publicSermonListQuerySchema.parse({pageSize:6});expect((await createCmsRenderSermonRepository(source).listPublished(query)).data).toHaveLength(1);expect((await createCmsRenderSermonRepository(source).listPublished(query)).data).toHaveLength(0);expect(source.listPublished).toHaveBeenCalledTimes(2);
 });
 it("deduplicates identical in-flight filter lookups only within one render",async()=>{
  const source={...sermons,listPublishedFilterOptions:vi.fn(sermons.listPublishedFilterOptions)};const request=createCmsRenderSermonRepository(source);
  await Promise.all([request.listPublishedFilterOptions(),request.listPublishedFilterOptions()]);expect(source.listPublishedFilterOptions).toHaveBeenCalledTimes(1);
  await createCmsRenderSermonRepository(source).listPublishedFilterOptions();expect(source.listPublishedFilterOptions).toHaveBeenCalledTimes(2);
 });
});

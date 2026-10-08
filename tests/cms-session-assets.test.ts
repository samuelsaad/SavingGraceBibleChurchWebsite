import {describe,it,expect} from "vitest";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";import {join} from "node:path";
import {CmsSessionProvider} from "../src/cms/session";
import {CmsDiskAssets,inspectCmsUpload,createCmsAssetHandler,type CmsAssetStore,type CmsAsset} from "../src/cms/assets";
const origin="http://127.0.0.1:4430",secret="ab".repeat(32);
async function login(provider:CmsSessionProvider){const page=await provider.handle(new Request(origin+"/admin/login")),nonce=/name="nonce" value="([^"]+)"/.exec(await page!.text())![1]!;return provider.handle(new Request(origin+"/admin/session",{method:"POST",headers:{Origin:origin,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({secret,nonce})}));}
describe("protected CMS sessions",()=>{
 it("isolates local and protected staging cookies and refuses staging development entry",async()=>{
  expect(()=>new CmsSessionProvider({origin,secret,environment:"staging",allowLocalDevelopmentEntry:true})).toThrow("cms_local_identity_on_staging_refused");
  const local=new CmsSessionProvider({origin,secret,environment:"local",allowLocalDevelopmentEntry:true});
  const stageOrigin="http://127.0.0.1:4396",stage=new CmsSessionProvider({origin:stageOrigin,secret,environment:"staging"});
  const localCookie=(await login(local))!.headers.get("set-cookie")!.split(";")[0]!;
  const page=await stage.handle(new Request(stageOrigin+"/admin/login")),nonce=/name="nonce" value="([^"]+)"/.exec(await page!.text())![1]!;
  const response=await stage.handle(new Request(stageOrigin+"/admin/session",{method:"POST",headers:{Origin:stageOrigin,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({secret,nonce})}));
  const stageCookie=response!.headers.get("set-cookie")!.split(";")[0]!,cookies=localCookie+"; "+stageCookie;
  expect(localCookie.split("=")[0]).not.toBe(stageCookie.split("=")[0]);
  expect((await local.authenticate(new Request(origin+"/",{headers:{cookie:cookies}})))?.subject).toBe("local-admin-0001");
  expect((await stage.authenticate(new Request(stageOrigin+"/",{headers:{cookie:cookies}})))?.subject).toBe("staging-cms-admin");
 });

 it("requires the protected secret, rotates sessions, checks exact Origin/CSRF and expires",async()=>{
  let now=1000;const p=new CmsSessionProvider({origin,secret,environment:"staging",now:()=>now,lifetimeMs:1000});
  expect(await p.authenticate(new Request(origin+"/",{headers:{"x-local-identity":"admin"}}))).toBeNull();
  const response=(await login(p))!;expect(response.status).toBe(303);expect(response.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Strict");
  const cookie=response.headers.get("set-cookie")!.split(";")[0]!;
  const request=new Request(origin+"/api/v1/admin/cms/session",{headers:{cookie}});
  const session=await (await p.handle(request))!.json();expect(session.identity.subject).toBe("staging-cms-admin");expect(await p.authenticate(request)).toEqual(session.identity);
  expect(p.authorizeMutation(new Request(origin+"/",{method:"POST",headers:{cookie,Origin:"http://evil.invalid","x-csrf-token":session.csrfToken}}))).toBe(false);
  expect(p.authorizeMutation(new Request(origin+"/",{method:"POST",headers:{cookie,Origin:origin,"x-csrf-token":session.csrfToken}}))).toBe(true);
  expect(await p.authenticate(new Request(origin+"/",{headers:{cookie,Host:"evil.invalid"}}))).toBeNull();now+=1001;expect(await p.authenticate(request)).toBeNull();
 });
 it("refuses cross-origin login, nonce replay, weak secrets, remote origins and wrong methods",async()=>{
  expect(()=>new CmsSessionProvider({origin:"http://example.invalid",secret,environment:"staging"})).toThrow();
  expect(()=>new CmsSessionProvider({origin,secret:"short",environment:"local"})).toThrow();
  const p=new CmsSessionProvider({origin,secret,environment:"local"});
  const page=p.loginPage(),nonce=/name="nonce" value="([^"]+)"/.exec(page)![1]!;
  const req=(key:string,source=origin)=>new Request(origin+"/admin/session",{method:"POST",headers:{Origin:source,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({secret:key,nonce})});
  expect((await p.handle(req(secret,"http://evil.invalid")))!.status).toBe(403);
  expect((await p.handle(req("wrong")))!.status).toBe(401);expect((await p.handle(req(secret)))!.status).toBe(401);
  expect((await p.handle(new Request(origin+"/admin/session")))!.status).toBe(405);
 });
 it("logs out with CSRF and revokes the session",async()=>{const p=new CmsSessionProvider({origin,secret,environment:"local"}),cookie=(await login(p))!.headers.get("set-cookie")!.split(";")[0]!,url=origin+"/api/v1/admin/cms/session";const info=await(await p.handle(new Request(url,{headers:{cookie}})))!.json();expect((await p.handle(new Request(url,{method:"DELETE",headers:{cookie,Origin:origin,"x-csrf-token":info.csrfToken}})))!.status).toBe(204);expect(await p.authenticate(new Request(url,{headers:{cookie}}))).toBeNull();});
});
const png=()=>{const b=Buffer.alloc(40);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write("IHDR",12);b.writeUInt32BE(100,16);b.writeUInt32BE(80,20);return b;};
function memoryStore(){const data=new Map<string,CmsAsset>();return{list:async()=>[...data.values()],save:async(a:CmsAsset)=>{const old=data.get(a.storageKey);if(old)return old;data.set(a.storageKey,a);return a;},find:async(key:string)=>data.get(key)??null} satisfies CmsAssetStore;}
describe("persistent CMS uploads",()=>{
 it("rejects spoofed/active formats, oversized dimensions and inconsistent headers",()=>{
  expect(()=>inspectCmsUpload(Buffer.from("<svg/>"),"image/svg+xml")).toThrow();expect(()=>inspectCmsUpload(Buffer.from("<html/>"),"image/png")).toThrow();
  const large=png();large.writeUInt32BE(100000,16);expect(()=>inspectCmsUpload(large,"image/png")).toThrow();
  expect(inspectCmsUpload(png(),"image/png")).toMatchObject({width:100,height:80,ext:"png"});
  expect(inspectCmsUpload(Buffer.from("%PDF-1.7\nexample\n%%EOF"),"application/pdf").ext).toBe("pdf");
 });
 it("deduplicates immutable files and survives service reconstruction",async()=>{
  const root=await mkdtemp(join(tmpdir(),"cms-assets-"));try{const store=memoryStore(),a=await CmsDiskAssets.create(root,store);const first=await a.upload(png(),"image/png","../../photo.png"),second=await a.upload(png(),"image/png","other.png");expect(first.id).toBe(second.id);expect(first.name).not.toContain("/");const restarted=await CmsDiskAssets.create(root,store);expect((await restarted.read(first.storageKey))!.bytes.equals(png())).toBe(true);expect(await restarted.read("../secret")).toBeNull();await writeFile(join(root,first.storageKey),"tampered");await expect(restarted.read(first.storageKey)).rejects.toThrow("cms_asset_integrity_refused");}finally{await rm(root,{recursive:true,force:true});}
 });
 it("gates unpublished assets and rejects unauthenticated or cross-origin uploads",async()=>{
  const root=await mkdtemp(join(tmpdir(),"cms-assets-"));try{const a=await CmsDiskAssets.create(root,memoryStore()),asset=await a.upload(png(),"image/png","photo.png");let allowed=false;const identity={authenticate:async()=>null},handler=createCmsAssetHandler(a,identity,{authorizeMutation:()=>false},async()=>allowed);
   expect((await handler(new Request(origin+asset.url)))!.status).toBe(404);allowed=true;expect((await handler(new Request(origin+asset.url)))!.status).toBe(200);
   expect((await handler(new Request(origin+"/api/v1/admin/cms/assets/upload",{method:"POST",body:png()})))!.status).toBe(401);
   const admin=createCmsAssetHandler(a,{authenticate:async()=>({subject:"test",role:"admin"})},{authorizeMutation:()=>false},async()=>true);
   expect((await admin(new Request(origin+"/api/v1/admin/cms/assets/upload",{method:"POST",body:png()})))!.status).toBe(403);
   expect((await handler(new Request(origin+asset.url,{method:"HEAD"})))!.headers.get("x-content-type-options")).toBe("nosniff");
  }finally{await rm(root,{recursive:true,force:true});}
 });
});

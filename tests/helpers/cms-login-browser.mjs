/** Real native-form regression with anonymous data; no database or remote service. */
import {createServer} from "node:http";
import {createRequire} from "node:module";
import {CmsSessionProvider} from "../../src/cms/session.ts";
import {toWebRequest} from "../../src/server/http/node-request-adapter.ts";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH??"playwright");
const origin="http://127.0.0.1:4431";
const session=new CmsSessionProvider({origin,secret:"ab".repeat(32),environment:"local",allowLocalDevelopmentEntry:true});
let postOrigin;
const server=createServer(async(incoming,outgoing)=>{
 const request=await toWebRequest(incoming,origin);
 if(new URL(request.url).pathname==="/admin/session")postOrigin=request.headers.get("origin");
 const response=await session.handle(request)??new Response("Anonymous CMS landing",{headers:{"Referrer-Policy":"same-origin"}});
 outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
});
let browser;
try{
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(4431,"127.0.0.1",resolve);});
 browser=await chromium.launch({headless:true,channel:"msedge"});
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto(origin+"/admin/login");await page.getByRole("button",{name:"Open local administration"}).click();await page.waitForURL(origin+"/admin/cms");
 const result=await page.evaluate(async()=>{const r=await fetch("/api/v1/admin/cms/session");return{status:r.status,value:await r.json()};});
 if(postOrigin!==origin||result.status!==200||result.value.identity.subject!=="local-admin-0001")throw Error("native_form_login_failed");
 const cross=await context.request.post(origin+"/admin/session",{headers:{Origin:"null","Content-Type":"application/x-www-form-urlencoded"},data:"nonce=invalid"});
 if(cross.status()!==403)throw Error("null_origin_accepted");
 console.log(JSON.stringify({outcome:"cms_native_form_verified",sameOriginPreserved:true,sessionAuthenticated:true,nullOriginDenied:true}));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}

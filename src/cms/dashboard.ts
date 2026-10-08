import {readFile,lstat,realpath} from "node:fs/promises";
import {resolve,relative} from "node:path";
import type {CmsSessionProvider} from "./session";
const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"same-origin","Content-Security-Policy":"default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'"};
export function createCmsDashboardHandler(directory:string,session:CmsSessionProvider,environment:"local"|"staging",legacyAdmin=false){
 const root=resolve(directory);
 return async(request:Request):Promise<Response|null>=>{
  const path=new URL(request.url).pathname,isAdmin=path==="/admin"||path.startsWith("/admin/");
  if(!isAdmin&&!/^\/_astro\/cms-admin\.(?:js|css)$/.test(path))return null;
  if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405,headers});
  if(!await session.authenticate(request))return new Response(null,{status:303,headers:{...headers,Location:"/admin/login"}});
  if(!legacyAdmin&&(path==="/admin"||path==="/admin/"))return new Response(null,{status:303,headers:{...headers,Location:"/admin/cms"}});
  if(isAdmin&&!legacyAdmin&&!path.startsWith("/admin/cms"))return new Response("This protected CMS manages website content. Sermon review continues in its existing local administration workspace.",{status:404,headers});
  const target=resolve(root,isAdmin?"index.html":path.slice(1));if(relative(root,target).startsWith(".."))return new Response("Not found",{status:404,headers});
  try{
   const stat=await lstat(target);if(!stat.isFile()||stat.isSymbolicLink()||await realpath(target)!==target)throw Error("asset_refused");
   let body=await readFile(target);
   if(isAdmin){
    let html=body.toString("utf8").replace('<body class="admin-workbench">','<body class="admin-workbench" data-cms-runtime>');
    html=html.replaceAll("Local development only",environment==="staging"?"Protected staging CMS":"Protected local CMS").replaceAll("Development identity","CMS administrator").replaceAll("local-admin-0001 · not personal sign-in",session.identity.subject+" · not production sign-in").replaceAll("Private · local access only","Private · authenticated CMS session").replaceAll("Sermon review workspace","Website content workspace").replaceAll("Loading local administration","Loading website administration").replaceAll("This local administration dashboard","This administration dashboard").replaceAll("Local administration","Website administration");
    html=html.replace("</header>",'<a class="button" href="/" style="margin-left:auto">View website</a></header>');
    if(!legacyAdmin){
     html=html.replace(/<a\b[^>]*href="(\/admin[^"]*)"[^>]*>[\s\S]*?<\/a>/g,(tag:string,href:string)=>href.startsWith("/admin/cms")?tag:"");
     html=html.replace(/<span class="nav-label">(?:Manage library|Relationships|Accountability)<\/span>/g,"").replace("</nav>",'<p class="subtle">Sermon administration remains in the local review workspace. <a href="/sermons/">Browse sermons</a></p></nav>');
    }
    if(session.localDevelopmentIdentity)html=html.replaceAll("Protected local CMS","Local development CMS").replaceAll("CMS administrator","Development identity").replaceAll("local-admin-0001 · not production sign-in","local-admin-0001 · not personal sign-in");
    body=Buffer.from(html);
   }
   return new Response(request.method==="HEAD"?null:new Uint8Array(body),{headers:{...headers,"Content-Type":isAdmin?"text/html; charset=utf-8":path.endsWith(".css")?"text/css; charset=utf-8":"text/javascript; charset=utf-8"}});
  }catch{return new Response("CMS dashboard build is unavailable.",{status:503,headers});}
 };
}

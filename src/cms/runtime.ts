import {originalSermonPreview} from './source-sermon-preview';
import {preserveSourceMetadata} from '../seo/source-metadata';
import type {SourcePublicPage} from '../seo/source-public-model';
import {publicSermonListQuerySchema} from "../api/contracts/public-sermons";
import type {PublicSermonRepository} from "../server/repositories/sermon-repository";
import type {CmsRepository} from "./repository";
import type {CmsAssetStore} from "./assets";
import {CmsDiskAssets,createCmsAssetHandler} from "./assets";
import {CmsSessionProvider} from "./session";
import {createCmsDashboardHandler} from "./dashboard";
import {createCmsApiHandler} from "./api";
import {createCmsVisualRenderHandler} from "./visual-render";
import {createCmsFrontendSnapshot} from "./frontend-adapter";
import {createPublicSermonSiteHandler,frontendResponse} from "../server/http/public-sermon-page";
import {createLocalFrontendPreviewHandler} from "../server/http/local-frontend-preview";
import {renderFrontendTaxonomyIndex} from "../frontend";
import type {FrontendTaxonomyKind} from "../frontend";
import type {FrontendRenderContext} from "../frontend/routes";
import {siteAssetResponse} from "../server/http/site-assets";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin","X-Frame-Options":"DENY"};
export interface CmsRuntimeOptions{
 repository:CmsRepository;sermons:PublicSermonRepository;assets:CmsDiskAssets;assetStore:CmsAssetStore;
 session:CmsSessionProvider;dashboardDirectory:string;environment:"local"|"staging";release:string;
 sourcePages?:()=>Promise<readonly SourcePublicPage[]>;
 ready:()=>Promise<void>;existingAdminHandler?:(request:Request)=>Promise<Response>;evaluation?:(request:Request)=>Promise<Response|null>;
}
export function createCmsRuntimeHandler(options:CmsRuntimeOptions){
 const {repository,session}=options;
 const api=createCmsApiHandler(repository,session,{authorizeMutation:request=>session.authorizeMutation(request)});
 const assets=createCmsAssetHandler(options.assets,session,session,(key,draft)=>repository.canReadAsset(key,draft));
 const dashboard=createCmsDashboardHandler(options.dashboardDirectory,session,options.environment,Boolean(options.existingAdminHandler));
 const visualRender=createCmsVisualRenderHandler({repository,session,sermons:options.sermons,environment:options.environment,...(options.sourcePages?{sourcePages:options.sourcePages}:{}),assets:async()=>(await options.assetStore.list()).filter(a=>a.type.startsWith("image/")).map(a=>({id:a.id,path:a.url,type:a.type,width:a.width??1,height:a.height??1,alt:a.alt}))});
 const selections=new Map<string,{entityId:string;revisionId?:string}>();
 const content=async(selection?:{entityId:string;revisionId?:string})=>{
  const snapshot=selection?await repository.getPreviewSnapshot(selection):await repository.getPublishedSnapshot();
  const images=(await options.assetStore.list()).filter(a=>a.type.startsWith("image/")).map(a=>({id:a.id,path:a.url,type:a.type,width:a.width??1,height:a.height??1,alt:a.alt}));
  const result=createCmsFrontendSnapshot(snapshot,images);return options.sourcePages?preserveSourceMetadata(result,await options.sourcePages()):result;
 };
 return async(request:Request):Promise<Response>=>{
  const pathname=new URL(request.url).pathname;
  const finish=(response:Response,canvas=false)=>{const result=new Headers(response.headers);for(const [key,value] of Object.entries(headers))result.set(key,canvas&&key==="X-Frame-Options"&&response.status===200?"SAMEORIGIN":value);return new Response(request.method==="HEAD"?null:response.body,{status:response.status,headers:result});};
  try{
   const sessionResponse=await session.handle(request);if(sessionResponse)return finish(sessionResponse);
   if(pathname==="/health/ready"){await options.ready();return finish(Response.json({status:"ready",release:options.release,authentication:"protected_cms_session"}));}
   if(pathname==="/robots.txt")return finish(new Response("User-agent: *\nDisallow: /\n"));
   const canvas=await visualRender(request);if(canvas)return finish(canvas,pathname.startsWith("/cms-editor-frame/"));
   const asset=await assets(request);if(asset)return finish(asset);
   if(pathname==="/api/v1/admin/cms/sermons"){
    if(!await session.authenticate(request))return finish(Response.json({error:{code:"authentication_required"}},{status:401}));
    if(request.method!=="GET")return finish(new Response("Method not allowed",{status:405}));
    const data:Array<{id:string;title:string}>=[];let page=1,total=1;
    while(data.length<total&&page<=100){const batch=await options.sermons.listPublished(publicSermonListQuerySchema.parse({page,pageSize:50,order:"DESC"}));total=batch.totalItems;data.push(...batch.data.map(s=>({id:s.id,title:s.title})));if(!batch.data.length)break;page++;}
    return finish(Response.json({data}));
   }
   if(pathname.startsWith("/api/v1/admin/cms/")||pathname==="/api/v1/admin/cms")return finish((await api(request))??new Response("Not found",{status:404}));
   if(pathname.startsWith("/api/")){
    if(options.existingAdminHandler&&pathname.startsWith("/api/v1/admin/")){
     if(!await session.authenticate(request))return finish(Response.json({error:{code:"authentication_required"}},{status:401}));
     if(!["GET","HEAD"].includes(request.method)&&!session.authorizeMutation(request))return finish(Response.json({error:{code:"csrf_required"}},{status:403}));
     return finish(await options.existingAdminHandler(request));
    }
    return finish(new Response("Not found",{status:404}));
   }
   const admin=await dashboard(request);if(admin)return finish(admin);
   const embedded=siteAssetResponse(request);if(embedded)return finish(embedded);
   if(pathname.startsWith("/cms-preview")){
    if(!await session.authenticate(request))return finish(new Response(null,{status:303,headers:{Location:"/admin/login"}}));
    const url=new URL(request.url),entityId=url.searchParams.get("entity"),revisionId=url.searchParams.get("revision");
    const sessionKey=session.sessionKey(request)!;
    if(entityId){if(!/^[a-f0-9-]{36}$/.test(entityId)||(revisionId&&!/^[a-f0-9-]{36}$/.test(revisionId)))return finish(new Response("Invalid preview selection",{status:400}));selections.set(sessionKey,{entityId,...(revisionId?{revisionId}:{})});}
    const selection=selections.get(sessionKey);if(!selection)return finish(new Response("Choose Preview from a content editor.",{status:400}));
    const context:FrontendRenderContext={mode:"preview",basePath:"/cms-preview",siteContent:await content(selection)};
    const selectedSnapshot=await repository.getPreviewSnapshot(selection),originalDocument=selectedSnapshot.entities.find(e=>e.id===selection.entityId);
    if(originalDocument?.content.template==='source-sermon'){const images=(await options.assetStore.list()).filter(a=>a.type.startsWith('image/')).map(a=>({id:a.id,path:a.url,type:a.type,width:a.width??1,height:a.height??1,alt:a.alt}));const snapshot=createCmsFrontendSnapshot(selectedSnapshot,images,false,true);return finish(await originalSermonPreview(originalDocument,await options.sourcePages?.()??[],{...context,siteContent:snapshot}));}
    const preview=createLocalFrontendPreviewHandler(options.sermons,{authorizes:()=>true},{root:"/cms-preview",context});
    return finish((await preview(request))??new Response("Not found",{status:404}));
   }
   if(!["GET","HEAD"].includes(request.method))return finish(new Response("Method not allowed",{status:405}));
   if(pathname.startsWith("/related-themes-evaluation"))return finish((await options.evaluation?.(request))??new Response("Not found",{status:404}));
   const context:FrontendRenderContext={mode:"restricted",basePath:"",siteContent:await content()};
   if(/^\/(speakers|series|books)\/$/.test(pathname)){
    const kind=pathname.split("/")[1] as FrontendTaxonomyKind,filters=await options.sermons.listPublishedFilterOptions();
    return finish(frontendResponse(renderFrontendTaxonomyIndex(kind,filters[kind],context,filters)));
   }
   return finish((await createPublicSermonSiteHandler(options.sermons,context)(request))??new Response("Not found",{status:404}));
  }catch{return finish(new Response("CMS temporarily unavailable",{status:503}));}
 };
}

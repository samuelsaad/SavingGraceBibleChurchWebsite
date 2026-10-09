import {readSourcePublicPages} from '../seo/source-public-store';
import {createSourcePublicVisitor,retainPrivateRoutes} from '../seo/site-integration';
/** D-179: request-handler integration only. Reuses the incumbent protected
 * container/socket; this module creates no server, port, proxy or listener. */
import {Pool} from "pg";
import type {PublicSermonRepository} from "../server/repositories/sermon-repository";
import {stagingConfiguration} from "../staging/guard";
import {createSealedStagingHandler,sealedHeaders} from "../staging/handler";
import {CmsSessionProvider} from "./session";
import {PostgresCmsAssetStore,CmsDiskAssets,createCmsAssetHandler,cmsUploadMaximum} from "./assets";
import {PostgresCmsRepository} from "./postgres-repository";
import {createCmsFrontendSnapshot} from "./frontend-adapter";
import {createCmsRuntimeHandler} from "./runtime";
import {readCmsSecret} from "./runtime-secrets";
import {verifyCmsSchema} from "./migration";
import {verifyStagingCmsWriter} from "./staging-writer-guard";
export async function createStagingCmsIntegration(options:{reader:Pool;sermons:PublicSermonRepository;ready:()=>Promise<void>;release:string;evaluation?:(request:Request)=>Promise<Response|null>}){
 if(process.env.CMS_SITE_ENABLED!=="1")return null;
 if(process.env.STAGING_SEALED!=="1"||process.env.NODE_ENV!=="production"||process.env.CMS_STORAGE_DIRECTORY!=="/var/lib/savinggrace/cms-assets")throw Error("cms_staging_configuration_refused");
 const verify=async()=>{await options.ready();const c=await options.reader.connect();try{await verifyCmsSchema(c);}finally{c.release();}};await verify();
 const environment=process.env.RELATED_THEMES_ENVIRONMENT;
 if(process.env.STAGING_CMS_ENABLED==="1"){
  if(environment!=="staging_protected"||process.env.CMS_ACCESS!=="protected_tunnel")throw Error("cms_protected_access_required");
  const config=stagingConfiguration(process.env),writer=new Pool({...config,user:"staging_cms_writer",password:await readCmsSecret("/run/secrets/cms_writer_password"),options:"-c timezone=UTC -c jit=off",application_name:"protected-staging-cms-writer"});
  const checkWriter=()=>verifyStagingCmsWriter(writer);
  await checkWriter();const assetStore=new PostgresCmsAssetStore(writer),assets=await CmsDiskAssets.create(process.env.CMS_STORAGE_DIRECTORY,assetStore);
  const session=new CmsSessionProvider({origin:process.env.CMS_ORIGIN??"",secret:await readCmsSecret("/run/secrets/cms_session_secret"),environment:"staging"});
  const handler=createCmsRuntimeHandler({repository:new PostgresCmsRepository(writer),assetStore,assets,session,sermons:options.sermons,dashboardDirectory:"/app/admin",environment:"staging",release:options.release,ready:async()=>{await verify();await checkWriter();},...(process.env.SOURCE_PUBLIC_ENABLED==='1'?{sourcePages:()=>readSourcePublicPages(options.reader)}:{}),...(options.evaluation?{evaluation:options.evaluation}:{})});
  const selected=process.env.SOURCE_PUBLIC_ENABLED==='1'?retainPrivateRoutes(handler,await createSourcePublicVisitor(options.reader,process.env.CMS_STORAGE_DIRECTORY,session.origin,options.sermons)):handler;
  return{handler:selected,origin:session.origin,maximumBodyBytes:cmsUploadMaximum+1024,close:()=>writer.end()};
 }
 if(environment!=="staging_public"||process.env.CMS_ACCESS||process.env.CMS_ORIGIN)throw Error("cms_public_identity_refused");
 const repository=new PostgresCmsRepository(options.reader),store=new PostgresCmsAssetStore(options.reader),assets=await CmsDiskAssets.create(process.env.CMS_STORAGE_DIRECTORY,store);
 const assetHandler=createCmsAssetHandler(assets,{authenticate:async()=>null},{authorizeMutation:()=>false},(key,draft)=>repository.canReadAsset(key,draft));
 const content=async()=>createCmsFrontendSnapshot(await repository.getPublishedSnapshot(),(await store.list()).filter(a=>a.type.startsWith("image/")).map(a=>({id:a.id,path:a.url,type:a.type,width:a.width??1,height:a.height??1,alt:a.alt})));
 const visitor=createSealedStagingHandler(options.sermons,verify,options.release,process.env.RESTRICTED_FRONTEND_DISABLED==="1",options.evaluation,{content});
 const handler=async(request:Request)=>{
  const path=new URL(request.url).pathname;
  if(process.env.RESTRICTED_FRONTEND_DISABLED!=="1"&&path.startsWith("/cms-assets/")){
   const response=await assetHandler(request);if(response){const h=new Headers(response.headers);for(const [k,v] of Object.entries(sealedHeaders))h.set(k,v);return new Response(response.body,{status:response.status,headers:h});}
  }
  return visitor(request);
 };
 const selected=process.env.SOURCE_PUBLIC_ENABLED==='1'?retainPrivateRoutes(handler,await createSourcePublicVisitor(options.reader,process.env.CMS_STORAGE_DIRECTORY,"http://127.0.0.1:8080",options.sermons)):handler;
 return{handler:selected,origin:"http://127.0.0.1:8080",maximumBodyBytes:16384,close:async()=>{}};
}

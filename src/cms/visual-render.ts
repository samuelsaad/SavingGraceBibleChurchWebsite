import {preserveSourceMetadata} from '../seo/source-metadata';
import type {SourcePublicPage} from '../seo/source-public-model';
/** Transient server-rendered canvases. Tokens are session-bound transport only;
 * drafts, publication and revision history remain in the existing CMS repository. */
import {randomBytes} from "node:crypto";
import {z,ZodError} from "zod";
import {assertAdminAccess} from "../application/authorization";
import {ApplicationError} from "../application/errors";
import type {PublicSermonRepository,PaginatedSermons,PublicSermonFilterOptions} from "../server/repositories/sermon-repository";
import type {PublicSermonListQuery} from "../api/contracts/public-sermons";
import {createChurchSiteHandler} from "../server/http/church-site";
import {frontendResponse} from "../server/http/frontend-response";
import type {FrontendAsset} from "../frontend/content/site-snapshot";
import type {FrontendRenderContext} from "../frontend/routes";
import type {CmsDocument,CmsEntity,CmsSnapshot} from "./model";
import type {CmsRepository} from "./repository";
import type {CmsSessionProvider} from "./session";
import {readCmsJsonBody} from "./api";
import {createCmsFrontendSnapshot} from "./frontend-adapter";
import {cmsPathSchema,pathForContent,validateCmsContent} from "./validation";

const renderPath="/api/v1/admin/cms/render",frameRoot="/cms-editor-frame/";
const ttl=5*60*1000,maximumFrames=200,maximumSessionFrames=8,maximumFrameBytes=4_000_000,maximumCacheBytes=32_000_000;
const inputSchema=z.object({entityId:z.uuid(),expectedRowVersion:z.number().int().positive(),content:z.record(z.string(),z.unknown()),mode:z.enum(["edit","preview"]).default("edit"),path:cmsPathSchema.optional()}).strict();
const privateHeaders={"Cache-Control":"private, no-store, max-age=0, must-revalidate","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff","Referrer-Policy":"same-origin","X-Frame-Options":"DENY"};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
type Frame={sessionKey:string;html:string;expires:number;size:number};
export interface CmsVisualRenderOptions{
 repository:Pick<CmsRepository,"get"|"getPublishedSnapshot">;sermons:PublicSermonRepository;
 session:Pick<CmsSessionProvider,"authenticate"|"authorizeMutation"|"sessionKey">;
 sourcePages?:()=>Promise<readonly SourcePublicPage[]>;
 assets:()=>Promise<readonly FrontendAsset[]>;environment:"local"|"staging";now?:()=>number;
}
function overlay(snapshot:CmsSnapshot,entity:CmsEntity,content:CmsDocument):CmsSnapshot{
 const result=structuredClone(snapshot),path=pathForContent(entity.kind,content);
 if(path&&result.routes.some(route=>route.path===path&&route.entityId!==entity.id))throw new ApplicationError(409,"path_in_use","Another page owns this address");
 const initialMetadata=result.entities.find(item=>item.id===entity.id)?.initialMetadata;
 result.entities=result.entities.filter(item=>item.id!==entity.id);
 result.entities.push({...(initialMetadata?{initialMetadata}:{}),id:entity.id,key:entity.key,kind:entity.kind,revisionId:entity.draftRevisionId,content,payload:content});
 result.documents[entity.key]=content;
 result.routes=result.routes.filter(route=>route.entityId!==entity.id);
 if(path)result.routes.push({path,entityId:entity.id,status:200,targetPath:null});
 return result;
}
function canvasPath(entity:CmsEntity,content:CmsDocument,snapshot:CmsSnapshot,requested?:string):string{
 const own=pathForContent(entity.kind,content);
 if(own){if(requested&&requested!==own)throw new ApplicationError(400,"preview_path_mismatch","Preview this page at its own address");return own;}
 if(requested){if(!snapshot.routes.some(route=>route.path===requested&&route.status===200))throw new ApplicationError(400,"preview_path_unavailable","Choose a published website page");return requested;}
 if(entity.kind==="venue")return snapshot.entities.find(item=>item.kind==="event"&&item.content.venue===content.id)?.content.path as string||"/events/";
 return "/";
}
/** One render may ask for both the newest six footer cards and the newest three
 * section cards. Reuse only this request's already-eligible result; a later POST
 * always queries the authoritative selector again, including after new holds. */
export function createCmsRenderSermonRepository(repository:PublicSermonRepository):PublicSermonRepository {
 const lists=new Map<string,Array<{size:number;result:Promise<PaginatedSermons>}>>();
 const filters=new Map<string,Promise<PublicSermonFilterOptions>>();
 const key=(query:PublicSermonListQuery|undefined,omitSize=false)=>JSON.stringify(Object.fromEntries(Object.entries(query??{}).filter(([name,value])=>value!==undefined&&(!omitSize||name!=="pageSize")).sort(([a],[b])=>a.localeCompare(b))));
 return {
  async listPublished(query){
   // Different later page sizes imply different offsets, so only page one can
   // safely reuse a larger limit. Other pages require an exact query match.
   const cacheKey=key(query,query.page===1),entries=lists.get(cacheKey)??[];
   let entry=entries.find(item=>item.size>=query.pageSize);
   if(!entry){entry={size:query.pageSize,result:repository.listPublished(query)};entries.push(entry);lists.set(cacheKey,entries);}
   const result=await entry.result;return {data:result.data.slice(0,query.pageSize),totalItems:result.totalItems};
  },
  listPublishedFilterOptions(query){const cacheKey=key(query);let result=filters.get(cacheKey);if(!result){result=repository.listPublishedFilterOptions(query);filters.set(cacheKey,result);}return result;},
  findPublishedBySlug:slug=>repository.findPublishedBySlug(slug),
  listPublishedTopicalSermons:()=>repository.listPublishedTopicalSermons(),
  listPublishedSeriesRepresentatives:()=>repository.listPublishedSeriesRepresentatives(),
  listPublishedSitemapEntries:()=>repository.listPublishedSitemapEntries(),
  findPublicPathDisposition:path=>repository.findPublicPathDisposition(path)
 };
}
export function createCmsVisualRenderHandler(options:CmsVisualRenderOptions){
 const frames=new Map<string,Frame>(),now=options.now??Date.now;
 let cacheBytes=0;
 const remove=(key:string)=>{const frame=frames.get(key);if(frame){cacheBytes-=frame.size;frames.delete(key);}};
 const prune=()=>{for(const [key,frame]of frames)if(frame.expires<=now())remove(key);};
 return async(request:Request):Promise<Response|null>=>{
  const url=new URL(request.url),isFrame=url.pathname.startsWith(frameRoot);
  if(url.pathname!==renderPath&&!isFrame)return null;
  try{
   const identity=await options.session.authenticate(request);if(!identity)return json({error:{code:"authentication_required"}},401);
   assertAdminAccess(identity);
   const sessionKey=options.session.sessionKey(request);if(!sessionKey)return json({error:{code:"authentication_required"}},401);
   prune();
   if(isFrame){
    if(!["GET","HEAD"].includes(request.method))return json({error:{code:"method_not_allowed"}},405);
    const token=url.pathname.slice(frameRoot.length);
    const frame=/^[a-zA-Z0-9_-]{43}$/.test(token)?frames.get(token):null;
    if(!frame||frame.sessionKey!==sessionKey)return json({error:{code:"canvas_expired",message:"Refresh the editor preview."}},404);
    const response=frontendResponse(frame.html,{privatePreview:true});
    const headers=new Headers(response.headers);
    headers.set("Content-Security-Policy",headers.get("Content-Security-Policy")!.replace("frame-ancestors 'none'","frame-ancestors 'self'"));
    headers.set("X-Frame-Options","SAMEORIGIN");headers.set("Referrer-Policy","same-origin");
    return new Response(request.method==="HEAD"?null:response.body,{headers});
   }
   if(request.method!=="POST")return json({error:{code:"method_not_allowed"}},405);
   if(request.headers.get("origin")!==url.origin||request.headers.get("sec-fetch-site")==="cross-site"||!options.session.authorizeMutation(request))return json({error:{code:"csrf_rejected"}},403);
   const input=inputSchema.parse(await readCmsJsonBody(request)),entity=await options.repository.get(input.entityId);
   if(!entity)return json({error:{code:"not_found"}},404);
   if(entity.rowVersion!==input.expectedRowVersion)return json({error:{code:"version_conflict",message:"This content changed in another session. Reload before continuing.",currentRowVersion:entity.rowVersion}},409);
   const content=validateCmsContent(entity.kind,input.content);
   const snapshot=overlay(await options.repository.getPublishedSnapshot(),entity,content),path=canvasPath(entity,content,snapshot,input.path);
   const selectedContent=createCmsFrontendSnapshot(snapshot,await options.assets(),input.mode==="edit");
   const projectedContent=options.sourcePages?preserveSourceMetadata(selectedContent,await options.sourcePages()):selectedContent;
   const context:FrontendRenderContext={mode:"restricted",basePath:"",siteContent:projectedContent,...(input.mode==="edit"?{visualEditor:{entityId:entity.id,kind:entity.kind}}:{})};
   const response=await createChurchSiteHandler(createCmsRenderSermonRepository(options.sermons),context)(new Request(url.origin+path));
   if(!response||response.status!==200||!response.headers.get("content-type")?.startsWith("text/html"))return json({error:{code:"preview_unavailable",message:"This content does not currently have a website preview."}},422);
   const html=await response.text(),size=Buffer.byteLength(html);
   if(size>maximumFrameBytes)return json({error:{code:"preview_too_large",message:"This page is too large to preview."}},413);
   // Refuse an in-flight render if another session saved while the repository was read.
   const current=await options.repository.get(entity.id);
   if(!current||current.rowVersion!==entity.rowVersion)return json({error:{code:"version_conflict",message:"This content changed while its preview was loading."}},409);
   const own=[...frames].filter(([,frame])=>frame.sessionKey===sessionKey);
   while(own.length>=maximumSessionFrames){const previous=own.shift()!;remove(previous[0]);}
   while(frames.size>=maximumFrames||cacheBytes+size>maximumCacheBytes)remove(frames.keys().next().value!);
   const token=randomBytes(32).toString("base64url"),expires=now()+ttl;
   frames.set(token,{sessionKey,html,expires,size});cacheBytes+=size;
   return json({frameUrl:frameRoot+token,environment:options.environment,path,currentRowVersion:entity.rowVersion,kind:entity.kind,expiresAt:new Date(expires).toISOString()});
  }catch(error){
   if(error instanceof ZodError)return json({error:{code:"invalid_request",issues:error.issues.map(issue=>({path:issue.path.join("."),message:issue.message}))}},400);
   if(error instanceof ApplicationError)return json({error:{code:error.code,message:error.message}},error.status);
   return json({error:{code:"preview_unavailable",message:"The website preview is temporarily unavailable."}},503);
  }
 };
}

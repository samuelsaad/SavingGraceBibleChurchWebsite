import {randomUUID} from 'node:crypto';
import {ZodError,z} from 'zod';
import {ApplicationError} from '../application/errors';
import {assertAdminAccess} from '../application/authorization';
import type {IdentityProvider} from '../server/auth/identity-provider';
import type {CmsRepository} from './repository';
import {cmsCreateSchema,cmsSaveSchema,cmsRevisionActionSchema,cmsUnpublishSchema} from './validation';

export interface CmsApiSecurity {authorizeMutation(request:Request):boolean|Promise<boolean>}
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'};
function json(status:number,value:unknown,extra:Record<string,string>={}):Response{return new Response(JSON.stringify(value),{status,headers:{...headers,...extra}});}
async function body(request:Request):Promise<unknown>{
 if(!/^application\/json(?:;|$)/iu.test(request.headers.get('content-type')??''))throw new ApplicationError(415,'json_required','Send JSON content');
 const length=Number(request.headers.get('content-length')??'0');if(!Number.isFinite(length)||length>2_000_000)throw new ApplicationError(413,'request_too_large','Content is too large');
 const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;if(reader){while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>2_000_000){await reader.cancel();throw new ApplicationError(413,'request_too_large','Content is too large');}chunks.push(next.value);}}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ApplicationError(400,'invalid_json','Send valid JSON content');}
}
export function createCmsApiHandler(repository:CmsRepository,identityProvider:IdentityProvider,security:CmsApiSecurity){
 return async(request:Request):Promise<Response|null>=>{
  const url=new URL(request.url);const root='/api/v1/admin/cms/entities';if(url.pathname!==root&&!url.pathname.startsWith(root+'/'))return null;
  try{
   const identity=await identityProvider.authenticate(request);if(!identity)return json(401,{error:{code:'authentication_required'}});assertAdminAccess(identity);
   const mutation=!['GET','HEAD','OPTIONS'].includes(request.method);
   if(mutation&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'||!await security.authorizeMutation(request)))return json(403,{error:{code:'csrf_rejected'}});
   const requestId=request.headers.get('x-request-id');const actor={subject:identity.subject,role:'admin' as const,correlationId:requestId&&/^[A-Za-z0-9._:-]{1,100}$/u.test(requestId)?requestId:randomUUID()};
   if(url.pathname===root){
    if(request.method==='GET')return json(200,{data:await repository.list()});
    if(request.method==='POST')return json(201,await repository.create(cmsCreateSchema.parse(await body(request)),actor));
    return json(405,{error:{code:'method_not_allowed'}},{Allow:'GET, POST'});
   }
   const match=/^\/api\/v1\/admin\/cms\/entities\/([^/]+)(?:\/(revisions|publish|unpublish|restore))?\/?$/u.exec(url.pathname);if(!match)return json(404,{error:{code:'not_found'}});
   const id=z.uuid().parse(decodeURIComponent(match[1]!));const action=match[2];
   if(!action){
    if(request.method==='GET'){const entity=await repository.get(id);return entity?json(200,entity):json(404,{error:{code:'not_found'}});}
    if(request.method==='PUT')return json(200,await repository.save(id,cmsSaveSchema.parse(await body(request)),actor));
    return json(405,{error:{code:'method_not_allowed'}},{Allow:'GET, PUT'});
   }
   if(action==='revisions'){if(request.method==='GET')return json(200,{data:await repository.history(id)});return json(405,{error:{code:'method_not_allowed'}},{Allow:'GET'});}
   if(request.method!=='POST')return json(405,{error:{code:'method_not_allowed'}},{Allow:'POST'});
   if(action==='publish')return json(200,await repository.publish(id,cmsRevisionActionSchema.parse(await body(request)),actor));
   if(action==='restore')return json(200,await repository.restore(id,cmsRevisionActionSchema.parse(await body(request)),actor));
   const input=cmsUnpublishSchema.parse(await body(request));return json(200,await repository.unpublish(id,{expectedRowVersion:input.expectedRowVersion,disposition:input.disposition,...(input.targetPath?{targetPath:input.targetPath}:{})},actor));
  }catch(error){
   if(error instanceof ZodError)return json(400,{error:{code:'invalid_request',issues:error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message}))}});
   if(error instanceof ApplicationError)return json(error.status,{error:{code:error.code,message:error.message,...(error.issues?{issues:error.issues}:{})}});
   if(error instanceof URIError)return json(400,{error:{code:'invalid_path'}});
   return json(500,{error:{code:'internal_error'}});
  }
 };
}

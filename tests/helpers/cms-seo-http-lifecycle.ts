import {preserveSourceMetadata} from '../../src/seo/source-metadata';
import type {SourcePublicPage} from '../../src/seo/source-public-model';
import {createServer} from 'node:http';
import {once} from 'node:events';
import type {AddressInfo} from 'node:net';
import {expect} from 'vitest';
import type {CmsRepository} from '../../src/cms/repository';
import type {CmsEntity} from '../../src/cms/model';
import {createCmsApiHandler} from '../../src/cms/api';
import {createCmsFrontendSnapshot} from '../../src/cms/frontend-adapter';
import {createChurchSiteHandler} from '../../src/server/http/church-site';
import {toWebRequest} from '../../src/server/http/node-request-adapter';
import {renderFrontendBoundaryPage} from '../../src/frontend/pages/boundary';
import {frontendResponse} from '../../src/server/http/frontend-response';
import {emptyFilterOptions} from '../../src/frontend';
import type {PublicSermonRepository} from '../../src/server/repositories/sermon-repository';

const sermons:PublicSermonRepository={listPublished:async()=>({data:[],totalItems:0}),listPublishedFilterOptions:async()=>emptyFilterOptions,findPublishedBySlug:async()=>null,listPublishedSitemapEntries:async()=>[],findPublicPathDisposition:async()=>null,listPublishedTopicalSermons:async()=>[],listPublishedSeriesRepresentatives:async()=>[]};
const page=(id:string)=>({id,path:`/http-${id}/`,title:'Anonymous HTTP title',description:'Anonymous HTTP description',section:'about',modules:[{id:'copy',enabled:true,block:{kind:'paragraph',text:'Anonymous HTTP visible body'}}],seo:{title:'Anonymous exact title',description:'Anonymous exact description'}});

/** Called only from the existing, verified disposable PostgreSQL test family. */
export async function verifyCmsSeoHttpLifecycle(repository:CmsRepository):Promise<void>{
 const api=createCmsApiHandler(repository,{authenticate:async request=>request.headers.get('x-anonymous-admin')==='yes'?{subject:'anonymous-cms-integration',role:'admin'}:null},{authorizeMutation:request=>request.headers.get('x-csrf-token')==='anonymous-http-csrf'});
 const original:SourcePublicPage={path:'/http-lifecycle/',kind:'page',sourceUrl:'https://www.savinggrace.org.au/http-lifecycle/',sourceId:1,capturedAt:'2026-01-01T00:00:00Z',responseSha256:'a'.repeat(64),title:'Original fixture title',heading:'Original fixture heading',description:null,language:'en-AU',indexable:true,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[{tag:'p',text:'Anonymous retained original copy'}],links:[],mediaReferences:[],passageTerms:[],sermon:null,issues:[]};
 const church=createChurchSiteHandler(sermons,{mode:'public',basePath:''},{content:async()=>preserveSourceMetadata(createCmsFrontendSnapshot(await repository.getPublishedSnapshot()),[original])});
 let origin='';
 const server=createServer(async(incoming,outgoing)=>{
  try{
   if(incoming.headers.host!==new URL(origin).host)throw Error('Unexpected fixture host');
   const request=await toWebRequest(incoming,origin),url=new URL(request.url);
   let response:Response|null=null;
   if(url.pathname.startsWith('/api/'))response=await api(request);
   else if(url.pathname.startsWith('/cms-preview/')){
    if(request.headers.get('x-anonymous-admin')!=='yes')response=new Response(null,{status:401,headers:{'X-Robots-Tag':'noindex, nofollow','Cache-Control':'private, no-store'}});
    else response=await createChurchSiteHandler(sermons,{mode:'preview',basePath:'/cms-preview'},{content:async()=>createCmsFrontendSnapshot(await repository.getPreviewSnapshot({entityId:url.searchParams.get('entity')!}))})(request);
   }else response=await church(request);
   response??=frontendResponse(renderFrontendBoundaryPage({title:'Not found',message:'Anonymous fixture unavailable'}),{status:404});
   outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(incoming.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch{outgoing.writeHead(500,{'Cache-Control':'no-store'});outgoing.end('anonymous_fixture_failure');}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${(server.address()as AddressInfo).port}`;
 const request=(path:string,method='GET',body?:unknown,authorized=true)=>fetch(origin+path,{method,redirect:'manual',headers:{...(authorized?{'x-anonymous-admin':'yes','x-csrf-token':'anonymous-http-csrf'}:{}),Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const mutate=async(path:string,method:string,body:unknown):Promise<CmsEntity>=>{const response=await request('/api/v1/admin/cms/entities'+path,method,body);expect(response.status).toBeGreaterThanOrEqual(200);expect(response.status).toBeLessThan(300);return response.json()as Promise<CmsEntity>;};
 const publish=(entity:CmsEntity)=>mutate(`/${entity.id}/publish`,'POST',{expectedRowVersion:entity.rowVersion,revisionId:entity.draftRevisionId});
 const save=(entity:CmsEntity,content:unknown)=>mutate(`/${entity.id}`,'PUT',{expectedRowVersion:entity.rowVersion,content});
 const read=async(path:string)=>{const response=await request(path);return{response,body:await response.text()};};
 try{
  let entity=await mutate('','POST',{key:'page:http-lifecycle',kind:'page',content:page('lifecycle')});
  expect((await request('/http-lifecycle/')).status).toBe(404);expect((await read('/sitemap.xml')).body).not.toContain('/http-lifecycle/');
  expect((await request(`/cms-preview/http-lifecycle/?entity=${entity.id}`,'GET',undefined,false)).status).toBe(401);
  const preview=await read(`/cms-preview/http-lifecycle/?entity=${entity.id}`);expect(preview.response.status).toBe(200);expect(preview.body).toContain('noindex, nofollow, noarchive');expect(preview.body).not.toContain('rel="canonical"');expect(preview.response.headers.get('cache-control')).toContain('no-store');
  entity=await publish(entity);const original=entity.draftRevisionId;
  let rendered=await read('/http-lifecycle/');expect(rendered.response.status).toBe(200);expect(rendered.body).toContain('<title>Anonymous exact title</title>');expect(rendered.body).toContain('Anonymous HTTP visible body');expect(rendered.body.match(/rel="canonical"/g)).toHaveLength(1);expect(rendered.response.headers.get('cache-control')).toContain('no-store');expect((await read('/sitemap.xml')).body).toContain('/http-lifecycle/');
  expect(rendered.body).toContain('Anonymous retained original copy');
  entity=await save(entity,{...entity.draft.content,seo:{title:'Changed draft SEO'},modules:[{id:'copy',enabled:false,block:{kind:'paragraph',text:'Anonymous HTTP visible body'}}]});
  expect((await read('/http-lifecycle/')).body).toContain('<title>Anonymous exact title</title>');
  entity=await publish(entity);rendered=await read('/http-lifecycle/');expect(rendered.body).toContain('<title>Changed draft SEO</title>');expect(rendered.body).not.toContain('Anonymous HTTP visible body');expect(rendered.response.status).toBe(200);expect((await read('/sitemap.xml')).body).toContain('/http-lifecycle/');
  expect(rendered.body).toContain('Anonymous retained original copy');
  entity=await save(entity,{...entity.draft.content,seo:{title:'Changed draft SEO',replaceSourceContent:true}});expect((await read('/http-lifecycle/')).body).toContain('Anonymous retained original copy');entity=await publish(entity);expect((await read('/http-lifecycle/')).body).not.toContain('Anonymous retained original copy');
  entity=await save(entity,{...entity.draft.content,path:'/http-renamed/'});entity=await publish(entity);
  entity=await save(entity,{...entity.draft.content,path:'/http-final/'});entity=await publish(entity);
  for(const path of ['/http-lifecycle/','/http-lifecycle','/http-renamed/']){const response=await request(path);expect(response.status).toBe(301);expect(response.headers.get('location')).toBe('/http-final/');}
  const published=entity.publishedRevisionId;
  entity=await mutate(`/${entity.id}/restore`,'POST',{expectedRowVersion:entity.rowVersion,revisionId:original});expect(entity.publishedRevisionId).toBe(published);expect((await request('/http-final/')).status).toBe(200);expect((await request('/http-lifecycle/')).status).toBe(301);
  entity=await publish(entity);expect((await request('/http-final/')).headers.get('location')).toBe('/http-lifecycle/');expect((await read('/http-lifecycle/')).body).toContain('Anonymous HTTP visible body');
  let linking=await mutate('','POST',{key:'page:http-linking',kind:'page',content:{...page('linking'),modules:[{id:'link',enabled:true,block:{kind:'paragraph',text:'[Destination](/http-final/?from=fixture#copy)'}}]}});linking=await publish(linking);
  expect((await read('/http-linking/')).body).toContain('href="/http-lifecycle/?from=fixture#copy"');
  let removal=await request(`/api/v1/admin/cms/entities/${entity.id}/unpublish`,'POST',{expectedRowVersion:entity.rowVersion,disposition:'gone'});expect(removal.status).toBe(409);expect(await removal.json()).toMatchObject({error:{code:'page_in_use'}});
  linking=await save(linking,{...linking.draft.content,modules:[]});await publish(linking);
  entity=await mutate(`/${entity.id}/unpublish`,'POST',{expectedRowVersion:entity.rowVersion,disposition:'gone'});
  for(const path of ['/http-lifecycle/','/http-renamed/','/http-final/']){rendered=await read(path);expect(rendered.response.status).toBe(410);expect(rendered.body).not.toContain('rel="canonical"');expect((await read('/sitemap.xml')).body).not.toContain(path);}
  // Removal never destroys the immutable revisions; the explicit saved draft may be republished.
  expect((await repository.history(entity.id)).length).toBeGreaterThan(4);entity=await publish(entity);expect((await request('/http-lifecycle/')).status).toBe(200);
  let replacement=await mutate('','POST',{key:'page:http-replacement',kind:'page',content:page('replacement')});replacement=await publish(replacement);
  entity=await mutate(`/${entity.id}/unpublish`,'POST',{expectedRowVersion:entity.rowVersion,disposition:'redirect',targetPath:'/http-replacement/'});
  replacement=await save(replacement,{...replacement.draft.content,path:'/http-replacement-final/'});replacement=await publish(replacement);
  for(const path of ['/http-lifecycle/','/http-renamed/','/http-final/','/http-replacement/'])expect((await request(path)).headers.get('location')).toBe('/http-replacement-final/');
  replacement=await save(replacement,{...replacement.draft.content,seo:{noindex:true}});replacement=await publish(replacement);
  expect((await read('/http-replacement-final/')).body).toContain('name="robots" content="noindex, follow"');expect((await read('/sitemap.xml')).body).not.toContain('/http-replacement-final/');
  const forbidden=await request(`/api/v1/admin/cms/entities/${replacement.id}`,'DELETE',{expectedRowVersion:replacement.rowVersion});expect([404,405]).toContain(forbidden.status);expect(await repository.get(replacement.id)).not.toBeNull();
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}

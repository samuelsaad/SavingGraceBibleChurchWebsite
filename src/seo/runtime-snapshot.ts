import {createLegacySourceSearch} from './source-search';
/** Version-keyed runtime snapshots. Every request checks current database state. */
import type {Pool} from 'pg';
import {legacyDisposition} from '../frontend/content/registry';
import {publicRenderContext,type FrontendRenderContext} from '../frontend/routes';
import {PostgresCmsRepository} from '../cms/postgres-repository';
import {PostgresCmsAssetStore,CmsDiskAssets,createCmsAssetHandler} from '../cms/assets';
import {createCmsFrontendSnapshot} from '../cms/frontend-adapter';
import {PostgresSermonRepository} from '../server/repositories/postgres-sermon-repository';
import {siteAssetResponse} from '../server/http/site-assets';
import {readSourcePublicPages} from './source-public-store';
import {createCompositeSourceSermonRepository} from './composite-sermon-repository';
import {createSourcePublicPageHandler,sourcePublicSitemap} from './source-public-handler';
import {createSourcePublicAssetHandler} from './source-public-assets';
import {preserveSourceMetadata} from './source-metadata';
import {createSeoHttpAdapter} from './http-adapter';
import type {SeoHttpPolicyInput} from './http-policy';
import {sha256,stableJson,type SourcePublicPage} from './source-public-model';

export function sourceRoutePolicy(pages:readonly SourcePublicPage[],routes:readonly import('../cms/model').CmsRoute[]=[],context:FrontendRenderContext=publicRenderContext){
 const currentRoutes=new Map(routes.map(route=>[route.path,route]));
 const canonicalPath=(path:string)=>{
  let target=path;const seen=new Set<string>();
  while(!seen.has(target)&&seen.size<10){
   seen.add(target);const route=currentRoutes.get(target);
   if(route?.status===200)return target;
   if(route?.status===410)return null;
   if(route?.status===301){if(!route.targetPath)return null;target=route.targetPath;continue;}
   const legacy=legacyDisposition(target,context);
   if(!legacy)return target;
   if(legacy.kind!=="redirect")return null;
   target=legacy.location;
  }
  return null;
 };
 const ids=new Map<string,Set<string>>();
 for(const page of pages){
  if(page.issues.length || page.kind==='asset' || page.kind==='feed' || page.path.includes('?') || page.sourceId===null)continue;
  const id=String(page.sourceId);if(!/^[1-9][0-9]*$/u.test(id))continue;
  const target=canonicalPath(page.path);if(!target)continue;
  const paths=ids.get(id)??new Set<string>();paths.add(target);ids.set(id,paths);
 }
 const sourceShortlinks=Object.fromEntries([...ids].filter(([,paths])=>paths.size===1).map(([id,paths])=>[id,[...paths][0]! ]));
 const indexableArchivePaths=pages.filter(page=>page.kind==='archive'&&page.indexable&&!page.issues.length
  && /^\/sermons\/(?:page\/(?:[2-9]|[1-9][0-9]+)\/)?\?(?:sermon_series|sermon_speaker|sermon_topics|sermon_book)=[a-z0-9-]+$/u.test(page.path)).map(page=>page.path);
 return {sourceShortlinks,indexableArchivePaths:[...new Set(indexableArchivePaths)].sort()};
}

/** Only small mutable pointers/metadata, never the source or CMS document bodies. */
export const sourceRuntimeFingerprintSql=`SELECT jsonb_build_object(
 'source',(SELECT COALESCE(jsonb_agg(jsonb_build_array(path,version_sha256,source_wordpress_id,withdrawn,row_version) ORDER BY path COLLATE "C"),'[]'::jsonb) FROM source_public_routes),
 'sermons',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,source_wordpress_id,slug,status,row_version,updated_at,deleted_at,summary_status) ORDER BY id),'[]'::jsonb) FROM sermons),
 'transcripts',(SELECT COALESCE(jsonb_agg(jsonb_build_array(sermon_id,row_version,status,grounding_revision_id,updated_at) ORDER BY sermon_id),'[]'::jsonb) FROM sermon_transcripts),
 'questions',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,sermon_id,row_version,status,display_order,updated_at) ORDER BY id),'[]'::jsonb) FROM sermon_question_answers),
 'references',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,sermon_id,row_version,review_status,updated_at) ORDER BY id),'[]'::jsonb) FROM scripture_references),
 'passageDecisions',(SELECT COALESCE(jsonb_agg(jsonb_build_array(sermon_id,row_version,review_status,updated_at) ORDER BY sermon_id),'[]'::jsonb) FROM sermon_primary_passage_reviews),
 'grounding',(SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY sermon_id,transcript_row_version,transcript_sha256),'[]'::jsonb) FROM sermon_transcript_legacy_grounding_bindings g),
 'speakers',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,row_version,updated_at) ORDER BY id),'[]'::jsonb) FROM speakers),
 'series',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,row_version,updated_at) ORDER BY id),'[]'::jsonb) FROM series),
 'books',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,row_version,review_status,updated_at) ORDER BY id),'[]'::jsonb) FROM book_classifications),
 'bibleBooks',(SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY id),'[]'::jsonb) FROM bible_books b),
 'seriesMap',(SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY sermon_id,series_id),'[]'::jsonb) FROM sermon_series_map m),
 'bookMap',(SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY sermon_id,book_classification_id),'[]'::jsonb) FROM sermon_book_classifications m),
 'sourceTerms',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,updated_at) ORDER BY id),'[]'::jsonb) FROM source_taxonomy_terms),
 'sourceTermMap',(SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY sermon_id,source_taxonomy_term_id),'[]'::jsonb) FROM sermon_source_terms m),
 'media',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,sermon_id,updated_at,availability_status,display_order) ORDER BY id),'[]'::jsonb) FROM sermon_media),
 'editorialChanges',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,created_at) ORDER BY id),'[]'::jsonb) FROM audit_events WHERE entity_type='sermon' AND actor_role='admin' AND action='sermon.update' AND outcome='succeeded'),
 'redirects',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY old_path COLLATE "C"),'[]'::jsonb) FROM redirects r),
 'cms',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,key,kind,published_revision_id) ORDER BY id),'[]'::jsonb) FROM cms_entities),
 'cmsRoutes',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY path COLLATE "C"),'[]'::jsonb) FROM cms_routes r),
 'assets',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM media_assets a)
) AS fingerprint`;
export async function sourceRuntimeFingerprint(reader:Pick<Pool,'query'>){
 const row=(await reader.query(sourceRuntimeFingerprintSql)).rows[0] as {fingerprint:unknown}|undefined;
 if(!row?.fingerprint)throw Error('source_runtime_fingerprint_missing');
 return sha256(stableJson(row.fingerprint));
}

export function versionedHandlerCache<T>(fingerprint:()=>Promise<string>,build:(version:string)=>Promise<T>){
 let selected:{version:string;value:T}|null=null;
 let inFlight:Promise<void>|null=null;
 return async():Promise<{version:string;value:T}>=>{
  for(let attempt=0;attempt<5;attempt++){
   const version=await fingerprint();
   if(selected?.version===version)return selected;
   if(inFlight){await inFlight;continue;}
   inFlight=(async()=>{const value=await build(version);if(await fingerprint()===version)selected={version,value};})().finally(()=>{inFlight=null;});
   await inFlight;
  }
  throw Error('source_runtime_changed_during_snapshot');
 };
}

export async function createVersionedSourceHandler(options:{reader:Pool;assetDirectory:string;policy:SeoHttpPolicyInput;releaseIdentity:string;acceptedStageRepository?:import('../server/repositories/sermon-repository').PublicSermonRepository}){
 if(options.acceptedStageRepository&&(options.policy.environment!=='staging'||process.env.STAGING_SEALED!=='1'))throw Error('source_runtime_staging_supplement_refused');
 if(!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(options.releaseIdentity))throw Error('source_runtime_release_identity');
 const cms=new PostgresCmsRepository(options.reader),store=new PostgresCmsAssetStore(options.reader),editorial=new PostgresSermonRepository(options.reader);
 const assets=await CmsDiskAssets.create(options.assetDirectory,store);
 const assetHandler=createCmsAssetHandler(assets,{authenticate:async()=>null},{authorizeMutation:()=>false},async(key,draft)=>!draft&&await cms.canReadAsset(key,false));
 const select=versionedHandlerCache(()=>sourceRuntimeFingerprint(options.reader),async(version)=>{
  const [pages,snapshot,images]=await Promise.all([readSourcePublicPages(options.reader),cms.getPublishedSnapshot(),store.list()]);
  const sermons=await createCompositeSourceSermonRepository(pages,options.reader,options.acceptedStageRepository);
  const sourceAssets=createSourcePublicAssetHandler(pages,options.assetDirectory);
  const content=preserveSourceMetadata(createCmsFrontendSnapshot(snapshot,images.filter(a=>a.type.startsWith('image/')).map(a=>({id:a.id,path:a.url,type:a.type,width:a.width??1,height:a.height??1,alt:a.alt}))),pages);
  const routes=sourceRoutePolicy(pages,snapshot.routes,{...publicRenderContext,siteContent:content});
  routes.sourceShortlinks={...routes.sourceShortlinks,...sermons.verifiedSourceShortlinks()};
  const handler=createSeoHttpAdapter({policy:options.policy,sermons,...routes,content:async()=>content,publicSearch:createLegacySourceSearch(pages,content,sermons,sermons.verifiedSourceShortlinks()),
   sourcePage:createSourcePublicPageHandler(pages),sourceQueryPage:createSourcePublicPageHandler(pages,true),sourceSitemap:async()=>sourcePublicSitemap(pages,{...publicRenderContext,siteContent:content}),sourceDisposition:path=>editorial.findPublicPathDisposition(path),
   publicAsset:async request=>{const response=await sourceAssets(request)??siteAssetResponse(request)??await assetHandler(request);
    if(response&&options.policy.environment==='production'&&response.status===200){if(!['application/rss+xml','application/atom+xml'].includes(response.headers.get('Content-Type')?.split(';')[0]??''))response.headers.delete('X-Robots-Tag');response.headers.set('Cache-Control','public, max-age=3600');}
    return response;}});
  return {handler,label:sha256(stableJson({release:options.releaseIdentity,state:version,policy:options.policy,acceptedStageSupplement:Boolean(options.acceptedStageRepository)})),pages:pages.length,sermons:pages.filter(p=>p.kind==='sermon').length};
 });
 if(!(await select()).value.pages)throw Error('source_public_empty_release');
 return async(request:Request)=>{
  const selected=await select(),response=await selected.value.handler(request);
  response.headers.set('X-SEO-Candidate',selected.value.label);
  return response;
 };
}

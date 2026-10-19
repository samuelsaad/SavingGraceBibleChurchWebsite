import {reviewedCalendarFeedAliases} from './source-reviewed-calendar-aliases';
import {configuredMeasurement} from './measurement-configuration';
import{createSourcePageValidationCache}from'./source-page-validation';
import {readSourceRssFacts} from './rss-fact-store';
import {createSourceRssHandler} from './rss-feeds';
import {loadLegacyCalendarOccurrences} from './legacy-calendar-identities';
import {createSnapshotVerifiedFingerprint} from './snapshot-fingerprint-proof';
import {reviewedArchiveAliases} from './source-reviewed-archive-aliases';
import {bindObservedSourceAliases,type ObservedSourceAlias} from './source-observed-aliases';
import {observedSourceAliases} from './source-original-alias-manifest';
import {configuredContactDelivery} from '../server/contact-mail';
import {readSourceResourceRedirects} from './source-resource-redirects';
import {sourcePresentationPolicy} from './source-route-policy';
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

export function sourceRoutePolicy(pages:readonly SourcePublicPage[],routes:readonly import('../cms/model').CmsRoute[]=[],context:FrontendRenderContext=publicRenderContext,resourceRedirects:ReadonlyMap<string,string>=new Map(),aliases:readonly ObservedSourceAlias[]=[...observedSourceAliases,...reviewedArchiveAliases,...reviewedCalendarFeedAliases],sermonPaths:Readonly<Record<string,string>>={}){
 const currentRoutes=new Map(routes.map(route=>[route.path,route]));
 const activeSourcePaths=new Set(pages.filter(page=>!page.issues.length).map(page=>page.path)),nativeSermonPaths=new Set(Object.values(sermonPaths));
 const canonicalPath=(path:string)=>{
  let target=path;const seen=new Set<string>();
  while(!seen.has(target)&&seen.size<10){
   seen.add(target);const route=currentRoutes.get(target);
   if(route?.status===200)return target;
   if(route?.status===410)return null;
   if(route?.status===301){if(!route.targetPath)return undefined;target=route.targetPath;continue;}
   const resource=resourceRedirects.get(target);if(resource){target=resource;continue;}
   const legacy=legacyDisposition(target,context);
   if(!legacy)return activeSourcePaths.has(target)||nativeSermonPaths.has(target)?target:undefined;
   if(legacy.kind!=="redirect")return legacy.kind==='gone'?null:undefined;
   target=legacy.location;
  }
  return undefined;
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
 const attachmentIds=new Map<string,Set<string>>();
 for(const page of pages){
  if(page.kind!=='asset'||page.sourceId===null||page.issues.length||!page.asset||page.path.includes('?'))continue;
  const id=String(page.sourceId);if(!/^[1-9][0-9]*$/u.test(id))continue;
  const values=attachmentIds.get(id)??new Set<string>();values.add(page.path);attachmentIds.set(id,values);
 }
 const sourceAttachmentLinks:Record<string,string>=Object.fromEntries([...attachmentIds].filter(([,paths])=>paths.size===1).map(([id,paths])=>[id,[...paths][0]! ]));
 for(const [path,target] of resourceRedirects){const id=/^\/\?attachment_id=([1-9][0-9]{0,14})$/u.exec(path)?.[1];if(id){if(sourceAttachmentLinks[id]&&sourceAttachmentLinks[id]!==target)throw Error('source_attachment_identity_conflict');sourceAttachmentLinks[id]=target;}}
 const sourceObservedAliases=bindObservedSourceAliases(pages,aliases,new Set(currentRoutes.keys()),canonicalPath,sermonPaths);
 const presentation=sourcePresentationPolicy(pages,context);
 const indexableCapturedQueryPaths=pages.filter(page=>page.path.includes('?')&&!page.issues.length&&page.kind!=='asset'&&page.kind!=='feed'&&presentation(page).indexable).map(page=>page.path);
 return {sourceObservedAliases,sourceResourceRedirects:{...Object.fromEntries(Object.entries(sourceObservedAliases).filter((entry):entry is [string,string]=>entry[1]!==null)),...Object.fromEntries(resourceRedirects)},sourceShortlinks,sourceAttachmentLinks,indexableArchivePaths:[...new Set(indexableArchivePaths)].sort(),indexableCapturedQueryPaths:[...new Set(indexableCapturedQueryPaths)].sort()};
}

/** Hash all existing dependency pointers in PostgreSQL; return only 64 bytes.
 * Every request still checks current state; no TTL or eligibility shortcut. */
export const sourceRuntimeFingerprintSql=`SELECT encode(sha256(convert_to(jsonb_build_object(
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
 'editorialChanges',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,created_at) ORDER BY id),'[]'::jsonb) FROM audit_events WHERE entity_type='sermon' AND outcome='succeeded'),
 'redirects',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY old_path COLLATE "C"),'[]'::jsonb) FROM redirects r),
 'cms',(SELECT COALESCE(jsonb_agg(jsonb_build_array(id,key,kind,published_revision_id) ORDER BY id),'[]'::jsonb) FROM cms_entities),
 'cmsRoutes',(SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY path COLLATE "C"),'[]'::jsonb) FROM cms_routes r),
 'assets',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM media_assets a)
)::text,'UTF8')),'hex') AS fingerprint`;
export async function sourceRuntimeFingerprint(reader:Pick<Pool,'query'>){
 const row=(await reader.query(sourceRuntimeFingerprintSql)).rows[0] as {fingerprint:unknown}|undefined;
 if(typeof row?.fingerprint!=='string'||!/^[a-f0-9]{64}$/u.test(row.fingerprint))throw Error('source_runtime_fingerprint_missing');
 return row.fingerprint;
}

export function versionedHandlerCache<T>(fingerprint:()=>Promise<string>,build:(version:string)=>Promise<T>){
 let selected:{version:string;value:T}|null=null;
 let inFlight:Promise<void>|null=null;
 return async():Promise<{version:string;value:T}>=>{
  for(let attempt=0;attempt<5;attempt++){
   const version=await fingerprint();
   if(selected?.version===version)return selected;
   if(inFlight){await inFlight;continue;}
   // A changed dependency set makes the old snapshot unusable. Release it
   // before allocating its replacement so CMS publication cannot retain two
   // complete inventories under the existing staging heap limit.
   selected=null;
   inFlight=(async()=>{const value=await build(version);if(await fingerprint()===version)selected={version,value};})().finally(()=>{inFlight=null;});
   await inFlight;
  }
  throw Error('source_runtime_changed_during_snapshot');
 };
}

export async function createVersionedSourceHandler(options:{reader:Pool;assetDirectory:string;policy:SeoHttpPolicyInput;releaseIdentity:string;acceptedStageRepository?:import('../server/repositories/sermon-repository').PublicSermonRepository;acceptedLocalRepository?:import('../server/repositories/sermon-repository').PublicSermonRepository}){
 if(options.acceptedStageRepository&&(options.policy.environment!=='staging'||process.env.STAGING_SEALED!=='1'))throw Error('source_runtime_staging_supplement_refused');
 if(options.acceptedLocalRepository){
  if(options.acceptedStageRepository||options.policy.environment!=='staging'||!options.policy.rehearsalOrigins?.length||options.policy.rehearsalOrigins.some(origin=>!/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/u.test(origin)))throw Error('source_runtime_local_supplement_refused');
  const row=(await options.reader.query("SELECT current_database() db,current_setting('server_version_num')::int version,host(inet_server_addr()) address,inet_server_port() port")).rows[0];
  if(row.db!=='savinggrace_sermons_test'||row.version<160000||row.version>=170000||row.address!=='127.0.0.1'||row.port!==5432)throw Error('source_runtime_local_supplement_refused');
 }
 if(!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(options.releaseIdentity))throw Error('source_runtime_release_identity');
 const measurement=await configuredMeasurement({environment:options.policy.environment,rehearsal:Boolean(process.env.SEO_REHEARSAL_HOST),filename:process.env.SEO_GA4_CONFIGURATION_FILE,expectedSha256:process.env.SEO_GA4_CONFIGURATION_SHA256});
 const contactDelivery=await configuredContactDelivery(process.env.CONTACT_SMTP_CONFIG_FILE,process.env.SEO_REHEARSAL_HOST?"local":options.policy.environment==="production"?"production":"staging");
 const cms=new PostgresCmsRepository(options.reader),store=new PostgresCmsAssetStore(options.reader),editorial=new PostgresSermonRepository(options.reader);
 const assets=await CmsDiskAssets.create(options.assetDirectory,store);
 const assetHandler=createCmsAssetHandler(assets,{authenticate:async()=>null},{authorizeMutation:()=>false},async(key,draft)=>!draft&&await cms.canReadAsset(key,false));
 const relations=[...new Set([...sourceRuntimeFingerprintSql.matchAll(/\bFROM ([a-z][a-z0-9_]*)/gu)].map(match=>match[1]!))].sort();
 const fingerprint=createSnapshotVerifiedFingerprint(options.reader,sourceRuntimeFingerprint,relations);
 const validateSourcePage=createSourcePageValidationCache();
 const select=versionedHandlerCache(fingerprint,async(version)=>{
  // Release the consumed source wire rows before allocating the full CMS corpus.
  const pages=await readSourcePublicPages(options.reader,undefined,undefined,validateSourcePage);
  const [snapshot,images]=await Promise.all([cms.getPublishedSnapshot(),store.list()]);
  const sermons=await createCompositeSourceSermonRepository(pages,options.reader,options.acceptedStageRepository??options.acceptedLocalRepository,snapshot.entities,snapshot.routes);
  const sourceAssets=createSourcePublicAssetHandler(pages,options.assetDirectory);
  const content=preserveSourceMetadata(createCmsFrontendSnapshot(snapshot,images.filter(a=>a.type.startsWith('image/')).map(a=>({id:a.id,path:a.url,type:a.type,width:a.width??1,height:a.height??1,alt:a.alt})),false,false,{immutableSourceContent:true}),pages);
  content.legacyCalendarOccurrences=await loadLegacyCalendarOccurrences(pages,sourceAssets,[...content.events,...(content.cancelledCalendarEvents??[])]);
  const resourceRedirects=await readSourceResourceRedirects(options.reader);
  const routes=sourceRoutePolicy(pages,snapshot.routes,{...publicRenderContext,siteContent:content},resourceRedirects,[...observedSourceAliases,...reviewedArchiveAliases,...reviewedCalendarFeedAliases],sermons.verifiedSourceShortlinks());
  routes.sourceShortlinks={...routes.sourceShortlinks,...sermons.verifiedSourceShortlinks()};
  const rssFacts=await readSourceRssFacts(pages,options.assetDirectory);
  const cmsPublicationRows=rssFacts.size?(await options.reader.query<{entity_id:string;published_at:Date|string}>("SELECT entity_id,min(created_at) AS published_at FROM audit_events WHERE entity_type='cms_entity' AND action='cms.publish' GROUP BY entity_id")).rows:[];
  const sermonPublicationRows=rssFacts.size?(await options.reader.query<{id:string;published_at:Date|string}>("SELECT id,published_at FROM sermons WHERE published_at IS NOT NULL")).rows:[];
  const rss=createSourceRssHandler({pages,cms:snapshot,content,sermons,facts:rssFacts,sourceBindings:sermons.verifiedSourceShortlinks(),firstCmsPublishedAt:Object.fromEntries(cmsPublicationRows.map(row=>[row.entity_id,new Date(row.published_at).toISOString()])),nativeSermonPublishedAt:Object.fromEntries(sermonPublicationRows.map(row=>[row.id,new Date(row.published_at).toISOString()]))});
  const handler=createSeoHttpAdapter({...(measurement?{measurement:measurement.configuration}:{}),...(contactDelivery?{contactDelivery}:{}),policy:options.policy,sermons,...routes,content:async()=>content,publicSearch:createLegacySourceSearch(pages,content,sermons,sermons.verifiedSourceShortlinks()),
   sourcePage:createSourcePublicPageHandler(pages),sourceQueryPage:createSourcePublicPageHandler(pages,true),sourceSitemap:async()=>sourcePublicSitemap(pages,{...publicRenderContext,siteContent:content}),sourceDisposition:async path=>resourceRedirects.has(path)?{kind:'redirect' as const,location:resourceRedirects.get(path)!}:path.startsWith('/sermons/')?sermons.findPublicPathDisposition(path):editorial.findPublicPathDisposition(path),
   publicAsset:async request=>{const response=await rss(request)??await sourceAssets(request)??siteAssetResponse(request)??await assetHandler(request);
    if(response&&options.policy.environment==='production'&&response.status===200){if(!['application/rss+xml','application/atom+xml','text/calendar'].includes(response.headers.get('Content-Type')?.split(';')[0]??'')&&!(response.headers.get('Content-Length')==='0'&&response.headers.get('Content-Type')?.startsWith('text/html')))response.headers.delete('X-Robots-Tag');if(!['application/rss+xml','application/atom+xml','text/calendar'].includes(response.headers.get('Content-Type')?.split(';')[0]??''))response.headers.set('Cache-Control','public, max-age=3600');}
    return response;}});
  return {handler,label:sha256(stableJson({release:options.releaseIdentity,state:version,policy:options.policy,acceptedStageSupplement:Boolean(options.acceptedStageRepository),acceptedLocalSupplement:Boolean(options.acceptedLocalRepository),...(measurement?{measurementConfiguration:measurement.fileSha256}:{})})),pages:pages.length,sermons:pages.filter(p=>p.kind==='sermon').length};
 });
 if(!(await select()).value.pages)throw Error('source_public_empty_release');
 return async(request:Request)=>{
  const selected=await select(),response=await selected.value.handler(request);
  response.headers.set('X-SEO-Candidate',selected.value.label);
  return response;
 };
}

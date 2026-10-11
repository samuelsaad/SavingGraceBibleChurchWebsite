import {describe,expect,it} from 'vitest';
import {createVersionedSourceHandler,sourceRoutePolicy,versionedHandlerCache,sourceRuntimeFingerprintSql,sourceRuntimeFingerprint} from '../src/seo/runtime-snapshot';
import type {SourcePublicPage} from '../src/seo/source-public-model';
function page(value:Partial<SourcePublicPage>):SourcePublicPage{
 const path=value.path??'/example/';
 return {sourceId:1,path,kind:'page',sourceUrl:'https://www.savinggrace.org.au'+path,capturedAt:'2026-10-09T00:00:00Z',responseSha256:'a'.repeat(64),
  title:'Anonymous page',heading:'Anonymous page',description:null,language:'en',indexable:true,canonicalSource:'https://www.savinggrace.org.au'+path,
  publishedAt:null,modifiedAt:null,content:[],passageTerms:[],links:[],mediaReferences:[],sermon:null,issues:[],...value};
}
describe('version-bound source runtime',()=>{
 it('refuses an accepted-staging delegate in every production rehearsal before accessing any database',async()=>{
  await expect(createVersionedSourceHandler({reader:{} as never,assetDirectory:'/unused',releaseIdentity:'a'.repeat(40),policy:{environment:'production',canonicalOrigin:'https://www.savinggrace.org.au'},acceptedStageRepository:{} as never})).rejects.toThrow('source_runtime_staging_supplement_refused');
 });
 it('derives shortlinks only from unique active source identities and preserves current CMS disposition',()=>{
  const pages=[page({}),page({sourceId:2,path:'/other/'}),page({sourceId:2,path:'/ambiguous/'}),page({sourceId:3,path:'/withdrawn/'}),page({sourceId:4,kind:'asset',path:'/asset.pdf'}),page({sourceId:5,issues:['unresolved']}),page({sourceId:6,path:'/moved/'}),page({sourceId:7,path:'/venue/rye-civic-hall/'})];
  const policy=sourceRoutePolicy(pages,[{path:'/withdrawn/',entityId:'3',status:410,targetPath:null},{path:'/moved/',entityId:'6',status:301,targetPath:'/current/'},{path:'/current/',entityId:'6',status:200,targetPath:null}]);
  expect(policy.sourceShortlinks).toEqual({'1':'/example/','6':'/current/','7':'/venue/rye-civic-hall/'});
 });
 it('allows only observed indexable canonical single taxonomy query routes',()=>{
  const paths=['/sermons/?sermon_series=example','/sermons/page/12/?sermon_book=example','/sermons/?s=example','/sermons/?sermon_series=example&utm_campaign=x','/sermons/page/1/?sermon_book=example'];
  const policy=sourceRoutePolicy([...paths.map(path=>page({path,kind:'archive'})),page({path:'/sermons/?sermon_book=hidden',kind:'archive',indexable:false})]);
  expect(policy.indexableArchivePaths).toEqual(paths.slice(0,2));expect(policy.sourceShortlinks).toEqual({});
 });
 it('checks each request fingerprint and invalidates immediately without a TTL',async()=>{
  let version='one',fingerprints=0,builds=0;
  const select=versionedHandlerCache(async()=>{fingerprints++;return version;},async value=>{builds++;return {value};});
  const first=await select();expect((await select()).value).toBe(first.value);expect(builds).toBe(1);expect(fingerprints).toBeGreaterThan(2);
  version='two';expect((await select()).value.value).toBe('two');expect(builds).toBe(2);
 });
 it('does not publish a snapshot built across an editorial change',async()=>{
  let version='one';const built:string[]=[];
  const select=versionedHandlerCache(async()=>version,async value=>{built.push(value);if(value==='one')version='two';return value;});
  expect((await select()).value).toBe('two');expect(built).toEqual(['one','two']);
 });
 it('shares concurrent construction but rechecks current state after waiting',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let builds=0;
  const select=versionedHandlerCache(async()=>'one',async()=>{builds++;await gate;return 'ready';});
  const a=select(),b=select();await Promise.resolve();release();expect(await a).toEqual(await b);expect(builds).toBe(1);
 });
 it('requires a complete server-generated dependency hash',async()=>{
  expect(await sourceRuntimeFingerprint({query:async()=>({rows:[{fingerprint:'a'.repeat(64)}]})} as never)).toBe('a'.repeat(64));
  for(const fingerprint of [null,{},'a'.repeat(63),'A'.repeat(64)])await expect(sourceRuntimeFingerprint({query:async()=>({rows:[{fingerprint}]})} as never)).rejects.toThrow('source_runtime_fingerprint_missing');
 });
 it('fingerprints source withdrawals, editorial redirects, CMS published pointers and asset state without source bodies',()=>{
  for(const name of ['source_public_routes','withdrawn','sermons','redirects','cms_entities','published_revision_id','cms_routes','media_assets','sermon_transcripts','sermon_question_answers','scripture_references','sermon_primary_passage_reviews','sermon_transcript_legacy_grounding_bindings','speakers','series','book_classifications','bible_books','sermon_series_map','sermon_book_classifications','source_taxonomy_terms','sermon_source_terms','sermon_media','audit_events'])expect(sourceRuntimeFingerprintSql).toContain(name);
  expect(sourceRuntimeFingerprintSql).not.toContain('payload');expect(sourceRuntimeFingerprintSql).not.toContain('cms_revisions');
 });
});

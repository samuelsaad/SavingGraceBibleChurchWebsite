import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourcePageSchema,sha256} from '../src/seo/source-public-model';
import {createSourcePublicAssetHandler} from '../src/seo/source-public-assets';
import {describe,it,expect} from 'vitest';
import {resourceRedirectManifestSchema} from '../src/seo/source-resource-redirects';
import {resolveHref} from '../src/frontend/content/markup';
import {publicRenderContext} from '../src/frontend/routes';
import {createSeoHttpAdapter} from '../src/seo/http-adapter';
import {SourcePublicSermonRepository} from '../src/seo/source-public-repository';
const origin='https://www.savinggrace.org.au',oldPath='/anonymous-attachment/',newPath='/wp-content/uploads/anonymous-image.png';
const row={oldPath,newPath,sourceUrl:origin+oldPath,sourceDestination:origin+newPath,sourceStatus:301 as const,sourceRecordSha256:'a'.repeat(64),assetSha256:'b'.repeat(64)};
const manifest={format:'sgbc-original-resource-redirects-v1',sourceInventorySha256:'c'.repeat(64),rows:[row]};
describe('verified original resource redirects',()=>{
 it('preserves captured feed attachment identity and attribution without serving unrelated RSS or open redirects',async()=>{
  const path='/feed/?attachment_id=777',destination='/wp-content/uploads/anonymous.mp3';
  expect(resourceRedirectManifestSchema.safeParse({...manifest,rows:[{...row,oldPath:path,newPath:destination,sourceUrl:origin+path,sourceDestination:origin+destination}]}).success).toBe(true);
  const site=createSeoHttpAdapter({policy:{environment:'production',canonicalOrigin:origin},sermons:new SourcePublicSermonRepository([]),sourceResourceRedirects:{[path]:destination}});
  const response=await site(new Request(origin+path+'&utm_source=church%20news'));expect(response.status).toBe(301);expect(response.headers.get('Location')).toBe(destination+'?utm_source=church%20news');
  expect((await site(new Request(origin+path+'&attachment_id=778'))).status).toBe(404);
  expect(resolveHref(path+'&utm_source=church%20news', {...publicRenderContext,sourceResourceRedirects:{[path]:destination}})).toBe(destination+'?utm_source=church%20news');
  const refused=createSeoHttpAdapter({policy:{environment:'production',canonicalOrigin:origin},sermons:new SourcePublicSermonRepository([]),sourceResourceRedirects:{[path]:'//untrusted.test/recording'}});
  expect((await refused(new Request(origin+path))).status).toBe(503);
 });
 it('accepts only exact observed malformed numeric attachment feeds and preserves campaign queries',async()=>{
  const path='/?attachment_id=777/feed/';
  expect(resourceRedirectManifestSchema.safeParse({...manifest,rows:[{...row,oldPath:'/?p=777',sourceUrl:origin+'/?p=777'}]}).success).toBe(true);
  expect(resourceRedirectManifestSchema.safeParse({...manifest,rows:[{...row,oldPath:path,sourceUrl:origin+path}]}).success).toBe(true);
  for(const invalid of ['/?attachment_id=777/other/','/?attachment_id=777/feed/?x=1','/?attachment_id=777/feed/&attachment_id=778'])expect(resourceRedirectManifestSchema.safeParse({...manifest,rows:[{...row,oldPath:invalid,sourceUrl:origin+invalid}]}).success).toBe(false);
  const context={...publicRenderContext,sourceResourceRedirects:{[path]:newPath}};
  const site=createSeoHttpAdapter({policy:{environment:'production',canonicalOrigin:origin},sermons:new SourcePublicSermonRepository([]),sourceResourceRedirects:context.sourceResourceRedirects});
  const response=await site(new Request(origin+path+'&utm_source=church'));
  expect(response.status).toBe(301);expect(response.headers.get('Location')).toBe(newPath+'?utm_source=church');
  expect(resolveHref(path+'&utm_source=church',context)).toBe(newPath+'?utm_source=church');
  expect((await site(new Request(origin+'/?attachment_id=778/feed/'))).status).toBe(404);
 });
 it('requires exact owned identities, permanent original status and a final destination without loops or chains',()=>{
  expect(resourceRedirectManifestSchema.safeParse(manifest).success).toBe(true);
  for(const rows of [[row,row],[{...row,newPath:oldPath,sourceDestination:origin+oldPath}],[{...row,sourceDestination:'https://example.test'+newPath}],[{...row,sourceStatus:302}],[{...row,sourceUrl:origin+'/other/'}],[row,{...row,oldPath:newPath,sourceUrl:origin+newPath,newPath:'/end.png',sourceDestination:origin+'/end.png'}]])expect(resourceRedirectManifestSchema.safeParse({...manifest,rows}).success).toBe(false);
 });
 it('rewrites original absolute and relative links directly while retaining attribution and resource fragments',()=>{
  const context={...publicRenderContext,sourceResourceRedirects:{[oldPath]:newPath,'/?attachment_id=777':newPath}};
  expect(resolveHref('http://savinggrace.org.au'+oldPath+'?utm_campaign=church#page=2',context)).toBe(origin+newPath+'?utm_campaign=church#page=2');
  expect(resolveHref(oldPath+'?download=1#page=2',context)).toBe(newPath+'?download=1#page=2');
  expect(resolveHref('/?attachment_id=777&utm_source=church#page=2',context)).toBe(newPath+'?utm_source=church#page=2');
  expect(resolveHref('/?attachment_id=777&attachment_id=778',context)).toBe('/?attachment_id=777&attachment_id=778');
  expect(resolveHref('https://example.test'+oldPath,context)).toBe('https://example.test'+oldPath);
 });
 it('serves a direct permanent resource disposition with retained campaign behavior and unchanged private boundaries',async()=>{
  const site=createSeoHttpAdapter({policy:{environment:'production',canonicalOrigin:origin},sermons:new SourcePublicSermonRepository([]),sourceResourceRedirects:{[oldPath]:newPath},sourceDisposition:async path=>path===oldPath?{kind:'redirect',location:newPath}:null,publicAsset:async request=>new URL(request.url).pathname===newPath?new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}}):null});
  const moved=await site(new Request(origin+oldPath+'?utm_source=church'));expect(moved.status).toBe(301);expect(moved.headers.get('Location')).toBe(newPath+'?utm_source=church');
  expect((await site(new Request(origin+moved.headers.get('Location')))).status).toBe(200);expect((await site(new Request(origin+'/admin/'))).status).toBe(404);
 });
});

 it('preserves exact original empty calendar bytes and rejects empty normal pages or invented body hashes',async()=>{
  const empty=sha256(new Uint8Array()),path='/events/?ical=1',page={path,kind:'asset',sourceUrl:origin+path,sourceId:null,capturedAt:'2026-10-13T00:00:00Z',responseSha256:empty,title:'Original calendar response',heading:'Original calendar response',description:null,language:'en',indexable:false,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[],links:[],mediaReferences:[],passageTerms:[],sermon:null,issues:[],asset:{storageKey:empty+'.ics',sha256:empty,contentType:'text/html; charset=UTF-8',bytes:0,emptySourceCalendar:true}};
  const valid=sourcePageSchema.parse(page);for(const change of [{...page,indexable:true},{...page,path:'/ordinary-page/',sourceUrl:origin+'/ordinary-page/'},{...page,asset:{...page.asset,emptySourceCalendar:undefined}},{...page,responseSha256:'f'.repeat(64)},{...page,asset:{...page.asset,contentType:'application/javascript'}}])expect(sourcePageSchema.safeParse(change).success).toBe(false);
  const root=await mkdtemp(join(tmpdir(),'sgbc-anonymous-calendar-'));try{await mkdir(join(root,'source-public'));await writeFile(join(root,'source-public',empty+'.ics'),new Uint8Array());const asset=createSourcePublicAssetHandler([valid],root);const site=createSeoHttpAdapter({policy:{environment:'production',canonicalOrigin:origin},sermons:new SourcePublicSermonRepository([]),publicAsset:asset});const response=await site(new Request(origin+path));expect(response.status).toBe(200);expect((await response.arrayBuffer()).byteLength).toBe(0);expect(response.headers.get('Content-Type')).toBe('text/html; charset=UTF-8');expect(response.headers.get('X-Robots-Tag')).toContain('noindex');}finally{await rm(root,{recursive:true,force:true});}
 });

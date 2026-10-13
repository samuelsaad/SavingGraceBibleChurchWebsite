import {describe,expect,it} from 'vitest';
import {assertRecoveryAuthority,compareFingerprints,fingerprintSql,recoveryTarget,type DatabaseFingerprint,verifyRestoredResource} from '../scripts/seo-local-recovery';
const token='seo_restore_20261011';
describe('bounded private local restore proof',()=>{
 it('requires both flags and the established exact disposable target pattern',()=>{
  expect(recoveryTarget(token,{ALLOW_LOCAL_DB_WRITE:'1',ALLOW_LOCAL_SEO_RESTORE:'1'})).toBe('savinggrace_test_run_seo_restore_20261011');
  for(const env of [{},{ALLOW_LOCAL_DB_WRITE:'1'},{ALLOW_LOCAL_SEO_RESTORE:'1'}])expect(()=>recoveryTarget(token,env)).toThrow('opt_in');
  for(const value of ['savinggrace_sermons_test','../existing','x','x'.repeat(49)])expect(()=>recoveryTarget(value,{ALLOW_LOCAL_DB_WRITE:'1',ALLOW_LOCAL_SEO_RESTORE:'1'})).toThrow();
 });
 it('refuses execution without the exact approved D181 governance boundary',()=>{
  expect(()=>assertRecoveryAuthority('# No restore authority')).toThrow('governance');
  expect(()=>assertRecoveryAuthority('## D-181\nOrdinary local migration\n## Other\nbackup/restoration demonstration only savinggrace_test_run_<run-token> ALLOW_LOCAL_SEO_RESTORE=1 Never restore over the source')).toThrow('governance');
  expect(()=>assertRecoveryAuthority('## D-182\nbackup/restoration demonstration only savinggrace_test_run_seo_restore_20261011 ALLOW_LOCAL_SEO_RESTORE=1 Never restore over the source\n## Other')).not.toThrow();
 });
 it('never interpolates an uncontrolled table identifier or returns content rows',()=>{
  expect(fingerprintSql('sermons')).toContain('count(*)::text');expect(fingerprintSql('sermons')).toContain('sha256(');
  for(const name of ['sermons;DROP TABLE sermons','public.sermons','"sermons"','../secret'])expect(()=>fingerprintSql(name)).toThrow('identifier');
 });
 it('compares all required tables, private hashes and optional complete source schema',()=>{
  const item={rows:2,sha256:'a'.repeat(64)},before:DatabaseFingerprint=Object.fromEntries(['sermons','cms_entities','cms_revisions','cms_routes','schema_migrations'].map(name=>[name,item]));
  expect(()=>compareFingerprints(before,structuredClone(before))).not.toThrow();
  expect(()=>compareFingerprints(before,{...before,sermons:{...item,rows:3}})).toThrow('mismatch');
  expect(()=>compareFingerprints(before,{...before,sermons:{...item,sha256:'b'.repeat(64)}})).toThrow('mismatch');
  const incomplete={...before,source_public_versions:item};expect(()=>compareFingerprints(incomplete,incomplete)).toThrow('partial_source');
  expect(()=>compareFingerprints({},{})).toThrow('required_table');
 });
});

import {sourcePageSchema,sha256} from '../src/seo/source-public-model';
describe('restored original resource identity',()=>{
 const bytes=new Uint8Array([1,2,3]),digest=sha256(bytes),page=sourcePageSchema.parse({path:'/anonymous-resource/',kind:'asset',sourceUrl:'https://www.savinggrace.org.au/anonymous-resource/',sourceId:null,capturedAt:'2026-10-13T00:00:00Z',responseSha256:digest,title:'Anonymous resource',heading:'Anonymous resource',description:null,language:'en',indexable:false,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[],links:[],mediaReferences:[],passageTerms:[],sermon:null,issues:[],asset:{storageKey:digest+'.pdf',sha256:digest,contentType:'application/pdf',bytes:3}});
 it('compares media type independently of parameters and still verifies exact bytes',async()=>{
  await expect(verifyRestoredResource(async()=>new Response(bytes,{headers:{'Content-Type':'application/pdf; charset=UTF-8'}}),page,new Map())).resolves.toBeUndefined();
  await expect(verifyRestoredResource(async()=>new Response(new Uint8Array([1]),{headers:{'Content-Type':'application/pdf'}}),page,new Map())).rejects.toThrow('resource_response');
 });
 it('follows only the exact current verified one-hop resource mapping',async()=>{
  const handler=async(r:Request)=>new URL(r.url).pathname===page.path?new Response(null,{status:301,headers:{Location:'/final.pdf'}}):new Response(bytes,{headers:{'Content-Type':'application/pdf'}});
  await expect(verifyRestoredResource(handler,page,new Map([[page.path,'/final.pdf']]))).resolves.toBeUndefined();
  await expect(verifyRestoredResource(handler,page,new Map())).rejects.toThrow('resource_redirect');
  await expect(verifyRestoredResource(handler,page,new Map([[page.path,'/wrong.pdf']]))).rejects.toThrow('resource_redirect');
 });
});

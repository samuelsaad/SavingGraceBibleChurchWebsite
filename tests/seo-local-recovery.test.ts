import {describe,expect,it} from 'vitest';
import {assertRecoveryAuthority,compareFingerprints,fingerprintSql,recoveryTarget,type DatabaseFingerprint} from '../scripts/seo-local-recovery';
const token='20261009000000000000000000';
describe('bounded private local restore proof',()=>{
 it('requires both flags and the established exact disposable target pattern',()=>{
  expect(recoveryTarget(token,{ALLOW_LOCAL_DB_WRITE:'1',ALLOW_LOCAL_SEO_RESTORE:'1'})).toBe('savinggrace_test_run_'+token);
  for(const env of [{},{ALLOW_LOCAL_DB_WRITE:'1'},{ALLOW_LOCAL_SEO_RESTORE:'1'}])expect(()=>recoveryTarget(token,env)).toThrow('opt_in');
  for(const value of ['savinggrace_sermons_test','../existing','x','x'.repeat(49)])expect(()=>recoveryTarget(value,{ALLOW_LOCAL_DB_WRITE:'1',ALLOW_LOCAL_SEO_RESTORE:'1'})).toThrow();
 });
 it('refuses execution without the exact approved D181 governance boundary',()=>{
  expect(()=>assertRecoveryAuthority('# No restore authority')).toThrow('governance');
  expect(()=>assertRecoveryAuthority('## D-181\nOrdinary local migration\n## Other\nbackup/restoration demonstration only savinggrace_test_run_<run-token> ALLOW_LOCAL_SEO_RESTORE=1 Never restore over the source')).toThrow('governance');
  expect(()=>assertRecoveryAuthority('## D-181\nbackup/restoration demonstration only savinggrace_test_run_<run-token> ALLOW_LOCAL_SEO_RESTORE=1 Never restore over the source\n## Other')).not.toThrow();
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

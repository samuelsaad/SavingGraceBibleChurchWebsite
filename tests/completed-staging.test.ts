import {describe,it,expect} from 'vitest';
import {completedCount,validateCompletedIds,completedEligibilitySql,currentCompletedEligibilitySql,membershipHash,configureCompletedCohort} from '../src/domain/completed-staging';
import {frontendSermonEligibilitySql,buildPublishedSermonFilterOptionsQuery} from '../src/server/queries/public-sermons';
import {loadTrackedProjectSermonSnapshot} from '../src/development-data/project-sermon-snapshot';
import {assertPreserved} from '../src/staging/completed-sync';
import {validateCompletedPacket,quoted,completedTables} from '../src/staging/completed-packet';
import {completedSchemaMigrations} from '../src/staging/completed-schema';

describe('D-171 bounded completed collection',()=>{
 it('fails closed without the exact hash-bound cohort',()=>{
  expect(completedCount).toBe(279);
  expect(()=>completedEligibilitySql('s')).toThrow('d171_cohort_not_configured');
  expect(()=>validateCompletedIds([])).toThrow('d171_membership_mismatch');
  expect(()=>validateCompletedIds(Array(279).fill('00000000-0000-0000-0000-000000000001'))).toThrow();
  expect(membershipHash(['b','a'])).toBe(membershipHash(['a','b']));
 });
 it('retains exact dependency, version, withdrawal and status guards without relabelling review origin',()=>{
  const sql=currentCompletedEligibilitySql('s');
  for(const text of ["s.status='draft'",'s.published_at IS NULL','accepted_row_version=s.row_version','d169_restricted_acceptance_dependency','local_loopback','sermon_d169_restricted_acceptance_withdrawals'])expect(sql).toContain(text);
  expect(()=>currentCompletedEligibilitySql('s;drop')).toThrow();
  expect(()=>frontendSermonEligibilitySql('s','d171_completed')).toThrow('d171_cohort_not_configured');
  expect(frontendSermonEligibilitySql('s','public')).not.toContain('d169');
 });
 it('refuses malformed packets, unsafe identifiers and administrator tables',()=>{
  expect(()=>validateCompletedPacket({})).toThrow();expect(()=>quoted('a;drop')).toThrow();
  expect(completedTables).not.toContain('administrator_sessions');expect(completedTables).not.toContain('users');
 });
 it('detects any prior-row or sequence drift while allowing additional rows',()=>{
  const before={ids:[],tables:{sermons:{keys:['id'],rows:[{key:'a',hash:'b'}]}},sequenceHash:'x',sha256:'y'};
  expect(()=>assertPreserved(before,{...before,tables:{sermons:{keys:['id'],rows:[{key:'a',hash:'b'},{key:'c',hash:'d'}]}}})).not.toThrow();
  expect(()=>assertPreserved(before,{...before,sequenceHash:'z'})).toThrow('d171_sequence_changed');
  expect(()=>assertPreserved(before,{...before,tables:{sermons:{keys:['id'],rows:[{key:'a',hash:'changed'}]}}})).toThrow('d171_existing_row_changed');
 });
 it('uses the exact existing 25-migration lineage, with explicit additive compatibility',async()=>{
  const definitions=await completedSchemaMigrations();expect(definitions).toHaveLength(25);
  expect(definitions.slice(22).map(m=>m.order)).toEqual([23,24,25]);
  expect(definitions[24]!.upBody).toContain('ai_transcript_proposal');
  expect(definitions[23]!.downBody).toContain('d169_evidence_prevents_schema_rollback');
 });
 it('checks exact membership and fresh acceptance once per statement before every filter join, with no cache',async()=>{
  const {snapshot}=await loadTrackedProjectSermonSnapshot();configureCompletedCohort(snapshot.tables.sermons.map(r=>r.id));
  const q=buildPublishedSermonFilterOptionsQuery('d171_completed').text,guard=frontendSermonEligibilitySql('s','d171_completed');
  expect(q.includes('WITH matching_sermons AS MATERIALIZED (')).toBe(true);
  expect(q.includes('SELECT s.* FROM sermons s WHERE '+guard)).toBe(true);
  expect(q.split(guard).length-1).toBe(1);
  expect((q.match(/JOIN matching_sermons sermon|FROM matching_sermons sermon/gu)??[]).length).toBe(5);
  expect(q.includes("accepted_row_version=s.row_version")).toBe(true);
  expect(q.includes('d169_restricted_acceptance_dependency(s.id)')).toBe(true);
  const ordinary=buildPublishedSermonFilterOptionsQuery('public').text;
  expect(ordinary.includes('MATERIALIZED')).toBe(false);
  expect(ordinary.includes('d169_restricted_acceptance_dependency')).toBe(false);
 });
});

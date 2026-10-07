import {describe,expect,it} from 'vitest';
import type {PoolClient} from 'pg';
import {assertRelatedThemesSyncGate,validateRelatedThemesPacket,relatedThemesPreservation,assertRelatedThemesPreserved,parseRelatedThemesBaseline,rollbackRelatedThemesPointer} from '../src/staging/related-themes-sync';
import {buildAcceptedDescriptionIndex,semanticHash,type AcceptedSemanticSource} from '../src/semantic/accepted-description-index';
import {descriptionSha256,type DescriptionSemanticPipeline} from '../src/semantic/description-related-themes';

const hash='1'.repeat(64),otherHash='2'.repeat(64);
const pipeline:DescriptionSemanticPipeline={pipelineVersion:'accepted-description-semantic-v2',inputField:'accepted_description',inputMode:'symmetric_document',queryPrefix:null,documentPrefix:null,textNormalisation:'exact_utf8',modelIdentifier:'synthetic',modelRevision:'0'.repeat(40),modelSha256:hash,tokenizerIdentifier:'synthetic-tokenizer',tokenizerSha256:otherHash,runtimeIdentifier:'synthetic-runtime',runtimeVersion:'1',runtimePackageIntegrity:`sha512-${'A'.repeat(86)}==`,pooling:'cls',normalisation:'l2_float32',truncationMaxTokens:512,dimensions:3};
function source(n:number,language='en'):AcceptedSemanticSource{
 const description=`Anonymous synthetic description fixture ${n}, unrelated to church content.`;
 return {sermonId:`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sourceIdentity:`wordpress:${n}`,description,descriptionSha256:descriptionSha256(description),language};
}
async function fixture(sources=[source(1),source(2,'ar')]){
 const vectors=new Map<string,Float32Array>();
 const plan=await buildAcceptedDescriptionIndex({environment:'staging_protected',scope:'d175_completed',pipeline,sources,generatedAt:new Date('2030-01-01'),
 cache:{async get(_p,h){return vectors.get(h)??null;},async put(_p,h,v){vectors.set(h,v);}},model:{async embedApprovedDescriptions(descriptions){return descriptions.map(()=>new Float32Array([1,0,0]));}}});
 return {schemaVersion:'accepted-semantic-sync-v1' as const,plan,vectors:[...vectors].map(([descriptionSha256,vector])=>({descriptionSha256,vector:[...vector]}))};
}
function fingerprint(){return {tables:[{table:'sermons',count:2,sha256:hash},{table:'audit_events',count:3,sha256:otherHash},{table:'schema_migrations',count:26,sha256:hash},{table:'accepted_description_semantic_active',count:1,sha256:hash}],sequenceHash:hash,sha256:otherHash,counts:{}};}

describe('guarded staging description index synchronization',()=>{
 it('requires the explicit staging maintenance gate and exact environment',()=>{
  const env={ALLOW_STAGING_RELATED_THEMES_SYNC:'1',RELATED_THEMES_TARGET:'existing-protected',RELATED_THEMES_ENVIRONMENT:'staging_protected'};
  expect(assertRelatedThemesSyncGate(env)).toBe('staging_protected');
  for(const change of [{ALLOW_STAGING_RELATED_THEMES_SYNC:'0'},{RELATED_THEMES_TARGET:'production'},{RELATED_THEMES_ENVIRONMENT:'local'}])expect(()=>assertRelatedThemesSyncGate({...env,...change})).toThrow(/gate_refused/);
 });
 it('allows UUID remapping only through exact destination source/hash/language membership',async()=>{
  const sources=[source(1),source(2,'ar')],packet=await fixture(sources);
  expect(validateRelatedThemesPacket(packet,sources.map((s,i)=>({...s,sermonId:source(i+10).sermonId})),'staging_protected')).toEqual(packet);
  expect(()=>validateRelatedThemesPacket(packet,sources,'staging_public')).toThrow(/environment/);
 });
 it('rejects local-only additions, omitted Arabic records and stale or wrong-language content',async()=>{
  const sources=[source(1),source(2,'ar')],packet=await fixture(sources);
  for(const current of [sources.slice(0,1),[...sources,source(3)], [sources[0]!,source(2)], [sources[0]!,{...sources[1]!,descriptionSha256:otherHash}]])expect(()=>validateRelatedThemesPacket(packet,current,'staging_protected')).toThrow(/membership|conflict/);
 });
 it('rejects extra, missing, duplicate and invalid vectors before application',async()=>{
  const sources=[source(1),source(2,'ar')],packet=await fixture(sources);
  for(const vectors of [[],[...packet.vectors,...packet.vectors],[...packet.vectors,{descriptionSha256:sources[1]!.descriptionSha256,vector:[1,0,0]}],[{descriptionSha256:sources[0]!.descriptionSha256,vector:[2,0,0]}]])expect(()=>validateRelatedThemesPacket({...packet,vectors},sources,'staging_protected')).toThrow();
 });
 it('excludes only additive semantic state and ledger from incumbent preservation',()=>{
  const original=fingerprint(),before=relatedThemesPreservation(original);
  const semanticChange={...original,tables:original.tables.map(t=>t.table.startsWith('accepted_description_semantic_')||t.table==='schema_migrations'?{...t,count:99,sha256:otherHash}:t)};
  expect(()=>assertRelatedThemesPreserved(before,relatedThemesPreservation(semanticChange))).not.toThrow();
  for(const table of ['sermons','audit_events'])expect(()=>assertRelatedThemesPreserved(before,relatedThemesPreservation({...original,tables:original.tables.map(t=>t.table===table?{...t,sha256:'3'.repeat(64)}:t)}))).toThrow(/incumbent/);
  expect(()=>assertRelatedThemesPreserved(before,relatedThemesPreservation({...original,sequenceHash:otherHash}))).toThrow(/incumbent/);
 });
 it('rejects altered recovery receipts or nested preservation evidence',()=>{
  const preservation=relatedThemesPreservation(fingerprint());
  const baseline={schemaVersion:'related-themes-recovery-v1',environment:'staging_protected',packetSha256:hash,preservation,corpusSha256:hash,sources:2,previousPointer:null,fullFingerprint:hash,sha256:''};baseline.sha256=semanticHash(baseline);
  expect(parseRelatedThemesBaseline(baseline)).toEqual(baseline);
  expect(()=>parseRelatedThemesBaseline({...baseline,sources:3})).toThrow(/integrity/);
  const tampered={...baseline,preservation:{...preservation,sequenceHash:otherHash},sha256:''};tampered.sha256=semanticHash(tampered);
  expect(()=>parseRelatedThemesBaseline(tampered)).toThrow(/integrity/);
 });
});

describe('scoped compensating active-pointer rollback',()=>{
 const pointer={environment:'staging_protected' as const,frontend_scope:'d175_completed' as const,build_fingerprint:hash,activated_at:'2030-01-01T00:00:00.000Z'};
 const previous={...pointer,build_fingerprint:otherHash,activated_at:'2029-01-01T00:00:00.000Z'};
 function database(initial:typeof pointer|null){let current=initial;const writes:string[]=[];const client={async query(sql:string,values?:unknown[]){
  if(sql.startsWith('SELECT environment'))return {rows:current?[current]:[]};
  if(sql.startsWith('INSERT INTO')){writes.push(sql);current={environment:values![0] as typeof pointer.environment,frontend_scope:values![1] as typeof pointer.frontend_scope,build_fingerprint:values![2] as string,activated_at:values![3] as string};}
  if(sql.startsWith('DELETE FROM')){writes.push(sql);current=null;}return {rows:[]};
 }} as unknown as PoolClient;return {client,writes,current:()=>current};}
 it('restores the exact previous pointer and makes repeated rollback unchanged',async()=>{
  const db=database(pointer);
  expect(await rollbackRelatedThemesPointer(db.client,'staging_protected',previous,pointer)).toBe('restored');
  expect(db.current()).toEqual(previous);
  expect(await rollbackRelatedThemesPointer(db.client,'staging_protected',previous,pointer)).toBe('unchanged');expect(db.writes).toHaveLength(1);
 });
 it('removes only a newly created active pointer, retaining immutable index history',async()=>{
  const db=database(pointer);expect(await rollbackRelatedThemesPointer(db.client,'staging_protected',null,pointer)).toBe('restored');
  expect(db.writes).toEqual(['DELETE FROM accepted_description_semantic_active WHERE environment=$1 AND frontend_scope=$2']);
 });
 it('refuses a concurrent pointer change even if it references the same build',async()=>{
  const db=database({...pointer,activated_at:'2031-01-01T00:00:00.000Z'});
  await expect(rollbackRelatedThemesPointer(db.client,'staging_protected',previous,pointer)).rejects.toThrow(/concurrent/);expect(db.writes).toHaveLength(0);
 });
});

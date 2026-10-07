/** Scoped description-only index delivery. No sermon, account, review or
 * publication row is copied or changed. Private recovery is never image data. */
import {lstat,readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Pool,type PoolClient} from 'pg';
import {z} from 'zod';
import {stagingConfiguration,stagingPassword,verifyStagingIdentity} from './guard';
import {loadCompletedCohort} from './completed-cohort';
import {databaseFingerprint} from './database-verification';
import {applyAcceptedSemanticMigration,verifyAcceptedSemanticSchema} from '../semantic/accepted-semantic-migration';
import {PostgresAcceptedSemanticRepository,acceptedSemanticSyncPacketSchema,type AcceptedSemanticSyncPacket} from '../server/repositories/postgres-accepted-semantic-repository';
import {acceptedCorpusFingerprint,buildAcceptedDescriptionIndex,semanticHash,validateAcceptedIndexPlan,validateSemanticVector,type AcceptedSemanticSource} from '../semantic/accepted-description-index';
import {descriptionSha256} from '../semantic/description-related-themes';
import {createRelatedThemesEvaluation} from '../semantic/related-themes-evaluation';
import {collectMetadataEvaluationBaseline} from '../semantic/metadata-evaluation-baseline';

const environments=['staging_public','staging_protected'] as const;
type Environment=typeof environments[number];
const hash=z.string().regex(/^[a-f0-9]{64}$/u);
export const relatedThemesSyncTables=['accepted_description_semantic_vectors','accepted_description_semantic_builds','accepted_description_semantic_members','accepted_description_semantic_active'] as const;
const marker='D-167 isolated protected runtime 0218989d1c09224ed301caecb915cefc787a5017f28f6253aee3020a7c3b3ae5';
const pointerSchema=z.object({environment:z.enum(environments),frontend_scope:z.literal('d175_completed'),build_fingerprint:hash,activated_at:z.iso.datetime()}).strict();
type Pointer=z.infer<typeof pointerSchema>;
const stateSchema=z.object({tables:z.array(z.object({table:z.string().regex(/^[a-z_][a-z0-9_]*$/u),count:z.number().int().nonnegative(),sha256:hash}).strict()),sequenceHash:hash,sha256:hash}).strict();
type Preservation=z.infer<typeof stateSchema>;
const baselineSchema=z.object({schemaVersion:z.literal('related-themes-recovery-v1'),environment:z.enum(environments),packetSha256:hash,preservation:stateSchema,corpusSha256:hash,sources:z.number().int().nonnegative(),previousPointer:pointerSchema.nullable(),fullFingerprint:hash,sha256:hash}).strict();
type Baseline=z.infer<typeof baselineSchema>;
const appliedSchema=z.object({schemaVersion:z.literal('related-themes-applied-v1'),environment:z.enum(environments),packetSha256:hash,baselineSha256:hash,appliedPointer:pointerSchema,sha256:hash}).strict();
const planSchema=z.object({schemaVersion:z.literal('related-themes-plan-v1'),environment:z.enum(environments),packetSha256:hash,baselineSha256:hash,buildFingerprint:hash,corpusSha256:hash,sources:z.number().int().nonnegative(),sha256:hash}).strict();
const fail=(code:string):never=>{throw Error('related_themes_sync_'+code);};

export function assertRelatedThemesSyncGate(env:NodeJS.ProcessEnv):Environment {
 if(env.ALLOW_STAGING_RELATED_THEMES_SYNC!=='1'||env.RELATED_THEMES_TARGET!=='existing-protected'||!environments.includes(env.RELATED_THEMES_ENVIRONMENT as Environment))fail('gate_refused');
 return env.RELATED_THEMES_ENVIRONMENT as Environment;
}
function digestReceipt<T extends {sha256:string}>(value:T):string{return semanticHash({...value,sha256:''});}
export function parseRelatedThemesBaseline(raw:unknown):Baseline{
 const value=baselineSchema.parse(raw);if(value.sha256!==digestReceipt(value)||value.preservation.sha256!==semanticHash({tables:value.preservation.tables,sequenceHash:value.preservation.sequenceHash}))fail('baseline_integrity_refused');return value;
}
/** Exact environment membership before any vector write. A packet may remap UUIDs
 * only through the same unique preserved source identity and exact description. */
export function validateRelatedThemesPacket(raw:unknown,current:readonly AcceptedSemanticSource[],environment:Environment):AcceptedSemanticSyncPacket {
 const packet=acceptedSemanticSyncPacketSchema.parse(raw);validateAcceptedIndexPlan(packet.plan);
 if(packet.plan.environment!==environment||packet.plan.scope!=='d175_completed')fail('packet_environment_refused');
 if(packet.plan.sources.length!==current.length)fail('packet_membership_mismatch');
 const sources=new Map(packet.plan.sources.map(source=>[source.sourceIdentity,source]));
 if(sources.size!==packet.plan.sources.length||new Set(current.map(source=>source.sourceIdentity)).size!==current.length)fail('duplicate_source_refused');
 for(const source of current){const member=sources.get(source.sourceIdentity);if(!member||member.descriptionSha256!==source.descriptionSha256||member.language!==source.language)fail('packet_source_conflict');}
 const required=new Set(packet.plan.sources.filter(source=>source.state==='indexed').map(source=>source.descriptionSha256));
 if(packet.vectors.length!==required.size||new Set(packet.vectors.map(row=>row.descriptionSha256)).size!==packet.vectors.length)fail('packet_vector_scope_refused');
 for(const row of packet.vectors){if(!required.has(row.descriptionSha256))fail('packet_vector_scope_refused');validateSemanticVector(new Float32Array(row.vector),packet.plan.pipeline.dimensions);}
 return packet;
}
export function relatedThemesPreservation(fingerprint:Awaited<ReturnType<typeof databaseFingerprint>>):Preservation {
 const tables=fingerprint.tables.filter(row=>row.table!=='schema_migrations'&&!relatedThemesSyncTables.includes(row.table as typeof relatedThemesSyncTables[number]));
 const body={tables,sequenceHash:fingerprint.sequenceHash};return {...body,sha256:semanticHash(body)};
}
export function assertRelatedThemesPreserved(before:Preservation,after:Preservation):void{
 if(before.sha256!==after.sha256||semanticHash(before)!==semanticHash(after))fail('incumbent_data_changed');
}
async function target(c:PoolClient){
 await verifyStagingIdentity(c,true);
 const value=(await c.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0]?.marker;
 if(value!==marker)fail('database_marker_refused');
}
async function pointer(c:PoolClient,environment:Environment):Promise<Pointer|null>{
 const row=(await c.query('SELECT environment,frontend_scope,build_fingerprint,activated_at FROM accepted_description_semantic_active WHERE environment=$1 AND frontend_scope=$2',[environment,'d175_completed'])).rows[0];
 return row?pointerSchema.parse({...row,activated_at:row.activated_at instanceof Date?row.activated_at.toISOString():row.activated_at}):null;
}
async function readPrivate(path:string):Promise<unknown>{
 if(!isAbsolute(path))fail('private_path_refused');const st=await lstat(path);
 if(!st.isFile()||st.isSymbolicLink()||st.size>40_000_000)fail('private_file_refused');
 return JSON.parse(await readFile(path,'utf8'));
}
async function savePrivate(path:string,value:unknown){await writeFile(path,JSON.stringify(value),{flag:'wx',mode:0o600});}
async function receipt(path:string,value:unknown){await savePrivate(join(path,`${Date.now()}-${randomUUID()}.receipt.json`),value);}
async function projectedPlan(packet:AcceptedSemanticSyncPacket,current:AcceptedSemanticSource[],environment:Environment){
 const vectors=new Map(packet.vectors.map(row=>[row.descriptionSha256,new Float32Array(row.vector)]));
 const tooLong=new Set(packet.plan.sources.filter(source=>source.state==='input_too_long').map(source=>source.descriptionSha256));
 return buildAcceptedDescriptionIndex({environment,scope:'d175_completed',sources:current,pipeline:packet.plan.pipeline,
  generatedAt:new Date(packet.plan.generatedAt),cache:{async get(_pipeline,key){return vectors.get(key)??null;},async put(){fail('preflight_write_refused');}},
  model:{async embedApprovedDescriptions(descriptions){if(descriptions.every(description=>tooLong.has(descriptionSha256(description))))throw Object.assign(Error('semantic_input_too_long'),{code:'input_too_long'});return fail('packet_vector_missing');}}});
}
async function readSnapshot(pool:Pool,repository:PostgresAcceptedSemanticRepository,environment:Environment){
 const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await target(c);await verifyAcceptedSemanticSchema(c);
  const fingerprint=await databaseFingerprint(c),sources=await repository.listCurrentSources(c),active=await pointer(c,environment);
  return {fingerprint,preservation:relatedThemesPreservation(fingerprint),sources,active};
 }finally{await c.query('ROLLBACK');c.release();}
}
export async function rollbackRelatedThemesPointer(c:PoolClient,environment:Environment,previous:Pointer|null,expected:Pointer|null):Promise<'restored'|'unchanged'>{
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`accepted-semantics:${environment}:d175_completed`]);
 const current=await pointer(c,environment);
 if(semanticHash(current)===semanticHash(previous))return 'unchanged';
 if(!expected||semanticHash(current)!==semanticHash(expected))fail('rollback_concurrent_pointer');
 if(previous){
  if(previous.environment!==environment)fail('rollback_environment_refused');
  await c.query(`INSERT INTO accepted_description_semantic_active(environment,frontend_scope,build_fingerprint,activated_at) VALUES($1,$2,$3,$4)
   ON CONFLICT(environment,frontend_scope) DO UPDATE SET build_fingerprint=EXCLUDED.build_fingerprint,activated_at=EXCLUDED.activated_at`,[environment,'d175_completed',previous.build_fingerprint,previous.activated_at]);
 }else await c.query('DELETE FROM accepted_description_semantic_active WHERE environment=$1 AND frontend_scope=$2',[environment,'d175_completed']);
 return 'restored';
}

export async function runRelatedThemesSync(pool:Pool,operation:string,environment:Environment,root='/verification'){
 const output=join(root,'output');await mkdir(output,{recursive:true,mode:0o700});
 const repository=new PostgresAcceptedSemanticRepository(pool,{environment,scope:'d175_completed'});
 if(operation==='apply-0026'){
  const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await target(c);
   const before=relatedThemesPreservation(await databaseFingerprint(c));const outcome=await applyAcceptedSemanticMigration(c);
   // Read-only rendering needs only the four new semantic tables, not all tables.
   for(const table of relatedThemesSyncTables)await c.query(`GRANT SELECT ON TABLE public.${table} TO staging_reader`);
   assertRelatedThemesPreserved(before,relatedThemesPreservation(await databaseFingerprint(c)));await c.query('COMMIT');
   return {outcome,environment,schemaReceipts:26,contentPreserved:true,visitorEnabled:false};
  }catch(error){await c.query('ROLLBACK').catch(()=>undefined);throw error;}finally{c.release();}
 }
 if(!['baseline','plan','import','verify','evaluate','rollback-index'].includes(operation))fail('operation_refused');
 const raw=await readPrivate(join(root,'related-themes.private.json'));
 const initial=await readSnapshot(pool,repository,environment),packet=validateRelatedThemesPacket(raw,initial.sources,environment),packetSha256=semanticHash(packet);
 const destination=await projectedPlan(packet,initial.sources,environment);
 const baselinePath=join(output,'baseline.private.json');
 if(operation==='baseline'){
  const value:Baseline={schemaVersion:'related-themes-recovery-v1',environment,packetSha256,preservation:initial.preservation,corpusSha256:acceptedCorpusFingerprint(initial.sources),sources:initial.sources.length,previousPointer:initial.active,fullFingerprint:initial.fingerprint.sha256,sha256:''};value.sha256=digestReceipt(value);
  try{await savePrivate(baselinePath,value);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const old=parseRelatedThemesBaseline(await readPrivate(baselinePath));if(semanticHash(old)!==semanticHash(value))fail('baseline_already_exists_changed');}
  return {outcome:'baseline',environment,sources:value.sources,baselineSha256:value.sha256,recoverySaved:true,visitorEnabled:false};
 }
 const baseline=parseRelatedThemesBaseline(await readPrivate(baselinePath));
 if(baseline.environment!==environment||baseline.packetSha256!==packetSha256)fail('baseline_scope_changed');
 assertRelatedThemesPreserved(baseline.preservation,initial.preservation);
 if(baseline.corpusSha256!==acceptedCorpusFingerprint(initial.sources))fail('eligible_corpus_changed');
 if(operation==='plan'){
  const value:z.infer<typeof planSchema>={schemaVersion:'related-themes-plan-v1',environment,packetSha256,baselineSha256:baseline.sha256,buildFingerprint:destination.buildFingerprint,corpusSha256:destination.corpusSha256,sources:destination.sources.length,sha256:''};value.sha256=digestReceipt(value);
  try{await savePrivate(join(output,'plan.private.json'),value);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;if(semanticHash(await readPrivate(join(output,'plan.private.json')))!==semanticHash(value))fail('plan_already_exists_changed');}
  return {outcome:'ready',environment,sources:value.sources,buildFingerprint:value.buildFingerprint,contentPreserved:true,visitorEnabled:false};
 }
 const plan=planSchema.parse(await readPrivate(join(output,'plan.private.json')));
 if(plan.sha256!==digestReceipt(plan)||plan.baselineSha256!==baseline.sha256||plan.packetSha256!==packetSha256||plan.buildFingerprint!==destination.buildFingerprint||plan.environment!==environment)fail('plan_integrity_changed');
 if(operation==='import'){
  if(initial.active?.build_fingerprint!==destination.buildFingerprint&&semanticHash(initial.active)!==semanticHash(baseline.previousPointer))fail('concurrent_active_index');
  await receipt(output,{outcome:'pending',environment,packetSha256,baselineSha256:baseline.sha256,expectedBefore:initial.active,expectedAfterBuild:destination.buildFingerprint});
  const result=await repository.importPacket(packet);
  if(result.plan.buildFingerprint!==destination.buildFingerprint)fail('stored_plan_mismatch');
  const after=await readSnapshot(pool,repository,environment);assertRelatedThemesPreserved(baseline.preservation,after.preservation);
  if(after.active?.build_fingerprint!==destination.buildFingerprint||acceptedCorpusFingerprint(after.sources)!==baseline.corpusSha256)fail('stored_index_verification_failed');
  if(result.outcome==='unchanged'&&initial.fingerprint.sha256!==after.fingerprint.sha256)fail('idempotency_failure');
  const recovery={schemaVersion:'related-themes-applied-v1',environment,packetSha256,baselineSha256:baseline.sha256,appliedPointer:after.active,sha256:''};recovery.sha256=digestReceipt(recovery);
  // Append a receipt per exact activation. A rollback/rehearsal reactivation has
  // a new timestamp and must preserve, not overwrite, its earlier recovery.
  const recoveryPath=join(output,`applied-${recovery.sha256}.private.json`);
  try{await savePrivate(recoveryPath,recovery);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;if(semanticHash(await readPrivate(recoveryPath))!==semanticHash(recovery))fail('applied_recovery_changed');}
  await receipt(output,{outcome:result.outcome,environment,packetSha256,beforeSha256:initial.fingerprint.sha256,afterSha256:after.fingerprint.sha256,buildFingerprint:destination.buildFingerprint});
  return {outcome:result.outcome,environment,sources:destination.sources.length,indexed:destination.sources.filter(s=>s.state==='indexed').length,excluded:destination.sources.filter(s=>s.state!=='indexed').length,relationships:destination.relationships.length,buildFingerprint:destination.buildFingerprint,contentPreserved:true,eligibilityPreserved:true,idempotent:result.outcome==='unchanged',visitorEnabled:false};
 }
 if(operation==='evaluate'){
  const active=await repository.activePlan();if(!active||active.buildFingerprint!==destination.buildFingerprint)return fail('active_index_mismatch');
  const indexed=new Set(active.sources.filter(source=>source.state==='indexed').map(source=>source.sermonId));
  const identities=new Map(active.sources.filter(source=>source.state==='indexed').map(source=>[source.sourceIdentity,source.sermonId]));
  // Preserve the existing metadata ranking while revalidating the destination
  // corpus once in a read-only snapshot instead of hydrating every candidate.
  const metadataBaseline=await collectMetadataEvaluationBaseline(pool,{environment,scope:'d175_completed',expectedSources:initial.sources,anchorIds:[...indexed],limit:3});
  const metadataCandidates=metadataBaseline.candidates.filter(row=>indexed.has(row.candidateId));
  const evaluation=createRelatedThemesEvaluation({
   sources:initial.sources.filter(source=>indexed.has(source.sermonId)).map(({language:_language,...source})=>source),
   pipelineFingerprint:active.pipelineFingerprint,modelRevision:active.pipeline.modelRevision,
   semanticCandidates:active.relationships.map(row=>({anchorId:identities.get(row.sourceIdentity)!,candidateId:identities.get(row.neighbourIdentity)!,score:row.score})),
   metadataCandidates,seed:'D-178-description-only-frozen-evaluation',reviewerIds:['reviewer-a','reviewer-b']});
  const after=await readSnapshot(pool,repository,environment);
  if(initial.fingerprint.sha256!==after.fingerprint.sha256)return fail('evaluation_corpus_changed');
  const path=join(output,`${environment}-evaluation.private.json`);
  try{await savePrivate(path,evaluation);}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;if(semanticHash(await readPrivate(path))!==semanticHash(evaluation))return fail('evaluation_already_exists_changed');}
  return {outcome:'evaluation_prepared',environment,sources:evaluation.sources.length,anchors:evaluation.anchors.length,evaluationFingerprint:evaluation.fingerprint,contentPreserved:true,visitorEnabled:false};
 }
 if(operation==='verify'){
  const active=await repository.activePlan();if(!active||active.buildFingerprint!==destination.buildFingerprint)return fail('active_index_mismatch');
  const exported=await repository.exportPacket();validateRelatedThemesPacket(exported,initial.sources,environment);
  const after=await readSnapshot(pool,repository,environment);if(initial.fingerprint.sha256!==after.fingerprint.sha256)fail('read_only_verification_changed_database');
  return {outcome:'verified',environment,sources:active.sources.length,indexed:active.sources.filter(s=>s.state==='indexed').length,excluded:active.sources.filter(s=>s.state!=='indexed').length,relationships:active.relationships.length,buildFingerprint:active.buildFingerprint,contentPreserved:true,eligibilityPreserved:true,visitorEnabled:false};
 }
 const recovered=[];
 for(const name of (await readdir(output)).filter(name=>/^applied-[a-f0-9]{64}\.private\.json$/u.test(name))){
  const applied=appliedSchema.parse(await readPrivate(join(output,name)));
  if(applied.sha256!==digestReceipt(applied)||name!==`applied-${applied.sha256}.private.json`||applied.environment!==environment||applied.packetSha256!==packetSha256||applied.baselineSha256!==baseline.sha256)fail('rollback_recovery_refused');
  recovered.push(applied);
 }
 const applied=recovered.find(row=>semanticHash(row.appliedPointer)===semanticHash(initial.active))??(semanticHash(initial.active)===semanticHash(baseline.previousPointer)?recovered[0]:undefined);
 if(!applied)return fail('rollback_recovery_refused');
 const c=await pool.connect();try{await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await target(c);await verifyAcceptedSemanticSchema(c);
  const outcome=await rollbackRelatedThemesPointer(c,environment,baseline.previousPointer,applied.appliedPointer);
  assertRelatedThemesPreserved(baseline.preservation,relatedThemesPreservation(await databaseFingerprint(c)));await c.query('COMMIT');
  await receipt(output,{outcome,environment,packetSha256,baselineSha256:baseline.sha256});return {outcome,environment,contentPreserved:true,visitorEnabled:false};
 }catch(error){await c.query('ROLLBACK').catch(()=>undefined);throw error;}finally{c.release();}
}
async function main(){
 const environment=assertRelatedThemesSyncGate(process.env);await loadCompletedCohort(process.env.D171_COHORT_FILE??'');
 const config=stagingConfiguration(process.env,true),pool=new Pool({...config,password:stagingPassword(config.passwordFile),max:1,statement_timeout:120000,options:config.options+' -c jit=off'});
 try{console.log(JSON.stringify(await runRelatedThemesSync(pool,process.argv[2]??'',environment)));}finally{await pool.end();}
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/related-themes-sync.ts')||process.argv[1]?.endsWith('related-themes-sync.cjs'))void main().catch(error=>{
 const code=error instanceof Error&&/^(related_themes_sync_|semantic_)[a-z_]+$/u.test(error.message)?error.message:'related_themes_sync_failed';
 console.log(JSON.stringify({outcome:'stopped_safely',code}));process.exitCode=1;
});

/** D-178: safe aggregate output only; real descriptions/vectors never logged. */
import {Pool} from 'pg';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../src/migration/protected-local-postgres';
import {assertDisposableLocalDatabase} from '../src/migration/local-database-safety';
import {databaseFingerprint} from '../src/staging/database-verification';
import {PostgresAcceptedSemanticRepository} from '../src/server/repositories/postgres-accepted-semantic-repository';
import {acceptedCorpusFingerprint,buildAcceptedDescriptionIndex,semanticHash,type AcceptedSemanticEnvironment} from '../src/semantic/accepted-description-index';
import {ApprovedLocalDescriptionEmbeddingModel} from '../src/semantic/local-description-embedding-model';
import {descriptionSha256} from '../src/semantic/description-related-themes';
import {applyAcceptedSemanticMigration,verifyAcceptedSemanticSchema} from '../src/semantic/accepted-semantic-migration';
import {readSemanticPrivateJson,saveSemanticPrivateJson,semanticPrivateDirectory} from '../src/semantic/related-themes-private-files';
import {collectMetadataEvaluationBaseline} from '../src/semantic/metadata-evaluation-baseline';
import {createRelatedThemesEvaluation,createBlindedReviewerPack,analyzeEvaluation} from '../src/semantic/related-themes-evaluation';

function safeFingerprint(value:Awaited<ReturnType<typeof databaseFingerprint>>){return semanticHash({tables:value.tables.filter(row=>!row.table.startsWith('accepted_description_semantic_')&&row.table!=='schema_migrations'),sequenceHash:value.sequenceHash});}
async function main(){
 const operation=process.argv[2];if(!['inventory','migrate','build','evaluate','verify','export'].includes(operation??''))throw Error('semantic_operation_refused');
 const writing=['migrate','build'].includes(operation!);if(writing&&process.env.ALLOW_LOCAL_DB_WRITE!=='1')throw Error('semantic_write_gate_required');
 const url=new URL('postgresql://127.0.0.1:5432/savinggrace_sermons_test');url.username=protectedLocalPostgresUser;url.password=await protectedLocalPostgresPassword();
 if(writing)assertDisposableLocalDatabase(url.href);
 const pool=new Pool({connectionString:url.href,max:2,options:writing?'-c jit=off -c timezone=UTC':'-c default_transaction_read_only=on -c jit=off -c timezone=UTC',statement_timeout:120000});
 let model:ApprovedLocalDescriptionEmbeddingModel|undefined;
 try{
  const row=(await pool.query("SELECT current_database() db,inet_server_addr()::text host,inet_server_port() port,current_setting('server_version_num')::int version")).rows[0];
  if(row.db!=='savinggrace_sermons_test'||!['127.0.0.1','127.0.0.1/32'].includes(row.host)||row.port!==5432||row.version<160000||row.version>=170000)throw Error('semantic_local_target_refused');
  const root=await semanticPrivateDirectory(),repo=new PostgresAcceptedSemanticRepository(pool,{environment:'local',scope:'d175_local_completed'});
  const sources=await repo.listCurrentSources();const inventory={decision:'D-178',environment:'local',corpusSha256:acceptedCorpusFingerprint(sources),sources:sources.map(({description:_text,...source})=>source)};
  const c=await pool.connect();let before:Awaited<ReturnType<typeof databaseFingerprint>>;
  try{await c.query('BEGIN READ ONLY');before=await databaseFingerprint(c);await c.query('ROLLBACK');}finally{c.release();}
  if(operation==='inventory'){
   await saveSemanticPrivateJson(root,`inventory-${inventory.corpusSha256}.private.json`,inventory);
   // Full snapshots differ when an authorized semantic build or ledger entry is
   // added, even while the non-semantic preservation hash remains unchanged.
   await saveSemanticPrivateJson(root,`baseline-${before.sha256}.private.json`,before);
   console.log(JSON.stringify({operation,stored:before.counts.sermons,eligible:sources.length,corpusSha256:inventory.corpusSha256,preservationSha256:safeFingerprint(before),languages:sources.reduce((counts,s)=>({...counts,[s.language]:(counts[s.language]??0)+1}),{} as Record<string,number>)}));return;
  }
  if(operation==='migrate'){
   const client=await pool.connect();try{await client.query('BEGIN');const outcome=await applyAcceptedSemanticMigration(client);await client.query('COMMIT');console.log(JSON.stringify({operation,outcome}));}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }else{
   await verifyAcceptedSemanticSchema(pool);
   if(operation==='build'){
    model=await ApprovedLocalDescriptionEmbeddingModel.create();
    // Runtime downloads are prohibited by the adapter; also refuse fetch for this entire inference run.
    globalThis.fetch=async()=>{throw Error('semantic_network_disabled');};
    const plan=await buildAcceptedDescriptionIndex({environment:'local',scope:'d175_local_completed',sources,model,pipeline:model.acceptedPipeline,cache:repo,
     onProgress:async(completed,total,state)=>{if(completed%25===0||completed===total)console.log(JSON.stringify({operation:'index_progress',completed,total,state}));}});
    const outcome=await repo.activate(plan);await saveSemanticPrivateJson(root,`index-${plan.buildFingerprint}.private.json`,outcome==='unchanged'?await repo.activePlan():plan);
    console.log(JSON.stringify({operation,outcome,eligible:sources.length,indexed:plan.sources.filter(s=>s.state==='indexed').length,exclusions:plan.sources.filter(s=>s.state!=='indexed').map(s=>({id:s.sermonId,reason:s.state})),pipelineFingerprint:plan.pipelineFingerprint,corpusSha256:plan.corpusSha256,buildFingerprint:plan.buildFingerprint}));
   }else if(operation==='verify'){
    const plan=await repo.activePlan();if(!plan||plan.corpusSha256!==inventory.corpusSha256)throw Error('semantic_index_stale');
    const indexed=new Set(plan.sources.filter(s=>s.state==='indexed').map(s=>s.sourceIdentity));
    let recommendations=0;for(const relation of plan.relationships){if(relation.sourceIdentity===relation.neighbourIdentity||!indexed.has(relation.sourceIdentity)||!indexed.has(relation.neighbourIdentity))throw Error('semantic_relationship_integrity_failure');recommendations++;}
    for(const source of [sources[0]!,sources[sources.length-1]!]){const matches=await repo.listPreviewRelated(source.sermonId);if(matches.some(r=>r.neighbourSermonId===source.sermonId))throw Error('semantic_self_match');}
    console.log(JSON.stringify({operation,eligible:sources.length,indexed:plan.sources.filter(s=>s.state==='indexed').length,recommendations,visitorEnabled:false,buildFingerprint:plan.buildFingerprint}));
   }else if(operation==='evaluate'){
    const plan=await repo.activePlan();if(!plan||plan.corpusSha256!==inventory.corpusSha256)throw Error('semantic_index_stale');
    const indexed=new Set(plan.sources.filter(s=>s.state==='indexed').map(s=>s.sermonId)),identity=new Map(plan.sources.filter(s=>s.state==='indexed').map(s=>[s.sourceIdentity,s.sermonId]));
    const baseline=await collectMetadataEvaluationBaseline(pool,{environment:'local',scope:'d175_local_completed',expectedSources:sources,anchorIds:[...indexed],limit:3});
    const metadataCandidates=baseline.candidates.filter(row=>indexed.has(row.candidateId));
    console.log(JSON.stringify({operation:'metadata_baseline',anchors:indexed.size,elapsedMs:baseline.elapsedMs}));
    const evaluation=createRelatedThemesEvaluation({sources:sources.filter(s=>indexed.has(s.sermonId)).map(({language:_language,...source})=>source),pipelineFingerprint:plan.pipelineFingerprint,modelRevision:plan.pipeline.modelRevision,
     semanticCandidates:plan.relationships.map(r=>({anchorId:identity.get(r.sourceIdentity)!,candidateId:identity.get(r.neighbourIdentity)!,score:r.score})),metadataCandidates,seed:'D-178-description-only-frozen-evaluation',reviewerIds:['reviewer-a','reviewer-b']});
    await saveSemanticPrivateJson(root,`evaluation-${evaluation.fingerprint}.private.json`,evaluation);
    await saveSemanticPrivateJson(root,'evaluation.private.json',evaluation);
    for(const reviewer of evaluation.reviewerIds)await saveSemanticPrivateJson(root,`${reviewer}-calibration.private.json`,createBlindedReviewerPack(evaluation,reviewer,'calibration'));
    const analysis=analyzeEvaluation(evaluation,[],'calibration');console.log(JSON.stringify({operation,evaluationFingerprint:evaluation.fingerprint,anchors:evaluation.anchors.length,analysis}));
   }else if(operation==='export'){
    const target=process.env.RELATED_THEMES_ENVIRONMENT as AcceptedSemanticEnvironment;if(!['staging_public','staging_protected'].includes(target))throw Error('semantic_sync_target_required');
    const raw=await readSemanticPrivateJson(process.env.RELATED_THEMES_TARGET_INVENTORY??'') as {rows:Array<{sermonId:string;sourceIdentity:string;descriptionSha256:string;language:string}>};
    if(!Array.isArray(raw.rows)||raw.rows.length===0)throw Error('semantic_target_inventory_invalid');
    const local=new Map(sources.map(s=>[s.sourceIdentity,s]));
    const subset=raw.rows.map(member=>{const source=local.get(member.sourceIdentity);if(!source||source.descriptionSha256!==member.descriptionSha256||source.language!==member.language)throw Error('semantic_sync_source_conflict');return{...source,sermonId:member.sermonId};});
    const prior=await repo.activePlan();if(!prior)throw Error('semantic_active_index_missing');
    const excluded=new Set(prior.sources.filter(s=>s.state==='input_too_long').map(s=>s.descriptionSha256));
    const plan=await buildAcceptedDescriptionIndex({environment:target,scope:'d175_completed',sources:subset,pipeline:prior.pipeline,cache:repo,generatedAt:new Date(prior.generatedAt),model:{async embedApprovedDescriptions(texts){if(texts.every(text=>excluded.has(descriptionSha256(text))))throw Object.assign(Error('semantic_input_too_long'),{code:'input_too_long'});throw Error('semantic_missing_verified_vector');}}});
    const vectors=[];for(const hash of new Set(plan.sources.filter(s=>s.state==='indexed').map(s=>s.descriptionSha256))){const vector=await repo.get(plan.pipelineFingerprint,hash);if(!vector)throw Error('semantic_missing_verified_vector');vectors.push({descriptionSha256:hash,vector:Array.from(vector)});}
    const packet={schemaVersion:'accepted-semantic-sync-v1',plan,vectors};await saveSemanticPrivateJson(root,`${target.replaceAll('_','-')}-sync.private.json`,packet);
    console.log(JSON.stringify({operation,target,eligible:subset.length,indexed:plan.sources.filter(s=>s.state==='indexed').length,packetSha256:semanticHash(packet)}));
   }
  }
  const client=await pool.connect();try{await client.query('BEGIN READ ONLY');const after=await databaseFingerprint(client);await client.query('ROLLBACK');if(safeFingerprint(before)!==safeFingerprint(after))throw Error('semantic_unrelated_data_changed');console.log(JSON.stringify({preservationVerified:true,preservationSha256:safeFingerprint(after)}));}finally{client.release();}
 }finally{if(model)await model.dispose();await pool.end();}
}
main().catch((error:unknown)=>{const message=error instanceof Error?error.message:'';console.error(/^semantic_[a-z_]+$/.test(message)?message:'related_themes_local_operation_failed_safely');process.exitCode=1;});

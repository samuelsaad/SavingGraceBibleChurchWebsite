import type {PostgresAcceptedSemanticRepository,AcceptedSemanticSelection} from '../server/repositories/postgres-accepted-semantic-repository';
import {readSemanticPrivateJson} from './related-themes-private-files';
import {acceptedCorpusFingerprint,semanticHash} from './accepted-description-index';
import {calibrateAndLockEvaluationPolicy,evaluateLockedHoldout,createBlindedReviewerPack,type BlindedReviewerPack,type RelatedThemesEvaluationPlan,type RelatedThemesRatings,type EvaluationAdjudication,type EvaluationPolicyLock} from './related-themes-evaluation';

export interface RelatedThemesReader {mode:'evaluation'|'released';select(anchorId:string):Promise<AcceptedSemanticSelection[]>}
export interface RelatedThemesRuntime {reader?:RelatedThemesReader;evaluation?:()=>Promise<RelatedThemesEvaluationPlan|null>;holdout?:(reviewerId:string)=>Promise<BlindedReviewerPack|null>}
export function relatedThemesConfiguration(env:NodeJS.ProcessEnv,environment:'local'|'staging_public'|'staging_protected'){
 for(const name of ['RELATED_THEMES_EVALUATION_ENABLED','RELATED_THEMES_VISITOR_ENABLED'])if(env[name]!==undefined&&!['0','1'].includes(env[name]!))throw Error('semantic_feature_flag_refused');
 const evaluation=env.RELATED_THEMES_EVALUATION_ENABLED==='1',visitor=env.RELATED_THEMES_VISITOR_ENABLED==='1';
 if(evaluation&&environment==='staging_public')throw Error('semantic_public_evaluation_refused');
 if(evaluation&&environment==='staging_protected'&&env.RELATED_THEMES_ACCESS!=='protected_tunnel')throw Error('semantic_protected_access_required');
 if(evaluation&&visitor)throw Error('semantic_mixed_presentation_refused');
 return{evaluation,visitor};
}
/** No request parameter can choose environment, policy, source scope or private file. */
export async function createRelatedThemesRuntime(repository:PostgresAcceptedSemanticRepository,env:NodeJS.ProcessEnv):Promise<RelatedThemesRuntime>{
 const config=relatedThemesConfiguration(env,repository.target.environment);
 if(!config.evaluation&&!config.visitor)return{};
 let plan:RelatedThemesEvaluationPlan,lock:EvaluationPolicyLock|undefined,previewLock:EvaluationPolicyLock|undefined;
 if(config.visitor){
  const evidence=await readSemanticPrivateJson(env.RELATED_THEMES_RELEASE_FILE??'') as {plan:RelatedThemesEvaluationPlan;lock:EvaluationPolicyLock;ratings:RelatedThemesRatings[];adjudications:EvaluationAdjudication[]};
  plan=evidence.plan;lock=evidence.lock;
  const recalibrated=calibrateAndLockEvaluationPolicy(plan,evidence.ratings.filter(r=>r.phase==='calibration'),evidence.adjudications.filter(a=>a.phase==='calibration'),lock.lockedAt);
  if(recalibrated.fingerprint!==lock.fingerprint||!evaluateLockedHoldout(plan,lock,evidence.ratings,evidence.adjudications).normalFeatureMayBeEnabled)throw Error('semantic_human_release_gate_not_satisfied');
 }else plan=await readSemanticPrivateJson(env.RELATED_THEMES_EVALUATION_FILE??'') as RelatedThemesEvaluationPlan;
 // Pack validation verifies frozen content hashes, not merely a stored status flag.
 createBlindedReviewerPack(plan,plan.reviewerIds[0],'calibration');
 if(config.evaluation&&env.RELATED_THEMES_CALIBRATION_FILE){
  const evidence=await readSemanticPrivateJson(env.RELATED_THEMES_CALIBRATION_FILE) as {plan:RelatedThemesEvaluationPlan;lock:EvaluationPolicyLock;ratings:RelatedThemesRatings[];adjudications:EvaluationAdjudication[]};
  if(evidence.plan.fingerprint!==plan.fingerprint||evidence.ratings.some(r=>r.phase!=='calibration')||evidence.adjudications.some(a=>a.phase!=='calibration'))throw Error('semantic_calibration_scope_refused');
  const checked=calibrateAndLockEvaluationPolicy(plan,evidence.ratings,evidence.adjudications,evidence.lock.lockedAt);
  if(checked.fingerprint!==evidence.lock.fingerprint)throw Error('semantic_calibration_lock_refused');previewLock=checked;
 }
 const current=async()=>{
  const active=await repository.activePlan();if(!active||active.pipelineFingerprint!==plan.pipelineFingerprint)return false;
  const sources=await repository.listCurrentSources();
  if(acceptedCorpusFingerprint(sources)!==active.corpusSha256)return false;
  const indexed=new Set(active.sources.filter(s=>s.state==='indexed').map(s=>s.sermonId));
  const latest=sources.filter(s=>indexed.has(s.sermonId)).map(({language:_language,...s})=>s).sort((a,b)=>a.sermonId.localeCompare(b.sermonId));
  return semanticHash(latest)===semanticHash([...plan.sources].sort((a,b)=>a.sermonId.localeCompare(b.sermonId)));
 };
 if(!await current())throw Error('semantic_evaluation_corpus_stale');
 return {reader:{mode:config.evaluation?'evaluation':'released',async select(anchorId){
  if(!await current())return[];const candidates=await repository.listPreviewRelated(anchorId);
  return lock?candidates.filter(row=>row.rawCosineScore>=lock!.minimumCosineScore).slice(0,lock.maximumResults):candidates;
 }},...(config.evaluation?{evaluation:async()=>await current()?plan:null,holdout:async(reviewerId:string)=>previewLock&&await current()?createBlindedReviewerPack(plan,reviewerId,'holdout',previewLock):null}:{})};
}

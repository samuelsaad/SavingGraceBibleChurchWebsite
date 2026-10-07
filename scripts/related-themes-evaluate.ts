/** Human evidence is supplied privately, never generated or inferred by this command. */
import {readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {readSemanticPrivateJson,saveSemanticPrivateJson,semanticPrivateDirectory} from '../src/semantic/related-themes-private-files';
import {semanticHash} from '../src/semantic/accepted-description-index';
import {importEvaluationRatings,analyzeEvaluation,calibrateAndLockEvaluationPolicy,createBlindedReviewerPack,evaluateLockedHoldout,type RelatedThemesEvaluationPlan,type RelatedThemesRatings,type EvaluationPolicyLock,type EvaluationAdjudication} from '../src/semantic/related-themes-evaluation';

async function optional<T>(path:string):Promise<T|undefined>{try{return await readSemanticPrivateJson(path) as T;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}}
async function main(){
 const operation=process.argv[2];if(!['import','analysis','lock','holdout-pack','report'].includes(operation??''))throw Error('evaluation_operation_refused');
 const root=await semanticPrivateDirectory(),plan=await readSemanticPrivateJson(resolve(process.env.RELATED_THEMES_EVALUATION_FILE??join(root,'evaluation.private.json'))) as RelatedThemesEvaluationPlan;
 const evidenceRoot=join(root,plan.fingerprint);await import('node:fs/promises').then(fs=>fs.mkdir(evidenceRoot,{recursive:true}));
 const ratings:RelatedThemesRatings[]=[];
 const lock=await optional<EvaluationPolicyLock>(join(evidenceRoot,'policy-lock.private.json'));
 for(const filename of (await readdir(evidenceRoot)).filter(name=>/^rating-[a-f0-9]{64}\.private\.json$/.test(name)).sort()){
  const result=importEvaluationRatings(plan,await readSemanticPrivateJson(join(evidenceRoot,filename)),ratings,lock);if(result.status==='new')ratings.push(result.rating);
 }
 const adjudications=process.env.RELATED_THEMES_ADJUDICATION_FILE?await readSemanticPrivateJson(process.env.RELATED_THEMES_ADJUDICATION_FILE) as EvaluationAdjudication[]:[];
 if(operation==='import'){
  const incoming=await readSemanticPrivateJson(resolve(process.argv[3]??''));const result=importEvaluationRatings(plan,incoming,ratings,lock);
  if(result.status==='new')await saveSemanticPrivateJson(evidenceRoot,`rating-${semanticHash(result.rating)}.private.json`,result.rating);
  console.log(JSON.stringify({operation,outcome:result.status,reviewerKind:result.rating.reviewerKind,phase:result.rating.phase}));return;
 }
 if(operation==='lock'){
  if(lock){console.log(JSON.stringify({operation,outcome:'unchanged',lockFingerprint:lock.fingerprint}));return;}
  const policy=calibrateAndLockEvaluationPolicy(plan,ratings.filter(r=>r.phase==='calibration'),adjudications.filter(a=>a.phase==='calibration'));
  await saveSemanticPrivateJson(evidenceRoot,'policy-lock.private.json',policy);
  await saveSemanticPrivateJson(evidenceRoot,'calibration-evidence.private.json',{plan,lock:policy,ratings:ratings.filter(r=>r.phase==='calibration'),adjudications:adjudications.filter(a=>a.phase==='calibration')});
  console.log(JSON.stringify({operation,outcome:'locked',lockFingerprint:policy.fingerprint,threshold:policy.minimumCosineScore,maximumResults:policy.maximumResults}));return;
 }
 if(operation==='holdout-pack'){
  if(!lock)throw Error('evaluation_calibration_lock_required');
  for(const id of plan.reviewerIds)await saveSemanticPrivateJson(evidenceRoot,`${id}-holdout.private.json`,createBlindedReviewerPack(plan,id,'holdout',lock));
  console.log(JSON.stringify({operation,outcome:'exported',reviewers:2,lockFingerprint:lock.fingerprint}));return;
 }
 const calibration=analyzeEvaluation(plan,ratings,'calibration',adjudications.filter(a=>a.phase==='calibration'));
 const holdout=lock?evaluateLockedHoldout(plan,lock,ratings,adjudications.filter(a=>a.phase==='holdout')):null;
 const report={evaluationFingerprint:plan.fingerprint,calibration:{...calibration,judgments:[...calibration.judgments]},lock:lock??null,holdout:holdout?{...holdout,analysis:{...holdout.analysis,judgments:[...holdout.analysis.judgments]}}:null,normalFeatureMayBeEnabled:holdout?.normalFeatureMayBeEnabled??false};
 if(operation==='report'){
  await saveSemanticPrivateJson(evidenceRoot,`report-${semanticHash(report)}.private.json`,report);
  if(report.normalFeatureMayBeEnabled)await saveSemanticPrivateJson(evidenceRoot,'release-evidence.private.json',{plan,lock,ratings,adjudications});
 }
 console.log(JSON.stringify({operation,calibrationStatus:calibration.status,humanReviewers:calibration.humanReviewerCount,holdoutStatus:holdout?.status??'locked_until_calibration',normalFeatureMayBeEnabled:report.normalFeatureMayBeEnabled}));
}
main().catch(()=>{console.error('related_themes_evaluation_evidence_missing_or_invalid');process.exitCode=1;});

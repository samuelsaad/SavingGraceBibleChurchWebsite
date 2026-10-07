import type {RelatedThemesRuntime} from '../../semantic/related-themes-runtime';
import {createBlindedReviewerPack,renderRelatedThemesEvaluationHtml} from '../../semantic/related-themes-evaluation';
import {frontendResponse} from './frontend-response';
import {html} from '../../frontend/html';
import {pageShell} from '../../frontend/shell';
import {previewRenderContext,restrictedRenderContext} from '../../frontend/routes';

/** Called ONLY after local session authorization or the sealed protected-runtime guard. */
export function createRelatedThemesEvaluationHandler(runtime:RelatedThemesRuntime,root:string){
 return async(request:Request):Promise<Response|null>=>{
  const url=new URL(request.url);if(!url.pathname.startsWith(`${root}/related-themes-evaluation`))return null;
  if(!runtime.evaluation)return new Response('not_found',{status:404});
  if(request.method!=='GET')return new Response('method_not_allowed',{status:405});
  const plan=await runtime.evaluation();if(!plan)return frontendResponse('<!doctype html><title>Evaluation unavailable</title><h1>Evaluation needs a refreshed index</h1><p>The accepted descriptions have changed. No stale review material is displayed.</p>',{privatePreview:true,status:409});
  const prefix=`${root}/related-themes-evaluation/`;
  if(url.pathname===prefix){
   const context=root?previewRenderContext:restrictedRenderContext;
   return frontendResponse(pageShell({title:'Related themes evaluation',canonicalPath:prefix,robots:'noindex, nofollow',styles:['sermon'],body:html`<section class="section"><h1>Related themes evaluation</h1><p class="prose">Normal visitor recommendations remain off. Two independent human reviewers must complete the blinded calibration, followed by a locked holdout.</p><p>Each reviewer should open only their assigned pack. Do not inspect the provisional sermon-page suggestions before completing your independent ratings.</p><ul>${plan.reviewerIds.map((id,index)=>html`<li><a class="button" href="${prefix}${id}/calibration/">Open reviewer ${index+1} calibration</a></li>`)}</ul><p>Holdout packs remain unavailable until the calibration policy is locked. Downloads stay private; this interface does not submit decisions to the server.</p></section>`},context),{privatePreview:true});
  }
  const relative=url.pathname.slice(prefix.length),match=/^(reviewer-a|reviewer-b)\/(calibration|holdout)\/$/.exec(relative);
  if(!match||!plan.reviewerIds.includes(match[1]!))return new Response('not_found',{status:404});
  if(match[2]==='holdout'){
   const pack=await runtime.holdout?.(match[1]!);if(!pack)return frontendResponse('<!doctype html><title>Holdout locked</title><h1>Holdout is locked</h1><p>Complete independent calibration and save its verified policy lock first.</p>',{privatePreview:true,status:423});
   return frontendResponse(renderRelatedThemesEvaluationHtml(pack),{privatePreview:true});
  }
  return frontendResponse(renderRelatedThemesEvaluationHtml(createBlindedReviewerPack(plan,match[1]!,'calibration')),{privatePreview:true});
 };
}

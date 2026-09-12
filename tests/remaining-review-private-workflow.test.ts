import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { AdminSermonService } from "../src/application/admin-sermon-service";
import type { ApplicationIdentity } from "../src/application/authorization";
import { aggregateDelegatedReview, remainingPrivateReviewRequirements } from "../src/domain/delegated-review-status";
import { remainingComponents, remainingReviewerSubject, type RemainingReviewStatus } from "../src/domain/remaining-ai-review";
import { privateCompletionAttribution, privateCompletionIsCurrent, remainingComponentLabel } from "../src/domain/remaining-review-display";
import type { AdminSermonRepository, AdminSermonTransaction, EnrichmentReviewWorkflowDto, StoredSermonDetail } from "../src/server/repositories/admin-sermon-repository";
import { createAdminApiRouter } from "../src/server/http/admin-api-router";

const id="10000000-0000-4000-8000-000000000001", timestamp="2026-01-01T00:00:00.000Z";
const identity:ApplicationIdentity={subject:"fixture-admin",role:"admin"};
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
function status():RemainingReviewStatus {
  return {decision:"D-157",components:Object.fromEntries(remainingComponents.map(k=>[k,{
    state:"ai_accepted",accepted:true,exceptionCode:null,informationNeeded:null,
    reviewerSubject:remainingReviewerSubject,model:"gpt-6-astra",reviewedAt:timestamp
  }])) as RemainingReviewStatus["components"],privateComplete:true,completedAt:timestamp,
  completionReviewerSubject:remainingReviewerSubject,canComplete:true,remaining:[]};
}
function fixture() {
  const text="An invented village gathers around a carpenter's table.";
  const source={provider:"youtube" as const,videoId:"abcdefghijk",canonicalUrl:"https://www.youtube.com/watch?v=abcdefghijk",
    captionLanguage:"en",captionTrackType:"automatic" as const,originalFilename:"fixture.vtt",sourceContentSha256:hash("fixture"),
    retrievalAttribution:"authorised_youtube_data_api" as const,sourceCharacterCount:50,cleanedCharacterCount:text.length,
    apparentCompleteness:"apparently_complete" as const,uncertaintyMarkerCount:0,warnings:[],warningResolutionStatus:"unresolved" as const,
    unresolvedPassages:[],processingVersion:"fixture-v1",importedAt:timestamp,processedAt:timestamp,processingDurationMs:1,
    estimatedReviewMinutes:1,manualAttentionRequired:false,accuracyReviewStatus:"required" as const};
  const sermon:StoredSermonDetail={id,title:"Invented village",slug:"invented-village",status:"draft",serviceDate:"2026-01-04",scheduledFor:null,
    publishedAt:null,rowVersion:1,updatedAt:timestamp,speaker:{id:"10000000-0000-4000-8000-000000000002",name:"Fictional speaker",slug:"fictional-speaker"},
    series:[],historicalBackfillRequired:true,enrichmentReview:{currentStage:1,completedAt:null,pendingItemCount:0,totalItemCount:0},
    youtubeSource:{videoId:source.videoId,canonicalUrl:source.canonicalUrl},readiness:{isComplete:false,isContentComplete:false,hasOneSpeaker:true,
      hasRequiredBibleBook:false,hasRequiredPassageDecision:false,hasApprovedDescription:false,hasApprovedTranscript:false,approvedQuestionCount:0,
      totalQuestionCount:7,hasRequiredQuestionAnswers:false,allQuestionsApproved:false,hasValidControlledMedia:true,issues:[]},
    summary:text,summaryStatus:"draft",summarySourceKind:"manual",summarySourceReference:null,summaryCreatedAt:timestamp,summaryUpdatedAt:timestamp,
    summaryReviewedAt:null,summaryApprovedAt:null,summaryRowVersion:1,seoDescription:null,body:null,books:[],scriptureReferences:[],primaryPassageReview:null,
    media:[],transcript:{bodyText:text,status:"draft",sourceKind:"caption",sourceReference:null,rowVersion:1,
      groundingRevisionId:"10000000-0000-4000-8000-000000000003",legacyGroundingBindings:[],reviewedAt:null,approvedAt:null},questionAnswers:[],enrichmentSource:source,
    remainingReview:status()};
  sermon.questionAnswers=Array.from({length:7},(_,i)=>({id:`20000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,
    question:`What did the fictional villager consider in scene ${i+1}?`,answer:text,displayOrder:i+1,status:"draft",sourceKind:"manual",
    sourceReference:null,rowVersion:1,reviewedAt:null,approvedAt:null}));
  sermon.delegatedReview=aggregateDelegatedReview(["description",...sermon.questionAnswers.map(q=>`qa:${q.id}`)].map((artifactKey,i)=>({
    sermonId:id,artifactKey,displayOrder:i||null,outcome:"accepted",humanApprovalPreserved:false,reviewedAt:timestamp,model:"gpt-6-astra",
    identityConfirmed:false,findingsComplete:false
  }))).get(id)!;
  const workflow:EnrichmentReviewWorkflowDto={recordPosition:1,recordCount:1,items:[],state:{sermonId:id,identityStatus:"pending",currentStage:1,completedAt:null,
    sourceRecordKey:"authorised-record-1",expectedItemCount:0,expectedItemSetSha256:hash(""),expectedTranscriptSha256:hash(text),expectedTranscriptRowVersion:1,
    emptyItemSetAcknowledgedBySubject:null,emptyItemSetAcknowledgedAt:null,storedItemCount:0,atomicItemCount:0,actualItemSetSha256:hash(""),rowVersion:1}};
  const tx={findSermonForUpdate:vi.fn(async()=>sermon),findEnrichmentReviewForUpdate:vi.fn(async()=>workflow.state),
    hasBlockingEnrichmentReviewItems:vi.fn(async()=>true),completeEnrichmentReview:vi.fn(),appendAudit:vi.fn(),
    updateEnrichmentReviewProgress:vi.fn(async(_id:string,input:{currentStage:number})=>{workflow.state.currentStage=input.currentStage;workflow.state.rowVersion++;})};
  const repository={transaction:async<T>(fn:(t:AdminSermonTransaction)=>Promise<T>)=>fn(tx as unknown as AdminSermonTransaction),
    findSermon:async()=>sermon,findEnrichmentReview:async()=>workflow,listRemainingAiReviews:vi.fn(async()=>[{sermonId:id,title:sermon.title,review:sermon.remainingReview!}])
  } as unknown as AdminSermonRepository;
  const service=new AdminSermonService(repository);
  return {sermon,workflow,tx,repository,service};
}

describe("D-157 private status and direct handlers",()=>{
  it("keeps preserved human attribution while exposing a supplemental retained-source limitation",()=>{
    const s=status();s.components.transcript={...s.components.transcript,state:"human_approved",reviewerSubject:"fixture-human",model:null,sourceLimitation:true,warnings:["retained_caption_unavailable"]};
    const label=remainingComponentLabel(s,"transcript");
    expect(label).toContain("Existing human decision preserved");
    expect(label).toContain("retained_caption_unavailable");
    expect(label).not.toContain("AI accepted");
    expect(s.components.transcript.reviewerSubject).toBe("fixture-human");
  });
  it("labels accepted no-single-primary evidence without fabricating human confirmation or public readiness",async()=>{
    const f=fixture(); f.sermon.remainingReview!.passageBasis="no_single_primary";
    const before=JSON.stringify(f.sermon);
    const view=await f.service.enrichmentReviewDetail(id,identity);
    expect(remainingComponentLabel(view.sermon.remainingReview,"passage")).toContain("AI reviewed and accepted — no single primary passage");
    expect(view.sermon.readiness.hasRequiredPassageDecision).toBe(false);
    expect(view.sermon.readiness.isComplete).toBe(false);
    expect(view.sermon.primaryPassageReview).toBeNull();
    expect(JSON.stringify(f.sermon)).toBe(before);
    f.sermon.remainingReview!.components.passage={...f.sermon.remainingReview!.components.passage,state:"stale",accepted:false};
    expect(remainingComponentLabel(f.sermon.remainingReview,"passage")).not.toContain("no single primary");
  });
  it("projects all valid components and separate AI completion without changing legacy fields",async()=>{
    const f=fixture(), before=JSON.stringify(f.sermon);
    const view=await f.service.enrichmentReviewDetail(id,identity);
    expect(view.progress).toMatchObject({completedStageCount:6,percentReviewed:100,canFinish:true,stageCompletion:{identity:true,findings:true,transcript:true,description:true,questionAnswers:true,final:true}});
    expect(view.review).toMatchObject({currentStage:6,identityStatus:"pending",completedAt:null,emptyItemSetAcknowledgedAt:null});
    expect(view.sermon.readiness.isComplete).toBe(false);
    expect(JSON.stringify(f.sermon)).toBe(before);
    expect(remainingPrivateReviewRequirements(view.sermon)).toEqual([]);
    expect(remainingComponentLabel(view.sermon.remainingReview,"transcript")).toContain("audio accuracy not verified");
  });
  it("identical finish and navigation after AI completion create no human completion or audit",async()=>{
    const f=fixture(), input={sermonRowVersion:1,reviewRowVersion:1};
    for(let i=0;i<2;i++) {
      await f.service.finishEnrichmentReview(id,input,identity,"fixture-finish");
      await f.service.updateEnrichmentReviewProgress(id,{...input,currentStage:6},identity,"fixture-progress");
    }
    expect(f.tx.completeEnrichmentReview).not.toHaveBeenCalled();expect(f.tx.appendAudit).not.toHaveBeenCalled();
    expect(f.tx.updateEnrichmentReviewProgress).not.toHaveBeenCalled();expect(f.workflow.state.completedAt).toBeNull();
  });
  it("permits private navigation through accepted source requirements without acknowledging findings",async()=>{
    const f=fixture();f.sermon.remainingReview!.privateComplete=false;f.sermon.remainingReview!.completedAt=null;
    await f.service.updateEnrichmentReviewProgress(id,{sermonRowVersion:1,reviewRowVersion:1,currentStage:6},identity,"fixture-progress");
    expect(f.tx.updateEnrichmentReviewProgress).toHaveBeenCalledOnce();expect(f.workflow.state.identityStatus).toBe("pending");
    expect(f.workflow.state.emptyItemSetAcknowledgedAt).toBeNull();expect(f.tx.appendAudit).not.toHaveBeenCalled();
    expect((await f.service.enrichmentReviewDetail(id,identity)).progress.canFinish).toBe(false);
    await expect(f.service.finishEnrichmentReview(id,{sermonRowVersion:1,reviewRowVersion:2},identity,"fixture-finish")).rejects.toMatchObject({status:400});
    expect(f.tx.completeEnrichmentReview).not.toHaveBeenCalled();
  });
  it.each(["identity","speaker","findings","transcript"] as const)("blocks advancing over an unresolved %s requirement",async component=>{
    const f=fixture();f.sermon.remainingReview!.privateComplete=false;
    f.sermon.remainingReview!.components[component]={...f.sermon.remainingReview!.components[component],accepted:false,state:"needs_human"};
    await expect(f.service.updateEnrichmentReviewProgress(id,{sermonRowVersion:1,reviewRowVersion:1,currentStage:6},identity,"fixture")).rejects.toMatchObject({status:400});
    expect(f.tx.updateEnrichmentReviewProgress).not.toHaveBeenCalled();
  });
  it("a forged or stale complete projection cannot bypass a missing current Q&A decision",async()=>{
    const f=fixture();f.sermon.delegatedReview!.questionsComplete=false;
    await expect(f.service.finishEnrichmentReview(id,{sermonRowVersion:1,reviewRowVersion:1},identity,"fixture")).rejects.toMatchObject({status:400});
    expect(f.tx.completeEnrichmentReview).not.toHaveBeenCalled();
  });
  it.each(["pending","scheduled","published","unpublished","archived"] as const)("preserves the %s status guard in both handlers",async state=>{
    const f=fixture();f.sermon.status=state;
    await expect(f.service.finishEnrichmentReview(id,{sermonRowVersion:1,reviewRowVersion:1},identity,"fixture")).rejects.toMatchObject({status:400});
    await expect(f.service.updateEnrichmentReviewProgress(id,{sermonRowVersion:1,reviewRowVersion:1,currentStage:6},identity,"fixture")).rejects.toMatchObject({status:400});
    expect(f.tx.completeEnrichmentReview).not.toHaveBeenCalled();expect(f.tx.updateEnrichmentReviewProgress).not.toHaveBeenCalled();
  });
  it("preserves prior-publication, authorization and concurrent-version protection",async()=>{
    const f=fixture(),input={sermonRowVersion:1,reviewRowVersion:1};f.sermon.publishedAt=timestamp;
    await expect(f.service.finishEnrichmentReview(id,input,identity,"fixture")).rejects.toMatchObject({status:400});f.sermon.publishedAt=null;
    await expect(f.service.finishEnrichmentReview(id,{...input,sermonRowVersion:2},identity,"fixture")).rejects.toMatchObject({status:409});
    await expect(f.service.finishEnrichmentReview(id,{...input,reviewRowVersion:2},identity,"fixture")).rejects.toMatchObject({status:409});
    await expect(f.service.finishEnrichmentReview(id,input,{subject:"fixture",role:"viewer"} as unknown as ApplicationIdentity,"fixture")).rejects.toMatchObject({status:403});
    expect(f.tx.completeEnrichmentReview).not.toHaveBeenCalled();
  });
  it("keeps preserved human attribution and rejects obsolete completion fallback",()=>{
    const f=fixture();f.sermon.remainingReview!.completionReviewerSubject="fixture-human";
    f.sermon.remainingReview!.components.transcript.state="human_approved";
    expect(privateCompletionAttribution(f.sermon.remainingReview)).toContain("human");expect(remainingComponentLabel(f.sermon.remainingReview,"transcript")).toContain("human");
    f.sermon.enrichmentReview!.completedAt=timestamp;f.sermon.remainingReview!.privateComplete=false;
    expect(privateCompletionIsCurrent(f.sermon)).toBe(false);
    expect(remainingPrivateReviewRequirements(f.sermon)).toContain("Final private-review completion");
  });
  it("protects the exception-only API and offers no decision-write endpoint",async()=>{
    const f=fixture();const path="http://127.0.0.1/api/v1/admin/remaining-reviews";
    const anonymous=createAdminApiRouter(f.service,{authenticate:async()=>null});expect((await anonymous(new Request(path))).status).toBe(401);
    const denied=createAdminApiRouter(f.service,{authenticate:async()=>({subject:"fixture",role:"viewer"} as unknown as ApplicationIdentity)});expect((await denied(new Request(path))).status).toBe(403);
    const route=createAdminApiRouter(f.service,{authenticate:async()=>identity});
    const response=await route(new Request(path));expect(response.status).toBe(200);expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    for(const method of ["POST","PATCH","DELETE"])expect((await route(new Request(path,{method}))).status).toBe(405);
    expect(f.tx.appendAudit).not.toHaveBeenCalled();
  });
  it("keeps publication independent and never gives AI a publication approval path",async()=>{
    const f=fixture();
    await expect(f.service.transition(id,"publish",{rowVersion:1},identity,"fixture")).rejects.toMatchObject({status:400});
    expect(f.sermon.status).toBe("draft");expect(f.sermon.transcript!.status).toBe("draft");
    const source=await readFile(new URL("../src/admin/dashboard.ts",import.meta.url),"utf8");
    expect(source).toContain('path === "/admin/remaining-reviews"');
    expect(source).toContain("AI acceptance is separate from human approval");
    expect(source).toContain("escapeHtml(item.informationNeeded");
  });
});

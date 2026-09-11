import { describe, expect, it } from "vitest";
import { aggregateDelegatedReview, remainingPrivateReviewRequirements, substantiveDecisionLabel, type CurrentDelegatedDecision } from "../src/domain/delegated-review-status";

function rows(): CurrentDelegatedDecision[] {
  return ["description",...Array.from({length:7},(_,i)=>`qa:fixture-${i+1}`)].map((artifactKey,i)=>({
    sermonId:"fixture",artifactKey,displayOrder:i||null,outcome:"accepted",humanApprovalPreserved:false,
    reviewedAt:"2026-01-01T00:00:00.000Z",model:"gpt-6-astra",identityConfirmed:false,findingsComplete:false
  }));
}
const status=(r=rows())=>aggregateDelegatedReview(r).get("fixture")!;
describe("current private delegated-review projection",()=>{
  it("satisfies substantive work without making unrelated work or publication complete",()=>{
    const delegatedReview=status();
    expect(delegatedReview).toMatchObject({descriptionComplete:true,questionsComplete:true,substantiveComplete:true,aiAcceptedQuestions:7,identityConfirmed:false,findingsComplete:false});
    expect(substantiveDecisionLabel(delegatedReview.description)).toBe("AI reviewed and accepted");
    expect(remainingPrivateReviewRequirements({delegatedReview,enrichmentReview:{completedAt:null},readiness:{hasOneSpeaker:false,hasApprovedTranscript:false,hasRequiredPassageDecision:false,hasValidControlledMedia:true,hasApprovedDescription:false,hasRequiredQuestionAnswers:false}})).toEqual([
      "Identity, service date and source verification","Speaker selection","Source findings / zero-finding acknowledgement","Human transcript accuracy approval","Primary-passage decision","Final private-review completion"
    ]);
  });
  it("preserves human attribution alongside AI acceptance",()=>{
    const r=rows();r[0]!.humanApprovalPreserved=true;r[3]!.humanApprovalPreserved=true;
    expect(status(r)).toMatchObject({description:{state:"human_approved",model:null},humanApprovedQuestions:1,aiAcceptedQuestions:6,substantiveComplete:true});
    expect(substantiveDecisionLabel(status(r).description)).toBe("Human approved");
  });
  it.each(["stale","needs_human","incomplete"])("does not inherit a %s individual decision",outcome=>{
    const r=rows();r[4]!.outcome=outcome;
    expect(status(r)).toMatchObject({descriptionComplete:true,questionsComplete:false,substantiveComplete:false,aiAcceptedQuestions:6});
    r[0]!.outcome=outcome;expect(status(r).descriptionComplete).toBe(false);
  });
  it("requires five to ten unique consecutive current pairs, never historical set totals",()=>{
    expect(status(rows().slice(0,1)).questionsComplete).toBe(false);
    expect(status(rows().slice(0,5)).questionsComplete).toBe(false);
    const r=rows();r[5]!.displayOrder=8;expect(status(r).questionsComplete).toBe(false);
    const duplicates=rows();duplicates[5]!.artifactKey=duplicates[4]!.artifactKey;expect(status(duplicates).questionsComplete).toBe(false);
    expect(aggregateDelegatedReview([]).size).toBe(0);
  });
});

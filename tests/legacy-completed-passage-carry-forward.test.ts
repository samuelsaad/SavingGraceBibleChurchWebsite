import { describe, expect, it } from "vitest";
import {
  classifyLegacyCompletedPassage,
  legacyPassageCarryForwardActor,
  type LegacyPassageCandidate
} from "../src/scripture/legacy-completed-passage-carry-forward";

const eligible: LegacyPassageCandidate = {
  reviewComplete: true,
  completedBefore0015: true,
  priorContentDecisionsIntact: true,
  passageReviewStatus: "pending",
  passageReviewer: null,
  passageReviewedAtPresent: false,
  proposedReferenceCount: 1,
  proposedPrimaryCount: 1,
  proposedLeadCount: 1,
  structurallyValidProposedPrimaryCount: 1,
  confirmedPrimaryCount: 0,
  confirmedLeadCount: 0,
  confirmedByActorCount: 0,
  proposalExistedByCompletion: true,
  proposalUnchangedThroughCompletion: true,
  passageAuditAfterCompletionCount: 0,
  authorizationAuditCount: 0
};

describe("legacy completed primary-passage carry-forward", () => {
  it("carries forward only a pre-0015 completed review with an unchanged valid passage", () => {
    expect(classifyLegacyCompletedPassage(eligible)).toEqual({ outcome: "carry_forward" });
  });

  it("leaves incomplete, post-0015 and changed passages pending", () => {
    expect(classifyLegacyCompletedPassage({ ...eligible, reviewComplete: false })).toMatchObject({
      outcome: "pending", reasons: expect.arrayContaining(["six_stage_review_incomplete"])
    });
    expect(classifyLegacyCompletedPassage({ ...eligible, completedBefore0015: false })).toMatchObject({
      outcome: "pending", reasons: expect.arrayContaining(["completion_not_before_0015"])
    });
    expect(classifyLegacyCompletedPassage({ ...eligible, proposalUnchangedThroughCompletion: false })).toMatchObject({
      outcome: "pending", reasons: expect.arrayContaining(["passage_created_or_changed_after_completion"])
    });
  });

  it("leaves missing, malformed and ambiguous passages pending", () => {
    expect(classifyLegacyCompletedPassage({
      ...eligible,
      proposedReferenceCount: 0,
      proposedPrimaryCount: 0,
      proposedLeadCount: 0,
      structurallyValidProposedPrimaryCount: 0
    })).toMatchObject({ outcome: "pending", reasons: expect.arrayContaining(["missing_primary_passage"]) });
    expect(classifyLegacyCompletedPassage({
      ...eligible,
      structurallyValidProposedPrimaryCount: 0
    })).toMatchObject({ outcome: "pending", reasons: expect.arrayContaining(["malformed_primary_passage"]) });
    expect(classifyLegacyCompletedPassage({
      ...eligible,
      proposedLeadCount: 2
    })).toMatchObject({ outcome: "pending", reasons: expect.arrayContaining(["ambiguous_primary_passage"]) });
  });

  it("preserves existing explicit assigned and no-primary decisions", () => {
    expect(classifyLegacyCompletedPassage({
      ...eligible,
      passageReviewStatus: "confirmed_passage",
      passageReviewer: "another-admin",
      passageReviewedAtPresent: true
    })).toMatchObject({ outcome: "pending", reasons: expect.arrayContaining(["passage_state_confirmed_passage"]) });
    expect(classifyLegacyCompletedPassage({
      ...eligible,
      passageReviewStatus: "confirmed_none",
      passageReviewer: "local-admin-0001",
      passageReviewedAtPresent: true,
      proposedReferenceCount: 0,
      proposedPrimaryCount: 0,
      proposedLeadCount: 0,
      structurallyValidProposedPrimaryCount: 0
    })).toMatchObject({ outcome: "pending", reasons: expect.arrayContaining(["passage_state_confirmed_none"]) });
  });

  it("recognises one correctly attributed prior run and rejects contradictory audit state", () => {
    expect(classifyLegacyCompletedPassage({
      ...eligible,
      passageReviewStatus: "confirmed_passage",
      passageReviewer: legacyPassageCarryForwardActor,
      passageReviewedAtPresent: true,
      proposedReferenceCount: 0,
      proposedPrimaryCount: 0,
      proposedLeadCount: 0,
      structurallyValidProposedPrimaryCount: 0,
      confirmedPrimaryCount: 1,
      confirmedLeadCount: 1,
      confirmedByActorCount: 1,
      authorizationAuditCount: 1
    })).toEqual({ outcome: "preserved" });
    expect(classifyLegacyCompletedPassage({ ...eligible, authorizationAuditCount: 2 })).toEqual({
      outcome: "conflict", reasons: ["duplicate_authorization_audit"]
    });
  });

  it("does not carry forward when prior content-review evidence is no longer intact", () => {
    expect(classifyLegacyCompletedPassage({ ...eligible, priorContentDecisionsIntact: false })).toMatchObject({
      outcome: "pending", reasons: expect.arrayContaining(["prior_content_review_not_intact"])
    });
  });
});

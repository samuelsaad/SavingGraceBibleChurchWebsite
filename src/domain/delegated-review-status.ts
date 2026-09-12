import { z } from "zod";
import type { RemainingReviewStatus } from "./remaining-ai-review";
import { privateComponentAccepted, privateCompletionIsCurrent } from "./remaining-review-display";

export const substantiveDecisionSchema = z.object({
  artifactKey: z.string(),
  displayOrder: z.number().int().nullable(),
  state: z.enum(["human_approved", "ai_accepted", "stale", "needs_human", "pending"]),
  reviewedAt: z.string().nullable(),
  model: z.string().nullable()
});
export const delegatedContentStatusSchema = z.object({
  decision: z.literal("D-156"),
  description: substantiveDecisionSchema.nullable(),
  questions: z.array(substantiveDecisionSchema),
  descriptionComplete: z.boolean(),
  questionsComplete: z.boolean(),
  substantiveComplete: z.boolean(),
  humanApprovedQuestions: z.number().int().nonnegative(),
  aiAcceptedQuestions: z.number().int().nonnegative(),
  identityConfirmed: z.boolean(),
  findingsComplete: z.boolean()
});
export type DelegatedContentStatus = z.infer<typeof delegatedContentStatusSchema>;
export type SubstantiveDecision = z.infer<typeof substantiveDecisionSchema>;
export interface CurrentDelegatedDecision {
  sermonId: string;
  artifactKey: string;
  displayOrder: number | null;
  outcome: string;
  humanApprovalPreserved: boolean;
  reviewedAt: Date | string | null;
  model: string | null;
  identityConfirmed: boolean;
  findingsComplete: boolean;
}
const satisfied = (item: SubstantiveDecision | null) =>
  item?.state === "human_approved" || item?.state === "ai_accepted";

/** Derived only from current individual decisions, never from a collection marker.
 * This is private substantive review, NOT publication readiness or human approval. */
export function aggregateDelegatedReview(rows: readonly CurrentDelegatedDecision[]): Map<string, DelegatedContentStatus> {
  const grouped = new Map<string, CurrentDelegatedDecision[]>();
  for (const row of rows) grouped.set(row.sermonId, [...(grouped.get(row.sermonId) ?? []), row]);
  return new Map([...grouped].map(([id, items]) => {
    const decisions: SubstantiveDecision[] = items.map(row => ({
      artifactKey: row.artifactKey, displayOrder: row.displayOrder,
      state: row.humanApprovalPreserved ? "human_approved"
        : row.outcome === "accepted" || row.outcome === "corrected_accepted" ? "ai_accepted"
          : row.outcome === "stale" ? "stale" : row.outcome === "needs_human" ? "needs_human" : "pending",
      reviewedAt: row.reviewedAt instanceof Date ? row.reviewedAt.toISOString() : row.reviewedAt,
      model: row.humanApprovalPreserved ? null : row.model
    }));
    const descriptions = decisions.filter(row => row.artifactKey === "description");
    const description = descriptions.length === 1 ? descriptions[0]! : null;
    const questions = decisions.filter(row => row.artifactKey.startsWith("qa:")).sort((a,b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    const descriptionComplete = satisfied(description);
    const questionsComplete = questions.length >= 5 && questions.length <= 10 &&
      new Set(questions.map(q => q.artifactKey)).size === questions.length &&
      questions.every((q, index) => q.displayOrder === index + 1 && satisfied(q));
    return [id, {
      decision: "D-156", description, questions, descriptionComplete, questionsComplete,
      substantiveComplete: descriptionComplete && questionsComplete,
      humanApprovedQuestions: questions.filter(q => q.state === "human_approved").length,
      aiAcceptedQuestions: questions.filter(q => q.state === "ai_accepted").length,
      identityConfirmed: items.every(row => row.identityConfirmed),
      findingsComplete: items.every(row => row.findingsComplete)
    }];
  }));
}

export function substantiveDecisionLabel(item: SubstantiveDecision | null | undefined): string {
  return item?.state === "ai_accepted" ? "AI reviewed and accepted"
    : item?.state === "human_approved" ? "Human approved"
      : item?.state === "stale" ? "Previous AI review is stale — current content requires review"
        : item?.state === "needs_human" ? "Specific human decision required" : "Substantive review pending";
}

export function remainingPrivateReviewRequirements(sermon: {
  delegatedReview?: DelegatedContentStatus | undefined;
  remainingReview?: RemainingReviewStatus | undefined;
  readiness: { hasOneSpeaker: boolean; hasApprovedTranscript: boolean; hasRequiredPassageDecision: boolean; hasValidControlledMedia: boolean; hasApprovedDescription: boolean; hasRequiredQuestionAnswers: boolean };
  enrichmentReview: { completedAt: string | null } | null;
}): string[] {
  const d=sermon.delegatedReview, r=sermon.readiness;
  return [
    !privateComponentAccepted(sermon.remainingReview,"identity",d?.identityConfirmed ?? !!sermon.enrichmentReview?.completedAt) && "Identity, service date and source verification",
    !privateComponentAccepted(sermon.remainingReview,"speaker",r.hasOneSpeaker) && "Speaker selection",
    !privateComponentAccepted(sermon.remainingReview,"findings",d?.findingsComplete ?? !!sermon.enrichmentReview?.completedAt) && "Source findings / zero-finding acknowledgement",
    !privateComponentAccepted(sermon.remainingReview,"transcript",r.hasApprovedTranscript) && (sermon.remainingReview ? "Transcript retained-source fidelity review" : "Human transcript accuracy approval"),
    !privateComponentAccepted(sermon.remainingReview,"passage",r.hasRequiredPassageDecision) && "Primary-passage decision",
    !(d?.descriptionComplete ?? r.hasApprovedDescription) && "Current description substantive review",
    !(d?.questionsComplete ?? r.hasRequiredQuestionAnswers) && "Current individual Q&A substantive review",
    !privateComponentAccepted(sermon.remainingReview,"media",r.hasValidControlledMedia) && "Controlled media verification",
    !privateCompletionIsCurrent(sermon) && "Final private-review completion"
  ].filter((item): item is string => typeof item === "string");
}

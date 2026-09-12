import type { RemainingReviewStatus } from "./remaining-ai-review";

type Component = keyof RemainingReviewStatus["components"];

/** Private, already-current server projection only. Never a publication rule. */
export function privateComponentAccepted(
  status: RemainingReviewStatus | undefined, component: Component, humanFallback: boolean
): boolean {
  return status?.components[component].accepted ?? humanFallback;
}

export function remainingComponentLabel(status: RemainingReviewStatus | undefined, component: Component): string {
  const item=status?.components[component];
  if (!item) return "Review pending";
  if (component === "passage" && item.accepted && status?.passageBasis === "no_single_primary") {
    return item.state === "human_approved"
      ? "Existing human no-single-primary-passage decision preserved"
      : "AI reviewed and accepted — no single primary passage (topical or multi-passage)";
  }
  if (item.state === "human_approved") return item.sourceLimitation
    ? `Existing human decision preserved — retained-source verification is limited; source warning retained${item.warnings?.length ? ` (${item.warnings.join(", ")})` : ""}`
    : "Existing human decision preserved";
  if (item.state === "ai_accepted") return component === "transcript"
    ? "AI accepted retained-caption fidelity — audio accuracy not verified"
    : "AI reviewed and accepted";
  if (item.state === "accepted_source_limitation") return "AI accepted with documented source limitation — warnings retained";
  if (item.state === "stale") return "Previous AI acceptance is stale — current evidence requires review";
  if (item.state === "needs_human") return "Specific evidence or human decision required";
  return "AI review not yet completed";
}

export function privateCompletionIsCurrent(value: {
  remainingReview?: RemainingReviewStatus | undefined;
  enrichmentReview: { completedAt: string | null } | null;
}): boolean {
  // A scoped projection revalidates human and AI dependencies. Never fall back to
  // an obsolete legacy completion marker after a relevant dependency changed.
  return value.remainingReview
    ? value.remainingReview.privateComplete
    : value.enrichmentReview?.completedAt != null;
}

export function privateCompletionAttribution(status: RemainingReviewStatus | undefined): string {
  if (!status?.privateComplete) return "Private completion pending";
  return status.completionReviewerSubject === "codex-astra-remaining-private-review"
    ? "AI private completion — Codex Astra"
    : "Existing human private completion preserved";
}

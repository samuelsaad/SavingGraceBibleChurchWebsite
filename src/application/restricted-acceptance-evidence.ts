import type { PoolClient } from "pg";
import { remainingDependencyHash } from "../domain/remaining-ai-review";
import { listRemainingReviews, readRemainingReviewSnapshot } from "./remaining-ai-review-service";

/** No prose leaves this boundary. Navigation is intentionally not evidence. */
export async function inspectRestrictedAcceptance(client: PoolClient) {
  const reviews = await listRemainingReviews(client);
  const members = [];
  const blocked = [];
  for (const [sermonId, review] of reviews) {
    const snapshot = await readRemainingReviewSnapshot(client, sermonId);
    if (!snapshot) throw new Error("acceptance_snapshot_missing");
    if (!review.privateComplete || !review.canComplete || review.remaining.length ||
      !Object.values(review.components).every(component => component.accepted)) {
      blocked.push({ sermonId, reasons: review.remaining });
      continue;
    }
    members.push({ sermonId, rowVersion: snapshot.rowVersion,
      dependencySha256: remainingDependencyHash({ dependencies: snapshot.dependencies,
        substantive: snapshot.substantiveDependencySha256,
        completion: { at: review.completedAt, subject: review.completionReviewerSubject },
        scope: snapshot.scopeSha256, policy: snapshot.policySha256 }),
      completionKind: snapshot.existingHumanCompletedAt ? "human" : "ai",
      passageBasis: review.passageBasis });
  }
  members.sort((a,b) => a.sermonId.localeCompare(b.sermonId));
  blocked.sort((a,b) => a.sermonId.localeCompare(b.sermonId));
  return { decision: "D-158", version: 1, members, blocked };
}

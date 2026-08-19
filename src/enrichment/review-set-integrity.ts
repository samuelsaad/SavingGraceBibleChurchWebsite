import { createHash } from "node:crypto";

const sourceRecordKeyPattern = /^authorised-record-[1-9][0-9]*$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;

export interface ReviewSetIntegrityItem {
  identitySha256: string;
  sourceRecordKey: string;
  displayOrder: number;
  transcriptRowVersion: number;
  decisionStatus: "pending" | "accepted" | "corrected" | "left_unresolved" | "rejected";
}

export interface ReviewSetIntegrityInput {
  sourceRecordKey: string | null;
  expectedItemCount: number | null;
  expectedItemSetSha256: string | null;
  databaseItemSetSha256: string | null;
  expectedTranscriptSha256: string | null;
  expectedTranscriptRowVersion: number | null;
  storedItemCount: number;
  atomicItemCount: number;
  transcriptBody: string;
  transcriptRowVersion: number | null;
  emptyItemSetAcknowledged: boolean;
  items: readonly ReviewSetIntegrityItem[];
}

export interface ReviewSetIntegrityResult {
  expectedItemCount: number;
  actualItemSetSha256: string;
  sourceIdentityMatches: boolean;
  itemCountMatches: boolean;
  itemIdentityMatches: boolean;
  itemSetMatches: boolean;
  transcriptMatchesExpected: boolean;
  reviewSetVerified: boolean;
  resolvedItemCount: number;
  unresolvedItemCount: number;
  requiresEmptyItemSetAcknowledgement: boolean;
  findingsComplete: boolean;
  mismatchCauses: Array<"source_identity" | "item_count" | "item_identity" | "transcript_version">;
}

export function reviewSetSha256(identities: readonly string[]): string {
  return createHash("sha256").update(identities.join("\n"), "utf8").digest("hex");
}

function contentSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function evaluateReviewSetIntegrity(input: ReviewSetIntegrityInput): ReviewSetIntegrityResult {
  const expectedItemCount = input.expectedItemCount ?? input.items.length;
  const actualItemSetSha256 = reviewSetSha256(input.items.map((item) => item.identitySha256));
  const sourceIdentityMatches = input.sourceRecordKey !== null && sourceRecordKeyPattern.test(input.sourceRecordKey);
  const itemCountMatches = input.expectedItemCount !== null &&
    input.storedItemCount === input.expectedItemCount &&
    input.atomicItemCount === input.expectedItemCount &&
    input.items.length === input.expectedItemCount;
  const itemIdentityMatches = input.expectedItemSetSha256 !== null &&
    sha256Pattern.test(input.expectedItemSetSha256) &&
    input.databaseItemSetSha256 === input.expectedItemSetSha256 &&
    actualItemSetSha256 === input.expectedItemSetSha256 &&
    input.items.every((item, index) =>
      sha256Pattern.test(item.identitySha256) &&
      item.displayOrder === index + 1 &&
      item.sourceRecordKey === input.sourceRecordKey
    );
  const itemSetMatches = sourceIdentityMatches && itemCountMatches && itemIdentityMatches;
  const transcriptMatchesExpected = input.transcriptRowVersion !== null &&
    input.expectedTranscriptSha256 !== null &&
    input.expectedTranscriptRowVersion !== null &&
    contentSha256(input.transcriptBody) === input.expectedTranscriptSha256 &&
    input.transcriptRowVersion === input.expectedTranscriptRowVersion &&
    input.items.every((item) => item.transcriptRowVersion === input.transcriptRowVersion);
  const resolvedItemCount = input.items.filter((item) =>
    item.decisionStatus === "accepted" || item.decisionStatus === "corrected"
  ).length;
  const unresolvedItemCount = Math.max(expectedItemCount - resolvedItemCount, 0);
  const reviewSetVerified = itemSetMatches && transcriptMatchesExpected;
  const requiresEmptyItemSetAcknowledgement =
    expectedItemCount === 0 && reviewSetVerified && !input.emptyItemSetAcknowledged;
  const findingsComplete = reviewSetVerified && unresolvedItemCount === 0 &&
    (expectedItemCount > 0 || input.emptyItemSetAcknowledged);
  const mismatchCauses: ReviewSetIntegrityResult["mismatchCauses"] = [];
  if (!sourceIdentityMatches) mismatchCauses.push("source_identity");
  if (!itemCountMatches) mismatchCauses.push("item_count");
  if (!itemIdentityMatches) mismatchCauses.push("item_identity");
  if (!transcriptMatchesExpected) mismatchCauses.push("transcript_version");
  return {
    expectedItemCount,
    actualItemSetSha256,
    sourceIdentityMatches,
    itemCountMatches,
    itemIdentityMatches,
    itemSetMatches,
    transcriptMatchesExpected,
    reviewSetVerified,
    resolvedItemCount,
    unresolvedItemCount,
    requiresEmptyItemSetAcknowledgement,
    findingsComplete,
    mismatchCauses
  };
}

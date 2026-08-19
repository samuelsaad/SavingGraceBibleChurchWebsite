import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  evaluateReviewSetIntegrity,
  reviewSetSha256,
  type ReviewSetIntegrityInput,
  type ReviewSetIntegrityItem
} from "../src/enrichment/review-set-integrity";

const transcript = "An entirely fictional transcript used only for guided-review integrity tests.";
const transcriptSha256 = createHash("sha256").update(transcript, "utf8").digest("hex");

function zeroFindingInput(): ReviewSetIntegrityInput {
  const emptySet = reviewSetSha256([]);
  return {
    sourceRecordKey: "authorised-record-9001",
    expectedItemCount: 0,
    expectedItemSetSha256: emptySet,
    databaseItemSetSha256: emptySet,
    expectedTranscriptSha256: transcriptSha256,
    expectedTranscriptRowVersion: 3,
    storedItemCount: 0,
    atomicItemCount: 0,
    transcriptBody: transcript,
    transcriptRowVersion: 3,
    emptyItemSetAcknowledged: false,
    items: []
  };
}

function flaggedItems(): ReviewSetIntegrityItem[] {
  return [
    {
      identitySha256: "1".repeat(64),
      sourceRecordKey: "authorised-record-9002",
      displayOrder: 1,
      transcriptRowVersion: 4,
      decisionStatus: "pending"
    },
    {
      identitySha256: "2".repeat(64),
      sourceRecordKey: "authorised-record-9002",
      displayOrder: 2,
      transcriptRowVersion: 4,
      decisionStatus: "pending"
    }
  ];
}

function flaggedInput(items = flaggedItems()): ReviewSetIntegrityInput {
  const setSha256 = reviewSetSha256(items.map((item) => item.identitySha256));
  return {
    sourceRecordKey: "authorised-record-9002",
    expectedItemCount: 2,
    expectedItemSetSha256: setSha256,
    databaseItemSetSha256: setSha256,
    expectedTranscriptSha256: transcriptSha256,
    expectedTranscriptRowVersion: 4,
    storedItemCount: 2,
    atomicItemCount: 2,
    transcriptBody: transcript,
    transcriptRowVersion: 4,
    emptyItemSetAcknowledged: false,
    items
  };
}

describe("guided-review set integrity", () => {
  it("verifies a zero-finding set but requires explicit acknowledgement before completion", () => {
    const result = evaluateReviewSetIntegrity(zeroFindingInput());
    expect(result).toMatchObject({
      sourceIdentityMatches: true,
      itemCountMatches: true,
      itemIdentityMatches: true,
      transcriptMatchesExpected: true,
      reviewSetVerified: true,
      unresolvedItemCount: 0,
      requiresEmptyItemSetAcknowledgement: true,
      findingsComplete: false,
      mismatchCauses: []
    });
  });

  it("verifies flagged items while keeping the findings stage locked until every decision is resolved", () => {
    const pending = evaluateReviewSetIntegrity(flaggedInput());
    expect(pending).toMatchObject({
      reviewSetVerified: true,
      resolvedItemCount: 0,
      unresolvedItemCount: 2,
      findingsComplete: false
    });
    const resolvedItems = flaggedItems().map((item, index) => ({
      ...item,
      decisionStatus: index === 0 ? "accepted" as const : "corrected" as const
    }));
    expect(evaluateReviewSetIntegrity(flaggedInput(resolvedItems))).toMatchObject({
      reviewSetVerified: true,
      resolvedItemCount: 2,
      unresolvedItemCount: 0,
      findingsComplete: true
    });
  });

  it("diagnoses source identity, item count, item identity and transcript version independently", () => {
    const source = zeroFindingInput();
    source.sourceRecordKey = null;
    expect(evaluateReviewSetIntegrity(source).mismatchCauses).toEqual(["source_identity"]);

    const count = flaggedInput();
    count.storedItemCount = 1;
    expect(evaluateReviewSetIntegrity(count).mismatchCauses).toEqual(["item_count"]);

    const identity = flaggedInput();
    identity.items = [{ ...identity.items[0]!, identitySha256: "3".repeat(64) }, identity.items[1]!];
    expect(evaluateReviewSetIntegrity(identity).mismatchCauses).toEqual(["item_identity"]);

    const version = zeroFindingInput();
    version.expectedTranscriptRowVersion = 2;
    expect(evaluateReviewSetIntegrity(version).mismatchCauses).toEqual(["transcript_version"]);
  });

  it("does not mutate or discard existing administrator decisions", () => {
    const items = flaggedItems().map((item, index) => ({
      ...item,
      decisionStatus: index === 0 ? "accepted" as const : "corrected" as const
    }));
    const input = flaggedInput(items);
    const before = structuredClone(input);
    const result = evaluateReviewSetIntegrity(input);
    expect(input).toEqual(before);
    expect(result.resolvedItemCount).toBe(2);
  });

  it("keeps later stages locked until a verified zero set is genuinely acknowledged", () => {
    const input = zeroFindingInput();
    expect(evaluateReviewSetIntegrity(input).findingsComplete).toBe(false);
    input.emptyItemSetAcknowledged = true;
    expect(evaluateReviewSetIntegrity(input)).toMatchObject({
      reviewSetVerified: true,
      requiresEmptyItemSetAcknowledgement: false,
      findingsComplete: true
    });
  });
});

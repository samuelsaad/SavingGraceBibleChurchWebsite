import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fourthBatchReviewFindings } from "../src/enrichment/fourth-fixed-batch-review-findings";
import { atomicReviewItemSetSha256 } from "../src/enrichment/atomic-review-contracts";
import { evaluateReviewSetIntegrity } from "../src/enrichment/review-set-integrity";

const id = "11111111-1111-4111-8111-111111111111";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const build = (text: string) => fourthBatchReviewFindings(text,id,"authorised-record-90001",hash(text));
describe("D-155 source-redaction review metadata (anonymised)", () => {
  it("retains the valid zero-finding contract without acknowledging it", () => {
    const result = build("A complete synthetic sentence.");
    expect(result.items).toEqual([]);
    expect(result.unresolvedPassages).toEqual([]);
    expect(result.setSha256).toBe(hash(""));
    expect(JSON.stringify(result)).not.toContain("approved");
  });
  it("binds each exact marker to its paragraph and offset without rewriting the transcript", () => {
    const text = "First synthetic [ __ ] sentence.\n\nSecond [ __ ] sentence.";
    const before = Buffer.from(text);
    const result = build(text);
    expect(result.items.map(i=>i.supportingParagraphs)).toEqual([[1],[2]]);
    expect(result.items.map(i=>i.categoryOrdinal)).toEqual([1,2]);
    expect(result.items.every(i=>i.sourceMarker==="[ __ ]" && i.sourceTranscriptSha256===hash(text))).toBe(true);
    expect(new Set(result.items.map(i=>i.id)).size).toBe(2);
    expect(result.setSha256).toBe(atomicReviewItemSetSha256(result.items));
    expect(Buffer.from(text).equals(before)).toBe(true);
    expect(build(text)).toEqual(result);
    const gate=evaluateReviewSetIntegrity({sourceRecordKey:"authorised-record-90001",expectedItemCount:2,
      expectedItemSetSha256:result.setSha256,databaseItemSetSha256:result.setSha256,
      expectedTranscriptSha256:hash(text),expectedTranscriptRowVersion:1,storedItemCount:2,atomicItemCount:2,
      transcriptBody:text,transcriptRowVersion:1,emptyItemSetAcknowledged:false,
      items:result.items.map(item=>({...item,transcriptRowVersion:1,decisionStatus:"pending" as const}))});
    expect(gate.reviewSetVerified).toBe(true);
    expect(gate.findingsComplete).toBe(false);
    expect(gate.requiresEmptyItemSetAcknowledgement).toBe(false);
    expect(gate.unresolvedItemCount).toBe(2);
  });
  it("changes item identity when transcript bytes or source identity changes", () => {
    const text="An [ __ ] example.";
    expect(build(text).setSha256).not.toBe(build(`${text} More context.`).setSha256);
    expect(build(text).setSha256).not.toBe(fourthBatchReviewFindings(text,id,"authorised-record-90002",hash(text)).setSha256);
  });
  it("refuses a mismatched transcript hash and malformed source identity", () => {
    expect(()=>fourthBatchReviewFindings("[ __ ]",id,"authorised-record-90001","a".repeat(64))).toThrow("source_mismatch");
    expect(()=>fourthBatchReviewFindings("[ __ ]",id,"unbounded",hash("[ __ ]"))).toThrow("source_mismatch");
  });
  it("keeps diagnostic metadata free of adjacent source prose", () => {
    const text="Synthetic private context before [ __ ] and after.";
    expect(JSON.stringify(build(text))).not.toContain("Synthetic private context");
    expect(JSON.stringify(build(text))).not.toContain("and after");
  });
  it("fails closed above the existing per-category review limit", () => {
    expect(()=>build("[ __ ] ".repeat(101))).toThrow("limit_exceeded");
  });
});

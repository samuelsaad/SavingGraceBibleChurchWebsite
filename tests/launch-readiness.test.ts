import { describe, expect, it } from "vitest";
import { evaluateHistoricalLaunchReadiness } from "../src/readiness/launch-readiness";

const complete = (sourceWordPressId: number) => ({
  sourceWordPressId,
  hasOneSpeaker: true,
  hasApprovedTranscript: true,
  approvedQuestionCount: 5,
  totalQuestionCount: 5,
  allQuestionsApproved: true,
  hasValidControlledMedia: true
});

describe("historical launch gate", () => {
  it("fails when even one of the required 453 records is incomplete", () => {
    const records = Array.from({ length: 453 }, (_, index) => complete(index + 1));
    records[199]!.hasApprovedTranscript = false;
    const report = evaluateHistoricalLaunchReadiness(records);
    expect(report.passed).toBe(false);
    expect(report.incompleteRecords).toBe(1);
    expect(report.missing).toEqual([
      { sourceWordPressId: 200, requirements: ["approved_transcript"] }
    ]);
  });

  it("passes only at exactly 453 of 453 complete", () => {
    const completeRecords = Array.from({ length: 453 }, (_, index) => complete(index + 1));
    expect(evaluateHistoricalLaunchReadiness(completeRecords).passed).toBe(true);
    expect(evaluateHistoricalLaunchReadiness(completeRecords.slice(0, 452)).passed).toBe(false);
    expect(evaluateHistoricalLaunchReadiness([...completeRecords, complete(454)]).passed).toBe(false);
  });
});

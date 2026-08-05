export interface HistoricalReadinessRecord {
  sourceWordPressId: number;
  hasOneSpeaker: boolean;
  hasApprovedTranscript: boolean;
  approvedQuestionCount: number;
  totalQuestionCount: number;
  allQuestionsApproved: boolean;
  hasValidControlledMedia: boolean;
}

export interface LaunchReadinessReport {
  expectedIncludedHistoricalRecords: number;
  includedHistoricalRecords: number;
  recordsWithExactlyOneSpeaker: number;
  approvedTranscripts: number;
  recordsWithApprovedQuestionAnswers: number;
  recordsWithValidControlledMedia: number;
  incompleteRecords: number;
  passed: boolean;
  missing: Array<{
    sourceWordPressId: number;
    requirements: string[];
  }>;
}

export function evaluateHistoricalLaunchReadiness(
  records: HistoricalReadinessRecord[],
  expectedIncludedHistoricalRecords = 453
): LaunchReadinessReport {
  const ordered = [...records].sort(
    (left, right) => left.sourceWordPressId - right.sourceWordPressId
  );
  const missing = ordered.flatMap((record) => {
    const requirements: string[] = [];
    if (!record.hasOneSpeaker) requirements.push("speaker");
    if (!record.hasApprovedTranscript) requirements.push("approved_transcript");
    if (
      record.totalQuestionCount < 5 ||
      record.totalQuestionCount > 10 ||
      record.approvedQuestionCount !== record.totalQuestionCount ||
      !record.allQuestionsApproved
    ) {
      requirements.push("approved_question_answers");
    }
    if (!record.hasValidControlledMedia) requirements.push("controlled_media");
    return requirements.length
      ? [{ sourceWordPressId: record.sourceWordPressId, requirements }]
      : [];
  });
  const recordsWithApprovedQuestionAnswers = ordered.filter(
    (record) =>
      record.totalQuestionCount >= 5 &&
      record.totalQuestionCount <= 10 &&
      record.approvedQuestionCount === record.totalQuestionCount &&
      record.allQuestionsApproved
  ).length;
  const report = {
    expectedIncludedHistoricalRecords,
    includedHistoricalRecords: ordered.length,
    recordsWithExactlyOneSpeaker: ordered.filter((record) => record.hasOneSpeaker).length,
    approvedTranscripts: ordered.filter((record) => record.hasApprovedTranscript).length,
    recordsWithApprovedQuestionAnswers,
    recordsWithValidControlledMedia: ordered.filter(
      (record) => record.hasValidControlledMedia
    ).length,
    incompleteRecords: missing.length,
    missing
  };
  return {
    ...report,
    passed:
      report.includedHistoricalRecords === expectedIncludedHistoricalRecords &&
      report.recordsWithExactlyOneSpeaker === expectedIncludedHistoricalRecords &&
      report.approvedTranscripts === expectedIncludedHistoricalRecords &&
      report.recordsWithApprovedQuestionAnswers === expectedIncludedHistoricalRecords &&
      report.recordsWithValidControlledMedia === expectedIncludedHistoricalRecords &&
      report.incompleteRecords === 0
  };
}

import type { PublicMedia } from "./sermon";

export type TranscriptStatus = "missing" | "draft" | "in_review" | "approved";
export type QuestionAnswerStatus = "draft" | "in_review" | "approved";

export interface ReadinessTranscript {
  bodyText: string;
  status: TranscriptStatus;
}

export interface ReadinessQuestionAnswer {
  question: string;
  answer: string;
  status: QuestionAnswerStatus;
  displayOrder: number;
}

export interface ContentReadinessIssue {
  path: string;
  code:
    | "missing_speaker"
    | "missing_transcript"
    | "transcript_awaiting_review"
    | "insufficient_questions"
    | "questions_awaiting_review"
    | "blank_question"
    | "blank_answer"
    | "invalid_question_order"
    | "missing_media";
  message: string;
}

export interface ContentReadinessResult {
  isComplete: boolean;
  hasOneSpeaker: boolean;
  hasApprovedTranscript: boolean;
  approvedQuestionCount: number;
  totalQuestionCount: number;
  hasRequiredQuestionAnswers: boolean;
  allQuestionsApproved: boolean;
  hasValidControlledMedia: boolean;
  issues: ContentReadinessIssue[];
}

export interface ContentReadinessInput {
  speakerId: string | null;
  transcript: ReadinessTranscript | null;
  questionAnswers: ReadinessQuestionAnswer[];
  media: PublicMedia[];
}

export function containsHtmlTag(value: string): boolean {
  return /<[^>]+>/.test(value);
}

export function evaluateContentReadiness(input: ContentReadinessInput): ContentReadinessResult {
  const issues: ContentReadinessIssue[] = [];
  const hasOneSpeaker = input.speakerId !== null;
  if (!hasOneSpeaker) {
    issues.push({
      path: "speakerId",
      code: "missing_speaker",
      message: "Choose one speaker before scheduling or publishing."
    });
  }

  const hasTranscriptBody = Boolean(input.transcript?.bodyText.trim());
  const hasApprovedTranscript = hasTranscriptBody && input.transcript?.status === "approved";
  if (!hasTranscriptBody) {
    issues.push({
      path: "transcript.bodyText",
      code: "missing_transcript",
      message: "Add the complete transcript."
    });
  } else if (!hasApprovedTranscript) {
    issues.push({
      path: "transcript.status",
      code: "transcript_awaiting_review",
      message: "The full transcript must be reviewed and approved."
    });
  }

  const ordered = [...input.questionAnswers].sort(
    (left, right) => left.displayOrder - right.displayOrder
  );
  const hasStableOrder = ordered.every((item, index) => item.displayOrder === index + 1);
  if (!hasStableOrder && ordered.length > 0) {
    issues.push({
      path: "questionAnswers",
      code: "invalid_question_order",
      message: "Questions must use a stable consecutive order starting at 1."
    });
  }
  ordered.forEach((item, index) => {
    if (!item.question.trim()) {
      issues.push({
        path: `questionAnswers.${index}.question`,
        code: "blank_question",
        message: "Question text is required."
      });
    }
    if (!item.answer.trim()) {
      issues.push({
        path: `questionAnswers.${index}.answer`,
        code: "blank_answer",
        message: "Answer text is required."
      });
    }
  });
  const totalQuestionCount = input.questionAnswers.length;
  const approvedQuestionCount = input.questionAnswers.filter(
    (item) => item.status === "approved" && item.question.trim() && item.answer.trim()
  ).length;
  const allQuestionsApproved =
    totalQuestionCount > 0 && approvedQuestionCount === totalQuestionCount;
  const hasRequiredQuestionAnswers =
    totalQuestionCount >= 5 &&
    totalQuestionCount <= 10 &&
    approvedQuestionCount === totalQuestionCount &&
    hasStableOrder;
  if (totalQuestionCount < 5 || totalQuestionCount > 10) {
    issues.push({
      path: "questionAnswers",
      code: "insufficient_questions",
      message: "Add between 5 and 10 complete questions with answers."
    });
  } else if (!allQuestionsApproved) {
    issues.push({
      path: "questionAnswers",
      code: "questions_awaiting_review",
      message: "Every question and answer must be reviewed and approved."
    });
  }

  const hasValidControlledMedia =
    input.media.length > 0 &&
    input.media.every(
      (item) =>
        (item.provider === "youtube" || item.provider === "sermonaudio") &&
        Boolean(item.canonicalUrl) &&
        Boolean(item.title.trim())
    );
  if (!hasValidControlledMedia) {
    issues.push({
      path: "media",
      code: "missing_media",
      message: "Add at least one valid controlled YouTube or SermonAudio item."
    });
  }

  return {
    isComplete:
      hasOneSpeaker &&
      hasApprovedTranscript &&
      hasRequiredQuestionAnswers &&
      hasValidControlledMedia &&
      !issues.some((issue) => issue.code === "blank_question" || issue.code === "blank_answer"),
    hasOneSpeaker,
    hasApprovedTranscript,
    approvedQuestionCount,
    totalQuestionCount,
    hasRequiredQuestionAnswers,
    allQuestionsApproved,
    hasValidControlledMedia,
    issues
  };
}

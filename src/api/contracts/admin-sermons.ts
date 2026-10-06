import { z } from "zod";
import { fillExplicitPrimaryBook } from "../../domain/primary-book-resolution";
import { isoDateSchema, sermonStatusSchema } from "../../domain/sermon";
import { containsHtmlTag } from "../../domain/content-readiness";
import { delegatedContentStatusSchema } from "../../domain/delegated-review-status";
import { remainingReviewStatusSchema } from "../../domain/remaining-ai-review";
import { formatBiblePassage, validateBiblePassage } from "../../domain/bible-passage";
import { youtubeVideoIdFromUrl, youtubeVideoIdPattern } from "../../domain/youtube";

export const applicationRoleSchema = z.literal("admin");
export type ApplicationRole = z.infer<typeof applicationRoleSchema>;

const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const uniqueUuidArray = z
  .array(z.uuid())
  .max(100)
  .refine((values) => new Set(values).size === values.length, "Relationship IDs must be unique");

const safePlainText = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine((value) => !containsHtmlTag(value), "Use plain text; HTML tags are not accepted");

export const transcriptStatusSchema = z.enum(["missing", "draft", "in_review", "approved"]);
export const descriptionStatusSchema = z.enum(["missing", "draft", "in_review", "approved"]);
export const descriptionSourceKindSchema = z.enum(["manual", "imported", "generated_draft"]);
export const questionAnswerStatusSchema = z.enum(["draft", "in_review", "approved"]);
export const enrichmentReviewIdentityStatusSchema = z.enum(["pending", "confirmed"]);
export const enrichmentReviewItemCategorySchema = z.enum([
  "caption_error",
  "name_or_scripture_reference"
]);
export const enrichmentReviewItemDecisionSchema = z.enum([
  "pending",
  "accepted",
  "corrected",
  "left_unresolved",
  "rejected"
]);

export const transcriptInputSchema = z.object({
  bodyText: safePlainText(500_000),
  status: transcriptStatusSchema,
  sourceKind: z.enum(["manual", "caption", "transcription", "imported", "generated_draft"])
    .default("manual"),
  sourceReference: safePlainText(500).trim().min(1).nullable().default(null)
}).strict().superRefine((value, context) => {
  if (value.status !== "missing" && !value.bodyText.trim()) {
    context.addIssue({
      code: "custom",
      path: ["bodyText"],
      message: "Transcript text is required once work has started"
    });
  }
  if (value.status === "missing" && value.bodyText.trim()) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "A nonblank transcript cannot have missing status"
    });
  }
});

export const questionAnswerInputSchema = z.object({
  question: safePlainText(1_000).trim().min(1),
  answer: safePlainText(10_000).trim().min(1),
  status: questionAnswerStatusSchema,
  sourceKind: z.enum(["manual", "imported", "generated_draft"]).default("manual"),
  sourceReference: safePlainText(500).trim().min(1).nullable().default(null)
}).strict();

export const controlledMediaInputSchema = z
  .object({
    provider: z.enum(["youtube", "sermonaudio"]),
    mediaType: z.enum(["video", "audio"]),
    externalId: z.string().trim().min(1).max(500).nullable(),
    canonicalUrl: z.url().max(2_000),
    title: z.string().trim().min(1).max(500)
  })
  .strict()
  .superRefine((value, context) => {
    const url = new URL(value.canonicalUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.protocol !== "https:") {
      context.addIssue({ code: "custom", path: ["canonicalUrl"], message: "Controlled media must use HTTPS" });
    }
    if (
      value.provider === "youtube" &&
      !(host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be")
    ) {
      context.addIssue({ code: "custom", path: ["canonicalUrl"], message: "Expected a YouTube URL" });
    }
    if (
      value.provider === "sermonaudio" &&
      !(host === "sermonaudio.com" || host.endsWith(".sermonaudio.com"))
    ) {
      context.addIssue({ code: "custom", path: ["canonicalUrl"], message: "Expected a SermonAudio URL" });
    }
    if (value.provider === "youtube" && value.mediaType !== "video") {
      context.addIssue({ code: "custom", path: ["mediaType"], message: "YouTube media must be video" });
    }
    if (value.provider === "youtube") {
      const canonicalId = youtubeVideoIdFromUrl(value.canonicalUrl);
      if (canonicalId === null) {
        context.addIssue({ code: "custom", path: ["canonicalUrl"], message: "Expected a supported YouTube video URL" });
      }
      if (value.externalId !== null && !youtubeVideoIdPattern.test(value.externalId)) {
        context.addIssue({ code: "custom", path: ["externalId"], message: "Expected a YouTube video ID" });
      }
      if (value.externalId !== null && canonicalId !== null && value.externalId !== canonicalId) {
        context.addIssue({ code: "custom", path: ["externalId"], message: "YouTube URL and video ID must match" });
      }
    }
    if (value.provider === "sermonaudio" && value.mediaType !== "audio") {
      context.addIssue({ code: "custom", path: ["mediaType"], message: "SermonAudio media must be audio" });
    }
  });

export const scriptureReferenceInputSchema = z
  .object({
    displayText: z.string().trim().min(1).max(500),
    canonicalBookId: z.number().int().min(1).max(66).nullable().default(null),
    startChapter: z.number().int().positive().nullable().default(null),
    startVerse: z.number().int().positive().nullable().default(null),
    endChapter: z.number().int().positive().nullable().default(null),
    endVerse: z.number().int().positive().nullable().default(null),
    relationshipRole: z.enum(["primary", "supporting", "unclassified"]).default("unclassified"),
    isLead: z.boolean().default(false)
  })
  .strict()
  .overwrite(fillExplicitPrimaryBook)
  .refine((value) => value.endChapter === null || value.startChapter !== null, {
    path: ["endChapter"],
    message: "endChapter requires startChapter"
  })
  .refine((value) => (value.startChapter === null) === (value.endChapter === null), {
    path: ["endChapter"],
    message: "Starting and ending chapters must either both be present or both be absent"
  })
  .refine((value) => value.startVerse === null || value.startChapter !== null, {
    path: ["startVerse"],
    message: "startVerse requires startChapter"
  })
  .refine((value) => value.endVerse === null || value.startVerse !== null, {
    path: ["endVerse"],
    message: "endVerse requires startVerse"
  })
  .refine((value) => !value.isLead || value.relationshipRole === "primary", {
    path: ["isLead"],
    message: "Only a primary passage can be the lead passage"
  })
  .refine(
    (value) => value.relationshipRole !== "primary" ||
      value.canonicalBookId !== null,
    { path: ["relationshipRole"], message: "A primary passage requires a canonical Bible book" }
  );

export const primaryPassageInputSchema = z.object({
  canonicalBookId: z.number().int().min(1).max(66),
  startChapter: z.number().int().positive().nullable().default(null),
  startVerse: z.number().int().positive().nullable().default(null),
  endChapter: z.number().int().positive().nullable().default(null),
  endVerse: z.number().int().positive().nullable().default(null),
  relationshipRole: z.enum(["primary", "supporting"]),
  isLead: z.boolean().default(false)
}).strict().superRefine((value, context) => {
  const result = validateBiblePassage(value);
  for (const message of result.issues) {
    context.addIssue({ code: "custom", path: ["startChapter"], message });
  }
  if (value.isLead && value.relationshipRole !== "primary") {
    context.addIssue({ code: "custom", path: ["isLead"], message: "Only a primary passage can be the lead passage" });
  }
  try {
    formatBiblePassage(value);
  } catch {
    context.addIssue({ code: "custom", path: ["canonicalBookId"], message: "Unknown canonical Bible book" });
  }
});

export const primaryPassageDecisionInputSchema = z.object({
  sermonRowVersion: z.number().int().positive(),
  reviewRowVersion: z.number().int().positive(),
  action: z.enum(["confirm_passages", "reject_proposal", "confirm_no_primary_passage"]),
  passages: z.array(primaryPassageInputSchema).max(10).default([])
}).strict().superRefine((value, context) => {
  if (value.action === "confirm_passages") {
    if (!value.passages.some((passage) => passage.relationshipRole === "primary")) {
      context.addIssue({ code: "custom", path: ["passages"], message: "Confirm at least one primary preaching passage" });
    }
    if (value.passages.filter((passage) => passage.isLead).length !== 1) {
      context.addIssue({ code: "custom", path: ["passages"], message: "Choose exactly one lead primary passage" });
    }
    const identities = value.passages.map((passage) => [
      passage.canonicalBookId,
      passage.startChapter,
      passage.startVerse ?? 0,
      passage.endChapter,
      passage.endVerse ?? 0
    ].join(":"));
    if (new Set(identities).size !== identities.length) {
      context.addIssue({ code: "custom", path: ["passages"], message: "Do not enter the same passage and relationship twice" });
    }
  } else if (value.passages.length !== 0) {
    context.addIssue({ code: "custom", path: ["passages"], message: "This decision does not accept passage values" });
  }
});
export type PrimaryPassageDecisionInput = z.infer<typeof primaryPassageDecisionInputSchema>;

export const adminPrimaryPassageStateSchema = z.enum([
  "proposed_passage",
  "confirmed_passage",
  "pending_review",
  "no_primary_passage",
  "no_proposal_detected",
  "proposal_rejected"
]);
export type AdminPrimaryPassageState = z.infer<typeof adminPrimaryPassageStateSchema>;

const editableSermonFieldsShape = {
  title: z.string().trim().min(1).max(240),
  slug: slugSchema,
  serviceDate: isoDateSchema,
  summary: safePlainText(2_000).nullable(),
  summaryStatus: descriptionStatusSchema,
  summarySourceKind: descriptionSourceKindSchema,
  summarySourceReference: safePlainText(500).trim().min(1).nullable(),
  seoDescription: safePlainText(320).trim().min(1).nullable(),
  body: z.string().max(200_000).nullable(),
  speakerId: z.uuid().nullable(),
  seriesIds: uniqueUuidArray,
  bookClassificationIds: uniqueUuidArray,
  scriptureReferences: z.array(scriptureReferenceInputSchema).max(50),
  media: z.array(controlledMediaInputSchema).max(20),
  transcript: transcriptInputSchema,
  questionAnswers: z.array(questionAnswerInputSchema).max(10)
};

function validateDescription(
  value: {
    summary?: string | null | undefined;
    summaryStatus?: z.infer<typeof descriptionStatusSchema> | undefined;
    seoDescription?: string | null | undefined;
  },
  context: z.RefinementCtx,
  requireCompletePair: boolean
): void {
  if (requireCompletePair && value.summary !== undefined && value.summaryStatus === undefined) {
    context.addIssue({
      code: "custom",
      path: ["summaryStatus"],
      message: "Choose the sermon description review status when editing its text"
    });
    return;
  }
  if (value.summaryStatus === undefined) return;
  const length = value.summary?.trim().length ?? 0;
  if (value.summaryStatus === "missing" && length > 0) {
    context.addIssue({ code: "custom", path: ["summaryStatus"], message: "A nonblank description cannot have missing status" });
  }
  if (value.summaryStatus !== "missing" && length === 0 && value.summary !== undefined) {
    context.addIssue({ code: "custom", path: ["summary"], message: "Sermon description text is required once work has started" });
  }
  if (value.summaryStatus === "approved" && value.summary !== undefined && length < 80) {
    context.addIssue({ code: "custom", path: ["summary"], message: "An approved sermon description must contain at least 80 characters" });
  }
  if (value.seoDescription && value.summaryStatus !== undefined && value.summaryStatus !== "approved") {
    context.addIssue({
      code: "custom",
      path: ["seoDescription"],
      message: "An SEO description override requires an approved sermon description"
    });
  }
}

export const createSermonInputSchema = z.object({
  ...editableSermonFieldsShape,
  summary: editableSermonFieldsShape.summary.default(null),
  summaryStatus: descriptionStatusSchema.default("missing"),
  summarySourceKind: descriptionSourceKindSchema.default("manual"),
  summarySourceReference: editableSermonFieldsShape.summarySourceReference.default(null),
  seoDescription: editableSermonFieldsShape.seoDescription.default(null),
  body: editableSermonFieldsShape.body.default(null),
  speakerId: z.uuid().nullable().default(null),
  seriesIds: uniqueUuidArray.default([]),
  bookClassificationIds: uniqueUuidArray.default([]),
  scriptureReferences: editableSermonFieldsShape.scriptureReferences.default([]),
  media: editableSermonFieldsShape.media.default([]),
  transcript: transcriptInputSchema.default({
    bodyText: "",
    status: "missing",
    sourceKind: "manual",
    sourceReference: null
  }),
  questionAnswers: z.array(questionAnswerInputSchema).max(10).default([])
}).strict().superRefine((value, context) => validateDescription(value, context, false));
export type CreateSermonInput = z.infer<typeof createSermonInputSchema>;

export const updateSermonInputSchema = z.object({
  title: editableSermonFieldsShape.title.optional(),
  slug: editableSermonFieldsShape.slug.optional(),
  serviceDate: editableSermonFieldsShape.serviceDate.optional(),
  summary: editableSermonFieldsShape.summary.optional(),
  summaryStatus: editableSermonFieldsShape.summaryStatus.optional(),
  summarySourceKind: editableSermonFieldsShape.summarySourceKind.optional(),
  summarySourceReference: editableSermonFieldsShape.summarySourceReference.optional(),
  seoDescription: editableSermonFieldsShape.seoDescription.optional(),
  body: editableSermonFieldsShape.body.optional(),
  speakerId: editableSermonFieldsShape.speakerId.optional(),
  seriesIds: editableSermonFieldsShape.seriesIds.optional(),
  bookClassificationIds: editableSermonFieldsShape.bookClassificationIds.optional(),
  scriptureReferences: editableSermonFieldsShape.scriptureReferences.optional(),
  media: editableSermonFieldsShape.media.optional(),
  transcript: editableSermonFieldsShape.transcript.optional(),
  questionAnswers: editableSermonFieldsShape.questionAnswers.optional(),
  rowVersion: z.number().int().positive()
}).strict()
  .refine((value) => Object.keys(value).some((key) => key !== "rowVersion"), {
    message: "At least one editable field is required"
  })
  .superRefine((value, context) => validateDescription(value, context, true));
export type UpdateSermonInput = z.infer<typeof updateSermonInputSchema>;

export const adminSermonIdParamsSchema = z.object({ id: z.uuid() });

export const sermonStateActionSchema = z.enum([
  "submit",
  "withdraw",
  "schedule",
  "publish",
  "unpublish",
  "archive",
  "restore"
]);
export type SermonStateAction = z.infer<typeof sermonStateActionSchema>;

export const sermonTransitionInputSchema = z.object({
  rowVersion: z.number().int().positive(),
  scheduledFor: z.iso.datetime({ offset: true }).optional()
}).strict();
export type SermonTransitionInput = z.infer<typeof sermonTransitionInputSchema>;

export const adminSermonListQuerySchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  status: sermonStatusSchema.optional(),
  speakerId: z.uuid().optional(),
  seriesId: z.uuid().optional(),
  serviceDateFrom: isoDateSchema.optional(),
  serviceDateTo: isoDateSchema.optional(),
  contentIssue: z.enum([
    "complete",
    "missing_speaker",
    "missing_description",
    "description_awaiting_review",
    "missing_transcript",
    "transcript_awaiting_review",
    "insufficient_questions",
    "questions_awaiting_review",
    "missing_media"
  ]).optional(),
  passageBook: z.coerce.number().int().min(1).max(66).optional(),
  passageChapter: z.coerce.number().int().min(1).max(150).optional(),
  passageVerse: z.coerce.number().int().min(1).max(176).optional(),
  passageEndVerse: z.coerce.number().int().min(1).max(176).optional(),
  passageReviewState: adminPrimaryPassageStateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
}).superRefine((value, context) => {
  if (
    !value.serviceDateFrom ||
    !value.serviceDateTo ||
    value.serviceDateFrom <= value.serviceDateTo
  ) {
    // Valid date range.
  } else {
    context.addIssue({ code: "custom", path: ["serviceDateTo"], message: "serviceDateTo must not precede serviceDateFrom" });
  }
  if (value.passageBook === undefined &&
    (value.passageChapter !== undefined || value.passageVerse !== undefined || value.passageEndVerse !== undefined)) {
    context.addIssue({ code: "custom", path: ["passageBook"], message: "Choose a Bible book first" });
  }
  if (value.passageChapter === undefined && (value.passageVerse !== undefined || value.passageEndVerse !== undefined)) {
    context.addIssue({ code: "custom", path: ["passageChapter"], message: "Choose a chapter first" });
  }
  if (value.passageEndVerse !== undefined && value.passageVerse === undefined) {
    context.addIssue({ code: "custom", path: ["passageEndVerse"], message: "Choose a starting verse first" });
  }
  if (value.passageVerse !== undefined && value.passageEndVerse !== undefined && value.passageEndVerse < value.passageVerse) {
    context.addIssue({ code: "custom", path: ["passageEndVerse"], message: "Ending verse must not precede the starting verse" });
  }
  if (value.passageBook !== undefined && value.passageChapter !== undefined) {
    const validity = validateBiblePassage({
      canonicalBookId: value.passageBook,
      startChapter: value.passageChapter,
      startVerse: value.passageVerse ?? null,
      endChapter: value.passageChapter,
      endVerse: value.passageEndVerse ?? value.passageVerse ?? null
    });
    for (const message of validity.issues) {
      context.addIssue({ code: "custom", path: ["passageChapter"], message });
    }
  }
});
export type AdminSermonListQuery = z.infer<typeof adminSermonListQuerySchema>;

const adminRelationshipSchema = z.object({ id: z.uuid(), name: z.string(), slug: z.string() });

export const contentReadinessResponseSchema = z.object({
  isComplete: z.boolean(),
  isContentComplete: z.boolean(),
  hasOneSpeaker: z.boolean(),
  hasRequiredBibleBook: z.boolean(),
  hasRequiredPassageDecision: z.boolean(),
  hasApprovedDescription: z.boolean(),
  hasApprovedTranscript: z.boolean(),
  approvedQuestionCount: z.number().int().nonnegative(),
  totalQuestionCount: z.number().int().nonnegative(),
  hasRequiredQuestionAnswers: z.boolean(),
  allQuestionsApproved: z.boolean(),
  hasValidControlledMedia: z.boolean(),
  issues: z.array(z.object({
    path: z.string(),
    code: z.string(),
    message: z.string()
  }))
});

export const adminSermonSummarySchema = z.object({
  delegatedReview: delegatedContentStatusSchema.optional(),
  remainingReview: remainingReviewStatusSchema.optional(),
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  status: sermonStatusSchema,
  serviceDate: isoDateSchema,
  scheduledFor: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  rowVersion: z.number().int().positive(),
  updatedAt: z.iso.datetime(),
  speaker: adminRelationshipSchema.nullable(),
  series: z.array(adminRelationshipSchema),
  historicalBackfillRequired: z.boolean(),
  enrichmentReview: z.object({
    currentStage: z.number().int().min(1).max(6),
    completedAt: z.iso.datetime().nullable(),
    pendingItemCount: z.number().int().nonnegative(),
    totalItemCount: z.number().int().nonnegative()
  }).nullable(),
  primaryPassage: z.object({
    state: adminPrimaryPassageStateSchema,
    displayText: z.string().nullable()
  }).optional(),
  youtubeSource: z.object({
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    canonicalUrl: z.string().regex(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/)
  }).nullable(),
  readiness: contentReadinessResponseSchema
});

const enrichmentSourceResponseSchema = z.object({
  provider: z.literal("youtube"),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  canonicalUrl: z.url(),
  captionLanguage: z.string(),
  captionTrackType: z.enum(["manual", "automatic", "unknown"]),
  originalFilename: z.string(),
  sourceContentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  retrievalAttribution: z.enum([
    "authorised_youtube_studio_export",
    "authorised_youtube_data_api"
  ]),
  sourceCharacterCount: z.number().int().positive(),
  cleanedCharacterCount: z.number().int().positive(),
  apparentCompleteness: z.enum(["apparently_complete", "requires_manual_review"]),
  uncertaintyMarkerCount: z.number().int().nonnegative(),
  warnings: z.array(z.object({ code: z.string(), safeDetail: z.string() })),
  warningResolutionStatus: z.enum(["unresolved", "resolved_by_completed_review"]),
  unresolvedPassages: z.array(z.object({ marker: z.string(), safeReason: z.string() })),
  processingVersion: z.string(),
  importedAt: z.iso.datetime(),
  processedAt: z.iso.datetime(),
  processingDurationMs: z.number().int().nonnegative(),
  estimatedReviewMinutes: z.number().int().positive(),
  manualAttentionRequired: z.boolean(),
  accuracyReviewStatus: z.literal("required")
});

// Read-only provenance includes retained-transcript proposals already stored by
// bounded delegated workflows. These labels grant no approval and are not
// accepted by the strict administrator write-input schemas.
export const scriptureReferenceProvenanceResponseSchema = z.enum([
  "legacy_import", "administrator", "title_proposal", "administrator_correction", "ai_transcript_proposal"
]);
export const primaryPassageEvidenceResponseSchema = z.enum([
  "local_youtube_title", "administrator", "retained_transcript"
]);

export const adminSermonDetailSchema = adminSermonSummarySchema.extend({
  summary: z.string().nullable(),
  summaryStatus: descriptionStatusSchema,
  summarySourceKind: descriptionSourceKindSchema,
  summarySourceReference: z.string().nullable(),
  summaryCreatedAt: z.iso.datetime().nullable(),
  summaryUpdatedAt: z.iso.datetime().nullable(),
  summaryReviewedAt: z.iso.datetime().nullable(),
  summaryApprovedAt: z.iso.datetime().nullable(),
  summaryRowVersion: z.number().int().positive(),
  seoDescription: z.string().nullable(),
  body: z.string().nullable(),
  speaker: adminRelationshipSchema.nullable(),
  series: z.array(adminRelationshipSchema),
  books: z.array(adminRelationshipSchema),
  scriptureReferences: z.array(
    scriptureReferenceInputSchema.extend({
      id: z.uuid(),
      parseStatus: z.enum(["unparsed", "exact", "partial", "unresolved", "curated"]),
      originalReferenceText: z.string().nullable(),
      provenance: scriptureReferenceProvenanceResponseSchema,
      reviewStatus: z.enum(["unreviewed", "proposed", "confirmed", "rejected"]),
      reviewerSubject: z.string().nullable(),
      reviewedAt: z.iso.datetime().nullable(),
      parserVersion: z.string().nullable(),
      rowVersion: z.number().int().positive()
    })
  ),
  primaryPassageReview: z.object({
    proposalOutcome: z.enum(["proposed", "no_reference", "manual_review_required", "administrator_entered"]),
    evidenceSource: primaryPassageEvidenceResponseSchema,
    parserVersion: z.string(),
    reviewStatus: z.enum(["pending", "confirmed_passage", "confirmed_none", "rejected"]),
    reviewedBySubject: z.string().nullable(),
    reviewedAt: z.iso.datetime().nullable(),
    rowVersion: z.number().int().positive()
  }).nullable(),
  media: z.array(controlledMediaInputSchema.extend({ id: z.uuid() })),
  transcript: transcriptInputSchema.extend({
    rowVersion: z.number().int().positive(),
    groundingRevisionId: z.uuid(),
    legacyGroundingBindings: z.array(z.object({
      transcriptRowVersion: z.number().int().positive(),
      transcriptSha256: z.string().regex(/^[0-9a-f]{64}$/u),
      groundingRevisionId: z.uuid()
    }).strict()),
    reviewedAt: z.iso.datetime().nullable(),
    approvedAt: z.iso.datetime().nullable()
  }).nullable(),
  questionAnswers: z.array(questionAnswerInputSchema.extend({
    id: z.uuid(),
    displayOrder: z.number().int().min(1).max(10),
    rowVersion: z.number().int().positive(),
    reviewedAt: z.iso.datetime().nullable(),
    approvedAt: z.iso.datetime().nullable()
  })),
  generatedTextMechanicalQa: z.object({
    version: z.literal("generated-text-mechanical-qa-v1"),
    completed: z.literal(true),
    outcome: z.enum(["passed", "passed_with_review_flags", "failed"]),
    blockingIssueCount: z.number().int().nonnegative(),
    reviewIssueCount: z.number().int().nonnegative(),
    issues: z.array(z.object({
      code: z.string(),
      severity: z.enum(["blocking", "review"]),
      contentArea: z.enum(["description", "question", "answer"]),
      itemIndex: z.number().int().nonnegative().nullable(),
      characterIndex: z.number().int().nonnegative(),
      autoCorrectable: z.boolean()
    }))
  }).nullable(),
  enrichmentSource: enrichmentSourceResponseSchema.nullable()
});
export type AdminSermonDetail = z.infer<typeof adminSermonDetailSchema>;

export const enrichmentReviewProgressInputSchema = z.object({
  sermonRowVersion: z.number().int().positive(),
  reviewRowVersion: z.number().int().positive(),
  currentStage: z.number().int().min(1).max(6),
  identityStatus: enrichmentReviewIdentityStatusSchema.optional()
}).strict();
export type EnrichmentReviewProgressInput = z.infer<typeof enrichmentReviewProgressInputSchema>;

export const acknowledgeEmptyEnrichmentReviewInputSchema = z.object({
  sermonRowVersion: z.number().int().positive(),
  reviewRowVersion: z.number().int().positive(),
  transcriptRowVersion: z.number().int().positive()
}).strict();
export type AcknowledgeEmptyEnrichmentReviewInput = z.infer<
  typeof acknowledgeEmptyEnrichmentReviewInputSchema
>;

export const enrichmentReviewItemDecisionInputSchema = z.object({
  sermonRowVersion: z.number().int().positive(),
  reviewRowVersion: z.number().int().positive(),
  itemRowVersion: z.number().int().positive(),
  transcriptRowVersion: z.number().int().positive(),
  decision: enrichmentReviewItemDecisionSchema.exclude(["pending"]),
  originalWording: safePlainText(500_000).min(1).optional(),
  correctionText: safePlainText(500_000).min(1).optional()
}).strict().superRefine((value, context) => {
  if (value.decision === "corrected" && !value.correctionText?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["correctionText"],
      message: "Enter the reviewed correction"
    });
  }
  if (value.decision === "corrected" && !value.originalWording) {
    context.addIssue({
      code: "custom",
      path: ["originalWording"],
      message: "The exact original transcript wording is required"
    });
  }
  if (
    value.decision !== "corrected" &&
    (value.originalWording !== undefined || value.correctionText !== undefined)
  ) {
    context.addIssue({
      code: "custom",
      path: ["correctionText"],
      message: "Transcript wording is accepted only for a correction decision"
    });
  }
});
export type EnrichmentReviewItemDecisionInput = z.infer<typeof enrichmentReviewItemDecisionInputSchema>;

export const finishEnrichmentReviewInputSchema = z.object({
  sermonRowVersion: z.number().int().positive(),
  reviewRowVersion: z.number().int().positive()
}).strict();
export type FinishEnrichmentReviewInput = z.infer<typeof finishEnrichmentReviewInputSchema>;

export const enrichmentReviewItemResponseSchema = z.object({
  id: z.uuid(),
  identitySha256: z.string().regex(/^[0-9a-f]{64}$/),
  sourceRecordKey: z.string().regex(/^authorised-record-[1-9][0-9]*$/),
  category: enrichmentReviewItemCategorySchema,
  displayOrder: z.number().int().positive(),
  categoryOrdinal: z.number().int().positive(),
  label: z.string(),
  detail: z.string(),
  supportingParagraphs: z.array(z.number().int().positive()).min(1).max(100),
  sourceMarker: z.string().nullable(),
  decisionStatus: enrichmentReviewItemDecisionSchema,
  correctionText: z.string().nullable(),
  transcriptRowVersion: z.number().int().positive(),
  decidedBySubject: z.string().nullable(),
  decidedAt: z.iso.datetime().nullable(),
  rowVersion: z.number().int().positive(),
  associatedWording: z.string().nullable(),
  associationStatus: z.enum(["exact", "missing", "ambiguous"]),
  context: z.object({
    before: z.string(),
    flagged: z.string(),
    after: z.string()
  }).nullable(),
  supportingContext: z.array(z.object({
    paragraphNumber: z.number().int().positive(),
    text: z.string()
  }))
});

export const enrichmentReviewResponseSchema = z.object({
  sermon: adminSermonDetailSchema,
  recordPosition: z.number().int().positive(),
  recordCount: z.number().int().positive(),
  review: z.object({
    identityStatus: enrichmentReviewIdentityStatusSchema,
    currentStage: z.number().int().min(1).max(6),
    emptyItemSetAcknowledgedBySubject: z.string().nullable(),
    emptyItemSetAcknowledgedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    rowVersion: z.number().int().positive()
  }),
  items: z.array(enrichmentReviewItemResponseSchema),
  progress: z.object({
    resolvedItemCount: z.number().int().nonnegative(),
    unresolvedItemCount: z.number().int().nonnegative(),
    totalItemCount: z.number().int().nonnegative(),
    presentItemCount: z.number().int().nonnegative(),
    itemSetMatches: z.boolean(),
    transcriptMatchesExpected: z.boolean(),
    reviewSetVerified: z.boolean(),
    requiresEmptyItemSetAcknowledgement: z.boolean(),
    stageCompletion: z.object({
      identity: z.boolean(),
      findings: z.boolean(),
      transcript: z.boolean(),
      description: z.boolean(),
      questionAnswers: z.boolean(),
      final: z.boolean()
    }),
    completedStageCount: z.number().int().min(0).max(6),
    percentReviewed: z.number().int().min(0).max(100),
    canFinish: z.boolean(),
  })
});
export type EnrichmentReviewResponse = z.infer<typeof enrichmentReviewResponseSchema>;

export const adminSermonListResponseSchema = z.object({
  data: z.array(adminSermonSummarySchema),
  countsByStatus: z.object({
    draft: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    scheduled: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    unpublished: z.number().int().nonnegative(),
    archived: z.number().int().nonnegative()
  }),
  readinessProgress: z.object({
    total: z.number().int().nonnegative(),
    complete: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
    withOneSpeaker: z.number().int().nonnegative(),
    withRequiredBibleBook: z.number().int().nonnegative(),
    withRequiredPassageDecision: z.number().int().nonnegative(),
    contentComplete: z.number().int().nonnegative(),
    withApprovedDescription: z.number().int().nonnegative(),
    withApprovedTranscript: z.number().int().nonnegative(),
    withRequiredQuestionAnswers: z.number().int().nonnegative(),
    withValidControlledMedia: z.number().int().nonnegative()
  }),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative()
  })
});

export const taxonomyKindSchema = z.enum(["speakers", "series", "books"]);
export type TaxonomyKind = z.infer<typeof taxonomyKindSchema>;

export const taxonomyWriteInputSchema = z.object({
  name: z.string().trim().min(1).max(240),
  slug: slugSchema,
  description: z.string().max(10_000).nullable().default(null),
  canonicalBookId: z.number().int().min(1).max(66).nullable().default(null)
}).strict();
export const taxonomyUpdateInputSchema = taxonomyWriteInputSchema
  .partial()
  .extend({ rowVersion: z.number().int().positive() })
  .refine((value) => Object.keys(value).some((key) => key !== "rowVersion"), {
    message: "At least one editable field is required"
  });

export const taxonomyResponseSchema = z.object({
  id: z.uuid(),
  kind: taxonomyKindSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  canonicalBookId: z.number().int().min(1).max(66).nullable(),
  administratorSermonCount: z.number().int().nonnegative(),
  publicSermonCount: z.number().int().nonnegative(),
  rowVersion: z.number().int().positive(),
  updatedAt: z.iso.datetime()
});

export const auditEventResponseSchema = z.object({
  id: z.uuid(),
  actorSubject: z.string(),
  actorRole: applicationRoleSchema.or(z.literal("system")),
  action: z.string(),
  entityType: z.string(),
  entityId: z.uuid(),
  outcome: z.enum(["succeeded", "denied", "failed"]),
  changedFields: z.array(z.string()),
  requestCorrelationId: z.string(),
  reviewItemIdentitySha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  createdAt: z.iso.datetime()
});

const sermonRedirectTargetPathSchema = z
  .string()
  .max(220)
  .regex(/^\/sermons\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/, "Expected a canonical sermon path");

export const deletionSeoDispositionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("redirect"), targetPath: sermonRedirectTargetPathSchema }).strict(),
  z.object({ kind: z.literal("gone") }).strict()
]);
export type DeletionSeoDisposition = z.infer<typeof deletionSeoDispositionSchema>;

export const permanentlyDeleteSermonInputSchema = z.object({
  rowVersion: z.number().int().positive(),
  confirmation: z.string().trim().min(1).max(240),
  reason: z.string().trim().min(3).max(500),
  seoDisposition: deletionSeoDispositionSchema.nullable().default(null)
}).strict();
export type PermanentlyDeleteSermonInput = z.infer<typeof permanentlyDeleteSermonInputSchema>;

export const permanentDeletionResultSchema = z.object({
  deleted: z.literal(true),
  sermonId: z.uuid(),
  formerSlug: slugSchema,
  seoDisposition: deletionSeoDispositionSchema.nullable()
});

export const deletionTombstoneResponseSchema = z.object({
  id: z.uuid(),
  formerSermonId: z.uuid(),
  formerSlug: slugSchema,
  actorSubject: z.string(),
  actorRole: z.literal("admin"),
  action: z.literal("sermon.permanent_delete"),
  reason: z.string(),
  wasPreviouslyPublished: z.boolean(),
  seoDisposition: z.enum(["redirect", "gone"]).nullable(),
  redirectTargetPath: sermonRedirectTargetPathSchema.nullable(),
  requestCorrelationId: z.string(),
  createdAt: z.iso.datetime()
});

export const adminAuditHistoryResponseSchema = z.object({
  events: z.array(auditEventResponseSchema),
  deletionTombstones: z.array(deletionTombstoneResponseSchema)
});

export const adminSermonApiContracts = {
  list: { method: "GET", path: "/api/v1/admin/sermons" },
  detail: { method: "GET", path: "/api/v1/admin/sermons/:id" },
  create: { method: "POST", path: "/api/v1/admin/sermons" },
  update: { method: "PATCH", path: "/api/v1/admin/sermons/:id" },
  transitions: sermonStateActionSchema.options.map((action) => ({
    method: "POST" as const,
    path: `/api/v1/admin/sermons/:id/${action}`
  })),
  permanentDelete: {
    method: "POST",
    path: "/api/v1/admin/sermons/:id/permanent-delete"
  },
  primaryPassageDecision: {
    method: "POST",
    path: "/api/v1/admin/sermons/:id/primary-passage-decision"
  },
  enrichmentReview: {
    detail: { method: "GET", path: "/api/v1/admin/sermons/:id/review" },
    progress: { method: "PATCH", path: "/api/v1/admin/sermons/:id/review/progress" },
    acknowledgeEmptyItemSet: {
      method: "POST",
      path: "/api/v1/admin/sermons/:id/review/empty-item-set/acknowledge"
    },
    itemDecision: { method: "POST", path: "/api/v1/admin/sermons/:id/review/items/:itemId/decision" },
    finish: { method: "POST", path: "/api/v1/admin/sermons/:id/review/finish" }
  },
  audit: { method: "GET", path: "/api/v1/admin/sermons/:id/audit", roles: ["admin"] },
  auditHistory: { method: "GET", path: "/api/v1/admin/audit", roles: ["admin"] },
  taxonomy: { path: "/api/v1/admin/taxonomies/:kind", writeRoles: ["admin"] }
} as const;

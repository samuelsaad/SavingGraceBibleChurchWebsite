import { z } from "zod";
import { isoDateSchema, sermonStatusSchema } from "../../domain/sermon";
import { containsHtmlTag } from "../../domain/content-readiness";

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
    endVerse: z.number().int().positive().nullable().default(null)
  })
  .strict()
  .refine((value) => value.endChapter === null || value.startChapter !== null, {
    path: ["endChapter"],
    message: "endChapter requires startChapter"
  })
  .refine((value) => value.endVerse === null || value.startVerse !== null, {
    path: ["endVerse"],
    message: "endVerse requires startVerse"
  });

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
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
}).refine(
  (value) =>
    !value.serviceDateFrom ||
    !value.serviceDateTo ||
    value.serviceDateFrom <= value.serviceDateTo,
  { path: ["serviceDateTo"], message: "serviceDateTo must not precede serviceDateFrom" }
);
export type AdminSermonListQuery = z.infer<typeof adminSermonListQuerySchema>;

const adminRelationshipSchema = z.object({ id: z.uuid(), name: z.string(), slug: z.string() });

export const contentReadinessResponseSchema = z.object({
  isComplete: z.boolean(),
  hasOneSpeaker: z.boolean(),
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
  retrievalAttribution: z.literal("authorised_youtube_studio_export"),
  sourceCharacterCount: z.number().int().positive(),
  cleanedCharacterCount: z.number().int().positive(),
  apparentCompleteness: z.enum(["apparently_complete", "requires_manual_review"]),
  uncertaintyMarkerCount: z.number().int().nonnegative(),
  warnings: z.array(z.object({ code: z.string(), safeDetail: z.string() })),
  unresolvedPassages: z.array(z.object({ marker: z.string(), safeReason: z.string() })),
  processingVersion: z.string(),
  importedAt: z.iso.datetime(),
  processedAt: z.iso.datetime(),
  processingDurationMs: z.number().int().nonnegative(),
  estimatedReviewMinutes: z.number().int().positive(),
  manualAttentionRequired: z.boolean(),
  accuracyReviewStatus: z.literal("required")
});

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
      parseStatus: z.enum(["unparsed", "exact", "partial", "unresolved", "curated"])
    })
  ),
  media: z.array(controlledMediaInputSchema.extend({ id: z.uuid() })),
  transcript: transcriptInputSchema.extend({
    rowVersion: z.number().int().positive(),
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

export const enrichmentReviewItemDecisionInputSchema = z.object({
  sermonRowVersion: z.number().int().positive(),
  reviewRowVersion: z.number().int().positive(),
  itemRowVersion: z.number().int().positive(),
  transcriptRowVersion: z.number().int().positive(),
  decision: enrichmentReviewItemDecisionSchema.exclude(["pending"]),
  correctionText: safePlainText(1_000).trim().min(1).optional()
}).strict().superRefine((value, context) => {
  if (value.decision === "corrected" && !value.correctionText) {
    context.addIssue({
      code: "custom",
      path: ["correctionText"],
      message: "Enter the reviewed correction"
    });
  }
  if (value.decision !== "corrected" && value.correctionText !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["correctionText"],
      message: "Correction text is accepted only for a correction decision"
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
  decidedAt: z.iso.datetime().nullable(),
  rowVersion: z.number().int().positive(),
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
    completedStageCount: z.number().int().min(0).max(6),
    percentReviewed: z.number().int().min(0).max(100),
    canFinish: z.boolean()
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
  enrichmentReview: {
    detail: { method: "GET", path: "/api/v1/admin/sermons/:id/review" },
    progress: { method: "PATCH", path: "/api/v1/admin/sermons/:id/review/progress" },
    itemDecision: { method: "POST", path: "/api/v1/admin/sermons/:id/review/items/:itemId/decision" },
    finish: { method: "POST", path: "/api/v1/admin/sermons/:id/review/finish" }
  },
  audit: { method: "GET", path: "/api/v1/admin/sermons/:id/audit", roles: ["admin"] },
  auditHistory: { method: "GET", path: "/api/v1/admin/audit", roles: ["admin"] },
  taxonomy: { path: "/api/v1/admin/taxonomies/:kind", writeRoles: ["admin"] }
} as const;

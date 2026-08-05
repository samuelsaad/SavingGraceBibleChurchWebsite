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
export const questionAnswerStatusSchema = z.enum(["draft", "in_review", "approved"]);

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

const editableSermonFieldsSchema = z.object({
  title: z.string().trim().min(1).max(240),
  slug: slugSchema,
  serviceDate: isoDateSchema,
  summary: z.string().max(2_000).nullable(),
  body: z.string().max(200_000).nullable(),
  speakerId: z.uuid().nullable(),
  seriesIds: uniqueUuidArray,
  bookClassificationIds: uniqueUuidArray,
  scriptureReferences: z.array(scriptureReferenceInputSchema).max(50),
  media: z.array(controlledMediaInputSchema).max(20),
  transcript: transcriptInputSchema,
  questionAnswers: z.array(questionAnswerInputSchema).max(10)
}).strict();

export const createSermonInputSchema = editableSermonFieldsSchema.extend({
  summary: editableSermonFieldsSchema.shape.summary.default(null),
  body: editableSermonFieldsSchema.shape.body.default(null),
  speakerId: z.uuid().nullable().default(null),
  seriesIds: uniqueUuidArray.default([]),
  bookClassificationIds: uniqueUuidArray.default([]),
  scriptureReferences: editableSermonFieldsSchema.shape.scriptureReferences.default([]),
  media: editableSermonFieldsSchema.shape.media.default([]),
  transcript: transcriptInputSchema.default({
    bodyText: "",
    status: "missing",
    sourceKind: "manual",
    sourceReference: null
  }),
  questionAnswers: z.array(questionAnswerInputSchema).max(10).default([])
});
export type CreateSermonInput = z.infer<typeof createSermonInputSchema>;

export const updateSermonInputSchema = editableSermonFieldsSchema
  .partial()
  .extend({ rowVersion: z.number().int().positive() })
  .refine((value) => Object.keys(value).some((key) => key !== "rowVersion"), {
    message: "At least one editable field is required"
  });
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

export const adminSermonDetailSchema = adminSermonSummarySchema.extend({
  summary: z.string().nullable(),
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
  }))
});
export type AdminSermonDetail = z.infer<typeof adminSermonDetailSchema>;

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
  audit: { method: "GET", path: "/api/v1/admin/sermons/:id/audit", roles: ["admin"] },
  auditHistory: { method: "GET", path: "/api/v1/admin/audit", roles: ["admin"] },
  taxonomy: { path: "/api/v1/admin/taxonomies/:kind", writeRoles: ["admin"] }
} as const;

import { z } from "zod";

export const sermonStatusSchema = z.enum([
  "draft",
  "pending",
  "scheduled",
  "published",
  "unpublished",
  "archived"
]);

export type SermonStatus = z.infer<typeof sermonStatusSchema>;

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO calendar date")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day!, 12));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
  }, "Expected a real calendar date");

export const publicMediaSchema = z.object({
  provider: z.enum(["youtube", "sermonaudio"]),
  mediaType: z.enum(["video", "audio"]),
  externalId: z.string().min(1).nullable(),
  canonicalUrl: z.url().max(2_000),
  title: z.string().min(1)
}).strict().superRefine((value, context) => {
  const url = new URL(value.canonicalUrl);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (url.protocol !== "https:") {
    context.addIssue({ code: "custom", path: ["canonicalUrl"], message: "Public media must use HTTPS" });
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
  if (value.provider === "sermonaudio" && value.mediaType !== "audio") {
    context.addIssue({ code: "custom", path: ["mediaType"], message: "SermonAudio media must be audio" });
  }
});

export type PublicMedia = z.infer<typeof publicMediaSchema>;

export const scriptureReferenceDtoSchema = z.object({
  displayText: z.string().min(1),
  parseStatus: z.enum(["unparsed", "exact", "partial", "unresolved", "curated"])
});

export const sermonSummarySchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  serviceDate: isoDateSchema,
  language: z.enum(['en','ar']).optional(),
  summary: z.string().min(80).max(2_000).nullable(),
  speaker: z.object({ name: z.string(), slug: z.string() }).nullable(),
  series: z.array(z.object({ name: z.string(), slug: z.string() })),
  scriptureReferences: z.array(scriptureReferenceDtoSchema),
  primaryPassages: z.array(z.object({
    displayText: z.string().min(1),
    isLead: z.boolean()
  })).default([]),
  primaryPassageState: z.enum(["assigned", "none", "unresolved"]).default("unresolved"),
  /** Only an explicit trusted classification; never inferred from absent books,
   * a no-primary outcome, or a series name. The current DB has no such lifecycle. */
  isTopical: z.boolean().optional(),
  books: z.array(z.object({ name: z.string(), slug: z.string() })),
  primaryMedia: publicMediaSchema.nullable(),
  reviewState: z.enum(["draft_awaiting_review"]).optional()
});

export type SermonSummary = z.infer<typeof sermonSummarySchema>;

export const relatedSermonReasonSchema = z.enum([
  "same_series",
  "overlapping_scripture",
  "same_bible_book",
  "same_speaker"
]);

export const relatedSermonSummarySchema = sermonSummarySchema.extend({
  relationshipReasons: z.array(relatedSermonReasonSchema).min(1).max(4)
});

export type RelatedSermonSummary = z.infer<typeof relatedSermonSummarySchema>;

export const sermonDetailSchema = sermonSummarySchema.extend({
  seoDescription: z.string().min(1).max(320).nullable(),
  body: z.string().nullable(),
  media: z.array(publicMediaSchema),
  transcript: z.object({ bodyText: z.string().min(1) }).nullable(),
  questionAnswers: z.array(z.object({
    question: z.string().min(1),
    answer: z.string().min(1),
    displayOrder: z.number().int().min(1).max(10)
  })),
  reviewWarnings: z.array(z.object({
    code: z.string().min(1).max(160),
    detail: z.string().min(1).max(1_000)
  })).optional(),
  reviewProvenance: z.object({
    sourceSha256: z.string().regex(/^[0-9a-f]{64}$/),
    processingVersion: z.string().min(1).max(100),
    transcriptStatus: z.literal("draft"),
    descriptionStatus: z.literal("draft"),
    questionAnswerStatus: z.literal("draft")
  }).optional(),
  relatedSermons: z.array(relatedSermonSummarySchema).max(6).default([])
});

export type SermonDetail = z.infer<typeof sermonDetailSchema>;

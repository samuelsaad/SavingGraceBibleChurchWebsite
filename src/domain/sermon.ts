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
  canonicalUrl: z.url(),
  title: z.string().min(1)
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
  summary: z.string().nullable(),
  speakers: z.array(z.object({ name: z.string(), slug: z.string() })),
  series: z.array(z.object({ name: z.string(), slug: z.string() })),
  scriptureReferences: z.array(scriptureReferenceDtoSchema),
  books: z.array(z.object({ name: z.string(), slug: z.string() })),
  primaryMedia: publicMediaSchema.nullable()
});

export type SermonSummary = z.infer<typeof sermonSummarySchema>;

export const sermonDetailSchema = sermonSummarySchema.extend({
  body: z.string().nullable(),
  media: z.array(publicMediaSchema)
});

export type SermonDetail = z.infer<typeof sermonDetailSchema>;

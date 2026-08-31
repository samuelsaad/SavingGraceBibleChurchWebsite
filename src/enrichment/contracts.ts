import { z } from "zod";
import { containsHtmlTag } from "../domain/content-readiness";

const safePlainText = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine((value) => !containsHtmlTag(value), "Use plain text; HTML tags are not accepted");

export const enrichmentNeedSchema = z.enum([
  "missing_speaker",
  "passage_review_pending",
  "missing_description",
  "description_awaiting_review",
  "missing_transcript",
  "transcript_awaiting_review",
  "insufficient_questions",
  "questions_awaiting_review",
  "missing_media"
]);

export const enrichmentQueueRecordSchema = z.object({
  sourceWordPressId: z.number().int().positive(),
  targetSermonId: z.uuid(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  rowVersion: z.number().int().positive(),
  needs: z.array(enrichmentNeedSchema).min(1)
}).strict();

export const enrichmentQueueManifestSchema = z.object({
  schemaVersion: z.literal(2),
  sourceSnapshotId: z.string().trim().min(1).max(200),
  records: z.array(enrichmentQueueRecordSchema)
}).strict();

export type EnrichmentQueueManifest = z.infer<typeof enrichmentQueueManifestSchema>;

const transcriptProvenanceSchema = z.object({
  sourceKind: z.enum(["manual", "caption", "transcription", "imported", "generated_draft"]),
  sourceReference: safePlainText(500).trim().min(1).nullable().default(null)
}).strict();

const questionAnswerProvenanceSchema = z.object({
  sourceKind: z.enum(["manual", "imported", "generated_draft"]),
  sourceReference: safePlainText(500).trim().min(1).nullable().default(null)
}).strict();

const descriptionProvenanceSchema = z.object({
  sourceKind: z.enum(["manual", "imported", "generated_draft"]),
  sourceReference: safePlainText(500).trim().min(1).nullable().default(null)
}).strict();

export const safeEnrichmentWarningSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/).max(100),
  safeDetail: safePlainText(500).trim().min(1)
}).strict();

export const phase3b2SourceProvenanceSchema = z.object({
  provider: z.literal("youtube"),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  canonicalUrl: z.url().refine(
    (value) => value === `https://www.youtube.com/watch?v=${new URL(value).searchParams.get("v") ?? ""}`,
    "Use a canonical YouTube watch URL without playlist or tracking parameters"
  ),
  captionLanguage: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
  captionTrackType: z.enum(["manual", "automatic", "unknown"]),
  originalFilename: safePlainText(255).trim().min(1).refine(
    (value) => !/[\\/]/.test(value),
    "Store a source filename, not a filesystem path"
  ),
  sourceContentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  retrievalAttribution: z.enum([
    "authorised_youtube_studio_export",
    "authorised_youtube_data_api"
  ]),
  sourceCharacterCount: z.number().int().positive(),
  cleanedCharacterCount: z.number().int().positive(),
  apparentCompleteness: z.enum(["apparently_complete", "requires_manual_review"]),
  uncertaintyMarkerCount: z.number().int().nonnegative(),
  warnings: z.array(safeEnrichmentWarningSchema).max(100),
  unresolvedPassages: z.array(z.object({
    marker: z.string().regex(/^uncertain-[1-9][0-9]*$/),
    safeReason: safePlainText(300).trim().min(1)
  }).strict()).max(500),
  processingVersion: z.string().regex(/^[A-Za-z0-9._-]+$/).max(100),
  importedAt: z.iso.datetime(),
  processedAt: z.iso.datetime(),
  processingDurationMs: z.number().int().nonnegative(),
  estimatedReviewMinutes: z.number().int().positive(),
  manualAttentionRequired: z.literal(true),
  accuracyReviewStatus: z.literal("required")
}).strict().superRefine((value, context) => {
  if (value.canonicalUrl !== `https://www.youtube.com/watch?v=${value.videoId}`) {
    context.addIssue({
      code: "custom",
      path: ["canonicalUrl"],
      message: "Canonical URL and video ID must identify the same YouTube video"
    });
  }
  if (value.uncertaintyMarkerCount !== value.unresolvedPassages.length) {
    context.addIssue({
      code: "custom",
      path: ["uncertaintyMarkerCount"],
      message: "Every uncertainty marker requires one safe unresolved-passage record"
    });
  }
});

const enrichmentDraftBundleFields = {
  sourceWordPressId: z.number().int().positive(),
  targetSermonId: z.uuid(),
  expectedRowVersion: z.number().int().positive(),
  description: z.object({
    bodyText: safePlainText(2_000).trim().min(1),
    provenance: descriptionProvenanceSchema
  }).strict(),
  transcript: z.object({
    bodyText: safePlainText(500_000).trim().min(1),
    provenance: transcriptProvenanceSchema
  }).strict(),
  questionAnswers: z.array(z.object({
    question: safePlainText(1_000).trim().min(1),
    answer: safePlainText(10_000).trim().min(1),
      provenance: questionAnswerProvenanceSchema
  }).strict()).min(5).max(10)
};

const enrichmentDraftBundleV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...enrichmentDraftBundleFields
}).strict();

export const phase3b2EnrichmentDraftBundleSchema = z.object({
  schemaVersion: z.literal(3),
  ...enrichmentDraftBundleFields,
  sourceProvenance: phase3b2SourceProvenanceSchema
}).strict();

export const enrichmentDraftBundleSchema = z.discriminatedUnion("schemaVersion", [
  enrichmentDraftBundleV2Schema,
  phase3b2EnrichmentDraftBundleSchema
]);

export type EnrichmentDraftBundle = z.infer<typeof enrichmentDraftBundleSchema>;

export function deterministicEnrichmentQueue(
  sourceSnapshotId: string,
  records: z.infer<typeof enrichmentQueueRecordSchema>[]
): EnrichmentQueueManifest {
  return enrichmentQueueManifestSchema.parse({
    schemaVersion: 2,
    sourceSnapshotId,
    records: [...records]
      .map((record) => ({ ...record, needs: [...record.needs].sort() }))
      .sort((left, right) => left.sourceWordPressId - right.sourceWordPressId)
  });
}

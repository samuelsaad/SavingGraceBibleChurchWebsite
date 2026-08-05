import { z } from "zod";
import { containsHtmlTag } from "../domain/content-readiness";

const safePlainText = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine((value) => !containsHtmlTag(value), "Use plain text; HTML tags are not accepted");

export const enrichmentNeedSchema = z.enum([
  "missing_speaker",
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

export const enrichmentDraftBundleSchema = z.object({
  schemaVersion: z.literal(2),
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
}).strict();

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

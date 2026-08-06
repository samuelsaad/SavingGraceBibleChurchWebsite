import { z } from "zod";
import { containsHtmlTag } from "../domain/content-readiness";
import {
  phase3b2PunctuationProcessingVersion,
  punctuationChunkTokenLimit
} from "./pilot-punctuation";

const safeText = (maximum: number) => z.string().max(maximum).refine(
  (value) => !containsHtmlTag(value),
  "Use plain text; HTML tags are not accepted"
);
const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const paragraphReferences = z.array(z.number().int().positive()).min(1).max(100);

const chunkBoundaryFields = {
  chunkId: z.string().regex(/^chunk-[0-9]{4}$/),
  index: z.number().int().nonnegative(),
  tokenStart: z.number().int().nonnegative(),
  tokenEndExclusive: z.number().int().positive(),
  sourceStart: z.number().int().nonnegative(),
  sourceEnd: z.number().int().positive(),
  sourceSha256: sha256
};

export const punctuationWorkspaceTemplateSchema = z.object({
  schemaVersion: z.literal(2),
  processingVersion: z.literal(phase3b2PunctuationProcessingVersion),
  videoId,
  sourceContentSha256: sha256,
  sourceTokenSequenceSha256: sha256,
  unicodeNormalization: z.literal("NFC"),
  lexicalTokenPolicy: z.literal("whitespace-delimited-non-punctuation-case-folded"),
  chunkTokenLimit: z.literal(punctuationChunkTokenLimit),
  chunks: z.array(z.object({
    ...chunkBoundaryFields,
    sourceFilename: z.string().regex(/^chunk-[0-9]{4}\.source\.txt$/),
    cleanedFilename: z.string().regex(/^chunk-[0-9]{4}\.cleaned\.txt$/)
  }).strict()).min(1).max(500)
}).strict();

export const punctuationPackSchema = z.object({
  schemaVersion: z.literal(2),
  processingVersion: z.literal(phase3b2PunctuationProcessingVersion),
  videoId,
  sourceContentSha256: sha256,
  sourceTokenSequenceSha256: sha256,
  unicodeNormalization: z.literal("NFC"),
  lexicalTokenPolicy: z.literal("whitespace-delimited-non-punctuation-case-folded"),
  chunkTokenLimit: z.literal(punctuationChunkTokenLimit),
  chunks: z.array(z.object({
    ...chunkBoundaryFields,
    cleanedOutputSha256: sha256,
    cleanedText: safeText(20_000).trim().min(1)
  }).strict()).min(1).max(500)
}).strict();

const supportedReviewItem = z.object({
  detail: safeText(1_000).trim().min(1),
  supportingParagraphs: paragraphReferences
}).strict();

export const phase3b2PunctuationCompletionManifestSchema = z.object({
  schemaVersion: z.literal(2),
  sourceSnapshotId: z.string().regex(/^[A-Za-z0-9._-]+$/).max(100),
  records: z.array(z.object({
    videoId,
    punctuationPackFilename: z.string().regex(/^[A-Za-z0-9._-]+\.private\.json$/).max(255),
    descriptionDraft: safeText(2_000).trim().min(80),
    descriptionSupportingParagraphs: paragraphReferences,
    questionAnswers: z.array(z.object({
      question: safeText(1_000).trim().min(1),
      answer: safeText(10_000).trim().min(1),
      supportingParagraphs: paragraphReferences
    }).strict()).length(7),
    possibleCaptionErrors: z.array(supportedReviewItem).max(100),
    apparentNamesAndScriptureReferences: z.array(supportedReviewItem).max(100)
  }).strict()).length(2)
}).strict().superRefine((value, context) => {
  const records = new Set(value.records.map((record) => record.videoId));
  if (records.size !== 2) {
    context.addIssue({
      code: "custom",
      path: ["records"],
      message: "Punctuation completion requires exactly two unique records"
    });
  }
});

export type PunctuationWorkspaceTemplateInput = z.infer<typeof punctuationWorkspaceTemplateSchema>;
export type PunctuationPackInput = z.infer<typeof punctuationPackSchema>;
export type Phase3b2PunctuationCompletionManifest = z.infer<typeof phase3b2PunctuationCompletionManifestSchema>;

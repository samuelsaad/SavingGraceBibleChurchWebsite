import { z } from "zod";
import { containsHtmlTag } from "../domain/content-readiness";

const safeText = (maximum: number) => z.string().max(maximum).refine(
  (value) => !containsHtmlTag(value),
  "Use plain text; HTML tags are not accepted"
);
const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);

export const phase3b2PilotManifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceSnapshotId: z.string().regex(/^[A-Za-z0-9._-]+$/).max(100),
  allowlistedVideoIds: z.array(videoId).length(3),
  records: z.array(z.object({
    videoId,
    videoUrl: z.url(),
    captionFilename: safeText(255).trim().min(1).refine((value) => !/[\\/]/.test(value)),
    captionLanguage: z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
    captionTrackType: z.enum(["manual", "automatic", "unknown"]),
    sourceWordPressId: z.number().int().positive(),
    title: safeText(240).trim().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    descriptionDraft: safeText(2_000).trim().min(80).nullable(),
    questionAnswers: z.array(z.object({
      question: safeText(1_000).trim().min(1),
      answer: safeText(10_000).trim().min(1)
    }).strict()).max(10)
  }).strict()).length(3)
}).strict().superRefine((value, context) => {
  const allowlist = new Set(value.allowlistedVideoIds);
  const recordIds = new Set(value.records.map((record) => record.videoId));
  if (allowlist.size !== 3 || recordIds.size !== 3) {
    context.addIssue({ code: "custom", path: ["records"], message: "The pilot requires three unique mapped video IDs" });
  }
  if ([...allowlist].some((id) => !recordIds.has(id)) || [...recordIds].some((id) => !allowlist.has(id))) {
    context.addIssue({ code: "custom", path: ["records"], message: "Records must exactly match the private three-video allowlist" });
  }
  const sourceIds = new Set(value.records.map((record) => record.sourceWordPressId));
  if (sourceIds.size !== 3) {
    context.addIssue({ code: "custom", path: ["records"], message: "Local pilot source identifiers must be unique" });
  }
});

export type Phase3b2PilotManifest = z.infer<typeof phase3b2PilotManifestSchema>;

export interface Phase3b2SafeOutcome {
  videoId: string;
  captionSupplied: boolean;
  captionLanguage: string;
  captionTrackType: "manual" | "automatic" | "unknown";
  sourceCharacterCount: number;
  cleanedCharacterCount: number | null;
  apparentCompleteness: "apparently_complete" | "requires_manual_review" | "unusable";
  uncertaintyMarkerCount: number;
  warningCodes: string[];
  descriptionDraftProduced: boolean;
  questionAnswerCount: number;
  importedOutcome: "imported_as_draft" | "unchanged" | "not_imported";
  manualAttentionRequired: true;
  processingDurationMs: number;
  estimatedAdministratorReviewMinutes: number;
  failure: { code: string; safeDetail: string } | null;
}

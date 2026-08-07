import { createHash } from "node:crypto";
import { z } from "zod";
import { containsHtmlTag } from "../domain/content-readiness";
import { deterministicSourceUuid } from "../migration/identity";
import { phase3b2EnrichmentDraftBundleSchema } from "./contracts";
import { lexicalTokenSequenceSha256 } from "./pilot-punctuation";

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const safeText = (maximum: number) => z.string().max(maximum).refine(
  (value) => !containsHtmlTag(value),
  "Use plain text; HTML tags are not accepted"
);
const paragraphReferences = z.array(z.number().int().positive()).min(1).max(100);

export const atomicReviewCategorySchema = z.enum([
  "caption_error",
  "name_or_scripture_reference"
]);
export type AtomicReviewCategory = z.infer<typeof atomicReviewCategorySchema>;

export const atomicReviewRecordKeySchema = z.enum([
  "authorised-record-2",
  "authorised-record-3"
]);
export type AtomicReviewRecordKey = z.infer<typeof atomicReviewRecordKeySchema>;

export interface AtomicReviewIdentityInput {
  sourceRecordKey: AtomicReviewRecordKey;
  category: AtomicReviewCategory;
  categoryOrdinal: number;
  detail: string;
  supportingParagraphs: readonly number[];
  transcriptSermonId: string;
  sourceTranscriptSha256: string;
}

function canonicalAtomicIdentity(input: AtomicReviewIdentityInput): string {
  return JSON.stringify({
    schemaVersion: 1,
    sourceRecordKey: input.sourceRecordKey,
    category: input.category,
    categoryOrdinal: input.categoryOrdinal,
    detail: input.detail,
    supportingParagraphs: [...input.supportingParagraphs],
    transcriptSermonId: input.transcriptSermonId,
    sourceTranscriptSha256: input.sourceTranscriptSha256
  });
}

export function atomicReviewIdentitySha256(input: AtomicReviewIdentityInput): string {
  return createHash("sha256").update(canonicalAtomicIdentity(input), "utf8").digest("hex");
}

export function atomicReviewItemUuid(identitySha256: string): string {
  return deterministicSourceUuid("phase3b2b-atomic-review-item", identitySha256);
}

export function atomicReviewItemSetSha256(
  items: readonly { identitySha256: string }[]
): string {
  return createHash("sha256")
    .update(items.map((item) => item.identitySha256).join("\n"), "utf8")
    .digest("hex");
}

export const atomicReviewItemSchema = z.object({
  id: z.uuid(),
  itemKey: z.string().regex(/^atomic-[0-9a-f]{64}$/),
  identitySha256: sha256,
  sourceRecordKey: atomicReviewRecordKeySchema,
  category: atomicReviewCategorySchema,
  displayOrder: z.number().int().positive().max(200),
  categoryOrdinal: z.number().int().positive().max(100),
  detail: safeText(1_000).trim().min(1),
  supportingParagraphs: paragraphReferences,
  transcriptSermonId: z.uuid(),
  sourceTranscriptSha256: sha256,
  expectedTranscriptRowVersion: z.number().int().positive(),
  sourceMarker: safeText(1_000).trim().min(1).nullable()
}).strict().superRefine((item, context) => {
  const expectedIdentity = atomicReviewIdentitySha256(item);
  if (item.identitySha256 !== expectedIdentity) {
    context.addIssue({
      code: "custom",
      path: ["identitySha256"],
      message: "The atomic review-item identity does not match its trusted fields"
    });
  }
  if (item.itemKey !== `atomic-${expectedIdentity}`) {
    context.addIssue({
      code: "custom",
      path: ["itemKey"],
      message: "The atomic review-item key is not deterministic"
    });
  }
  if (item.id !== atomicReviewItemUuid(expectedIdentity)) {
    context.addIssue({
      code: "custom",
      path: ["id"],
      message: "The atomic review-item UUID is not deterministic"
    });
  }
});

export type AtomicReviewItem = z.infer<typeof atomicReviewItemSchema>;

const transcriptEvidenceSchema = z.object({
  contentSha256: sha256,
  sourceTokenSequenceSha256: sha256,
  cleanedTokenSequenceSha256: sha256,
  sourceTokenCount: z.number().int().positive(),
  cleanedTokenCount: z.number().int().positive(),
  expectedRowVersion: z.number().int().positive(),
  zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens: z.literal(true),
  whitespaceBoundariesPreserved: z.literal(true),
  sourceSegmentsCompleteAndUnique: z.literal(true),
  chunkReassemblyComplete: z.literal(true)
}).strict();

const restorationTargetSchema = z.object({
  title: safeText(240).trim().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mediaTitle: safeText(500).trim().min(1)
}).strict();

export const phase3b2AtomicReviewRecordSchema = z.object({
  recordKey: atomicReviewRecordKeySchema,
  restorationTarget: restorationTargetSchema,
  draftBundle: phase3b2EnrichmentDraftBundleSchema,
  transcriptEvidence: transcriptEvidenceSchema,
  reviewItemSetSha256: sha256,
  reviewItems: z.array(atomicReviewItemSchema).min(1).max(200)
}).strict().superRefine((record, context) => {
  const transcriptSha256 = createHash("sha256")
    .update(record.draftBundle.transcript.bodyText, "utf8")
    .digest("hex");
  if (transcriptSha256 !== record.transcriptEvidence.contentSha256) {
    context.addIssue({
      code: "custom",
      path: ["transcriptEvidence", "contentSha256"],
      message: "The transcript content hash does not match the draft bundle"
    });
  }
  if (
    lexicalTokenSequenceSha256(record.draftBundle.transcript.bodyText) !==
      record.transcriptEvidence.cleanedTokenSequenceSha256 ||
    record.transcriptEvidence.sourceTokenSequenceSha256 !==
      record.transcriptEvidence.cleanedTokenSequenceSha256 ||
    record.transcriptEvidence.sourceTokenCount !== record.transcriptEvidence.cleanedTokenCount
  ) {
    context.addIssue({
      code: "custom",
      path: ["transcriptEvidence"],
      message: "The trusted transcript lexical-token evidence does not match"
    });
  }
  const expectedSet = atomicReviewItemSetSha256(record.reviewItems);
  if (record.reviewItemSetSha256 !== expectedSet) {
    context.addIssue({
      code: "custom",
      path: ["reviewItemSetSha256"],
      message: "The atomic review-item set hash does not match its ordered identities"
    });
  }
  const identities = new Set(record.reviewItems.map((item) => item.identitySha256));
  const ids = new Set(record.reviewItems.map((item) => item.id));
  const keys = new Set(record.reviewItems.map((item) => item.itemKey));
  if (
    identities.size !== record.reviewItems.length ||
    ids.size !== record.reviewItems.length ||
    keys.size !== record.reviewItems.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["reviewItems"],
      message: "Atomic review-item identities collide or are duplicated"
    });
  }
  const transcriptParagraphCount = record.draftBundle.transcript.bodyText
    .split(/\n\s*\n/u)
    .length;
  for (const [index, item] of record.reviewItems.entries()) {
    if (
      item.displayOrder !== index + 1 ||
      item.sourceRecordKey !== record.recordKey ||
      item.transcriptSermonId !== record.draftBundle.targetSermonId ||
      item.sourceTranscriptSha256 !== record.transcriptEvidence.contentSha256 ||
      item.expectedTranscriptRowVersion !== record.transcriptEvidence.expectedRowVersion
    ) {
      context.addIssue({
        code: "custom",
        path: ["reviewItems", index],
        message: "An atomic review item is reordered or detached from its source transcript"
      });
    }
    if (item.supportingParagraphs.some((paragraph) => paragraph > transcriptParagraphCount)) {
      context.addIssue({
        code: "custom",
        path: ["reviewItems", index, "supportingParagraphs"],
        message: "An atomic review item refers outside its associated transcript"
      });
    }
  }
  for (const category of atomicReviewCategorySchema.options) {
    const categoryItems = record.reviewItems.filter((item) => item.category === category);
    if (categoryItems.some((item, index) => item.categoryOrdinal !== index + 1)) {
      context.addIssue({
        code: "custom",
        path: ["reviewItems"],
        message: "Atomic category ordinals must remain complete and ordered"
      });
    }
  }
});

export const phase3b2AtomicReviewManifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceSnapshotId: z.string().regex(/^[A-Za-z0-9._-]+$/).max(100),
  records: z.array(phase3b2AtomicReviewRecordSchema).length(2)
}).strict().superRefine((manifest, context) => {
  const expected = [
    { key: "authorised-record-2", count: 42 },
    { key: "authorised-record-3", count: 44 }
  ] as const;
  for (const [index, requirement] of expected.entries()) {
    const record = manifest.records[index];
    if (record?.recordKey !== requirement.key || record.reviewItems.length !== requirement.count) {
      context.addIssue({
        code: "custom",
        path: ["records", index],
        message: `The exact private atomic scope requires ${requirement.count} items for ${requirement.key}`
      });
    }
  }
  const targetIds = new Set(manifest.records.map((record) => record.draftBundle.targetSermonId));
  const sourceIds = new Set(manifest.records.map((record) => record.draftBundle.sourceWordPressId));
  const videoIds = new Set(manifest.records.map((record) => record.draftBundle.sourceProvenance.videoId));
  if (targetIds.size !== 2 || sourceIds.size !== 2 || videoIds.size !== 2) {
    context.addIssue({
      code: "custom",
      path: ["records"],
      message: "The atomic review manifest requires exactly two unique trusted source identities"
    });
  }
});

export type Phase3b2AtomicReviewManifest = z.infer<typeof phase3b2AtomicReviewManifestSchema>;

export interface BuildAtomicReviewItemsInput {
  sourceRecordKey: AtomicReviewRecordKey;
  transcriptSermonId: string;
  sourceTranscriptSha256: string;
  expectedTranscriptRowVersion: number;
  captionErrors: readonly { detail: string; supportingParagraphs: readonly number[]; sourceMarker?: string | null }[];
  namesOrScriptureReferences: readonly { detail: string; supportingParagraphs: readonly number[]; sourceMarker?: string | null }[];
}

export function buildAtomicReviewItems(input: BuildAtomicReviewItemsInput): AtomicReviewItem[] {
  const categories = [
    ["caption_error", input.captionErrors],
    ["name_or_scripture_reference", input.namesOrScriptureReferences]
  ] as const;
  const items: AtomicReviewItem[] = [];
  for (const [category, findings] of categories) {
    for (const [categoryIndex, finding] of findings.entries()) {
      const categoryOrdinal = categoryIndex + 1;
      const identityInput: AtomicReviewIdentityInput = {
        sourceRecordKey: input.sourceRecordKey,
        category,
        categoryOrdinal,
        detail: finding.detail,
        supportingParagraphs: finding.supportingParagraphs,
        transcriptSermonId: input.transcriptSermonId,
        sourceTranscriptSha256: input.sourceTranscriptSha256
      };
      const identitySha256 = atomicReviewIdentitySha256(identityInput);
      items.push(atomicReviewItemSchema.parse({
        id: atomicReviewItemUuid(identitySha256),
        itemKey: `atomic-${identitySha256}`,
        identitySha256,
        sourceRecordKey: input.sourceRecordKey,
        category,
        displayOrder: items.length + 1,
        categoryOrdinal,
        detail: finding.detail,
        supportingParagraphs: [...finding.supportingParagraphs],
        transcriptSermonId: input.transcriptSermonId,
        sourceTranscriptSha256: input.sourceTranscriptSha256,
        expectedTranscriptRowVersion: input.expectedTranscriptRowVersion,
        sourceMarker: finding.sourceMarker ?? null
      }));
    }
  }
  if (
    new Set(items.map((item) => item.identitySha256)).size !== items.length ||
    new Set(items.map((item) => item.id)).size !== items.length
  ) {
    throw new Error("Atomic review-item identity collision");
  }
  return items;
}

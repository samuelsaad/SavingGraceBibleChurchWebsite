import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

export const previewDatasetVersion = "saving-grace-public-preview-sermons-v1" as const;
export const previewDatasetSourceStatus = "public-development-dataset-v1" as const;
export const previewDatasetSyntheticSubject = "public-development-dataset-seed" as const;
export const previewDatasetDirectory = resolve("development-data/preview-sermons-v1");
export const previewDatasetContentPath = resolve(previewDatasetDirectory, "sermons.json");
export const previewDatasetManifestPath = resolve(previewDatasetDirectory, "manifest.json");

export const previewDatasetAllowedSlugs = [
  "phase3b2-ramfoaowwma",
  "christ-our-hope-in-suffering",
  "testing-god-at-rephidim",
  "joy-before-the-grave",
  "strangers-with-heavenly-hope",
  "your-calling-to-radical-thinking",
  "christian-liberty",
  "managing-the-tongue",
  "loving-god",
  "gods-will-for-the-local-church",
  "phase3b2-u52zfbc48",
  "what-is-genuine-faith",
  "the-perseverance-of-a-saint",
  "impossible-to-believe",
  "phase3b2-h2-rh-w8dfg"
] as const;

const slugSchema = z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const nullablePositiveInteger = z.number().int().positive().nullable();

const namedRelationshipSchema = z.object({
  name: z.string().min(1).max(240),
  slug: slugSchema,
  displayOrder: z.number().int().nonnegative()
}).strict();

const bibleBookSchema = namedRelationshipSchema.extend({
  canonicalBookId: z.number().int().min(1).max(66)
}).strict();

const scriptureReferenceSchema = z.object({
  displayText: z.string().min(1),
  canonicalBookId: z.number().int().min(1).max(66).nullable(),
  startChapter: nullablePositiveInteger,
  startVerse: nullablePositiveInteger,
  endChapter: nullablePositiveInteger,
  endVerse: nullablePositiveInteger,
  displayOrder: z.number().int().nonnegative(),
  relationshipRole: z.enum(["primary", "supporting", "unclassified"]),
  isLead: z.boolean(),
  reviewStatus: z.enum(["unreviewed", "confirmed"])
}).strict().superRefine((reference, context) => {
  if (reference.isLead && reference.relationshipRole !== "primary") {
    context.addIssue({ code: "custom", message: "Only a primary passage can be the lead passage" });
  }
  if (reference.relationshipRole === "primary" && (
    reference.canonicalBookId === null || reference.reviewStatus !== "confirmed"
  )) {
    context.addIssue({ code: "custom", message: "A development primary passage must be confirmed and canonical" });
  }
});

const mediaSchema = z.object({
  mediaType: z.enum(["video", "audio"]),
  provider: z.enum(["youtube", "sermonaudio"]),
  externalId: z.string().min(1).max(200),
  canonicalUrl: z.url(),
  title: z.string().min(1).max(500),
  durationSeconds: z.number().int().nonnegative().nullable(),
  isPrimary: z.boolean(),
  displayOrder: z.number().int().nonnegative(),
  availabilityStatus: z.enum(["unknown", "available", "unavailable", "invalid", "review"])
}).strict().superRefine((media, context) => {
  if (media.provider === "youtube" && (
    !/^[A-Za-z0-9_-]{11}$/u.test(media.externalId) ||
    media.canonicalUrl !== `https://www.youtube.com/watch?v=${media.externalId}`
  )) {
    context.addIssue({ code: "custom", message: "YouTube media must use one canonical video identity" });
  }
});

const questionAnswerSchema = z.object({
  displayOrder: z.number().int().min(1).max(10),
  question: z.string().min(1).max(1000),
  answer: z.string().min(1).max(10000)
}).strict();

export const previewSermonDatasetRecordSchema = z.object({
  title: z.string().min(1).max(240),
  slug: z.enum(previewDatasetAllowedSlugs),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  description: z.string().min(80).max(2000),
  transcript: z.string().min(1),
  speaker: namedRelationshipSchema.omit({ displayOrder: true }),
  series: z.array(namedRelationshipSchema),
  bibleBooks: z.array(bibleBookSchema),
  passageTerms: z.array(namedRelationshipSchema),
  scriptureReferences: z.array(scriptureReferenceSchema),
  primaryPassageDecision: z.enum(["confirmed_passage", "confirmed_none"]),
  media: z.array(mediaSchema).min(1),
  questionAnswers: z.array(questionAnswerSchema).min(5).max(10)
}).strict().superRefine((sermon, context) => {
  const orders = sermon.questionAnswers.map((item) => item.displayOrder);
  const expected = Array.from({ length: orders.length }, (_, index) => index + 1);
  if (orders.some((order, index) => order !== expected[index])) {
    context.addIssue({ code: "custom", message: "Q&A display order must be contiguous from one" });
  }
  const primary = sermon.scriptureReferences.filter((reference) =>
    reference.relationshipRole === "primary" && reference.reviewStatus === "confirmed"
  );
  if (sermon.primaryPassageDecision === "confirmed_passage" && (
    primary.length < 1 || primary.filter((reference) => reference.isLead).length !== 1
  )) {
    context.addIssue({ code: "custom", message: "A confirmed passage requires one lead primary passage" });
  }
  if (sermon.primaryPassageDecision === "confirmed_none" && primary.length !== 0) {
    context.addIssue({ code: "custom", message: "A confirmed-none decision cannot contain a primary passage" });
  }
});

export const previewSermonDatasetSchema = z.object({
  schemaVersion: z.literal(previewDatasetVersion),
  sermons: z.array(previewSermonDatasetRecordSchema).length(previewDatasetAllowedSlugs.length)
}).strict().superRefine((dataset, context) => {
  const slugs = dataset.sermons.map((sermon) => sermon.slug);
  if (new Set(slugs).size !== slugs.length) {
    context.addIssue({ code: "custom", message: "Development dataset sermon slugs must be unique" });
  }
  if (previewDatasetAllowedSlugs.some((slug) => !slugs.includes(slug))) {
    context.addIssue({ code: "custom", message: "Development dataset must contain the exact authorised scope" });
  }
});

export const previewSermonDatasetManifestSchema = z.object({
  schemaVersion: z.literal(previewDatasetVersion),
  contentFile: z.literal("sermons.json"),
  contentSha256: sha256Schema,
  expectedSermonCount: z.literal(previewDatasetAllowedSlugs.length),
  expectedQuestionAnswerCount: z.number().int().positive(),
  allowedSlugs: z.array(z.enum(previewDatasetAllowedSlugs)).length(previewDatasetAllowedSlugs.length)
}).strict().superRefine((manifest, context) => {
  if (manifest.allowedSlugs.some((slug, index) => slug !== previewDatasetAllowedSlugs[index])) {
    context.addIssue({ code: "custom", message: "The manifest slug order must match the authorised scope" });
  }
});

export type PreviewSermonDataset = z.infer<typeof previewSermonDatasetSchema>;
export type PreviewSermonDatasetRecord = z.infer<typeof previewSermonDatasetRecordSchema>;
export type PreviewSermonDatasetManifest = z.infer<typeof previewSermonDatasetManifestSchema>;

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function serializePublicDataset(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function loadTrackedPreviewDataset(): Promise<{
  dataset: PreviewSermonDataset;
  manifest: PreviewSermonDatasetManifest;
  contentSha256: string;
  manifestSha256: string;
}> {
  const [contentBytes, manifestBytes] = await Promise.all([
    readFile(previewDatasetContentPath),
    readFile(previewDatasetManifestPath)
  ]);
  const manifest = previewSermonDatasetManifestSchema.parse(JSON.parse(manifestBytes.toString("utf8")));
  const contentSha256 = sha256(contentBytes);
  if (contentSha256 !== manifest.contentSha256) {
    throw new Error("The tracked development dataset content hash does not match its manifest");
  }
  const dataset = previewSermonDatasetSchema.parse(JSON.parse(contentBytes.toString("utf8")));
  const questionAnswerCount = dataset.sermons.reduce(
    (count, sermon) => count + sermon.questionAnswers.length,
    0
  );
  if (questionAnswerCount !== manifest.expectedQuestionAnswerCount) {
    throw new Error("The tracked development dataset Q&A count does not match its manifest");
  }
  return { dataset, manifest, contentSha256, manifestSha256: sha256(manifestBytes) };
}

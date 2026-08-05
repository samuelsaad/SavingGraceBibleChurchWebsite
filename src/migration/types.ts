import { z } from "zod";
import type { PublicMedia } from "../domain/sermon";
import type { MediaSourceAudit } from "../domain/media";
import type { TransformedScriptureReference } from "../domain/scripture";

export const legacyTermSchema = z.object({
  termId: z.number().int().positive(),
  termTaxonomyId: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  order: z.number().int().default(0)
});

export type LegacyTerm = z.infer<typeof legacyTermSchema>;

export const legacySermonRecordSchema = z.object({
  sourceTable: z.enum([
    "wp_posts",
    "wp_sb_sermons",
    "wp_sb_books_sermons",
    "wp_sb_sermons_tags"
  ]),
  sourceId: z.number().int().positive(),
  postType: z.string().nullable().default(null),
  postStatus: z.string().nullable().default(null),
  title: z.string().nullable().default(null),
  slug: z.string().nullable().default(null),
  postDateLocal: z.string().nullable().default(null),
  postDateGmt: z.string().nullable().default(null),
  postModifiedLocal: z.string().nullable().default(null),
  postModifiedGmt: z.string().nullable().default(null),
  body: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),
  legacyViewCount: z.number().int().nonnegative().nullable().default(null),
  speakers: z.array(legacyTermSchema).default([]),
  series: z.array(legacyTermSchema).default([]),
  books: z.array(legacyTermSchema).default([]),
  passageTerms: z.array(legacyTermSchema).default([]),
  meta: z
    .object({
      biblePassage: z.string().nullable().default(null),
      youtube: z.string().nullable().default(null),
      audioEmbed: z.string().nullable().default(null)
    })
    .default({ biblePassage: null, youtube: null, audioEmbed: null })
});

export type LegacySermonRecord = z.infer<typeof legacySermonRecordSchema>;

export type MigrationOutcome = "included" | "excluded" | "rejected";
export type WarningSeverity = "info" | "warning" | "error";

export interface MigrationWarning {
  code: string;
  severity: WarningSeverity;
  field?: string;
  safeDetail: string;
}

export interface SafeMigrationRecordResult {
  sourceTable: string;
  sourceId: number;
  sourceStatus: string | null;
  outcome: MigrationOutcome;
  reasonCode: string;
  targetId: string | null;
  warnings: MigrationWarning[];
}

export interface ImportedSermon {
  id: string;
  sourceWordPressId: number;
  sourceStatus: string;
  title: string;
  slug: string;
  status: "published" | "pending";
  serviceDate: string;
  publishedAt: string | null;
  sourceCreatedLocal: string;
  sourceCreatedGmt: string | null;
  sourceModifiedLocal: string | null;
  sourceModifiedGmt: string | null;
  body: string | null;
  summary: string | null;
  speakers: LegacyTerm[];
  series: LegacyTerm[];
  books: LegacyTerm[];
  passageTerms: LegacyTerm[];
  scriptureReferences: TransformedScriptureReference[];
  media: PublicMedia[];
  sourceChecksumSha256: string;
}

export interface PrivateMigrationSourceAudit {
  targetSermonId: string;
  legacyViewCount: number | null;
  mediaSources: MediaSourceAudit[];
}

export interface TransformedMigrationRecord {
  report: SafeMigrationRecordResult;
  sermon: ImportedSermon | null;
  privateSourceAudit: PrivateMigrationSourceAudit | null;
}

export interface MigrationDryRunSummary {
  total: number;
  included: number;
  excluded: number;
  rejected: number;
  publishedIncluded: number;
  pendingIncluded: number;
  nonSundayWarnings: number;
}

export interface MigrationDryRunResult {
  summary: MigrationDryRunSummary;
  records: SafeMigrationRecordResult[];
  candidates: ImportedSermon[];
  privateSourceAudit: PrivateMigrationSourceAudit[];
}

import { z } from "zod";
import {canonicalStoredSermonSlug} from '../../domain/slug';
import { isoDateSchema, sermonDetailSchema, sermonSummarySchema } from "../../domain/sermon";
import { bibleBookBySlug, validateBiblePassage } from "../../domain/bible-passage";

const optionalSlug = z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional();

export const publicSermonListQuerySchema = z
  .object({
    query: z
      .string()
      .trim()
      .max(120)
      .transform((value) => (/[^\p{P}\p{S}\s]/u.test(value) ? value : undefined))
      .optional(),
    speaker: optionalSlug,
    series: optionalSlug,
    passage: optionalSlug,
    book: optionalSlug,
    passageBook: optionalSlug,
    passageChapter: z.coerce.number().int().positive().optional(),
    passageVerse: z.coerce.number().int().positive().optional(),
    passageEndVerse: z.coerce.number().int().positive().optional(),
    passageScope: z.enum(["book", "chapter", "verse"]).optional(),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    order: z.enum(["ASC", "DESC"]).default("DESC"),
    view: z.enum(["recent"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(9)
  })
  .superRefine((value, context) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      context.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must not be before dateFrom"
      });
    }
    if (value.book && value.passageBook && value.book !== value.passageBook) {
      context.addIssue({
        code: "custom",
        path: ["passageBook"],
        message: "Broad Bible-book and exact-passage filters must use the same book"
      });
    }
    if (!value.passageBook && (
      value.passageChapter !== undefined || value.passageVerse !== undefined || value.passageEndVerse !== undefined
      || value.passageScope !== undefined
    )) {
      context.addIssue({ code: "custom", path: ["passageBook"], message: "Choose a Bible book first" });
      return;
    }
    if (value.passageBook) {
      const book = bibleBookBySlug(value.passageBook);
      if (!book) {
        context.addIssue({ code: "custom", path: ["passageBook"], message: "Unknown canonical Bible book" });
        return;
      }
      if (value.passageVerse !== undefined && value.passageChapter === undefined) {
        context.addIssue({ code: "custom", path: ["passageVerse"], message: "Choose a chapter before a verse" });
      }
      if (value.passageEndVerse !== undefined && value.passageVerse === undefined) {
        context.addIssue({ code: "custom", path: ["passageEndVerse"], message: "Choose a starting verse first" });
      }
      if (value.passageChapter !== undefined) {
        const passage = {
          canonicalBookId: book.id,
          startChapter: value.passageChapter,
          startVerse: value.passageVerse ?? null,
          endChapter: value.passageChapter,
          endVerse: value.passageEndVerse ?? value.passageVerse ?? null
        };
        for (const message of validateBiblePassage(passage).issues) {
          context.addIssue({ code: "custom", path: ["passageChapter"], message });
        }
      }
      if (value.passageScope === "book" && (
        value.passageChapter !== undefined || value.passageVerse !== undefined || value.passageEndVerse !== undefined
      )) {
        context.addIssue({ code: "custom", path: ["passageScope"], message: "A whole-book search cannot include a chapter or verse" });
      }
      if (value.passageScope === "chapter" && (
        value.passageChapter === undefined || value.passageVerse !== undefined || value.passageEndVerse !== undefined
      )) {
        context.addIssue({ code: "custom", path: ["passageScope"], message: "A whole-chapter search requires one chapter and no verse" });
      }
      if (value.passageScope === "verse" && (
        value.passageChapter === undefined || value.passageVerse === undefined
        || (value.passageEndVerse !== undefined && value.passageEndVerse !== value.passageVerse)
      )) {
        context.addIssue({ code: "custom", path: ["passageScope"], message: "An exact-verse search requires one book, chapter and verse" });
      }
    }
  });

export type PublicSermonListQuery = z.infer<typeof publicSermonListQuerySchema>;

export const sermonListResponseSchema = z.object({
  data: z.array(sermonSummarySchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative()
  })
});

export const publicSermonDetailParamsSchema = z.object({
  slug: z.string().min(1).max(200).refine(value=>canonicalStoredSermonSlug(value)!==null,'Expected a safe canonical sermon slug').transform(value=>canonicalStoredSermonSlug(value)!)
});

export const publicSermonApiContracts = {
  list: {
    method: "GET",
    path: "/api/v1/sermons",
    authentication: "public",
    query: publicSermonListQuerySchema,
    response: sermonListResponseSchema
  },
  detail: {
    method: "GET",
    path: "/api/v1/sermons/:slug",
    authentication: "public",
    params: publicSermonDetailParamsSchema,
    response: sermonDetailSchema
  }
} as const;

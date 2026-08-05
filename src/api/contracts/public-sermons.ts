import { z } from "zod";
import { isoDateSchema, sermonDetailSchema, sermonSummarySchema } from "../../domain/sermon";

const optionalSlug = z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional();

export const publicSermonListQuerySchema = z
  .object({
    query: z.string().trim().min(1).max(120).optional(),
    speaker: optionalSlug,
    series: optionalSlug,
    passage: optionalSlug,
    book: optionalSlug,
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    order: z.enum(["ASC", "DESC"]).default("DESC"),
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
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/)
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

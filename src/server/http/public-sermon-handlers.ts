import { ZodError } from "zod";
import {
  publicSermonDetailParamsSchema,
  publicSermonListQuerySchema,
  sermonListResponseSchema
} from "../../api/contracts/public-sermons";
import {
  InvalidLegacySermonQueryError,
  translateLegacySermonQuery
} from "../../api/legacy-sermon-query";
import { sermonDetailSchema } from "../../domain/sermon";
import type { PublicSermonRepository } from "../repositories/sermon-repository";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function validationResponse(error: ZodError | InvalidLegacySermonQueryError): Response {
  const issues =
    error instanceof ZodError
      ? error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      : [{ path: "sermon_dates", message: error.message }];
  return json(400, { error: { code: "invalid_request", issues } });
}

export function createPublicSermonHandlers(repository: PublicSermonRepository) {
  return {
    async list(request: Request): Promise<Response> {
      try {
        const url = new URL(request.url);
        const query = publicSermonListQuerySchema.parse(
          translateLegacySermonQuery(url.searchParams)
        );
        const result = await repository.listPublished(query);
        const response = sermonListResponseSchema.parse({
          data: result.data,
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            totalItems: result.totalItems,
            totalPages: Math.ceil(result.totalItems / query.pageSize)
          }
        });
        return json(200, response);
      } catch (error) {
        if (error instanceof ZodError || error instanceof InvalidLegacySermonQueryError) {
          return validationResponse(error);
        }
        return json(500, { error: { code: "internal_error" } });
      }
    },

    async detail(slug: string): Promise<Response> {
      try {
        const params = publicSermonDetailParamsSchema.parse({ slug });
        const sermon = await repository.findPublishedBySlug(params.slug);
        if (!sermon) return json(404, { error: { code: "sermon_not_found" } });
        return json(200, sermonDetailSchema.parse(sermon));
      } catch (error) {
        if (error instanceof ZodError) return validationResponse(error);
        return json(500, { error: { code: "internal_error" } });
      }
    }
  };
}

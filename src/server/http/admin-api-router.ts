import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import {
  adminSermonIdParamsSchema,
  adminSermonListQuerySchema,
  acknowledgeEmptyEnrichmentReviewInputSchema,
  createSermonInputSchema,
  enrichmentReviewItemDecisionInputSchema,
  enrichmentReviewProgressInputSchema,
  finishEnrichmentReviewInputSchema,
  permanentlyDeleteSermonInputSchema,
  sermonStateActionSchema,
  sermonTransitionInputSchema,
  taxonomyKindSchema,
  taxonomyUpdateInputSchema,
  taxonomyWriteInputSchema,
  updateSermonInputSchema
} from "../../api/contracts/admin-sermons";
import { AdminSermonService } from "../../application/admin-sermon-service";
import { ApplicationError } from "../../application/errors";
import type { IdentityProvider } from "../auth/identity-provider";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(status: number, body: unknown, additionalHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders, ...additionalHeaders }
  });
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > 1_000_000) {
    throw new ApplicationError(413, "request_too_large", "Request body is too large");
  }
  const text = await request.text();
  if (text.length > 1_000_000) {
    throw new ApplicationError(413, "request_too_large", "Request body is too large");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ApplicationError(400, "invalid_json", "Request body must be valid JSON");
  }
}

function correlationId(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return json(400, {
      error: {
        code: "invalid_request",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      }
    });
  }
  if (error instanceof ApplicationError) {
    return json(error.status, {
      error: {
        code: error.code,
        ...(error.issues ? { issues: error.issues } : {})
      }
    });
  }
  return json(500, { error: { code: "internal_error" } });
}

export function createAdminApiRouter(
  service: AdminSermonService,
  identityProvider: IdentityProvider
) {
  return async (request: Request): Promise<Response> => {
    try {
      const identity = await identityProvider.authenticate(request);
      if (!identity) return json(401, { error: { code: "authentication_required" } });

      const url = new URL(request.url);
      const path = url.pathname;
      const requestCorrelationId = correlationId(request);

      if (path === "/api/v1/admin/sermons" || path === "/api/v1/admin/sermons/") {
        if (request.method === "GET") {
          const query = adminSermonListQuerySchema.parse(Object.fromEntries(url.searchParams));
          return json(200, await service.list(query, identity));
        }
        if (request.method === "POST") {
          const input = createSermonInputSchema.parse(await readJson(request));
          return json(201, await service.create(input, identity, requestCorrelationId));
        }
        return json(405, { error: { code: "method_not_allowed" } }, { Allow: "GET, POST" });
      }

      if (path === "/api/v1/admin/audit" || path === "/api/v1/admin/audit/") {
        if (request.method !== "GET") {
          return json(405, { error: { code: "method_not_allowed" } }, { Allow: "GET" });
        }
        return json(200, await service.auditHistory(identity));
      }

      const audit = /^\/api\/v1\/admin\/sermons\/([^/]+)\/audit\/?$/.exec(path);
      if (audit) {
        if (request.method !== "GET") {
          return json(405, { error: { code: "method_not_allowed" } }, { Allow: "GET" });
        }
        const { id } = adminSermonIdParamsSchema.parse({ id: decodeURIComponent(audit[1]!) });
        return json(200, { data: await service.listAudit(id, identity) });
      }

      const transition =
        /^\/api\/v1\/admin\/sermons\/([^/]+)\/(submit|withdraw|schedule|publish|unpublish|archive|restore)\/?$/.exec(
          path
        );
      if (transition) {
        if (request.method !== "POST") {
          return json(405, { error: { code: "method_not_allowed" } }, { Allow: "POST" });
        }
        const { id } = adminSermonIdParamsSchema.parse({
          id: decodeURIComponent(transition[1]!)
        });
        const action = sermonStateActionSchema.parse(transition[2]);
        const input = sermonTransitionInputSchema.parse(await readJson(request));
        return json(
          200,
          await service.transition(id, action, input, identity, requestCorrelationId)
        );
      }

      const permanentDelete =
        /^\/api\/v1\/admin\/sermons\/([^/]+)\/permanent-delete\/?$/.exec(path);
      if (permanentDelete) {
        if (request.method !== "POST") {
          return json(405, { error: { code: "method_not_allowed" } }, { Allow: "POST" });
        }
        const { id } = adminSermonIdParamsSchema.parse({
          id: decodeURIComponent(permanentDelete[1]!)
        });
        const input = permanentlyDeleteSermonInputSchema.parse(await readJson(request));
        return json(
          200,
          await service.permanentlyDelete(id, input, identity, requestCorrelationId)
        );
      }

      const reviewItemDecision =
        /^\/api\/v1\/admin\/sermons\/([^/]+)\/review\/items\/([^/]+)\/decision\/?$/.exec(path);
      if (reviewItemDecision) {
        if (request.method !== "POST") {
          return json(405, { error: { code: "method_not_allowed" } }, { Allow: "POST" });
        }
        const { id } = adminSermonIdParamsSchema.parse({
          id: decodeURIComponent(reviewItemDecision[1]!)
        });
        const { id: itemId } = adminSermonIdParamsSchema.parse({
          id: decodeURIComponent(reviewItemDecision[2]!)
        });
        const input = enrichmentReviewItemDecisionInputSchema.parse(await readJson(request));
        return json(
          200,
          await service.decideEnrichmentReviewItem(
            id,
            itemId,
            input,
            identity,
            requestCorrelationId
          )
        );
      }

      const acknowledgeEmptyReview =
        /^\/api\/v1\/admin\/sermons\/([^/]+)\/review\/empty-item-set\/acknowledge\/?$/.exec(path);
      if (acknowledgeEmptyReview) {
        if (request.method !== "POST") {
          return json(405, { error: { code: "method_not_allowed" } }, { Allow: "POST" });
        }
        const { id } = adminSermonIdParamsSchema.parse({
          id: decodeURIComponent(acknowledgeEmptyReview[1]!)
        });
        const input = acknowledgeEmptyEnrichmentReviewInputSchema.parse(await readJson(request));
        return json(
          200,
          await service.acknowledgeEmptyEnrichmentReviewItems(
            id,
            input,
            identity,
            requestCorrelationId
          )
        );
      }

      const reviewProgress =
        /^\/api\/v1\/admin\/sermons\/([^/]+)\/review\/progress\/?$/.exec(path);
      if (reviewProgress) {
        if (request.method !== "PATCH") {
          return json(405, { error: { code: "method_not_allowed" } }, { Allow: "PATCH" });
        }
        const { id } = adminSermonIdParamsSchema.parse({
          id: decodeURIComponent(reviewProgress[1]!)
        });
        const input = enrichmentReviewProgressInputSchema.parse(await readJson(request));
        return json(
          200,
          await service.updateEnrichmentReviewProgress(
            id,
            input,
            identity,
            requestCorrelationId
          )
        );
      }

      const finishReview =
        /^\/api\/v1\/admin\/sermons\/([^/]+)\/review\/finish\/?$/.exec(path);
      if (finishReview) {
        if (request.method !== "POST") {
          return json(405, { error: { code: "method_not_allowed" } }, { Allow: "POST" });
        }
        const { id } = adminSermonIdParamsSchema.parse({
          id: decodeURIComponent(finishReview[1]!)
        });
        const input = finishEnrichmentReviewInputSchema.parse(await readJson(request));
        return json(
          200,
          await service.finishEnrichmentReview(id, input, identity, requestCorrelationId)
        );
      }

      const enrichmentReview =
        /^\/api\/v1\/admin\/sermons\/([^/]+)\/review\/?$/.exec(path);
      if (enrichmentReview) {
        if (request.method !== "GET") {
          return json(405, { error: { code: "method_not_allowed" } }, { Allow: "GET" });
        }
        const { id } = adminSermonIdParamsSchema.parse({
          id: decodeURIComponent(enrichmentReview[1]!)
        });
        return json(200, await service.enrichmentReviewDetail(id, identity));
      }

      const sermon = /^\/api\/v1\/admin\/sermons\/([^/]+)\/?$/.exec(path);
      if (sermon) {
        const { id } = adminSermonIdParamsSchema.parse({ id: decodeURIComponent(sermon[1]!) });
        if (request.method === "GET") return json(200, await service.detail(id, identity));
        if (request.method === "PATCH") {
          const input = updateSermonInputSchema.parse(await readJson(request));
          return json(200, await service.update(id, input, identity, requestCorrelationId));
        }
        return json(405, { error: { code: "method_not_allowed" } }, { Allow: "GET, PATCH" });
      }

      const taxonomy = /^\/api\/v1\/admin\/taxonomies\/([^/]+)\/?$/.exec(path);
      if (taxonomy) {
        const kind = taxonomyKindSchema.parse(decodeURIComponent(taxonomy[1]!));
        if (request.method === "GET") {
          return json(200, { data: await service.listTaxonomies(kind, identity) });
        }
        if (request.method === "POST") {
          const input = taxonomyWriteInputSchema.parse(await readJson(request));
          return json(
            201,
            await service.createTaxonomy(kind, input, identity, requestCorrelationId)
          );
        }
        return json(405, { error: { code: "method_not_allowed" } }, { Allow: "GET, POST" });
      }

      const taxonomyDetail = /^\/api\/v1\/admin\/taxonomies\/([^/]+)\/([^/]+)\/?$/.exec(path);
      if (taxonomyDetail) {
        const kind = taxonomyKindSchema.parse(decodeURIComponent(taxonomyDetail[1]!));
        const { id } = adminSermonIdParamsSchema.parse({
          id: decodeURIComponent(taxonomyDetail[2]!)
        });
        if (request.method === "PATCH") {
          const input = taxonomyUpdateInputSchema.parse(await readJson(request));
          return json(
            200,
            await service.updateTaxonomy(kind, id, input, identity, requestCorrelationId)
          );
        }
        return json(405, { error: { code: "method_not_allowed" } }, { Allow: "PATCH" });
      }

      return json(404, { error: { code: "not_found" } });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

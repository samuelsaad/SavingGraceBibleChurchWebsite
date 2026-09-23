/**
 * Alternate archive presentations reached from the Sermons menu:
 * SermonsV1 (the original landing page) at /sermons-v1/ and SermonsV4 at
 * /sermons-v4/ with its own pagination. Both reuse the caller's eligible
 * repository and render context, so a preview caller authenticates first
 * and the sealed runtime keeps its restricted scope. The routes are
 * non-indexable comparison surfaces; the archive canonical is unchanged.
 */
import { ZodError } from "zod";
import { publicSermonListQuerySchema } from "../../api/contracts/public-sermons";
import { InvalidLegacySermonQueryError } from "../../api/legacy-sermon-query";
import { renderFrontendBoundaryPage } from "../../frontend/pages/boundary";
import { renderSermonsV1Page } from "../../frontend/pages/sermons-v1";
import { renderSermonsV4Page } from "../../frontend/pages/sermons-v4";
import { contextualPath, sermonsV1Path, sermonsV4Path, type FrontendRenderContext } from "../../frontend/routes";
import type { PublicSermonRepository } from "../repositories/sermon-repository";
import { loadArchivePage } from "./frontend-archive-loader";
import { frontendResponse } from "./frontend-response";

export type AlternateArchive = "v1" | "v4";

const landingPageSize = 50;

export function createAlternateArchiveHandler(
  repository: PublicSermonRepository,
  context: FrontendRenderContext,
  presentation: AlternateArchive
) {
  const path = presentation === "v1" ? sermonsV1Path : sermonsV4Path;
  const root = contextualPath(context, path);
  const privatePreview = context.mode !== "public";
  const robots = { "X-Robots-Tag": privatePreview ? "noindex, nofollow, noarchive" : "noindex, follow" };
  const redirectStatus = context.mode === "preview" || context.mode === "draft-preview" ? 307 : 301;
  const pageMatcher = new RegExp(`^${root.replaceAll("/", "\\/")}page\\/([0-9]+)\\/$`, "u");
  const slashless = new RegExp(`^${root.slice(0, -1).replaceAll("/", "\\/")}(?:\\/page\\/[0-9]+)?$`, "u");

  function error(status: number, title: string, message: string): Response {
    return frontendResponse(renderFrontendBoundaryPage({ title, message }, context), { status, privatePreview, headers: robots });
  }
  function redirect(location: string): Response {
    return new Response(null, { status: redirectStatus, headers: { ...robots, "Cache-Control": "no-store", Location: location } });
  }

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    if (url.pathname !== root.slice(0, -1) && !url.pathname.startsWith(root)) return null;
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: { ...robots, "Cache-Control": "no-store", Allow: "GET" } });
    }
    try {
      if (slashless.test(url.pathname)) return redirect(`${url.pathname}/${url.search}`);
      if (presentation === "v1") {
        if (url.pathname !== root) return error(404, "Page not found", "That sermon page does not exist.");
        const [sermons, options] = await Promise.all([
          repository.listPublished(publicSermonListQuerySchema.parse({ page: 1, pageSize: landingPageSize, order: "DESC" })),
          repository.listPublishedFilterOptions()
        ]);
        return frontendResponse(renderSermonsV1Page({ sermons: sermons.data, options, totalItems: sermons.totalItems }, context), { privatePreview, headers: robots });
      }
      const match = pageMatcher.exec(url.pathname);
      if (url.pathname !== root && !match) return error(404, "Page not found", "That archive page does not exist.");
      const page = match ? Number(match[1]) : null;
      if (page !== null && (!Number.isSafeInteger(page) || page < 1)) return error(404, "Page not found", "That archive page does not exist.");
      if (page === 1) return redirect(`${root}${url.search}`);
      const loaded = await loadArchivePage(repository, url.searchParams, page);
      if (loaded.kind === "not-found") return error(404, "Page not found", "That archive page does not exist.");
      return frontendResponse(renderSermonsV4Page(loaded.input, context), { privatePreview, headers: robots });
    } catch (cause) {
      if (cause instanceof ZodError || cause instanceof InvalidLegacySermonQueryError) {
        return error(400, "Check the sermon filters", "One or more filter values are invalid.");
      }
      return error(500, "Sermons temporarily unavailable", "Please try again later.");
    }
  };
}

/** Both alternates, tried in order; null when the request is for neither. */
export function createAlternateArchiveHandlers(repository: PublicSermonRepository, context: FrontendRenderContext) {
  const handlers = (["v1", "v4"] as const).map((presentation) => createAlternateArchiveHandler(repository, context, presentation));
  return async (request: Request): Promise<Response | null> => {
    for (const handler of handlers) {
      const response = await handler(request);
      if (response) return response;
    }
    return null;
  };
}

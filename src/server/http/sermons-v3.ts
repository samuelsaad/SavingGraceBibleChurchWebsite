import { ZodError } from "zod";
import { InvalidLegacySermonQueryError } from "../../api/legacy-sermon-query";
import { renderFrontendBoundaryPage } from "../../frontend/pages/boundary";
import { renderSermonsV3 } from "../../frontend/pages/v3";
import { contextualPath, type FrontendRenderContext } from "../../frontend/routes";
import { sermonsV3Path } from "../../frontend/v3-routes";
import type { PublicSermonRepository } from "../repositories/sermon-repository";
import { loadArchivePage } from "./frontend-archive-loader";
import { frontendResponse } from "./frontend-response";

/** Reuses the caller's eligible repository. Preview callers must authenticate first. */
export function createSermonsV3Handler(repository: PublicSermonRepository, context: FrontendRenderContext) {
  const root = contextualPath(context, sermonsV3Path);
  const privatePreview = context.mode !== "public";
  const headers = { "X-Robots-Tag": privatePreview ? "noindex, nofollow, noarchive" : "noindex, follow" };
  function error(status: number, title: string, message: string): Response {
    return frontendResponse(renderFrontendBoundaryPage({ title, message }, context), { status, privatePreview, headers });
  }
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    if (url.pathname !== root.slice(0, -1) && !url.pathname.startsWith(root)) return null;
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { ...headers, "Cache-Control": "no-store", Allow: "GET" } });
    try {
      if (url.pathname === root.slice(0, -1) || new RegExp(`^${root}page/[0-9]+$`).test(url.pathname)) {
        return new Response(null, { status: 301, headers: { ...headers, "Cache-Control": "no-store", Location: `${url.pathname}/${url.search}` } });
      }
      const match = new RegExp(`^${root}page/([0-9]+)/$`).exec(url.pathname);
      if (url.pathname !== root && !match) return error(404, "Page not found", "That archive page does not exist.");
      const page = match ? Number(match[1]) : null;
      if (page !== null && (!Number.isSafeInteger(page) || page < 1)) return error(404, "Page not found", "That archive page does not exist.");
      if (page === 1) return new Response(null, { status: 301, headers: { ...headers, "Cache-Control": "no-store", Location: `${root}${url.search}` } });
      const loaded = await loadArchivePage(repository, url.searchParams, page);
      if (loaded.kind === "not-found") return error(404, "Page not found", "That archive page does not exist.");
      return frontendResponse(renderSermonsV3(loaded.input, context), { privatePreview, headers });
    } catch (cause) {
      if (cause instanceof ZodError || cause instanceof InvalidLegacySermonQueryError) return error(400, "Check the sermon filters", "One or more filter values are invalid.");
      return error(500, "Sermons temporarily unavailable", "Please try again later.");
    }
  };
}

/**
 * Public sermon site handler: routing, redirects, the sermon sitemap and
 * error mapping. Rendering lives in the framework-independent src/frontend
 * package; this module re-exports its render functions for existing callers.
 */
import { ZodError } from "zod";
import { InvalidLegacySermonQueryError } from "../../api/legacy-sermon-query";
import {
  archivePath,
  canonicalOrigin,
  renderFrontendBoundaryPage,
  renderPublicSermonArchivePage,
  renderPublicSermonPage
} from "../../frontend";
import { escapeXml } from "../../frontend/xml";
import type { PublicSermonRepository } from "../repositories/sermon-repository";
import { loadArchivePage } from "./frontend-archive-loader";
import { frontendResponse, plainResponseHeaders } from "./frontend-response";

export {
  hasActiveSermonFilters,
  isExpandedRecentView,
  previewRenderContext,
  publicRenderContext,
  publicSiteStyles,
  renderFrontendBoundaryPage,
  renderFrontendHomePage,
  renderFrontendTaxonomyDetail,
  renderFrontendTaxonomyIndex,
  renderPublicSermonArchivePage,
  renderPublicSermonPage,
  type FrontendRenderContext,
  type FrontendTaxonomyKind
} from "../../frontend";
export { frontendResponse, frontendResponseHeaders } from "./frontend-response";

function errorPage(status: 400 | 404 | 410 | 500, title: string, message: string): Response {
  return frontendResponse(renderFrontendBoundaryPage({ title, message }), { status });
}

function redirect(status: 301, location: string): Response {
  return new Response(null, { status, headers: { ...plainResponseHeaders, Location: location } });
}

function renderSermonSitemap(entries: Array<{ slug: string; lastModified: string }>): string {
  const urls = [
    `<url><loc>${escapeXml(`${canonicalOrigin}${archivePath}`)}</loc></url>`,
    ...entries.map((entry) => `<url><loc>${escapeXml(`${canonicalOrigin}/sermons/${entry.slug}/`)}</loc><lastmod>${escapeXml(entry.lastModified)}</lastmod></url>`)
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}

export function createPublicSermonSiteHandler(repository: PublicSermonRepository) {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    const isArchiveRoot = url.pathname === archivePath;
    const archivePageMatch = /^\/sermons\/page\/(\d+)\/$/.exec(url.pathname);
    const detailMatch = /^\/sermons\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/.exec(url.pathname);
    const isSitemap = url.pathname === "/sitemap-sermons.xml";
    const needsTrailingSlash = url.pathname === "/sermons"
      || /^\/sermons\/(?:page\/\d+|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(url.pathname);
    const isSermonRoute = isArchiveRoot || Boolean(archivePageMatch || detailMatch || isSitemap || needsTrailingSlash || url.pathname.startsWith("/sermons/"));
    if (!isSermonRoute) return null;
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: { ...plainResponseHeaders, "Content-Type": "text/plain; charset=utf-8", Allow: "GET" } });
    }

    try {
      if (needsTrailingSlash) return redirect(301, `${url.pathname}/${url.search}`);

      if (isSitemap) {
        const entries = await repository.listPublishedSitemapEntries();
        return new Response(renderSermonSitemap(entries), {
          status: 200,
          headers: { ...plainResponseHeaders, "Content-Type": "application/xml; charset=utf-8" }
        });
      }

      if (isArchiveRoot || archivePageMatch) {
        const pathPage = archivePageMatch ? Number(archivePageMatch[1]) : 1;
        if (!Number.isSafeInteger(pathPage) || pathPage < 1) {
          return errorPage(404, "Page not found", "That sermon archive page does not exist.");
        }
        if (archivePageMatch && pathPage === 1) return redirect(301, `${archivePath}${url.search}`);
        const loaded = await loadArchivePage(repository, url.searchParams, archivePageMatch ? pathPage : null);
        if (loaded.kind === "not-found") {
          return errorPage(404, "Page not found", "That sermon archive page does not exist.");
        }
        return frontendResponse(renderPublicSermonArchivePage(loaded.input));
      }

      if (detailMatch) {
        const sermon = await repository.findPublishedBySlug(detailMatch[1]!);
        if (sermon) return frontendResponse(renderPublicSermonPage(sermon));
        const disposition = await repository.findPublicPathDisposition(url.pathname);
        if (disposition?.kind === "redirect") return redirect(301, disposition.location);
        if (disposition?.kind === "gone") {
          return errorPage(410, "Sermon no longer available", "This sermon has been permanently removed.");
        }
        return errorPage(404, "Sermon not found", "The requested sermon is not publicly available.");
      }

      return errorPage(404, "Page not found", "The requested sermon page does not exist.");
    } catch (error) {
      if (error instanceof ZodError || error instanceof InvalidLegacySermonQueryError) {
        return errorPage(400, "Check the sermon filters", "One or more filter values are invalid.");
      }
      return errorPage(500, "Sermons temporarily unavailable", "Please try again later.");
    }
  };
}

export const createPublicSermonPageHandler = createPublicSermonSiteHandler;

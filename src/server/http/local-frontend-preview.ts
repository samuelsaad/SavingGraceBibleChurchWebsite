import { ZodError } from "zod";
import {
  publicSermonListQuerySchema,
  type PublicSermonListQuery
} from "../../api/contracts/public-sermons";
import { InvalidLegacySermonQueryError } from "../../api/legacy-sermon-query";
import {
  previewRenderContext,
  renderFrontendBoundaryPage,
  renderFrontendHomePage,
  renderFrontendTaxonomyDetail,
  renderFrontendTaxonomyIndex,
  renderPublicSermonArchivePage,
  renderPublicSermonPage,
  type FrontendTaxonomyKind
} from "../../frontend";
import type { LocalFrontendPreviewSession } from "../auth/local-frontend-preview-session";
import type {
  PublicSermonFilterOption,
  PublicSermonFilterOptions,
  PublicSermonRepository
} from "../repositories/sermon-repository";
import { loadArchivePage } from "./frontend-archive-loader";
import { frontendResponse, frontendResponseHeaders } from "./frontend-response";

const previewRoot = "/frontend-preview";
const taxonomyPageSize = 50;

function response(html: string, status = 200): Response {
  return frontendResponse(html, { status, privatePreview: true });
}

function boundary(status: number, title: string, message: string, kind: "not-found" | "private" | "error"): Response {
  return response(renderFrontendBoundaryPage({ title, message, kind }, previewRenderContext), status);
}

function taxonomyOptions(options: PublicSermonFilterOptions, kind: FrontendTaxonomyKind): PublicSermonFilterOption[] {
  return kind === "speakers" ? options.speakers : kind === "series" ? options.series : options.books;
}

function taxonomyQuery(kind: FrontendTaxonomyKind, slug: string): PublicSermonListQuery {
  return publicSermonListQuerySchema.parse({
    ...(kind === "speakers" ? { speaker: slug } : kind === "series" ? { series: slug } : { book: slug }),
    page: 1,
    pageSize: taxonomyPageSize,
    order: "DESC"
  });
}

export function createLocalFrontendPreviewHandler(
  repository: PublicSermonRepository,
  session: LocalFrontendPreviewSession
) {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    if (url.pathname !== previewRoot && !url.pathname.startsWith(`${previewRoot}/`)) return null;
    if (request.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...frontendResponseHeaders("", { privatePreview: true }), Allow: "GET" }
      });
    }
    if (!session.authorizes(request)) {
      return boundary(
        401,
        "Administrator preview session required",
        "Open the local administration dashboard first, then use its Frontend preview link.",
        "private"
      );
    }
    if (
      url.pathname === previewRoot
      || /^\/frontend-preview\/(?:sermons(?:\/page\/\d+|\/[a-z0-9]+(?:-[a-z0-9]+)*)?|(?:speakers|series|books)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?)$/u.test(url.pathname)
    ) {
      return new Response(null, {
        status: 307,
        headers: {
          ...frontendResponseHeaders("", { privatePreview: true }),
          Location: `${url.pathname}/${url.search}`
        }
      });
    }

    try {
      if (url.pathname === `${previewRoot}/`) {
        const [sermons, options] = await Promise.all([
          repository.listPublished(publicSermonListQuerySchema.parse({ page: 1, pageSize: 50, order: "DESC" })),
          repository.listPublishedFilterOptions()
        ]);
        return response(renderFrontendHomePage({ sermons: sermons.data, options, totalItems: sermons.totalItems }, previewRenderContext));
      }

      const archivePageMatch = /^\/frontend-preview\/sermons\/page\/(\d+)\/$/u.exec(url.pathname);
      if (url.pathname === `${previewRoot}/sermons/` || archivePageMatch) {
        const page = archivePageMatch ? Number(archivePageMatch[1]) : 1;
        if (!Number.isSafeInteger(page) || page < 1) {
          return boundary(404, "Page not found", "That sermon archive page does not exist.", "not-found");
        }
        const loaded = await loadArchivePage(repository, url.searchParams, page);
        if (loaded.kind === "not-found") {
          return boundary(404, "Page not found", "That sermon archive page does not exist.", "not-found");
        }
        return response(renderPublicSermonArchivePage(loaded.input, previewRenderContext));
      }

      const detailMatch = /^\/frontend-preview\/sermons\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u.exec(url.pathname);
      if (detailMatch) {
        const [sermon, options] = await Promise.all([
          repository.findPublishedBySlug(detailMatch[1]!),
          repository.listPublishedFilterOptions()
        ]);
        if (!sermon) {
          return boundary(404, "Sermon not available", "This sermon is not eligible for the private frontend preview.", "private");
        }
        return response(renderPublicSermonPage(sermon, previewRenderContext, { options }));
      }

      const taxonomyIndexMatch = /^\/frontend-preview\/(speakers|series|books)\/$/u.exec(url.pathname);
      if (taxonomyIndexMatch) {
        const kind = taxonomyIndexMatch[1] as FrontendTaxonomyKind;
        const options = await repository.listPublishedFilterOptions();
        return response(renderFrontendTaxonomyIndex(kind, taxonomyOptions(options, kind), previewRenderContext, options));
      }

      const taxonomyDetailMatch = /^\/frontend-preview\/(speakers|series|books)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u.exec(url.pathname);
      if (taxonomyDetailMatch) {
        const kind = taxonomyDetailMatch[1] as FrontendTaxonomyKind;
        const slug = taxonomyDetailMatch[2]!;
        const options = await repository.listPublishedFilterOptions();
        const option = taxonomyOptions(options, kind).find((candidate) => candidate.slug === slug);
        if (!option) return boundary(404, "Page not found", "That sermon classification is not available.", "not-found");
        const sermons = await repository.listPublished(taxonomyQuery(kind, slug));
        return response(renderFrontendTaxonomyDetail({ kind, option, sermons: sermons.data, totalItems: sermons.totalItems, options }, previewRenderContext));
      }

      return boundary(404, "Page not found", "The requested frontend preview page does not exist.", "not-found");
    } catch (error) {
      if (error instanceof ZodError || error instanceof InvalidLegacySermonQueryError) {
        return boundary(400, "Check the sermon filters", "One or more filter values are invalid.", "error");
      }
      return boundary(500, "Preview temporarily unavailable", "The private frontend preview could not be loaded.", "error");
    }
  };
}

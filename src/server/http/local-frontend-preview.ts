import { ZodError } from "zod";
import {validateLegacySlug} from '../../domain/slug';
import {
  publicSermonListQuerySchema,
  type PublicSermonListQuery
} from "../../api/contracts/public-sermons";
import { InvalidLegacySermonQueryError } from "../../api/legacy-sermon-query";
import {
  draftPreviewRenderContext,
  previewRenderContext,
  renderFrontendBoundaryPage,
  renderFrontendTaxonomyDetail,
  renderFrontendTaxonomyIndex,
  renderPublicSermonArchivePage,
  renderPublicSermonPage,
  type FrontendRenderContext,
  type FrontendTaxonomyKind
} from "../../frontend";
import type { LocalFrontendPreviewSession } from "../auth/local-frontend-preview-session";
import type {
  PublicSermonFilterOption,
  PublicSermonFilterOptions,
  PublicSermonRepository
} from "../repositories/sermon-repository";
import { createAlternateArchiveHandlers } from "./alternate-archives";
import { createChurchSiteHandler, type ChurchSiteOptions } from "./church-site";
import { loadArchivePage } from "./frontend-archive-loader";
import { frontendResponse, frontendResponseHeaders } from "./frontend-response";

const previewRoot = "/frontend-preview";
const taxonomyPageSize = 50;

export interface ProtectedFrontendPreviewOptions {
  root?: "/frontend-preview" | "/draft-preview";
  context?: FrontendRenderContext;
  church?: ChurchSiteOptions;
}

function response(html: string, status = 200): Response {
  return frontendResponse(html, { status, privatePreview: true });
}

function boundary(
  status: number,
  title: string,
  message: string,
  kind: "not-found" | "private" | "error",
  context: FrontendRenderContext = previewRenderContext
): Response {
  return response(renderFrontendBoundaryPage({ title, message, kind }, context), status);
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
  session: Pick<LocalFrontendPreviewSession, "authorizes">,
  options: ProtectedFrontendPreviewOptions = {}
) {
  const root = options.root ?? previewRoot;
  const context = options.context ?? (root === "/draft-preview" ? draftPreviewRenderContext : previewRenderContext);
  const alternates = createAlternateArchiveHandlers(repository, context);
  const church = createChurchSiteHandler(repository, context, options.church ?? {});
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    if (url.pathname !== root && !url.pathname.startsWith(`${root}/`)) return null;
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
        root === "/draft-preview"
          ? "Start an authorized draft-preview session before viewing pending records."
          : "Open the local administration dashboard first, then use its Frontend preview link.",
        "private",
        context
      );
    }
    const alternate = await alternates(request);
    if (alternate) return alternate;
    const churchPage = await church(request);
    if (churchPage) return churchPage;
    if (
      url.pathname === root
      || Boolean(new RegExp(`^${root}/sermons/([^/]+)$`, 'u').exec(url.pathname)?.[1]
        && validateLegacySlug(new RegExp(`^${root}/sermons/([^/]+)$`, 'u').exec(url.pathname)![1]))
      || new RegExp(`^${root}/(?:sermons(?:/page/\\d+|/[a-z0-9]+(?:-[a-z0-9]+)*)?|(?:speakers|series|books)(?:/[a-z0-9]+(?:-[a-z0-9]+)*)?)$`, "u").test(url.pathname)
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
      const relativePath = url.pathname.slice(root.length);
      const archivePageMatch = /^\/sermons\/page\/(\d+)\/$/u.exec(relativePath);
      if (relativePath === "/sermons/" || archivePageMatch) {
        const page = archivePageMatch ? Number(archivePageMatch[1]) : 1;
        if (!Number.isSafeInteger(page) || page < 1) {
          return boundary(404, "Page not found", "That sermon archive page does not exist.", "not-found", context);
        }
        const loaded = await loadArchivePage(repository, url.searchParams, page);
        if (loaded.kind === "not-found") {
          return boundary(404, "Page not found", "That sermon archive page does not exist.", "not-found", context);
        }
        return response(renderPublicSermonArchivePage(loaded.input, context));
      }

      const rawDetailMatch = /^\/sermons\/([^/]+)\/$/u.exec(relativePath);
      const detailMatch = rawDetailMatch && validateLegacySlug(rawDetailMatch[1]) ? rawDetailMatch : null;
      if (detailMatch) {
        const [sermon, options] = await Promise.all([
          repository.findPublishedBySlug(validateLegacySlug(detailMatch[1])!),
          repository.listPublishedFilterOptions()
        ]);
        if (!sermon) {
          return boundary(404, "Sermon not available", "This sermon is not eligible for the private frontend preview.", "private", context);
        }
        return response(renderPublicSermonPage(sermon, context, { options }));
      }

      const taxonomyIndexMatch = /^\/(speakers|series|books)\/$/u.exec(relativePath);
      if (taxonomyIndexMatch) {
        const kind = taxonomyIndexMatch[1] as FrontendTaxonomyKind;
        const options = await repository.listPublishedFilterOptions();
        return response(renderFrontendTaxonomyIndex(kind, taxonomyOptions(options, kind), context, options));
      }

      const taxonomyDetailMatch = /^\/(speakers|series|books)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u.exec(relativePath);
      if (taxonomyDetailMatch) {
        const kind = taxonomyDetailMatch[1] as FrontendTaxonomyKind;
        const slug = taxonomyDetailMatch[2]!;
        const options = await repository.listPublishedFilterOptions();
        const option = taxonomyOptions(options, kind).find((candidate) => candidate.slug === slug);
        if (!option) return boundary(404, "Page not found", "That sermon classification is not available.", "not-found", context);
        const sermons = await repository.listPublished(taxonomyQuery(kind, slug));
        return response(renderFrontendTaxonomyDetail({ kind, option, sermons: sermons.data, totalItems: sermons.totalItems, options }, context));
      }

      return boundary(404, "Page not found", "The requested frontend preview page does not exist.", "not-found", context);
    } catch (error) {
      if (error instanceof ZodError || error instanceof InvalidLegacySermonQueryError) {
        return boundary(400, "Check the sermon filters", "One or more filter values are invalid.", "error", context);
      }
      return boundary(500, "Preview temporarily unavailable", "The private frontend preview could not be loaded.", "error", context);
    }
  };
}

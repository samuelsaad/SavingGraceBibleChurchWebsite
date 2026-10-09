/**
 * Public sermon site handler: routing, redirects, the sermon sitemap and
 * error mapping. Rendering lives in the framework-independent src/frontend
 * package; this module re-exports its render functions for existing callers.
 */
import { ZodError } from "zod";
import {publicSermonListQuerySchema} from "../../api/contracts/public-sermons";
import {validateLegacySlug} from '../../domain/slug';
import { InvalidLegacySermonQueryError } from "../../api/legacy-sermon-query";
import {
  archivePath,
  publicRenderContext,
  renderFrontendBoundaryPage,
  renderPublicSermonArchivePage,
  renderPublicSermonPage
} from "../../frontend";
import { renderSeoSitemap } from "../../seo/http-sitemap";
import { renderSermonsV5Page } from "../../frontend/pages/sermons-v5";
import { sermonPath } from "../../frontend/routes";
import { archiveRoute, withHead, normalizedLegacyTermSearch } from "./http-routing";
import type { PublicSermonRepository } from "../repositories/sermon-repository";
import { createAlternateArchiveHandlers } from "./alternate-archives";
import { createChurchSiteHandler, type ChurchSiteOptions } from "./church-site";
import { loadArchivePage } from "./frontend-archive-loader";
import { frontendResponse, plainResponseHeaders } from "./frontend-response";
import type { FrontendRenderContext } from "../../frontend/routes";

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

function redirect(status: 301, location: string): Response {
  return new Response(null, { status, headers: { ...plainResponseHeaders, Location: location } });
}

export function createPublicSermonSiteHandler(repository: PublicSermonRepository, context: FrontendRenderContext = publicRenderContext, churchOptions: ChurchSiteOptions = {}): (request:Request)=>Promise<Response|null> {
  if(churchOptions.content){const {content,...rest}=churchOptions;return async request=>createPublicSermonSiteHandler(repository,{...context,siteContent:await content()},rest)(request);}
  const privatePreview = context.mode !== "public";
  function errorPage(status: 400 | 404 | 410 | 500, title: string, message: string): Response {
    return frontendResponse(renderFrontendBoundaryPage({ title, message }, context), { status, privatePreview });
  }
  const alternates = createAlternateArchiveHandlers(repository, context);
  const church = createChurchSiteHandler(repository, context, churchOptions);
  return withHead(async (request: Request): Promise<Response | null> => {
    const alternate = await alternates(request);
    if (alternate) return alternate;
    const churchPage = await church(request);
    if (churchPage) return churchPage;
    const url = new URL(request.url);
    const archive = archiveRoute(url.pathname, archivePath);
    const detailMatch = /^\/sermons\/([^/]+)\/?$/u.exec(url.pathname);
    const slug = detailMatch ? validateLegacySlug(detailMatch[1]) : null;
    const isSitemap = url.pathname === "/sitemap-sermons.xml";
    if (!archive && !slug && !isSitemap && !url.pathname.startsWith("/sermons/")) return null;
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: { ...plainResponseHeaders, "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" } });
    }
    try {
      if (isSitemap) {
        if (privatePreview || context.seo?.indexable === false) return errorPage(404,"Page not found","The requested page does not exist.");
        const [entries,archive]=await Promise.all([repository.listPublishedSitemapEntries(),repository.listPublished(publicSermonListQuerySchema.parse({page:1,pageSize:1}))]);
        return new Response(renderSeoSitemap(entries,context,true,[],archive.totalItems), {
          status: 200, headers: { ...plainResponseHeaders, "Content-Type": "application/xml; charset=utf-8" }
        });
      }
      if (archive) {
        const normalizedSearch=normalizedLegacyTermSearch(url.search);
        if (url.pathname !== archive.path || url.search !== normalizedSearch) return redirect(301, `${archive.path}${normalizedSearch}`);
        const loaded = await loadArchivePage(repository, url.searchParams, archive.page > 1 ? archive.page : null, {includeDirectoryOptions:context.mode==="public"});
        if (loaded.kind === "not-found") return errorPage(404,"Page not found","That sermon archive page does not exist.");
        return frontendResponse(context.mode === "public"
          ? renderSermonsV5Page(loaded.input,context,{canonical:true})
          : renderPublicSermonArchivePage(loaded.input,context), {privatePreview});
      }
      if (slug) {
        const path = sermonPath(publicRenderContext,slug);
        const sermon = await repository.findPublishedBySlug(slug);
        if (sermon) {
          if (url.pathname !== path) return redirect(301,`${path}${url.search}`);
          const options = await repository.listPublishedFilterOptions();
          return frontendResponse(renderPublicSermonPage(sermon,context,{options}),{privatePreview});
        }
        const disposition = await repository.findPublicPathDisposition(path);
        if (disposition?.kind === "redirect") return redirect(301, `${disposition.location}${url.search}`);
        if (disposition?.kind === "gone") return errorPage(410,"Sermon no longer available","This sermon has been permanently removed.");
        return errorPage(404,"Sermon not found","The requested sermon is not publicly available.");
      }
      return errorPage(404,"Page not found","The requested sermon page does not exist.");
    } catch (error) {
      if (error instanceof ZodError || error instanceof InvalidLegacySermonQueryError) return errorPage(400,"Check the sermon filters","One or more filter values are invalid.");
      return errorPage(500,"Sermons temporarily unavailable","Please try again later.");
    }
  });
}
export const createPublicSermonPageHandler = createPublicSermonSiteHandler;

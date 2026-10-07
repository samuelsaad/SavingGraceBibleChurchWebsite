import type { PublicSermonRepository } from "../server/repositories/sermon-repository";
import { createPublicApiRouter } from "../server/http/public-api-router";
import { createPublicSermonSiteHandler, frontendResponse } from "../server/http/public-sermon-page";
import { restrictedRenderContext } from "../frontend/routes";
import { renderFrontendTaxonomyIndex, type FrontendTaxonomyKind } from "../frontend";
import { siteAssetResponse } from "../server/http/site-assets";

export const sealedHeaders = {
  "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY"
};
function plain(code: string, status: number) {
  return new Response(code, { status, headers: { ...sealedHeaders,
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" } });
}
export function createSealedStagingHandler(repository: PublicSermonRepository, ready: () => Promise<void>, commit: string, frontendDisabled = false, evaluation?:(request:Request)=>Promise<Response|null>) {
  const publicApi = createPublicApiRouter(repository);
  const publicPages = createPublicSermonSiteHandler(repository, restrictedRenderContext);
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const path = decodeURIComponent(url.pathname);
      if (/^\/(?:admin|frontend-preview|__local)(?:\/|$)/.test(path)
        || /^\/api\/v1\/admin(?:\/|$)/.test(path)) return plain("staging_authentication_not_configured", 401);
      if (request.method !== "GET" && request.method !== "HEAD") return plain("method_not_allowed", 405);
      if (path === "/health/ready") {
        await ready();
        return new Response(JSON.stringify({ status: "ready", release: commit, authentication: "private_routes_disabled" }),
          { headers: { ...sealedHeaders, "Content-Type": "application/json" } });
      }
      if (path === "/robots.txt") return plain("User-agent: *\nDisallow: /\n", 200);
      // History-preserving application recovery: no database rollback or identity
      // bypass. Health and deny-by-default private routes remain available.
      if (frontendDisabled) return plain("restricted_frontend_temporarily_disabled", 503);
      if(path.startsWith('/related-themes-evaluation')){
        const preview=await evaluation?.(request);if(!preview)return plain('not_found',404);
        const headers=new Headers(preview.headers);for(const [key,value] of Object.entries(sealedHeaders))headers.set(key,value);
        return new Response(request.method==='HEAD'?null:preview.body,{status:preview.status,headers});
      }
      let response: Response | null = siteAssetResponse(request);
      if (response) {
        // The church logo, icons and images: embedded bytes, no filesystem, no database.
      } else if (/^\/(speakers|series|books)\/$/.test(path)) {
        const kind = path.split('/')[1] as FrontendTaxonomyKind;
        const options = await repository.listPublishedFilterOptions();
        response = frontendResponse(renderFrontendTaxonomyIndex(kind, options[kind], restrictedRenderContext, options));
      } else if (/^\/(speakers|series|books)$/.test(path)) {
        response = new Response(null, {status:307, headers:{Location:`${path}/${url.search}`}});
      } else response = path.startsWith("/api/") ? await publicApi(request) : await publicPages(request);
      if (!response) return plain("not_found", 404);
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(sealedHeaders)) headers.set(key, value);
      return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers });
    } catch { return plain("staging_unavailable", 503); }
  };
}

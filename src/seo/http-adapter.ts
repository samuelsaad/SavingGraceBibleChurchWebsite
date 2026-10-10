/**
 * Public-only Web HTTP adapter for production or an isolated SEO rehearsal.
 * Dependencies supply eligible content; this module neither opens databases nor
 * mounts admin/preview APIs. The existing sealed staging server is independent.
 */
import {legacyDisposition,pageByPath,pageAvailable} from "../frontend/content/registry";
import { renderFrontendBoundaryPage } from "../frontend/pages/boundary";
import type { FrontendRenderContext } from "../frontend/routes";
import { createPublicSermonSiteHandler } from "../server/http/public-sermon-page";
import type { ChurchSiteOptions } from "../server/http/church-site";
import { frontendResponse } from "../server/http/frontend-response";
import type { PublicSermonRepository } from "../server/repositories/sermon-repository";
import { createSeoHttpPolicy, type SeoHttpPolicyInput } from "./http-policy";

export interface SeoHttpAdapterOptions extends ChurchSiteOptions {
  policy: SeoHttpPolicyInput;
  /** Exact observed canonical archive query paths; supplied from verified source records. */
  indexableArchivePaths?: readonly string[];
  sermons: PublicSermonRepository;
  /** Proven source IDs mapped to active canonical paths; never inferred from GUIDs. */
  sourceShortlinks?: Readonly<Record<string,string>>;
  /** Proven attachment IDs whose exact migrated resource bytes are available. */
  sourceAttachmentLinks?: Readonly<Record<string,string>>;
  publicSearch?: (request:Request,context:FrontendRenderContext)=>Promise<Response|null>;
  /** Frozen published-source fallback, after every current CMS route/disposition. */
  sourceQueryPage?: (request:Request,context:FrontendRenderContext)=>Promise<Response|null>;
  sourcePage?: (request:Request,context:FrontendRenderContext)=>Promise<Response|null>;
  sourceDisposition?: (path:string)=>Promise<{kind:"redirect";location:string}|{kind:"gone"}|null>;
  /** Public managed assets only; the dependency must enforce published references. */
  publicAsset?: (request: Request) => Promise<Response | null>;
}
/** Exact captured legacy XML indexes consolidated into the complete sitemap. */
export const legacySitemapPaths=Object.freeze([
 "/category-sitemap.xml","/page-sitemap.xml","/post-archive-sitemap.xml","/post-sitemap.xml","/post_tag-sitemap.xml",
 "/sermon_book-sitemap.xml","/sermon_series-sitemap.xml","/sermon_speaker-sitemap.xml","/sermon_topics-sitemap.xml","/sermons-sitemap.xml",
 "/tribe_event_series-sitemap.xml","/tribe_events-sitemap.xml","/tribe_events_cat-sitemap.xml","/tribe_organizer-sitemap.xml","/tribe_venue-sitemap.xml"
]);
const privatePath = /^\/(?:admin(?:\/|$)|api(?:\/|$)|frontend-preview(?:\/|$)|draft-preview(?:\/|$)|cms-preview(?:\/|$)|cms-editor-frame(?:\/|$)|related-themes-evaluation(?:\/|$)|healthz(?:\/|$)|__local(?:\/|$)|__cms(?:\/|$)|health(?:\/|$))/u;
export function createSeoHttpAdapter(options: SeoHttpAdapterOptions): (request: Request) => Promise<Response> {
  const policy = createSeoHttpPolicy(options.policy);
  const context: FrontendRenderContext = {mode: policy.indexable ? "public" : "restricted", basePath:"", seo:{canonicalOrigin:policy.canonicalOrigin,indexable:policy.indexable,indexableArchivePaths:options.indexableArchivePaths??[]}};
  const site = createPublicSermonSiteHandler(options.sermons, context, {
    ...(options.today ? {today:options.today} : {}),
    ...(options.content ? {content:options.content} : {}),
    ...(options.sourceSitemap ? {sourceSitemap:options.sourceSitemap} : {})
  });
  function boundary(status: number, title: string): Response {
    return frontendResponse(renderFrontendBoundaryPage({title,message:"The requested page is unavailable."},context),{status});
  }
  function finish(response: Response, head: boolean): Response {
    const headers = new Headers(response.headers);
    if (!policy.indexable || response.status >= 400) headers.set("X-Robots-Tag","noindex, nofollow, noarchive");
    if (!policy.indexable) headers.set("Cache-Control","private, no-store, max-age=0");
    return new Response(head ? null : response.body,{status:response.status,headers});
  }
  return async request => {
    const head = request.method === "HEAD";
    try {
      const url = new URL(request.url);
      if (!policy.acceptedOrigins.includes(url.origin)) return finish(boundary(421,"Unrecognized site origin"),head);
      // Request URLs are the adapter boundary. Forwarded headers never select a
      // different site, canonical origin or indexability policy.
      let decodedPath: string;
      try { decodedPath=decodeURIComponent(url.pathname); } catch { return finish(boundary(400,"Invalid page address"),head); }
      if (privatePath.test(decodedPath)) return finish(boundary(404,"Page not found"),head);
      if (request.method !== "GET" && !head) return finish(new Response("Method not allowed",{status:405,headers:{Allow:"GET, HEAD","Cache-Control":"no-store"}}),false);
      if (/%(?:2f|5c|00|0[ad])/iu.test(url.pathname) || url.pathname.includes("\\")) return finish(boundary(400,"Invalid page address"),head);
      let response: Response;
      const resource=await options.publicAsset?.(head?new Request(request,{method:"GET"}):request); 
      const observedQuery=url.search&&options.sourceQueryPage?await options.sourceQueryPage(head?new Request(request,{method:'GET'}):request,{...context,...(options.content?{siteContent:await options.content()}:{})}):null;
      const search=options.publicSearch?await options.publicSearch(head?new Request(request,{method:'GET'}):request,{...context,...(options.content?{siteContent:await options.content()}:{})}):null;
      if(resource){response=resource;}else if(search){response=search;}else if(observedQuery){response=observedQuery;}else if(legacySitemapPaths.includes(url.pathname)) {
        response=policy.indexable?new Response(null,{status:301,headers:{Location:"/sitemap.xml"+url.search,"Cache-Control":"no-store"}}):boundary(404,"Page not found");
      } else if (url.pathname === "/" && (url.searchParams.has("p") || url.searchParams.has("page_id") || url.searchParams.has("attachment_id"))) {
        const entries=[...url.searchParams].filter(([key])=>["p","page_id","attachment_id"].includes(key));
        const ambiguous=["s","search","preview","action","post_type","page"].some(key=>url.searchParams.has(key));
        const value=entries.length===1&&!ambiguous ? entries[0]![1] : "";
        const retained=url.search.slice(1).split("&").filter(part=>!["p","page_id","attachment_id"].includes([...new URLSearchParams(part).keys()][0]??"" )).join("&");
        const path=/^[1-9][0-9]*$/u.test(value) ? (entries[0]?.[0]==="attachment_id"?options.sourceAttachmentLinks?.[value]:options.sourceShortlinks?.[value]) : undefined;
        if(!path) response=boundary(404,"Page not found");
        else {
          const target=new URL(path,policy.canonicalOrigin);
          if(!path.startsWith("/") || path.startsWith("//") || target.origin!==policy.canonicalOrigin || target.pathname+target.search!==path || target.hash || path.includes("\\") || /%(?:2f|5c|00|0[ad])/iu.test(path) || privatePath.test(decodeURIComponent(target.pathname))) throw new Error("seo_shortlink_target_refused");
          response=new Response(null,{status:301,headers:{Location:path+(retained?(target.search?"&":"?")+retained:""),"Cache-Control":"no-store"}});
        }
      } else if (url.pathname === "/robots.txt") {
        response = new Response(policy.indexable
          ? `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /frontend-preview/\nDisallow: /draft-preview/\nDisallow: /cms-preview/\nSitemap: ${policy.canonicalOrigin}/sitemap.xml\n`
          : "User-agent: *\nDisallow: /\n", {headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
      } else if ((url.pathname==='/'||/^\/(?:events?|venues?|organisers?)(?:\/|$)/u.test(decodedPath))&&[...url.searchParams.keys()].some(key=>['post_type','pagename','eventDisplay','paged','page','related_series','tribe_events_cat','tribe_organizer','tribe_venue','tribe-bar-date','ical','outlook-ical',...(url.pathname==='/'?['s','attachment_id','feed','rest_route']:[])].includes(key))) {
        // Exact captured query pages/resources already won above. A missing
        // meaningful legacy query must never return an unrelated collection/homepage.
        response=boundary(404,"Page not found");
      } else {
        const get = head ? new Request(request,{method:"GET"}) : request;
        let selectedSourceContext:Promise<FrontendRenderContext>|undefined;
        const sourceContext=()=>selectedSourceContext??=(async()=>{const snapshot=await options.content?.();return snapshot?{...context,siteContent:snapshot}:context;})();
        const current = await options.publicAsset?.(get) ?? await site(get);
        if (current) {
          response=current;
          // Native collection handlers may return404 for a verified historical
          // child route. Explicit editorial ownership always takes precedence.
          if(current.status===404 && options.sourcePage && !/^\/sermons(?:\/|$)/u.test(url.pathname)){
            const currentContext=await sourceContext();
            const editorial=currentContext.siteContent?.routes.some(route=>route.path===url.pathname);
            const known=pageByPath(url.pathname,currentContext);
            if(!editorial && !legacyDisposition(url.pathname,currentContext) && (!known || pageAvailable(known,currentContext))) {
              const source=await options.sourcePage(get,currentContext);
              if(source)response=source;
            }
          }
        }
        else {
          const disposition=await options.sourceDisposition?.(url.pathname);
          response=disposition?.kind==="gone" ? boundary(410,"Page no longer available")
            : disposition?.kind==="redirect" ? new Response(null,{status:301,headers:{Location:disposition.location+url.search,"Cache-Control":"no-store"}})
            : await options.sourcePage?.(get,await sourceContext()) ?? boundary(404,"Page not found");
        }
      }
      // Calendar export/filter HTML duplicates and empty legacy taxonomy forms
      // retain their visible page, but must not create indexable query variants.
      const calendarDerivative=/^\/(?:events?|venues?|organisers?)(?:\/|$)/u.test(decodedPath)
        && [...url.searchParams.keys()].some(key=>['ical','outlook-ical','eventDisplay','tribe-bar-date','related_series'].includes(key));
      const emptyTaxonomy=url.pathname==='/' && url.searchParams.has('taxonomy') && url.searchParams.has('term')
        && [...url.searchParams].filter(([key])=>['taxonomy','term'].includes(key)).every(([,value])=>value==='');
      if(policy.indexable && response.status===200 && (calendarDerivative||emptyTaxonomy)
        && response.headers.get('Content-Type')?.toLowerCase().includes('text/html'))response.headers.set('X-Robots-Tag','noindex, follow');
      const location = response.headers.get("Location");
      if (location) {
        const target = new URL(location, policy.canonicalOrigin);
        if (target.origin !== policy.canonicalOrigin || !location.startsWith("/") || location.startsWith("//")) throw new Error("seo_redirect_target_refused");
        // A host/scheme move and a path move form one permanent redirect.
        if (policy.indexable && url.origin !== policy.canonicalOrigin) response.headers.set("Location",target.href);
      } else if (policy.indexable && url.origin !== policy.canonicalOrigin && response.status === 200) {
        response = new Response(null,{status:301,headers:{Location:policy.canonicalOrigin + url.pathname + url.search,"Cache-Control":"no-store"}});
      }
      return finish(response,head);
    } catch { return finish(boundary(503,"Site temporarily unavailable"),head); }
  };
}

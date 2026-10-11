/**
 * The church website's own routes: the homepage, the content pages, the
 * events calendar and its iCalendar feed, the blog, the sitemap page, the
 * embedded images, and the legacy WordPress addresses (a direct 301 to the
 * page that now holds the same content, or 410 for retired theme sample
 * content). Sermon routes stay with the sermon handlers.
 *
 * The handler reuses the caller's eligible repository and render context:
 * the public site and the sealed visitor runtime show only what WordPress
 * had published, the authenticated preview also shows drafts and the
 * private page. Every response is server-rendered; nothing here mutates.
 */
import type { FrontendSiteSnapshot } from "../../frontend/content/site-snapshot";
import type { Block } from "../../frontend/content/types";
import type { CmsHomeBlock } from "../../cms/model";
import type { SermonSummary } from "../../domain/sermon";
import { renderSeoSitemap, type SitemapUrl } from "../../seo/http-sitemap";
import { withHead } from "./http-routing";
import { ZodError } from "zod";
import { publicSermonListQuerySchema } from "../../api/contracts/public-sermons";
import { InvalidLegacySermonQueryError } from "../../api/legacy-sermon-query";
import { eventBySlug, eventsPath, melbourneToday } from "../../frontend/content/events";
import { legacyDisposition, pageAvailable, pageByPath, postByPath } from "../../frontend/content/registry";
import { renderFrontendBoundaryPage } from "../../frontend/pages/boundary";
import {
  renderBlogIndex,
  renderBlogPost,
  renderCalendarFeed,
  renderChurchPage,
  renderEventPage,
  renderEventsPage,
  renderSitemapPage,
  type ChurchPageData
} from "../../frontend/pages/church";
import { renderFrontendHomePage } from "../../frontend/pages/home";
import { contextualPath, type FrontendRenderContext } from "../../frontend/routes";
import type { PublicSermonRepository } from "../repositories/sermon-repository";
import { frontendResponse, plainResponseHeaders } from "./frontend-response";
import { siteAssetResponse } from "./site-assets";

export interface ChurchSiteOptions {
  /** Today's Melbourne date; defaults to the clock. Tests pass a fixed date. */
  today?: () => string;
  /** Fresh published or selected-revision snapshot, loaded once per request. */
  content?: () => Promise<FrontendSiteSnapshot>;
  /** Additional proven source-public routes; current CMS routes retain precedence. */
  sourceSitemap?: () => Promise<readonly SitemapUrl[]>;
}

const calendarPath = `${eventsPath}calendar.ics`;

export function createChurchSiteHandler(repository: PublicSermonRepository, context: FrontendRenderContext, options: ChurchSiteOptions = {}): (request:Request)=>Promise<Response|null> {
  if(options.content){const {content,...rest}=options;return async request=>createChurchSiteHandler(repository,{...context,siteContent:await content()},rest)(request);}
  const base = context.basePath;
  const privatePreview = context.mode !== "public";
  const robots = privatePreview ? { "X-Robots-Tag": "noindex, nofollow, noarchive" } : {};
  const redirectStatus = context.mode === "preview" || context.mode === "draft-preview" ? 307 : 301;
  const today = options.today ?? (() => melbourneToday());

  function page(html: string, status = 200): Response {
    return frontendResponse(html, { status, privatePreview, headers: robots });
  }
  function boundary(status: 404 | 410 | 500, title: string, message: string, kind: "not-found" | "private" | "error" = "not-found"): Response {
    return page(renderFrontendBoundaryPage({ title, message, kind }, context), status);
  }
  function redirect(location: string): Response {
    return new Response(null, { status: redirectStatus, headers: { ...plainResponseHeaders, ...robots, Location: location } });
  }

  async function data(path:string): Promise<ChurchPageData> {
    const [sermons, options] = await Promise.all([
      repository.listPublished(publicSermonListQuerySchema.parse({ page: 1, pageSize: 6, order: "DESC" })),
      repository.listPublishedFilterOptions()
    ]);
    const sourcePage=pageByPath(path,context),sourcePost=postByPath(path,context);
    const configs:Array<{id:string|undefined;block:Block|CmsHomeBlock}>=path==="/" ? context.siteContent?.home?.modules.filter(module=>module.enabled).map(module=>({id:module.id,block:module.block})) ?? [] : [...(sourcePage?.blocks ?? sourcePost?.blocks ?? []),...(sourcePage?.aside ?? [])].map(block=>({id:(block as {cmsInstanceId?:string}).cmsInstanceId,block}));
    const selections:Record<string,SermonSummary[]>={};
    const nested:typeof configs=[];
    const visit=(module:typeof configs[number])=>{nested.push(module);if(module.block.kind==="panel")module.block.blocks.forEach((child,index)=>visit({id:module.id?`${module.id}-child-${index+1}`:undefined,block:child}));};
    configs.forEach(visit);
    for(const module of nested){
      if(!["home-sermons","sermon-cards"].includes(module.block.kind) || !module.id)continue;
      const config=module.block as Extract<CmsHomeBlock,{kind:"home-sermons"}>;
      const block={limit:config.limit??3,order:config.order??"DESC",sermonIds:config.sermonIds??[]};
      if(!block.sermonIds.length){selections[module.id]=(await repository.listPublished(publicSermonListQuerySchema.parse({page:1,pageSize:block.limit,order:block.order}))).data;continue;}
      const wanted=new Set(block.sermonIds),found=new Map<string,SermonSummary>();
      let pageNumber=1;
      while(wanted.size){
        const eligible=await repository.listPublished(publicSermonListQuerySchema.parse({page:pageNumber,pageSize:50,order:block.order}));
        for(const sermon of eligible.data)if(wanted.delete(sermon.id))found.set(sermon.id,sermon);
        if(pageNumber*50>=eligible.totalItems || !eligible.data.length)break;
        pageNumber+=1;
      }
      selections[module.id]=block.sermonIds.flatMap(id=>found.get(id)??[]).slice(0,block.limit);
    }
    return { today: today(), sermons: sermons.data, options, sermonSelections:selections };
  }

  return withHead(async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    const asset = siteAssetResponse(request);
    if (asset) return asset;
    if (base && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return null;
    const relative = base ? url.pathname.slice(base.length) || "/" : url.pathname;
    if (relative.startsWith("/sermons") || /^\/(?:speakers|series|books)\/(?:[a-z0-9-]+\/)?$/u.test(relative) && context.mode !== "public" && context.mode !== "restricted") return null;
    if (relative.startsWith("/api/") || relative.startsWith("/admin") || relative.startsWith("/__local")) return null;

    const isChurchRoute = relative === "/" || relative === "/sitemap.xml" || Boolean(context.siteContent?.routes.some(route=>route.path===relative)) || Boolean(pageByPath(relative, context) ?? postByPath(relative, context)) || relative.startsWith(eventsPath)
      || Boolean(legacyDisposition(relative, context)) || slashlessTarget(relative, context) !== null;
    if (!isChurchRoute) return null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { ...plainResponseHeaders, ...robots, "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" } });
    }

    try {
      const slashless = slashlessTarget(relative, context);
      if (slashless) {
        const disposition=legacyDisposition(slashless,context);
        if(disposition?.kind==="gone")return boundary(410,"Page no longer available","This page has been permanently removed.");
        if(disposition?.kind==="unavailable")return boundary(404,"Page not found","The requested page is not publicly available.","private");
        return redirect(`${contextualPath(context,disposition?.kind==="redirect"?disposition.location:slashless)}${url.search}`);
      }
      if(relative==="/sitemap.xml"){
        if(context.mode!=="public" || context.seo?.indexable===false)return boundary(404,"Page not found","The requested page does not exist.");
        const [sermons,source,archive]=await Promise.all([repository.listPublishedSitemapEntries(),options.sourceSitemap?.()??Promise.resolve([]),repository.listPublished(publicSermonListQuerySchema.parse({page:1,pageSize:1}))]);
        const xml=renderSeoSitemap(sermons,context,false,source,archive.totalItems);
        return new Response(xml,{headers:{...plainResponseHeaders,"Content-Type":"application/xml; charset=utf-8"}});
      }
      const disposition = legacyDisposition(relative, context);
      if (disposition?.kind === "redirect") return redirect(`${contextualPath(context, disposition.location)}${url.search}`);
      if (disposition?.kind === "gone") return boundary(410, "Page no longer available", "This page has been permanently removed.");
      if (disposition?.kind === "unavailable") return boundary(404, "Page not found", "The requested page is not publicly available.", "private");

      if (relative === "/") {
        if(context.siteContent && !context.siteContent.home)return boundary(404,"Page not found","The requested page is not published.");
        const pageData=await data(relative);
        return page(renderFrontendHomePage({...pageData,totalItems:pageData.sermons.length}, context));
      }

      if (relative === calendarPath) {
        return new Response(renderCalendarFeed(context), { status: 200, headers: { ...plainResponseHeaders, ...robots, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "inline; filename=\"saving-grace-bible-church-events.ics\"" } });
      }

      const eventMatch = /^\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u.exec(relative);
      const exactEvent=context.siteContent?.events.find(event=>event.path===relative);
      if (exactEvent || eventMatch&&!pageByPath(relative,context)) {
        const event = exactEvent ?? eventBySlug(eventMatch![1]!, context.siteContent?.events);
        if (!event) return boundary(404, "Event not found", "That event does not exist.");
        return page(renderEventPage(event, await data(relative), context));
      }

      const post = postByPath(relative, context);
      if (post) return page(renderBlogPost(post, await data(relative), context));

      const sitePage = pageByPath(relative, context);
      if (sitePage) {
        if (!pageAvailable(sitePage, context)) {
          return boundary(404, "Page not found", "The requested page is not publicly available.", "private");
        }
        const pageData = await data(relative);
        switch (sitePage.id) {
          case "events": return page(renderEventsPage(sitePage, pageData, context));
          case "blogs": return page(renderBlogIndex(sitePage, pageData, context));
          case "sitemap": return page(renderSitemapPage(sitePage, pageData, context));
          default: return page(renderChurchPage(sitePage, pageData, context));
        }
      }
      return boundary(404, "Page not found", "The requested page does not exist.");
    } catch (error) {
      if (error instanceof ZodError || error instanceof InvalidLegacySermonQueryError) {
        return boundary(404, "Page not found", "The requested page does not exist.");
      }
      return boundary(500, "Page temporarily unavailable", "Please try again later.", "error");
    }
  });
}

/** A church route requested without its trailing slash, or null. */
function slashlessTarget(relative: string, context:FrontendRenderContext): string | null {
  if (relative === "" || relative.endsWith("/")) return null;
  const candidate = `${relative}/`;
  if (context.siteContent?.routes.some(route=>route.path===candidate)||legacyDisposition(candidate,context)||pageByPath(candidate, context) || postByPath(candidate, context) || (candidate.startsWith(eventsPath) && (candidate === eventsPath || eventBySlug(candidate.slice(eventsPath.length, -1), context.siteContent?.events) !== null))) return candidate;
  return null;
}

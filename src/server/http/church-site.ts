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
}

const calendarPath = `${eventsPath}calendar.ics`;

export function createChurchSiteHandler(repository: PublicSermonRepository, context: FrontendRenderContext, options: ChurchSiteOptions = {}) {
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

  async function data(): Promise<ChurchPageData> {
    const [sermons, options] = await Promise.all([
      repository.listPublished(publicSermonListQuerySchema.parse({ page: 1, pageSize: 6, order: "DESC" })),
      repository.listPublishedFilterOptions()
    ]);
    return { today: today(), sermons: sermons.data, options };
  }

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    const asset = siteAssetResponse(request);
    if (asset) return asset;
    if (base && url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return null;
    const relative = base ? url.pathname.slice(base.length) || "/" : url.pathname;
    if (relative.startsWith("/sermons") || /^\/(?:speakers|series|books)\/(?:[a-z0-9-]+\/)?$/u.test(relative) && context.mode !== "public" && context.mode !== "restricted") return null;
    if (relative.startsWith("/api/") || relative.startsWith("/admin") || relative.startsWith("/__local")) return null;

    const isChurchRoute = relative === "/" || Boolean(pageByPath(relative) ?? postByPath(relative)) || relative.startsWith(eventsPath)
      || Boolean(legacyDisposition(relative, context)) || slashlessTarget(relative) !== null;
    if (!isChurchRoute) return null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { ...plainResponseHeaders, ...robots, "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" } });
    }

    try {
      const slashless = slashlessTarget(relative);
      if (slashless) return redirect(`${contextualPath(context, slashless)}${url.search}`);

      const disposition = legacyDisposition(relative, context);
      if (disposition?.kind === "redirect") return redirect(`${contextualPath(context, disposition.location)}${url.search}`);
      if (disposition?.kind === "gone") return boundary(410, "Page no longer available", "This page has been permanently removed.");
      if (disposition?.kind === "unavailable") return boundary(404, "Page not found", "The requested page is not publicly available.", "private");

      if (relative === "/") {
        const [sermons, options] = await Promise.all([
          repository.listPublished(publicSermonListQuerySchema.parse({ page: 1, pageSize: 6, order: "DESC" })),
          repository.listPublishedFilterOptions()
        ]);
        return page(renderFrontendHomePage({ sermons: sermons.data, options, totalItems: sermons.totalItems, today: today() }, context));
      }

      if (relative === calendarPath) {
        return new Response(renderCalendarFeed(), { status: 200, headers: { ...plainResponseHeaders, ...robots, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "inline; filename=\"saving-grace-bible-church-events.ics\"" } });
      }

      const eventMatch = /^\/events\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/u.exec(relative);
      if (eventMatch) {
        const event = eventBySlug(eventMatch[1]!);
        if (!event) return boundary(404, "Event not found", "That event does not exist.");
        return page(renderEventPage(event, await data(), context));
      }

      const post = postByPath(relative);
      if (post) return page(renderBlogPost(post, await data(), context));

      const sitePage = pageByPath(relative);
      if (sitePage) {
        if (!pageAvailable(sitePage, context)) {
          return boundary(404, "Page not found", "The requested page is not publicly available.", "private");
        }
        const pageData = await data();
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
  };
}

/** A church route requested without its trailing slash, or null. */
function slashlessTarget(relative: string): string | null {
  if (relative === "" || relative.endsWith("/")) return null;
  const candidate = `${relative}/`;
  if (pageByPath(candidate) || postByPath(candidate) || (candidate.startsWith(eventsPath) && (candidate === eventsPath || eventBySlug(candidate.slice(eventsPath.length, -1)) !== null))) return candidate;
  return null;
}

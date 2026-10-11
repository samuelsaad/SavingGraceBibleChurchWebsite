/**
 * Lookups over the church content registry: pages by path or id, what each
 * render context may show, the legacy WordPress paths and their
 * dispositions (a direct redirect, or gone), the breadcrumb trail and the
 * sitemap groups. The registry itself is data in ./pages.
 */
import type { FrontendRenderContext } from "../routes";
import { events, eventsPath, type ChurchEvent, venues } from "./events";
import { blogPosts, churchPages } from "./pages";
import type { BlogPost, SitePage, SiteSection } from "./types";

export { blogPosts, churchPages };

const pagesById = new Map(churchPages.map((page) => [page.id, page]));
const pagesByPath = new Map(churchPages.map((page) => [page.path, page]));

export function pagesFor(context?: FrontendRenderContext): readonly SitePage[] { return context?.siteContent?.pages ?? churchPages; }
export function postsFor(context?: FrontendRenderContext): readonly BlogPost[] { return context?.siteContent?.posts ?? blogPosts; }

export function pageById(id: string, context?: FrontendRenderContext): SitePage {
  const page = context?.siteContent ? context.siteContent.pages.find(page=>page.id===id) : pagesById.get(id);
  if (!page) throw new Error(`unknown page ${id}`);
  return page;
}

export function pageByPath(path: string, context?: FrontendRenderContext): SitePage | null {
  return (context?.siteContent ? context.siteContent.pages.find(page=>page.path===path) : pagesByPath.get(path)) ?? null;
}

export function postByPath(path: string, context?: FrontendRenderContext): BlogPost | null {
  return postsFor(context).find((post) => post.path === path) ?? null;
}

/**
 * Publication states are honoured per context: the public site and the
 * sealed visitor runtime show only what WordPress had published; the
 * authenticated administrator preview also shows drafts and the private
 * page, each labelled as such.
 */
export function pageAvailable(page: SitePage, context: FrontendRenderContext): boolean {
  if (page.status === "published") return true;
  return context.mode === "preview";
}

export function availablePages(context: FrontendRenderContext): SitePage[] {
  return pagesFor(context).filter((page) => pageAvailable(page, context));
}

/** Whether a root-relative internal destination resolves to something this context serves. */
export function destinationAvailable(href: string, context: FrontendRenderContext): boolean {
  const path = href.split(/[?#]/u)[0]!;
  if (path === "" || path === "/") return true;
  const disposition = legacyDisposition(path, context);
  if (disposition) return disposition.kind === "redirect";
  const page = pageByPath(path, context);
  if (page) return pageAvailable(page, context);
  if (postByPath(path, context)) return true;
  if (path === `${eventsPath}calendar.ics` || (context.siteContent?.events ?? events).some(event=>event.path===path)) return true;
  if (/^https?:\/\//iu.test(path)) return true;
  if (path.startsWith("/sermons")) return true;
  if (/^\/(?:speakers|series|books)\//u.test(path)) return context.mode !== "public";
  if (path.startsWith("/cms-assets/")) return true;
  return false;
}

export type LegacyDisposition =
  | { kind: "redirect"; location: string; reason: string }
  | { kind: "gone"; reason: string }
  /** The page exists but is not published in this context: answered as not found, never redirected. */
  | { kind: "unavailable"; reason: string };

/**
 * Legacy WordPress paths that have no page of their own. Theme
 * demonstration content that WordPress had published (three sample
 * testimonials) is gone rather than redirected to unrelated pages.
 */
const extraDispositions: ReadonlyMap<string, LegacyDisposition> = new Map<string, LegacyDisposition>([
  ["/testimonials/robert-h-schuller/", { kind: "gone", reason: "Theme sample testimonial (WordPress 4586); no church content." }],
  ["/testimonials/thomas-paine/", { kind: "gone", reason: "Theme sample testimonial (WordPress 4587); no church content." }],
  ["/testimonials/rodney-stratton/", { kind: "gone", reason: "Theme sample testimonial (WordPress 25241); no church content." }],
]);

/** Follow immutable CMS route dispositions so legacy aliases remain a single direct redirect. */
function cmsDisposition(path:string,context:FrontendRenderContext):LegacyDisposition|null {
 const routes=context.siteContent?.routes;if(!routes)return null;
 let target=path;const seen=new Set<string>();
 while(!seen.has(target)){
  seen.add(target);const route=routes.find(item=>item.path===target);
  if(!route)return target===path?null:{kind:"unavailable",reason:"The redirect destination is not published."};
  if(route.status===410)return {kind:"gone",reason:"This content was unpublished with a gone disposition."};
  if(route.status===200)return target===path?null:{kind:"redirect",location:target,reason:"Current published address of this content."};
  if(!route.targetPath)return {kind:"unavailable",reason:"The redirect has no published destination."};
  target=route.targetPath;
 }
 return {kind:"unavailable",reason:"The redirect destination is invalid."};
}

/** The disposition of a legacy path, resolved for a context (drafts stay unreachable publicly). */
export function legacyDisposition(path: string, context: FrontendRenderContext): LegacyDisposition | null {
  const cms=cmsDisposition(path,context);if(cms)return cms;
  for (const page of pagesFor(context)) {
    if (page.legacyPaths.includes(path)) {
      return pageAvailable(page, context)
        ? { kind: "redirect", location: page.path, reason: `Legacy address of ${page.title}.` }
        : { kind: "unavailable", reason: `Legacy address of ${page.title}, which is ${page.status} and not published here.` };
    }
  }
  for (const event of (context.siteContent?.events ?? events) as readonly ChurchEvent[]) {
    if (event.legacyPaths.includes(path)) return { kind: "redirect", location: event.path, reason: `Legacy Events Calendar address of ${event.title}.` };
  }
  const extra=extraDispositions.get(path)??null;
  if(extra?.kind==="redirect"&&context.siteContent){
    const current=cmsDisposition(extra.location,context);if(current)return current;
    if(!context.siteContent.routes.some(route=>route.path===extra.location&&route.status===200))return {kind:"unavailable",reason:"The legacy destination is not published."};
  }
  return extra;
}

/** Every legacy path with a disposition, for the inventory and tests. */
export function legacyPaths(): Array<{ path: string; disposition: LegacyDisposition }> {
  const rows: Array<{ path: string; disposition: LegacyDisposition }> = [];
  for (const page of churchPages) for (const path of page.legacyPaths) rows.push({ path, disposition: { kind: "redirect", location: page.path, reason: `Legacy address of ${page.title}.` } });
  for (const event of events as readonly ChurchEvent[]) for (const path of event.legacyPaths) rows.push({ path, disposition: { kind: "redirect", location: event.path, reason: `Legacy Events Calendar address of ${event.title}.` } });
  for (const [path, disposition] of extraDispositions) rows.push({ path, disposition });
  return rows;
}

export interface TrailItem {
  href: string;
  label: string;
}

/** Home › parent › … for a page (the page itself is the heading, not a link). */
export function breadcrumbs(page: SitePage, context?:FrontendRenderContext): TrailItem[] {
  const trail: TrailItem[] = [];
  const byId = new Map(pagesFor(context).map(item=>[item.id,item]));
  const seen = new Set<string>();
  let current: SitePage | undefined = page.parent ? byId.get(page.parent) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift({ href: current.path, label: current.title });
    current = current.parent ? byId.get(current.parent) : undefined;
  }
  return [{ href: "/", label: "Home" }, ...trail];
}

export const sectionLabels: Readonly<Record<SiteSection, string>> = {
  home: "Home",
  about: "About Us",
  teaching: "What We Teach",
  ministries: "Ministries",
  events: "News & Events",
  resources: "Resources",
  giving: "Give",
  contact: "Contact Us",
  blog: "Blogs",
  sermons: "Sermons"
};

/** Published pages grouped for the sitemap page, in navigation order. */
export function sitemapGroups(context: FrontendRenderContext): Array<{ label: string; pages: SitePage[] }> {
  const order: SiteSection[] = ["about", "teaching", "ministries", "resources", "events", "giving", "contact", "blog", "sermons", "home"];
  return order
    .map((section) => ({ label: sectionLabels[section], pages: availablePages(context).filter((page) => page.section === section && page.id !== "sitemap") }))
    .filter((group) => group.pages.length > 0);
}

export function eventVenue(event: ChurchEvent, context?:FrontendRenderContext) {
  const venue=(context?.siteContent?.venues ?? venues)[event.venue];
  if (!venue) throw new Error("Event venue unavailable");
  return venue;
}

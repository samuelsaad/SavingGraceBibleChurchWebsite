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

export function pageById(id: string): SitePage {
  const page = pagesById.get(id);
  if (!page) throw new Error(`unknown page ${id}`);
  return page;
}

export function pageByPath(path: string): SitePage | null {
  return pagesByPath.get(path) ?? null;
}

export function postByPath(path: string): BlogPost | null {
  return blogPosts.find((post) => post.path === path) ?? null;
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
  return churchPages.filter((page) => pageAvailable(page, context));
}

/** Whether a root-relative internal destination resolves to something this context serves. */
export function destinationAvailable(href: string, context: FrontendRenderContext): boolean {
  const path = href.split("#")[0]!;
  if (path === "" || path === "/") return true;
  const page = pageByPath(path);
  if (page) return pageAvailable(page, context);
  if (postByPath(path)) return true;
  if (path.startsWith(eventsPath)) return true;
  if (path.startsWith("/sermons")) return true;
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
  ["/venue/rye-civic-hall/", { kind: "redirect", location: "/events/sgbc-picnic-rye/", reason: "Events Calendar venue page for the picnic's venue." }],
  ["/venue/state-library/", { kind: "redirect", location: "/events/street-evangelism-outreach/", reason: "Events Calendar venue page for the outreach event's venue." }]
]);

/** The disposition of a legacy path, resolved for a context (drafts stay unreachable publicly). */
export function legacyDisposition(path: string, context: FrontendRenderContext): LegacyDisposition | null {
  for (const page of churchPages) {
    if (page.legacyPaths.includes(path)) {
      return pageAvailable(page, context)
        ? { kind: "redirect", location: page.path, reason: `Legacy address of ${page.title}.` }
        : { kind: "unavailable", reason: `Legacy address of ${page.title}, which is ${page.status} and not published here.` };
    }
  }
  for (const event of events as readonly ChurchEvent[]) {
    if (event.legacyPaths.includes(path)) return { kind: "redirect", location: event.path, reason: `Legacy Events Calendar address of ${event.title}.` };
  }
  return extraDispositions.get(path) ?? null;
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
export function breadcrumbs(page: SitePage): TrailItem[] {
  const trail: TrailItem[] = [];
  let current: SitePage | undefined = page.parent ? pagesById.get(page.parent) : undefined;
  while (current) {
    trail.unshift({ href: current.path, label: current.title });
    current = current.parent ? pagesById.get(current.parent) : undefined;
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

export function eventVenue(event: ChurchEvent) {
  return venues[event.venue];
}

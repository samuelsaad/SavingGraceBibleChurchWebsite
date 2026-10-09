/** Canonical, indexable, server-rendered routes only; no draft or comparison pages. */
import { archivePageSize, archivePagePath, canonicalOriginFor, sermonPath, type FrontendRenderContext } from "../frontend/routes";
import { pagesFor, postsFor, legacyDisposition } from "../frontend/content/registry";
import { events, type ChurchEvent } from "../frontend/content/events";
import { escapeXml } from "../frontend/xml";
import { validateLegacySlug } from "../domain/slug";
import type { PublicSermonSitemapEntry } from "../server/repositories/sermon-repository";

export interface SitemapUrl { path: string; lastModified?: string }
function sermonUrls(entries: readonly PublicSermonSitemapEntry[], context: FrontendRenderContext, totalItems=entries.length): SitemapUrl[] {
  if(!Number.isSafeInteger(totalItems)||totalItems<entries.length)throw new Error("seo_sitemap_count_invalid");
  const urls: SitemapUrl[] = [{ path: "/sermons/" }];
  const seen = new Set<string>();
  for (const entry of entries) {
    const slug = validateLegacySlug(entry.slug);
    if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(entry.lastModified)
      || new Date(entry.lastModified).toISOString().slice(0, 10) !== entry.lastModified) throw new Error("seo_sitemap_entry_invalid");
    const path = sermonPath(context, slug);
    if (seen.has(path)) throw new Error("seo_sitemap_duplicate");
    seen.add(path); urls.push({ path, lastModified: entry.lastModified });
  }
  for (let page = 2; page <= Math.ceil(totalItems / archivePageSize); page++) urls.push({ path: archivePagePath(page) });
  return urls.filter(item=>context.siteContent?.sourceSeoByPath?.[item.path]?.noindex!==true);
}
function indexable(content: {seo?: {noindex?: boolean}}): boolean { return content.seo?.noindex !== true; }
function churchUrls(context: FrontendRenderContext): SitemapUrl[] {
  const snapshot = context.siteContent;
  const paths = [
    ...(!snapshot || snapshot.home && indexable(snapshot.home) ? ["/"] : []),
    ...pagesFor(context).filter(page => page.status === "published" && indexable(page)).map(page => page.path),
    ...postsFor(context).filter(indexable).map(post => post.path),
    ...((snapshot?.events ?? events) as readonly ChurchEvent[]).filter(indexable).map(event => event.path)
  ];
  const current = snapshot ? new Set(snapshot.routes.filter(route => route.status === 200).map(route => route.path)) : null;
  return paths.filter(path => !current || current.has(path)).map(path => {
    const modified = snapshot?.modifiedAtByPath?.[path];
    if(modified && (!Number.isFinite(Date.parse(modified)) || !/^\d{4}-\d{2}-\d{2}T/u.test(modified))) throw new Error("seo_sitemap_date_invalid");
    return {path,...(modified?{lastModified:modified}:{})};
  });
}
export function renderSeoSitemap(entries: readonly PublicSermonSitemapEntry[], context: FrontendRenderContext, sermonsOnly = false, additional: readonly SitemapUrl[] = [], totalItems=entries.length): string {
  const church = sermonsOnly ? [] : churchUrls(context);
  const allowedChurch = new Set(church.map(item=>item.path));
  const knownChurch = new Set(["/",...pagesFor(context).map(item=>item.path),...postsFor(context).map(item=>item.path),...(context.siteContent?.events??events).map(item=>item.path),...(context.siteContent?.routes??[]).map(item=>item.path)]);
  const source = additional.filter(item=>{
    const parsed=new URL(item.path,canonicalOriginFor(context));
    const queryAllowed=!!parsed.search && (context.seo?.indexableArchivePaths??[]).includes(item.path)
      && /^\/sermons\/(?:page\/(?:[2-9]|[1-9][0-9]+)\/)?$/u.test(parsed.pathname)
      && /^\?(?:sermon_series|sermon_speaker|sermon_topics|sermon_book)=[a-z0-9-]+$/u.test(parsed.search);
    if(parsed.pathname+parsed.search!==item.path || !item.path.startsWith("/") || item.path.startsWith("//") || /[#\\]/u.test(item.path)
      || (parsed.search && !queryAllowed) || /%(?:2f|5c|00|0[ad])/iu.test(item.path)
      || /^\/(?:admin|api|frontend-preview|draft-preview|cms-preview|__local|__cms|sermons-v[0-9]+)(?:\/|$)/u.test(item.path)) throw new Error("seo_sitemap_path_invalid");
    if(item.lastModified && (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/u.test(item.lastModified) || !Number.isFinite(Date.parse(item.lastModified)))) throw new Error("seo_sitemap_date_invalid");
    return !legacyDisposition(item.path,context) && (!knownChurch.has(item.path) || allowedChurch.has(item.path));
  });
  const urls = [...source,...church,...sermonUrls(entries, context,totalItems)];
  const unique = new Map(urls.map(item => [item.path, item]));
  const origin = canonicalOriginFor(context);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...unique.values()].map(item => `<url><loc>${escapeXml(origin + item.path)}</loc>${item.lastModified ? `<lastmod>${escapeXml(item.lastModified)}</lastmod>` : ""}</url>`).join("")}</urlset>`;
}

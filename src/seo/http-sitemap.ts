import {sitemapDate,latestSitemapDate} from './sitemap-dates';
/** Canonical, indexable, server-rendered routes only; no draft or comparison pages. */
import {maintainedIndexableCalendar} from './calendar-presentation';
import { archivePageSize, archivePagePath, canonicalOriginFor, sermonPath, type FrontendRenderContext } from "../frontend/routes";
import { pagesFor, postsFor, legacyDisposition } from "../frontend/content/registry";
import { events, type ChurchEvent } from "../frontend/content/events";
import { escapeXml } from "../frontend/xml";
import { validateLegacySlug } from "../domain/slug";
import type { PublicSermonSitemapEntry } from "../server/repositories/sermon-repository";

export interface SitemapUrl { path: string; lastModified?: string; images?: readonly string[] }
function sermonUrls(entries: readonly PublicSermonSitemapEntry[], context: FrontendRenderContext, totalItems=entries.length): SitemapUrl[] {
  if(!Number.isSafeInteger(totalItems)||totalItems<entries.length)throw new Error("seo_sitemap_count_invalid");
  const urls: SitemapUrl[] = [{ path: "/sermons/" }];
  const seen = new Set<string>();
  for (const entry of entries) {
    const slug = validateLegacySlug(entry.slug);
    if(!slug)throw Error("seo_sitemap_entry_invalid");
    let modified:string;try{modified=sitemapDate(entry.lastModified);}catch{throw Error("seo_sitemap_entry_invalid");}
    const path = sermonPath(context, slug);
    if (seen.has(path)) throw new Error("seo_sitemap_duplicate");
    seen.add(path); urls.push({ path, lastModified: modified });
  }
  const archiveModified=latestSitemapDate(urls.filter(item=>context.siteContent?.sourceSeoByPath?.[item.path]?.noindex!==true).map(item=>item.lastModified));if(archiveModified)urls[0]!.lastModified=archiveModified;
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
    const related=path==='/blogs/'?(snapshot?.posts??[]).map(post=>snapshot?.modifiedAtByPath?.[post.path]):path==='/events/'?[...(snapshot?.events??[]).filter(event=>event.calendarVisible!==false).map(event=>snapshot?.modifiedAtByPath?.[event.path]),...(snapshot?.cancelledCalendarEvents??[]).map(event=>event.calendarRevision?.modifiedAt)]:[];
    const modified=latestSitemapDate([snapshot?.modifiedAtByPath?.[path],...related]);
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
    const queryAllowed=!!parsed.search && ((context.seo?.indexableCapturedQueryPaths??[]).includes(item.path) || ((context.seo?.indexableArchivePaths??[]).includes(item.path)
      && /^\/sermons\/(?:page\/(?:[2-9]|[1-9][0-9]+)\/)?$/u.test(parsed.pathname)
      && /^\?(?:sermon_series|sermon_speaker|sermon_topics|sermon_book)=[a-z0-9-]+$/u.test(parsed.search)));
    if(parsed.pathname+parsed.search!==item.path || !item.path.startsWith("/") || item.path.startsWith("//") || /[#\\]/u.test(item.path)
      || (parsed.search && !queryAllowed) || /%(?:2f|5c|00|0[ad])/iu.test(item.path)
      || /^\/(?:admin|api|frontend-preview|draft-preview|cms-preview|__local|__cms|sermons-v[0-9]+)(?:\/|$)/u.test(item.path)) throw new Error("seo_sitemap_path_invalid");
    if(item.lastModified)sitemapDate(item.lastModified);
    return maintainedIndexableCalendar(item.path,context) || !legacyDisposition(item.path,context) && (!knownChurch.has(item.path) || allowedChurch.has(item.path));
  });
  const urls = [...source,...church,...sermonUrls(entries, context,totalItems)];
  const unique = new Map<string,SitemapUrl>();
  for(const item of urls){
    const previous=unique.get(item.path),images=[...new Set([...(previous?.images??[]),...(item.images??[])])];
    if(images.length>1000||images.some(path=>!path.startsWith('/')||path.startsWith('//')||new URL(path,canonicalOriginFor(context)).pathname!==path||/%(?![a-f0-9]{2})/iu.test(path)||/[?#\\\u0000-\u0020]/u.test(path)||/%(?:2f|5c|00|0[ad])/iu.test(path)||!/^\/(?:wp-content\/uploads|cms-assets|assets|images|media|brand)\/.+\.(?:png|jpe?g|webp|gif|avif|svg)$/iu.test(path)))throw Error('seo_sitemap_image_invalid');
    const modified=latestSitemapDate([previous?.lastModified,item.lastModified]);
    unique.set(item.path,{...previous,...item,...(modified?{lastModified:modified}:{}),...(images.length?{images}:{})});
  }
  const origin = canonicalOriginFor(context);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${[...unique.values()].map(item => `<url><loc>${escapeXml(origin + item.path)}</loc>${item.lastModified ? `<lastmod>${escapeXml(item.lastModified)}</lastmod>` : ""}${(item.images??[]).map(path=>`<image:image><image:loc>${escapeXml(origin+path)}</image:loc></image:image>`).join("")}</url>`).join("")}</urlset>`;
}

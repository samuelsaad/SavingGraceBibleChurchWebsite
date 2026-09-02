/**
 * Route paths, URL builders and query-state predicates for the sermon
 * frontend. Public routes and legacy-compatible query names are a stable
 * contract; nothing here changes a URL shape.
 */
import type { PublicSermonListQuery } from "../api/contracts/public-sermons";

export const canonicalOrigin = "https://www.savinggrace.org.au";
export const archivePath = "/sermons/";
export const archivePageSize = 9;

export interface FrontendRenderContext {
  mode: "public" | "preview";
  basePath: "" | "/frontend-preview";
}

export const publicRenderContext: FrontendRenderContext = Object.freeze({ mode: "public", basePath: "" });
export const previewRenderContext: FrontendRenderContext = Object.freeze({ mode: "preview", basePath: "/frontend-preview" });

export type FrontendTaxonomyKind = "speakers" | "series" | "books";

/** Prefixes a canonical site path with the preview base path when needed. */
export function contextualPath(context: FrontendRenderContext, path: string): string {
  if (context.mode === "public") return path;
  return path === "/" ? `${context.basePath}/` : `${context.basePath}${path}`;
}

export function sermonPath(context: FrontendRenderContext, slug: string): string {
  return contextualPath(context, `/sermons/${encodeURIComponent(slug)}/`);
}

export function archivePagePath(page: number, context = publicRenderContext): string {
  return contextualPath(context, page <= 1 ? archivePath : `/sermons/page/${page}/`);
}

/** Archive URL filtered by one legacy-compatible query parameter. */
export function filterUrl(name: string, value: string, context = publicRenderContext): string {
  const parameters = new URLSearchParams({ [name]: value });
  return `${contextualPath(context, archivePath)}?${parameters.toString()}`;
}

const taxonomyFilterNames: Record<FrontendTaxonomyKind, string> = {
  speakers: "sermon_speaker",
  series: "sermon_series",
  books: "sermon_book"
};

/**
 * Links a speaker, series or Bible-book name. The authenticated preview has
 * dedicated taxonomy pages; public mode keeps the archive query contract
 * because crawlable taxonomy landing pages are not yet approved.
 */
export function taxonomyLink(context: FrontendRenderContext, kind: FrontendTaxonomyKind, slug: string): string {
  return context.mode === "preview"
    ? contextualPath(context, `/${kind}/${encodeURIComponent(slug)}/`)
    : filterUrl(taxonomyFilterNames[kind], slug, context);
}

export function taxonomyIndexPath(context: FrontendRenderContext, kind: FrontendTaxonomyKind): string {
  return contextualPath(context, `/${kind}/`);
}

/** Rebuilds the legacy-compatible query string for the current filter state. */
export function standardizedFilterParameters(query: PublicSermonListQuery): URLSearchParams {
  const parameters = new URLSearchParams();
  if (query.query) parameters.set("s", query.query);
  if (query.speaker) parameters.set("sermon_speaker", query.speaker);
  if (query.series) parameters.set("sermon_series", query.series);
  if (query.passage) parameters.set("sermon_topics", query.passage);
  if (query.book) parameters.set("sermon_book", query.book);
  if (query.passageBook) parameters.set("passageBook", query.passageBook);
  if (query.passageChapter !== undefined) parameters.set("passageChapter", String(query.passageChapter));
  if (query.passageVerse !== undefined) parameters.set("passageVerse", String(query.passageVerse));
  if (query.passageEndVerse !== undefined) parameters.set("passageEndVerse", String(query.passageEndVerse));
  if (query.passageScope) parameters.set("passageScope", query.passageScope);
  if (query.dateFrom) parameters.set("dateFrom", query.dateFrom);
  if (query.dateTo) parameters.set("dateTo", query.dateTo);
  if (query.order !== "DESC") parameters.set("order", query.order);
  if (query.view === "recent") parameters.set("view", "recent");
  return parameters;
}

export function hasActiveSermonFilters(query: PublicSermonListQuery): boolean {
  return Boolean(
    query.query || query.speaker || query.series || query.passage || query.book
    || query.passageBook || query.passageChapter !== undefined
    || query.passageVerse !== undefined || query.passageEndVerse !== undefined
    || query.dateFrom || query.dateTo || query.order === "ASC"
  );
}

export function hasActiveAdvancedFilters(query: PublicSermonListQuery): boolean {
  return Boolean(
    query.passage || query.passageBook || query.passageChapter !== undefined
    || query.passageVerse !== undefined || query.passageEndVerse !== undefined
    || query.dateFrom || query.dateTo || query.order === "ASC"
  );
}

export function isExpandedRecentView(query: PublicSermonListQuery): boolean {
  return query.view === "recent" || (!hasActiveSermonFilters(query) && query.page > 1);
}

export type PassageSearchScope = NonNullable<PublicSermonListQuery["passageScope"]>;

export function effectivePassageScope(query: PublicSermonListQuery): PassageSearchScope | null {
  if (query.passageScope) return query.passageScope;
  if (query.passageVerse !== undefined) return "verse";
  if (query.passageChapter !== undefined) return "chapter";
  return query.passageBook ? "book" : null;
}

/** The archive URL with every precise-passage parameter removed. */
export function passageClearUrl(query: PublicSermonListQuery, context = publicRenderContext): string {
  const parameters = standardizedFilterParameters(query);
  for (const name of ["passageBook", "passageChapter", "passageVerse", "passageEndVerse", "passageScope"]) {
    parameters.delete(name);
  }
  return `${contextualPath(context, archivePath)}${parameters.size ? `?${parameters.toString()}` : ""}`;
}

/** Stable pagination URL that preserves filters and the expanded-recent mode. */
export function paginationUrl(
  page: number,
  query: PublicSermonListQuery,
  context = publicRenderContext,
  expandedRecent = false
): string {
  const parameters = standardizedFilterParameters(query);
  if (expandedRecent && !hasActiveSermonFilters(query)) {
    if (page <= 1) parameters.set("view", "recent");
    else parameters.delete("view");
  }
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  return `${archivePagePath(page, context)}${suffix}#sermon-results`;
}

export const resultsAnchor = "sermon-results";
export const recentAnchor = "most-recent-sermons";

/** Every link a page may need, resolved once per render for the active mode. */
export interface SiteLinks {
  readonly context: FrontendRenderContext;
  readonly home: string;
  readonly archive: string;
  readonly hasTaxonomyRoutes: boolean;
  archivePage(page: number): string;
  sermon(slug: string): string;
  filter(name: string, value: string): string;
  taxonomyIndex(kind: FrontendTaxonomyKind): string;
  taxonomy(kind: FrontendTaxonomyKind, slug: string): string;
  path(path: string): string;
}

export function siteLinks(context: FrontendRenderContext): SiteLinks {
  return {
    context,
    home: contextualPath(context, "/"),
    archive: contextualPath(context, archivePath),
    hasTaxonomyRoutes: context.mode === "preview",
    archivePage: (page) => archivePagePath(page, context),
    sermon: (slug) => sermonPath(context, slug),
    filter: (name, value) => filterUrl(name, value, context),
    taxonomyIndex: (kind) => taxonomyIndexPath(context, kind),
    taxonomy: (kind, slug) => taxonomyLink(context, kind, slug),
    path: (path) => contextualPath(context, path)
  };
}

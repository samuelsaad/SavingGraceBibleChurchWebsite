/**
 * Route paths, URL builders and query-state predicates for the sermon
 * frontend. Public routes and legacy-compatible query names are a stable
 * contract; nothing here changes a URL shape.
 */
import type { PublicSermonListQuery } from "../api/contracts/public-sermons";
import {sermonSlugPathSegment} from '../domain/slug';

export const canonicalOrigin = "https://www.savinggrace.org.au";
export const archivePath = "/sermons/";
export const archivePageSize = 9;

/**
 * Alternate archive presentations. The home, archive and detail URLs stay
 * intact; these routes are noindex comparison surfaces reached from the
 * Sermons menu.
 */
export const sermonsV1Path = "/sermons-v1/";
export const sermonsV4Path = "/sermons-v4/";
export type ArchiveBasePath = typeof archivePath | typeof sermonsV1Path | typeof sermonsV4Path;

export interface FrontendRenderContext {
  mode: "public" | "preview" | "restricted" | "draft-preview";
  basePath: "" | "/frontend-preview" | "/draft-preview";
}

export const publicRenderContext: FrontendRenderContext = Object.freeze({ mode: "public", basePath: "" });
export const previewRenderContext: FrontendRenderContext = Object.freeze({ mode: "preview", basePath: "/frontend-preview" });
/** Authenticated D-160 pending-draft preview; never a publication surface. */
export const draftPreviewRenderContext: FrontendRenderContext = Object.freeze({ mode: "draft-preview", basePath: "/draft-preview" });
/** Visitor presentation inside the sealed runtime, not an authenticated admin preview. */
export const restrictedRenderContext: FrontendRenderContext = Object.freeze({ mode: "restricted", basePath: "" });

export type FrontendTaxonomyKind = "speakers" | "series" | "books";

/** Prefixes a canonical site path with the preview base path when needed. */
export function contextualPath(context: FrontendRenderContext, path: string): string {
  if (context.mode === "public") return path;
  return path === "/" ? `${context.basePath}/` : `${context.basePath}${path}`;
}

export function sermonPath(context: FrontendRenderContext, slug: string): string {
  return contextualPath(context, `/sermons/${sermonSlugPathSegment(slug)}/`);
}

export function archivePagePath(page: number, context = publicRenderContext, base: ArchiveBasePath = archivePath): string {
  return contextualPath(context, page <= 1 ? base : `${base}page/${page}/`);
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
  expandedRecent = false,
  target: ArchiveTarget = archiveTarget
): string {
  const parameters = standardizedFilterParameters(query);
  if (expandedRecent && !hasActiveSermonFilters(query)) {
    if (page <= 1) parameters.set("view", "recent");
    else parameters.delete("view");
  }
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  return `${archivePagePath(page, context, target.path)}${suffix}#${target.fragment}`;
}

/** Where an archive presentation sends its searches, filters and pagination. */
export interface ArchiveTarget {
  path: ArchiveBasePath;
  fragment: string;
}

export const archiveTarget: ArchiveTarget = Object.freeze({ path: archivePath, fragment: "results" });
export const sermonsV4Target: ArchiveTarget = Object.freeze({ path: sermonsV4Path, fragment: "v4-results" });

export const resultsAnchor = "results";
export const recentAnchor = "most-recent-sermons";

/** Every link a page may need, resolved once per render for the active mode. */
export interface SiteLinks {
  readonly context: FrontendRenderContext;
  readonly home: string;
  readonly archive: string;
  readonly sermonsV1: string;
  readonly sermonsV4: string;
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
    sermonsV1: contextualPath(context, sermonsV1Path),
    sermonsV4: contextualPath(context, sermonsV4Path),
    hasTaxonomyRoutes: context.mode !== "public",
    archivePage: (page) => archivePagePath(page, context),
    sermon: (slug) => sermonPath(context, slug),
    filter: (name, value) => filterUrl(name, value, context),
    taxonomyIndex: (kind) => taxonomyIndexPath(context, kind),
    taxonomy: (kind, slug) => taxonomyLink(context, kind, slug),
    path: (path) => contextualPath(context, path)
  };
}

/**
 * The archive URL with parameters merged into the current filter state.
 * Pagination and the expanded-recent view are dropped so the link always
 * starts a fresh result set; the legacy query names are preserved.
 */
export function withFilter(
  query: PublicSermonListQuery,
  changes: Record<string, string | null>,
  context: FrontendRenderContext,
  fragment = "results",
  path: ArchiveBasePath = archivePath
): string {
  const parameters = standardizedFilterParameters(query);
  parameters.delete("view");
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) parameters.delete(name);
    else parameters.set(name, value);
  }
  const base = contextualPath(context, path);
  return `${base}${parameters.size ? `?${parameters.toString()}` : ""}#${fragment}`;
}

/** Removes every precise-passage parameter and the broad book filter. */
export function withoutPassage(query: PublicSermonListQuery, context: FrontendRenderContext, fragment = "results", path: ArchiveBasePath = archivePath): string {
  return withFilter(query, {
    passageBook: null, passageChapter: null, passageVerse: null, passageEndVerse: null, passageScope: null, sermon_book: null
  }, context, fragment, path);
}

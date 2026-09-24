/**
 * Public surface of the framework-independent sermon frontend.
 *
 * Server handlers and the static Astro pages import from here; nothing in
 * this package touches a database or a Node-only API.
 */
export { renderPublicSermonArchivePage, resultsTitle, type SermonArchivePageInput } from "./pages/archive";
export { renderPublicSermonPage, type SermonPageOptions } from "./pages/sermon";
export { emptyFilterOptions, renderFrontendHomePage, type FrontendHomePageInput } from "./pages/home";
export { renderSermonsV1Page, type SermonLandingInput } from "./pages/sermons-v1";
export { renderSermonsV4Page } from "./pages/sermons-v4";
export {
  renderFrontendTaxonomyDetail,
  renderFrontendTaxonomyIndex,
  type TaxonomyDetailInput
} from "./pages/taxonomy";
export { renderFrontendBoundaryPage, type BoundaryPageInput } from "./pages/boundary";
export {
  renderBlogIndex,
  renderBlogPost,
  renderCalendarFeed,
  renderChurchPage,
  renderEventPage,
  renderEventsPage,
  renderSitemapPage,
  staticChurchPaths,
  type ChurchPageData
} from "./pages/church";
export { pageShell, type PageShellInput } from "./shell";
export { publicSiteStyles, siteStyles, type StyleBlockName } from "./styles";
export { enhancementScripts, type EnhancementScriptName } from "./scripts";
export {
  archivePageSize,
  archivePath,
  canonicalOrigin,
  contextualPath,
  draftPreviewRenderContext,
  hasActiveSermonFilters,
  isExpandedRecentView,
  previewRenderContext,
  publicRenderContext,
  sermonsV1Path,
  sermonsV4Path,
  sermonsV4Target,
  siteLinks,
  withFilter,
  type FrontendRenderContext,
  type FrontendTaxonomyKind
} from "./routes";
export * as tokens from "./tokens";
export * as canon from "./canon";

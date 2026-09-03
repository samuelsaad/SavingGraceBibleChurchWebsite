/**
 * Public surface of the framework-independent sermon frontend.
 *
 * Server handlers and the static Astro pages import from here; nothing in
 * this package touches a database or a Node-only API.
 */
export { renderPublicSermonArchivePage, resultsTitle, type SermonArchivePageInput } from "./pages/archive";
export { renderPublicSermonPage, type SermonPageOptions } from "./pages/sermon";
export { emptyFilterOptions, renderFrontendHomePage, type FrontendHomePageInput } from "./pages/home";
export {
  renderFrontendTaxonomyDetail,
  renderFrontendTaxonomyIndex,
  type TaxonomyDetailInput
} from "./pages/taxonomy";
export { renderFrontendBoundaryPage, type BoundaryPageInput } from "./pages/boundary";
export { pageShell, type PageShellInput } from "./shell";
export { publicSiteStyles, siteStyles, type StyleBlockName } from "./styles";
export { enhancementScripts, type EnhancementScriptName } from "./scripts";
export {
  archivePageSize,
  archivePath,
  canonicalOrigin,
  contextualPath,
  hasActiveSermonFilters,
  isExpandedRecentView,
  previewRenderContext,
  publicRenderContext,
  siteLinks,
  withFilter,
  type FrontendRenderContext,
  type FrontendTaxonomyKind
} from "./routes";
export * as tokens from "./tokens";
export * as canon from "./canon";

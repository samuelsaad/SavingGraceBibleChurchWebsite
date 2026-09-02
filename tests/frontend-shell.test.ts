import { describe, expect, it } from "vitest";
import {
  enhancementScripts,
  previewRenderContext,
  publicRenderContext,
  renderFrontendBoundaryPage,
  renderFrontendHomePage,
  renderFrontendTaxonomyDetail,
  renderFrontendTaxonomyIndex,
  siteStyles
} from "../src/frontend";
import { contentSecurityPolicy, embeddedScriptHashes, embeddedStyleHashes } from "../src/server/http/frontend-response";

const option = { name: "Example Speaker", slug: "example-speaker" };

const pages = {
  home: renderFrontendHomePage({ sermons: [], series: [] }),
  previewHome: renderFrontendHomePage({ sermons: [], series: [option] }, previewRenderContext),
  boundary: renderFrontendBoundaryPage({ title: "Page not found", message: "The page you requested could not be found." }),
  privateBoundary: renderFrontendBoundaryPage({ title: "Administrator preview session required", message: "Open the dashboard first.", kind: "private" }, previewRenderContext),
  taxonomyIndex: renderFrontendTaxonomyIndex("series", [option]),
  taxonomyDetail: renderFrontendTaxonomyDetail({ kind: "speakers", option, sermons: [], totalItems: 0 })
};

describe("shared frontend shell", () => {
  it("gives every page one h1, a skip link, landmarks and the church name as plain text", () => {
    for (const [name, html] of Object.entries(pages)) {
      expect(html.match(/<h1[\s>]/gu), `${name} h1 count`).toHaveLength(1);
      expect(html, name).toContain('<a class="skip-link" href="#main-content">Skip to main content</a>');
      expect(html, name).toContain('<main id="main-content" class="site-main">');
      expect(html, name).toContain('<nav class="site-nav" aria-label="Primary">');
      expect(html, name).toContain('<nav aria-label="Footer">');
      expect(html, name).toContain('<a class="wordmark" href="');
      expect(html, name).not.toContain("brand-mark");
      expect(html, name).toContain('<meta name="color-scheme" content="light" />');
      expect(html, name).toContain('lang="en-AU"');
      expect(html.startsWith("<!doctype html>"), name).toBe(true);
    }
  });

  it("emits only the style blocks a page needs and never inline style attributes", () => {
    expect(pages.boundary).not.toContain(".passage-picker{");
    expect(pages.boundary).not.toContain(".video-frame{");
    expect(pages.boundary).not.toContain(' style="');
    expect(siteStyles(["archive"])).toContain(".passage-picker{");
    expect(siteStyles(["archive"])).not.toContain(".video-frame{");
    expect(siteStyles(["sermon"])).toContain(".video-frame{");
    expect(siteStyles()).toContain("@media print{");
    expect(siteStyles()).toContain("@media (prefers-reduced-motion:reduce)");
    expect(siteStyles()).toContain("@media (forced-colors:active)");
  });

  it("keeps public pages free of the preview navigation script and preview pages free of indexable metadata", () => {
    expect(pages.home).not.toContain("<script");
    expect(pages.previewHome).toContain('<script data-enhancement="navigation">');
    expect(pages.previewHome).not.toContain('rel="canonical"');
    expect(pages.previewHome).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
    expect(pages.home).toContain('rel="canonical" href="https://www.savinggrace.org.au/"');
  });

  it("ships readable enhancement scripts that parse and hash consistently into the policy", () => {
    for (const [name, source] of Object.entries(enhancementScripts)) {
      expect(() => new Function(source), `${name} parses`).not.toThrow();
      expect(source, `${name} is readable`).toContain("\n");
      expect(source).not.toMatch(/innerHTML|eval\(|fetch\(|XMLHttpRequest|document\.write/u);
    }
    const csp = contentSecurityPolicy(pages.previewHome);
    for (const scriptHash of embeddedScriptHashes(pages.previewHome)) expect(csp).toContain(scriptHash);
    for (const styleHash of embeddedStyleHashes(pages.previewHome)) expect(csp).toContain(styleHash);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(contentSecurityPolicy(pages.home)).not.toContain("script-src");
  });

  it("renders boundary states in the visitor's own words", () => {
    expect(pages.boundary).toContain('<p class="page-head__kind">Not found</p>');
    expect(pages.boundary).toContain("<h1>Page not found</h1>");
    expect(pages.boundary).toContain('href="/sermons/">Browse sermons</a>');
    expect(pages.privateBoundary).toContain('<p class="page-head__kind">Private content</p>');
    expect(pages.privateBoundary).toContain('href="/frontend-preview/sermons/">Browse sermons</a>');
    expect(pages.taxonomyIndex).toContain("<h1>Series</h1>");
    expect(pages.taxonomyIndex).toContain('href="/frontend-preview/series/example-speaker/"');
    expect(pages.taxonomyDetail).toContain("No eligible sermons use this classification yet.");
    expect(pages.taxonomyDetail).toContain("0 sermons");
  });

  it("renders taxonomy links as archive filters in public mode and as pages in preview mode", () => {
    const publicHome = renderFrontendHomePage({ sermons: [], series: [option] }, publicRenderContext);
    expect(publicHome).toContain('href="/sermons/?sermon_series=example-speaker"');
    expect(pages.previewHome).toContain('href="/frontend-preview/series/example-speaker/"');
    expect(pages.previewHome).toContain('href="/frontend-preview/series/">All series</a>');
  });
});

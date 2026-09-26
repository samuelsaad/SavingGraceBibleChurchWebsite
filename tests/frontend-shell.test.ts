import { describe, expect, it } from "vitest";
import {
  emptyFilterOptions,
  enhancementScripts,
  previewRenderContext,
  publicRenderContext,
  renderFrontendBoundaryPage,
  renderFrontendHomePage,
  renderFrontendTaxonomyDetail,
  renderFrontendTaxonomyIndex,
  renderSermonsV1Page,
  siteStyles
} from "../src/frontend";
import { contentSecurityPolicy, embeddedScriptHashes, embeddedStyleHashes } from "../src/server/http/frontend-response";

const speaker = { name: "Example Speaker", slug: "example-speaker", sermonCount: 1 };
const series = { name: "Example Series", slug: "example-series", sermonCount: 2 };
const options = { ...emptyFilterOptions, speakers: [speaker], series: [series], books: [{ name: "Romans", slug: "romans", sermonCount: 3 }] };

const pages = {
  home: renderSermonsV1Page({ sermons: [], options: emptyFilterOptions, totalItems: 0 }),
  previewHome: renderSermonsV1Page({ sermons: [], options, totalItems: 3 }, previewRenderContext),
  churchHome: renderFrontendHomePage({ sermons: [], options: emptyFilterOptions, totalItems: 0, today: "2026-09-24" }),
  boundary: renderFrontendBoundaryPage({ title: "Page not found", message: "The page you requested could not be found." }),
  privateBoundary: renderFrontendBoundaryPage({ title: "Administrator preview session required", message: "Open the dashboard first.", kind: "private" }, previewRenderContext),
  taxonomyIndex: renderFrontendTaxonomyIndex("series", [series]),
  taxonomyDetail: renderFrontendTaxonomyDetail({ kind: "speakers", option: speaker, sermons: [], totalItems: 0 })
};

describe("shared frontend shell", () => {
  it("gives every page one h1, a skip link, landmarks, accessible navigation and the church name as text", () => {
    for (const [name, html] of Object.entries(pages)) {
      expect(html.match(/<h1[\s>]/gu), `${name} h1 count`).toHaveLength(1);
      expect(html, name).toContain('<a class="skip-link" href="#main-content">Skip to main content</a>');
      expect(html, name).toContain('<main id="main-content" class="site-main">');
      const isPreview = html.includes('class="preview-band"');
      expect(html, name).toContain('<nav class="masthead__nav" id="primary-navigation" aria-label="Primary"><ul class="masthead__links">');
      expect(html, name).toContain(isPreview ? '<details class="masthead__menu" data-menu data-sermon-menu>' : '<li class="masthead__links-sermons"><a href="/sermons/"');
      expect(html, name).toContain('<details class="masthead__menu" data-menu>');
      expect(html, name).not.toContain('data-sermon-menu open');
      expect(html, name).not.toContain('data-menu open');
      expect(html, name).toContain('<nav aria-label="Footer">');
      expect(html, name).toContain('<a class="brand" href="');
      expect(html, name).toContain('<img class="brand__logo" src="/brand/saving-grace-logo.png" width="300" height="178" alt="Saving Grace Bible Church" decoding="async" />');
      expect(html, name).toContain('alt="Saving Grace Bible Church"');
      expect(html, name).toContain('data-mobile-toggle hidden>Menu');
      expect(html, name).toContain('<h2 class="footer-col__title" id="footer-contact-heading">Contact Us</h2>');
      expect(html, name).toContain('<span><a href="tel:+61450545589">Tel: 0450545589</a></span>');
      expect(html, name).toContain('<a class="button masthead__give" href="');
      if (!isPreview) expect(html.replace(/<details class="(?:refine|masthead__menu)"[\s\S]*?<\/details>/gu, ""), name).not.toContain("<details");
      expect(html, name).not.toContain(' style="');
      expect(html, name).toContain('<meta name="color-scheme" content="light" />');
      expect(html, name).toContain('lang="en-AU"');
      expect(html.startsWith("<!doctype html>"), name).toBe(true);
    }
  });

  it("emits only the style blocks a page needs", () => {
    expect(pages.boundary).not.toContain(".spine{");
    expect(pages.boundary).not.toContain(".plate{");
    expect(pages.boundary).not.toContain(".preview-band{");
    expect(pages.privateBoundary).toContain(".preview-band{");
    expect(siteStyles(["shelf"])).toContain(".spine{");
    expect(siteStyles(["shelf"])).toContain(".ruler__cell{");
    expect(siteStyles(["shelf"])).not.toContain(".plate{");
    expect(siteStyles(["sermon"])).toContain(".plate{");
    expect(siteStyles(["sermon"])).toContain(".transcript{");
    expect(siteStyles()).not.toContain(".preview-band{");
    expect(siteStyles()).toContain("@media print{");
    expect(siteStyles()).toContain("@media (prefers-reduced-motion:reduce)");
    expect(siteStyles()).toContain("@media (forced-colors:active)");
  });

  it("embeds only the canon enhancement on shelf pages and keeps preview pages free of indexable metadata", () => {
    expect(pages.home).toContain('<script data-enhancement="canon">');
    expect(pages.home.match(/<script /gu)).toHaveLength(2);
    expect(pages.boundary.match(/<script /gu)).toHaveLength(1);
    expect(pages.churchHome.match(/<script /gu)).toHaveLength(1);
    expect(pages.churchHome).not.toContain('<script data-enhancement="canon">');
    expect(pages.previewHome).not.toContain('rel="canonical"');
    expect(pages.previewHome).not.toContain('property="og:');
    expect(pages.previewHome).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
    expect(pages.previewHome).toContain('<div class="preview-band" role="status">');
    expect(pages.home).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/"');
    expect(pages.home).toContain('<meta name="robots" content="noindex, follow" />');
    expect(pages.churchHome).toContain('rel="canonical" href="https://www.savinggrace.org.au/"');
    expect(pages.churchHome).toContain('<meta property="og:type" content="website" />');
    expect(pages.home).not.toContain('class="preview-band"');
    for (const html of Object.values(pages)) {
      expect(html).toContain('<script data-enhancement="navigation">');
      expect(html.includes('data-menu data-sermon-menu>')).toBe(html.includes('class="preview-band"'));
    }
  });

  it("ships readable enhancement scripts that parse and hash consistently into the policy", () => {
    expect(Object.keys(enhancementScripts).sort()).toEqual(["canon", "church", "navigation", "sermon"]);
    for (const [name, source] of Object.entries(enhancementScripts)) {
      expect(() => new Function(source), `${name} parses`).not.toThrow();
      expect(source, `${name} is readable`).toContain("\n");
      expect(source).not.toMatch(/innerHTML|eval\(|fetch\(|XMLHttpRequest|document\.write|autoplay/u);
    }
    for (const html of [pages.home, pages.previewHome, pages.churchHome]) {
      const csp = contentSecurityPolicy(html);
      for (const scriptHash of embeddedScriptHashes(html)) expect(csp).toContain(scriptHash);
      for (const styleHash of embeddedStyleHashes(html)) expect(csp).toContain(styleHash);
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain("unsafe-inline");
      expect(csp).toContain("script-src 'sha256-");
    }
    expect(contentSecurityPolicy(pages.boundary)).toContain("script-src 'sha256-");
  });

  it("renders boundary states in the visitor's own words with the shelf art", () => {
    expect(pages.boundary).toContain('<p class="eyebrow">Not found</p>');
    expect(pages.boundary).toContain("<h1>Page not found</h1>");
    expect(pages.boundary).toContain('href="/sermons/">Browse sermons</a>');
    expect(pages.boundary).toContain('<svg class="boundary__art"');
    expect(pages.privateBoundary).toContain('<p class="eyebrow">Private content</p>');
    expect(pages.privateBoundary).toContain('href="/frontend-preview/sermons/">Browse sermons</a>');
    expect(pages.taxonomyIndex).toContain('<h1 class="title-page__title">Series</h1>');
    expect(pages.taxonomyIndex).toContain('<a href="/frontend-preview/series/example-series/"><span>Example Series</span><span class="index__count">2 sermons</span></a>');
    expect(pages.taxonomyDetail).toContain('<h1 class="title-page__title">Example Speaker</h1>');
    expect(pages.taxonomyDetail).toContain("No eligible sermons use this classification yet.");
    expect(pages.taxonomyDetail).toContain("0 sermons");
  });

  it("renders the shelf from the projection only, with links for preached books and inert ghosts", () => {
    expect(pages.home.match(/<li class="spine /gu)).toHaveLength(66);
    expect(pages.home).not.toContain('class="spine__link"');
    expect(pages.home).toContain("No sermons have been shelved yet.");
    expect(pages.home).toContain('<p class="hero__stats note">No sermons are available yet.</p>');
    expect(pages.previewHome.match(/<a class="spine__link"/gu)).toHaveLength(1);
    expect(pages.previewHome).toContain('<li class="spine spine--romans spine--pauline is-preached" data-len="short"><a class="spine__link" href="/frontend-preview/books/romans/">');
    expect(pages.previewHome).toContain('<span class="spine__count" aria-hidden="true">3</span>');
    expect(pages.previewHome).toContain('<li class="spine spine--genesis spine--law" data-len="mid"><span class="spine__ghost" aria-hidden="true">');
    expect(pages.previewHome).toContain('<ul class="stats hero__stats" role="list"><li>3 sermons</li><li>1 of 66 books</li><li>1 speaker</li><li>1 series</li></ul>');
    expect(pages.previewHome).toContain('<ul class="legend" role="list" aria-label="Literary groups on the shelf">');
    expect(pages.previewHome).toContain('class="shelf__row"');
  });

  it("renders taxonomy links as archive filters in public mode and as pages in preview mode", () => {
    const publicHome = renderSermonsV1Page({ sermons: [], options, totalItems: 3 }, publicRenderContext);
    expect(publicHome).toContain('<a href="/sermons/?sermon_series=example-series"><span>Example Series</span><span class="index__count">2 sermons</span></a>');
    expect(publicHome).toContain('<a class="spine__link" href="/sermons/?sermon_book=romans">');
    expect(publicHome).not.toContain("All series</a>");
    expect(publicHome).not.toContain("/speakers/");
    expect(publicHome).not.toContain("SermonsV1");
    expect(publicHome).not.toContain("SermonsV2");
    expect(publicHome).not.toContain("SermonsV4");
    expect(pages.previewHome).toContain('href="/frontend-preview/series/example-series/"');
    expect(pages.previewHome).toContain('href="/frontend-preview/series/">All series</a>');
    expect(pages.previewHome).toContain('<li><a href="/frontend-preview/books/">Books</a></li>');
    expect(pages.previewHome).toContain('href="/frontend-preview/sermons/">All sermons</a>');
    expect(pages.previewHome).not.toContain(">SermonsV4</a>");
  });
});

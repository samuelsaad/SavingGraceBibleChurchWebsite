import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  emptyFilterOptions,
  previewRenderContext,
  publicRenderContext,
  renderFrontendHomePage,
  siteStyles,
  staticChurchPaths
} from "../src/frontend";
import { logoBytes, logoPath } from "../src/frontend/assets/logo";
import { siteImageBytes, siteImages } from "../src/frontend/assets/media";
import { homepageInventory } from "../src/frontend/content/home-content";
import { primaryMenu } from "../src/frontend/content/navigation";
import { restrictedRenderContext } from "../src/frontend/routes";
import { mobileNavigationScript } from "../src/frontend/scripts/mobile-navigation";
import { homeStyles } from "../src/frontend/styles/home";
import { cardStyles } from "../src/frontend/styles/cards";
import { contentSecurityPolicy, embeddedScriptHashes } from "../src/server/http/frontend-response";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import { createPublicSermonSiteHandler } from "../src/server/http/public-sermon-page";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";
import { createSealedStagingHandler } from "../src/staging/handler";

// Presentation tests use no database, development dataset or real sermon body.
const homepage = { sermons: [], options: emptyFilterOptions, totalItems: 0, today: "2026-09-28" };
const repository: PublicSermonRepository = {
  async listPublished() { return { data: [], totalItems: 0 }; },
  async findPublishedBySlug() { return null; },
  async listPublishedFilterOptions() { return emptyFilterOptions; },
  async listPublishedTopicalSermons() { return []; },
  async listPublishedSeriesRepresentatives() { return []; },
  async listPublishedSitemapEntries() { return []; },
  async findPublicPathDisposition() { return null; }
};

function visibleText(document: string): string {
  return document.replace(/<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)>/gu, "")
    .replace(/<[^>]+>/gu, " ")
    .replaceAll("&amp;", "&").replaceAll("&gt;", ">").replaceAll("&lt;", "<")
    .replaceAll("&quot;", '"').replaceAll("&#39;", "'")
    .replace(/\s+/gu, " ").trim();
}

const sha256 = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");

describe("visitor redesign preservation", () => {
  it("keeps the offering heading readable and the latest marker out of metadata hit areas", () => {
    expect(homeStyles.match(/\.offering__title\s*\{([^}]+)\}/u)?.[1]).toContain("color: var(--colour-on-ink)");
    const flag = cardStyles.match(/\.card__flag\s*\{([^}]+)\}/u)?.[1];
    expect(flag).toContain("display: inline-flex");
    expect(flag).not.toContain("position: absolute");
  });

  it("keeps every existing homepage inventory string in server-rendered content", () => {
    const document = renderFrontendHomePage(homepage);
    const text = visibleText(document);
    for (const item of homepageInventory) expect(text, item).toContain(item.replace(/\s+/gu, " "));
    expect(document.match(/<h1[\s>]/gu)).toHaveLength(1);
    expect(document).toContain('href="#main-content"');
    expect(document).toContain('<main id="main-content"');
    expect(document).toContain('href="tel:+61450545589"');
    expect(document).toContain('href="mailto:info@savinggrace.org.au"');
    expect(document).toContain('href="https://goo.gl/maps/gL2hcbXG3Ci9zqRVA"');
  });

  it("preserves the official logo and all 45 reviewed image assets byte-for-byte", () => {
    // Fingerprints frozen from the inherited 0e7299d church-site assets.
    expect(sha256(logoBytes())).toBe("b617726b47e7456936246af30bdcd35ae31a4660aaa72e52637cd29f9f971c8f");
    const inventory = siteImages.map((asset) => [
      asset.id, asset.path, asset.width, asset.height, sha256(siteImageBytes(asset.id))
    ]);
    expect(inventory).toHaveLength(45);
    expect(sha256(JSON.stringify(inventory))).toBe("1de3ee50e98445f3d2399beebff9cae99c14a46235cd92340daa03b1aabeb3f2");
    const document = renderFrontendHomePage(homepage);
    expect(document).toContain(`src="${logoPath}"`);
    const allowed = new Set([logoPath, ...siteImages.map((asset) => asset.path)]);
    for (const match of document.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gu)) {
      expect(allowed.has(match[1]!), match[1]).toBe(true);
    }
  });

  it("keeps the complete navigation available before JavaScript enables the compact menu", () => {
    const document = renderFrontendHomePage(homepage);
    const header = document.match(/<header\b[^>]*data-site-header[\s\S]*?<\/header>/u)?.[0] ?? "";
    const toggle = header.match(/<button\b[^>]*data-site-toggle[^>]*>/u)?.[0] ?? "";
    expect(toggle).toMatch(/\bhidden(?:\s|>)/u);
    expect(toggle).toContain('aria-expanded="false"');
    expect(toggle).toContain('aria-controls="primary-navigation"');
    expect(header).toContain('id="primary-navigation"');
    expect(header).not.toContain("masthead--compact");
    expect(header).not.toMatch(/<nav\b[^>]*\bhidden(?:\s|>)/u);
    for (const item of primaryMenu.flatMap((item) => [item, ...(item.children ?? [])])) {
      expect(header, item.label).toContain(`href="${item.href}"`);
    }
    // Hiding the navigation must depend on the JS-added enhancement class.
    const hidingRules = [...siteStyles().matchAll(/([^{}]+)\{[^{}]*display:\s*none\s*;?[^{}]*\}/gu)]
      .map((match) => match[1]!).filter((selector) => /\.masthead__nav\b/u.test(selector));
    expect(hidingRules.length).toBeGreaterThan(0);
    for (const selector of hidingRules) expect(selector).toContain(".masthead--compact");
  });

  it("retains every published church route and its canonical URL", async () => {
    const route = createPublicSermonSiteHandler(repository, publicRenderContext, { today: () => homepage.today });
    for (const path of ["/", ...staticChurchPaths()]) {
      const response = await route(new Request(`http://127.0.0.1${path}`));
      expect(response?.status, path).toBe(200);
      const document = await response!.text();
      expect(document, path).toContain(`rel="canonical" href="https://www.savinggrace.org.au${path}"`);
      expect(document.match(/<h1[\s>]/gu), path).toHaveLength(1);
    }
  });

  it("keeps private pages unavailable to visitors and previews non-indexable", async () => {
    const route = createPublicSermonSiteHandler(repository, publicRenderContext, { today: () => homepage.today });
    for (const path of ["/constitution/", "/constitution-3/", "/elders/draft/", "/our-history/draft/", "/what-we-teach/lordship-salvation/", "/what-we-teach/mandated-church/draft/"]) {
      expect((await route(new Request(`http://127.0.0.1${path}`)))?.status, path).toBe(404);
      expect(staticChurchPaths()).not.toContain(path);
    }
    for (const context of [previewRenderContext, restrictedRenderContext]) {
      const document = renderFrontendHomePage(homepage, context);
      expect(document).toContain('content="noindex, nofollow, noarchive"');
      expect(document).not.toMatch(/rel="canonical"|property="og:|application\/ld\+json/u);
    }
    const denied = createLocalFrontendPreviewHandler(repository, { authorizes: () => false });
    expect((await denied(new Request("http://127.0.0.1/frontend-preview/")))?.status).toBe(401);
    const sealed = createSealedStagingHandler(repository, async () => {}, "a".repeat(40));
    const response = await sealed(new Request("http://127.0.0.1/"));
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect((await sealed(new Request("http://127.0.0.1/admin"))).status).toBe(401);
    expect((await sealed(new Request("http://127.0.0.1/", { method: "POST" }))).status).toBe(405);
  });

  it("hashes the new menu enhancement into the existing strict content security policy", () => {
    const document = renderFrontendHomePage(homepage);
    expect(document).toContain(mobileNavigationScript);
    const policy = contentSecurityPolicy(document);
    for (const hash of embeddedScriptHashes(document)) expect(policy).toContain(hash);
    expect(policy).not.toContain("unsafe-inline");
    expect(mobileNavigationScript).not.toMatch(/innerHTML|eval\(|fetch\(|XMLHttpRequest|document\.write/u);
  });
});

function mobileMenu() {
  type Event = { key?: string; target?: unknown; preventDefault: ReturnType<typeof vi.fn> };
  const eventTarget = () => {
    const handlers = new Map<string, (event: Event) => void>();
    return { handlers, addEventListener: (name: string, handler: (event: Event) => void) => handlers.set(name, handler) };
  };
  const attributes = new Map([["aria-expanded", "false"]]);
  const toggle = {
    ...eventTarget(), hidden: true, focus: vi.fn(),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value)
  };
  const classes = new Set<string>();
  const headerAttributes = new Map<string, string>();
  const innerLink = {};
  const header = {
    ...eventTarget(), classList: { add: (value: string) => classes.add(value) },
    setAttribute: (name: string, value: string) => headerAttributes.set(name, value),
    removeAttribute: (name: string) => headerAttributes.delete(name),
    contains: (target: unknown) => target === toggle || target === innerLink
  };
  const document = {
    ...eventTarget(), querySelector: (selector: string) => selector === "[data-site-header]" ? header : toggle
  };
  runInNewContext(mobileNavigationScript, { document });
  function fire(target: ReturnType<typeof eventTarget>, name: string, fields: Partial<Event> = {}) {
    const event = { preventDefault: vi.fn(), ...fields };
    target.handlers.get(name)?.(event);
    return event;
  }
  return { toggle, header, document, classes, headerAttributes, innerLink, fire };
}

describe("compact navigation progressive enhancement", () => {
  it("reveals its control and synchronizes accessible and visual state on each activation", () => {
    const { toggle, classes, headerAttributes, fire } = mobileMenu();
    expect(toggle.hidden).toBe(false);
    expect(classes.has("masthead--compact")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(headerAttributes.has("data-nav-open")).toBe(false);
    fire(toggle, "click");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(headerAttributes.has("data-nav-open")).toBe(true);
    fire(toggle, "click");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(headerAttributes.has("data-nav-open")).toBe(false);
    expect(toggle.focus).not.toHaveBeenCalled();
  });

  it("closes on Escape and restores focus only when the menu was open", () => {
    const { toggle, header, headerAttributes, fire } = mobileMenu();
    expect(fire(header, "keydown", { key: "Escape" }).preventDefault).not.toHaveBeenCalled();
    fire(toggle, "click");
    expect(fire(header, "keydown", { key: "Escape" }).preventDefault).toHaveBeenCalledOnce();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(headerAttributes.has("data-nav-open")).toBe(false);
    expect(toggle.focus).toHaveBeenCalledOnce();
  });

  it("ignores inside clicks and closes outside clicks without stealing focus", () => {
    const { toggle, document, innerLink, headerAttributes, fire } = mobileMenu();
    fire(toggle, "click");
    fire(document, "click", { target: innerLink });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const outside = fire(document, "click", { target: {} });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(headerAttributes.has("data-nav-open")).toBe(false);
    expect(outside.preventDefault).not.toHaveBeenCalled();
    expect(toggle.focus).not.toHaveBeenCalled();
  });

  it("does nothing on documents without the matching masthead controls", () => {
    expect(() => runInNewContext(mobileNavigationScript, { document: { querySelector: () => null } })).not.toThrow();
  });
});

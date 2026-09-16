/**
 * The document shell shared by every server-rendered page and by the static
 * Astro pages: head metadata, the skip link, the preview band, the masthead
 * with a preview navigation disclosure and compact search, the main landmark, the
 * footer with the canon strip, and the page-scoped style and script blocks.
 *
 * This module has no Node-only imports so the static build can consume it.
 */
import type { PublicSermonFilterOptions } from "../server/repositories/sermon-repository";
import { shelfMark } from "./components/marks";
import { mastheadSearch } from "./components/search";
import { canonStrip } from "./components/shelf";
import { attribute, documentTitle, html, raw, type Html, when } from "./html";
import { canonicalOrigin, siteLinks, type FrontendRenderContext, type FrontendTaxonomyKind, publicRenderContext } from "./routes";
import { enhancementScripts, type EnhancementScriptName } from "./scripts";
import { siteStyles, type StyleBlockName } from "./styles";
import { colour } from "./tokens";
import { sermonsV3Path, sermonsV3Url } from "./v3-routes";

export type RobotsDirective = "index, follow" | "noindex, follow" | "noindex, nofollow";

export interface PageShellInput {
  /** Page title without the site name suffix. */
  title: string;
  description?: string;
  canonicalPath: string;
  /** Alternate pages may share an archive canonical without selecting its menu item. */
  navigationPath?: string;
  robots: RobotsDirective;
  body: Html;
  openGraphType?: "website" | "article";
  /** Style blocks beyond the always-present core. */
  styles?: StyleBlockName[];
  /** Enhancement scripts to embed after the footer. */
  scripts?: EnhancementScriptName[];
  /** Adds "— Saving Grace Bible Church"; the home page keeps the bare name. */
  suffixTitle?: boolean;
  /** Books with sermons, for the footer's canon strip. */
  books?: PublicSermonFilterOptions["books"];
  /** Hides the masthead search on pages that carry the full finder. */
  mastheadSearch?: boolean;
}

/** The shelf mark as a favicon: five spines on a board, drawn in ink on the ground, no external asset. */
const faviconDataUri = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" fill="${colour.ground}"/><rect x="2" y="8" width="4" height="18" fill="none" stroke="${colour.ink}" stroke-width="1.5"/><rect x="8" y="4" width="6" height="22" fill="${colour.ink}"/><rect x="16" y="10" width="3" height="16" fill="none" stroke="${colour.ink}" stroke-width="1.5"/><rect x="21" y="6" width="5" height="20" fill="${colour.ink}" opacity="0.55"/><rect x="0" y="26" width="28" height="2" fill="${colour.ink}"/></svg>`
);

const sections: ReadonlyArray<readonly [FrontendTaxonomyKind | "sermons", string]> = [
  ["sermons", "Sermons"],
  ["speakers", "Speakers"],
  ["series", "Series"],
  ["books", "Books"]
];

function activeSection(canonicalPath: string): string | null {
  return sections.find(([section]) => (
    canonicalPath === `/${section}/` || canonicalPath.startsWith(`/${section}/`)
  ))?.[0] ?? null;
}

function navigationLinks(context: FrontendRenderContext, canonicalPath: string): Html {
  const links = siteLinks(context);
  const active = activeSection(canonicalPath);
  const items = links.hasTaxonomyRoutes ? sections : sections.slice(0, 1);
  if (links.hasTaxonomyRoutes) {
    const homeActive = canonicalPath === "/";
    return html`<details class="masthead__menu" data-sermon-menu>
      <summary class="masthead__menu-toggle${active || homeActive || canonicalPath === sermonsV3Path ? " is-active" : ""}" aria-controls="sermon-navigation" title="Open menu; double-click to browse SermonsV2">Sermons<span class="masthead__chevron" aria-hidden="true"></span></summary>
      <ul class="masthead__dropdown" id="sermon-navigation"><li><a href="${links.home}"${attribute("aria-current", homeActive ? "page" : null)}>SermonsV1</a></li>${items.map(([section, label]) => html`<li><a href="${section === "sermons" ? links.archive : links.taxonomyIndex(section)}"${when(section === "sermons", () => html` data-sermon-archive`)}${attribute("aria-current", active === section ? "page" : null)}>${section === "sermons" ? "SermonsV2" : label}</a></li>${when(section === "sermons", () => html`<li><a href="${sermonsV3Url(context)}"${attribute("aria-current", canonicalPath === sermonsV3Path ? "page" : null)}>Sermons V3</a></li>`)}`)}</ul>
    </details>`;
  }
  return html`<ul class="masthead__links">${items.map(([section, label]) => html`<li><a href="${section === "sermons" ? links.archive : links.taxonomyIndex(section)}"${attribute("aria-current", active === section ? "page" : null)}>${label}</a></li>`)}</ul>`;
}

function brand(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<a class="brand" href="${links.home}">${shelfMark()}<span class="wordmark"><span class="wordmark__line">Saving Grace</span><span class="wordmark__line">Bible Church</span></span></a>`;
}

function headMetadata(input: PageShellInput, context: FrontendRenderContext): Html {
  if (context.mode !== "public") return html``;
  const canonicalUrl = `${canonicalOrigin}${input.canonicalPath}`;
  const title = documentTitle(input.suffixTitle === false ? undefined : input.title);
  return html`${when(input.description, () => html`<meta name="description" content="${input.description}" />`)}
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="${input.openGraphType ?? "website"}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:url" content="${canonicalUrl}" />
    ${when(input.description, () => html`<meta property="og:description" content="${input.description}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${input.description}" />`)}`;
}

/** Renders a complete HTML document. */
export function pageShell(input: PageShellInput, context: FrontendRenderContext = publicRenderContext): string {
  const links = siteLinks(context);
  const preview = context.mode === "preview";
  const title = input.suffixTitle === false ? input.title : documentTitle(input.title);
  const scripts = [...new Set<EnhancementScriptName>([...(input.scripts ?? []), ...(links.hasTaxonomyRoutes ? ["navigation" as const] : [])])];
  const document = html`<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${context.mode !== "public" ? "noindex, nofollow, noarchive" : input.robots}" />
    <meta name="color-scheme" content="light" />
    <link rel="icon" href="${faviconDataUri}" />
    <title>${title}</title>
    ${headMetadata(input, context)}
    <style>${raw(siteStyles([...(input.styles ?? []), ...(preview ? ["preview" as const] : [])]))}</style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    ${when(preview, () => html`<div class="preview-band" role="status">${shelfMark()}<span>Private local frontend preview · Draft content · Not public or indexable</span></div>`)}
    <header class="masthead">
      <div class="masthead__inner">
        ${brand(context)}
        <nav class="masthead__nav" aria-label="Primary">${navigationLinks(context, input.navigationPath ?? input.canonicalPath)}</nav>
        ${when(input.mastheadSearch !== false, () => mastheadSearch(context))}
      </div>
    </header>
    <main id="main-content" class="site-main">${input.body}</main>
    <footer class="site-footer">
      ${canonStrip({ books: input.books ?? [] })}
      <div class="site-footer__band">
        <div class="site-footer__inner">
          ${brand(context)}
          <nav aria-label="Footer"><ul class="site-footer__links">${(links.hasTaxonomyRoutes ? sections : sections.slice(0, 1)).map(([section, label]) => html`<li><a href="${section === "sermons" ? links.archive : links.taxonomyIndex(section)}">${label}</a></li>`)}</ul></nav>
          <p class="site-footer__note">Every sermon is shelved under the Bible book it was preached from. The bookshelf mark is this website's own device.</p>
        </div>
      </div>
    </footer>
    ${scripts.map((name) => html`<script data-enhancement="${name}">${raw(enhancementScripts[name])}</script>`)}
  </body>
</html>`;
  return document.toString().trim();
}

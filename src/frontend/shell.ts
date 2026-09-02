/**
 * The document shell shared by every server-rendered page and by the static
 * Astro pages: head metadata, the skip link, the preview banner, the masthead
 * with its navigation disclosures, the main landmark, the footer, and the
 * page-scoped style and script blocks.
 *
 * This module has no Node-only imports so the static build can consume it.
 */
import { attribute, documentTitle, html, raw, siteName, type Html, when } from "./html";
import { canonicalOrigin, siteLinks, type FrontendRenderContext, type FrontendTaxonomyKind, publicRenderContext } from "./routes";
import { enhancementScripts, type EnhancementScriptName } from "./scripts";
import { siteStyles, type StyleBlockName } from "./styles";

export type RobotsDirective = "index, follow" | "noindex, follow" | "noindex, nofollow";

export interface PageShellInput {
  /** Page title without the site name suffix. */
  title: string;
  description?: string;
  canonicalPath: string;
  robots: RobotsDirective;
  body: Html;
  openGraphType?: "website" | "article";
  /** Style blocks beyond the always-present core. */
  styles?: StyleBlockName[];
  /** Enhancement scripts to embed after the footer. */
  scripts?: EnhancementScriptName[];
  /** Adds "— Saving Grace Bible Church"; the home page keeps the bare name. */
  suffixTitle?: boolean;
}

const sermonSections: ReadonlyArray<readonly [FrontendTaxonomyKind | "sermons", string]> = [
  ["sermons", "Sermons"],
  ["speakers", "Speakers"],
  ["series", "Series"],
  ["books", "Bible books"]
];

function activeSection(canonicalPath: string): string | null {
  return sermonSections.find(([section]) => (
    canonicalPath === `/${section}/` || canonicalPath.startsWith(`/${section}/`)
  ))?.[0] ?? null;
}

function sectionLinks(context: FrontendRenderContext, active: string | null): Html {
  const links = siteLinks(context);
  return html`${sermonSections.map(([section, label]) => html`<li><a href="${section === "sermons" ? links.archive : links.taxonomyIndex(section)}"${attribute("aria-current", active === section ? "page" : null)}>${label}</a></li>`)}`;
}

function sermonsDisclosure(context: FrontendRenderContext, active: string | null, variant: "desktop" | "mobile"): Html {
  const current = active ? html`<span class="sr-only">, current section</span>` : null;
  return html`<details class="nav-disclosure nav-disclosure--${variant}" data-nav-disclosure>
    <summary class="nav-disclosure__summary${active ? " is-current" : ""}" aria-expanded="false">Sermons${current}</summary>
    <ul class="nav-disclosure__panel">${sectionLinks(context, active)}</ul>
  </details>`;
}

function primaryNavigation(context: FrontendRenderContext, canonicalPath: string, variant: "desktop" | "mobile"): Html {
  const links = siteLinks(context);
  const active = activeSection(canonicalPath);
  const home = html`<li><a href="${links.home}"${attribute("aria-current", canonicalPath === "/" ? "page" : null)}>Home</a></li>`;
  const sermons = links.hasTaxonomyRoutes
    ? html`<li class="site-nav__disclosure">${sermonsDisclosure(context, active, variant)}</li>`
    : html`<li><a href="${links.archive}"${attribute("aria-current", active === "sermons" ? "page" : null)}>Sermons</a></li>`;
  return html`<ul class="site-nav__list">${home}${sermons}</ul>`;
}

function footerNavigation(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return links.hasTaxonomyRoutes
    ? html`<li><a href="${links.home}">Home</a></li>${sectionLinks(context, null)}`
    : html`<li><a href="${links.home}">Home</a></li><li><a href="${links.archive}">Sermons</a></li>`;
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
  const scripts = [...(preview ? ["navigation" as const] : []), ...(input.scripts ?? [])];
  const document = html`<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${preview ? "noindex, nofollow, noarchive" : input.robots}" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
    ${headMetadata(input, context)}
    <style>${raw(siteStyles([...(input.styles ?? []), ...(preview ? ["preview" as const] : [])]))}</style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    ${when(preview, html`<div class="preview-banner" role="status">Private local frontend preview · Draft content · Not public or indexable</div>`)}
    <header class="site-header">
      <div class="site-header__inner">
        <a class="wordmark" href="${links.home}">${siteName}</a>
        <nav class="site-nav" aria-label="Primary">${primaryNavigation(context, input.canonicalPath, "desktop")}</nav>
        <details class="site-menu" data-mobile-nav>
          <summary class="site-menu__summary" aria-expanded="false">Menu</summary>
          <nav class="site-menu__nav" aria-label="Mobile primary">${primaryNavigation(context, input.canonicalPath, "mobile")}</nav>
        </details>
      </div>
    </header>
    <main id="main-content" class="site-main">${input.body}</main>
    <footer class="site-footer">
      <div class="site-footer__inner">
        <p class="site-footer__name">${siteName}</p>
        <nav aria-label="Footer"><ul class="site-footer__links">${footerNavigation(context)}</ul></nav>
      </div>
    </footer>
    ${scripts.map((name) => html`<script data-enhancement="${name}">${raw(enhancementScripts[name])}</script>`)}
  </body>
</html>`;
  return document.toString().trim();
}

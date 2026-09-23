/**
 * The document shell shared by every server-rendered page and by the static
 * Astro pages: head metadata, the skip link, the preview band, an optional
 * notice band, the masthead (the church logo, the primary links with the
 * Sermons disclosure where alternate routes exist, the compact search and
 * the Give button), the main landmark, the footer (the canon strip, the
 * contact and get-involved columns, the bottom bar and the imprint), and the
 * page-scoped style and script blocks.
 *
 * This module has no Node-only imports so the static build can consume it.
 */
import type { PublicSermonFilterOptions } from "../server/repositories/sermon-repository";
import { logoAlt, logoHeight, logoPath, logoWidth } from "./assets/logo";
import { searchGlyph, socialGlyph, upGlyph } from "./components/glyphs";
import { shelfMark } from "./components/marks";
import { mastheadSearch } from "./components/search";
import { canonStrip } from "./components/shelf";
import {
  bottomBarCopy,
  contactCopy,
  footerServicesCopy,
  getInvolvedCopy,
  homeSections,
  navigationCopy,
  sermonsCopy,
  socialPlatforms
} from "./content/home-content";
import { attribute, documentTitle, html, raw, type Html, when } from "./html";
import { canonicalOrigin, sermonsV1Path, sermonsV4Path, siteLinks, type FrontendRenderContext, type FrontendTaxonomyKind, publicRenderContext } from "./routes";
import { enhancementScripts, type EnhancementScriptName } from "./scripts";
import { siteStyles, type StyleBlockName } from "./styles";
import { colour } from "./tokens";

export type RobotsDirective = "index, follow" | "noindex, follow" | "noindex, nofollow";

export interface PageShellInput {
  /** Page title without the site name suffix. */
  title: string;
  description?: string;
  canonicalPath: string;
  /** Alternate presentations share the archive canonical but select their own menu item. */
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
  /** A band rendered above the masthead (the homepage's church notice). */
  notice?: Html;
  /** The footer's "Recent Sermon" column; omitted on pages without the newest sermon. */
  footerSermon?: Html;
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

/**
 * A label whose destination this application does not own. It is rendered
 * verbatim as a non-interactive label with a visually hidden qualifier;
 * never a guessed link, never a disabled button.
 */
export function pendingLabel(label: string, className = ""): Html {
  return html`<span class="pending${className ? ` ${className}` : ""}">${label}<span class="sr-only"> (link not yet available)</span></span>`;
}

function sermonsMenu(context: FrontendRenderContext, navigationPath: string, active: string | null): Html {
  const links = siteLinks(context);
  const items = links.hasTaxonomyRoutes ? sections : sections.slice(0, 1);
  if (!links.hasTaxonomyRoutes) {
    return html`<a href="${links.archive}"${attribute("aria-current", active === "sermons" ? "page" : null)}>${navigationCopy.sermons}</a>`;
  }
  const v1Active = navigationPath === sermonsV1Path;
  const v4Active = navigationPath === sermonsV4Path;
  return html`<details class="masthead__menu" data-sermon-menu>
      <summary class="masthead__menu-toggle${active || v1Active || v4Active ? " is-active" : ""}" aria-controls="sermon-navigation" title="Open menu; double-click to browse SermonsV2">${navigationCopy.sermons}<span class="masthead__chevron" aria-hidden="true"></span></summary>
      <ul class="masthead__dropdown" id="sermon-navigation"><li><a href="${links.sermonsV1}"${attribute("aria-current", v1Active ? "page" : null)}>SermonsV1</a></li>${items.map(([section, label]) => html`<li><a href="${section === "sermons" ? links.archive : links.taxonomyIndex(section)}"${when(section === "sermons", () => html` data-sermon-archive`)}${attribute("aria-current", active === section ? "page" : null)}>${section === "sermons" ? "SermonsV2" : label}</a></li>${when(section === "sermons", () => html`<li><a href="${links.sermonsV4}"${attribute("aria-current", v4Active ? "page" : null)}>SermonsV4</a></li>`)}`)}</ul>
    </details>`;
}

function navigationLinks(context: FrontendRenderContext, navigationPath: string): Html {
  const links = siteLinks(context);
  const active = activeSection(navigationPath);
  return html`<ul class="masthead__links"><li><a href="${links.home}#${homeSections.about}">${navigationCopy.aboutUs}</a></li><li class="masthead__links-sermons">${sermonsMenu(context, navigationPath, active)}</li><li><a href="${links.home}#${homeSections.events}">${navigationCopy.newsEvents}</a></li><li><a href="${links.home}#${homeSections.contact}">${navigationCopy.contactUs}</a></li></ul>`;
}

/** The church's own logo, served from the site's embedded asset route. */
export function churchLogo(className = "brand__logo"): Html {
  return html`<img class="${className}" src="${logoPath}" width="${logoWidth}" height="${logoHeight}" alt="${logoAlt}" decoding="async" />`;
}

function brand(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<a class="brand" href="${links.home}">${churchLogo()}<span class="sr-only">, ${navigationCopy.home}</span></a>`;
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

function footerColumns(input: PageShellInput, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<div class="footer-columns">
        <section class="footer-col" id="${homeSections.contact}" aria-labelledby="footer-contact-heading">
          <h2 class="footer-col__title" id="footer-contact-heading">${contactCopy.heading}</h2>
          <address class="footer-col__address"><span>${contactCopy.name}</span><span>${contactCopy.addressLine1}</span><span>${contactCopy.addressLine2}</span><span>${contactCopy.telephone}</span><span>${contactCopy.email}</span></address>
          ${pendingLabel(contactCopy.directions, "footer-col__pending")}
        </section>
        <nav class="footer-col" aria-labelledby="footer-involved-heading">
          <h2 class="footer-col__title" id="footer-involved-heading">${getInvolvedCopy.heading}</h2>
          <ul class="footer-col__list" role="list">
            <li><a href="${links.home}#${homeSections.about}">${getInvolvedCopy.aboutUs}</a></li>
            <li><a href="${links.archive}">${getInvolvedCopy.sermons}</a></li>
            <li><a href="${links.home}#pillar-our-faith">${getInvolvedCopy.whatWeTeach}</a></li>
            <li>${pendingLabel(getInvolvedCopy.ministries, "footer-col__pending")}</li>
            <li>${pendingLabel(getInvolvedCopy.blogs, "footer-col__pending")}</li>
          </ul>
        </nav>
        ${when(input.footerSermon, () => html`<section class="footer-col footer-col--sermon" aria-labelledby="footer-sermon-heading">
          <h2 class="footer-col__title" id="footer-sermon-heading">${sermonsCopy.footerHeading}</h2>
          ${input.footerSermon}
        </section>`)}
        <section class="footer-col" aria-labelledby="footer-services-heading">
          <h2 class="footer-col__title" id="footer-services-heading">${footerServicesCopy.heading}</h2>
          <ul class="footer-col__list" role="list"><li>${footerServicesCopy.morning}</li><li>${footerServicesCopy.evening}</li></ul>
        </section>
      </div>
      <div class="footer-bar">
        <p class="footer-bar__copyright">${bottomBarCopy.copyright}</p>
        <a class="footer-bar__top" href="#${homeSections.top}">${upGlyph()}<span class="sr-only">${bottomBarCopy.backToTop}</span></a>
        <p class="footer-bar__follow"><span class="footer-bar__label">${bottomBarCopy.followUs}</span>${socialPlatforms.map((platform) => html`<span class="footer-bar__glyph pending"><span aria-hidden="true">${socialGlyph(platform.id)}</span><span class="sr-only">${platform.name} (link not yet available)</span></span>`)}<a class="footer-bar__glyph footer-bar__glyph--link" href="${links.archive}#sermon-search">${searchGlyph()}<span class="sr-only">Search sermons</span></a></p>
      </div>`;
}

/** Renders a complete HTML document. */
export function pageShell(input: PageShellInput, context: FrontendRenderContext = publicRenderContext): string {
  const links = siteLinks(context);
  const preview = context.mode === "preview" || context.mode === "draft-preview";
  const previewLabel = context.mode === "draft-preview"
    ? "Protected D-160 draft preview · Awaiting administrator review · Not public or indexable"
    : "Private local frontend preview · Draft content · Not public or indexable";
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
    ${when(preview, () => html`<div class="preview-band" role="status">${shelfMark()}<span>${previewLabel}</span></div>`)}
    ${input.notice}
    <header class="masthead" id="${homeSections.top}">
      <div class="masthead__inner">
        ${brand(context)}
        <nav class="masthead__nav" aria-label="Primary">${navigationLinks(context, input.navigationPath ?? input.canonicalPath)}</nav>
        <div class="masthead__actions">${when(input.mastheadSearch !== false, () => mastheadSearch(context))}<a class="button masthead__give" href="${links.home}#${homeSections.give}">${navigationCopy.give}</a></div>
      </div>
    </header>
    <main id="main-content" class="site-main">${input.body}</main>
    <footer class="site-footer">
      ${canonStrip({ books: input.books ?? [] })}
      <div class="site-footer__band">
        <div class="site-footer__inner">
          ${footerColumns(input, context)}
          <div class="site-footer__imprint">
            ${brand(context)}
            <nav aria-label="Footer"><ul class="site-footer__links">${(links.hasTaxonomyRoutes ? sections : sections.slice(0, 1)).map(([section, label]) => html`<li><a href="${section === "sermons" ? links.archive : links.taxonomyIndex(section)}">${label}</a></li>`)}</ul></nav>
            <p class="site-footer__note">Every sermon is shelved under the Bible book it was preached from. The bookshelf mark used in the archive is this website's own device; the Saving Grace Bible Church logo is the church's own.</p>
          </div>
        </div>
      </div>
    </footer>
    ${scripts.map((name) => html`<script data-enhancement="${name}">${raw(enhancementScripts[name])}</script>`)}
  </body>
</html>`;
  return document.toString().trim();
}

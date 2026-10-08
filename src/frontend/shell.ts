/**
 * The document shell shared by every server-rendered page and by the static
 * Astro pages: head metadata, the skip link, the preview band, an optional
 * notice band, the masthead (the church logo, the primary menu with its
 * About Us and Ministries disclosures and the Sermons disclosure where
 * alternate routes exist, the compact search and the Give button), the
 * main landmark, the footer (the canon strip, the contact and get-involved
 * columns, the bottom bar and the imprint), and the page-scoped style and
 * script blocks.
 *
 * This module has no Node-only imports so the static build can consume it.
 */
import { defaultSiteSettings, siteSettings } from "./content/site-snapshot";
import { destinationAvailable } from "./content/registry";
import { inline, resolveHref } from "./content/markup";
import type { PublicSermonFilterOptions } from "../server/repositories/sermon-repository";
import { logoAlt, logoHeight, logoPath, logoWidth } from "./assets/logo";
import { faviconPath, siteImage, touchIconPath } from "./assets/media";
import { searchGlyph, socialGlyph, upGlyph } from "./components/glyphs";
import { shelfMark } from "./components/marks";
import { mastheadSearch } from "./components/search";
import { canonStrip } from "./components/shelf";
import { homeSections } from "./content/home-content";
import { activeMenuItem, sitePath, type MenuItem } from "./content/navigation";
import { attribute, html, raw, type Html, when } from "./html";
import { canonicalOrigin, sermonsV1Path, sermonsV4Path, sermonsV5Path, siteLinks, type FrontendRenderContext, type FrontendTaxonomyKind, publicRenderContext } from "./routes";
import { enhancementScripts, type EnhancementScriptName } from "./scripts";
import { siteStyles, type StyleBlockName } from "./styles";

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

const sections: ReadonlyArray<readonly [FrontendTaxonomyKind | "sermons", string]> = [
  ["sermons", "Sermons"],
  ["speakers", "Speakers"],
  ["series", "Series"],
  ["books", "Books"]
];

function activeSection(canonicalPath: string): string | null {
  const path = sitePath(canonicalPath);
  return sections.find(([section]) => (
    path === `/${section}/` || path.startsWith(`/${section}/`)
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

const chevron = html`<span class="masthead__chevron" aria-hidden="true"></span>`;

function nestedMenuItems(items:readonly MenuItem[],depth=0):MenuItem[]{
  return items.filter(item=>item.enabled!==false).flatMap(item=>[{...item,...(depth>0?{sub:true}:{})},...nestedMenuItems(item.children??[],depth+1)]);
}

function sermonsMenu(context: FrontendRenderContext, navigationPath: string, active: string | null, menuLabel?:string): Html {
  const {navigationCopy}=siteSettings(context);
  const links = siteLinks(context);
  const items = links.hasTaxonomyRoutes ? sections : sections.slice(0, 1);
  const current = activeMenuItem(navigationPath, siteSettings(context).primaryMenu)?.id === "sermons";
  if (!links.hasTaxonomyRoutes) {
    return html`<a href="${links.sermonsV4}"${attribute("aria-current", current ? "page" : null)}>${menuLabel ?? navigationCopy.sermons}</a>`;
  }
  const v1Active = sitePath(navigationPath) === sermonsV1Path;
  const v4Active = sitePath(navigationPath) === sermonsV4Path;
  const v5Active = sitePath(navigationPath) === sermonsV5Path;
  return html`<details class="masthead__menu" data-menu data-sermon-menu>
      <summary class="masthead__menu-toggle${active || v1Active || v4Active || v5Active ? " is-active" : ""}" aria-controls="sermon-navigation" title="Open menu; double-click to browse SermonsV4">${menuLabel ?? navigationCopy.sermons}${chevron}</summary>
      <ul class="masthead__dropdown" id="sermon-navigation"><li><a href="${links.sermonsV1}"${attribute("aria-current", v1Active ? "page" : null)}>SermonsV1</a></li>${items.map(([section, label]) => html`<li><a href="${section === "sermons" ? links.archive : links.taxonomyIndex(section)}"${attribute("aria-current", active === section ? "page" : null)}>${section === "sermons" ? "SermonsV2" : label}</a></li>${when(section === "sermons", () => html`<li><a href="${links.sermonsV4}" data-sermon-archive${attribute("aria-current", v4Active ? "page" : null)}>SermonsV4</a></li><li><a href="${links.sermonsV5}"${attribute("aria-current", v5Active ? "page" : null)}>SermonsV5</a></li>`)}`)}</ul>
    </details>`;
}

function menuDisclosure(item: MenuItem, context: FrontendRenderContext, navigationPath: string): Html {
  const path = sitePath(navigationPath);
  const active = activeMenuItem(navigationPath, siteSettings(context).primaryMenu)?.id === item.id;
  const id = `menu-${item.id ?? item.label.toLowerCase().replace(/[^a-z0-9]+/gu,"-")}`;
  return html`<details class="masthead__menu" data-menu>
      <summary class="masthead__menu-toggle${active ? " is-active" : ""}" aria-controls="${id}">${item.label}${chevron}</summary>
      <ul class="masthead__dropdown masthead__dropdown--wide" id="${id}"><li><a href="${resolveHref(item.href,context)}"${attribute("aria-current", path === item.href ? "page" : null)}>${item.label}<span class="sr-only"> overview</span></a></li>${nestedMenuItems(item.children ?? []).filter(child=>destinationAvailable(child.href,context)).map((child) => html`<li${attribute("class", child.sub ? "masthead__dropdown-sub" : null)}><a href="${resolveHref(child.href,context)}"${attribute("aria-current", path === child.href ? "page" : null)}>${child.label}</a></li>`)}</ul>
    </details>`;
}

function navigationLinks(context: FrontendRenderContext, navigationPath: string): Html {
  const {primaryMenu}=siteSettings(context);
  const active = activeSection(navigationPath);
  const currentTop = activeMenuItem(navigationPath, siteSettings(context).primaryMenu);
  return html`<ul class="masthead__links">${primaryMenu.filter(item=>item.enabled!==false&&destinationAvailable(item.href,context)).map((item) => {
    if (item.id === "sermons") return html`<li class="masthead__links-sermons">${sermonsMenu(context, navigationPath, active, item.label)}</li>`;
    if (item.children) return html`<li class="masthead__links-menu">${menuDisclosure(item, context, navigationPath)}</li>`;
    return html`<li><a href="${resolveHref(item.href,context)}"${attribute("aria-current", currentTop === item && sitePath(navigationPath) === item.href ? "page" : null)}>${item.label}</a></li>`;
  })}</ul>`;
}

/** The church's own logo, served from the site's embedded asset route. */
export function churchLogo(className = "brand__logo", context:FrontendRenderContext=publicRenderContext): Html {
  const {branding}=siteSettings(context);
  const image=context.siteContent?.assets[branding.logoAsset];
  if(image)return html`<img class="${className}" src="${image.path}" width="${image.width}" height="${image.height}" alt="${branding.logoAlt}" decoding="async" />`;
  return html`<img class="${className}" src="${logoPath}" width="${logoWidth}" height="${logoHeight}" alt="${logoAlt}" decoding="async" />`;
}

/** The church's white logo for the footer's ink band. */
function footerLogo(context:FrontendRenderContext): Html {
  const {branding}=siteSettings(context);
  const image = context.siteContent?.assets[branding.footerLogoAsset] ?? siteImage("logo-white");
  return html`<img class="brand__logo brand__logo--inverse" src="${image.path}" width="${image.width}" height="${image.height}" alt="${branding.logoAlt}" loading="lazy" decoding="async" />`;
}

function brand(context: FrontendRenderContext, inverse = false): Html {
  const {navigationCopy}=siteSettings(context);
  const links = siteLinks(context);
  return html`<a class="brand" href="${links.home}">${inverse ? footerLogo(context) : churchLogo("brand__logo",context)}<span class="sr-only">, ${navigationCopy.home}</span></a>`;
}

function headMetadata(input: PageShellInput, context: FrontendRenderContext): Html {
  if (context.mode !== "public") return html``;
  const canonicalUrl = `${canonicalOrigin}${input.canonicalPath}`;
  const title = input.suffixTitle === false ? input.title : `${input.title} — ${siteSettings(context).siteName}`;
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
  const {contactCopy,footerServicesCopy,bottomBarCopy,footerMenu,socialPlatforms,footerVisibility,getInvolvedHeading,sermonFooterHeading}=siteSettings(context);
  const links = siteLinks(context);
  return html`<div class="footer-columns">
        ${when(footerVisibility.contact,()=>html`<section class="footer-col" id="${homeSections.contact}" aria-labelledby="footer-contact-heading">
          <h2 class="footer-col__title" id="footer-contact-heading">${contactCopy.heading}</h2>
          <address class="footer-col__address"><span>${contactCopy.name}</span><span>${contactCopy.addressLine1}</span><span>${contactCopy.addressLine2}</span><span><a href="${contactCopy.telephoneHref}">${contactCopy.telephone}</a></span><span><a href="mailto:${contactCopy.emailAddress}">${contactCopy.email}</a></span></address>
          <p class="footer-col__directions"><a href="${contactCopy.directionsHref}" rel="noopener">${contactCopy.directions}<span class="sr-only"> (external site)</span></a></p>
        </section>`)}
        ${when(footerVisibility.navigation,()=>html`<nav class="footer-col" aria-labelledby="footer-involved-heading">
          <h2 class="footer-col__title" id="footer-involved-heading">${getInvolvedHeading}</h2>
          <ul class="footer-col__list" role="list">${nestedMenuItems(footerMenu).filter(item=>destinationAvailable(item.href,context)).map((item) => html`<li><a href="${item.href === "/sermons/" ? links.archive : resolveHref(item.href,context)}">${item.label}</a></li>`)}</ul>
        </nav>`)}
        ${when(footerVisibility.recentSermon && input.footerSermon, () => html`<section class="footer-col footer-col--sermon" aria-labelledby="footer-sermon-heading">
          <h2 class="footer-col__title" id="footer-sermon-heading">${sermonFooterHeading}</h2>
          ${input.footerSermon}
        </section>`)}
        ${when(footerVisibility.services,()=>html`<section class="footer-col" aria-labelledby="footer-services-heading">
          <h2 class="footer-col__title" id="footer-services-heading">${footerServicesCopy.heading}</h2>
          <ul class="footer-col__list" role="list"><li>${footerServicesCopy.morning}</li><li>${footerServicesCopy.evening}</li></ul>
          <p class="footer-col__more"><a href="${resolveHref(footerServicesCopy.morningHref ?? "/lords-day-service/",context)}">${footerServicesCopy.morningLink}</a> · <a href="${resolveHref(footerServicesCopy.eveningHref ?? "/evening-service/",context)}">${footerServicesCopy.eveningLink}</a></p>
        </section>`)}
      </div>
      <div class="footer-bar">
        <p class="footer-bar__copyright">${bottomBarCopy.copyright}</p>
        <a class="footer-bar__top" href="#${homeSections.top}">${upGlyph()}<span class="sr-only">${bottomBarCopy.backToTop}</span></a>
        ${when(footerVisibility.social,()=>html`<p class="footer-bar__follow"><span class="footer-bar__label">${bottomBarCopy.followUs}</span>${socialPlatforms.filter(platform=>platform.enabled).map((platform) => platform.href ? html`<a class="footer-bar__glyph footer-bar__glyph--link" href="${resolveHref(platform.href,context)}" rel="noopener"><span aria-hidden="true">${socialGlyph(platform.id)}</span><span class="sr-only">${platform.name}</span></a>` : html`<span class="footer-bar__glyph pending"><span aria-hidden="true">${socialGlyph(platform.id)}</span><span class="sr-only">${platform.name} (link not yet available)</span></span>`)}${when(socialPlatforms.some(platform=>platform.enabled&&!platform.href),()=>html`<span class="footer-bar__availability">Links not yet available</span>`)}<a class="footer-bar__glyph footer-bar__glyph--link" href="${links.archive}#sermon-search">${searchGlyph()}<span class="sr-only">Search sermons</span></a></p>`)}
      </div>`;
}

/** Renders a complete HTML document. */
export function pageShell(input: PageShellInput, context: FrontendRenderContext = publicRenderContext): string {
  const {branding,footerVisibility,siteName}=siteSettings(context);
  const settings=siteSettings(context);
  const headerAction=settings.headerAction ?? defaultSiteSettings.headerAction!;
  const archiveAbout=settings.archiveAbout ?? defaultSiteSettings.archiveAbout!;
  const footerExtraMenu=settings.footerExtraMenu ?? defaultSiteSettings.footerExtraMenu!;
  const preview = context.mode === "preview" || context.mode === "draft-preview";
  const previewLabel = context.mode === "draft-preview"
    ? "Protected D-160 draft preview · Awaiting administrator review · Not public or indexable"
    : "Private local frontend preview · Draft content · Not public or indexable";
  const title = input.suffixTitle === false ? input.title : `${input.title} — ${siteName}`;
  const scripts = [...new Set<EnhancementScriptName>([...(input.scripts ?? []), "navigation", "mobileNavigation"])];
  const document = html`<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${context.mode !== "public" ? "noindex, nofollow, noarchive" : input.robots}" />
    <meta name="color-scheme" content="light" />
    <link rel="icon" href="${context.siteContent?.assets[branding.faviconAsset]?.path ?? faviconPath}" sizes="32x32" type="image/png" />
    <link rel="apple-touch-icon" href="${context.siteContent?.assets[branding.touchIconAsset]?.path ?? touchIconPath}" sizes="192x192" />
    <title>${title}</title>
    ${headMetadata(input, context)}
    <style>${raw(siteStyles([...(input.styles ?? []), ...(preview ? ["preview" as const] : [])]))}</style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to main content</a>
    ${when(preview, () => html`<div class="preview-band" role="status">${shelfMark()}<span>${previewLabel}</span></div>`)}
    ${input.notice}
    <header class="masthead" id="${homeSections.top}" data-site-header>
      <div class="masthead__inner">
        ${brand(context)}
        <button class="masthead__mobile-toggle" type="button" aria-controls="primary-navigation" aria-expanded="false" data-site-toggle hidden>Menu<span class="masthead__chevron" aria-hidden="true"></span></button>
        <nav class="masthead__nav" id="primary-navigation" aria-label="Primary">${navigationLinks(context, input.navigationPath ?? input.canonicalPath)}</nav>
        <div class="masthead__actions">${when(input.mastheadSearch !== false, () => mastheadSearch(context))}${when(headerAction.enabled&&destinationAvailable(headerAction.href,context),()=>html`<a class="button masthead__give" href="${resolveHref(headerAction.href,context)}">${headerAction.label}</a>`)}</div>
      </div>
    </header>
    <main id="main-content" class="site-main">${input.body}</main>
    <footer class="site-footer">
      ${canonStrip({ books: input.books ?? [] })}
      <div class="site-footer__band">
        <div class="site-footer__inner">
          ${footerColumns(input, context)}
          <div class="site-footer__imprint">
            ${brand(context, true)}
            ${when(footerVisibility.archiveLinks,()=>html`<nav aria-label="Footer"><ul class="site-footer__links">${nestedMenuItems(footerExtraMenu).filter(item=>destinationAvailable(item.href,context)).map(item=>html`<li><a href="${resolveHref(item.href,context)}">${item.label}</a></li>`)}</ul></nav>`)}
            ${when(archiveAbout.enabled,()=>html`<details class="site-footer__about"><summary>${archiveAbout.heading}</summary><p class="site-footer__note">${inline(archiveAbout.text,context)}</p></details>`)}
          </div>
        </div>
      </div>
    </footer>
    ${scripts.map((name) => html`<script data-enhancement="${name}">${raw(enhancementScripts[name])}</script>`)}
  </body>
</html>`;
  return document.toString().trim();
}

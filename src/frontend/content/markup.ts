/**
 * The tiny inline markup used by the church content modules, so that
 * transcribed WordPress copy keeps its links and emphasis without carrying
 * any HTML or WordPress-specific code into the application:
 *
 *   [label](href)   a link (internal root-relative, #fragment, https, mailto or tel)
 *   **text**        strong emphasis
 *   _text_          emphasis (only around whole words or phrases)
 *   line break      a "\n" inside a paragraph becomes <br />
 *
 * Everything else is escaped. Internal links are prefixed with the render
 * context's base path so the same content serves the public site and the
 * authenticated preview. External links are marked so the stylesheet can
 * show an outward glyph, and never receive target="_blank".
 */
import { escapeHtml, html, raw, type Html } from "../html";
import { contextualPath, type FrontendRenderContext } from "../routes";
import {legacyDisposition} from './registry';

const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/gu;

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//iu.test(href);
}

export function resolveHref(href: string, context: FrontendRenderContext): string {
  if (href.startsWith("/")&&!href.startsWith('//')) {
    const split=href.search(/[?#]/u),path=split<0?href:href.slice(0,split),suffix=split<0?'':href.slice(split);
    const disposition=legacyDisposition(path,context)??(!path.endsWith('/')?legacyDisposition(`${path}/`,context):null);
    return contextualPath(context,(disposition?.kind==='redirect'?disposition.location:path)+suffix);
  }
  return href;
}

function allowedHref(href: string): boolean {
  return href.startsWith("/") || href.startsWith("#") || /^(https?:\/\/|mailto:|tel:)/iu.test(href);
}

function emphasis(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
    .replace(/(^|[\s(“"])_([^_\n][^_]*?)_(?=$|[\s.,;:!?)”"])/gu, "$1<em>$2</em>")
    .replaceAll("\n", "<br />");
}

/** Renders inline markup to escaped HTML. */
export function inline(text: string, context: FrontendRenderContext): Html {
  let output = "";
  let last = 0;
  for (const match of text.matchAll(linkPattern)) {
    const [whole, label, href] = match as unknown as [string, string, string];
    output += emphasis(escapeHtml(text.slice(last, match.index)));
    const disposition=href.startsWith('/')?legacyDisposition(href.split(/[?#]/u)[0]!,context):null;
    if (!allowedHref(href)||disposition?.kind==='gone'||disposition?.kind==='unavailable') {
      output += emphasis(escapeHtml(label));
    } else {
      const external = isExternalHref(href);
      output += `<a href="${escapeHtml(resolveHref(href, context))}"${external ? ' class="external" rel="noopener"' : ""}>${emphasis(escapeHtml(label))}</a>`;
    }
    last = match.index! + whole.length;
  }
  output += emphasis(escapeHtml(text.slice(last)));
  return raw(output);
}

/** The plain words of a markup string, for excerpts and metadata. */
export function plainText(text: string): string {
  return text.replace(linkPattern, "$1").replace(/\*\*|(^|\s)_|_(?=\s|$)/gu, "$1").replace(/\s+/gu, " ").trim();
}

/** Every href a markup string contains, for link audits. */
export function markupHrefs(text: string): string[] {
  return Array.from(text.matchAll(linkPattern), (match) => match[2]!);
}

export function paragraph(text: string, context: FrontendRenderContext, className?: string): Html {
  return html`<p${className ? raw(` class="${escapeHtml(className)}"`) : ""}>${inline(text, context)}</p>`;
}

/**
 * Renders the church content blocks (content/types.ts) into markup. Every
 * string passes through the inline markup renderer, which escapes text and
 * validates links; images come from the embedded media registry; event
 * dates are computed from the schedules for the render's "today".
 */
import type { SermonSummary } from "../../domain/sermon";
import { siteImage, type MediaId, type SiteImage } from "../assets/media";
import { eventById, formatLongDate, formatTimeRange, nextOccurrence } from "../content/events";
import { inline, isExternalHref, paragraph, plainText, resolveHref } from "../content/markup";
import { destinationAvailable } from "../content/registry";
import type { Block, Person, Tile } from "../content/types";
import { attribute, html, when, type Html } from "../html";
import { siteLinks, type FrontendRenderContext } from "../routes";
import { pendingLabel } from "../shell";
import { cardGrid } from "./cards";
import { shelfMark } from "./marks";
import { sectionNote } from "./sections";

export interface BlockEnvironment {
  context: FrontendRenderContext;
  /** ISO calendar date in Melbourne, for "our next study". */
  today: string;
  /** Newest published sermons, for the sermon-cards block. */
  sermons: SermonSummary[];
}

export interface PictureOptions {
  className?: string;
  eager?: boolean;
  /** Overrides the registry alt (for example when a caption already describes the image). */
  alt?: string;
}

/** An `<img>` for a registry image with its intrinsic size, lazy unless eager. */
export function picture(id: MediaId, options: PictureOptions = {}): Html {
  const image: SiteImage = siteImage(id);
  return html`<img${attribute("class", options.className ?? null)} src="${image.path}" width="${image.width}" height="${image.height}" alt="${options.alt ?? image.alt}"${when(!options.eager, () => html` loading="lazy"`)} decoding="async" />`;
}

function externalLink(href: string, label: Html | string, className = ""): Html {
  const external = isExternalHref(href);
  return html`<a${attribute("class", className || null)} href="${href}"${when(external, () => html` rel="noopener"`)}>${label}${when(external, () => html`<span class="sr-only"> (external site)</span>`)}</a>`;
}

/** A tile's link, or the verbatim label as a pending label when its destination is not published in this context. */
function tileLink(tile: Tile, env: BlockEnvironment, label: string): Html {
  if (!tile.href || !destinationAvailable(tile.href, env.context)) return pendingLabel(label, "tile__more tile__more--pending");
  return html`<a class="tile__more" href="${resolveHref(tile.href, env.context)}">${label}<span class="sr-only"> about ${tile.title}</span></a>`;
}

function tiles(block: Extract<Block, { kind: "tiles" }>, env: BlockEnvironment): Html {
  const columns = block.columns ?? 3;
  return html`<ul class="tiles tiles--${columns}" role="list">${block.items.map((tile) => {
    const linked = Boolean(tile.href && destinationAvailable(tile.href, env.context));
    return html`<li class="tile${tile.media ? " tile--pictured" : ""}${linked ? " tile--linked" : ""}">
      ${when(tile.media, () => html`<div class="tile__picture">${picture(tile.media!, { className: "tile__image", alt: "" })}</div>`)}
      <div class="tile__body">
        ${when(tile.eyebrow, () => html`<p class="eyebrow tile__eyebrow">${tile.eyebrow}</p>`)}
        <h3 class="tile__title">${linked ? html`<a href="${resolveHref(tile.href!, env.context)}">${tile.title}</a>` : tile.title}</h3>
        ${when(tile.text, () => html`<p class="tile__text">${inline(tile.text!, env.context)}</p>`)}
        ${when(tile.linkLabel, () => tileLink(tile, env, tile.linkLabel!))}
      </div>
    </li>`;
  })}</ul>`;
}

function person(item: Person, env: BlockEnvironment): Html {
  return html`<li class="person">
    ${when(item.media, () => html`<div class="person__picture">${picture(item.media!, { className: "person__image" })}</div>`)}
    <div class="person__body">
      <h3 class="person__name">${item.name}</h3>
      <p class="person__role">${item.role}</p>
      ${item.text.map((text) => paragraph(text, env.context, "person__text"))}
      ${when(item.email, () => html`<p class="person__contact"><a href="mailto:${item.email}">${item.email}</a></p>`)}
    </div>
  </li>`;
}

function nextEvent(block: Extract<Block, { kind: "next-event" }>, env: BlockEnvironment): Html {
  const event = eventById(block.event);
  const occurrence = nextOccurrence(block.event, env.today);
  const links = siteLinks(env.context);
  const href = links.path(event.path);
  return html`<p class="next-event"><span class="next-event__label">${block.label}</span> ${occurrence
    ? html`<a class="next-event__link" href="${href}"><time datetime="${occurrence.date}">${formatLongDate(occurrence.date)}</time>, ${formatTimeRange(occurrence.start, occurrence.end)}</a>`
    : html`<a class="next-event__link" href="${href}">${event.title}: no upcoming date is scheduled</a>`}</p>`;
}

function videoPlate(input: { title: string; videoId?: string; listId?: string }): Html {
  const external = input.videoId ? `https://www.youtube.com/watch?v=${input.videoId}` : `https://www.youtube.com/playlist?list=${input.listId}`;
  const kind = input.videoId ? "video" : "playlist";
  return html`<div class="plate plate--church" data-video-frame>
    <div class="plate__consent">
      ${shelfMark("plate__mark")}
      <p class="plate__title">${input.title}</p>
      <p class="plate__note">Loading the player connects to YouTube (youtube-nocookie.com). Nothing plays until you press play.</p>
      <p class="plate__actions"><button class="button button--onink" type="button" data-load-youtube${attribute("data-video-id", input.videoId ?? null)}${attribute("data-playlist-id", input.listId ?? null)} data-video-title="${input.title}">Load the ${kind}<span class="sr-only"> ${input.title} from youtube-nocookie.com</span></button> <a class="plate__external" href="${external}" rel="noopener">Open on YouTube<span class="sr-only"> (external site)</span></a></p>
    </div>
  </div>`;
}

export function renderBlock(block: Block, env: BlockEnvironment): Html {
  const context = env.context;
  switch (block.kind) {
    case "paragraph":
      return paragraph(block.text, context, block.lede ? "lede page__lede" : undefined);
    case "heading": {
      const tag = `h${block.level}`;
      return html`<${tag} class="page__h${block.level}"${attribute("id", block.id ?? null)}>${block.text}</${tag}>`;
    }
    case "list":
      return block.ordered
        ? html`<ol class="page__list">${block.items.map((item) => html`<li>${inline(item, context)}</li>`)}</ol>`
        : html`<ul class="page__list">${block.items.map((item) => html`<li>${inline(item, context)}</li>`)}</ul>`;
    case "quote":
      return html`<blockquote class="verse"><p>${inline(block.text, context)}</p>${when(block.cite, () => html`<footer class="verse__cite">${block.cite}</footer>`)}</blockquote>`;
    case "figure":
      return html`<figure class="figure figure--${block.size ?? "inset"}">${picture(block.media, { className: "figure__image" })}${when(block.caption, () => html`<figcaption class="figure__caption">${inline(block.caption!, context)}</figcaption>`)}</figure>`;
    case "callout":
      return html`<aside class="callout">${when(block.title, () => html`<h2 class="callout__title">${block.title}</h2>`)}<p>${inline(block.text, context)}</p></aside>`;
    case "panel":
      return html`<div class="panel">${when(block.title, () => html`<h3 class="panel__title">${block.title}</h3>`)}${block.blocks.map((child) => renderBlock(child, env))}</div>`;
    case "tiles":
      return tiles(block, env);
    case "people":
      return html`<ul class="people" role="list">${block.items.map((item) => person(item, env))}</ul>`;
    case "timeline":
      return html`<ol class="timeline" role="list">${block.items.map((item) => html`<li class="timeline__item"><span class="timeline__when">${item.when}</span><div class="timeline__body"><h3 class="timeline__title">${item.title}</h3><p class="timeline__text">${inline(item.text, context)}</p></div></li>`)}</ol>`;
    case "next-event":
      return nextEvent(block, env);
    case "video":
      return videoPlate({ title: block.title, videoId: block.videoId });
    case "playlist":
      return videoPlate({ title: block.title, listId: block.listId });
    case "downloads":
      return html`<ul class="downloads" role="list">${block.items.map((item) => html`<li class="download"><h3 class="download__title">${item.title}</h3><p class="download__text">${inline(item.text, context)}</p><p class="download__link">${externalLink(item.href, html`${item.label}<span aria-hidden="true"> ↗</span>`, "button button--outline")}</p></li>`)}</ul>`;
    case "hymns":
      return html`<ul class="hymns" role="list">${block.items.map((item) => html`<li class="hymn"><h3 class="hymn__title">${item.title}</h3><p class="hymn__text">${inline(item.text, context)}</p><p>${externalLink(item.href, html`Play &amp; Lyrics<span aria-hidden="true"> →</span>`, "hymn__link")}</p></li>`)}</ul>`;
    case "index":
      return html`<ol class="index-grid" role="list">${block.items.map((item) => html`<li class="index-grid__item"><a class="index-grid__link" href="${item.href}"><span class="index-grid__title">${item.title}</span><span class="index-grid__text">${inline(item.text, context)}</span></a></li>`)}</ol>`;
    case "sermon-cards": {
      const links = siteLinks(context);
      const recent = env.sermons.slice(0, 3);
      return html`<section class="page__sermons" aria-labelledby="page-sermons-heading">
        <h2 id="page-sermons-heading" class="page__h2">${block.heading}</h2>
        ${when(block.text, () => paragraph(block.text!, context))}
        ${recent.length ? cardGrid(recent, { links, headingLevel: 3 }) : sectionNote("No sermon is available yet. Please check back soon.")}
        <p class="page__sermons-link"><a class="button" href="${links.archive}">${block.linkLabel}</a></p>
      </section>`;
    }
    case "external-plate":
      return html`<div class="plate plate--church plate--external"><div class="plate__consent">${shelfMark("plate__mark")}<p class="plate__title">${block.title}</p><p class="plate__note">${inline(block.text, context)}</p><p class="plate__actions">${externalLink(block.href, html`${block.label}<span aria-hidden="true"> ↗</span>`, "button button--onink")}</p></div></div>`;
    case "book":
      return html`<div class="book">${picture(block.media, { className: "book__cover" })}<div class="book__text">${block.text.split(/\n\s*\n/u).map((text) => paragraph(text, context))}</div></div>`;
    case "contact-panel":
      return html`<div class="contact-panel">
        <address class="contact-panel__address"><strong class="contact-panel__name">${block.name}</strong>${block.addressLines.map((line) => html`<span>${line}</span>`)}<span><a href="${block.telephone.href}">${block.telephone.label}</a></span><span><a href="mailto:${block.email}">${block.email}</a></span></address>
        <p class="contact-panel__actions"><a class="button" href="mailto:${block.email}">Send us an email</a> ${externalLink(block.map.href, html`${block.map.label}<span aria-hidden="true"> →</span>`, "button button--outline")}</p>
      </div>`;
    case "giving-methods":
      return html`<div class="giving">
        <h2 class="page__h2">Ways to make an offering</h2>
        <p class="giving__intro">${inline(block.intro, context)}</p>
        <p class="giving__cta">${externalLink(block.button.href, html`${block.button.label}<span aria-hidden="true"> ↗</span>`, "button")}</p>
        <ul class="giving__methods" role="list">${block.methods.map((method) => html`<li class="giving__method"><h3 class="giving__method-title">${method.title}</h3><p>${inline(method.text, context)}</p></li>`)}</ul>
        <div class="giving__details">
          <section class="giving__bank" aria-labelledby="giving-bank-heading"><h3 id="giving-bank-heading" class="giving__method-title">${block.bank.title}</h3><p><strong>${block.bank.account}</strong></p>${block.bank.lines.map((line) => html`<p class="tabular">${line}</p>`)}</section>
          <section class="giving__online" aria-labelledby="giving-online-heading"><h3 id="giving-online-heading" class="giving__method-title">${block.online.title}</h3><ul class="page__list">${block.online.links.map((link) => html`<li>${externalLink(link.href, html`${link.label}<span aria-hidden="true"> ↗</span>`)}</li>`)}</ul></section>
        </div>
      </div>`;
    case "events-calendar":
      return html``;
    default:
      return html``;
  }
}

export function renderBlocks(blocks: readonly Block[], env: BlockEnvironment): Html {
  return html`${blocks.map((block) => renderBlock(block, env))}`;
}

/** The words of a page's first paragraph, for listings. */
export function firstParagraph(blocks: readonly Block[]): string {
  const block = blocks.find((candidate) => candidate.kind === "paragraph");
  return block && block.kind === "paragraph" ? plainText(block.text) : "";
}

/** Whether the blocks include a click-to-load video or playlist, so the page embeds the loader. */
export function hasVideo(blocks: readonly Block[]): boolean {
  return blocks.some((block) => block.kind === "video" || block.kind === "playlist" || (block.kind === "panel" && hasVideo(block.blocks)));
}

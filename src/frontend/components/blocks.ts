/**
 * Renders the church content blocks (content/types.ts) into markup. Every
 * string passes through the inline markup renderer, which escapes text and
 * validates links; images come from the embedded media registry; event
 * dates are computed from the schedules for the render's "today".
 */
import {editAttributes,editField,editSection,fieldPath,hiddenSection,type CmsContentPath,type CmsRenderMetadata} from "../editing";
import {renderSourceContent} from '../source-content';
import type { CmsHomeBlock } from "../../cms/model";
import { renderCmsHomeBlock } from "../pages/home";
import { renderBlogListing, renderSitemapListing, renderEventCalendar } from "../pages/church";
import type { SermonSummary } from "../../domain/sermon";
import { siteImage, type MediaId } from "../assets/media";
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
  sermonSelections?: Readonly<Record<string, SermonSummary[]>>;
}

export interface PictureOptions {
  className?: string;
  eager?: boolean;
  /** Overrides the registry alt (for example when a caption already describes the image). */
  alt?: string;
  context?: FrontendRenderContext;
  focalPoint?: {x:number;y:number};
  editPath?:CmsContentPath|undefined;
}

/** An `<img>` for a registry image with its intrinsic size, lazy unless eager. */
export function picture(id: string, options: PictureOptions = {}): Html {
  const image = options.context?.siteContent?.assets[id] ?? siteImage(id as MediaId);
  if (!image) return html``;
  const x=options.focalPoint?.x ?? ("focalX" in image ? image.focalX : undefined);
  const y=options.focalPoint?.y ?? ("focalY" in image ? image.focalY : undefined);
  const focal=typeof x==="number"&&typeof y==="number"&&Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=100&&y>=0&&y<=100 ? {x,y} : null;
  const focalClass=focal ? `cms-focal-${String(focal.x).replace(".","_")}-${String(focal.y).replace(".","_")}` : "";
  return html`${focal?html`<style>.${focalClass}{object-position:${focal.x}% ${focal.y}%}</style>`:html``}<img${options.context?editAttributes(options.context,options.editPath,"image","Image"):html``}${attribute("class", [options.className,focalClass].filter(Boolean).join(" ") || null)} src="${image.path}" width="${image.width}" height="${image.height}" alt="${options.alt ?? image.alt}"${when(!options.eager, () => html` loading="lazy"`)} decoding="async" />`;
}

function externalLink(href: string, label: Html | string, className = ""): Html {
  const external = isExternalHref(href);
  return html`<a${attribute("class", className || null)} href="${href}"${when(external, () => html` rel="noopener"`)}>${label}${when(external, () => html`<span class="sr-only"> (external site)</span>`)}</a>`;
}

/** A tile's link, or the verbatim label as a pending label when its destination is not published in this context. */
function tileLink(tile: Tile, env: BlockEnvironment, label: string,path?:CmsContentPath): Html {
  if (!tile.href || !destinationAvailable(tile.href, env.context)) return pendingLabel(label, "tile__more tile__more--pending");
  return html`<a class="tile__more"${editAttributes(env.context,path,"link","Tile link")} href="${resolveHref(tile.href, env.context)}">${label}<span class="sr-only"> about ${tile.title}</span></a>`;
}

function tiles(block: Extract<Block, { kind: "tiles" }>, env: BlockEnvironment): Html {
  const columns = block.columns ?? 3;
  return html`<ul class="tiles tiles--${columns}" role="list">${block.items.map((tile,index) => {
    const mark=(key:string,kind:"text"|"richtext"|"link"="text",label=key)=>editAttributes(env.context,fieldPath(block,"items",index,key),kind,label);
    const linked = Boolean(tile.href && destinationAvailable(tile.href, env.context));
    return html`<li class="tile${tile.media ? " tile--pictured" : ""}${linked ? " tile--linked" : ""}">
      ${when(tile.media, () => html`<div class="tile__picture">${picture(tile.media!, { className: "tile__image", alt:tile.mediaAlt ?? "", context:env.context,editPath:fieldPath(block,"items",index,"media"),...(tile.mediaFocalPoint?{focalPoint:tile.mediaFocalPoint}:{}) })}</div>`)}
      <div class="tile__body">
        <h3 class="tile__title"${mark("title","text","Tile heading")}>${linked ? html`<a${mark("title","link","Tile heading link")} href="${resolveHref(tile.href!, env.context)}">${tile.title}</a>` : tile.title}</h3>
        ${when(tile.eyebrow && tile.eyebrow !== tile.title, () => html`<p class="tile__metadata"${mark("eyebrow","text","Tile label")}>${tile.eyebrow}</p>`)}
        ${when(tile.text, () => html`<p class="tile__text"${mark("text","richtext","Tile text")}>${inline(tile.text!, env.context)}</p>`)}
        ${when(tile.linkLabel, () => tileLink(tile, env, tile.linkLabel!,fieldPath(block,"items",index,"linkLabel")))}
      </div>
    </li>`;
  })}</ul>`;
}

function person(item: Person, env: BlockEnvironment,path?:CmsContentPath): Html {
  const mark=(key:string,kind:"text"|"richtext"|"link"="text",label=key)=>editAttributes(env.context,path?[...path,key]:undefined,kind,label);
  return html`<li class="person">
    ${when(item.media, () => html`<div class="person__picture">${picture(item.media!, { className: "person__image", context:env.context,editPath:path?[...path,"media"]:undefined,...(item.mediaAlt!==undefined?{alt:item.mediaAlt}:{}),...(item.mediaFocalPoint?{focalPoint:item.mediaFocalPoint}:{}) })}</div>`)}
    <div class="person__body">
      <h3 class="person__name"${mark("name","text","Name")}>${item.name}</h3>
      <p class="person__role"${mark("role","text","Role")}>${item.role}</p>
      ${item.text.map((text,index) => editField(paragraph(text, env.context, "person__text"),env.context,path?[...path,"text",index]:undefined,"richtext","Biography"))}
      ${when(item.email, () => html`<p class="person__contact"><a${mark("email","text","Email")} href="mailto:${item.email}">${item.email}</a></p>`)}
    </div>
  </li>`;
}

function nextEvent(block: Extract<Block, { kind: "next-event" }>, env: BlockEnvironment): Html {
  const event = eventById(block.event, env.context.siteContent?.events);
  if (!event) return html``;
  const occurrence = nextOccurrence(block.event, env.today, env.context.siteContent?.events);
  const links = siteLinks(env.context);
  const href = links.path(event.path);
  return html`<p class="next-event"><span class="next-event__label"${editAttributes(env.context,fieldPath(block,"label"),"text","Gathering label")}>${block.label}</span> ${occurrence
    ? html`<a class="next-event__link" href="${href}"><time datetime="${occurrence.date}">${formatLongDate(occurrence.date)}</time>, ${formatTimeRange(occurrence.start, occurrence.end)}</a>`
    : html`<a class="next-event__link" href="${href}">${event.title}: no upcoming date is scheduled</a>`}</p>`;
}

function videoPlate(input: { title: string; videoId?: string; listId?: string },env:BlockEnvironment,path?:CmsContentPath): Html {
  const external = input.videoId ? `https://www.youtube.com/watch?v=${input.videoId}` : `https://www.youtube.com/playlist?list=${input.listId}`;
  const kind = input.videoId ? "video" : "playlist";
  return html`<div class="plate plate--church" data-video-frame>
    <div class="plate__consent">
      ${shelfMark("plate__mark")}
      <p class="plate__title"${editAttributes(env.context,path,"text","Video title")}>${input.title}</p>
      <p class="plate__note">Loading the player connects to YouTube (youtube-nocookie.com). Nothing plays until you press play.</p>
      <p class="plate__actions"><button class="button button--onink" type="button" data-load-youtube${attribute("data-video-id", input.videoId ?? null)}${attribute("data-playlist-id", input.listId ?? null)} data-video-title="${input.title}">Load the ${kind}<span class="sr-only"> ${input.title} from youtube-nocookie.com</span></button> <a class="plate__external" href="${external}" rel="noopener">Open on YouTube<span class="sr-only"> (external site)</span></a></p>
    </div>
  </div>`;
}

export function renderBlock(block: Block | CmsHomeBlock, env: BlockEnvironment): Html {
  const hidden=hiddenSection(block,env.context);if(hidden!==null)return hidden;
  return editSection(renderBlockContent(block,env),block,env.context);
}
function renderBlockContent(block: Block | CmsHomeBlock, env: BlockEnvironment): Html {
  const context = env.context;
  const mark=(key:string,kind:"text"|"richtext"|"image"|"link"|"section"="text",label=key)=>editAttributes(context,fieldPath(block,key),kind,label);
  switch (block.kind) {
    case 'source-content':
      return html`<div class="prose">${renderSourceContent(block.nodes,href=>resolveHref(href,context),{image:src=>context.siteContent?.assets[src]?.path??src,mark:(node,path)=>{const key=node.tag==='text'?'text':node.tag==='img'?'src':node.tag==='a'?'href':null;return key?editAttributes(context,fieldPath(block,'nodes',...path,key),node.tag==='img'?'image':node.tag==='a'?'link':'text',node.tag==='img'?'Original image':node.tag==='a'?'Original link':'Original text'):'';}})}</div>`;
    case "home-arrival": case "home-welcome": case "home-about": case "home-sermons": case "home-events":
      return renderCmsHomeBlock(block, {sermons:env.sermons,sermonSelections:env.sermonSelections,options:{books:[],speakers:[],series:[],passages:[],passageVerseAvailability:[]},totalItems:env.sermons.length,today:env.today}, context, (block as {cmsInstanceId?:string}).cmsInstanceId);
    case "paragraph":
      return editField(paragraph(block.text, context, block.lede ? "lede page__lede" : undefined),context,fieldPath(block,"text"),"richtext","Paragraph");
    case "heading": {
      const tag = `h${block.level}`;
      return html`<${tag}${mark("text","text","Heading")} class="page__h${block.level}"${attribute("id", block.id ?? null)}>${block.text}</${tag}>`;
    }
    case "list":
      return block.ordered
        ? html`<ol class="page__list">${block.items.map((item,index) => html`<li${editAttributes(context,fieldPath(block,"items",index),"richtext","List item")}>${inline(item, context)}</li>`)}</ol>`
        : html`<ul class="page__list">${block.items.map((item,index) => html`<li${editAttributes(context,fieldPath(block,"items",index),"richtext","List item")}>${inline(item, context)}</li>`)}</ul>`;
    case "quote":
      return html`<blockquote class="verse"><p${mark("text","richtext","Quotation")}>${inline(block.text, context)}</p>${when(block.cite, () => html`<footer class="verse__cite"${mark("cite","text","Attribution")}>${block.cite}</footer>`)}</blockquote>`;
    case "figure":
      return html`<figure class="figure figure--${block.size ?? "inset"}">${picture(block.media, { className: "figure__image", context, editPath:fieldPath(block,"media"), ...(block.alt!==undefined?{alt:block.alt}:{}), ...(block.focalPoint?{focalPoint:block.focalPoint}:{}) })}${when(block.caption, () => html`<figcaption class="figure__caption"${mark("caption","richtext","Caption")}>${inline(block.caption!, context)}</figcaption>`)}</figure>`;
    case "callout":
      return html`<aside class="callout">${when(block.title, () => html`<h2 class="callout__title"${mark("title","text","Heading")}>${block.title}</h2>`)}<p${mark("text","richtext","Text")}>${inline(block.text, context)}</p></aside>`;
    case "panel":
      return html`<div class="panel${block.columns?` cms-panel-columns cms-panel-columns--${block.columns}`:""}">${when(block.title, () => html`<h3 class="panel__title"${mark("title","text","Panel heading")}>${block.title}</h3>`)}${block.blocks.map((child,index) => renderBlock({...child,...((block as CmsRenderMetadata).cmsInstanceId?{cmsInstanceId:`${(block as CmsRenderMetadata).cmsInstanceId}-child-${index+1}`}:{ }),...(fieldPath(block,"blocks",index)?{cmsPath:fieldPath(block,"blocks",index)}:{})}, env))}</div>`;
    case "tiles":
      return tiles(block, env);
    case "people":
      return html`<ul class="people" role="list">${block.items.map((item,index) => person(item, env,fieldPath(block,"items",index)))}</ul>`;
    case "timeline":
      return html`<ol class="timeline" role="list">${block.items.map((item,index) => html`<li class="timeline__item"><span class="timeline__when"${editAttributes(context,fieldPath(block,"items",index,"when"),"text","Date or period")}>${item.when}</span><div class="timeline__body"><h3 class="timeline__title"${editAttributes(context,fieldPath(block,"items",index,"title"),"text","Timeline heading")}>${item.title}</h3><p class="timeline__text"${editAttributes(context,fieldPath(block,"items",index,"text"),"richtext","Timeline text")}>${inline(item.text, context)}</p></div></li>`)}</ol>`;
    case "next-event":
      return nextEvent(block, env);
    case "video":
      return videoPlate({ title: block.title, videoId: block.videoId },env,fieldPath(block,"title"));
    case "playlist":
      return videoPlate({ title: block.title, listId: block.listId },env,fieldPath(block,"title"));
    case "downloads":
      return html`<ul class="downloads" role="list">${block.items.map((item,index) => html`<li class="download"><h3 class="download__title"${editAttributes(context,fieldPath(block,"items",index,"title"),"text","Download title")}>${item.title}</h3><p class="download__text"${editAttributes(context,fieldPath(block,"items",index,"text"),"richtext","Download description")}>${inline(item.text, context)}</p><p class="download__link">${editField(externalLink(resolveHref(item.href,context), html`${item.label}<span aria-hidden="true"> ↗</span>`, "button button--outline"),context,fieldPath(block,"items",index,"label"),"link","Download link")}</p></li>`)}</ul>`;
    case "hymns":
      return html`<ul class="hymns" role="list">${block.items.map((item,index) => html`<li class="hymn"><h3 class="hymn__title"${editAttributes(context,fieldPath(block,"items",index,"title"),"text","Hymn title")}>${item.title}</h3><p class="hymn__text"${editAttributes(context,fieldPath(block,"items",index,"text"),"richtext","Hymn description")}>${inline(item.text, context)}</p><p>${editField(externalLink(item.href, html`Play &amp; Lyrics<span aria-hidden="true"> →</span>`, "hymn__link"),context,fieldPath(block,"items",index,"href"),"link","Hymn destination")}</p></li>`)}</ul>`;
    case "index":
      return html`<ol class="index-grid" role="list">${block.items.map((item,index) => html`<li class="index-grid__item"><a class="index-grid__link"${editAttributes(context,fieldPath(block,"items",index,"href"),"link","Item destination")} href="${item.href}"><span class="index-grid__title"${editAttributes(context,fieldPath(block,"items",index,"title"),"text","Item title")}>${item.title}</span><span class="index-grid__text"${editAttributes(context,fieldPath(block,"items",index,"text"),"richtext","Item description")}>${inline(item.text, context)}</span></a></li>`)}</ol>`;
    case "sermon-cards": {
      const links = siteLinks(context);
      const instance=(block as {cmsInstanceId?:string}).cmsInstanceId;
      const recent = (instance ? env.sermonSelections?.[instance] ?? env.sermons : env.sermons).slice(0, block.limit ?? 3);
      const headingId=instance ? `${instance}-sermons-heading` : "page-sermons-heading";
      return html`<section class="page__sermons" aria-labelledby="${headingId}">
        <h2 id="${headingId}" class="page__h2"${mark("heading","text","Section heading")}>${block.heading}</h2>
        ${when(block.text, () => editField(paragraph(block.text!, context),context,fieldPath(block,"text"),"richtext","Introduction"))}
        ${recent.length ? cardGrid(recent, { links, headingLevel: 3 }) : sectionNote("No sermon is available yet. Please check back soon.")}
        <p class="page__sermons-link"><a class="button" href="${links.archive}"${mark("linkLabel","text","Button label")}>${block.linkLabel}</a></p>
      </section>`;
    }
    case "external-plate":
      return html`<div class="plate plate--church plate--external"><div class="plate__consent">${shelfMark("plate__mark")}<p class="plate__title"${mark("title","text","Resource heading")}>${block.title}</p><p class="plate__note"${mark("text","richtext","Description")}>${inline(block.text, context)}</p><p class="plate__actions">${editField(externalLink(block.href, html`${block.label}<span aria-hidden="true"> ↗</span>`, "button button--onink"),context,fieldPath(block,"label"),"link","Resource link")}</p></div></div>`;
    case "book":
      return html`<div class="book">${picture(block.media, { className: "book__cover", context,editPath:fieldPath(block,"media"),...(block.mediaAlt!==undefined?{alt:block.mediaAlt}:{}),...(block.mediaFocalPoint?{focalPoint:block.mediaFocalPoint}:{}) })}<div class="book__text"${mark("text","richtext","Book description")}>${block.text.split(/\n\s*\n/u).map((text) => paragraph(text, context))}</div></div>`;
    case "contact-panel":
      return html`<div class="contact-panel">
        <address class="contact-panel__address"><strong class="contact-panel__name"${mark("name","text","Name")}>${block.name}</strong>${block.addressLines.map((line,index) => html`<span${editAttributes(context,fieldPath(block,"addressLines",index),"text","Address line")}>${line}</span>`)}<span><a href="${block.telephone.href}"${editAttributes(context,fieldPath(block,"telephone","label"),"link","Telephone")}>${block.telephone.label}</a></span><span><a href="mailto:${block.email}"${mark("email","text","Email")}>${block.email}</a></span></address>
        <p class="contact-panel__actions"><a class="button" href="mailto:${block.email}">Send us an email</a> ${editField(externalLink(block.map.href, html`${block.map.label}<span aria-hidden="true"> →</span>`, "button button--outline"),context,fieldPath(block,"map","label"),"link","Map link")}</p>
      </div>`;
    case "giving-methods": {
      const givingId=(block as {cmsInstanceId?:string}).cmsInstanceId;
      const bankId=givingId?`${givingId}-giving-bank-heading`:"giving-bank-heading",onlineId=givingId?`${givingId}-giving-online-heading`:"giving-online-heading";
      return html`<div class="giving">
        <h2 class="page__h2"${mark("heading","text","Heading")}>${block.heading??"Ways to make an offering"}</h2>
        <p class="giving__intro"${mark("intro","richtext","Introduction")}>${inline(block.intro, context)}</p>
        <p class="giving__cta">${editField(externalLink(block.button.href, html`${block.button.label}<span aria-hidden="true"> ↗</span>`, "button"),context,fieldPath(block,"button","label"),"link","Giving button")}</p>
        <ul class="giving__methods" role="list">${block.methods.map((method,index) => html`<li class="giving__method"><h3 class="giving__method-title"${editAttributes(context,fieldPath(block,"methods",index,"title"),"text","Giving method")}>${method.title}</h3><p${editAttributes(context,fieldPath(block,"methods",index,"text"),"richtext","Giving details")}>${inline(method.text, context)}</p></li>`)}</ul>
        <div class="giving__details">
          <section class="giving__bank" aria-labelledby="${bankId}"><h3 id="${bankId}" class="giving__method-title"${editAttributes(context,fieldPath(block,"bank","title"),"text","Bank heading")}>${block.bank.title}</h3><p><strong${editAttributes(context,fieldPath(block,"bank","account"),"text","Bank account")}>${block.bank.account}</strong></p>${block.bank.lines.map((line,index) => html`<p class="tabular"${editAttributes(context,fieldPath(block,"bank","lines",index),"text","Bank detail")}>${line}</p>`)}</section>
          <section class="giving__online" aria-labelledby="${onlineId}"><h3 id="${onlineId}" class="giving__method-title"${editAttributes(context,fieldPath(block,"online","title"),"text","Online giving heading")}>${block.online.title}</h3><ul class="page__list">${block.online.links.map((link,index) => html`<li>${editField(externalLink(link.href, html`${link.label}<span aria-hidden="true"> ↗</span>`),context,fieldPath(block,"online","links",index,"label"),"link","Giving link")}</li>`)}</ul></section>
        </div>
      </div>`;
    }
    case "events-calendar": return renderEventCalendar(block,env);
    case "blog-list": return renderBlogListing(block,context);
    case "sitemap-list": return renderSitemapListing(context);
    default:
      return html``;
  }
}

export function renderBlocks(blocks: readonly (Block|CmsHomeBlock)[], env: BlockEnvironment): Html {
  return html`${blocks.map((block) => renderBlock(block, env))}`;
}

/** The words of a page's first paragraph, for listings. */
export function firstParagraph(blocks: readonly Block[]): string {
  const block = blocks.find((candidate) => candidate.kind === "paragraph");
  return block && block.kind === "paragraph" ? plainText(block.text) : "";
}

/** Whether the blocks include a click-to-load video or playlist, so the page embeds the loader. */
export function hasVideo(blocks: readonly (Block|CmsHomeBlock)[]): boolean {
  return blocks.some((block) => (block as CmsRenderMetadata).cmsEnabled!==false && (block.kind === "video" || block.kind === "playlist" || (block.kind === "panel" && hasVideo(block.blocks))));
}

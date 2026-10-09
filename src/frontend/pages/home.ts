/**
 * The church homepage at "/": the welcome card a greeter hands a newcomer.
 *
 * The first screen answers when, where and what to expect: the church's
 * name, the "New Here?" card with the entrance photograph, the service
 * time, the address and one button, and the two Lord's Day services
 * standing on the shelf board. Then the welcome and its four pillars, a
 * photograph of the congregation, the newest sermons as V4 cards, About us
 * with the offering panel, the upcoming events computed from the church's
 * schedules, and the shared footer with the contact columns. Every word
 * comes from the church's own homepage copy; every link leads to a page of
 * this site or to a destination the church published.
 */
import {editAttributes,fieldPath} from "../editing";
import type { CmsHomeBlock } from "../../cms/model";
import { inline, resolveHref } from "../content/markup";
import { defaultHomeContent, siteSettings } from "../content/site-snapshot";
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { picture, renderBlock, hasVideo } from "../components/blocks";
import { cardGrid, sermonCard } from "../components/cards";
import { sectionHead, sectionNote } from "../components/sections";
import { homeSections } from "../content/home-content";
import { html, raw, type Html } from "../html";
import { publicRenderContext, siteLinks, type FrontendRenderContext } from "../routes";
import { pageShell } from "../shell";
import { upcomingList } from "./church";

export interface FrontendHomePageInput {
  /** Newest first; the first three appear as cards and the first in the footer. */
  sermons: SermonSummary[];
  options: PublicSermonFilterOptions;
  totalItems: number;
  /** ISO calendar date in Melbourne, for the upcoming events. */
  today: string;
  sermonSelections?: Readonly<Record<string, SermonSummary[]>> | undefined;
}

export { emptyFilterOptions } from "./sermons-v1";



function hero(context: FrontendRenderContext, block:Extract<CmsHomeBlock,{kind:"home-arrival"}>): Html {
  const mark=(path:Array<string|number>,kind:"text"|"richtext"|"image"|"link"="text",label="Text")=>editAttributes(context,fieldPath(block,...path),kind,label);
  const heroCopy=block.hero;
  const servicesCopy=block.services;
  return html`<section class="arrive" aria-labelledby="hero-heading">
    <div class="arrive__inner">
      <div class="arrive__welcome">
        <h1 id="hero-heading" class="arrive__title"><span class="arrive__name"${mark(["hero","nameLine1"],"text","Church name")}>${heroCopy.nameLine1}</span><span class="arrive__name"${mark(["hero","nameLine2"],"text","Church name, second line")}>${heroCopy.nameLine2}</span></h1>
        <p class="arrive__place"${mark(["hero","place"],"text","Location")}>${heroCopy.place}</p>
      </div>
      <div class="welcome-card" id="visit">
        <div class="welcome-card__body">
          <p class="welcome-card__time"${mark(["hero","serviceTime"],"text","Service time")}>${heroCopy.serviceTime}</p>
          <p class="welcome-card__where"${mark(["hero","address"],"text","Address")}>${heroCopy.address}</p>
          <a${mark(["hero","join"],"link","Visit button")} class="button welcome-card__cta" href="${resolveHref(heroCopy.joinHref,context)}">${heroCopy.join}</a>
          <a${mark(["hero","moreLabel"],"link","What to expect link")} class="welcome-card__more" href="${resolveHref(heroCopy.moreHref ?? "/lords-day-service/",context)}">${context.visualEditor?html`<span${mark(["hero","newHere"],"text","New visitor label")}>${heroCopy.newHere}</span> <span${mark(["hero","moreLabel"],"text","Link label")}>${heroCopy.moreLabel ?? "What to expect"}</span>`:html`${heroCopy.newHere} ${heroCopy.moreLabel ?? "What to expect"}`}</a>
        </div>
      </div>
    </div>
    <figure class="arrive__photograph">${picture(block.media, { className: "arrive__image", eager: true, context,editPath:fieldPath(block,"media"),...(block.mediaAlt!==undefined?{alt:block.mediaAlt}:{}),...(block.mediaFocalPoint?{focalPoint:block.mediaFocalPoint}:{}) })}</figure>
    <div class="arrive__inner arrive__inner--services" id="${homeSections.services}">
      <section aria-labelledby="services-heading">
        ${sectionHead("services-heading", servicesCopy.heading,undefined,mark(["services","heading"],"text","Services heading"))}
        <ul class="services" role="list">
          ${servicesCopy.items.map((item,index)=>({item,index})).filter(({item})=>item.enabled).map(({item,index})=>html`<li class="service service--${item.id}"><h3 class="service__title"><a${mark(["services","items",index,"title"],"link","Service title")} href="${resolveHref(item.href,context)}">${item.title}</a></h3><p class="service__text"${mark(["services","items",index,"text"],"richtext","Service description")}>${inline(item.text,context)}</p></li>`)}
        </ul>
      </section>
    </div>
  </section>`;
}

function welcome(context: FrontendRenderContext, block:Extract<CmsHomeBlock,{kind:"home-welcome"}>): Html {
  const mark=(path:Array<string|number>,kind:"text"|"richtext"|"image"|"link"="text",label="Text")=>editAttributes(context,fieldPath(block,...path),kind,label);
  const welcomeCopy=block;
  const pillars=block.pillars.map((pillar,index)=>({pillar,index})).filter(({pillar})=>pillar.enabled);
  return html`<section class="section welcome" id="${homeSections.welcome}" aria-labelledby="welcome-heading">
    <div class="welcome__spread">
      <h2 id="welcome-heading" class="welcome__title"${mark(["heading"],"text","Welcome heading")}>${welcomeCopy.heading}</h2>
      <p class="welcome__lede lede"${mark(["paragraph"],"richtext","Welcome text")}>${inline(welcomeCopy.paragraph,context)}</p>
    </div>
    <ul class="pillars" role="list">${pillars.map(({pillar,index}) => html`<li class="pillar">
      <div class="pillar__body">
        <h3 class="pillar__title" id="pillar-${pillar.id}"${mark(["pillars",index,"title"],"text","Pillar heading")}>${pillar.title}</h3>
        <p class="pillar__text"${mark(["pillars",index,"text"],"richtext","Pillar text")}>${inline(pillar.text,context)}</p>
        <a class="pillar__more"${mark(["pillars",index,"readMore"],"link","Pillar link")} href="${resolveHref(pillar.href,context)}">${pillar.readMore}<span class="sr-only"> about ${pillar.title}</span></a>
      </div>
    </li>`)}</ul>
    <figure class="home__photo">${picture(block.media, { className: "home__photo-image", context,editPath:fieldPath(block,"media"),...(block.mediaAlt!==undefined?{alt:block.mediaAlt}:{}),...(block.mediaFocalPoint?{focalPoint:block.mediaFocalPoint}:{}) })}</figure>
  </section>`;
}

function recentSermons(input: FrontendHomePageInput, context: FrontendRenderContext, block:Extract<CmsHomeBlock,{kind:"home-sermons"}>, instanceId?:string): Html {
  const mark=(path:Array<string|number>,kind:"text"|"richtext"|"image"|"link"="text",label="Text")=>editAttributes(context,fieldPath(block,...path),kind,label);
  const sermonsCopy=block;
  const links = siteLinks(context);
  const selected=instanceId ? input.sermonSelections?.[instanceId] : undefined;
  const ordered=selected ?? (block.order==="ASC" ? [...input.sermons].reverse() : input.sermons);
  const recent=(block.sermonIds.length ? block.sermonIds.flatMap(id=>ordered.find(sermon=>sermon.id===id)??[]) : ordered).slice(0,block.limit);
  return html`<section class="section" id="${homeSections.sermons}" aria-labelledby="recent-heading">
    ${sectionHead("recent-heading", sermonsCopy.heading, html`<a class="button button--outline"${mark(["viewAll"],"text","Sermon archive label")} href="${links.archive}">${sermonsCopy.viewAll}</a>`,mark(["heading"],"text","Sermons heading"))}
    ${recent.length
      ? cardGrid(recent, { links, headingLevel: 3 })
      : sectionNote("No sermon is available yet. Please check back soon.")}
  </section>`;
}

function about(context: FrontendRenderContext, block:Extract<CmsHomeBlock,{kind:"home-about"}>): Html {
  const mark=(path:Array<string|number>,kind:"text"|"richtext"|"image"|"link"="text",label="Text")=>editAttributes(context,fieldPath(block,...path),kind,label);
  const aboutCopy={...block,giveHeading:block.giving.heading,giveLink:block.giving.link,giveHref:block.giving.href,quote:block.giving.quote,attribution:block.giving.attribution};
  return html`<section class="section about-row" aria-labelledby="about-heading">
    <div class="about" id="${homeSections.about}">
      <h2 id="about-heading" class="about__title"${mark(["heading"],"text","About heading")}>${aboutCopy.heading}</h2>
      <p class="about__text prose"${mark(["paragraph"],"richtext","About text")}>${inline(aboutCopy.paragraph,context)}</p>
      <p class="about__more"><a class="pillar__more"${mark(["learnMore"],"link","About link")} href="${resolveHref(aboutCopy.learnMoreHref,context)}">${aboutCopy.learnMore}</a></p>
    </div>
    ${block.giving.enabled ? html`<section class="offering" id="${homeSections.give}" aria-labelledby="give-heading">
      <h2 id="give-heading" class="offering__title"${mark(["giving","heading"],"text","Giving heading")}>${aboutCopy.giveHeading}</h2>
      <blockquote class="offering__quote"><p${mark(["giving","quote"],"richtext","Giving quotation")}>${inline(aboutCopy.quote,context)}</p><footer class="offering__cite"${mark(["giving","attribution"],"text","Attribution")}>${aboutCopy.attribution}</footer></blockquote>
      <p class="offering__link"><a class="button button--onink"${mark(["giving","link"],"link","Giving button")} href="${resolveHref(aboutCopy.giveHref,context)}">${aboutCopy.giveLink}</a></p>
    </section>` : html``}
  </section>`;
}

function events(input: FrontendHomePageInput, context: FrontendRenderContext, block:Extract<CmsHomeBlock,{kind:"home-events"}>): Html {
  const mark=(path:Array<string|number>,kind:"text"|"richtext"|"image"|"link"="text",label="Text")=>editAttributes(context,fieldPath(block,...path),kind,label);
  const eventsCopy=block;
  return html`<section class="section" id="${homeSections.events}" aria-labelledby="events-heading">
    ${sectionHead("events-heading", eventsCopy.heading, html`<a${mark(["viewCalendar"],"link","Calendar link")} class="button button--outline events__calendar" href="${resolveHref(eventsCopy.viewCalendarHref,context)}">${eventsCopy.viewCalendar}</a>`,mark(["heading"],"text","Events heading"))}
    ${upcomingList(input.today, context, { days: block.days, limit: block.limit })}
  </section>`;
}

/** The visual modules stay code-owned; the selected revision supplies their fields and order. */
export function renderCmsHomeBlock(block:CmsHomeBlock,input:FrontendHomePageInput,context:FrontendRenderContext,instanceId?:string):Html {
  let result:Html;
  switch(block.kind){
    case "home-arrival":result=hero(context,block);break;
    case "home-welcome":result=welcome(context,block);break;
    case "home-about":result=about(context,block);break;
    case "home-sermons":result=recentSermons(input,context,block,instanceId);break;
    case "home-events":result=events(input,context,block);break;
  }
  // Duplicated modules need unique native anchor/label targets. Original IDs stay stable.
  if(!instanceId || instanceId===block.kind)return result;
  let output=result.toString();
  const ids=[...output.matchAll(/\bid="([^"]+)"/gu)].map(match=>match[1]!);
  for(const id of ids){const next=`${instanceId}-${id}`;output=output.replaceAll(`id="${id}"`,`id="${next}"`).replaceAll(`aria-labelledby="${id}"`,`aria-labelledby="${next}"`).replaceAll(`href="#${id}"`,`href="#${next}"`);}
  return raw(output);
}

export function renderFrontendHomePage(input:FrontendHomePageInput,context:FrontendRenderContext=publicRenderContext):string {
  const links=siteLinks(context);
  const content=context.siteContent?.home ?? defaultHomeContent;
  const settings=siteSettings(context);
  const newest=input.sermons[0];
  return pageShell({
    ...(content.seo?{seo:content.seo}:{}),title:content.title,suffixTitle:false,description:content.description,canonicalPath:"/",robots:"index, follow",
    styles:["cards","church","home"],scripts:hasVideo(content.modules.filter(module=>module.enabled).map(module=>module.block))?["church"]:[],books:input.options.books,
    notice:settings.notice.enabled ? html`<aside class="notice" aria-label="Church notice"${editAttributes(context,["notice"],"section","Shared church notice","header")}><div class="notice__inner"><span class="notice__pin" aria-hidden="true"></span><p${editAttributes(context,["notice","text"],"richtext","Church notice","header")}>${inline(settings.notice.text,context)}</p></div></aside>` : html``,
    footerSermon:newest ? html`<div class="footer-sermon">${sermonCard(newest,{links,headingLevel:3})}</div>` : html`<p class="site-footer__note site-footer__note--column">No sermon is available yet. Please check back soon.</p>`,
    body:html`<div class="home">${content.modules.map((module,index)=>renderBlock({...module.block,cmsInstanceId:module.id,cmsPath:["modules",index,"block"],cmsModulePath:["modules",index],cmsEnabled:module.enabled,...(module.presentation?{cmsPresentation:module.presentation}:{})} as unknown as Parameters<typeof renderBlock>[0],{context,today:input.today,sermons:input.sermons,...(input.sermonSelections?{sermonSelections:input.sermonSelections}:{})}))}</div>`
  },context);
}

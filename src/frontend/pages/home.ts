/**
 * Astra's photographic church homepage. Every church statement is taken
 * from the existing content registry; only composition and presentation change.
 */
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { picture } from "../components/blocks";
import { cardGrid, sermonCard } from "../components/cards";
import { sectionHead, sectionNote } from "../components/sections";
import { aboutCopy, churchNotice, contactCopy, eventsCopy, heroCopy, homeSections, pillars, sermonsCopy, servicesCopy, welcomeCopy } from "../content/home-content";
import { html, siteName, type Html } from "../html";
import { publicRenderContext, siteLinks, type FrontendRenderContext } from "../routes";
import { pageShell } from "../shell";
import { upcomingList } from "./church";

export interface FrontendHomePageInput {
  sermons: SermonSummary[];
  options: PublicSermonFilterOptions;
  totalItems: number;
  today: string;
}
export { emptyFilterOptions } from "./sermons-v1";

function hero(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<section class="arrival" aria-labelledby="hero-heading">
    <div class="arrival__text">
      <p class="eyebrow">${heroCopy.eyebrow}</p>
      <h1 id="hero-heading" class="arrival__title"><span>${heroCopy.nameLine1}</span><span>${heroCopy.nameLine2}</span></h1>
      <p class="arrival__time">${heroCopy.serviceTime}</p>
      <a class="button arrival__cta" href="${links.path(heroCopy.joinHref)}">${heroCopy.join}<span aria-hidden="true">↗</span></a>
      <p class="arrival__address">${heroCopy.address}</p>
    </div>
    <figure class="arrival__picture">${picture("congregation", { className: "arrival__image", eager: true })}</figure>
    <a class="arrival__visit" href="#visit"><span>${heroCopy.newHere}</span><span aria-hidden="true">↓</span></a>
  </section>`;
}

function welcome(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<section class="section welcome" id="${homeSections.welcome}" aria-labelledby="welcome-heading">
    <div class="welcome__spread"><h2 id="welcome-heading" class="welcome__title">${welcomeCopy.heading}</h2><p class="welcome__lede lede">${welcomeCopy.paragraph}</p></div>
    <ul class="pillars" role="list">${pillars.map((pillar, index) => html`<li class="pillar">
      <span class="pillar__number" aria-hidden="true">0${index + 1}</span>
      <h3 class="pillar__title" id="pillar-${pillar.id}">${pillar.title}</h3><p class="pillar__text">${pillar.text}</p>
      <a class="pillar__more" href="${links.path(pillar.href)}">${pillar.readMore}<span class="sr-only"> about ${pillar.title}</span><span aria-hidden="true"> ↗</span></a>
    </li>`)}</ul>
  </section>`;
}

function visit(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<section class="section visit" id="visit" aria-labelledby="services-heading">
    <div class="visit__picture">${picture("entrance", { className: "visit__image" })}</div>
    <div class="visit__body" id="${homeSections.services}">
      <p class="eyebrow">${heroCopy.newHere}</p><h2 id="services-heading" class="visit__title">${servicesCopy.heading}</h2>
      <ul class="services" role="list">
        ${[servicesCopy.morning, servicesCopy.evening].map((service) => html`<li class="service"><h3 class="service__title"><a href="${links.path(service.href)}">${service.title}<span aria-hidden="true"> ↗</span></a></h3><p class="service__text">${service.text}</p></li>`)}
      </ul>
      <p class="visit__directions"><a href="${contactCopy.directionsHref}" rel="noopener">${contactCopy.directions}<span class="sr-only"> (external site)</span></a></p>
    </div>
  </section>`;
}

function recentSermons(input: FrontendHomePageInput, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  const recent = input.sermons.slice(0, 3);
  return html`<section class="section home-sermons" id="${homeSections.sermons}" aria-labelledby="recent-heading">
    ${sectionHead("recent-heading", sermonsCopy.heading, html`<a class="text-link" href="${links.archive}">${sermonsCopy.viewAll}<span aria-hidden="true"> ↗</span></a>`)}
    ${recent.length ? cardGrid(recent, { links, headingLevel: 3 }) : sectionNote("No sermon is available yet. Please check back soon.")}
  </section>`;
}

function about(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<section class="section about-row" aria-labelledby="about-heading">
    <div class="about" id="${homeSections.about}"><p class="eyebrow">${aboutCopy.heading}</p><h2 id="about-heading" class="about__title">${siteName}</h2><p class="about__text prose">${aboutCopy.paragraph}</p><a class="text-link" href="${links.path(aboutCopy.learnMoreHref)}">${aboutCopy.learnMore}</a></div>
    <figure class="about__picture">${picture("open-bible", { className: "about__image" })}</figure>
  </section>
  <section class="offering" id="${homeSections.give}" aria-labelledby="give-heading">
    <h2 id="give-heading" class="offering__title">${aboutCopy.giveHeading}</h2><blockquote class="offering__quote"><p>${aboutCopy.quote}</p><footer>${aboutCopy.attribution}</footer></blockquote><a class="button button--onink" href="${links.path(aboutCopy.giveHref)}">${aboutCopy.giveLink}<span aria-hidden="true"> ↗</span></a>
  </section>`;
}

function events(input: FrontendHomePageInput, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<section class="section home-events" id="${homeSections.events}" aria-labelledby="events-heading">
    <div class="home-events__intro"><h2 id="events-heading" class="home-events__title">${eventsCopy.heading}</h2><a class="text-link" href="${links.path(eventsCopy.viewCalendarHref)}">${eventsCopy.viewCalendar}<span aria-hidden="true"> ↗</span></a></div>
    ${upcomingList(input.today, context, { days: 35, limit: 4 })}
  </section>`;
}

export function renderFrontendHomePage(input: FrontendHomePageInput, context: FrontendRenderContext = publicRenderContext): string {
  const links = siteLinks(context), newest = input.sermons[0];
  return pageShell({
    title: siteName, suffixTitle: false,
    description: "Saving Grace Bible Church in Westmeadows, Victoria: Lord's Day services, recent sermons, who we are, upcoming events and how to find us.",
    canonicalPath: "/", robots: "index, follow",
    styles: ["cards", "church", "home"], scripts: [], books: input.options.books,
    notice: html`<aside class="notice" aria-label="Church notice"><div class="notice__inner"><span class="notice__pin" aria-hidden="true"></span><p>${churchNotice}</p></div></aside>`,
    footerSermon: newest ? html`<div class="footer-sermon">${sermonCard(newest, { links, headingLevel: 3 })}</div>` : html`<p class="site-footer__note site-footer__note--column">No sermon is available yet. Please check back soon.</p>`,
    body: html`<div class="home">${hero(context)}${welcome(context)}${visit(context)}${recentSermons(input, context)}${events(input, context)}${about(context)}</div>`
  }, context);
}

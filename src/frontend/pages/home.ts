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
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { picture } from "../components/blocks";
import { cardGrid, sermonCard } from "../components/cards";
import { pillarGlyph } from "../components/glyphs";
import { sectionHead, sectionNote } from "../components/sections";
import {
  aboutCopy,
  churchNotice,
  eventsCopy,
  heroCopy,
  homeSections,
  pillars,
  sermonsCopy,
  servicesCopy,
  welcomeCopy
} from "../content/home-content";
import { html, siteName, type Html } from "../html";
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
}

export { emptyFilterOptions } from "./sermons-v1";

const homeDescription = "Saving Grace Bible Church in Westmeadows, Victoria: Lord's Day services, recent sermons, who we are, upcoming events and how to find us.";

function hero(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<section class="arrive" aria-labelledby="hero-heading">
    <div class="arrive__inner">
      <div class="arrive__welcome">
        <p class="eyebrow arrive__eyebrow">${heroCopy.eyebrow}</p>
        <h1 id="hero-heading" class="arrive__title"><span class="arrive__name">${heroCopy.nameLine1}</span><span class="arrive__name">${heroCopy.nameLine2}</span></h1>
        <span class="arrive__rule" aria-hidden="true"></span>
      </div>
      <div class="welcome-card" id="visit">
        <div class="welcome-card__picture">${picture("entrance", { className: "welcome-card__image", eager: true })}</div>
        <div class="welcome-card__body">
          <p class="eyebrow">${heroCopy.newHere}</p>
          <p class="welcome-card__time">${heroCopy.serviceTime}</p>
          <p class="welcome-card__where">${heroCopy.address}</p>
          <a class="button welcome-card__cta" href="${links.path(heroCopy.joinHref)}">${heroCopy.join}</a>
        </div>
      </div>
    </div>
    <div class="arrive__inner arrive__inner--services" id="${homeSections.services}">
      <section aria-labelledby="services-heading">
        ${sectionHead("services-heading", servicesCopy.heading)}
        <ul class="services" role="list">
          <li class="service service--morning"><h3 class="service__title"><a href="${links.path(servicesCopy.morning.href)}">${servicesCopy.morning.title}</a></h3><p class="service__text">${servicesCopy.morning.text}</p></li>
          <li class="service service--evening"><h3 class="service__title"><a href="${links.path(servicesCopy.evening.href)}">${servicesCopy.evening.title}</a></h3><p class="service__text">${servicesCopy.evening.text}</p></li>
        </ul>
      </section>
    </div>
  </section>`;
}

function welcome(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<section class="section welcome" id="${homeSections.welcome}" aria-labelledby="welcome-heading">
    <div class="welcome__spread">
      <h2 id="welcome-heading" class="welcome__title">${welcomeCopy.heading}</h2>
      <p class="welcome__lede lede">${welcomeCopy.paragraph}</p>
    </div>
    <ul class="pillars" role="list">${pillars.map((pillar) => html`<li class="pillar">
      <span class="pillar__spine" aria-hidden="true">${pillarGlyph(pillar.id)}</span>
      <div class="pillar__body">
        <h3 class="pillar__title" id="pillar-${pillar.id}">${pillar.title}</h3>
        <p class="pillar__text">${pillar.text}</p>
        <a class="pillar__more" href="${links.path(pillar.href)}">${pillar.readMore}<span class="sr-only"> about ${pillar.title}</span></a>
      </div>
    </li>`)}</ul>
    <figure class="home__photo">${picture("congregation", { className: "home__photo-image" })}</figure>
  </section>`;
}

function recentSermons(input: FrontendHomePageInput, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  const recent = input.sermons.slice(0, 3);
  return html`<section class="section" id="${homeSections.sermons}" aria-labelledby="recent-heading">
    ${sectionHead("recent-heading", sermonsCopy.heading, html`<a class="button button--outline" href="${links.archive}">${sermonsCopy.viewAll}</a>`)}
    ${recent.length
      ? cardGrid(recent, { links, headingLevel: 3 })
      : sectionNote("No sermon is available yet. Please check back soon.")}
  </section>`;
}

function about(context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<section class="section about-row" aria-labelledby="about-heading">
    <div class="about" id="${homeSections.about}">
      <h2 id="about-heading" class="about__title">${aboutCopy.heading}</h2>
      <p class="about__text prose">${aboutCopy.paragraph}</p>
      <p class="about__more"><a class="pillar__more" href="${links.path(aboutCopy.learnMoreHref)}">${aboutCopy.learnMore}</a></p>
    </div>
    <section class="offering" id="${homeSections.give}" aria-labelledby="give-heading">
      <h2 id="give-heading" class="offering__title">${aboutCopy.giveHeading}</h2>
      <blockquote class="offering__quote"><p>${aboutCopy.quote}</p><footer class="offering__cite">${aboutCopy.attribution}</footer></blockquote>
      <p class="offering__link"><a class="button button--onink" href="${links.path(aboutCopy.giveHref)}">${aboutCopy.giveLink}</a></p>
    </section>
  </section>`;
}

function events(input: FrontendHomePageInput, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<section class="section" id="${homeSections.events}" aria-labelledby="events-heading">
    ${sectionHead("events-heading", eventsCopy.heading, html`<a class="button button--outline events__calendar" href="${links.path(eventsCopy.viewCalendarHref)}">${eventsCopy.viewCalendar}</a>`)}
    ${upcomingList(input.today, context, { days: 35, limit: 4 })}
  </section>`;
}

export function renderFrontendHomePage(
  input: FrontendHomePageInput,
  context: FrontendRenderContext = publicRenderContext
): string {
  const links = siteLinks(context);
  const newest = input.sermons[0];
  return pageShell({
    title: siteName,
    suffixTitle: false,
    description: homeDescription,
    canonicalPath: "/",
    robots: "index, follow",
    styles: ["cards", "church", "home"],
    scripts: [],
    books: input.options.books,
    notice: html`<aside class="notice" aria-label="Church notice"><div class="notice__inner"><span class="notice__pin" aria-hidden="true"></span><p>${churchNotice}</p></div></aside>`,
    footerSermon: newest
      ? html`<div class="footer-sermon">${sermonCard(newest, { links, headingLevel: 3 })}</div>`
      : html`<p class="site-footer__note site-footer__note--column">No sermon is available yet. Please check back soon.</p>`,
    body: html`<div class="home">${hero(context)}${welcome(context)}${recentSermons(input, context)}${about(context)}${events(input, context)}</div>`
  }, context);
}

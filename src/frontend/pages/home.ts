/**
 * The church homepage at "/": the welcome card a greeter hands a newcomer.
 *
 * The first screen answers when, where and what to expect: the church's
 * name, the "New Here?" card with the service time, the address and one
 * button, and the two Lord's Day services standing on the shelf board. Then
 * the welcome and its four pillars, the newest sermons as V4 cards, About
 * us with the offering panel, the upcoming events, and the shared footer
 * with the contact columns. Every word comes from the supplied screenshots;
 * labels without a destination this application owns render as pending.
 */
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { cardGrid, sermonCard } from "../components/cards";
import { pillarGlyph, recurringGlyph } from "../components/glyphs";
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
import { html, siteName, when, type Html } from "../html";
import { publicRenderContext, siteLinks, type FrontendRenderContext } from "../routes";
import { pageShell, pendingLabel } from "../shell";

export interface FrontendHomePageInput {
  /** Newest first; the first three appear as cards and the first in the footer. */
  sermons: SermonSummary[];
  options: PublicSermonFilterOptions;
  totalItems: number;
}

export { emptyFilterOptions } from "./sermons-v1";

const homeDescription = "Saving Grace Bible Church in Westmeadows, Victoria: Lord's Day services, recent sermons, who we are, upcoming events and how to find us.";

function hero(): Html {
  return html`<section class="arrive" aria-labelledby="hero-heading">
    <div class="arrive__inner">
      <div class="arrive__welcome">
        <p class="eyebrow arrive__eyebrow">${heroCopy.eyebrow}</p>
        <h1 id="hero-heading" class="arrive__title"><span class="arrive__name">${heroCopy.nameLine1}</span><span class="arrive__name">${heroCopy.nameLine2}</span></h1>
        <span class="arrive__rule" aria-hidden="true"></span>
      </div>
      <div class="welcome-card" id="visit">
        <p class="eyebrow">${heroCopy.newHere}</p>
        <p class="welcome-card__time">${heroCopy.serviceTime}</p>
        <p class="welcome-card__where">${heroCopy.address}</p>
        <a class="button welcome-card__cta" href="#${homeSections.services}">${heroCopy.join}</a>
      </div>
    </div>
    <div class="arrive__inner arrive__inner--services" id="${homeSections.services}">
      <section aria-labelledby="services-heading">
        ${sectionHead("services-heading", servicesCopy.heading)}
        <ul class="services" role="list">
          <li class="service service--morning"><h3 class="service__title">${servicesCopy.morning.title}</h3><p class="service__text">${servicesCopy.morning.text}</p></li>
          <li class="service service--evening"><h3 class="service__title">${servicesCopy.evening.title}</h3><p class="service__text">${servicesCopy.evening.text}</p></li>
        </ul>
      </section>
    </div>
  </section>`;
}

function welcome(): Html {
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
        ${pillar.href
          ? html`<a class="pillar__more" href="${pillar.href}">${pillar.readMore}<span class="sr-only"> about ${pillar.title}</span></a>`
          : pendingLabel(pillar.readMore, `pillar__more pillar__more--pending`)}
      </div>
    </li>`)}</ul>
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

function about(): Html {
  return html`<section class="section about-row" aria-labelledby="about-heading">
    <div class="about" id="${homeSections.about}">
      <h2 id="about-heading" class="about__title">${aboutCopy.heading}</h2>
      <p class="about__text prose">${aboutCopy.paragraph}</p>
      ${pendingLabel(aboutCopy.learnMore, "about__more")}
    </div>
    <section class="offering" id="${homeSections.give}" aria-labelledby="give-heading">
      <h2 id="give-heading" class="offering__title">${aboutCopy.giveHeading}</h2>
      <blockquote class="offering__quote"><p>${aboutCopy.quote}</p><footer class="offering__cite">${aboutCopy.attribution}</footer></blockquote>
    </section>
  </section>`;
}

function events(): Html {
  return html`<section class="section" id="${homeSections.events}" aria-labelledby="events-heading">
    ${sectionHead("events-heading", eventsCopy.heading, pendingLabel(eventsCopy.viewCalendar, "events__calendar"))}
    <ol class="events" role="list">${eventsCopy.events.map((event) => html`<li class="event">
      <span class="event__date"><span class="event__month">${event.month}</span><span class="event__day">${event.day}</span></span>
      <span class="event__body">
        <span class="event__time">${event.time}${when(event.recurring, () => html` ${recurringGlyph()}<span class="sr-only">Recurring</span>`)}</span>
        <span class="event__title">${event.title}</span>
      </span>
    </li>`)}</ol>
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
    styles: ["cards", "home"],
    scripts: [],
    books: input.options.books,
    notice: html`<aside class="notice" aria-label="Church notice"><div class="notice__inner"><span class="notice__pin" aria-hidden="true"></span><p>${churchNotice}</p></div></aside>`,
    footerSermon: newest
      ? html`<div class="footer-sermon">${sermonCard(newest, { links, headingLevel: 3 })}</div>`
      : html`<p class="site-footer__note site-footer__note--column">No sermon is available yet. Please check back soon.</p>`,
    body: html`<div class="home">${hero()}${welcome()}${recentSermons(input, context)}${about()}${events()}</div>`
  }, context);
}

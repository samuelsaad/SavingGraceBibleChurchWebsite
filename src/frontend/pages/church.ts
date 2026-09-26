/**
 * The church's own pages: the content pages (About, teaching, ministries,
 * resources, giving, contact), the events calendar and event pages, the
 * blog index and posts, and the sitemap. All share the Canon shell; a
 * page's blocks come from the content registry, its images from the media
 * registry, and its dates from the events schedule.
 */
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { firstParagraph, hasVideo, picture, renderBlocks, type BlockEnvironment } from "../components/blocks";
import { recurringGlyph } from "../components/glyphs";
import { sectionHead, sectionNote } from "../components/sections";
import {
  dayOfMonth,
  eventsPath,
  events,
  formatLongDate,
  formatTimeRange,
  isRecurring,
  monthAbbreviation,
  occurrencesBetween,
  pastEvents,
  scheduleLabel,
  upcomingOccurrences,
  type ChurchEvent,
  type EventOccurrence
} from "../content/events";
import { paragraph } from "../content/markup";
import { availablePages, blogPosts, breadcrumbs, eventVenue, pageAvailable, pageById, sitemapGroups, type TrailItem } from "../content/registry";
import type { BlogPost, SitePage, Block } from "../content/types";
import { formattedDate, html, siteName, timeElement, when, type Html } from "../html";
import { publicRenderContext, siteLinks, type FrontendRenderContext } from "../routes";
import { pageShell, type PageShellInput } from "../shell";

export interface ChurchPageData {
  /** ISO calendar date in Melbourne. */
  today: string;
  /** Newest published sermons, newest first (may be empty). */
  sermons: SermonSummary[];
  options: PublicSermonFilterOptions;
}

function trail(items: TrailItem[], context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<nav aria-label="Breadcrumb"><ol class="trail" role="list">${items.map((item) => html`<li><a href="${links.path(item.href)}">${item.label}</a></li>`)}</ol></nav>`;
}

function statusBand(page: SitePage): Html {
  if (page.status === "published") return html``;
  const label = page.status === "draft" ? "Draft — not published" : "Private — not published";
  return html`<p class="page__status" role="status">${label}. This page is shown in the administrator preview only.</p>`;
}

function related(page: SitePage, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  const items = (page.related ?? []).map((id) => pageById(id)).filter((candidate) => pageAvailable(candidate, context));
  if (!items.length) return html``;
  return html`<nav class="page__related" aria-labelledby="related-heading">
    <h2 id="related-heading" class="section__title">Also in this section</h2>
    <ul class="related-list" role="list">${items.map((item) => html`<li><a href="${links.path(item.path)}">${item.title}</a></li>`)}</ul>
  </nav>`;
}

function pageHead(page: SitePage, context: FrontendRenderContext, lede?: Html): Html {
  const aside = page.hero?.treatment === "aside";
  return html`<header class="page__head${aside ? " page__head--aside" : ""}">
    <div class="page__head-text">
      ${trail(breadcrumbs(page), context)}
      ${when(page.eyebrow, () => html`<p class="eyebrow">${page.eyebrow}</p>`)}
      <h1 class="page__title">${page.heading ?? page.title}</h1>
      ${lede ?? when(page.lede, () => paragraph(page.lede!, context, "lede page__lede"))}
      ${statusBand(page)}
    </div>
    ${when(aside, () => html`<div class="page__head-picture">${picture(page.hero!.media, { className: "page__head-image", eager: true })}</div>`)}
  </header>
  ${when(page.hero?.treatment === "banner", () => html`<div class="page__banner">${picture(page.hero!.media, { className: "page__banner-image", eager: true })}</div>`)}`;
}

function shellInput(page: SitePage, data: ChurchPageData, body: Html, extra: Partial<PageShellInput> = {}): PageShellInput {
  return {
    title: page.title,
    description: page.description,
    canonicalPath: page.path,
    robots: page.status === "published" ? "index, follow" : "noindex, nofollow",
    styles: ["cards", "sermon", "church"],
    scripts: hasVideo(page.blocks) ? ["church"] : [],
    books: data.options.books,
    body,
    ...extra
  };
}

/** A content page: head, optional banner, the blocks, and the section's related links. */
export function renderChurchPage(page: SitePage, data: ChurchPageData, context: FrontendRenderContext = publicRenderContext): string {
  const env: BlockEnvironment = { context, today: data.today, sermons: data.sermons };
  const headings = page.blocks.filter((block): block is Extract<Block, { kind: "heading" }> => block.kind === "heading" && block.level === 2);
  const hasReadingRail = headings.length >= 4 && !page.blocks.some((block) => ["people", "tiles", "giving-methods"].includes(block.kind));
  const blocks = page.blocks.map((block, index) => block.kind === "heading" && block.level === 2
    ? { ...block, id: block.id ?? `reading-section-${index + 1}` } : block);
  const contents = blocks.filter((block): block is Extract<Block, { kind: "heading" }> => block.kind === "heading" && block.level === 2);
  const body = html`<article class="page page--${page.section}">
    ${pageHead(page, context)}
    <div class="page__layout${hasReadingRail ? " page__layout--reading" : ""}">
      ${when(hasReadingRail, () => html`<nav class="page-contents" aria-labelledby="page-contents-heading"><p id="page-contents-heading">On this page</p><ol role="list">${contents.map((block) => html`<li><a href="#${block.id}">${block.text}</a></li>`)}</ol></nav>`)}
      <div class="page__body">${renderBlocks(blocks, env)}</div>
    </div>
    ${related(page, context)}
  </article>`;
  return pageShell(shellInput(page, data, body), context);
}

/* ---------------------------------------------------------------- events */

function occurrenceRow(occurrence: EventOccurrence, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  const venue = eventVenue(occurrence.event);
  return html`<li class="event">
    <span class="event__date"><span class="event__month">${monthAbbreviation(occurrence.date)}</span><span class="event__day">${dayOfMonth(occurrence.date)}</span></span>
    <span class="event__body">
      <span class="event__time"><time datetime="${occurrence.date}T${occurrence.start}">${formatLongDate(occurrence.date)}, ${formatTimeRange(occurrence.start, occurrence.end)}</time>${when(isRecurring(occurrence.event), () => html` ${recurringGlyph()}<span class="sr-only">Recurring</span>`)}</span>
      <span class="event__title"><a href="${links.path(occurrence.event.path)}">${occurrence.event.title}</a></span>
      <span class="event__venue">${venue.name}, ${venue.address}, ${venue.locality}</span>
    </span>
  </li>`;
}

/** Upcoming occurrences as the homepage ledger and the events page use them. */
export function upcomingList(today: string, context: FrontendRenderContext, options: { days?: number; limit?: number } = {}): Html {
  const occurrences = upcomingOccurrences(today, options);
  if (!occurrences.length) return sectionNote("No upcoming event is scheduled in the next few weeks.");
  return html`<ol class="events" role="list">${occurrences.map((occurrence) => occurrenceRow(occurrence, context))}</ol>`;
}

function gatheringTile(event: ChurchEvent, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<li class="tile tile--linked${event.media ? " tile--pictured" : ""}">
    ${when(event.media, () => html`<div class="tile__picture">${picture(event.media!, { className: "tile__image", alt: "" })}</div>`)}
    <div class="tile__body">
      <p class="eyebrow tile__eyebrow">${scheduleLabel(event)}</p>
      <h3 class="tile__title"><a href="${links.path(event.path)}">${event.title}</a></h3>
      ${when(event.description[0], () => html`<p class="tile__text tile__text--clamp">${event.description[0]}</p>`)}
    </div>
  </li>`;
}

export function renderEventsPage(page: SitePage, data: ChurchPageData, context: FrontendRenderContext = publicRenderContext): string {
  const env: BlockEnvironment = { context, today: data.today, sermons: data.sermons };
  const links = siteLinks(context);
  const regular = (events as readonly ChurchEvent[]).filter((event) => isRecurring(event) && occurrencesBetween(event, data.today, `${Number(data.today.slice(0, 4)) + 1}${data.today.slice(4)}`, 1).length > 0);
  const past = pastEvents(data.today);
  const body = html`<article class="page page--events">
    ${pageHead(page, context)}
    <div class="page__body">${renderBlocks(page.blocks.filter((block) => block.kind !== "events-calendar"), env)}</div>
    <section class="section" aria-labelledby="upcoming-heading">
      ${sectionHead("upcoming-heading", "Upcoming", html`<a class="button button--outline" href="${links.path("/events/calendar.ics")}">Subscribe to the calendar</a>`)}
      ${upcomingList(data.today, context, { days: 35 })}
    </section>
    <section class="section" aria-labelledby="regular-heading">
      ${sectionHead("regular-heading", "Regular gatherings")}
      <ul class="tiles tiles--3" role="list">${regular.map((event) => gatheringTile(event, context))}</ul>
    </section>
    ${when(past.length, () => html`<section class="section" aria-labelledby="past-heading">
      ${sectionHead("past-heading", "Past events")}
      <ul class="past-events" role="list">${past.map((event) => html`<li><a href="${links.path(event.path)}">${event.title}</a> <span class="past-events__when">${scheduleLabel(event)}</span></li>`)}</ul>
    </section>`)}
    ${related(page, context)}
  </article>`;
  return pageShell(shellInput(page, data, body), context);
}

export function renderEventPage(event: ChurchEvent, data: ChurchPageData, context: FrontendRenderContext = publicRenderContext): string {
  const links = siteLinks(context);
  const venue = eventVenue(event);
  const upcoming = occurrencesBetween(event, data.today, `${Number(data.today.slice(0, 4)) + 1}${data.today.slice(4)}`, 6);
  const ministry = event.page ? pageById(event.page) : null;
  const eventsIndex = pageById("events");
  const body = html`<article class="page page--event">
    <header class="page__head${event.media ? " page__head--aside" : ""}">
      <div class="page__head-text">
        ${trail([{ href: "/", label: "Home" }, { href: eventsPath, label: eventsIndex.title }], context)}
        <p class="eyebrow">${isRecurring(event) ? "Regular gathering" : "Event"}</p>
        <h1 class="page__title">${event.title}</h1>
        <p class="lede page__lede">${scheduleLabel(event)}</p>
      </div>
      ${when(event.media, () => html`<div class="page__head-picture">${picture(event.media!, { className: "page__head-image", eager: true })}</div>`)}
    </header>
    <div class="page__body">
      <div class="event-detail">
        <section class="event-detail__dates" aria-labelledby="dates-heading">
          <h2 id="dates-heading" class="page__h2">${upcoming.length > 1 ? "Next dates" : "When"}</h2>
          ${upcoming.length
            ? html`<ul class="page__list" role="list">${upcoming.map((occurrence) => html`<li><time datetime="${occurrence.date}T${occurrence.start}">${formatLongDate(occurrence.date)}</time>, ${formatTimeRange(occurrence.start, occurrence.end)}</li>`)}</ul>`
            : html`<p>${event.schedule.kind === "single" ? `This event took place on ${formatLongDate(event.schedule.date)}, ${formatTimeRange(event.start, event.end)}.` : "No upcoming date is scheduled."}</p>`}
        </section>
        <section class="event-detail__venue" aria-labelledby="venue-heading">
          <h2 id="venue-heading" class="page__h2">Where</h2>
          <address class="contact-panel__address"><strong>${venue.name}</strong><span>${venue.address}</span><span>${venue.locality}</span>${when(venue.phone, () => html`<span><a href="tel:+61${venue.phone!.replace(/\D/gu, "").replace(/^0/u, "")}">${venue.phone}</a></span>`)}</address>
          ${when(venue.mapHref, () => html`<p><a class="button button--outline" href="${venue.mapHref}" rel="noopener">Open in Google Maps<span class="sr-only"> (external site)</span></a></p>`)}
          ${when(venue.href, () => html`<p><a href="${venue.href}" rel="noopener">${venue.name} website<span class="sr-only"> (external site)</span></a></p>`)}
        </section>
      </div>
      ${event.description.map((text) => paragraph(text, context))}
      ${when(ministry && pageAvailable(ministry, context), () => html`<p class="event-detail__ministry"><a class="button" href="${links.path(ministry!.path)}">${ministry!.title}</a></p>`)}
      <p><a href="${links.path(eventsPath)}">All events</a> · <a href="${links.path("/events/calendar.ics")}">Subscribe to the calendar</a></p>
    </div>
  </article>`;
  return pageShell({
    title: event.title,
    description: event.description[0] ?? `${event.title}: ${scheduleLabel(event)} at ${venue.name}.`,
    canonicalPath: event.path,
    robots: "index, follow",
    styles: ["cards", "sermon", "church"],
    books: data.options.books,
    body
  }, context);
}

/* ------------------------------------------------------------ calendar */

function icsEscape(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/;/gu, "\\;").replace(/,/gu, "\\,").replace(/\n/gu, "\\n");
}

function icsFold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 72) { out.push(rest.slice(0, 72)); rest = ` ${rest.slice(72)}`; }
  out.push(rest);
  return out.join("\r\n");
}

const weekdayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** The site's iCalendar feed of every event, with recurrence rules as exported. */
export function renderCalendarFeed(): string {
  const stamp = (date: string, time: string) => `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Saving Grace Bible Church//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(siteName)} events`, "X-WR-TIMEZONE:Australia/Melbourne",
    "BEGIN:VTIMEZONE", "TZID:Australia/Melbourne",
    "BEGIN:STANDARD", "DTSTART:19700405T030000", "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU", "TZOFFSETFROM:+1100", "TZOFFSETTO:+1000", "TZNAME:AEST", "END:STANDARD",
    "BEGIN:DAYLIGHT", "DTSTART:19701004T020000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU", "TZOFFSETFROM:+1000", "TZOFFSETTO:+1100", "TZNAME:AEDT", "END:DAYLIGHT",
    "END:VTIMEZONE"
  ];
  for (const event of events as readonly ChurchEvent[]) {
    const venue = eventVenue(event);
    const start = event.schedule.kind === "single" ? event.schedule.date : event.schedule.from;
    lines.push("BEGIN:VEVENT", `UID:${event.id}@www.savinggrace.org.au`, `DTSTAMP:20260924T000000Z`, `DTSTART;TZID=Australia/Melbourne:${stamp(start, event.start)}`, `DTEND;TZID=Australia/Melbourne:${stamp(start, event.end)}`, `SUMMARY:${icsEscape(event.title)}`, `LOCATION:${icsEscape(`${venue.name}, ${venue.address}, ${venue.locality}`)}`, `URL:https://www.savinggrace.org.au${event.path}`);
    if (event.description.length) lines.push(`DESCRIPTION:${icsEscape(event.description.join("\n\n"))}`);
    if (event.schedule.kind === "weekly") {
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${weekdayCodes[event.schedule.weekday]}${event.schedule.until ? `;UNTIL=${stamp(event.schedule.until, event.end)}` : ""}`);
    } else if (event.schedule.kind === "monthly-first") {
      lines.push(`RRULE:FREQ=MONTHLY;BYDAY=1${weekdayCodes[event.schedule.weekday]}${event.schedule.until ? `;UNTIL=${stamp(event.schedule.until, event.end)}` : ""}`);
    }
    if (event.schedule.kind !== "single" && event.schedule.exclusions?.length) {
      lines.push(`EXDATE;TZID=Australia/Melbourne:${event.schedule.exclusions.map((date) => stamp(date, event.start)).join(",")}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(icsFold).join("\r\n")}\r\n`;
}

/* ---------------------------------------------------------------- blog */

function postCard(post: BlogPost, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<li class="tile tile--linked${post.media ? " tile--pictured" : ""}">
    ${when(post.media, () => html`<div class="tile__picture">${picture(post.media!, { className: "tile__image", alt: "" })}</div>`)}
    <div class="tile__body">
      <p class="eyebrow tile__eyebrow">${timeElement(post.date)}</p>
      <h2 class="tile__title"><a href="${links.path(post.path)}">${post.title}</a></h2>
      <p class="tile__text tile__text--clamp">${post.description}</p>
    </div>
  </li>`;
}

export function renderBlogIndex(page: SitePage, data: ChurchPageData, context: FrontendRenderContext = publicRenderContext): string {
  const posts = [...blogPosts].sort((a, b) => b.date.localeCompare(a.date));
  const body = html`<article class="page page--blog">
    ${pageHead(page, context, html`<p class="lede page__lede">${page.description}</p>`)}
    <div class="page__body"><ul class="tiles tiles--3" role="list">${posts.map((post) => postCard(post, context))}</ul></div>
    ${related(page, context)}
  </article>`;
  return pageShell(shellInput(page, data, body), context);
}

export function renderBlogPost(post: BlogPost, data: ChurchPageData, context: FrontendRenderContext = publicRenderContext): string {
  const env: BlockEnvironment = { context, today: data.today, sermons: data.sermons };
  const blogs = pageById("blogs");
  const body = html`<article class="page page--post">
    <header class="page__head${post.media ? " page__head--aside" : ""}">
      <div class="page__head-text">
        ${trail([{ href: "/", label: "Home" }, { href: blogs.path, label: blogs.title }], context)}
        <p class="eyebrow">${timeElement(post.date)}</p>
        <h1 class="page__title">${post.title}</h1>
      </div>
      ${when(post.media, () => html`<div class="page__head-picture">${picture(post.media!, { className: "page__head-image", eager: true })}</div>`)}
    </header>
    <div class="page__body">${renderBlocks(post.blocks, env)}</div>
    <p class="page__back"><a href="${siteLinks(context).path(blogs.path)}">All blog posts</a></p>
  </article>`;
  return pageShell({
    title: post.title,
    description: post.description,
    canonicalPath: post.path,
    robots: "index, follow",
    openGraphType: "article",
    styles: ["cards", "sermon", "church"],
    books: data.options.books,
    body
  }, context);
}

/* -------------------------------------------------------------- sitemap */

export function renderSitemapPage(page: SitePage, data: ChurchPageData, context: FrontendRenderContext = publicRenderContext): string {
  const links = siteLinks(context);
  const groups = sitemapGroups(context);
  const body = html`<article class="page page--sitemap">
    ${pageHead(page, context, html`<p class="lede page__lede">${page.description}</p>`)}
    <div class="page__body sitemap">
      <section class="sitemap__group"><h2 class="page__h2">Home</h2><ul class="page__list"><li><a href="${links.home}">${siteName}</a></li></ul></section>
      ${groups.map((group) => html`<section class="sitemap__group"><h2 class="page__h2">${group.label}</h2><ul class="page__list">${group.pages.map((item) => html`<li><a href="${links.path(item.path)}">${item.title}</a>${when(item.status !== "published", () => html` <span class="page__badge">${item.status}</span>`)}</li>`)}${when(group.label === "Sermons", () => html`<li><a href="${links.archive}">Sermon archive</a></li>`)}${when(group.label === "News & Events", () => (events as readonly ChurchEvent[]).map((event) => html`<li><a href="${links.path(event.path)}">${event.title}</a></li>`))}${when(group.label === "Blogs", () => blogPosts.map((post) => html`<li><a href="${links.path(post.path)}">${post.title}</a></li>`))}</ul></section>`)}
    </div>
  </article>`;
  return pageShell(shellInput(page, data, body), context);
}

/** Every page path the static build should emit for a context. */
export function staticChurchPaths(context: FrontendRenderContext = publicRenderContext): string[] {
  return [
    ...availablePages(context).map((page) => page.path),
    ...(events as readonly ChurchEvent[]).map((event) => event.path),
    ...blogPosts.map((post) => post.path)
  ];
}

export { firstParagraph, formattedDate };

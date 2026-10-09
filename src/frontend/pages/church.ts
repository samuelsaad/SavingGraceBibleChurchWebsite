/**
 * The church's own pages: the content pages (About, teaching, ministries,
 * resources, giving, contact), the events calendar and event pages, the
 * blog index and posts, and the sitemap. All share the Canon shell; a
 * page's blocks come from the content registry, its images from the media
 * registry, and its dates from the events schedule.
 */
import {editAttributes,editField,fieldPath,type CmsRenderMetadata} from "../editing";
import type { SermonSummary } from "../../domain/sermon";
import type { PublicSermonFilterOptions } from "../../server/repositories/sermon-repository";
import { firstParagraph, hasVideo, picture, renderBlock, renderBlocks, type BlockEnvironment } from "../components/blocks";
import { recurringGlyph } from "../components/glyphs";
import { sectionHead, sectionNote } from "../components/sections";
import {
  dayOfMonth,
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
import { availablePages, postsFor, breadcrumbs, eventVenue, pageAvailable, sitemapGroups, type TrailItem } from "../content/registry";
import type { Block, BlogPost, SitePage } from "../content/types";
import { formattedDate, html, siteName, timeElement, when, type Html } from "../html";
import { publicRenderContext, siteLinks, type FrontendRenderContext } from "../routes";
import { pageShell, type PageShellInput } from "../shell";

export interface ChurchPageData {
  /** ISO calendar date in Melbourne. */
  today: string;
  /** Newest published sermons, newest first (may be empty). */
  sermons: SermonSummary[];
  options: PublicSermonFilterOptions;
  sermonSelections?: Readonly<Record<string, SermonSummary[]>>;
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
  const items = (page.related ?? []).map((id) => availablePages(context).find(candidate=>candidate.id===id)).filter((candidate): candidate is SitePage => Boolean(candidate && pageAvailable(candidate, context)));
  if (!items.length) return html``;
  return html`<nav class="page__related" aria-labelledby="related-heading">
    <h2 id="related-heading" class="section__title">Also in this section</h2>
    <ul class="related-list" role="list">${items.map((item) => html`<li><a href="${links.path(item.path)}">${item.title}</a></li>`)}</ul>
  </nav>`;
}

function pageHead(page: SitePage, context: FrontendRenderContext, lede?: Html): Html {
  const heading = page.heading ?? page.title;
  return html`<header${editAttributes(context,[],"section","Page introduction")} class="page__head${page.hero && page.hero.enabled!==false ? " page__head--aside" : ""}">
    <div class="page__head-text">
      ${trail(breadcrumbs(page, context), context)}
      <h1 class="page__title${heading.length > 32 ? " page__title--long" : ""}"${editAttributes(context,[page.heading!==undefined?"heading":"title"],"text","Page heading")}>${heading}</h1>
      ${when(page.eyebrow && page.eyebrow !== heading, () => html`<p class="page__category"${editAttributes(context,["eyebrow"],"text","Category label")}>${page.eyebrow}</p>`)}
      ${lede ?? when(page.lede, () => editField(paragraph(page.lede!, context, "lede page__lede"),context,["lede"],"richtext","Introduction"))}
      ${statusBand(page)}
    </div>
    ${when(page.hero && page.hero.enabled!==false, () => html`<div class="page__head-picture">${picture(page.hero!.media, { className: "page__head-image", eager: true, context,editPath:["hero","media"], ...(page.hero!.alt!==undefined?{alt:page.hero!.alt}:{}), ...(page.hero!.focalPoint?{focalPoint:page.hero!.focalPoint}:{}) })}</div>`)}
  </header>`;
}

function shellInput(page: SitePage, data: ChurchPageData, body: Html, extra: Partial<PageShellInput> = {}): PageShellInput {
  return {
    title: page.title,
    ...(page.seo?{seo:page.seo}:{}),
    description: page.description,
    canonicalPath: page.path,
    robots: page.status === "published" ? "index, follow" : "noindex, nofollow",
    styles: ["cards", "church", ...(page.blocks.some(block=>block.kind.startsWith("home-"))?["home" as const]:[])],
    scripts: hasVideo([...page.blocks,...(page.aside??[])]) ? ["church"] : [],
    books: data.options.books,
    body,
    ...extra
  };
}

/** A content page: head, optional banner, the blocks, and the section's related links. */
export function renderChurchPage(page: SitePage, data: ChurchPageData, context: FrontendRenderContext = publicRenderContext): string {
  const env: BlockEnvironment = { context, today: data.today, sermons: data.sermons, ...(data.sermonSelections?{sermonSelections:data.sermonSelections}:{}) };
  const body = html`<article class="page page--${page.section}">
    ${pageHead(page, context)}
    <div class="page__body">${renderBlocks(page.blocks, env)}${when(page.aside?.length,()=>renderBlocks(page.aside!,env))}</div>
    ${related(page, context)}
  </article>`;
  return pageShell(shellInput(page, data, body), context);
}

/* ---------------------------------------------------------------- events */

function occurrenceRow(occurrence: EventOccurrence, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  const venue = eventVenue(occurrence.event, context);
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
  const occurrences = upcomingOccurrences(today, options, context.siteContent?.events);
  if (!occurrences.length) return sectionNote("No upcoming event is scheduled in the next few weeks.");
  return html`<ol class="events" role="list">${occurrences.map((occurrence) => occurrenceRow(occurrence, context))}</ol>`;
}

function gatheringTile(event: ChurchEvent, context: FrontendRenderContext): Html {
  const links = siteLinks(context);
  return html`<li class="tile tile--linked${event.media ? " tile--pictured" : ""}">
    ${when(event.media, () => html`<div class="tile__picture">${picture(event.media!, { className: "tile__image", alt: "", context })}</div>`)}
    <div class="tile__body">
      <h3 class="tile__title"><a href="${links.path(event.path)}">${event.title}</a></h3>
      <p class="tile__metadata">${scheduleLabel(event)}</p>
      ${when(event.description[0], () => html`<p class="tile__text tile__text--clamp">${event.description[0]}</p>`)}
    </div>
  </li>`;
}

type CalendarBlock=Extract<Block,{kind:"events-calendar"}>;
function calendarData(block:CalendarBlock,today:string,context:FrontendRenderContext){
 const regular=(context.siteContent?.events ?? events).filter(event=>isRecurring(event)&&occurrencesBetween(event,today,`${Number(today.slice(0,4))+1}${today.slice(4)}`,1).length>0);
 return {regular: block.showRegular===false?[]:regular,past:block.showPast===false?[]:pastEvents(today,context.siteContent?.events),upcoming:block.showUpcoming===false?[]:upcomingOccurrences(today,{days:block.days??35},context.siteContent?.events)};
}
function calendarIds(block:CalendarBlock){const id=(block as {cmsInstanceId?:string}).cmsInstanceId;const prefix=id&&id!=="events-002"?`${id}-`:"";return {upcoming:`${prefix}upcoming-heading`,regular:`${prefix}regular-heading`,past:`${prefix}past-heading`};}
function calendarJumps(block:CalendarBlock,today:string,context:FrontendRenderContext):Html{
 const {upcoming,regular,past}=calendarData(block,today,context),ids=calendarIds(block);
 return html`${when(upcoming.length||regular.length||past.length,()=>html`<nav class="events-jumps" aria-label="On this events page">${when(upcoming.length,()=>html`<a href="#${ids.upcoming}">${block.upcomingHeading??"Upcoming"}</a>`)}${when(regular.length,()=>html`<a href="#${ids.regular}">${block.regularHeading??"Regular gatherings"}</a>`)}${when(past.length,()=>html`<a href="#${ids.past}">${block.pastHeading??"Past events"}</a>`)}</nav>`)}`;
}
export function renderEventCalendar(block:CalendarBlock,env:BlockEnvironment):Html{
 const context=env.context,links=siteLinks(context),{upcoming,regular,past}=calendarData(block,env.today,context),ids=calendarIds(block),limit=block.limit??6;
 return html`${when(block.showUpcoming!==false,()=>html`<section class="section" aria-labelledby="${ids.upcoming}">
   ${sectionHead(ids.upcoming,block.upcomingHeading??"Upcoming",html`<a class="button button--outline"${editAttributes(context,fieldPath(block,"subscribeLabel"),"text","Calendar button label")} href="${links.path("/events/calendar.ics")}">${block.subscribeLabel??"Subscribe to the calendar"}</a>`,editAttributes(context,fieldPath(block,"upcomingHeading"),"text","Upcoming events heading"))}
   ${upcoming.length?html`<ol class="events" role="list">${upcoming.slice(0,limit).map(occurrence=>occurrenceRow(occurrence,context))}</ol>${when(upcoming.length>limit,()=>html`<details class="events-more"><summary class="events-more__summary">More upcoming dates <span class="events-more__count">(${upcoming.length-limit})</span></summary><ol class="events" start="${limit+1}" role="list">${upcoming.slice(limit).map(occurrence=>occurrenceRow(occurrence,context))}</ol></details>`)}`:sectionNote("No upcoming event is scheduled in the next few weeks.")}
  </section>`)}
  ${when(regular.length,()=>html`<section class="section" aria-labelledby="${ids.regular}">${sectionHead(ids.regular,block.regularHeading??"Regular gatherings",undefined,editAttributes(context,fieldPath(block,"regularHeading"),"text","Regular gatherings heading"))}<ul class="tiles tiles--3" role="list">${regular.map(event=>gatheringTile(event,context))}</ul></section>`)}
  ${when(past.length,()=>html`<section class="section" aria-labelledby="${ids.past}">${sectionHead(ids.past,block.pastHeading??"Past events",undefined,editAttributes(context,fieldPath(block,"pastHeading"),"text","Past events heading"))}<ul class="past-events" role="list">${past.map(event=>html`<li><a href="${links.path(event.path)}">${event.title}</a> <span class="past-events__when">${scheduleLabel(event)}</span></li>`)}</ul></section>`)}`;
}
export function renderEventsPage(page:SitePage,data:ChurchPageData,context:FrontendRenderContext=publicRenderContext):string{
 const env:BlockEnvironment={context,today:data.today,sermons:data.sermons,...(data.sermonSelections?{sermonSelections:data.sermonSelections}:{})};
 const calendar=page.blocks.find((block):block is CalendarBlock=>block.kind==="events-calendar"&&(block as CmsRenderMetadata).cmsEnabled!==false);
 const body=html`<article class="page page--events">${pageHead(page,context)}${calendar?calendarJumps(calendar,data.today,context):html``}${page.blocks.map(block=>block.kind==="events-calendar"?renderBlock(block,env):html`<div class="page__body">${renderBlock(block,env)}</div>`)}${related(page,context)}</article>`;
 return pageShell(shellInput(page,data,body),context);
}

export function renderEventPage(event: ChurchEvent, data: ChurchPageData, context: FrontendRenderContext = publicRenderContext): string {
  const links = siteLinks(context);
  const venueEditing=context.visualEditor?.kind==="venue";
  const venueContext=venueEditing?{...context,visualEditor:{...context.visualEditor!,kind:"venue-fields"}}:context;
  const venueMark=(key:string,kind:"text"|"link"="text",label="Venue details")=>editAttributes(venueContext,venueEditing?[key]:undefined,kind,label);
  const venue = eventVenue(event, context);
  const upcoming = occurrencesBetween(event, data.today, `${Number(data.today.slice(0, 4)) + 1}${data.today.slice(4)}`, 6);
  const ministry = event.page ? availablePages(context).find(page=>page.id===event.page) : null;
  const eventsIndex = availablePages(context).find(page=>page.id==="events");
  const body = html`<article class="page page--event">
    <header class="page__head${event.media ? " page__head--aside" : ""}">
      <div class="page__head-text">
        ${trail([{ href: "/", label: "Home" }, ...(eventsIndex?[{ href: eventsIndex.path, label: eventsIndex.title }]:[])], context)}
        <h1 class="page__title${event.title.length > 32 ? " page__title--long" : ""}"${editAttributes(context,["title"],"text","Event title")}>${event.title}</h1>
        <p class="page__category">${isRecurring(event) ? "Regular gathering" : "Event"}</p>
        <p class="lede page__lede"${editAttributes(context,["schedule"],"section","Event schedule")}>${scheduleLabel(event)}</p>
      </div>
      ${when(event.media, () => html`<div class="page__head-picture">${picture(event.media!, { className: "page__head-image", eager: true, context,editPath:["media"],...(event.mediaAlt!==undefined?{alt:event.mediaAlt}:{}),...(event.mediaFocalPoint?{focalPoint:event.mediaFocalPoint}:{}) })}</div>`)}
    </header>
    <div class="page__body">
      <div class="event-detail">
        <section class="event-detail__dates" aria-labelledby="dates-heading">
          <h2 id="dates-heading" class="page__h2">${upcoming.length > 1 ? "Next dates" : "When"}</h2>
          ${upcoming.length
            ? html`<ul class="page__list" role="list">${upcoming.map((occurrence) => html`<li><time datetime="${occurrence.date}T${occurrence.start}">${formatLongDate(occurrence.date)}</time>, ${formatTimeRange(occurrence.start, occurrence.end)}</li>`)}</ul>`
            : html`<p>${event.schedule.kind === "single" ? `This event took place on ${formatLongDate(event.schedule.date)}, ${formatTimeRange(event.start, event.end)}.` : "No upcoming date is scheduled."}</p>`}
        </section>
        <section class="event-detail__venue" aria-labelledby="venue-heading"${editAttributes(context,["venue"],"section","Event venue")}>
          <h2 id="venue-heading" class="page__h2">Where</h2>
          <address class="contact-panel__address"><strong${venueMark("name","text","Venue name")}>${venue.name}</strong><span${venueMark("address","text","Venue address")}>${venue.address}</span><span${venueMark("locality","text","Venue locality")}>${venue.locality}</span>${when(venue.phone, () => html`<span><a href="tel:+61${venue.phone!.replace(/\D/gu, "").replace(/^0/u, "")}"${venueMark("phone","text","Venue telephone")}>${venue.phone}</a></span>`)}</address>
          ${when(venue.mapHref, () => html`<p><a class="button button--outline"${venueMark("mapHref","link","Map destination")} href="${venue.mapHref}" rel="noopener">Open in Google Maps<span class="sr-only"> (external site)</span></a></p>`)}
          ${when(venue.href, () => html`<p><a${venueMark("href","link","Venue website")} href="${venue.href}" rel="noopener">${venue.name} website<span class="sr-only"> (external site)</span></a></p>`)}
        </section>
      </div>
      ${event.description.map((text,index) => editField(paragraph(text, context),context,["description",index],"richtext","Event description"))}
      ${when(ministry && pageAvailable(ministry, context), () => html`<p class="event-detail__ministry"><a class="button" href="${links.path(ministry!.path)}">${ministry!.title}</a></p>`)}
      <p>${when(eventsIndex,()=>html`<a href="${links.path(eventsIndex!.path)}">All events</a> · `)}<a href="${links.path("/events/calendar.ics")}">Subscribe to the calendar</a></p>
    </div>
  </article>`;
  return pageShell({
    title: event.title,
    ...(event.seo?{seo:event.seo}:{}),
    description: event.description[0] ?? `${event.title}: ${scheduleLabel(event)} at ${venue.name}.`,
    canonicalPath: event.path,
    robots: "index, follow",
    styles: ["cards", "church"],
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
export function renderCalendarFeed(context:FrontendRenderContext=publicRenderContext): string {
  const stamp = (date: string, time: string) => `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Saving Grace Bible Church//Events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(siteName)} events`, "X-WR-TIMEZONE:Australia/Melbourne",
    "BEGIN:VTIMEZONE", "TZID:Australia/Melbourne",
    "BEGIN:STANDARD", "DTSTART:19700405T030000", "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU", "TZOFFSETFROM:+1100", "TZOFFSETTO:+1000", "TZNAME:AEST", "END:STANDARD",
    "BEGIN:DAYLIGHT", "DTSTART:19701004T020000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU", "TZOFFSETFROM:+1000", "TZOFFSETTO:+1100", "TZNAME:AEDT", "END:DAYLIGHT",
    "END:VTIMEZONE"
  ];
  for (const event of (context.siteContent?.events ?? events) as readonly ChurchEvent[]) {
    const venue = eventVenue(event, context);
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
    ${when(post.media, () => html`<div class="tile__picture">${picture(post.media!, { className: "tile__image", alt: "", context })}</div>`)}
    <div class="tile__body">
      <h2 class="tile__title"><a href="${links.path(post.path)}">${post.title}</a></h2>
      <p class="tile__metadata">${timeElement(post.date)}</p>
      <p class="tile__text tile__text--clamp">${post.description}</p>
    </div>
  </li>`;
}

export function renderBlogListing(block:Extract<Block,{kind:"blog-list"}>,context:FrontendRenderContext):Html{
 const posts=[...postsFor(context)].sort((a,b)=>block.order==="ASC"?a.date.localeCompare(b.date):b.date.localeCompare(a.date)).slice(0,block.limit??100);
 return html`${when(block.heading,()=>html`<h2 class="page__h2"${editAttributes(context,fieldPath(block,"heading"),"text","Blog heading")}>${block.heading}</h2>`)}<ul class="tiles tiles--3" role="list">${posts.map(post=>postCard(post,context))}</ul>`;
}
export function renderBlogIndex(page:SitePage,data:ChurchPageData,context:FrontendRenderContext=publicRenderContext):string{
 const env:BlockEnvironment={context,today:data.today,sermons:data.sermons,...(data.sermonSelections?{sermonSelections:data.sermonSelections}:{})};
 const body=html`<article class="page page--blog">${pageHead(page,context,html`<p class="lede page__lede"${editAttributes(context,["description"],"richtext","Introduction")}>${page.description}</p>`)}<div class="page__body">${renderBlocks(page.blocks,env)}</div>${related(page,context)}</article>`;
 return pageShell(shellInput(page,data,body),context);
}

export function renderBlogPost(post: BlogPost, data: ChurchPageData, context: FrontendRenderContext = publicRenderContext): string {
  const env: BlockEnvironment = { context, today: data.today, sermons: data.sermons, ...(data.sermonSelections?{sermonSelections:data.sermonSelections}:{}) };
  const blogs = availablePages(context).find(page=>page.id==="blogs");
  const body = html`<article class="page page--post">
    <header class="page__head${post.media ? " page__head--aside" : ""}">
      <div class="page__head-text">
        ${trail([{ href: "/", label: "Home" }, ...(blogs?[{ href: blogs.path, label: blogs.title }]:[])], context)}
        <h1 class="page__title${post.title.length > 32 ? " page__title--long" : ""}"${editAttributes(context,["title"],"text","Post title")}>${post.title}</h1>
        <p class="page__category"${editAttributes(context,["date"],"text","Post date")}>${timeElement(post.date)}</p>
      </div>
      ${when(post.media, () => html`<div class="page__head-picture">${picture(post.media!, { className: "page__head-image", eager: true, context,editPath:["media"],...(post.mediaAlt!==undefined?{alt:post.mediaAlt}:{}),...(post.mediaFocalPoint?{focalPoint:post.mediaFocalPoint}:{}) })}</div>`)}
    </header>
    <div class="page__body">${renderBlocks(post.blocks, env)}</div>
    ${when(blogs,()=>html`<p class="page__back"><a href="${siteLinks(context).path(blogs!.path)}">All blog posts</a></p>`)}
  </article>`;
  return pageShell({
    title: post.title,
    ...(post.seo?{seo:post.seo}:{}),
    description: post.description,
    canonicalPath: post.path,
    robots: "index, follow",
    openGraphType: "article",
    styles: ["cards", "church"],
    scripts:hasVideo(post.blocks)?["church"]:[],
    books: data.options.books,
    body
  }, context);
}

/* -------------------------------------------------------------- sitemap */

export function renderSitemapListing(context:FrontendRenderContext):Html{
 const links=siteLinks(context),groups=sitemapGroups(context);
 return html`<div class="sitemap"><section class="sitemap__group"><h2 class="page__h2">Home</h2><ul class="page__list"><li><a href="${links.home}">${siteName}</a></li></ul></section>${groups.map(group=>html`<section class="sitemap__group"><h2 class="page__h2">${group.label}</h2><ul class="page__list">${group.pages.map(item=>html`<li><a href="${links.path(item.path)}">${item.title}</a>${when(item.status!=="published",()=>html` <span class="page__badge">${item.status}</span>`)}</li>`)}${when(group.label==="Sermons",()=>html`<li><a href="${links.archive}">Sermon archive</a></li>`)}${when(group.label==="News & Events",()=> (context.siteContent?.events??events).map(event=>html`<li><a href="${links.path(event.path)}">${event.title}</a></li>`))}${when(group.label==="Blogs",()=>postsFor(context).map(post=>html`<li><a href="${links.path(post.path)}">${post.title}</a></li>`))}</ul></section>`)}</div>`;
}
export function renderSitemapPage(page:SitePage,data:ChurchPageData,context:FrontendRenderContext=publicRenderContext):string{
 const env:BlockEnvironment={context,today:data.today,sermons:data.sermons,...(data.sermonSelections?{sermonSelections:data.sermonSelections}:{})};
 const body=html`<article class="page page--sitemap">${pageHead(page,context,html`<p class="lede page__lede"${editAttributes(context,["description"],"richtext","Introduction")}>${page.description}</p>`)}<div class="page__body">${renderBlocks(page.blocks,env)}</div></article>`;
 return pageShell(shellInput(page,data,body),context);
}

/** Every page path the static build should emit for a context. */
export function staticChurchPaths(context: FrontendRenderContext = publicRenderContext): string[] {
  return [
    ...availablePages(context).map((page) => page.path),
    ...(context.siteContent?.events ?? events).map((event) => event.path),
    ...postsFor(context).map((post) => post.path)
  ];
}

export { firstParagraph, formattedDate };

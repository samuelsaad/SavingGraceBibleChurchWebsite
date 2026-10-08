/**
 * Church events, transcribed from the Events Calendar records in the
 * WordPress export of 24 September 2026. Recurring gatherings are kept as
 * schedules (the export's current recurrence rules and exclusions) so the
 * site computes upcoming occurrences itself; one-off events keep their
 * dates. Times are Melbourne wall-clock times (the export's
 * Australia/Melbourne zone) and are never converted.
 *
 * Where the export held several records for one gathering (an ended
 * schedule and its replacement), the gathering is one event here with the
 * current schedule, and every legacy record slug redirects to it.
 */

export type VenueId = string;

export interface Venue {
  id: VenueId;
  name: string;
  address: string;
  locality: string;
  phone?: string;
  href?: string;
  mapHref?: string;
  /** Legacy Events Calendar venue path. */
  legacyPath: string;
}

export const venues: Readonly<Record<VenueId, Venue>> = Object.freeze({
  church: {
    id: "church",
    name: "Saving Grace Bible Church",
    address: "Unit 5/217-219 Mickleham Rd",
    locality: "Westmeadows, Victoria 3049",
    phone: "0450 545 589",
    mapHref: "https://goo.gl/maps/gL2hcbXG3Ci9zqRVA",
    legacyPath: "/venue/saving-grace-bible-church/"
  },
  "rye-civic-hall": {
    id: "rye-civic-hall",
    name: "Rye Civic Hall",
    address: "12 Napier Street",
    locality: "Rye, VIC 3941",
    href: "https://www.mornpen.vic.gov.au/Image-Galleries/Rye-Civic-Hall",
    legacyPath: "/venue/rye-civic-hall/"
  },
  "state-library": {
    id: "state-library",
    name: "State Library",
    address: "328 Swanston St",
    locality: "Melbourne, VIC 3000",
    legacyPath: "/venue/state-library/"
  }
});

export type Schedule =
  | { kind: "weekly"; weekday: number; from: string; until?: string; exclusions?: readonly string[] }
  | { kind: "monthly-first"; weekday: number; from: string; until?: string; exclusions?: readonly string[] }
  | { kind: "single"; date: string };

/** An event as declared below; `id` becomes the EventId union. */
type ChurchEventInput = Omit<ChurchEvent, "id"> & { id: string };

export interface ChurchEvent {
  id: string;
  title: string;
  /** Root-relative event page path. */
  path: string;
  schedule: Schedule;
  /** Wall-clock times, 24-hour "HH:MM". */
  start: string;
  end: string;
  venue: VenueId;
  /** Verbatim event description paragraphs from the export (may be empty). */
  description: readonly string[];
  /** The ministry page this gathering belongs to. */
  page?: string;
  media?: string;
  /** Legacy Events Calendar paths (event records and series) that redirect here. */
  legacyPaths: readonly string[];
  /** Source record identifiers, for the inventory. */
  sourceIds: readonly number[];
  /** The export's recurring-event tag ("#ES", "#TB", …), where one existed. */
  tag?: string;
}

const eveningServiceDescription = [
  "Join us at Saving Grace Bible Church for our Christ-centered Sunday Evening Service starting at 5:30 p.m. Dive deeper into the day's teachings, exploring the Word of God and its application in our lives. Delve into the Psalms, discovering their profound reflections of faith and their alignment with our walk with Christ.",
  "Witness the transformative power of Christ through personal testimonies of His grace. Our service focuses on equipping all believers for evangelism, passionately sharing the Gospel's message.",
  "In unity, we gather for heartfelt prayer, seeking divine guidance and the presence of Christ among us. Following this sacred time, join in fellowship over a shared meal, strengthening our bond as a body of believers. Experience an evening devoted to worship, Scripture, and the remarkable grace of our Lord Jesus Christ in a warm and inviting setting."
] as const;

export const events = [
  {
    id: "sunday-evening-service",
    title: "Sunday Evening Service",
    path: "/events/sunday-evening-service/",
    schedule: { kind: "weekly", weekday: 0, from: "2026-05-24", exclusions: ["2026-05-31"] },
    start: "17:30",
    end: "19:00",
    venue: "church",
    description: eveningServiceDescription,
    page: "evening-service",
    media: "evening-blossom",
    legacyPaths: ["/event/sunday-evening-service/", "/event/sunday-evening-service-2/", "/series/sunday-evening-service/"],
    sourceIds: [27911, 30083, 27914],
    tag: "#ES"
  },
  {
    id: "tuesday-bible-study",
    title: "Tuesday Bible Study",
    path: "/events/tuesday-bible-study/",
    schedule: { kind: "weekly", weekday: 2, from: "2026-06-30", exclusions: ["2026-06-30", "2026-07-07"] },
    start: "19:00",
    end: "20:30",
    venue: "church",
    description: [
      "Join us at Saving Grace Bible Church every Tuesday at 7:00 p.m. for an engaging Bible Study on the topic of Biblical End Times.",
      "Together, we’ll walk through what Scripture teaches about the return of Christ, the final judgment, and the hope of the new heavens and new earth. Grounded in sound doctrine and a high view of God’s sovereignty. This study will help us understand how the end of the story shapes how we live today.",
      "As always, God’s Word is our authority (2 Timothy 3:16), and through it, we are encouraged, challenged, and equipped to stand firm in faith (1 Thessalonians 5:6–11).",
      "Everyone is welcome—no registration needed. Whether you’re new to Bible prophecy or looking to deepen your understanding, we’d love for you to join the conversation."
    ],
    page: "bible-studies",
    media: "end-times",
    legacyPaths: ["/event/tuesday-bible-study-2-2/", "/event/tuesday-bible-study-2-2-2/", "/series/tuesday-bible-study/"],
    sourceIds: [30031, 30102, 27923],
    tag: "#TB"
  },
  {
    id: "mens-theological-study",
    title: "Men’s Theological Study",
    path: "/events/mens-theological-study/",
    schedule: { kind: "weekly", weekday: 0, from: "2026-06-07" },
    start: "16:30",
    end: "17:30",
    venue: "church",
    description: [
      "Join us for an enriching session at our Men’s Theological Study, a journey into the depths of theological exploration. This gathering, dedicated to the study of God’s Word and understanding the complexities of the end times, aims to deepen our faith and guide us in our roles as men of God. Engage in thought-provoking discussions and insights every Sunday from 4:30 PM to 5:30 PM"
    ],
    page: "mens-ministry",
    media: "mens-bible-study",
    legacyPaths: ["/event/mens-theological-study-2/", "/series/mens-theological-study/"],
    sourceIds: [29966, 27984],
    tag: "#TS"
  },
  {
    id: "womans-study",
    title: "Woman's Study",
    path: "/events/womans-study/",
    schedule: { kind: "monthly-first", weekday: 6, from: "2026-06-06" },
    start: "15:30",
    end: "17:00",
    venue: "church",
    description: [
      "Come join us for our monthly Women’s Study as we read The Blessing of Humility by Jerry Bridges.",
      "Together, we’ll take a closer look at what true humility looks like in our everyday lives. Through the Beatitudes, we’ll see how Jesus calls us to live with hearts that are poor in spirit, merciful, meek, and hungry for righteousness — and how God meets us with grace every step of the way.",
      "We meet on the first Saturday of every month from 3:30 PM to 5:00 PM"
    ],
    page: "womens-ministry",
    media: "blessing-of-humility",
    legacyPaths: ["/event/womans-study-2-2-2/", "/series/womans-study/"],
    sourceIds: [30027, 28009],
    tag: "#WS"
  },
  {
    id: "mens-study",
    title: "Men’s Study",
    path: "/events/mens-study/",
    schedule: { kind: "monthly-first", weekday: 6, from: "2026-06-06" },
    start: "15:30",
    end: "17:00",
    venue: "church",
    description: [
      "Join us for our monthly Men’s Purity Study as we delve into Fight Like a Man! Together, we’ll explore biblical truths and practical strategies to stand firm in holiness and overcome the challenges of sexual immorality. Meet us on the first Saturday of every month from 3:30 PM to 5:00 PM"
    ],
    page: "mens-ministry",
    media: "fight-like-a-man",
    legacyPaths: ["/event/mens-leadership-study-2-2/", "/series/mens-leadership-study/"],
    sourceIds: [30029, 27990],
    tag: "#MS"
  },
  {
    id: "mens-teaching-and-preaching-study",
    title: "Men’s Teaching and Preaching Study",
    path: "/events/mens-teaching-and-preaching-study/",
    schedule: { kind: "weekly", weekday: 2, from: "2026-06-30", exclusions: ["2026-06-30", "2026-07-07"] },
    start: "18:00",
    end: "19:00",
    venue: "church",
    description: [
      "Join us every Tuesday, 6-7 PM, for our Men’s Teaching and Preaching Study. Explore expository preaching principles, grow in your ability to handle God's Word faithfully, and fulfil your calling in ministry."
    ],
    page: "teaching-preaching-ministry",
    media: "preaching-and-preachers",
    legacyPaths: ["/event/mens-teaching-and-preaching-study/", "/event/mens-teaching-and-preaching-study-2/", "/event/mens-teaching-and-preaching-study-2-2/"],
    sourceIds: [29593, 29964, 30104],
    tag: "#TAP"
  },
  {
    id: "street-evangelism-outreach",
    title: "Street Evangelism | Outreach",
    path: "/events/street-evangelism-outreach/",
    schedule: { kind: "single", date: "2026-05-31" },
    start: "14:00",
    end: "17:00",
    venue: "state-library",
    description: eveningServiceDescription,
    page: "local-outreach",
    media: "good-news",
    legacyPaths: ["/event/street-evangelism-outreach/"],
    sourceIds: [30090]
  },
  {
    id: "music-team-meeting",
    title: "Music Team Meeting",
    path: "/events/music-team-meeting/",
    schedule: { kind: "single", date: "2024-02-25" },
    start: "12:30",
    end: "13:30",
    venue: "church",
    description: [],
    page: "music-ministry",
    legacyPaths: ["/event/music-team-meeting/"],
    sourceIds: [29099]
  },
  {
    id: "sgbc-members-meeting",
    title: "SGBC Members Meeting",
    path: "/events/sgbc-members-meeting/",
    schedule: { kind: "single", date: "2024-03-10" },
    start: "16:30",
    end: "17:30",
    venue: "church",
    description: [],
    page: "church-membership",
    legacyPaths: ["/event/sgbc-members-meeting/"],
    sourceIds: [29101]
  },
  {
    id: "sgbc-picnic-rye",
    title: "SGBC Picnic - Rye",
    path: "/events/sgbc-picnic-rye/",
    schedule: { kind: "single", date: "2024-03-23" },
    start: "08:00",
    end: "17:00",
    venue: "rye-civic-hall",
    description: [],
    legacyPaths: ["/event/sgbc-picnic-rye/"],
    sourceIds: [29103]
  }
] as const satisfies readonly ChurchEventInput[];

export type EventId = string;

export const eventsPath = "/events/";

export function eventById(id: EventId, collection: readonly ChurchEvent[] = events): ChurchEvent | undefined {
  return collection.find((event) => event.id === id);
}

export function eventBySlug(slug: string, collection: readonly ChurchEvent[] = events): ChurchEvent | null {
  return collection.find((event) => event.path === `${eventsPath}${slug}/`) ?? null;
}

export interface EventOccurrence {
  event: ChurchEvent;
  /** ISO calendar date. */
  date: string;
  start: string;
  end: string;
}

const dayMs = 86_400_000;

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * dayMs));
}

function weekdayOf(iso: string): number {
  return toDate(iso).getUTCDay();
}

function firstWeekdayOfMonth(year: number, month: number, weekday: number): string {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return toIso(new Date(first.getTime() + offset * dayMs));
}

/** Occurrences of one event on or after `from`, up to `until` (inclusive) and `limit`. */
export function occurrencesBetween(event: ChurchEvent, from: string, until: string, limit = 100): EventOccurrence[] {
  const schedule = event.schedule;
  const results: EventOccurrence[] = [];
  const push = (date: string) => { results.push({ event, date, start: event.start, end: event.end }); };
  if (schedule.kind === "single") {
    if (schedule.date >= from && schedule.date <= until) push(schedule.date);
    return results;
  }
  const exclusions = new Set(schedule.exclusions ?? []);
  const stop = schedule.until && schedule.until < until ? schedule.until : until;
  if (schedule.kind === "weekly") {
    let cursor = schedule.from > from ? schedule.from : from;
    cursor = addDays(cursor, (schedule.weekday - weekdayOf(cursor) + 7) % 7);
    while (cursor <= stop && results.length < limit) {
      if (!exclusions.has(cursor)) push(cursor);
      cursor = addDays(cursor, 7);
    }
    return results;
  }
  const startDate = toDate(schedule.from > from ? schedule.from : from);
  let year = startDate.getUTCFullYear();
  let month = startDate.getUTCMonth();
  while (results.length < limit) {
    const candidate = firstWeekdayOfMonth(year, month, schedule.weekday);
    if (candidate > stop) break;
    if (candidate >= from && candidate >= schedule.from && !exclusions.has(candidate)) push(candidate);
    month += 1;
    if (month === 12) { month = 0; year += 1; }
  }
  return results;
}

export interface UpcomingOptions {
  /** How many days ahead to look (default 70). */
  days?: number;
  limit?: number;
  eventIds?: readonly EventId[];
}

/** Every occurrence across events from `today`, soonest first. */
export function upcomingOccurrences(today: string, options: UpcomingOptions = {}, collection: readonly ChurchEvent[] = events): EventOccurrence[] {
  const until = addDays(today, options.days ?? 70);
  const selected = collection.filter((event) => !options.eventIds || options.eventIds.includes(event.id));
  const all = selected.flatMap((event) => occurrencesBetween(event, today, until));
  all.sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
  return options.limit ? all.slice(0, options.limit) : all;
}

/** The next occurrence of one event, looking a year ahead. */
export function nextOccurrence(id: EventId, today: string, collection: readonly ChurchEvent[] = events): EventOccurrence | null {
  const event = eventById(id, collection);
  return event ? occurrencesBetween(event, today, addDays(today, 366), 1)[0] ?? null : null;
}

export function isRecurring(event: ChurchEvent): boolean {
  return event.schedule.kind !== "single";
}

/** Past one-off events and ended schedules, most recent first. */
export function pastEvents(today: string, collection: readonly ChurchEvent[] = events): ChurchEvent[] {
  return collection
    .filter((event) => (event.schedule.kind === "single" ? event.schedule.date < today : Boolean(event.schedule.until && event.schedule.until < today)))
    .sort((a, b) => eventDateKey(b).localeCompare(eventDateKey(a)));
}

function eventDateKey(event: ChurchEvent): string {
  return event.schedule.kind === "single" ? event.schedule.date : event.schedule.until ?? event.schedule.from;
}

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "5:30 pm" from "17:30". */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  const suffix = hours >= 12 ? "pm" : "am";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** "Sunday 27 September 2026". */
export function formatLongDate(iso: string): string {
  const date = toDate(iso);
  return `${weekdayNames[date.getUTCDay()]} ${date.getUTCDate()} ${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function monthAbbreviation(iso: string): string {
  return monthNames[toDate(iso).getUTCMonth()]!.slice(0, 3).toUpperCase();
}

export function dayOfMonth(iso: string): string {
  return String(toDate(iso).getUTCDate());
}

/** A plain-words schedule such as "Every Sunday, 5:30 pm – 7:00 pm" or "First Saturday of the month, 3:30 pm – 5:00 pm". */
export function scheduleLabel(event: ChurchEvent): string {
  const range = formatTimeRange(event.start, event.end);
  switch (event.schedule.kind) {
    case "weekly":
      return `Every ${weekdayNames[event.schedule.weekday]}, ${range}`;
    case "monthly-first":
      return `First ${weekdayNames[event.schedule.weekday]} of the month, ${range}`;
    default:
      return `${formatLongDate(event.schedule.date)}, ${range}`;
  }
}

/** Today's calendar date in Melbourne, for computing upcoming occurrences. */
export function melbourneToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

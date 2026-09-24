/**
 * Church Events (WordPress page 28031, /church-events/, and the Events Calendar archive at /events/). Text transcribed verbatim from the WordPress export of 24 September 2026; occurrences are computed from the exported event schedules and "subscribe to our calendar" links to the site's own iCalendar feed.
 */
import type { SitePage } from "../types";

export const eventsPage: SitePage = {
  id: "events",
  path: "/events/",
  title: "News & Events",
  heading: "Church Events",
  status: "published",
  section: "events",
  description: "Engage with Saving Grace Bible Church's events, from enriching Bible studies to impactful community outreach. Stay connected with our calendar of activities!",
  legacyPaths: [
    "/church-events/",
    "/events/upcoming/",
    "/events/month/",
    "/events/today/",
    "/events/list/"
  ],
  source: { id: 28031, link: "https://savinggrace.org.au/church-events/", status: "publish", modified: "2023-12-04 15:22:17" },
  eyebrow: "News & Events",
  lede: "Stay informed about our services, events and special announcements.",
  blocks: [
    {
      kind: "paragraph",
      text: "Select an event below for more details, and [subscribe to our calendar](/events/calendar.ics) to ensure you never miss a church event."
    },
    { kind: "events-calendar" }
  ],
  related: [
    "lords-day-service",
    "evening-service",
    "bible-studies"
  ]
};

// The church's iCalendar feed for the static build, from the same event
// schedules the server runtimes use.
import { renderCalendarFeed } from "../../frontend";

export function GET(): Response {
  return new Response(renderCalendarFeed(), { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}

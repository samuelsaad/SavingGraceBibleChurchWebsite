/**
 * Archived Sermons (WordPress page 28656, /archived-sermons/). Text transcribed verbatim from the WordPress export of 24 September 2026; the SermonAudio browser embed becomes a link to the same SermonAudio address, so no third-party frame loads.
 */
import type { SitePage } from "../types";

export const archivedSermonsPage: SitePage = {
  id: "archived-sermons",
  path: "/archived-sermons/",
  title: "Archived Sermons",
  heading: "Archived Sermons: Timeless Wisdom",
  status: "published",
  section: "sermons",
  description: "Discover timeless sermons while our new page updates. Visit Saving Grace Church for Gospel teachings.",
  legacyPaths: [],
  source: { id: 28656, link: "https://savinggrace.org.au/archived-sermons/", status: "publish", modified: "2023-12-08 11:14:54" },
  eyebrow: "Sermons",
  lede: "While our new sermons page is being updated with the latest teachings, explore this collection of cherished past sermons. Each holds timeless wisdom and inspiration, offering unique insights and spiritual nourishment from the words of God. Visit [here](/sermons/)for our newest sermons as we work to enhance your experience.",
  hero: { media: "old-book", treatment: "aside" },
  blocks: [
    {
      kind: "external-plate",
      title: "Past sermons on SermonAudio",
      text: "Our older recordings are hosted by SermonAudio. The archive opens on SermonAudio's website.",
      href: "https://embed.sermonaudio.com/browser/broadcaster/savinggrace/?sort=newest&page_size=25&rounded=true",
      label: "Browse the SermonAudio archive"
    },
    {
      kind: "callout",
      title: "Stay Informed",
      text: "Stay connected with our community's heartbeat! Subscribe to our newsletter and join us on social media to keep abreast of our local outreach events, workshops, and ways to serve."
    }
  ],
  related: [
    "lords-day-service"
  ]
};

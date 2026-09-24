/**
 * Women's Ministry (WordPress page 28000, /womens-ministry/). Text transcribed verbatim from the WordPress export of 24 September 2026; "our next study" dates come from the events schedule.
 */
import type { SitePage } from "../types";

export const womensMinistryPage: SitePage = {
  id: "womens-ministry",
  path: "/womens-ministry/",
  title: "Women’s Ministry",
  heading: "Blossoming in Faith",
  status: "published",
  section: "ministries",
  parent: "ministries",
  description: "Seek faith and sisterhood at our Women’s Ministry. Dive into Scripture, worship, and fellowship, nurturing devotion to Jesus Christ.",
  legacyPaths: [
    "/pages/womens-ministry/"
  ],
  source: { id: 28000, link: "https://savinggrace.org.au/womens-ministry/", status: "publish", modified: "2025-08-06 09:54:24" },
  eyebrow: "Ministries",
  lede: "Welcome to the Women's Ministry at Saving Grace Bible Church, a nurturing community where women are inspired to deepen their worship and devotion to our Savior, Jesus Christ.",
  hero: { media: "womens-ministry", treatment: "banner" },
  blocks: [
    { kind: "heading", level: 2, text: "Our Purpose" },
    {
      kind: "paragraph",
      text: "The study sessions, exclusively tailored for women, play a vital role in our Women's Ministry. We are dedicated to fostering a deeper connection with Jesus by emphasising the study and application of Scripture. Our goal is to nurture a profound understanding of God's Word."
    },
    {
      kind: "quote",
      text: "\"Charm is deceptive, and beauty is fleeting; but a woman who fears the Lord is to be praised.\" - Proverbs 31:30",
      cite: "Proverbs 31:30"
    },
    { kind: "heading", level: 2, text: "Women’s Study" },
    { kind: "next-event", event: "womans-study", label: "Our next study:" },
    {
      kind: "book",
      media: "blessing-of-humility",
      text: "**Come join us for our monthly Women’s Study as we read _The Blessing of Humility_ by Jerry Bridges.**\n\nTogether, we’ll take a closer look at what true humility looks like in our everyday lives. Through the Beatitudes, we’ll see how Jesus calls us to live with hearts that are poor in spirit, merciful, meek, and hungry for righteousness and how God meets us with grace every step of the way.\n\n**We meet on the first Saturday of every month from 3:30 PM to 5:00 PM**"
    },
    { kind: "heading", level: 2, text: "What to expect" },
    {
      kind: "paragraph",
      text: "Our gatherings offer a supportive environment where women can delve into Scripture, share insights, and grow spiritually. Expect enriching discussions, heartfelt worship, and a sense of community that nurtures personal growth and a deeper relationship with Christ."
    },
    { kind: "heading", level: 2, text: "Get Involved" },
    {
      kind: "paragraph",
      text: "We invite women of all ages to join our vibrant community dedicated to growing in faith and devotion. Whether you seek to deepen your understanding of Scripture or desire to strengthen your relationship with Jesus, our Women's Ministry welcomes you with open arms."
    },
    {
      kind: "paragraph",
      text: "Come, be a part of a sisterhood committed to glorifying God through worship, study, and fellowship. Let's journey together in deepening our devotion to our Savior and Lord, Jesus Christ."
    },
    {
      kind: "callout",
      title: "Stay Updated",
      text: "To stay updated with our Women's Ministry events, devotionals, and more, subscribe to our newsletter and follow us on social media. We look forward to welcoming you to our Women's Ministry community."
    }
  ],
  related: [
    "bible-studies",
    "events",
    "ministries"
  ]
};

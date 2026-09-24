/**
 * Sunday School (WordPress page 26375, /pages/sunday-school/ → /sunday-school/). Text transcribed verbatim from the WordPress export of 24 September 2026.
 */
import type { SitePage } from "../types";

export const sundaySchoolPage: SitePage = {
  id: "sunday-school",
  path: "/sunday-school/",
  title: "Sunday School",
  heading: "Sunday School at Saving Grace Bible Church",
  status: "published",
  section: "ministries",
  parent: "ministries",
  description: "Nurture faith with Sunday School at Saving Grace Bible Church. Explore God's Word and grow with us. Classes for all ages. Join our vibrant Christian community.",
  legacyPaths: [
    "/pages/sunday-school/"
  ],
  source: { id: 26375, link: "https://savinggrace.org.au/pages/sunday-school/", status: "publish", modified: "2025-09-21 19:24:02" },
  eyebrow: "Ministries",
  hero: { media: "child-reading", treatment: "banner" },
  blocks: [
    {
      kind: "quote",
      text: "\"Train up a child in the way he should go; even when he is old he will not depart from it.\" - Proverbs 22:6",
      cite: "Proverbs 22:6"
    },
    { kind: "paragraph", text: "Day and Time: Every Sunday from 6:00 pm to 7:00 pm.", lede: true },
    { kind: "heading", level: 2, text: "Classes for All Ages" },
    {
      kind: "list",
      items: [
        "**Children:** This encompasses children from kindergarten to Primary school, usually up to around 9 years old.",
        "**Preteens:** This group bridges the gap between Primary school and adolescence, often including ages 10 to 12."
      ]
    },
    { kind: "heading", level: 2, text: "Here's why you should consider being a part of our Sunday School" },
    { kind: "heading", level: 3, text: "Evangelizing to the Children" },
    {
      kind: "paragraph",
      text: "Our Children's Ministry seeks to glorify God through evangelising children. We are dedicated to sharing the Gospel with our young ones, nurturing their faith, and equipping them to be messengers of God's love to their peers and families. As Jesus said, \"Let the little children come to me\" (Matthew 19:14), we invite children to encounter Christ through engaging and age-appropriate lessons."
    },
    { kind: "heading", level: 3, text: "Biblical Education" },
    {
      kind: "paragraph",
      text: "Our Sunday School is committed to providing solid biblical education. We delve into the Scriptures to uncover the timeless truths and wisdom contained within."
    },
    {
      kind: "callout",
      title: "Stay Updated",
      text: "To remain informed about our Sunday School schedule, special events, and more, subscribe to our newsletter and follow us on social media. We eagerly anticipate having you as part of our Sunday School community."
    }
  ],
  related: [
    "evening-service",
    "ministries",
    "events"
  ]
};

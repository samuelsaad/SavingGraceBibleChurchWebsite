/**
 * Men's Ministry (WordPress page 27942, /mens-ministry/). Text transcribed verbatim from the WordPress export of 24 September 2026; "our next study" dates come from the events schedule.
 */
import type { SitePage } from "../types";

export const mensMinistryPage: SitePage = {
  id: "mens-ministry",
  path: "/mens-ministry/",
  title: "Men’s Ministry",
  heading: "Equipping Leaders for God's Call",
  status: "published",
  section: "ministries",
  parent: "ministries",
  description: "At Saving Grace Bible Church, we believe in the transformative power of understanding and embracing God's call for men to be leaders in their homes, the church, and the world. Our Men's Ministry equips and encourages men to fulfil their God-ordained roles through insightful study sessions and fellowship.",
  legacyPaths: [
    "/pages/mens-ministry/"
  ],
  source: { id: 27942, link: "https://savinggrace.org.au/mens-ministry/", status: "publish", modified: "2025-01-02 14:00:52" },
  eyebrow: "Ministries",
  lede: "At Saving Grace Bible Church, we believe in the transformative power of understanding and embracing God's call for men to be leaders in their homes, the church, and the world. Our Men's Ministry equips and encourages men to fulfil their God-ordained roles through insightful study sessions and fellowship.",
  hero: { media: "mens-ministry", treatment: "banner" },
  blocks: [
    { kind: "heading", level: 2, text: "Our Mission" },
    {
      kind: "paragraph",
      text: "Our primary aim is to honour God by fostering a community of men dedicated to spiritual growth and impactful leadership. Drawing from timeless wisdom, we explore principles guiding men in alignment with God's will."
    },
    { kind: "quote", text: "\"Iron sharpens iron, So one man sharpens another.\" - Proverbs 27:17", cite: "Proverbs 27:17" },
    { kind: "heading", level: 2, text: "Men’s Theological Study" },
    { kind: "next-event", event: "mens-theological-study", label: "Our next study:" },
    {
      kind: "paragraph",
      text: "Engage in thought-provoking theological studies, including a dedicated exploration of the end times. This study aims to provide a deeper understanding of eschatology and its significance in shaping our faith and daily lives as men of God."
    },
    { kind: "heading", level: 2, text: "Men’s Leadership Study" },
    { kind: "next-event", event: "mens-study", label: "Our next Study:" },
    {
      kind: "book",
      media: "fight-like-a-man",
      text: "_Fight Like a Man_ is a powerful resource that challenges men to uphold biblical purity in a world that often opposes it. Addressing the devastating impact of sexual immorality on individuals, families, and faith, this book equips men with the tools and scriptural truths needed to stand firm in holiness. Join us each month as we explore its teachings and grow together in our pursuit of godly living."
    },
    { kind: "heading", level: 2, text: "What to expect" },
    {
      kind: "paragraph",
      text: "In these sessions, expect engaging discussions, profound insights, and a supportive environment that fosters personal growth and camaraderie among men seeking to lead in a manner that honours God."
    },
    { kind: "heading", level: 2, text: "Get Involved" },
    {
      kind: "paragraph",
      text: "We invite men of all ages to join us as we embark on this journey of exploration and growth in our roles as leaders. Whether you seek to enhance your leadership skills or deepen your understanding of God's Word, our Men's Ministry welcomes you with open arms."
    },
    { kind: "paragraph", text: "Come, be a part of a brotherhood committed to glorifying God through leadership and spiritual growth." },
    {
      kind: "paragraph",
      text: "Let's walk together on this path of spiritual leadership and discovery, empowering each other to fulfil our God-given roles with wisdom and grace. We look forward to seeing you at our next session!"
    },
    { kind: "paragraph", text: "-Saving Grace Bible Church Men's Ministry" },
    {
      kind: "callout",
      title: "Stay Updated",
      text: "To remain informed about our Men's Ministry, special events, and more, subscribe to our newsletter and follow us on social media."
    }
  ],
  related: [
    "teaching-preaching-ministry",
    "bible-studies",
    "events"
  ]
};

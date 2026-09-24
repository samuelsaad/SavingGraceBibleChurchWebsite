/**
 * What We Teach (WordPress page 26195, /what-we-teach/). Text transcribed verbatim from the WordPress export of 24 September 2026; the four columns become tiles.
 */
import type { SitePage } from "../types";

export const whatWeTeachPage: SitePage = {
  id: "what-we-teach",
  path: "/what-we-teach/",
  title: "What We Teach",
  status: "published",
  section: "teaching",
  parent: "about",
  description: "Discover our teachings on the Bible, God, salvation and the church. Join us to explore the Word of God, grow in faith, and experience true Christian fellowship.",
  legacyPaths: [
    "/pages/what-we-teach/"
  ],
  source: { id: 26195, link: "https://savinggrace.org.au/what-we-teach/", status: "publish", modified: "2025-09-12 15:32:44" },
  eyebrow: "About Us",
  hero: { media: "books", treatment: "banner" },
  blocks: [
    {
      kind: "tiles",
      columns: 2,
      items: [
        {
          title: "Sufficiency of Scripture",
          text: "Christ, our Wonderful Counsellor, and Scripture are perfect, trustworthy, right, pure, clean, and true.",
          href: "/what-we-teach/the-sufficiency-of-scripture/",
          media: "open-bible",
          linkLabel: "Read more"
        },
        {
          title: "Believer's Baptism",
          text: "Believers professing faith in Jesus Christ, immersed in the symbolism of His resurrection, declare their faith and identify with Christ.",
          href: "/what-we-teach/believers-baptism/",
          media: "baptism-water",
          linkLabel: "Read more"
        },
        {
          title: "The Gospel",
          text: "Understanding the Gospel: What It Truly Means to Be a Christian",
          href: "/what-we-teach/the-gospel/",
          media: "bible-rose",
          linkLabel: "Read more"
        },
        {
          title: "Mandated Church",
          text: "Make disciples, baptise believers, and teach God's Word.  The church teaches salvation by grace through faith and the authority of Scripture.",
          href: "/what-we-teach/mandated-church/",
          media: "congregation",
          linkLabel: "Read more"
        }
      ]
    }
  ],
  related: [
    "doctrinal-statement",
    "about"
  ]
};

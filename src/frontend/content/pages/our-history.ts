/**
 * Our History (WordPress page 27427, /our-history/) with the published "Church History" timeline (WordPress bold-timeline 27425). Text transcribed verbatim from the WordPress export of 24 September 2026; the timeline's dates and wording are the church's own and are not corrected here.
 */
import type { SitePage } from "../types";

export const ourHistoryPage: SitePage = {
  id: "our-history",
  path: "/our-history/",
  title: "Our History",
  status: "published",
  section: "about",
  parent: "about",
  description: "Discover the history of Saving Grace Bible Church, its merger in 2023, and our commitment to faith and unity.",
  legacyPaths: [],
  source: { id: 27427, link: "https://savinggrace.org.au/our-history/", status: "publish", modified: "2024-01-29 15:26:38" },
  eyebrow: "About Us",
  hero: { media: "early-church", treatment: "banner" },
  blocks: [
    { kind: "heading", level: 2, text: "Planted in 2017 " },
    {
      kind: "paragraph",
      text: "Under the leadership of Pastor Wessam Saad, our church embarked on a humble journey with just three families in Preston. Driven by a passion for spreading the message of God’s grace and love, we have grown and relocated to better serve our vibrant community."
    },
    { kind: "heading", level: 2, text: "Growth and Relocation: 2019 – 2021" },
    {
      kind: "paragraph",
      text: "As our congregation continued to thrive, it became evident that a new space was needed to accommodate our increasing community. In 2019, Saving Grace Bible Church moved to Epping, providing a more suitable environment for worship, fellowship, and community engagement. In 2021, the church moved again, this time to Tullamarine, each relocation representing a step forward in expanding our reach and impact within the community."
    },
    { kind: "heading", level: 2, text: "Join Us in Our Mission" },
    {
      kind: "paragraph",
      text: "Our church, born in 2017, is committed to continuing the work of Christ in the Melbourne community and beyond. We invite you to join our mission to serve, love, and share the message of God’s grace."
    },
    {
      kind: "quote",
      text: "then make my joy complete by being like-minded, having the same love, being one in spirit and of one mind. - Philippians 2:2",
      cite: "Philippians 2:2"
    },
    { kind: "heading", level: 2, text: "Church History" },
    {
      kind: "timeline",
      items: [
        {
          when: "1945",
          title: "The Essendon Christian Fellowship",
          text: "Inception in 1945 at Cidwood Hall, Moonee Ponds, as \"The Essendon Christian Fellowship"
        },
        {
          when: "1977",
          title: "A New Home in East Keilor",
          text: "The move to East Keilor Community Hall in 1970, adopting the name \"East Keilor Evangelical Christian Church."
        },
        {
          when: "1995",
          title: "Journey of Growth and Change",
          text: "Relocation to Keilor Heights High School in 1977 and East Keilor Primary School in 1990"
        },
        {
          when: "Since 1995",
          title: "A Permanent Home in East Keilor",
          text: "The church's joyous move to its own building at 97 Quinn Grove, East Keilor in June 1995"
        },
        {
          when: "2017",
          title: "The Birth of Saving Grace Bible Church",
          text: "Founded in 2017 with three families in Preston under Pastor Wessam Saad's leadership."
        },
        { when: "2021", title: "Growth and Relocation", text: "Relocation to Epping" },
        { when: "2021", title: "Growth and Relocation", text: "Relocation to Tullamarine" },
        {
          when: "2023",
          title: "Divine Ordinance: The Merger",
          text: "The providential merger with East Keilor Evangelical Christian Church, guided by God's purpose"
        }
      ]
    },
    { kind: "figure", media: "merge", size: "full" }
  ],
  related: [
    "elders",
    "about",
    "church-covenant"
  ],
  notes: [
    "The Church History timeline was a published WordPress component embedded only in a draft page; it is shown here because the page's own description refers to the 2023 merger. Its supertitles and text are reproduced as authored, including dates that disagree with the paragraphs above."
  ]
};

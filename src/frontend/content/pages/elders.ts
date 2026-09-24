/**
 * Elders (WordPress page 34, /elders/). Text transcribed verbatim from the WordPress export of 24 September 2026; each elder is a person card with the photograph WordPress used.
 */
import type { SitePage } from "../types";

export const eldersPage: SitePage = {
  id: "elders",
  path: "/elders/",
  title: "Elders",
  heading: "Elders at Saving Grace Bible Church",
  status: "published",
  section: "about",
  parent: "about",
  description: "Get to know our passionate elders, who lead Saving Grace Bible Church in preaching, teaching, and equipping believers to grow in their faith.",
  legacyPaths: [],
  source: { id: 34, link: "https://savinggrace.org.au/elders/", status: "publish", modified: "2025-05-19 22:14:50" },
  eyebrow: "About Us",
  lede: "Jesus' commitment to building His church, as stated in Matthew 16:18, establishes Him as its cornerstone. Ephesians 4:8–11 underscores the role of church leaders as instruments of God in preparing and empowering the saints for their ministry.",
  hero: { media: "elders", treatment: "banner" },
  blocks: [
    {
      kind: "paragraph",
      text: "Our congregation at Saving Grace Bible Church is fortunate to have caring and modest elders who willingly guide us. We invite you to take a moment to acquaint yourself with our elders."
    },
    {
      kind: "people",
      items: [
        {
          name: "Wesam Saad",
          role: "Pastor",
          media: "wesam",
          email: "wes.saad@savinggrace.org.au",
          text: [
            "Pastor Wesam Saad is a fervent preacher, driven by a profound desire to proclaim God's word within and beyond our church walls. His fervour lies in nurturing believers towards a deep understanding of our Lord Jesus Christ, fostering both knowledge and character growth. His mission is to ignite a passion in every believer to wholeheartedly devote themselves to Jesus and extend love to our world in need.",
            "Married with three children, Wesam's commitment to both family and faith is evident in his unwavering dedication. Recently completing an exhaustive study of the Gospel of Mark, he meticulously navigated its verses, offering profound insights. Presently, he leads the congregation through an insightful journey, exploring the Book of Colossians one verse at a time, nurturing spiritual growth and understanding among our community."
          ]
        },
        {
          name: "Ralph Gambardella",
          role: "Elder",
          media: "ralph",
          email: "ralph@savinggrace.org.au",
          text: [
            "Ralph Gambardella embodies a profound longing to uplift God's people, guiding them toward a life that magnifies the glory of God. To deepen his ability to skilfully navigate the Scriptures, he dedicated himself to rigorous study at RTC, culminating in his graduation in 2019. His heart swells with an unwavering passion to witness individuals embrace saving faith in Jesus Christ, basking in the wondrous grace of God.",
            "Married with two children, Ralph's commitment to both family and faith stands as a testament to his devotion. Actively engaged in various ministries, he extends his influence through discipling, delivering monthly sermons, and contributing his talents to the music ministry. His multifaceted involvement underscores his dedication to serving, nurturing, and inspiring the congregation on their spiritual journeys."
          ]
        }
      ]
    }
  ],
  related: [
    "about",
    "our-history",
    "lords-day-service"
  ]
};

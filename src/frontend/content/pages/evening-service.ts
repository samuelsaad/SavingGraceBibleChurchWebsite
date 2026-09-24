/**
 * Evening Service (WordPress page 26344, /evening-service/). Text transcribed verbatim from the WordPress export of 24 September 2026; the "next evening service" comes from the events schedule.
 */
import type { SitePage } from "../types";

export const eveningServicePage: SitePage = {
  id: "evening-service",
  path: "/evening-service/",
  title: "Evening Service",
  heading: "Sunday Evening Service at Saving Grace Bible Church",
  status: "published",
  section: "about",
  parent: "about",
  description: "Join us for Sunday Evening Worship, a warm and welcoming environment for deep spiritual reflection, Bible study, testimonies, evangelism, and corporate prayer.",
  legacyPaths: [],
  source: { id: 26344, link: "https://savinggrace.org.au/evening-service/", status: "publish", modified: "2026-05-24 18:44:56" },
  eyebrow: "About Us",
  hero: { media: "sunset", treatment: "banner" },
  blocks: [
    { kind: "next-event", event: "sunday-evening-service", label: "Join us for our next evening service on:" },
    {
      kind: "paragraph",
      text: "In the evenings, we meet in a relaxed setting to reflect on the morning’s sermon, ask questions, and talk about how God’s Word applies in practice.",
      lede: true
    },
    {
      kind: "quote",
      text: "\"and let us consider how to stimulate one another to love and good deeds, not forsaking our own assembling together, as is the habit of some, but encouraging one another; and all the more as you see the day drawing near.\" Hebrews 10:24-25",
      cite: "Hebrews 10:24-25"
    },
    { kind: "heading", level: 2, text: "Evangelistic Sermons: A Call to Salvation" },
    {
      kind: "paragraph",
      text: "We're excited to announce a new addition to our Sunday evening services: 25-minute evangelistic sermons. These sermons have a singular purpose - to call individuals to repentance and faith in Jesus for their salvation."
    },
    {
      kind: "paragraph",
      text: "Our ultimate aim is to make Jesus known to all people. He is the source of hope, redemption, and everlasting life. Join us as we proclaim His name and extend His invitation to all who will listen."
    },
    { kind: "heading", level: 2, text: "Delving Deeper into the Morning's Sermon" },
    {
      kind: "paragraph",
      text: "At the heart of our Sunday Evening Service, we delve deeper into the morning's sermon message. During this service, we take the teachings and insights shared earlier in the day and explore them further, examining how they apply to our daily lives. This in-depth discussion and reflection help us understand the Word of God and apply it practically, ensuring that the power of God's grace continues to work in our hearts and minds throughout the week."
    },
    { kind: "heading", level: 2, text: "Testimonies of God's Amazing Grace" },
    {
      kind: "paragraph",
      text: "A cherished part of our Sunday Evening Service involves personal testimonies. One of our fellow brothers or sisters shares a testimony of how God's amazing grace has touched their lives, bringing about transformative change. Through these testimonies, we're reminded of the living and active presence of God in our midst."
    },
    { kind: "figure", media: "fellowship", size: "full" },
    { kind: "heading", level: 2, text: "Learning to Evangelize with Passion and Purpose" },
    {
      kind: "paragraph",
      text: "In addition to our exploration of the morning's sermon message, our Sunday Evening Service also dedicates time to the vital mission of evangelism. We understand that sharing the Good News of Jesus Christ is essential to our faith journey."
    },
    {
      kind: "paragraph",
      text: "During this part of our service, we equip ourselves with the tools and knowledge needed to evangelise with passion and purpose. Whether you are new to sharing your faith or a seasoned evangelist, there is always room to grow and improve in this vital ministry."
    },
    { kind: "heading", level: 2, text: "Corporate Prayer" },
    {
      kind: "paragraph",
      text: "During our service, we set aside dedicated moments for corporate prayer, allowing us to lift our voices together in unity. We intercede for our congregation, our community, and the world, lifting up our church family's needs, concerns, and praises. This collective communion with God deepens our connection to one another and strengthens our bond as a body of believers."
    },
    { kind: "heading", level: 2, text: "Fellowship and Shared Meals" },
    {
      kind: "paragraph",
      text: "After a time of reflection and inspiration, we gather to share a meal together. This fellowship over food fosters a sense of unity and community, allowing us to build deeper relationships and create lasting connections with one another. Breaking bread together is a beautiful reminder of our unity in Christ and our shared faith journey."
    },
    {
      kind: "callout",
      title: "Join Us",
      text: "Join us for our Sunday Evening Service and immerse yourself in an evening of worship and fellowship. Come as you are and experience the enriching presence of God's love in a warm and welcoming environment."
    }
  ],
  related: [
    "lords-day-service",
    "sunday-school",
    "about"
  ]
};

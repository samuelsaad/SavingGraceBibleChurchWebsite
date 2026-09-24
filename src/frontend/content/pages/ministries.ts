/**
 * Ministries (WordPress page 7043, /ministries/). Text transcribed verbatim from the WordPress export of 24 September 2026; the seven link tiles keep their titles and take the descriptive paragraphs that followed them, and the editing placeholder heading "Test Ministry" is not shown.
 */
import type { SitePage } from "../types";

export const ministriesPage: SitePage = {
  id: "ministries",
  path: "/ministries/",
  title: "Ministries",
  status: "published",
  section: "ministries",
  description: "Explore our Bible study sessions and ministries, including Men's and Women's Bible Studies, Evangelism Ministry, Children's Ministry, and Church Membership.",
  legacyPaths: [],
  source: { id: 7043, link: "https://savinggrace.org.au/ministries/", status: "publish", modified: "2025-05-19 22:17:02" },
  eyebrow: "Ministries",
  lede: "At Saving Grace Bible Church, we proudly embrace our identity as a Reformed Bible Church in Melbourne, rooted in Christ-centered teachings.",
  hero: { media: "bible-shelf", treatment: "banner" },
  blocks: [
    {
      kind: "quote",
      text: "“And He gave some as apostles, and some as prophets, and some as evangelists, and some as pastors and teachers, for the equipping of the [a]saints for the work of service, to the building up of the body of Christ; until we all attain to the unity of the faith, and of the knowledge of the Son of God, to a mature man, to the measure of the stature which belongs to the fullness of Christ.”",
      cite: "— Ephesians 4:11-13"
    },
    {
      kind: "tiles",
      columns: 3,
      items: [
        {
          title: "Bible Studies",
          eyebrow: "Reformed Bible Studies",
          text: "Explore our comprehensive Reformed Bible Studies that illuminate essential Christian principles. Covering topics such as salvation, prayer, the authority of Scripture, and more, these studies delve deeply into foundational aspects of the Christian faith. Join insightful discussions, deepen your faith, and connect with fellow believers on this transformative spiritual journey.",
          href: "/bible-studies/",
          media: "open-bible"
        },
        {
          title: "Men's Ministry",
          text: "At Saving Grace Bible Church, we believe in the transformative power of understanding and embracing God’s call for men to be leaders in their homes, the church, and the world. Our Men’s Ministry equips and encourages men to fulfil their God-ordained roles through insightful study sessions and fellowship. Explore a journey that empowers men to embrace leadership, deepen their faith, and positively impact their communities.",
          href: "/mens-ministry/",
          media: "mens-bible-study"
        },
        {
          title: "Woman's Ministry",
          text: "At Saving Grace Bible Church, we provide a space where women are inspired to deepen their worship and devotion to our Savior, Jesus Christ. Our Women’s Ministry is devoted to fostering a deeper connection with Jesus through exclusive study sessions tailored for women. These sessions are vital in emphasising the study and application of Scripture, nurturing a profound understanding of God’s Word, and fostering a community devoted to deepening their faith and relationship with Christ.",
          href: "/womens-ministry/",
          media: "womens-prayer"
        },
        {
          title: "Outreach Ministry",
          text: "Saving Grace Bible Church's Outreach Ministry in Tullamarine fulfils the Great Commission through theology-driven evangelism. Grounded in God's sovereignty, we prioritise disciple-making for a transformed community.",
          href: "/local-outreach/",
          media: "good-news"
        },
        {
          title: "Children's Ministry",
          text: "Nurture young hearts in our Christ-centered Children’s Ministry at Saving Grace Bible Church. Enjoy age-specific teachings, engaging activities, and events fostering a love for Christ and His message.",
          href: "/sunday-school/",
          media: "child-reading"
        },
        {
          title: "Music Ministry",
          text: "Elevate your worship experience through our Christ-centered Music Ministry. Join talented musicians, experience inspiring melodies, and contribute to our vibrant services centred around Christ.",
          href: "/music-ministry/",
          media: "music-sheet"
        },
        { title: "Preaching/Teaching Ministry", href: "/teaching-preaching-ministry/", media: "teaching" }
      ]
    },
    { kind: "heading", level: 2, text: "Join Us in Faith and Service" },
    {
      kind: "paragraph",
      text: "Explore our website for more about each Christ-centered ministry within our Reformed Bible Church in Melbourne. Find ways to actively participate, grow spiritually, and contribute to the Tullamarine community centred on the teachings of Christ."
    }
  ],
  related: [
    "events",
    "forms"
  ]
};

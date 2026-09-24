/**
 * About Us (WordPress page 26490, /about/). Text transcribed verbatim from the WordPress export of 24 September 2026; the four "Read more" columns become tiles and the location line gains real telephone and e-mail links.
 */
import type { SitePage } from "../types";

export const aboutPage: SitePage = {
  id: "about",
  path: "/about/",
  title: "About Us",
  heading: "Embrace Reformed Truths at Saving Grace Bible Church, Melbourne",
  status: "published",
  section: "about",
  description: "Saving Grace Bible Church, Melbourne: Rooted in Reformed Truths. Join a fellowship cherishing reformed theology with reverence for God's teachings.",
  legacyPaths: [
    "/pages/about/"
  ],
  source: { id: 26490, link: "https://savinggrace.org.au/about/", status: "publish", modified: "2024-12-18 11:49:31" },
  eyebrow: "About Us",
  lede: "At Saving Grace Bible Church, we aim to exalt the name of our Lord Jesus Christ and magnify the truths of Scripture in the heart of Melbourne, Victoria. We stand as a steadfast lighthouse of Christ-centered reformed theology, embracing the principles of Calvinism and the profound beauty of TULIP with unwavering devotion.",
  hero: { media: "elders", treatment: "banner" },
  blocks: [
    {
      kind: "paragraph",
      text: "**Our Foundation in Christ:** Our church is built upon the unshakable foundation of Christ's redemptive work. As believers, we are captivated by the grace and truth found in the Gospel. Guided by the Holy Spirit, we delve into the sacred pages of Scripture, seeking to uncover it's hidden treasures and apply it's timeless wisdom to our lives."
    },
    {
      kind: "paragraph",
      text: "**Rooted in Reformed Truths:** Saving Grace is a fellowship of believers who cherish the rich tapestry of reformed theology. With a deep reverence for God's sovereignty, we embrace the teachings of Calvinism as a means of understanding His infinite majesty and the depth of His love for us."
    },
    { kind: "figure", media: "tulips", size: "portrait" },
    { kind: "heading", level: 2, text: "TULIP and the Gospel Story" },
    { kind: "paragraph", text: "The petals of TULIP guide us through the symphony of God's redemptive plan:" },
    {
      kind: "list",
      items: [
        "**Total Depravity:** We humbly acknowledge our fallen nature, recognising our desperate need for the Savior's redeeming grace.",
        "**Unconditional Election:** Our salvation is a testament to God's unmerited favour, a divine choice that He made before the foundation of the world.",
        "**Limited Atonement:** Christ's sacrifice, a masterpiece of love, is efficacious for all who believe, securing their eternal inheritance.",
        "**Irresistible Grace:** God's grace, like a gentle current, draws His chosen one's into His embrace, transforming hearts and lives.",
        "**Perseverance of the Saints:** The saints, held in the palm of His hand, are kept by His unwavering faithfulness throughout their journey."
      ]
    },
    { kind: "heading", level: 2, text: "Exploring Dispensational Wisdom" },
    {
      kind: "paragraph",
      text: "While our hearts are anchored in Christ-centered reformed theology, we also humbly engage with differing perspectives, such as dispensationalism. Our commitment is to unity in Christ and the diligent study of Scripture, understanding that its multifaceted truths reveal the glory of our Creator."
    },
    {
      kind: "paragraph",
      text: "**Join Us on the Journey:** We invite you to walk alongside us in worship, study, and fellowship. As we gather on Sundays for the Lord’s Day service, mornings and evenings, along with other gatherings throughout the week, we lift our voices in praise, open the Scriptures with reverence, and cultivate a more profound love for our Savior. Whether you're well-acquainted with reformed theology or are just beginning to explore its depths, there's a place for you in our Christ-centered community."
    },
    {
      kind: "paragraph",
      text: "At Saving Grace Bible Church, Christ is the cornerstone of all we do, and the Scriptures are our guiding light. If you find yourself in Westmeadows or its neighbouring areas, we extend a warm invitation to experience the transformative power of Christ-centered reformed teaching."
    },
    {
      kind: "paragraph",
      text: "Join us as we journey deeper into the heart of God through His Word. Let's walk hand in hand, following the footsteps of our Savior at Saving Grace Bible Church."
    },
    {
      kind: "paragraph",
      text: "**Location:** We're conveniently situated at Unit 5/217-219 Mickleham Rd, Westmeadows VIC 3049. For enquiries or additional information, please feel free to reach out at [0450 545 589](tel:+61450545589) or email us at [info@savinggrace.org.au](mailto:info@savinggrace.org.au)"
    },
    {
      kind: "tiles",
      columns: 4,
      items: [
        {
          title: "Lords Day Service",
          text: "Join us on Sundays for worship, reflecting devotion to God's Word and commitment to spiritual growth.",
          href: "/lords-day-service/",
          linkLabel: "Read more"
        },
        {
          title: "The Gospel",
          text: "Join us as we explore the foundational principles that define our faith.",
          href: "/what-we-teach/the-gospel/",
          linkLabel: "Read more"
        },
        {
          title: "Doctrinal Statement",
          text: "Discover our core beliefs rooted in Scripture, the Trinity, salvation by grace, and the mission of Christ's Church",
          href: "/doctrinal-statement/",
          linkLabel: "Read more"
        },
        {
          title: "What We teach",
          text: "Read how our Faith is Anchored and Our beliefs in Scripture, God, and the Holy Spirit underpin our faith journey",
          href: "/what-we-teach/",
          linkLabel: "Read more"
        }
      ]
    },
    {
      kind: "quote",
      text: "“but grow in the grace and knowledge of our Lord and Savior Jesus Christ. To Him be the glory, both now and to the day of eternity. Amen.\"",
      cite: "— 2 Peter 3:18"
    }
  ],
  related: [
    "lords-day-service",
    "evening-service",
    "elders",
    "our-history",
    "church-covenant",
    "church-membership"
  ],
  notes: [
    "The telephone number's original link was a Google search; it now dials the number. The closing verse was a heading in WordPress and is shown as a quotation."
  ]
};

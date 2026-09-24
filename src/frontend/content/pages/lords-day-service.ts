/**
 * Lord's Day Service (WordPress page 26330, /pages/lordsdayservice/ → /lords-day-service/). Text transcribed verbatim from the WordPress export of 24 September 2026; the Sermon Recordings section shows the newest sermons from the sermon system.
 */
import type { SitePage } from "../types";

export const lordsDayServicePage: SitePage = {
  id: "lords-day-service",
  path: "/lords-day-service/",
  title: "Lord’s Day Service",
  heading: "Join Us for the Lord's Day Service at Saving Grace Bible Church",
  status: "published",
  section: "about",
  parent: "about",
  description: "Worship on the Lord's Day at Saving Grace Bible Church. Hear His Word, grow in faith, and join our community. Every Sunday morning at 10:30am.",
  legacyPaths: [
    "/pages/lordsdayservice/",
    "/pages/im-new-here/"
  ],
  source: { id: 26330, link: "https://savinggrace.org.au/pages/lordsdayservice/", status: "publish", modified: "2025-09-04 15:14:49" },
  eyebrow: "About Us",
  lede: "At Saving Grace Bible Church, our mission is to glorify God by faithfully proclaiming the gospel of Jesus Christ. Guided by the Spirit and grounded in Scripture, we long to see sinners brought to salvation and believers strengthened in faith.",
  hero: { media: "lords-day", treatment: "banner" },
  blocks: [
    {
      kind: "paragraph",
      text: "Every Sunday, we gather around God’s Word with reverence, simplicity, and joy — because Christ is worthy of true worship, and His people need the nourishment of His truth."
    },
    { kind: "heading", level: 2, text: "Service Times" },
    {
      kind: "list",
      items: [
        "Morning Service: 10:30 AM - 12:30 PM",
        "Evening Service: 5:30 PM - 7:00 PM"
      ]
    },
    { kind: "heading", level: 2, text: "Order of Worship" },
    { kind: "paragraph", text: "Our worship is simple, Scripture-centred, and Christ-focused. A typical service includes…" },
    {
      kind: "list",
      items: [
        "Singing psalms and hymns, together in prayer",
        "Public reading of God’s Word",
        "Corporate Prayer",
        "The Lord’s Supper",
        "Expository preaching that proclaims Christ"
      ]
    },
    {
      kind: "paragraph",
      text: "Whether you are a believer seeking a faithful church home, or someone still exploring the truth of the gospel, you are warmly invited to hear God’s Word with us."
    },
    { kind: "heading", level: 2, text: "Practical Details" },
    {
      kind: "list",
      items: [
        "Parking: Ample parking is available.",
        "Children: A children’s program is provided during the evening service."
      ]
    },
    { kind: "heading", level: 2, text: "Contact Us" },
    {
      kind: "paragraph",
      text: "For more information or if you have any questions, feel free to contact our church office on [+61 450 545 589](tel:+61450545589). You can also enquire about upcoming services through our [contact us page](/contact/)."
    },
    { kind: "heading", level: 2, text: "Biblically Grounded Preaching" },
    {
      kind: "paragraph",
      text: "Each Sunday morning, Pastor Wesam Saad, a seasoned and passionate servant of God, delivers sermons deep into the Scriptures. With wisdom and clarity, our Pastor imparts biblical insights that inspire and challenge us to live out our faith practically. Our Elder Ralph Gambardella also takes turns delivering sermons on Sunday mornings, ensuring a diverse range of perspectives rooted in the Word of God."
    },
    {
      kind: "people",
      items: [
        {
          name: "Wesam Saad",
          role: "Pastor",
          media: "wesam",
          text: []
        }
      ]
    },
    {
      kind: "sermon-cards",
      heading: "Sermon Recordings",
      text: "For those unable to attend in person, we offer a way to stay connected. You can access recordings of our sermons, capturing the messages shared during our Sunday services. Whether you're seeking spiritual nourishment, missed a service, or wish to revisit the teachings, these recordings serve as a valuable resource for your growth.",
      linkLabel: "Click here to access past sermons >"
    },
    {
      kind: "tiles",
      columns: 4,
      items: [
        {
          title: "Sufficiency of Scripture",
          text: "Christ, our Wonderful Counsellor, and Scripture are perfect, trustworthy, right, pure, clean, and true.",
          href: "/what-we-teach/the-sufficiency-of-scripture/",
          linkLabel: "Read more"
        },
        {
          title: "Lordship Salvation",
          text: "The true gospel calls for repentance, a transformed life, surrender to Christ's authority, and obedience, not just an intellectual belief.",
          href: "/what-we-teach/lordship-salvation/",
          linkLabel: "Read more"
        },
        {
          title: "Believer's Baptism",
          text: "Believers professing faith in Jesus Christ, immersed in the symbolism of His resurrection, declare their faith and identify with Christ.",
          href: "/what-we-teach/believers-baptism/",
          linkLabel: "Read more"
        },
        {
          title: "Mandated Church",
          text: "Make disciples, baptise believers, and teach God's Word.  The church teaches salvation by grace through faith and the authority of Scripture.",
          href: "/what-we-teach/mandated-church/",
          linkLabel: "Read more"
        }
      ]
    },
    {
      kind: "quote",
      text: "\"For the word of God is living and active and sharper than any two-edged sword, and piercing as far as the division of soul and spirit, of both joints and marrow, and able to judge the thoughts and intentions of the heart.\" - Heb 4:12"
    }
  ],
  related: [
    "evening-service",
    "elders",
    "about"
  ],
  notes: [
    "The Lordship Salvation tile pointed at a WordPress draft; it renders without a link wherever that draft is not published. /pages/im-new-here/ held only theme placeholder text and now leads here."
  ]
};

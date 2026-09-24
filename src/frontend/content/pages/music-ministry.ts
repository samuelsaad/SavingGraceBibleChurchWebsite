/**
 * Music Ministry (WordPress page 28136, /music-ministry/). Text transcribed verbatim from the WordPress export of 24 September 2026; the five hymn columns become a hymn list with their external "Play & Lyrics" links.
 */
import type { SitePage } from "../types";

export const musicMinistryPage: SitePage = {
  id: "music-ministry",
  path: "/music-ministry/",
  title: "Music Ministry",
  status: "published",
  section: "ministries",
  parent: "ministries",
  description: "Embrace sacred worship in our Music Ministry, glorifying God through harmonious melodies. Join us in hymns that unite hearts in reverent praise to our God.",
  legacyPaths: [
    "/pages/music-ministry/"
  ],
  source: { id: 28136, link: "https://savinggrace.org.au/music-ministry/", status: "publish", modified: "2025-08-03 19:02:25" },
  eyebrow: "Ministries",
  hero: { media: "worship-team", treatment: "banner" },
  blocks: [
    { kind: "heading", level: 2, text: "Honouring God through Melody and Harmony" },
    {
      kind: "paragraph",
      text: "Our church is blessed with gifted singers and skilful instrumentalists who unite week after week in our ministry. Our goal is to present music that glorifies, edifies, and ministers to all who join us in worship."
    },
    { kind: "heading", level: 2, text: "Worship Team" },
    {
      kind: "paragraph",
      text: "Our worship team leads congregational praise and worship during our Sunday services, creating an atmosphere conducive to encountering God's presence through music. Comprising talented musicians and vocalists, our team prepares heartfelt and Spirit-led worship experiences."
    },
    { kind: "quote", text: "\"Sing to the Lord a new song; Sing to the Lord, all the earth.\" - Psalm 96:1", cite: "Psalm 96:1" },
    { kind: "heading", level: 2, text: "Join Our Music Ministry" },
    {
      kind: "paragraph",
      text: "If you're passionate about music and desire to use your talents for God's glory, consider joining our music ministry. Whether you're a skilled musician, vocalist or have a heart for worship, there's a place for you to serve in this vibrant ministry."
    },
    {
      kind: "downloads",
      items: [
        {
          title: "SGBC - Sunday Service Policies and Procedures (PDF)",
          text: "These guidelines help ensure that our worship services are conducted in an orderly, reverent, and welcoming manner for all attendees.",
          href: "https://1drv.ms/w/c/05854b1862b64854/EVRItmIYS4UggAXZzQMAAAABKPsZ95OCVUVJhSiNBFuzpQ",
          label: "Open the policies (OneDrive)"
        }
      ]
    },
    { kind: "heading", level: 3, text: "Contact Information" },
    { kind: "paragraph", text: "Music Ministry Leader: [ralph@savinggrace.org.au](mailto:ralph@savinggrace.org.au)" },
    {
      kind: "people",
      items: [
        {
          name: "Ralph Gambardella",
          role: "Music Ministry",
          media: "ralph-music",
          email: "ralph@savinggrace.org.au",
          text: []
        }
      ]
    },
    { kind: "heading", level: 2, text: "Our Musical Repertoire" },
    {
      kind: "paragraph",
      text: "At Saving Grace Bible Church, our musical repertoire encompasses a rich variety of hymns and worship songs. We cherish both traditional hymns, steeped in history and rich theology, as well as the heartfelt melodies of contemporary worship songs."
    },
    { kind: "heading", level: 3, text: "Here are a few gospel hymns frequently sung in our services:" },
    {
      kind: "hymns",
      items: [
        { title: "Amazing Grace", text: "A timeless hymn celebrating God's grace and redemption.", href: "https://www.hymnal.net/en/hymn/h/313" },
        {
          title: "How Great Thou Art",
          text: "A powerful hymn declaring the majesty of God's creation.",
          href: "https://gccsatx.com/hymns/how-great-thou-art/"
        },
        { title: "Blessed Assurance", text: "An affirming hymn expressing the certainty of salvation.", href: "https://www.hymnal.net/en/hymn/h/308" },
        {
          title: "Great Is Thy Faithfulness",
          text: "A hymn acknowledging God's steadfastness and faithfulness.",
          href: "https://www.hymnal.net/en/hymn/h/19"
        },
        { title: "It Is Well with My Soul", text: "A hymn of peace and trust in God amidst trials.", href: "https://www.hymnal.net/en/hymn/h/341" }
      ]
    },
    {
      kind: "callout",
      title: "Stay Informed",
      text: "To stay updated on our Music Ministry events and serving opportunities, subscribe to our newsletter and follow us on social media."
    }
  ],
  related: [
    "lords-day-service",
    "ministries",
    "forms"
  ],
  notes: [
    "The policies document's description is the one the Forms | Downloads page gives it; the music page itself only carried the link."
  ]
};

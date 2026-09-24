/**
 * Bible Studies (WordPress page 26358, /pages/biblestudies/ → /bible-studies/). Text transcribed verbatim from the WordPress export of 24 September 2026; the eight YouTube playlists load only on request.
 */
import type { SitePage } from "../types";

export const bibleStudiesPage: SitePage = {
  id: "bible-studies",
  path: "/bible-studies/",
  title: "Bible Studies",
  heading: "Bible Studies - Growing in Faith through God's Word",
  status: "published",
  section: "ministries",
  parent: "ministries",
  description: "Join our Bible Studies at Saving Grace Bible Church. Grow in faith through God's Word.",
  legacyPaths: [
    "/pages/biblestudies/"
  ],
  source: { id: 26358, link: "https://savinggrace.org.au/pages/biblestudies/", status: "publish", modified: "2025-08-06 11:18:09" },
  eyebrow: "Ministries",
  hero: { media: "end-times", treatment: "aside" },
  blocks: [
    { kind: "next-event", event: "tuesday-bible-study", label: "Join us for our next study on:" },
    {
      kind: "paragraph",
      text: "Join us every Tuesday at 7:00 p.m. as we gather around God’s Word to know Christ more deeply, follow Him more faithfully, and encourage one another in the truth. Whether you're just beginning your walk with Jesus or have followed Him for years, you're welcome here.",
      lede: true
    },
    { kind: "heading", level: 2, text: "Current Series: \"End Times Study\"" },
    {
      kind: "paragraph",
      text: "Join us every Tuesday at 7:00 p.m. at Saving Grace Bible Church as we open God’s Word and study what the Bible teaches about the end of the age, the return of Christ, and the hope that awaits His people."
    },
    {
      kind: "paragraph",
      text: "In this nine-part series, we’ll take a Christ-centred and biblically grounded look at key end-times topics through a Reformed, premillennial lens. This isn’t about predicting dates—it’s about knowing the God who holds the future and living in light of His promises."
    },
    { kind: "paragraph", text: "**What we'll cover:**" },
    {
      kind: "list",
      items: [
        "**Why Eschatology Matters** – How a right view of the end shapes our view of God, Scripture, and everyday life.",
        "**The Kingdom of God:** Now and Future – Exploring the present reality and the promised reign still to come.",
        "**Premillennialism** – Understanding Christ’s future rule on earth and how it fits into God’s redemptive plan.",
        "**The Pretribulation Rapture** – The blessed hope and promise of rescue for the Church.",
        "**The Tribulation** – God’s purpose in this time of judgment and how Scripture describes these events.",
        "**The Second Coming** – The return of Jesus in glory to judge and reign.",
        "**The Great White Throne** – God’s final judgment and the vindication of His justice.",
        "**The Eternal State (New Earth)** – Our future home with God and the restoration of all things.",
        "**Eternal Rewards** – Crowns, joy, and responsibilities in the life to come."
      ]
    },
    {
      kind: "list",
      items: [
        "Day and Time: Every Tuesday from 7:00 pm to 8:30 pm.",
        "Location: Unit 5/217/219 Mickleham Rd, Westmeadows VIC 3049",
        "Study Material: Provided during sessions"
      ]
    },
    { kind: "heading", level: 2, text: "Missed a previous session?" },
    {
      kind: "paragraph",
      text: "Catch up on previous sessions and stay updated with our ongoing series by accessing our YouTube recordings. Whether you missed a session or want to revisit past discussions, these videos are available for your convenience."
    },
    { kind: "playlist", listId: "PL_uubQT0SZGoGY2xc8W0o0FLkkMjhM-9O", title: "End Times Study" },
    { kind: "heading", level: 2, text: "Why Join Our Bible Studies?" },
    {
      kind: "paragraph",
      text: "We know life gets busy, but we believe there’s nothing more important than regularly opening God’s Word and growing together in Christ. Our Tuesday night Bible study isn’t just a class; it’s a space to slow down, connect with others, and be reminded of the hope we have in Jesus. Here’s why we’d love to have you with us:"
    },
    {
      kind: "paragraph",
      text: "1. Delve into the Word of God (2 Timothy 3:16): Our study sessions are centred around the Bible, which is the inspired Word of God. Studying together helps you gain a deeper understanding of Scripture and its application in your life."
    },
    {
      kind: "quote",
      text: "\"All Scripture is inspired by God and profitable for teaching, for reproof, for correction, for training in righteousness; so that the man of God may be adequate, equipped for every good work\"",
      cite: "2 Timothy 3:16"
    },
    {
      kind: "paragraph",
      text: "2. Grow in Faith (Romans 10:17): Faith comes by hearing and hearing by the Word of God. Our studies provide an environment for your faith to flourish as you learn and apply biblical truths to your life."
    },
    {
      kind: "paragraph",
      text: "3. Fellowship and Community (Hebrews 10:24-25): The Bible encourages believers to meet and encourage one another. Our Bible Studies foster a sense of community where you can build relationships with fellow believers, share your faith journey, and find support in your walk with Christ."
    },
    { kind: "heading", level: 2, text: "How to join us:" },
    {
      kind: "paragraph",
      text: "It’s simple—just come along! We meet every Tuesday at 7:00 p.m. at Unit 5/217–219 Mickleham Rd, Westmeadows VIC. No need to sign up or prepare anything—just bring your Bible and a heart ready to learn. Whether you’ve known Jesus for years or you’re just starting to explore faith, there’s a seat for you."
    },
    {
      kind: "callout",
      title: "Stay Updated",
      text: "To stay informed about our Bible Studies and other church events, please subscribe to our newsletter and follow us on social media. We regularly share announcements, study resources, and biblical insights to enrich your spiritual walk."
    },
    { kind: "heading", level: 2, text: "Past Study Recordings" },
    { kind: "paragraph", text: "Explore our previous Bible studies." },
    { kind: "playlist", listId: "PL_uubQT0SZGp-kxTjSaYw7JSdA5LrfiVF", title: "Courtship to Marriage| When Does the Ring Fit?" },
    { kind: "playlist", listId: "PL_uubQT0SZGq0HRsEgojQu1hGkOA0b8TD", title: "Pitfalls for Young Men" },
    { kind: "playlist", listId: "PL_uubQT0SZGryn337ElfzkwFFO66VXWPl", title: "Misconceptions in Christian Living - Modified Sabbatarianism" },
    { kind: "playlist", listId: "PL_uubQT0SZGq7L_g3kq4taHe_8-mzr8AA", title: "The Pipe Analogy" },
    { kind: "playlist", listId: "PL_uubQT0SZGqiTfaekPmhhyIdEcNDMQJS", title: "Heart versus Flesh" },
    { kind: "playlist", listId: "PL_uubQT0SZGpvu3PC2IXQ9olunXRwJkIF", title: "What is Salvation?" },
    { kind: "playlist", listId: "PL_uubQT0SZGqTE_ymw8vkCqDCFZwd4MLv", title: "Fundamentals of the Faith" }
  ],
  related: [
    "mens-ministry",
    "womens-ministry",
    "teaching-preaching-ministry",
    "events"
  ]
};

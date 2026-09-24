/**
 * Forms | Downloads (WordPress page 29840, /forms/). Text transcribed verbatim from the WordPress export of 24 September 2026; the two PDFs hosted on the church's WordPress uploads were not in the supplied media archive, so their existing addresses are kept.
 */
import type { SitePage } from "../types";

export const formsPage: SitePage = {
  id: "forms",
  path: "/forms/",
  title: "Resources | Downloads",
  heading: "Saving Grace Bible Church Resources",
  status: "published",
  section: "resources",
  parent: "ministries",
  description: "Download key SGBC forms including our doctrinal statement, membership application, church covenant, and Sunday service policies.",
  legacyPaths: [],
  source: { id: 29840, link: "https://savinggrace.org.au/forms/", status: "publish", modified: "2025-10-23 16:45:27" },
  eyebrow: "Resources",
  lede: "Below you’ll find downloadable documents outlining the beliefs, practices, and policies of Saving Grace Bible Church. These resources are provided to help guests, members, and those considering membership better understand our church’s doctrine and commitments.",
  hero: { media: "pen", treatment: "aside" },
  blocks: [
    { kind: "heading", level: 2, text: "Church Resources & Downloads" },
    {
      kind: "downloads",
      items: [
        {
          title: "Doctrinal Statement",
          text: "A detailed overview of the core biblical beliefs held by Saving Grace Bible Church. This statement reflects our commitment to Scripture and sound theology.",
          href: "https://www.savinggrace.org.au/wp-content/uploads/2024/01/Saving-Grace-Bible-Church-Doctrinal-Statement-V1_.pdf",
          label: "Saving Grace Bible Church – Doctrinal Statement (PDF)"
        },
        {
          title: "Membership & Baptism Application",
          text: "This form is for individuals who are interested in joining the church or pursuing baptism. It includes questions about your faith and allows you to express interest in church membership.",
          href: "https://onedrive.live.com/?redeem=aHR0cHM6Ly8xZHJ2Lm1zL2IvYy8wNTg1NGIxODYyYjY0ODU0L0VWUkl0bUlZUzRVZ2dBVmYxQU1BQUFBQmNaZGJVREd6RVZCa20tOVJYYlpqOFE%5FZT1paGV1OUg&cid=05854B1862B64854&id=5854B1862B64854%21250975&parId=5854B1862B64854%21194615&o=OneUp",
          label: "SGBC – Membership and Baptism Application (PDF)"
        },
        {
          title: "Church Covenant",
          text: "Our covenant outlines the mutual commitments of church members to one another and to the church body, grounded in Scripture and shared accountability.",
          href: "https://savinggrace.org.au/wp-content/uploads/2023/11/Saving-Grace-Bible-Church-Covenant.pdf",
          label: "SGBC - Church Covenant (PDF)"
        },
        {
          title: "Sunday Service Policies & Procedures",
          text: "These guidelines help ensure that our worship services are conducted in an orderly, reverent, and welcoming manner for all attendees.",
          href: "https://1drv.ms/w/c/05854b1862b64854/EVRItmIYS4UggAXZzQMAAAABKPsZ95OCVUVJhSiNBFuzpQ",
          label: "SGBC - Sunday Service Policies and Procedures (PDF)"
        }
      ]
    }
  ],
  related: [
    "doctrinal-statement",
    "church-covenant",
    "church-membership"
  ]
};

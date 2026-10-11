/**
 * Contact Us (WordPress page 3002, /contact-us-2/ → /contact/). Text transcribed verbatim from the WordPress export of 24 September 2026; the Contact Form 7 form has no mail service in this application, so the page offers the real e-mail, telephone and map destinations instead.
 */
import type { SitePage } from "../types";

export const contactPage: SitePage = {
  id: "contact",
  path: "/contact/",
  title: "Contact Us",
  status: "published",
  section: "contact",
  description: "Connect with Saving Grace Bible Church for spiritual guidance rooted in scripture. Visit our Church located in Melbourne and find solace in His sanctuary.",
  legacyPaths: [
    "/contact-us-2/",
    "/pages/contact-us/",
  ],
  source: { id: 3002, link: "https://savinggrace.org.au/contact-us-2/", status: "publish", modified: "2025-08-06 15:00:17" },
  eyebrow: "Contact Us",
  hero: { media: "welcome-door", treatment: "aside" },
  blocks: [
    {
      kind: "contact-panel",
      name: "Saving Grace Bible Church",
      addressLines: [
        "Unit 5/217-219 Mickleham Rd, Westmeadows",
        "VIC 3049"
      ],
      telephone: { label: "Tel: 0450545589", href: "tel:+61450545589" },
      email: "info@savinggrace.org.au",
      map: { label: "Saving Grace Bible Church Google Map", href: "https://goo.gl/maps/gL2hcbXG3Ci9zqRVA" }
    },
    {
      kind: "paragraph",
      text: "You can reach out to us via email at [info@savinggrace.org.au](mailto:info@savinggrace.org.au) or by phone at [+61 450 545 589](tel:+61450545589).",
      lede: true
    }
  ],
  related: [
    "lords-day-service",
    "events",
    "giving"
  ],
  notes: [
    "The WordPress page opened with a Google Maps embed and a Contact Form 7 form; the map is a link to the church's Google Maps listing and the sentence about \"the form provided above\" is not shown because no message form can be submitted here."
  ]
};

/**
 * Support Our Mission through Your Offering (WordPress page 2285, /support-saving-grace-church-offering/). Text transcribed verbatim from the WordPress export of 24 September 2026; the four "ways to make an offering" columns and the bank/online details become the giving-methods panel.
 */
import type { SitePage } from "../types";

export const givingPage: SitePage = {
  id: "giving",
  path: "/support-saving-grace-church-offering/",
  title: "Support Our Mission through Your Offering",
  status: "published",
  section: "giving",
  description: "Join us in faith and purpose. Support the mission of Saving Grace Bible Church through your generous offerings. Your giving makes a difference!",
  legacyPaths: [
    "/pages/support-saving-grace-church-offering/",
    "/give/"
  ],
  source: { id: 2285, link: "https://savinggrace.org.au/support-saving-grace-church-offering/", status: "publish", modified: "2023-12-06 14:46:46" },
  eyebrow: "Give",
  lede: "Your generous gifts and offerings play a vital role in upholding our church's tradition of spreading the word of God and serving our community.",
  hero: { media: "grace", treatment: "aside" },
  blocks: [
    {
      kind: "giving-methods",
      intro: "Making an offering is a simple act of faith and obedience. You can contribute to our church's mission by:",
      button: { label: "Give Online", href: "https://donate.stripe.com/eVa4hQ26gacd7AYeUU" },
      methods: [
        { title: "Attending our Service", text: "_Bring your offering with you when you join us for worship on Sundays._" },
        { title: "Online Giving", text: "_We offer secure online giving options through our website for your convenience._" },
        {
          title: "EFTPOS",
          text: "_We've made giving even more accessible through our EFTPOS facility. This allows you to make your offering using your card or contactless payment methods._"
        }
      ],
      bank: {
        title: "Bank Transfer",
        account: "SGBC Society Cheque Account",
        lines: [
          "BSB: 063-765",
          "Account Number: 1090 6641"
        ]
      },
      online: {
        title: "Online Options",
        links: [
          { label: "Give Online through Stripe Payments", href: "https://donate.stripe.com/eVa4hQ26gacd7AYeUU" },
          { label: "Give Online through Sermon Audio", href: "https://www.sermonaudio.com/secure/paydonate.asp?sourceid=savinggrace" }
        ]
      }
    },
    { kind: "heading", level: 2, text: "The Act of Giving: A Biblical Tradition" },
    { kind: "paragraph", text: "In the Scriptures, we find the timeless wisdom of giving, as it is written in 2 Corinthians 9:7:" },
    {
      kind: "quote",
      text: "\"Each one must give as he has decided in his heart, not reluctantly or under compulsion, for God loves a cheerful giver.\"",
      cite: "2 Corinthians 9:7"
    },
    { kind: "heading", level: 3, text: "Why Give to Saving Grace Bible Church" },
    {
      kind: "paragraph",
      text: "Every offering you make directly supports our mission to glorify God, nurture faith, and extend Christ's love. Your contributions enable us to:"
    },
    {
      kind: "list",
      items: [
        "Share the Gospel: Your gifts help us continue proclaiming the good news of salvation through Jesus Christ.",
        "Care for the Needy: We use your offerings to provide for the less fortunate, following Christ's example of compassion.",
        "Strengthen Our Church: Your generosity helps us maintain our sacred space, facilitate worship, and grow as a faith community."
      ]
    },
    { kind: "heading", level: 3, text: "How to Make Your Offering" },
    {
      kind: "paragraph",
      text: "Making an offering is a simple act of faith and obedience. You can contribute to our church's mission by:\n[Give Online](https://donate.stripe.com/eVa4hQ26gacd7AYeUU)"
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "Attending Our Services: Bring your offering with you when you join us for worship on Sundays.",
        "Online Giving: We offer secure online giving options through our website for your convenience. Click [here](https://donate.stripe.com/eVa4hQ26gacd7AYeUU) to make your donation.",
        "EFTPOS: We have an EFTPOS facility allowing you to offer using a card or pay wave."
      ]
    },
    {
      kind: "callout",
      title: "Thank you",
      text: "We sincerely appreciate your commitment to our shared faith and mission. Your generosity sustains our church and helps us spread the timeless message of God's love. May your giving always be a joyful expression of your faith in Christ."
    }
  ],
  related: [
    "contact",
    "about"
  ],
  notes: [
    "\"Click [here] to make your donation\" had no destination in WordPress; it now opens the page's own Stripe giving link."
  ]
};

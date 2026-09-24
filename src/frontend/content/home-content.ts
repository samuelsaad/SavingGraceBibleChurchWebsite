/**
 * The church homepage's content, transcribed verbatim from the six
 * screenshots of the current homepage supplied with the redesign brief
 * (23 September 2026) and confirmed against the WordPress export of the
 * same page (24 September 2026, page 28672). Wording is preserved exactly;
 * only placement, grouping and hierarchy differ on the new page. Nothing
 * here is invented.
 *
 * Every label now has a real destination on this site or, for the map, the
 * church's own Google Maps listing from the export. Only the four social
 * marks remain "pending": the export names no social account, so they
 * render as non-interactive labels with a visually hidden qualifier.
 */

export const churchNotice = "Church Notice: No tuesday night study during the school holiday.";

export const heroCopy = {
  eyebrow: "Welcome to",
  nameLine1: "Saving Grace",
  nameLine2: "Bible Church",
  newHere: "New Here?",
  serviceTime: "Sunday 10:30 AM",
  address: "Unit 5/217-219 Mickleham Rd, Westmeadows VIC 3049",
  join: "Join Us This Weekend",
  joinHref: "/lords-day-service/"
} as const;

export const welcomeCopy = {
  heading: "Welcome to Saving Grace Bible Church",
  paragraph: "a community united in love with a singular aim: to glorify God. Our cornerstone is Christ-centered worship, the pinnacle of which is found in the sermon message. Every Sunday from 10:30 am, we gather as a diverse family, different ages, backgrounds, and ethnicities—unified through the Gospel of Jesus Christ."
} as const;

export type PillarGlyph = "history" | "lords-day" | "our-faith" | "the-gospel";

export interface Pillar {
  id: PillarGlyph;
  title: string;
  text: string;
  readMore: "Read more";
  /** Root-relative destination on this site. */
  href: string;
}

export const pillars: readonly Pillar[] = [
  { id: "history", title: "History", text: "Discover how God has led our church family from small beginnings to where we are today.", readMore: "Read more", href: "/our-history/" },
  { id: "lords-day", title: "Lord’s Day", text: "Each Sunday we gather to worship Christ and hear His Word faithfully preached — the heart of our life together.", readMore: "Read more", href: "/lords-day-service/" },
  { id: "our-faith", title: "Our Faith", text: "We hold fast to the truths of Scripture — God’s sovereignty, salvation by grace, and the hope of Christ’s return.", readMore: "Read more", href: "/what-we-teach/" },
  { id: "the-gospel", title: "The Gospel", text: "The good news is simple yet profound: though we are sinners, Christ died and rose again to bring us forgiveness and new life.", readMore: "Read more", href: "/what-we-teach/the-gospel/" }
];

export const servicesCopy = {
  heading: "Lord's Day Services",
  morning: {
    title: "Sunday Morning 10:30am (Formal)",
    text: "Every Sunday morning we meet for our main service, a time of reverent worship and faithful preaching from God’s Word.",
    href: "/lords-day-service/"
  },
  evening: {
    title: "Sunday Evening 5:30pm (Informal)",
    text: "In the evenings we meet in a relaxed setting to reflect on the morning’s sermon, ask questions, and talk about how God’s Word applies in practice.",
    href: "/evening-service/"
  }
} as const;

export const sermonsCopy = {
  heading: "Recent Sermons",
  viewAll: "View All",
  footerHeading: "Recent Sermon"
} as const;

export const aboutCopy = {
  heading: "About us",
  paragraph: "At Saving Grace Bible Church, we aim to exalt the name of our Lord Jesus Christ and magnify the truths of Scripture in West Meadows, Victoria. We stand as a steadfast lighthouse of Christ-centered reformed dispensationalist theology, embracing the principles of Calvinism and the literal future of Bible prophecies with unwavering devotion.",
  learnMore: "Learn more about our church >",
  learnMoreHref: "/about/",
  giveHeading: "Give",
  giveLink: "Ways to make an offering",
  giveHref: "/support-saving-grace-church-offering/",
  quote: "“I will not offer to the Lord my God sacrifices that have cost me nothing.”",
  attribution: "— 2 Samuel 24:24"
} as const;

/**
 * The Upcoming Events section's headings. The rows themselves are computed
 * from the church's event schedules (content/events.ts) for the day the
 * page is rendered, so nothing dated is written into page copy.
 */
export const eventsCopy = {
  heading: "Upcoming Events",
  viewCalendar: "View Calendar",
  viewCalendarHref: "/events/"
} as const;

export const contactCopy = {
  heading: "Contact Us",
  name: "Saving Grace Bible Church",
  addressLine1: "Unit 5/217-219 Mickleham Rd,",
  addressLine2: "Westmeadows VIC 3049",
  telephone: "Tel: 0450545589",
  telephoneHref: "tel:+61450545589",
  email: "E-mail: info@savinggrace.org.au",
  emailAddress: "info@savinggrace.org.au",
  directions: "Get directions on the map →",
  /** The church's Google Maps listing, as linked from the WordPress Contact Us page. */
  directionsHref: "https://goo.gl/maps/gL2hcbXG3Ci9zqRVA"
} as const;

export const getInvolvedCopy = {
  heading: "Get Involved",
  aboutUs: "About Us",
  sermons: "Sermons",
  whatWeTeach: "What We Teach",
  ministries: "Ministries",
  blogs: "Blogs"
} as const;

export const footerServicesCopy = {
  heading: "Lord's Day Services",
  morning: "Morning Worship: 10:30 am - 12:30 pm",
  evening: "Evening Service: 5:30 pm - 7:00 pm",
  morningLink: "Lord’s Day Service",
  eveningLink: "Evening Service"
} as const;

export const bottomBarCopy = {
  copyright: "© 2023 Saving Grace Bible Church",
  backToTop: "Back to top",
  followUs: "Follow us:"
} as const;

export const navigationCopy = {
  home: "Home",
  aboutUs: "About Us",
  sermons: "Sermons",
  ministries: "Ministries",
  newsEvents: "News & Events",
  contactUs: "Contact Us",
  give: "Give",
  search: "Search",
  sitemap: "Sitemap"
} as const;

export type SocialGlyph = "facebook" | "youtube" | "instagram" | "podcast";

/** The four social platforms drawn as icons in the screenshot; none has a known destination. */
export const socialPlatforms: ReadonlyArray<{ id: SocialGlyph; name: string }> = [
  { id: "facebook", name: "Facebook" },
  { id: "youtube", name: "YouTube" },
  { id: "instagram", name: "Instagram" },
  { id: "podcast", name: "Podcast" }
];

/**
 * Labels whose destinations the church has not supplied. They render as
 * pending labels (verbatim text, not interactive) until the church supplies
 * real accounts; nothing is guessed and nothing points off-site. The
 * WordPress export names no social account, so the four "Follow us" marks
 * remain pending.
 */
export const pendingLabels: readonly string[] = [
  "Facebook",
  "YouTube",
  "Instagram",
  "Podcast"
];

/** In-page section identifiers that the masthead, footer and pillars point at. */
export const homeSections = {
  top: "top",
  about: "about",
  services: "services",
  sermons: "sermons",
  events: "events",
  give: "give",
  contact: "contact",
  welcome: "welcome"
} as const;

/** Every string a test can assert is present on the rendered homepage. */
export const homepageInventory: readonly string[] = [
  churchNotice,
  heroCopy.newHere, heroCopy.serviceTime, heroCopy.address, heroCopy.join,
  welcomeCopy.heading, welcomeCopy.paragraph,
  ...pillars.flatMap((pillar) => [pillar.title, pillar.text, pillar.readMore]),
  servicesCopy.heading, servicesCopy.morning.title, servicesCopy.morning.text, servicesCopy.evening.title, servicesCopy.evening.text,
  sermonsCopy.heading, sermonsCopy.viewAll, sermonsCopy.footerHeading,
  aboutCopy.heading, aboutCopy.paragraph, aboutCopy.learnMore, aboutCopy.giveHeading, aboutCopy.quote, aboutCopy.attribution,
  eventsCopy.heading, eventsCopy.viewCalendar,
  contactCopy.heading, contactCopy.name, contactCopy.addressLine1, contactCopy.addressLine2, contactCopy.telephone, contactCopy.email, contactCopy.directions,
  getInvolvedCopy.heading, getInvolvedCopy.aboutUs, getInvolvedCopy.sermons, getInvolvedCopy.whatWeTeach, getInvolvedCopy.ministries, getInvolvedCopy.blogs,
  footerServicesCopy.heading, footerServicesCopy.morning, footerServicesCopy.evening,
  bottomBarCopy.copyright, bottomBarCopy.followUs,
  navigationCopy.home, navigationCopy.aboutUs, navigationCopy.sermons, navigationCopy.ministries, navigationCopy.newsEvents, navigationCopy.contactUs, navigationCopy.give
];

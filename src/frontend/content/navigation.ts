/**
 * The site's navigation, following the "Saving Grace Main Menu" and the
 * "Footer Menu" from the WordPress export of 24 September 2026, with every
 * destination mapped to this site's route for the same content. Labels are
 * the menu's own; the Sermons item keeps the archive menu the sermon
 * frontend already provides.
 */

export interface MenuItem {
  label: string;
  /** Root-relative path. */
  href: string;
  children?: readonly MenuItem[];
  /** Identifier for the masthead disclosure and current-item matching. */
  id?: string;
  /** A child nested one level deeper in the WordPress menu ("What We Teach >"). */
  sub?: boolean;
}

export const primaryMenu: readonly MenuItem[] = [
  { label: "Home", href: "/" },
  {
    id: "about",
    label: "About Us",
    href: "/about/",
    children: [
      { label: "Lord’s Day Service", href: "/lords-day-service/" },
      { label: "Evening Service", href: "/evening-service/" },
      { label: "Doctrinal Statement", href: "/doctrinal-statement/" },
      { label: "What We Teach", href: "/what-we-teach/" },
      { label: "The Gospel", href: "/what-we-teach/the-gospel/", sub: true },
      { label: "The Sufficiency of Scripture", href: "/what-we-teach/the-sufficiency-of-scripture/", sub: true },
      { label: "Mandated Church", href: "/what-we-teach/mandated-church/", sub: true },
      { label: "Believer’s Baptism", href: "/what-we-teach/believers-baptism/", sub: true },
      { label: "Elders", href: "/elders/" },
      { label: "Our History", href: "/our-history/" },
      { label: "Church Covenant", href: "/church-covenant/" },
      { label: "Church Membership", href: "/church-membership/" }
    ]
  },
  { id: "sermons", label: "Sermons", href: "/sermons/" },
  {
    id: "ministries",
    label: "Ministries",
    href: "/ministries/",
    children: [
      { label: "Bible Studies", href: "/bible-studies/" },
      { label: "Sunday School", href: "/sunday-school/" },
      { label: "Men’s Ministry", href: "/mens-ministry/" },
      { label: "Women’s Ministry", href: "/womens-ministry/" },
      { label: "Local Outreach", href: "/local-outreach/" },
      { label: "Teaching & Preaching Ministry", href: "/teaching-preaching-ministry/" },
      { label: "Music Ministry", href: "/music-ministry/" },
      { label: "Resources | Downloads", href: "/forms/" }
    ]
  },
  { label: "News & Events", href: "/events/" },
  { label: "Contact Us", href: "/contact/" }
];

/** The export's "Footer Menu": About Us, Sermons, What We Teach, Ministries, Blogs. */
export const footerMenu: readonly MenuItem[] = [
  { label: "About Us", href: "/about/" },
  { label: "Sermons", href: "/sermons/" },
  { label: "What We Teach", href: "/what-we-teach/" },
  { label: "Ministries", href: "/ministries/" },
  { label: "Blogs", href: "/blogs/" }
];

/** Strips a preview base path so menu matching works in every render context. */
export function sitePath(path: string): string {
  return path.replace(/^\/(?:frontend-preview|draft-preview)(?=\/|$)/u, "") || "/";
}

/** The top-level item whose subtree contains a path, for aria-current on the masthead. */
export function activeMenuItem(path: string): MenuItem | null {
  const normalised = sitePath(path);
  if (normalised === "/") return primaryMenu[0]!;
  for (const item of primaryMenu.slice(1)) {
    if (item.id === "sermons") continue;
    if (normalised === item.href || normalised.startsWith(item.href)) return item;
    if (item.children?.some((child) => normalised === child.href || normalised.startsWith(child.href))) return item;
  }
  if (normalised.startsWith("/sermons") || normalised.startsWith("/archived-sermons") || /^\/(?:speakers|series|books)\//u.test(normalised)) return primaryMenu.find((item) => item.id === "sermons")!;
  return null;
}

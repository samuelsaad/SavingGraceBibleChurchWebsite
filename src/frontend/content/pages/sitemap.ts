/**
 * Sitemap (WordPress page 3003, /pages/sitemap/ → /sitemap/): every page of this website, generated from the content registry.
 */
import type { SitePage } from "../types";

export const sitemapPage: SitePage = {
  id: "sitemap",
  path: "/sitemap/",
  title: "Sitemap",
  status: "published",
  section: "home",
  description: "Every page of the Saving Grace Bible Church website.",
  legacyPaths: [
    "/pages/sitemap/"
  ],
  source: { id: 3003, link: "https://savinggrace.org.au/pages/sitemap/", status: "publish", modified: "2013-03-22 14:45:15" },
  eyebrow: "Sitemap",
  blocks: [{kind:"sitemap-list"}]
};

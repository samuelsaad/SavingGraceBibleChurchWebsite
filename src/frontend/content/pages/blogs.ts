/**
 * Saving Grace Blogs (WordPress page 274, /blogs/): the blog index, listing the three published posts at their original addresses.
 */
import type { SitePage } from "../types";

export const blogsPage: SitePage = {
  id: "blogs",
  path: "/blogs/",
  title: "Saving Grace Blogs",
  status: "published",
  section: "blog",
  description: "Exploring faith, community, & church impact. Dive into our vibrant blog for spiritual insights & community stories",
  legacyPaths: [],
  source: { id: 274, link: "https://savinggrace.org.au/blogs/", status: "publish", modified: "2024-01-09 16:26:33" },
  eyebrow: "Blogs",
  blocks: [{kind:"blog-list",order:"DESC",limit:100}],
  related: [
    "what-we-teach",
    "about"
  ]
};

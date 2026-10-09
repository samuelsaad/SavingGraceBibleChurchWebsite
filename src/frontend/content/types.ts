/**
 * The content model for the church website's pages. Every page is data:
 * its identity, its canonical path, the legacy WordPress paths that must
 * redirect to it, its publication state as exported, and an ordered list of
 * blocks whose text is the church's own wording transcribed from the
 * WordPress export of 24 September 2026. Composers turn blocks into markup;
 * nothing here is HTML.
 */

/** Inline markup: see content/markup.ts. */
export type Markup = string;

export type PublicationStatus = "published" | "draft" | "private";

export type SiteSection = "home" | "about" | "teaching" | "ministries" | "events" | "resources" | "giving" | "contact" | "blog" | "sermons";

export interface Tile {
  title: string;
  text?: Markup;
  /** Root-relative destination; null renders the tile without a link (its destination is not published). */
  href: string | null;
  media?: string;
  mediaAlt?:string;
  mediaFocalPoint?:{x:number;y:number};
  eyebrow?: string;
  linkLabel?: string;
}

export interface Person {
  name: string;
  role: string;
  media?: string;
  mediaAlt?:string;
  mediaFocalPoint?:{x:number;y:number};
  email?: string;
  text: Markup[];
}

export interface TimelineItem {
  when: string;
  title: string;
  text: Markup;
}

export interface DownloadItem {
  title: string;
  text: Markup;
  href: string;
  label: string;
}

export interface HymnItem {
  title: string;
  text: Markup;
  href: string;
}

export interface IndexItem {
  href: string;
  title: string;
  text: Markup;
}

export type Block =
  | { kind: "paragraph"; text: Markup; lede?: boolean }
  | { kind: "heading"; level: 2 | 3 | 4; text: string; id?: string }
  | { kind: "list"; ordered?: boolean; items: Markup[] }
  | { kind: "quote"; text: Markup; cite?: string }
  | { kind: "figure"; media: string; caption?: Markup; size?: "full" | "inset" | "portrait"; alt?:string; focalPoint?:{x:number;y:number} }
  | { kind: "callout"; title?: string; text: Markup }
  | { kind: "panel"; title?: string; columns?:1|2|3; blocks: readonly Block[] }
  | { kind: "tiles"; items: Tile[]; columns?: 2 | 3 | 4 }
  | { kind: "people"; items: Person[] }
  | { kind: "timeline"; items: TimelineItem[] }
  | { kind: "next-event"; event: string; label: string }
  | { kind: "video"; videoId: string; title: string }
  | { kind: "playlist"; listId: string; title: string }
  | { kind: "downloads"; items: DownloadItem[] }
  | { kind: "hymns"; items: HymnItem[] }
  | { kind: "index"; items: IndexItem[] }
  | { kind: "sermon-cards"; heading: string; text?: Markup; linkLabel: string; limit?:number; order?:"ASC"|"DESC"; sermonIds?:string[] }
  | { kind: "external-plate"; title: string; text: Markup; href: string; label: string }
  | { kind: "book"; media: string; mediaAlt?:string;mediaFocalPoint?:{x:number;y:number}; text: Markup }
  | {
    kind: "contact-panel";
    name: string;
    addressLines: readonly string[];
    telephone: { label: string; href: string };
    email: string;
    map: { label: string; href: string };
  }
  | {
    kind: "giving-methods";
    heading?: string;
    intro: Markup;
    button: { label: string; href: string };
    methods: ReadonlyArray<{ title: string; text: Markup }>;
    bank: { title: string; account: string; lines: readonly string[] };
    online: { title: string; links: ReadonlyArray<{ label: string; href: string }> };
  }
  | { kind: "events-calendar"; upcomingHeading?:string;regularHeading?:string;pastHeading?:string;subscribeLabel?:string;days?:number;limit?:number;showUpcoming?:boolean;showRegular?:boolean;showPast?:boolean }
  | { kind:"blog-list";heading?:string;limit?:number;order?:"ASC"|"DESC" }
  | { kind:"sitemap-list" };

export interface PageSource {
  /** WordPress post ID. */
  id: number;
  /** Public URL at export time. */
  link: string;
  /** Exported post status. */
  status: "publish" | "draft" | "private";
  modified: string;
}

export interface SitePage {
  seo?: import('../seo').ContentSeo;
  id: string;
  /** Canonical root-relative path with a trailing slash. */
  path: string;
  title: string;
  /** The page's H1 when it differs from the navigation title. */
  heading?: string;
  status: PublicationStatus;
  section: SiteSection;
  /** Parent page id for the breadcrumb trail. */
  parent?: string;
  description: string;
  /** Legacy root-relative paths that redirect here (301). */
  legacyPaths: readonly string[];
  source: PageSource;
  eyebrow?: string;
  lede?: Markup;
  hero?: { enabled?:boolean; media: string; treatment: "banner" | "aside"; alt?:string; focalPoint?:{x:number;y:number} };
  blocks: readonly Block[];
  /** Side column blocks (downloads, next study, related pages). */
  aside?: readonly Block[];
  /** Shown in the "Also in this section" list. */
  related?: readonly string[];
  /** Notes for the inventory: where the page's copy was reorganised. */
  notes?: readonly string[];
}

export interface BlogPost {
  seo?: import('../seo').ContentSeo;
  id: string;
  path: string;
  title: string;
  date: string;
  description: string;
  media?: string;
  mediaAlt?:string;
  mediaFocalPoint?:{x:number;y:number};
  source: PageSource;
  blocks: readonly Block[];
}

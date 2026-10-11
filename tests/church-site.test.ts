import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SermonSummary } from "../src/domain/sermon";
import { embeddedImages } from "../src/frontend/assets/media-bytes";
import { siteImage, siteImageBytes, siteImages } from "../src/frontend/assets/media";
import { events, melbourneToday, nextOccurrence, occurrencesBetween, scheduleLabel, upcomingOccurrences, type ChurchEvent } from "../src/frontend/content/events";
import { markupHrefs, plainText } from "../src/frontend/content/markup";
import { activeMenuItem, footerMenu, primaryMenu } from "../src/frontend/content/navigation";
import { blogPosts, churchPages, destinationAvailable, legacyDisposition, legacyPaths, pageById, pageByPath } from "../src/frontend/content/registry";
import type { Block, SitePage } from "../src/frontend/content/types";
import { emptyFilterOptions, renderBlogPost, renderCalendarFeed, renderChurchPage, renderEventPage, renderEventsPage, renderSitemapPage, staticChurchPaths } from "../src/frontend";
import { previewRenderContext, publicRenderContext, restrictedRenderContext } from "../src/frontend/routes";
import { contentSecurityPolicy, embeddedScriptHashes, embeddedStyleHashes } from "../src/server/http/frontend-response";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import { createPublicSermonSiteHandler } from "../src/server/http/public-sermon-page";
import { siteAssetPaths, siteAssetResponse } from "../src/server/http/site-assets";
import type { PaginatedSermons, PublicSermonFilterOptions, PublicSermonRepository } from "../src/server/repositories/sermon-repository";
import { createSealedStagingHandler } from "../src/staging/handler";

const today = "2026-09-24";

function sermon(index: number): SermonSummary {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `An anonymised sermon ${index}`,
    slug: `anonymised-sermon-${index}`,
    serviceDate: `2026-02-${String(index).padStart(2, "0")}`,
    summary: "An anonymised approved description that is comfortably longer than eighty characters for the excerpt.",
    speaker: { name: "Example Speaker", slug: "example-speaker" },
    series: [{ name: "Example Series", slug: "example-series" }],
    scriptureReferences: [],
    primaryPassages: [{ displayText: `Luke ${index}:1–4`, isLead: true }],
    primaryPassageState: "assigned",
    books: [{ name: "Luke", slug: "luke" }],
    primaryMedia: null
  };
}

const options: PublicSermonFilterOptions = { ...emptyFilterOptions, books: [{ name: "Luke", slug: "luke", sermonCount: 3 }] };
const sermons = [sermon(3), sermon(2), sermon(1)];

class StubRepository implements PublicSermonRepository {
  calls = 0;
  async listPublished(): Promise<PaginatedSermons> { this.calls += 1; return { data: sermons, totalItems: sermons.length }; }
  async findPublishedBySlug() { return null; }
  async listPublishedFilterOptions() { this.calls += 1; return options; }
  async listPublishedTopicalSermons() { return []; }
  async listPublishedSeriesRepresentatives() { return []; }
  async listPublishedSitemapEntries() { return []; }
  async findPublicPathDisposition() { return null; }
}

const data = { today, sermons, options };
const published = churchPages.filter((page) => page.status === "published");
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function decode(html: string): string {
  return html.replaceAll("&amp;", "&").replaceAll("&gt;", ">").replaceAll("&lt;", "<").replaceAll("&quot;", "\"").replaceAll("&#39;", "'");
}

function blocksOf(page: SitePage): Block[] {
  const flat: Block[] = [];
  const walk = (blocks: readonly Block[]) => { for (const block of blocks) { flat.push(block); if (block.kind === "panel") walk(block.blocks); } };
  walk(page.blocks);
  return flat;
}

function markupOf(block: Block): string[] {
  switch (block.kind) {
    case "paragraph": case "quote": case "callout": return [block.text];
    case "list": return [...block.items];
    case "tiles": return block.items.flatMap((tile) => [tile.text ?? ""]);
    case "people": return block.items.flatMap((person) => person.text);
    case "downloads": case "hymns": case "index": return block.items.map((item) => item.text);
    case "book": return [block.text];
    default: return [];
  }
}

function render(page: SitePage, context = publicRenderContext): string {
  if (page.id === "events") return renderEventsPage(page, data, context);
  if (page.id === "blogs") return renderBlogPost(blogPosts[0]!, data, context) && renderChurchPage({ ...page, blocks: [] }, data, context);
  if (page.id === "sitemap") return renderSitemapPage(page, data, context);
  return renderChurchPage(page, data, context);
}

describe("church content registry", () => {
  it("carries every content-bearing WordPress page with its export identity, status and one canonical path", () => {
    const ids = churchPages.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
    const paths = [...churchPages.map((page) => page.path), ...blogPosts.map((post) => post.path), ...(events as readonly ChurchEvent[]).map((event) => event.path)];
    expect(new Set(paths).size).toBe(paths.length);
    for (const page of churchPages) {
      expect(page.path, page.id).toMatch(/^\/(?:[a-z0-9-]+\/)+$/u);
      expect(page.source.id).toBeGreaterThan(0);
      expect(page.source.link).toMatch(/^https:\/\/savinggrace\.org\.au\//u);
      expect(["publish", "draft", "private"]).toContain(page.source.status);
      expect(page.status).toBe(page.source.status === "publish" ? "published" : page.source.status);
      expect(page.description.length, page.id).toBeGreaterThan(20);
      if (page.parent) expect(pageById(page.parent)).toBeTruthy();
    }
    const publishedSourceIds = published.map((page) => page.source.id).sort((a, b) => a - b);
    // The 30 published WordPress pages minus the theme placeholder "I am new here" (37), plus the Events Calendar archive.
    expect(publishedSourceIds).toEqual([34, 274, 2285, 3002, 3003, 7043, 26191, 26193, 26195, 26330, 26344, 26358, 26375, 26384, 26391, 26490, 27427, 27475, 27815, 27844, 27854, 27942, 28000, 28031, 28136, 28656, 29584, 29840]);
    expect(churchPages.filter((page) => page.status === "draft").map((page) => page.source.id).sort((a, b) => a - b)).toEqual([27836, 29431, 29436, 29971]);
    expect(churchPages.filter((page) => page.status === "private").map((page) => page.source.id)).toEqual([2340]);
    expect(blogPosts.map((post) => post.source.id).sort((a, b) => a - b)).toEqual([29160, 29285, 29343]);
    expect((events as readonly ChurchEvent[]).flatMap((event) => event.sourceIds).sort((a, b) => a - b)).toEqual([27911, 27914, 27923, 27984, 27990, 28009, 29099, 29101, 29103, 29593, 29964, 29966, 30027, 30029, 30031, 30083, 30090, 30102, 30104]);
  });

  it("links only to destinations that exist: internal pages, events, sermons, anchors, telephone, e-mail and explicit external sites", () => {
    const seen = new Set<string>();
    for (const page of churchPages) {
      for (const block of blocksOf(page)) {
        const hrefs = [
          ...markupOf(block).flatMap((text) => markupHrefs(text)),
          ...(block.kind === "tiles" ? block.items.map((tile) => tile.href).filter((href): href is string => Boolean(href)) : []),
          ...(block.kind === "downloads" || block.kind === "hymns" || block.kind === "index" ? block.items.map((item) => item.href) : []),
          ...(block.kind === "external-plate" ? [block.href] : []),
          ...(block.kind === "giving-methods" ? [block.button.href, ...block.online.links.map((link) => link.href)] : []),
          ...(block.kind === "contact-panel" ? [block.telephone.href, block.map.href] : [])
        ];
        for (const href of hrefs) {
          seen.add(href);
          if (href.startsWith("#")) continue;
          if (/^(?:mailto:|tel:)/u.test(href)) continue;
          if (/^https?:\/\//u.test(href)) {
            expect(href, `${page.id}: ${href}`).not.toMatch(/savinggrace\.org\.au\/(?!wp-content\/uploads\/)/u);
            expect(href, `${page.id}: ${href}`).not.toMatch(/stage\.savinggrace|vamtam|church-event\.vamtam/u);
            continue;
          }
          expect(href, `${page.id}: ${href}`).toMatch(/^\//u);
          expect(destinationAvailable(href, previewRenderContext), `${page.id}: ${href}`).toBe(true);
        }
      }
      for (const id of page.related ?? []) expect(pageById(id)).toBeTruthy();
    }
    expect([...seen].filter((href) => href.includes("wp-content/uploads/")).sort()).toEqual([
      "https://savinggrace.org.au/wp-content/uploads/2020/02/Constitution.pdf",
      "https://savinggrace.org.au/wp-content/uploads/2023/11/Saving-Grace-Bible-Church-Covenant.pdf",
      "https://www.savinggrace.org.au/wp-content/uploads/2024/01/Saving-Grace-Bible-Church-Doctrinal-Statement-V1_.pdf"
    ]);
    for (const item of [...primaryMenu, ...primaryMenu.flatMap((entry) => entry.children ?? []), ...footerMenu]) {
      expect(destinationAvailable(item.href, publicRenderContext), item.href).toBe(true);
    }
    expect(activeMenuItem("/what-we-teach/the-gospel/")?.id).toBe("about");
    expect(activeMenuItem("/frontend-preview/bible-studies/")?.id).toBe("ministries");
    expect(activeMenuItem("/sermons/anonymised-sermon-1/")?.id).toBe("sermons");
    expect(activeMenuItem("/events/")?.label).toBe("News & Events");
  });

  it("keeps the church's wording free of WordPress shortcodes, theme markup and executable code", () => {
    for (const page of churchPages) {
      for (const block of blocksOf(page)) {
        for (const text of [...markupOf(block), ...(block.kind === "heading" ? [block.text] : [])]) {
          expect(text, `${page.id}: ${text.slice(0, 60)}`).not.toMatch(/\[(?:column|column_1|push|blank|divider|icon|button|services|linkarea|team_member|tribe_events|asp-sermons|contact-form-7|sitemap|blog|bold_timeline|siteorigin_widget|text_divider|list|accordion|pane|slogan|dropcap)\b/u);
          expect(text).not.toMatch(/<[a-z!/]/iu);
          expect(text).not.toMatch(/elementor|Lorem Ipsum|Photoshop’s version/u);
        }
      }
    }
    expect(plainText("**Strong** _em_ and a [link](/about/)")).toBe("Strong em and a link");
  });

  it("gives every legacy WordPress address exactly one disposition, and never redirects the public to an unpublished page", () => {
    const rows = legacyPaths();
    const paths = rows.map((row) => row.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const row of rows) {
      expect(row.path).toMatch(/^\/.*\/$/u);
      expect(pageByPath(row.path), row.path).toBeNull();
      if (row.disposition.kind === "redirect") expect(destinationAvailable(row.disposition.location, previewRenderContext), row.path).toBe(true);
    }
    for (const path of ["/pages/lordsdayservice/", "/pages/biblestudies/", "/pages/sunday-school/", "/pages/local-outreach/", "/pages/church-covenant/", "/contact-us-2/", "/pages/sitemap/", "/church-events/", "/pages/im-new-here/"]) {
      expect(legacyDisposition(path, publicRenderContext)?.kind, path).toBe("redirect");
    }
    expect(legacyDisposition("/pages/lordship-salvation/", publicRenderContext)?.kind).toBe("unavailable");
    expect(legacyDisposition("/pages/lordship-salvation/", previewRenderContext)).toEqual(expect.objectContaining({ kind: "redirect", location: "/what-we-teach/lordship-salvation/" }));
    expect(legacyDisposition("/constitution-3/", publicRenderContext)?.kind).toBe("unavailable");
    expect(legacyDisposition("/constitution-3/", previewRenderContext)?.kind).toBe("redirect");
    expect(legacyDisposition("/testimonials/thomas-paine/", publicRenderContext)?.kind).toBe("gone");
    expect(legacyDisposition("/event/mens-teaching-and-preaching-study-2-2/", publicRenderContext)).toEqual(expect.objectContaining({ location: "/events/mens-teaching-and-preaching-study/" }));
    expect(legacyDisposition("/series/womans-study/", publicRenderContext)).toEqual(expect.objectContaining({ location: "/events/womans-study/" }));
    expect(legacyDisposition("/venue/state-library/", publicRenderContext)).toBeNull();
    expect(legacyDisposition("/sermons/", publicRenderContext)).toBeNull();
  });
});

describe("church media", () => {
  it("embeds byte-identical copies of every optimised image in the assets directory, with alt text and an archive source", () => {
    const directory = resolve(__dirname, "../src/frontend/assets/media");
    const files = readdirSync(directory).filter((name) => /\.(?:jpg|png)$/u.test(name)).sort();
    expect(files).toEqual(siteImages.map((image) => image.file).sort());
    for (const image of siteImages) {
      const bytes = siteImageBytes(image.id);
      expect(sha256(bytes), image.id).toBe(embeddedImages[image.id]!.sha256);
      expect(sha256(readFileSync(resolve(directory, image.file))), image.id).toBe(embeddedImages[image.id]!.sha256);
      expect(image.source, image.id).toMatch(/^20\d\d\/\d\d\/.+\.(?:jpe?g|png)$/u);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
      expect(bytes.byteLength).toBeLessThan(200_000);
      expect(Array.from(bytes.slice(0, 2))).toEqual(image.type === "image/png" ? [0x89, 0x50] : [0xff, 0xd8]);
    }
    expect(siteImages.reduce((total, image) => total + siteImageBytes(image.id).byteLength, 0)).toBeLessThan(2_400_000);
    expect(siteImage("wesam").alt).toContain("Wesam");
    expect(siteImage("books").alt).toBe("");
  });

  it("serves the allowlisted images, icons and logo from every runtime and nothing else", async () => {
    expect(siteAssetPaths).toContain("/brand/saving-grace-logo.png");
    expect(siteAssetPaths).toContain("/brand/favicon-32.png");
    expect(siteAssetPaths).toContain("/brand/icon-192.png");
    expect(siteAssetPaths).toContain("/media/wesam.jpg");
    expect(siteAssetPaths).not.toContain("/media/favicon-32.png");
    const served = siteAssetResponse(new Request("http://127.0.0.1/media/wesam.jpg"));
    expect(served?.status).toBe(200);
    expect(served?.headers.get("content-type")).toBe("image/jpeg");
    expect(sha256(new Uint8Array(await served!.arrayBuffer()))).toBe(embeddedImages.wesam!.sha256);
    for (const path of ["/media/", "/media/other.jpg", "/media/wesam.jpg/", "/media/wesam.JPG", "/src/frontend/assets/media/wesam.jpg"]) {
      expect(siteAssetResponse(new Request(`http://127.0.0.1${path}`)), path).toBeNull();
    }
    const sealed = createSealedStagingHandler(new StubRepository(), async () => {}, "a".repeat(40));
    const response = await sealed(new Request("http://127.0.0.1/media/congregation.jpg"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});

describe("church events", () => {
  it("computes occurrences from the exported schedules, honouring exclusions and ended runs", () => {
    expect(nextOccurrence("mens-theological-study", today)?.date).toBe("2026-09-27");
    expect(nextOccurrence("sunday-evening-service", today)?.date).toBe("2026-09-27");
    expect(nextOccurrence("tuesday-bible-study", today)?.date).toBe("2026-09-29");
    expect(nextOccurrence("mens-teaching-and-preaching-study", today)?.date).toBe("2026-09-29");
    expect(nextOccurrence("womans-study", today)?.date).toBe("2026-10-03");
    expect(nextOccurrence("mens-study", today)?.date).toBe("2026-10-03");
    expect(nextOccurrence("street-evangelism-outreach", today)).toBeNull();
    expect(nextOccurrence("sgbc-picnic-rye", today)).toBeNull();
    expect(occurrencesBetween(pageEvent("tuesday-bible-study"), "2026-06-29", "2026-07-14").map((item) => item.date)).toEqual(["2026-07-14"]);
    expect(occurrencesBetween(pageEvent("sunday-evening-service"), "2026-05-24", "2026-06-07").map((item) => item.date)).toEqual(["2026-05-24", "2026-06-07"]);
    expect(occurrencesBetween(pageEvent("womans-study"), "2026-06-01", "2026-09-30").map((item) => item.date)).toEqual(["2026-06-06", "2026-07-04", "2026-08-01", "2026-09-05"]);
    const upcoming = upcomingOccurrences(today, { days: 7 });
    expect(upcoming.map((item) => `${item.date} ${item.start} ${item.event.id}`)).toEqual([
      "2026-09-27 16:30 mens-theological-study",
      "2026-09-27 17:30 sunday-evening-service",
      "2026-09-29 18:00 mens-teaching-and-preaching-study",
      "2026-09-29 19:00 tuesday-bible-study"
    ]);
    expect(scheduleLabel(pageEvent("sunday-evening-service"))).toBe("Every Sunday, 5:30 pm – 7:00 pm");
    expect(scheduleLabel(pageEvent("womans-study"))).toBe("First Saturday of the month, 3:30 pm – 5:00 pm");
    expect(scheduleLabel(pageEvent("sgbc-picnic-rye"))).toBe("Saturday 23 March 2024, 8:00 am – 5:00 pm");
    expect(melbourneToday(new Date("2026-09-24T15:30:00Z"))).toBe("2026-09-25");
    expect(melbourneToday(new Date("2026-09-24T13:00:00Z"))).toBe("2026-09-24");
  });

  it("publishes an iCalendar feed with the same rules", () => {
    const feed = renderCalendarFeed();
    expect(feed).toContain("BEGIN:VCALENDAR");
    expect(feed).toContain("TZID:Australia/Melbourne");
    expect(feed).toContain("SUMMARY:Sunday Evening Service");
    expect(feed).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU");
    expect(feed).toContain("RRULE:FREQ=MONTHLY;BYDAY=1SA");
    expect(feed).toContain("EXDATE;TZID=Australia/Melbourne:20260531T173000");
    expect(feed).toContain("DTSTART;TZID=Australia/Melbourne:20240323T080000");
    expect(feed).toContain("LOCATION:State Library\\, 328 Swanston St\\, Melbourne\\, VIC 3000");
    expect(feed.match(/BEGIN:VEVENT/gu)).toHaveLength(events.length);
    for (const line of feed.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });
});

function pageEvent(id: ChurchEvent["id"]): ChurchEvent {
  return (events as readonly ChurchEvent[]).find((event) => event.id === id)!;
}

describe("church page rendering", () => {
  it("renders every published page with one h1, a breadcrumb trail, its own metadata, the shared masthead and no iframe or inline style", () => {
    for (const page of published) {
      const html = decode(render(page));
      expect(html.match(/<h1[\s>]/gu), page.id).toHaveLength(1);
      expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/u)?.[1], page.id).toBe(page.heading ?? page.title);
      expect(html, page.id).toContain('<nav aria-label="Breadcrumb"><ol class="trail" role="list"><li><a href="/">Home</a></li>');
      expect(html, page.id).toContain(`<link rel="canonical" href="https://www.savinggrace.org.au${page.path}" />`);
      expect(html, page.id).toContain(`<title>${page.title} — Saving Grace Bible Church</title>`);
      expect(html, page.id).toContain('<meta name="robots" content="index, follow" />');
      expect(html, page.id).toContain('<nav class="masthead__nav" id="primary-navigation" aria-label="Primary"><ul class="masthead__links">');
      expect(html, page.id).toContain('<details class="masthead__menu" data-menu>');
      expect(html, page.id).not.toContain("<iframe");
      expect(html, page.id).not.toContain(' style="');
      for (const match of html.matchAll(/url\(["']?([^"')]+)["']?\)/gu)) {
        expect(match[1], page.id).toMatch(/^\/brand\/fonts\/[a-z0-9.-]+$/u);
      }
      expect(html, page.id).not.toMatch(/\[(?:column|push|blank|icon|button)\b/u);
      expect(html, page.id).not.toContain("wp-content/uploads/2023/09");
      expect(html, page.id).not.toContain('class="pending page__status');
      const csp = contentSecurityPolicy(html);
      for (const hash of [...embeddedStyleHashes(html), ...embeddedScriptHashes(html)]) expect(csp).toContain(hash);
      // The YouTube frame source opens only for pages whose markup carries a click-to-load plate.
      expect(csp.includes("frame-src https://www.youtube-nocookie.com"), page.id).toBe(/<[a-z][^>]*\sdata-video-frame[\s>]/u.test(html));
      expect(csp).not.toContain("'unsafe-inline'");
    }
  });

  it("carries the church's paragraphs verbatim into the markup with links, emphasis and Scripture references intact", () => {
    const doctrine = decode(renderChurchPage(pageById("doctrinal-statement"), data));
    expect(doctrine).toContain("<strong>We believe</strong> that the Bible is the inspired and the only infallible and authoritative Word of God.");
    expect(doctrine).toContain('<h2 class="page__h2" id="the-holy-scriptures">The Holy Scriptures</h2>');
    expect(doctrine).toContain('<a href="https://biblia.com/bible/nasb95/1%20Cor%202.7-14" class="external" rel="noopener">1 Corinthians 2:7-14</a>');
    expect(doctrine).toContain("<strong>God the Father.</strong> We teach that God the Father");
    expect(doctrine).toContain('<a class="index-grid__link" href="#to-be-christian">');
    expect(doctrine).toContain('href="https://www.savinggrace.org.au/wp-content/uploads/2024/01/Saving-Grace-Bible-Church-Doctrinal-Statement-V1_.pdf"');
    expect(doctrine).toContain('<a href="/contact/">get in contact with us</a>');
    expect(doctrine.match(/We teach/gu)!.length).toBeGreaterThan(70);

    const about = decode(renderChurchPage(pageById("about"), data));
    expect(about).toContain("<strong>Total Depravity:</strong> We humbly acknowledge our fallen nature");
    expect(about).toContain('<a href="tel:+61450545589">0450 545 589</a>');
    expect(about).toContain('<a href="mailto:info@savinggrace.org.au">info@savinggrace.org.au</a>');
    expect(about).toContain('<img class="figure__image" src="/media/tulips.png" width="408" height="612" alt="A bunch of white tulips');
    expect(about).toContain('<footer class="verse__cite">— 2 Peter 3:18</footer>');
    expect(about).toContain('<a class="tile__more" href="/doctrinal-statement/">Read more<span class="sr-only"> about Doctrinal Statement</span></a>');

    const music = decode(renderChurchPage(pageById("music-ministry"), data));
    expect(music).toContain('<a class="hymn__link" href="https://www.hymnal.net/en/hymn/h/313" rel="noopener">Play & Lyrics<span aria-hidden="true"> →</span><span class="sr-only"> (external site)</span></a>');
    expect(music).toContain('<a href="mailto:ralph@savinggrace.org.au">ralph@savinggrace.org.au</a>');
    expect(music).toContain('<img class="person__image" src="/media/ralph-music.jpg"');

    const giving = decode(renderChurchPage(pageById("giving"), data));
    expect(giving).toContain("BSB: 063-765");
    expect(giving).toContain("Account Number: 1090 6641");
    expect(giving).toContain('href="https://donate.stripe.com/eVa4hQ26gacd7AYeUU"');
    expect(giving).toContain('href="https://www.sermonaudio.com/secure/paydonate.asp?sourceid=savinggrace"');
    expect(giving).toContain('<a href="https://donate.stripe.com/eVa4hQ26gacd7AYeUU" class="external" rel="noopener">here</a> to make your donation');

    const contact = decode(renderChurchPage(pageById("contact"), data));
    expect(contact).toContain('<a href="tel:+61450545589">Tel: 0450545589</a>');
    expect(contact).toContain('<a class="button" href="mailto:info@savinggrace.org.au">Send us an email</a>');
    expect(contact).toContain('href="https://goo.gl/maps/gL2hcbXG3Ci9zqRVA"');
    expect(contact.replace(/<header\b[^>]*class="masthead"[\s\S]*?<\/header>/u, "")).not.toContain("<form");
    expect(contact).not.toContain("form provided above");
  });

  it("computes 'our next study' from the schedules, shows the newest sermons on the Lord's Day page and makes the unpublished Lordship Salvation tile inert in public", () => {
    const lordsDay = decode(renderChurchPage(pageById("lords-day-service"), data));
    expect(lordsDay.match(/<article class="card /gu)).toHaveLength(3);
    expect(lordsDay).toContain('href="/sermons/anonymised-sermon-3/"');
    expect(lordsDay).toContain('<a class="button" href="/sermons/">Click here to access past sermons ></a>');
    expect(lordsDay).toContain('<img class="person__image" src="/media/wesam.jpg"');
    expect(lordsDay).toContain('<span class="pending tile__more tile__more--pending">Read more<span class="sr-only"> (link not yet available)</span></span>');
    expect(lordsDay).toContain('<a class="tile__more" href="/what-we-teach/mandated-church/">');
    const lordsDayPreview = renderChurchPage(pageById("lords-day-service"), data, previewRenderContext);
    expect(lordsDayPreview).toContain('<a class="tile__more" href="/frontend-preview/what-we-teach/lordship-salvation/">');
    expect(lordsDayPreview).not.toContain("tile__more--pending");

    const mens = decode(renderChurchPage(pageById("mens-ministry"), data));
    expect(mens).toContain('<span class="next-event__label">Our next study:</span> <a class="next-event__link" href="/events/mens-theological-study/"><time datetime="2026-09-27">Sunday 27 September 2026</time>, 4:30 pm – 5:30 pm</a>');
    expect(mens).toContain('<a class="next-event__link" href="/events/mens-study/"><time datetime="2026-10-03">Saturday 3 October 2026</time>, 3:30 pm – 5:00 pm</a>');
    expect(mens).toContain('<img class="book__cover" src="/media/fight-like-a-man.jpg"');
    const empty = renderChurchPage(pageById("lords-day-service"), { ...data, sermons: [] });
    expect(empty).toContain("No sermon is available yet. Please check back soon.");
    expect(empty).not.toContain('<article class="card');
  });

  it("loads YouTube videos and playlists only on request, with the loader script hashed into the policy", () => {
    const studies = renderChurchPage(pageById("bible-studies"), data);
    expect(studies.replace(/<script[\s\S]*?<\/script>/gu, "").match(/data-video-frame/gu)).toHaveLength(8);
    expect(studies).toContain('data-load-youtube data-playlist-id="PL_uubQT0SZGoGY2xc8W0o0FLkkMjhM-9O" data-video-title="End Times Study"');
    expect(studies).toContain('<a class="plate__external" href="https://www.youtube.com/playlist?list=PL_uubQT0SZGqTE_ymw8vkCqDCFZwd4MLv" rel="noopener">');
    expect(studies).toContain('<script data-enhancement="church">');
    expect(studies.replace(/<script[\s\S]*?<\/script>/gu, "")).not.toContain("youtube-nocookie.com/embed");
    expect(studies).not.toContain("<iframe");
    expect(contentSecurityPolicy(studies)).toContain("frame-src https://www.youtube-nocookie.com");
    expect(contentSecurityPolicy(renderChurchPage(pageById("about"), data))).not.toContain("frame-src");
    const gospel = renderChurchPage(pageById("the-gospel"), data);
    expect(gospel).toContain('data-load-youtube data-video-id="xl8lirejmN0" data-video-title="The Simplicity of the Gospel | Mark 15:32"');
    expect(renderChurchPage(pageById("about"), data)).not.toContain('<script data-enhancement="church">');
    const archived = renderChurchPage(pageById("archived-sermons"), data);
    expect(archived).toContain('href="https://embed.sermonaudio.com/browser/broadcaster/savinggrace/?sort=newest&amp;page_size=25&amp;rounded=true"');
    expect(archived).not.toContain("<iframe");
  });

  it("renders drafts and the private constitution only in the authenticated preview, labelled and non-indexable", () => {
    for (const page of churchPages.filter((candidate) => candidate.status !== "published")) {
      const html = renderChurchPage(page, data, previewRenderContext);
      expect(html, page.id).toContain('<meta name="robots" content="noindex, nofollow, noarchive" />');
      expect(html, page.id).toContain(page.status === "draft" ? "Draft — not published" : "Private — not published");
      expect(html, page.id).not.toContain('rel="canonical"');
      expect(staticChurchPaths(publicRenderContext), page.id).not.toContain(page.path);
      expect(staticChurchPaths(previewRenderContext), page.id).toContain(page.path);
    }
    const constitution = decode(renderChurchPage(pageById("constitution"), data, previewRenderContext));
    expect(constitution).toContain("Article 7 - Government");
    expect(constitution).toContain('href="https://www.savinggrace.org.au/wp-content/uploads/2020/02/Constitution.pdf"');
    const sitemapPublic = renderSitemapPage(pageById("sitemap"), data);
    expect(sitemapPublic).not.toContain("/constitution/");
    expect(sitemapPublic).not.toContain("lordship-salvation");
    expect(sitemapPublic).toContain('href="/events/tuesday-bible-study/"');
    expect(sitemapPublic).toContain('href="/2024/01/saving-grace-meaning-what-does-it-mean-to-be-saved-by-grace/"');
    expect(renderSitemapPage(pageById("sitemap"), data, previewRenderContext)).toContain('href="/frontend-preview/constitution/"');
  });

  it("keeps six upcoming dates visible and every remaining date in a closed native disclosure", () => {
    const calendar = decode(renderEventsPage(pageById("events"), data));
    const upcoming = upcomingOccurrences(today, { days: 35 });
    expect(upcoming.length).toBeGreaterThan(6);
    const section = calendar.match(/<section class="section" aria-labelledby="upcoming-heading">([\s\S]*?)<\/section>/u)![1]!;
    const disclosure = section.match(/<details class="events-more">([\s\S]*?)<\/details>/u)![1]!;
    expect(disclosure).toContain('<summary class="events-more__summary">More upcoming dates');
    expect(section.slice(0, section.indexOf('<details class="events-more">')).match(/<li class="event">/gu)).toHaveLength(6);
    expect(disclosure.match(/<li class="event">/gu)).toHaveLength(upcoming.length - 6);
    const rows = [...section.matchAll(/<li class="event">([\s\S]*?)<\/li>/gu)].map((match) => ({
      datetime: match[1]!.match(/<time datetime="([^"]+)"/u)![1],
      href: match[1]!.match(/<a href="([^"]+)"/u)![1]
    }));
    expect(rows).toEqual(upcoming.map((occurrence) => ({ datetime: `${occurrence.date}T${occurrence.start}`, href: occurrence.event.path })));
    expect(calendar).toContain('<a href="#upcoming-heading">Upcoming</a>');
    expect(calendar).toContain('<a href="#regular-heading">Regular gatherings</a>');
    expect(calendar).toContain('<a href="#past-heading">Past events</a>');
    expect(calendar).toContain('href="/events/calendar.ics"');
  });

  it("renders the events calendar, event pages, blog and history timeline", () => {
    const calendar = decode(renderEventsPage(pageById("events"), data));
    expect(calendar).toContain('<h1 class="page__title">Church Events</h1>');
    expect(calendar).toContain('<a href="/events/calendar.ics">subscribe to our calendar</a>');
    expect(calendar).toContain('<h2 id="upcoming-heading" class="section__title">Upcoming</h2>');
    expect(calendar).toContain('<time datetime="2026-09-27T16:30">Sunday 27 September 2026, 4:30 pm – 5:30 pm</time>');
    expect(calendar).toContain('<p class="tile__metadata">First Saturday of the month, 3:30 pm – 5:00 pm</p>');
    expect(calendar).toContain('<a href="/events/sgbc-picnic-rye/">SGBC Picnic - Rye</a>');
    expect(calendar).toContain("Street Evangelism | Outreach");
    const event = decode(renderEventPage(pageEvent("street-evangelism-outreach"), data));
    expect(event).toContain("This event took place on Sunday 31 May 2026, 2:00 pm – 5:00 pm.");
    expect(event).toContain("<strong>State Library</strong><span>328 Swanston St</span><span>Melbourne, VIC 3000</span>");
    expect(event).toContain('<a class="button" href="/local-outreach/">Local Outreach</a>');
    const tuesday = decode(renderEventPage(pageEvent("tuesday-bible-study"), data));
    expect(tuesday).toContain('<h2 id="dates-heading" class="page__h2">Next dates</h2>');
    expect(tuesday).toContain('<time datetime="2026-09-29T19:00">Tuesday 29 September 2026</time>, 7:00 pm – 8:30 pm');
    expect(tuesday).toContain('<a href="tel:+61450545589">0450 545 589</a>');
    expect(tuesday).toContain("Everyone is welcome—no registration needed.");

    const post = decode(renderBlogPost(blogPosts[2]!, data));
    expect(post.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/u)?.[1]).toBe("Understanding Dispensationalism: Unveiling God’s Plan Through the Ages");
    expect(post).toContain('<meta property="og:type" content="article" />');
    expect(post).toContain('<time datetime="2024-01-09">9 January 2024</time>');
    expect(post).toContain('<a href="/what-we-teach/mandated-church/">Church</a>');
    expect(post).toContain('<a href="tel:+61450545589">0450 545 589</a>');
    expect(post).toContain('<a href="/blogs/">All blog posts</a>');

    const history = decode(renderChurchPage(pageById("our-history"), data));
    expect(history).toContain('<span class="timeline__when">1945</span>');
    expect(history).toContain("The providential merger with East Keilor Evangelical Christian Church, guided by God's purpose");
    expect(history).toMatch(/<img\b[^>]*src="\/media\/early-church\.jpg"/u);
    expect(history.match(/<li class="timeline__item">/gu)).toHaveLength(8);
  });
});

describe("church site routes", () => {
  it("serves pages, redirects legacy addresses in one hop, answers 410 for retired theme content and hides unpublished pages from the public and sealed runtimes", async () => {
    for (const context of [publicRenderContext, restrictedRenderContext]) {
      const repository = new StubRepository();
      const route = createPublicSermonSiteHandler(repository, context, { today: () => today });
      const about = await route(new Request("http://127.0.0.1/about/"));
      expect(about?.status).toBe(200);
      expect((await about!.text()).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/u)?.[1]).toBe("Embrace Reformed Truths at Saving Grace Bible Church, Melbourne");
      expect(about?.headers.get("content-security-policy")).toContain("style-src 'sha256-");
      const home = await route(new Request("http://127.0.0.1/"));
      expect(home?.status).toBe(200);
      expect(await home!.text()).toContain('<h1 id="hero-heading" class="arrive__title">');
      for (const [path, location] of [["/pages/lordsdayservice/", "/lords-day-service/"], ["/contact-us-2/", "/contact/"], ["/church-events/", "/events/"], ["/event/sunday-evening-service-2/", "/events/sunday-evening-service/"], ["/pages/sitemap/", "/sitemap/"]]) {
        const response = await route(new Request(`http://127.0.0.1${path}?utm=1`));
        expect(response?.status, path).toBe(301);
        expect(response?.headers.get("location"), path).toBe(`${location}?utm=1`);
      }
      const slashless = await route(new Request("http://127.0.0.1/about"));
      expect(slashless?.status).toBe(301);
      expect(slashless?.headers.get("location")).toBe("/about/");
      expect((await route(new Request("http://127.0.0.1/events/tuesday-bible-study")))?.headers.get("location")).toBe("/events/tuesday-bible-study/");
      const gone = await route(new Request("http://127.0.0.1/testimonials/robert-h-schuller/"));
      expect(gone?.status).toBe(410);
      for (const path of ["/constitution/", "/what-we-teach/lordship-salvation/", "/elders/draft/", "/constitution-3/", "/pages/lordship-salvation/"]) {
        const response = await route(new Request(`http://127.0.0.1${path}`));
        expect(response?.status, path).toBe(404);
      }
      const calendar = await route(new Request("http://127.0.0.1/events/calendar.ics"));
      expect(calendar?.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
      const image = await route(new Request("http://127.0.0.1/media/hands.jpg"));
      expect(image?.headers.get("content-type")).toBe("image/jpeg");
      expect((await route(new Request("http://127.0.0.1/about/", { method: "POST" })))?.status).toBe(405);
      expect(await route(new Request("http://127.0.0.1/sermons/"))).not.toBeNull();
      expect(await route(new Request("http://127.0.0.1/nowhere/"))).toBeNull();
      expect(await route(new Request("http://127.0.0.1/api/v1/sermons"))).toBeNull();
    }
  });

  it("serves the same pages inside the authenticated preview root, including drafts, with private headers and no indexable metadata", async () => {
    const route = createLocalFrontendPreviewHandler(new StubRepository(), { authorizes: () => true }, { church: { today: () => today } });
    const events = await route(new Request("http://127.0.0.1/frontend-preview/events/"));
    expect(events?.status).toBe(200);
    expect(events?.headers.get("cache-control")).toBe("private, no-store, max-age=0, must-revalidate");
    const html = await events!.text();
    expect(html).toContain('<a href="/frontend-preview/events/mens-theological-study/">Men’s Theological Study</a>');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain('<div class="preview-band" role="status">');
    const draft = await route(new Request("http://127.0.0.1/frontend-preview/what-we-teach/lordship-salvation/"));
    expect(draft?.status).toBe(200);
    expect(await draft!.text()).toContain("Draft — not published");
    const legacy = await route(new Request("http://127.0.0.1/frontend-preview/pages/church-covenant/"));
    expect(legacy?.status).toBe(307);
    expect(legacy?.headers.get("location")).toBe("/frontend-preview/church-covenant/");
    const denied = createLocalFrontendPreviewHandler(new StubRepository(), { authorizes: () => false });
    expect((await denied(new Request("http://127.0.0.1/frontend-preview/about/")))?.status).toBe(401);
    expect(await route(new Request("http://127.0.0.1/about/"))).toBeNull();
  });

  it("keeps the sealed visitor runtime serving the church pages with its own headers", async () => {
    const sealed = createSealedStagingHandler(new StubRepository(), async () => {}, "a".repeat(40));
    const response = await sealed(new Request("http://127.0.0.1/ministries/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(await response.text()).toContain("Preaching/Teaching Ministry");
    expect((await sealed(new Request("http://127.0.0.1/constitution/"))).status).toBe(404);
    expect((await sealed(new Request("http://127.0.0.1/pages/biblestudies/"))).status).toBe(301);
  });
});

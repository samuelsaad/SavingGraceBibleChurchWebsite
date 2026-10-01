import { describe, expect, it } from "vitest";
import { publicSermonListQuerySchema, type PublicSermonListQuery } from "../src/api/contracts/public-sermons";
import type { SermonDetail, SermonSummary } from "../src/domain/sermon";
import { emptyFilterOptions, renderPublicSermonArchivePage, renderSermonsV1Page, renderSermonsV4Page } from "../src/frontend";
import { cardGrid, sermonCard } from "../src/frontend/components/cards";
import { previewRenderContext, publicRenderContext, restrictedRenderContext, siteLinks } from "../src/frontend/routes";
import { createAlternateArchiveHandlers } from "../src/server/http/alternate-archives";
import { contentSecurityPolicy } from "../src/server/http/frontend-response";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import { createPublicSermonSiteHandler } from "../src/server/http/public-sermon-page";
import type {
  PaginatedSermons,
  PublicSermonFilterOptions,
  PublicSermonRepository
} from "../src/server/repositories/sermon-repository";

function sermon(index: number, overrides: Partial<SermonSummary> = {}): SermonSummary {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: `An anonymised sermon ${index}`,
    slug: `anonymised-sermon-${index}`,
    serviceDate: `2026-01-${String(Math.min(28, index)).padStart(2, "0")}`,
    summary: "An anonymised approved description that is comfortably longer than eighty characters for the card clamp.",
    speaker: { name: "Example Speaker", slug: "example-speaker" },
    series: [{ name: "Example Series", slug: "example-series" }],
    scriptureReferences: [],
    primaryPassages: [{ displayText: `Romans ${index}:1–4`, isLead: true }],
    primaryPassageState: "assigned",
    books: [{ name: "Romans", slug: "romans" }],
    primaryMedia: null,
    ...overrides
  };
}

const options: PublicSermonFilterOptions = {
  ...emptyFilterOptions,
  speakers: [{ name: "Example Speaker", slug: "example-speaker", sermonCount: 12 }],
  series: [{ name: "Example Series", slug: "example-series", sermonCount: 12 }],
  books: [{ name: "Romans", slug: "romans", sermonCount: 12 }],
  passageVerseAvailability: [{ bookSlug: "romans", chapter: 8, verses: [1, 2, 3, 4] }]
};

class Repository implements PublicSermonRepository {
  lastQuery: PublicSermonListQuery | null = null;
  all = Array.from({ length: 12 }, (_, index) => sermon(12 - index));
  async listPublished(query: PublicSermonListQuery): Promise<PaginatedSermons> {
    this.lastQuery = query;
    const start = (query.page - 1) * query.pageSize;
    return { data: this.all.slice(start, start + query.pageSize), totalItems: this.all.length };
  }
  async findPublishedBySlug(): Promise<SermonDetail | null> { return null; }
  async listPublishedFilterOptions(): Promise<PublicSermonFilterOptions> { return options; }
  async listPublishedTopicalSermons(): Promise<SermonSummary[]> { return []; }
  async listPublishedSeriesRepresentatives() { return []; }
  async listPublishedSitemapEntries() { return []; }
  async findPublicPathDisposition() { return null; }
}

function input(query: Partial<PublicSermonListQuery> = {}, sermons = Array.from({ length: 9 }, (_, index) => sermon(9 - index)), totalItems = 12) {
  return {
    sermons,
    totalItems,
    query: publicSermonListQuerySchema.parse({ page: 1, pageSize: 9, ...query }),
    options,
    topicalSermons: [],
    seriesRepresentatives: [],
    hasQueryParameters: Object.keys(query).length > 0
  };
}

function section(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  return html.slice(from, html.indexOf(end, from));
}

describe("SermonsV4 page", () => {
  it("uses Claude's V4 opening while preserving library data and the complete existing finder", () => {
    const v4 = renderSermonsV4Page(input(), previewRenderContext);
    const v2 = renderPublicSermonArchivePage(input(), previewRenderContext);
    const opening = (html: string) => section(html, '<header class="title-page">', "</section>");
    expect(opening(v4)).toContain('<p class="eyebrow">Sermon archive</p>');
    expect(opening(v4)).toContain('<h1 class="title-page__title">Sermons</h1>');
    expect(opening(v4)).toContain('<ul class="stats" role="list"><li>12 sermons</li><li>1 of 66 books</li><li>1 speaker</li><li>1 series</li></ul>');
    expect(opening(v4)).toContain('<label class="field__label" for="sermon-search">Search sermons</label>');
    expect(opening(v4)).toContain('<label class="field__label" for="speaker-filter">Speaker</label>');
    expect(opening(v4)).toContain('<label class="field__label" for="series-filter">Series</label>');
    expect(opening(v4)).toContain('<details class="refine" data-refine data-active="false">');
    expect(opening(v4)).toContain('<label class="field__label" for="book-filter">Bible book</label>');
    // The existing finder remains identical apart from its V4 destination.
    const finder = (page: string) => section(page, '<section class="finder"', "</section>");
    expect(finder(v4).replace(/\/sermons-v4\/#v4-results/gu, "/sermons/#results")).toBe(finder(v2));
    expect(v4).toContain('action="/frontend-preview/sermons-v4/#v4-results"');
    expect(v4.match(/<h1/gu)).toHaveLength(1);
  });

  it("folds the unchanged bookshelf behind a labelled native disclosure that is closed on first load", () => {
    const html = renderSermonsV4Page(input(), publicRenderContext);
    expect(html).toContain('<details class="fold" id="v4-shelf" data-fold>');
    expect(html).not.toContain('<details class="fold" id="v4-shelf" data-fold open');
    expect(html).toContain('<span class="fold__title" id="v4-shelf-heading">Browse by Bible book</span>');
    expect(html).toContain("1 book with sermons · take one off the shelf");
    expect(html).toContain('<nav class="shelf shelf--settle" aria-labelledby="v4-shelf-heading" data-canon-grid data-escape-to="after-v4-shelf">');
    expect(html.match(/<li class="spine /gu)).toHaveLength(66);
    expect(html).toContain('<a class="spine__link" href="/sermons-v4/?sermon_book=romans#canon">');
    const markup = html.replace(/<script[\s\S]*?<\/script>/gu, "");
    expect(markup).not.toMatch(/<summary\b[^>]*aria-expanded/u);
    expect(markup).not.toContain("tabindex=\"0\"");
    expect(html).toContain("details[data-fold]");
  });

  it("renders the latest sermon as one equal card, flagged once and never repeated among the recent cards", () => {
    const html = renderSermonsV4Page(input(), publicRenderContext);
    const grid = section(html, '<ul class="cards" role="list">', "</ul>");
    expect(grid.match(/<article class="card /gu)).toHaveLength(9);
    expect(grid.match(/card--latest/gu)).toHaveLength(1);
    expect(grid.match(/<span class="card__flag">Latest<span class="sr-only"> sermon\.<\/span><\/span>/gu)).toHaveLength(1);
    expect(grid.match(/anonymised-sermon-9\//gu)).toHaveLength(1);
    expect(grid.indexOf("card--latest")).toBeLessThan(grid.indexOf("anonymised-sermon-8"));
    expect(grid).toContain('<h3 class="card__title"><a href="/sermons/anonymised-sermon-9/">An anonymised sermon 9</a></h3>');
    expect(grid).toContain('<span class="card__group">Pauline Epistles</span>');
    expect(grid).toContain('<span class="card__bookname">Romans</span><span class="card__ref">9:1–4</span>');
    expect(grid).toContain('<a class="card__booklink" href="/sermons/?sermon_book=romans"><span class="sr-only">Book: </span>Romans<span class="sr-only">, Pauline Epistles</span></a>');
    expect(grid).toContain('<span class="sr-only">Preacher: </span><a href="/sermons/?sermon_speaker=example-speaker">Example Speaker</a>');
    expect(grid).toContain('<span class="sr-only">Passage: </span>Romans 9:1–4');
    expect(grid).toContain('<rect class="card__strip-here" x="1046" y="0" width="16" height="8" />');
    expect(grid).not.toContain('class="card__ordinal"');
    expect(html).toContain('href="/sermons-v4/?view=recent#v4-results">Browse all 12 sermons, newest first</a>');
    expect(html).not.toContain('class="entry entry--card');
  });

  it("keeps searching, filtering and paging inside V4 with continuous ordinals and the open book", () => {
    const filtered = renderSermonsV4Page(input({ query: "grace", book: "romans", page: 2 }, [sermon(3), sermon(2), sermon(1)], 12), publicRenderContext);
    expect(filtered).toContain('<p class="eyebrow">Search results</p>');
    expect(filtered).toContain("“grace” · Romans</h1>");
    expect(filtered).toContain('<section class="open-book hue--pauline" id="canon" aria-labelledby="open-book-heading">');
    expect(filtered).toContain('href="/sermons-v4/?s=grace&amp;passageBook=romans&amp;passageChapter=8&amp;passageScope=chapter#canon"');
    expect(filtered).toContain('<a class="open-book__clear" href="/sermons-v4/?s=grace#v4-results">Put the book back</a>');
    expect(filtered).toContain('<section class="results" id="v4-results" tabindex="-1" aria-labelledby="v4-results-heading v4-results-status">');
    expect(filtered).toContain('<ol class="cards results__cards" role="list" start="10">');
    expect(filtered).toContain('<span class="sr-only">Result 10.</span>');
    expect(filtered).toContain('<span class="card__ordinal">10</span>');
    const resultCards = section(filtered, '<ol class="cards results__cards"', "</ol>");
    expect(resultCards).not.toContain("card--latest");
    expect(resultCards).not.toContain("card__flag");
    expect(filtered).toContain('href="/sermons-v4/?sermon_book=romans#v4-results">Search: “grace”');
    expect(filtered).toContain('href="/sermons-v4/?s=grace#v4-results">Book: Romans');
    expect(filtered).toContain('<a class="tokens__clear" href="/sermons-v4/">Clear all</a>');
    expect(filtered).toContain('href="/sermons-v4/?s=grace&amp;sermon_book=romans#v4-results" rel="prev">Previous</a>');
    expect(filtered).not.toContain('href="/sermons/?s=grace');

    const recent = renderSermonsV4Page(input({ view: "recent" }), publicRenderContext);
    expect(recent).toContain('<h2 id="v4-results-heading" class="section__title">All sermons, newest first</h2>');
    expect(recent).toContain("12 sermons · Page 1 of 2");
    expect(recent).toContain('href="/sermons-v4/page/2/#v4-results" rel="next">Next</a>');
    expect(recent).toContain('<a class="results__fewer" href="/sermons-v4/">Back to the latest sermons</a>');
    expect(recent).toContain('<details class="fold" id="v4-shelf" data-fold>');
  });

  it("marks V4 in the Sermons menu while keeping the archive canonical and staying non-indexable", () => {
    const html = renderSermonsV4Page(input(), previewRenderContext);
    const menu = section(html, '<ul class="masthead__dropdown"', "</ul>");
    expect(menu).toContain('<li><a href="/frontend-preview/sermons-v1/">SermonsV1</a></li>');
    expect(menu).toContain('<li><a href="/frontend-preview/sermons/">SermonsV2</a></li>');
    expect(menu).toContain('<li><a href="/frontend-preview/sermons-v4/" data-sermon-archive aria-current="page">SermonsV4</a></li>');
    expect(menu).not.toContain("V3");
    expect(menu.match(/aria-current="page"/gu)).toHaveLength(1);
    expect(html).toContain('class="masthead__menu-toggle is-active"');
    const publicHtml = renderSermonsV4Page(input(), publicRenderContext);
    expect(publicHtml).toContain('<meta name="robots" content="noindex, follow" />');
    expect(publicHtml).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/"');
    expect(publicHtml).toContain('<script data-enhancement="canon">');
    expect(contentSecurityPolicy(publicHtml)).toContain("script-src 'sha256-");
  });

  it("handles missing metadata, topical and unclassified sermons and long titles without hiding the title", () => {
    const links = siteLinks(publicRenderContext);
    const bare = sermonCard(sermon(1, { speaker: null, series: [], primaryPassages: [], books: [], summary: null, title: "A".repeat(74) }), { links, headingLevel: 3 }).toString();
    expect(bare).toContain('class="card card--plain"');
    expect(bare).toContain('<span class="card__group">Not yet shelved</span>');
    expect(bare).toContain('<svg class="card__mark"');
    expect(bare).toContain('class="card__strip card__strip--plain"');
    expect(bare).toContain('<h3 class="card__title is-longest"><a href="/sermons/anonymised-sermon-1/">' + "A".repeat(74) + "</a></h3>");
    expect(bare).not.toContain("card__desc");
    expect(bare).not.toContain("card__meta");
    expect(bare).not.toContain("card__booklink");
    expect(bare).not.toContain("card__bookname");
    const topical = sermonCard(sermon(2, { isTopical: true, books: [] }), { links, headingLevel: 3 }).toString();
    expect(topical).toContain('class="card hue--topical"');
    expect(topical).toContain('<span class="card__group">Topical</span>');
    expect(topical).toContain('<span class="card__bookname">Topical</span>');
    expect(topical).toContain('<span class="card__ref">Romans 2:1–4</span>');
    expect(topical).toContain('<span class="card__booklink card__booklink--plain">Topical</span>');
    const classifiedTopical = sermonCard(sermon(2, { isTopical: true }), { links, headingLevel: 3 }).toString();
    expect(classifiedTopical).toContain('class="card hue--topical"');
    expect(classifiedTopical).toContain('<span class="card__bookname">Romans</span>');
    expect(classifiedTopical).toContain('<a class="card__booklink" href="/sermons/?sermon_book=romans"><span class="sr-only">Book: </span>Romans<span class="sr-only">, Pauline Epistles</span></a>');
    const draft = sermonCard(sermon(3, { reviewState: "draft_awaiting_review" }), { links, headingLevel: 3, latest: true }).toString();
    expect(draft).toContain('<span class="card__pill">Draft · awaiting administrator review</span>');
    expect(draft).toContain('class="card hue--pauline card--latest"');
    const inTitle = sermonCard(sermon(4, { title: "Hope — Romans 4:1-4" }), { links, headingLevel: 3 }).toString();
    expect(inTitle).not.toContain("Passage: ");
    const grid = cardGrid([sermon(5), sermon(6)], { links, headingLevel: 3, ordinalStart: 4 }).toString();
    expect(grid).toContain('<ol class="cards" role="list" start="4">');
    expect(grid).toContain("Result 5.");
  });
});

describe("alternate archive routes", () => {
  it("serves V1 and V4 through the public site handler in public and restricted contexts", async () => {
    const repository = new Repository();
    const route = createPublicSermonSiteHandler(repository, restrictedRenderContext);
    const v4 = await route(new Request("http://127.0.0.1/sermons-v4/?sermon_speaker=example-speaker"));
    expect(v4?.status).toBe(200);
    expect(v4?.headers.get("x-robots-tag")).toContain("noindex");
    const v4Html = await v4!.text();
    expect(v4Html).toContain('<a href="/sermons-v4/" data-sermon-archive aria-current="page">SermonsV4</a>');
    expect(v4Html).toContain('<p class="eyebrow">Sermons by</p>');
    expect(repository.lastQuery).toMatchObject({ speaker: "example-speaker", page: 1, pageSize: 9 });

    const v1 = await route(new Request("http://127.0.0.1/sermons-v1/"));
    expect(v1?.status).toBe(200);
    const v1Html = await v1!.text();
    expect(v1Html).toContain('<h1 id="hero-heading" class="hero__title">Sermons, shelved by Scripture.</h1>');
    expect(v1Html).toContain('<a href="/sermons-v1/" aria-current="page">SermonsV1</a>');
    expect(repository.lastQuery).toMatchObject({ page: 1, pageSize: 50 });
    expect(v1Html).toBe(renderSermonsV1Page({ sermons: repository.all, options, totalItems: 12 }, restrictedRenderContext));

    const publicRoute = createPublicSermonSiteHandler(repository, publicRenderContext);
    const publicV4 = await publicRoute(new Request("http://127.0.0.1/sermons-v4/"));
    expect(publicV4?.status).toBe(200);
    expect(publicV4?.headers.get("x-robots-tag")).toBe("noindex, follow");
    expect(await publicV4!.text()).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/"');
  });

  it("redirects slashless and first-page forms, rejects invalid pages and filters, and 404s beyond the last page", async () => {
    const route = createAlternateArchiveHandlers(new Repository(), publicRenderContext);
    const slashless = await route(new Request("http://127.0.0.1/sermons-v4?s=grace"));
    expect(slashless?.status).toBe(301);
    expect(slashless?.headers.get("location")).toBe("/sermons-v4/?s=grace");
    const first = await route(new Request("http://127.0.0.1/sermons-v4/page/1/?s=grace"));
    expect(first?.status).toBe(301);
    expect(first?.headers.get("location")).toBe("/sermons-v4/?s=grace");
    const second = await route(new Request("http://127.0.0.1/sermons-v4/page/2/"));
    expect(second?.status).toBe(200);
    expect(await second!.text()).toContain('start="10"');
    expect((await route(new Request("http://127.0.0.1/sermons-v4/page/3/")))?.status).toBe(404);
    expect((await route(new Request("http://127.0.0.1/sermons-v4/page/0/")))?.status).toBe(404);
    expect((await route(new Request("http://127.0.0.1/sermons-v4/nowhere/")))?.status).toBe(404);
    expect((await route(new Request("http://127.0.0.1/sermons-v4/?dateFrom=2026-08-09&dateTo=2026-08-02")))?.status).toBe(400);
    expect((await route(new Request("http://127.0.0.1/sermons-v1/page/2/")))?.status).toBe(404);
    expect((await route(new Request("http://127.0.0.1/sermons-v4/", { method: "POST" })))?.status).toBe(405);
    expect(await route(new Request("http://127.0.0.1/sermons/"))).toBeNull();
    expect(await route(new Request("http://127.0.0.1/sermons-v40/"))).toBeNull();
  });

  it("requires the preview session before serving V4 inside the authenticated preview", async () => {
    const repository = new Repository();
    let authorised = false;
    const route = createLocalFrontendPreviewHandler(repository, { authorizes: () => authorised });
    const denied = await route(new Request("http://127.0.0.1/frontend-preview/sermons-v4/"));
    expect(denied?.status).toBe(401);
    expect(repository.lastQuery).toBeNull();
    authorised = true;
    const allowed = await route(new Request("http://127.0.0.1/frontend-preview/sermons-v4/"));
    expect(allowed?.status).toBe(200);
    expect(allowed?.headers.get("cache-control")).toContain("no-store");
    const html = await allowed!.text();
    expect(html).toContain('<div class="preview-band" role="status">');
    expect(html).toContain('action="/frontend-preview/sermons-v4/#v4-results"');
    expect(html).toContain('<a class="spine__link" href="/frontend-preview/sermons-v4/?sermon_book=romans#canon">');
    const redirected = await route(new Request("http://127.0.0.1/frontend-preview/sermons-v4"));
    expect(redirected?.status).toBe(307);
    expect(redirected?.headers.get("location")).toBe("/frontend-preview/sermons-v4/");
  });
});

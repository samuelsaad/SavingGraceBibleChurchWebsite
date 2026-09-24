import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PublicSermonListQuery } from "../src/api/contracts/public-sermons";
import type { SermonDetail, SermonSummary } from "../src/domain/sermon";
import { emptyFilterOptions } from "../src/frontend";
import { createPublicSermonSiteHandler, renderFrontendHomePage } from "../src/server/http/public-sermon-page";
import type {
  PaginatedSermons,
  PublicSermonFilterOptions,
  PublicSermonPathDisposition,
  PublicSermonRepository
} from "../src/server/repositories/sermon-repository";

const summary: SermonSummary = {
  id: "75df2144-b557-50f6-98bd-011cd696bfb9",
  title: "An anonymised public sermon",
  slug: "an-anonymised-public-sermon",
  serviceDate: "2026-08-02",
  summary: "This approved anonymised description gives visitors useful context without exposing any private pilot material.",
  speaker: { name: "Example Speaker", slug: "example-speaker" },
  series: [{ name: "Example Series", slug: "example-series" }],
  scriptureReferences: [{ displayText: "Romans 8:1-4", parseStatus: "exact" }],
  primaryPassages: [{ displayText: "Romans 8:1–4", isLead: true }],
  primaryPassageState: "assigned",
  books: [{ name: "Romans", slug: "romans" }],
  primaryMedia: null
};

const detail: SermonDetail = {
  ...summary,
  seoDescription: null,
  body: null,
  media: [],
  transcript: null,
  questionAnswers: [],
  relatedSermons: []
};

const options: PublicSermonFilterOptions = {
  speakers: [{ name: "Example Speaker", slug: "example-speaker", sermonCount: 10 }],
  series: [{ name: "Example Series", slug: "example-series", sermonCount: 10 }],
  passages: [{ name: "Romans 8:1-4", slug: "romans-8-1-4" }],
  books: [{ name: "Romans", slug: "romans", sermonCount: 10 }],
  passageVerseAvailability: [{ bookSlug: "romans", chapter: 8, verses: [1, 2, 3, 4] }]
};

class SiteRepository implements PublicSermonRepository {
  lastQuery: PublicSermonListQuery | null = null;
  totalItems = 10;
  disposition: PublicSermonPathDisposition | null = null;
  data: SermonSummary[] = [summary];
  topicalSermons: SermonSummary[] = [];

  async listPublished(query: PublicSermonListQuery): Promise<PaginatedSermons> {
    this.lastQuery = query;
    return { data: this.data, totalItems: this.totalItems };
  }

  async findPublishedBySlug(slug: string): Promise<SermonDetail | null> {
    return slug === detail.slug ? detail : null;
  }

  async listPublishedFilterOptions(): Promise<PublicSermonFilterOptions> {
    return options;
  }

  async listPublishedTopicalSermons(): Promise<SermonSummary[]> { return this.topicalSermons; }
  async listPublishedSeriesRepresentatives() { return [{ series: options.series[0]!, sermon: summary }]; }

  async listPublishedSitemapEntries() {
    return [{ slug: summary.slug, lastModified: "2026-08-02" }];
  }

  async findPublicPathDisposition(): Promise<PublicSermonPathDisposition | null> {
    return this.disposition;
  }
}

function hash(source: string): string {
  return `'sha256-${createHash("sha256").update(source).digest("base64")}'`;
}

function section(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  return html.slice(from, html.indexOf(end, from));
}

describe("public sermon site routes", () => {
  it("renders stable paginated search and combined filters with accessible controls", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);
    const response = await route(new Request(
      "http://localhost/sermons/page/2/?s=grace&sermon_speaker=example-speaker&sermon_series=example-series&sermon_topics=romans-8-1-4&sermon_book=romans&dateFrom=2026-08-01&dateTo=2026-08-31&order=ASC"
    ));
    const html = await response!.text();

    expect(response?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({
      query: "grace",
      speaker: "example-speaker",
      series: "example-series",
      passage: "romans-8-1-4",
      book: "romans",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      order: "ASC",
      page: 2,
      pageSize: 9
    });
    expect(html).toContain('<meta name="robots" content="noindex, follow"');
    expect(html).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/page/2/"');
    expect(html).toContain('<p class="eyebrow">Search results</p>');
    expect(html).toContain("“grace” · Example Speaker · Example Series · Romans · Romans 8:1-4</h1>");
    expect(html).toContain('<label class="field__label" for="sermon-search">Search sermons</label>');
    expect(html).toContain('<label class="field__label" for="speaker-filter">Speaker</label>');
    expect(html).toContain('<label class="field__label" for="series-filter">Series</label>');
    expect(html).toContain('<label class="field__label" for="book-filter">Bible book</label>');
    expect(html).toContain('<option value="example-speaker" selected>Example Speaker (10)</option>');
    expect(html).toContain('<details class="refine" data-refine data-active="true" open>');
    expect(html).toContain('<span class="refine__badge">5 filters active</span>');
    expect(html.replace(/<script[\s\S]*?<\/script>/gu, "")).not.toContain("aria-expanded");
    expect(html).toContain('<section class="results" id="results" tabindex="-1" aria-labelledby="results-heading results-status">');
    expect(html).toContain('<h2 id="results-heading" class="section__title">Sermons</h2>');
    expect(html).toContain('<span class="results__status" id="results-status">10 sermons · Page 2 of 2</span>');
    expect(html).toContain('<ol class="catalogue results__list" role="list" start="10">');
    expect(html).toContain('aria-label="Active filters"');
    expect(html).toContain('<a class="tokens__clear" href="/sermons/">Clear all</a>');
    const masthead = section(html, '<header class="masthead"', "</header>");
    expect(masthead).toContain('<ul class="masthead__links"><li><a href="/">Home</a></li><li class="masthead__links-menu"><details class="masthead__menu" data-menu>');
    expect(masthead).toContain('<li class="masthead__links-sermons"><a href="/sermons/" aria-current="page">Sermons</a></li>');
    expect(masthead).toContain('<li><a href="/events/">News &amp; Events</a></li><li><a href="/contact/">Contact Us</a></li></ul>');
    expect(masthead).toContain('aria-controls="menu-about"');
    expect(masthead).toContain('<li class="masthead__dropdown-sub"><a href="/what-we-teach/the-gospel/">The Gospel</a></li>');
    expect(masthead).not.toContain("/speakers/");
    expect(masthead).not.toContain("SermonsV");
    expect(masthead).not.toContain("masthead__search");
    expect(masthead).toContain('<a class="button masthead__give" href="/support-saving-grace-church-offering/">Give</a>');
    expect(html).not.toContain("<details class=\"book-details\"");
    expect(html).toContain(encodeURIComponent(summary.slug));
    expect(html).not.toContain('id="transcript-heading"');
    expect(html).not.toContain('id="topical-heading"');
  });

  it("offers one removable token per active filter that drops only that parameter", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const response = await route(new Request(
      "http://localhost/sermons/?sermon_speaker=example-speaker&sermon_series=example-series&order=ASC"
    ));
    const html = await response!.text();
    expect(html).toContain('href="/sermons/?sermon_series=example-series&amp;order=ASC#results">Speaker: Example Speaker');
    expect(html).toContain('href="/sermons/?sermon_speaker=example-speaker&amp;order=ASC#results">Series: Example Series');
    expect(html).toContain('href="/sermons/?sermon_speaker=example-speaker&amp;sermon_series=example-series#results">Oldest first');
    expect(html).toContain('<span class="sr-only">, remove this filter</span>');
    expect(html).toContain('<a class="tokens__clear" href="/sermons/">Clear all</a>');
  });

  it("reopens the extra filters for active values and preserves them through server URLs", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const response = await route(new Request(
      "http://localhost/sermons/?dateFrom=2026-08-01&order=ASC"
    ));
    const html = await response!.text();

    expect(html).toContain('data-active="true" open');
    expect(html).toContain('name="dateFrom" type="date" value="2026-08-01"');
    expect(html).toContain('<option value="ASC" selected>Oldest first</option>');
    expect(html).toContain('<script data-enhancement="canon">');
    expect(html).toContain("dateFrom=2026-08-01&amp;order=ASC");
    expect(html).toContain('action="/sermons/#results"');
    expect(html).toContain('<p class="eyebrow">Search results</p>');
    expect(html).toContain("Sermons by service date</h1>");
  });

  it("treats punctuation-only search as a safe browse and rejects invalid dates", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);
    const punctuation = await route(new Request("http://localhost/sermons/?s=---%20%7C%20!!!"));
    expect(punctuation?.status).toBe(200);
    expect(repository.lastQuery?.query).toBeUndefined();

    const invalid = await route(new Request(
      "http://localhost/sermons/?dateFrom=2026-08-09&dateTo=2026-08-02"
    ));
    expect(invalid?.status).toBe(400);
    expect(await invalid!.text()).toContain("Check the sermon filters");
  });

  it("opens the book for a shareable primary-passage search independently of legacy Scripture filters", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);
    const response = await route(new Request(
      "http://localhost/sermons/?s=faith&sermon_topics=legacy-topic&passageBook=romans&passageChapter=8&passageVerse=1&passageScope=verse"
    ));
    const html = await response!.text();
    expect(response?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({
      query: "faith",
      passage: "legacy-topic",
      passageBook: "romans",
      passageChapter: 8,
      passageVerse: 1,
      passageScope: "verse"
    });
    expect(html).toContain('<p class="eyebrow">Preached from</p>');
    expect(html).toContain('<section class="open-book hue--pauline" id="canon" aria-labelledby="open-book-heading">');
    expect(html).toContain('<h2 class="open-book__title" id="open-book-heading">Romans 8:1</h2>');
    expect(html).toContain('<input type="hidden" name="passageBook" value="romans" />');
    expect(html).toContain('<input type="hidden" name="passageChapter" value="8" />');
    expect(html).toContain('<input type="hidden" name="passageVerse" value="1" />');
    expect(html).toContain('<input type="hidden" name="passageScope" value="verse" />');
    expect(html).not.toContain('id="book-filter"');
    expect(html.match(/<span class="sr-only">Chapter \d+/gu)).toHaveLength(16);
    expect(html.match(/<span class="sr-only">Verse \d+/gu)).toHaveLength(39);
    expect(html).toContain('<span class="sr-only">Chapter 8, has sermons, current search</span>');
    expect(html).toContain('<span class="sr-only">Verse 1, has sermons, current search</span>');
    expect(html).toContain('<span class="sr-only">Verse 5</span>');
    expect(html).toContain("passageChapter=3&amp;passageScope=chapter#canon\"");
    expect(html).toContain("sermon_topics=legacy-topic&amp;passageBook=romans");
    expect(html).toContain("Search all of Romans</a>");
    expect(html).toContain('<a class="open-book__clear" href="/sermons/?s=faith&amp;sermon_topics=legacy-topic#results">Put the book back</a>');
    expect(html).toContain("Passage: Romans 8:1");
    expect(html).toContain("Reference: legacy-topic");
    expect(html).toContain("“faith” · Romans 8:1 · legacy-topic</h1>");
    expect(html).toContain('<h2 id="results-heading" class="section__title">Sermons</h2>');
    expect(response?.headers.get("content-security-policy")).toContain("script-src 'sha256-");
  });

  it("renders every shelf spine and ruler cell as a working link with no server-side tab-index trap", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const filtered = await route(new Request("http://localhost/sermons/?sermon_speaker=example-speaker"));
    const html = await filtered!.text();
    const shelf = section(html, '<nav class="shelf"', "</nav>");

    expect(html).toContain('<details class="book-details"><summary class="book-details__summary">Choose a Bible book</summary>');
    expect(shelf.match(/<li class="spine /gu)).toHaveLength(66);
    expect(shelf).toContain('<a class="spine__link" href="/sermons/?sermon_speaker=example-speaker&amp;sermon_book=romans#canon">');
    expect(shelf).toContain('<li class="spine spine--genesis spine--law" data-len="mid"><span class="spine__ghost" aria-hidden="true">');
    expect(shelf).toContain("preached from 1 of the 66 books: Romans (10).");
    expect(shelf).not.toContain("tabindex");
    expect(shelf).not.toContain("aria-pressed");
    expect(shelf).toContain('data-canon-grid data-escape-to="results"');
    expect(shelf).toContain('<a class="shelf__skip" href="#results">Skip the bookshelf</a>');

    const book = await route(new Request("http://localhost/sermons/?sermon_book=romans"));
    const bookHtml = await book!.text();
    expect(bookHtml).toContain('<p class="eyebrow">Sermons filed under</p>');
    expect(bookHtml).toContain('<h2 class="open-book__title" id="open-book-heading">Romans</h2>');
    expect(bookHtml).toContain('<span class="tab hue--pauline"><span class="tab__name" aria-hidden="true">Romans</span><span class="tab__count" aria-hidden="true">10</span>');
    expect(bookHtml).toContain('href="/sermons/?passageBook=romans&amp;passageScope=book#canon">Search all of Romans</a>');
    expect(bookHtml.match(/<span class="sr-only">Chapter \d+/gu)).toHaveLength(16);
    expect(bookHtml).toContain('<span class="sr-only">Chapter 8, has sermons</span>');
    expect(bookHtml).not.toContain("Verses of");
    expect(bookHtml).toContain('href="/sermons/?passageBook=romans&amp;passageChapter=8&amp;passageScope=chapter#canon"');
    expect(bookHtml).toContain('<a class="open-book__clear" href="/sermons/#results">Put the book back</a>');
    expect(bookHtml).toContain("Romans</h1>");
  });

  it("renders the discovery view with the shelf, exactly three latest sermons newest first and fail-closed sections", async () => {
    const repository = new SiteRepository();
    repository.totalItems = 4;
    repository.data = [
      { ...summary, id: "11111111-1111-4111-8111-111111111111", slug: "recent-one", serviceDate: "2026-08-04" },
      { ...summary, id: "22222222-2222-4222-8222-222222222222", slug: "recent-two", serviceDate: "2026-08-03" },
      { ...summary, id: "33333333-3333-4333-8333-333333333333", slug: "recent-three", serviceDate: "2026-08-02" },
      { ...summary, id: "44444444-4444-4444-8444-444444444444", slug: "older-four", serviceDate: "2026-08-01" }
    ];
    const route = createPublicSermonSiteHandler(repository);
    const response = await route(new Request("http://localhost/sermons/"));
    const html = await response!.text();

    expect(html).toContain('<h1 class="title-page__title">Sermons</h1>');
    expect(html).toContain('<ul class="stats" role="list"><li>4 sermons</li><li>1 of 66 books</li><li>1 speaker</li><li>1 series</li></ul>');
    expect(html).toContain('<h2 id="shelf-heading" class="section__title">By Bible book</h2>');
    expect(html).toContain('<nav class="shelf shelf--settle" aria-labelledby="shelf-heading" data-canon-grid data-escape-to="after-shelf">');
    expect(html).toContain('<a class="spine__link" href="/sermons/?sermon_book=romans#canon">');
    expect(html).toContain('<h2 id="latest-heading" class="section__title">Latest sermons</h2>');
    expect(html).toContain('href="/sermons/?view=recent#results">Browse all 4 sermons, newest first</a>');
    expect(html.match(/<article class="entry entry--card/gu)).toHaveLength(3);
    expect(html.indexOf("recent-one")).toBeLessThan(html.indexOf("recent-two"));
    expect(html.indexOf("recent-two")).toBeLessThan(html.indexOf("recent-three"));
    expect(html).not.toContain("older-four");
    expect(html).toContain('<h2 id="speakers-heading" class="section__title">By speaker</h2>');
    expect(html).toContain('<a class="chip" href="/sermons/?sermon_speaker=example-speaker#results">Example Speaker<span class="chip__count">10</span></a>');
    expect(html).toContain('<a class="chip" href="/sermons/?sermon_series=example-series#results">Example Series<span class="chip__count">10</span></a>');
    expect(html).not.toContain('id="topical-heading"');
    expect(html).not.toContain('id="results"');
    expect(html).not.toContain("autoplay");
    const primaryRow = section(html, '<div class="finder__row">', '<details class="refine"');
    expect(primaryRow.match(/<label /gu)).toHaveLength(3);
    expect(primaryRow).toContain('<button class="button" type="submit">Search</button>');
    expect(html).toContain('<details class="refine" data-refine data-active="false">');
    expect(html).not.toContain('data-active="false" open');
    expect(html).toContain('<meta name="robots" content="index, follow"');
    expect(html).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/"');
  });

  it("shows only repository-declared topical sermons and never infers them from no-primary state", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);
    const empty = await route(new Request("http://localhost/sermons/"));
    expect(await empty!.text()).not.toContain('id="topical-heading"');

    repository.topicalSermons = [summary];
    const explicit = await route(new Request("http://localhost/sermons/"));
    const html = await explicit!.text();
    expect(html).toContain('<h2 id="topical-heading" class="section__title">Topical sermons</h2>');
  });

  it("preserves expanded recent pagination in URLs, numbers the archive continuously and hides discovery", async () => {
    const repository = new SiteRepository();
    repository.totalItems = 19;
    const route = createPublicSermonSiteHandler(repository);
    const response = await route(new Request("http://localhost/sermons/?view=recent"));
    const html = await response!.text();

    expect(repository.lastQuery).toMatchObject({ view: "recent", page: 1, pageSize: 9, order: "DESC" });
    expect(html).toContain('<a class="results__fewer" href="/sermons/">Back to the shelf</a>');
    expect(html).toContain('<h2 id="results-heading" class="section__title">All sermons, newest first</h2>');
    expect(html).toContain("19 sermons · Page 1 of 3");
    expect(html).toContain('href="/sermons/page/2/#results"');
    expect(html).toContain('<ol class="catalogue results__list" role="list" start="1">');
    expect(html).not.toContain('id="topical-heading"');
    expect(html).not.toContain('id="latest-heading"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('rel="next"');
    expect(html).not.toContain('rel="prev"');
    expect(html).toContain('<nav class="pagination" aria-label="Sermon result pages">');

    const second = await route(new Request("http://localhost/sermons/page/2/"));
    const secondHtml = await second!.text();
    expect(secondHtml).toContain('<ol class="catalogue results__list" role="list" start="10">');
    expect(secondHtml).toContain('rel="prev"');
    expect(secondHtml).toContain('href="/sermons/?view=recent#results"');
    expect(secondHtml).toContain("Back to the shelf");
  });

  it("rejects contradictory broad-book and exact-passage filters", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const response = await route(new Request(
      "http://localhost/sermons/?sermon_book=romans&passageBook=john"
    ));
    expect(response?.status).toBe(400);
  });

  it("returns useful empty and out-of-range states without private details", async () => {
    const repository = new SiteRepository();
    repository.totalItems = 0;
    repository.listPublished = async (query) => {
      repository.lastQuery = query;
      return { data: [], totalItems: 0 };
    };
    const route = createPublicSermonSiteHandler(repository);
    const empty = await route(new Request("http://localhost/sermons/?sermon_series=not-present"));
    expect(empty?.status).toBe(200);
    const emptyHtml = await empty!.text();
    expect(emptyHtml).toContain("No published sermons matched");
    expect(emptyHtml).toContain('<a class="button button--outline" href="/sermons/">Show all sermons</a>');

    const landing = await route(new Request("http://localhost/sermons/"));
    const landingHtml = await landing!.text();
    expect(landingHtml).toContain("No sermons are available yet.");
    expect(landingHtml).not.toContain("Browse all");

    const missingPage = await route(new Request("http://localhost/sermons/page/2/"));
    expect(missingPage?.status).toBe(404);
    const missingHtml = await missingPage!.text();
    expect(missingHtml).toContain("That sermon archive page does not exist");
    expect(missingHtml).not.toContain("Private Draft Transcript");
    expect(missingHtml).not.toContain("Pending Sermon Title");
  });

  it("derives the Content-Security-Policy from exactly the scripts and styles it embeds", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const archive = await route(new Request("http://localhost/sermons/"));
    const archiveHtml = await archive!.text();
    const csp = archive!.headers.get("content-security-policy")!;
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("frame-src");
    expect(archiveHtml.match(/<script /gu)).toHaveLength(2);
    for (const match of archiveHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu)) {
      expect(csp).toContain(hash(match[1]!));
      expect(() => new Function(match[1]!)).not.toThrow();
    }
    for (const match of archiveHtml.matchAll(/<style>([\s\S]*?)<\/style>/gu)) expect(csp).toContain(hash(match[1]!));

    const boundary = await route(new Request("http://localhost/sermons/not-a-real-sermon/"));
    const boundaryCsp = boundary!.headers.get("content-security-policy")!;
    expect(boundary?.status).toBe(404);
    expect(boundaryCsp).toContain("script-src 'sha256-");
    expect(boundaryCsp).toContain("style-src 'sha256-");
  });

  it("serves only repository-approved sermon sitemap entries", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const response = await route(new Request("http://localhost/sitemap-sermons.xml"));
    const xml = await response!.text();

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("application/xml");
    expect(xml).toContain("https://www.savinggrace.org.au/sermons/");
    expect(xml).toContain(summary.slug);
    expect(xml).not.toContain("pending");
    expect(xml).not.toContain("draft");
  });

  it("serves only authenticated internal redirect or gone dispositions", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);

    repository.disposition = { kind: "redirect", location: `/sermons/${summary.slug}/` };
    const redirected = await route(new Request("http://localhost/sermons/retired-sermon/"));
    expect(redirected?.status).toBe(301);
    expect(redirected?.headers.get("location")).toBe(`/sermons/${summary.slug}/`);

    repository.disposition = { kind: "gone" };
    const gone = await route(new Request("http://localhost/sermons/deleted-sermon/"));
    expect(gone?.status).toBe(410);
    expect(await gone!.text()).toContain('content="noindex, nofollow"');

    repository.disposition = null;
    const missing = await route(new Request("http://localhost/sermons/private-sermon/"));
    expect(missing?.status).toBe(404);
    expect(await missing!.text()).toContain("not publicly available");
  });

  it("normalizes trailing slashes without querying sermon data", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);
    const response = await route(new Request("http://localhost/sermons?page=2"));
    expect(response?.status).toBe(301);
    expect(response?.headers.get("location")).toBe("/sermons/?page=2");
    expect(repository.lastQuery).toBeNull();
  });

  it("normalizes the duplicate first pagination route to the archive root", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);
    const response = await route(new Request("http://localhost/sermons/page/1/?order=ASC"));

    expect(response?.status).toBe(301);
    expect(response?.headers.get("location")).toBe("/sermons/?order=ASC");
    expect(repository.lastQuery).toBeNull();
  });

  it("renders the sermon page with the shelf projection loaded alongside the detail", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const response = await route(new Request(`http://localhost/sermons/${summary.slug}/`));
    const html = await response!.text();
    expect(response?.status).toBe(200);
    expect(html).toContain('<a class="tab hue--pauline" href="/sermons/?passageBook=romans&amp;passageScope=book#canon">');
    expect(html).toContain('<span class="tab__count" aria-hidden="true">10</span>');
    expect(html).toContain('<p class="strip__label">Romans on the shelf</p>');
    expect(response?.headers.get("content-security-policy")).not.toContain("frame-src");
  });

  it("renders an honest static home without invented branding", () => {
    const html = renderFrontendHomePage({ sermons: [], options: emptyFilterOptions, totalItems: 0, today: "2026-09-24" });
    expect(html).toContain('<h1 id="hero-heading" class="arrive__title"><span class="arrive__name">Saving Grace</span><span class="arrive__name">Bible Church</span></h1>');
    expect(html).toContain("No sermon is available yet. Please check back soon.");
    expect(html).toContain("No sermon is available yet. Please check back soon.");
    expect(html).toContain('<a class="brand" href="/">');
    expect(html).not.toContain('<article class="card');
    expect(html).not.toContain('class="spine');
    expect(html).toContain("Welcome to Saving Grace Bible Church");
    expect(html).not.toContain("Scripture for faith and life");
    expect(html).not.toContain("Built around the sermon");
    expect(html.match(/<h1/gu)).toHaveLength(1);
    expect(html).toContain('<meta name="robots" content="index, follow"');
    expect(html).toContain("<title>Saving Grace Bible Church</title>");
  });
});

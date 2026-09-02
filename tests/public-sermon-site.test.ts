import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PublicSermonListQuery } from "../src/api/contracts/public-sermons";
import type { SermonDetail, SermonSummary } from "../src/domain/sermon";
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
  speakers: [{ name: "Example Speaker", slug: "example-speaker" }],
  series: [{ name: "Example Series", slug: "example-series" }],
  passages: [{ name: "Romans 8:1-4", slug: "romans-8-1-4" }],
  books: [{ name: "Romans", slug: "romans" }],
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
  return html.slice(html.indexOf(start), html.indexOf(end));
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
    expect(html).toContain('<label class="field__label" for="sermon-search">Search</label>');
    expect(html).toContain('<label class="field__label" for="speaker-filter">Speaker</label>');
    expect(html).toContain('<label class="field__label" for="book-filter">Bible book</label>');
    expect(html).toContain('<label class="field__label" for="series-filter">Series</label>');
    expect(html).toContain('<span class="disclosure__label">Advanced search</span>');
    expect(html).toContain('data-advanced-search data-active="true" open');
    expect(html).toContain('<span class="disclosure__badge">4 filters active</span>');
    expect(html).toContain('id="sermon-results" tabindex="-1" aria-labelledby="sermon-results-heading sermon-results-status"');
    expect(html).toContain('aria-label="Active filters"');
    expect(html).toContain("Clear all filters");
    expect(html).toContain('<h2 id="sermon-results-heading">Filtered sermons</h2>');
    const desktopNavigation = section(html, '<nav class="site-nav"', '<details class="site-menu"');
    expect(desktopNavigation).toContain('<li><a href="/">Home</a></li><li><a href="/sermons/" aria-current="page">Sermons</a></li>');
    expect(desktopNavigation).not.toContain("data-nav-disclosure");
    expect(desktopNavigation).not.toContain("/speakers/");
    expect(html).not.toContain('data-enhancement="navigation"');
    expect(html).toContain(encodeURIComponent(summary.slug));
    expect(html).not.toContain('id="transcript-heading"');
    expect(html).not.toContain('id="topical-sermons-heading"');
    expect(html).not.toContain('id="series-sermons-heading"');
  });

  it("offers one removable token per active filter that drops only that parameter", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const response = await route(new Request(
      "http://localhost/sermons/?sermon_speaker=example-speaker&sermon_series=example-series&order=ASC"
    ));
    const html = await response!.text();
    expect(html).toContain('href="/sermons/?sermon_series=example-series&amp;order=ASC#sermon-results">Speaker: Example Speaker');
    expect(html).toContain('href="/sermons/?sermon_speaker=example-speaker&amp;order=ASC#sermon-results">Series: Example Series');
    expect(html).toContain('href="/sermons/?sermon_speaker=example-speaker&amp;sermon_series=example-series#sermon-results">Oldest first');
    expect(html).toContain('<span class="sr-only">, remove this filter</span>');
    expect(html).toContain('<a class="filter-tokens__clear" href="/sermons/">Clear all filters</a>');
  });

  it("reopens advanced search for active values and preserves them through server URLs", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const response = await route(new Request(
      "http://localhost/sermons/?dateFrom=2026-08-01&order=ASC"
    ));
    const html = await response!.text();

    expect(html).toContain('data-active="true" open');
    expect(html).toContain('name="dateFrom" type="date" value="2026-08-01"');
    expect(html).toContain('<option value="ASC" selected>Oldest first</option>');
    expect(html).toContain('data-enhancement="archive"');
    expect(html).toContain("dateFrom=2026-08-01&amp;order=ASC");
    expect(html).toContain('action="/sermons/#sermon-results"');
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

  it("renders a shareable primary-passage browser independently of legacy Scripture filters", async () => {
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
    expect(html).toContain("Browse by Bible passage");
    expect(html).toContain('data-passage-disclosure data-active="true" open');
    expect(html).toContain('<span class="disclosure__badge">Romans 8:1</span>');
    expect(html).toContain('id="passage-book" name="passageBook" type="hidden" value="romans"');
    expect(html).toContain('id="passage-chapter" name="passageChapter" type="hidden" value="8"');
    expect(html).toContain('id="passage-verse" name="passageVerse" type="hidden" value="1"');
    expect(html).toContain('id="passage-scope" name="passageScope" type="hidden" value="verse"');
    expect(html).toContain('data-bible-picker data-depth="verse"');
    expect(html.match(/data-book-tile data-book=/gu)).toHaveLength(66);
    expect(html).toContain('data-book="romans"');
    expect(html).toContain('data-verse-counts="32,29,31,25,21,23,25,39,33,21,36,21,14,23,33,27"');
    expect(html).toContain('data-book="romans" data-book-name="Romans" data-chapters="16"');
    expect(html).toContain(', Romans, Pauline Epistles, current search</span>');
    expect(html).toContain('aria-current="true"');
    expect(html.match(/data-chapter-tile data-chapter=/gu)).toHaveLength(16);
    expect(html.match(/data-verse-tile data-verse=/gu)).toHaveLength(39);
    expect(html).toContain("Search all of Romans<");
    expect(html).toContain("Search all of Romans 8<");
    expect(html).toContain("Current passage search:");
    expect(html).toContain("(exact verse)");
    expect(html).toContain("Passage: Romans 8:1");
    expect(html).toContain("Clear passage");
    expect(html).toContain("sermon_topics=legacy-topic");
    expect(html).toContain("passageScope=verse");
    expect(html).toContain('<h2 id="sermon-results-heading">Filtered sermons</h2>');
    expect(response?.headers.get("content-security-policy")).toContain("script-src 'sha256-");
  });

  it("renders every picker control as a working link with no server-side tab-index trap", async () => {
    const route = createPublicSermonSiteHandler(new SiteRepository());
    const response = await route(new Request("http://localhost/sermons/?sermon_speaker=example-speaker"));
    const html = await response!.text();
    const picker = section(html, '<div class="passage-picker"', 'data-passage-announcement');

    expect(html).toContain('data-bible-picker data-depth="book" data-mobile-panel="book"');
    expect(html.match(/data-book-tile data-book=/gu)).toHaveLength(66);
    expect(picker).toContain('href="/sermons/?sermon_speaker=example-speaker&amp;passageBook=genesis&amp;passageScope=book#sermon-results"');
    expect(picker).toContain('<span class="bible-tile__label">Ge</span><span class="sr-only">, Genesis, Law / Pentateuch</span>');
    expect(picker).toContain('<span class="bible-tile__label">Re</span><span class="sr-only">, Revelation, Revelation</span>');
    expect(picker).not.toContain("tabindex");
    expect(picker).not.toContain("aria-pressed");
    expect(picker).toContain('class="bible-tile bible-tile--law"');
    expect(picker).toContain('class="bible-tile bible-tile--gospels-acts"');
    expect(picker).toContain('data-chapters-panel hidden');
    expect(picker).toContain('data-verses-panel hidden');
    expect(picker).toContain('aria-disabled="true" data-search-whole-book>Search a whole book</a>');
    expect(picker).toContain('aria-disabled="true" data-search-whole-chapter>Search a whole chapter</a>');
    expect(picker).toContain('<summary aria-expanded="false">Book colour key</summary>');
    expect(picker).toContain('role="group" aria-labelledby="bible-books-heading" aria-describedby="passage-picker-hint"');
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true" data-passage-announcement');
    expect(html).toContain('data-passage-disclosure data-active="false"');
    expect(html).not.toContain('data-passage-disclosure data-active="false" open');
  });

  it("renders exactly three recent sermons newest first and fail-closed discovery sections by default", async () => {
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

    expect(html).toContain("Most Recent Sermons");
    expect(html.match(/class="sermon-item sermon-item--recent"/gu)).toHaveLength(3);
    expect(html.indexOf("recent-one")).toBeLessThan(html.indexOf("recent-two"));
    expect(html.indexOf("recent-two")).toBeLessThan(html.indexOf("recent-three"));
    expect(html).not.toContain("older-four");
    expect(html).toContain('href="/sermons/?view=recent#sermon-results">Show more recent sermons</a>');
    expect(html).toContain("4 sermons · 1 speaker · 1 series");
    expect(html).toContain('id="topical-sermons-heading">Topical Sermons</h2>');
    expect(html).toContain("Topical sermons will appear here once an approved topical classification exists");
    expect(html).not.toContain('id="topical-sermons-track"');
    expect(html).toContain('id="series-sermons-track" role="list" aria-label="Series"');
    expect(html).toContain("Show previous series");
    expect(html).toContain("Show more series");
    expect(html).toContain('<h3 class="series-card__name"><a href="/sermons/?sermon_series=example-series">Example Series</a></h3>');
    expect(html).not.toContain("autoplay");
    const primaryRow = section(html, '<div class="find-sermons__row">', '<div class="find-sermons__disclosures">');
    expect(primaryRow.match(/<label /gu)).toHaveLength(4);
    expect(primaryRow).toContain('<button class="button" type="submit">Search</button>');
    expect(html).toContain('data-advanced-search data-active="false"');
    expect(html).not.toContain('data-active="false" open');
    expect(html).toContain('<meta name="robots" content="index, follow"');
  });

  it("shows only repository-declared topical sermons and never infers them from no-primary state", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);
    const empty = await route(new Request("http://localhost/sermons/"));
    expect(await empty!.text()).not.toContain('id="topical-sermons-track"');

    repository.topicalSermons = [summary];
    const explicit = await route(new Request("http://localhost/sermons/"));
    const html = await explicit!.text();
    expect(html).toContain('id="topical-sermons-track"');
    expect(html).toContain("Show previous topical sermons");
  });

  it("preserves expanded recent pagination in URLs, numbers the archive continuously and hides discovery", async () => {
    const repository = new SiteRepository();
    repository.totalItems = 19;
    const route = createPublicSermonSiteHandler(repository);
    const response = await route(new Request("http://localhost/sermons/?view=recent"));
    const html = await response!.text();

    expect(repository.lastQuery).toMatchObject({ view: "recent", page: 1, pageSize: 9, order: "DESC" });
    expect(html).toContain("Show fewer recent sermons");
    expect(html).toContain('<h2 id="sermon-results-heading">All sermons</h2>');
    expect(html).toContain("19 sermons · Page 1 of 3");
    expect(html).toContain('/sermons/page/2/#sermon-results');
    expect(html).toContain('<ol class="sermon-list" role="list" start="1">');
    expect(html).not.toContain('id="topical-sermons-heading"');
    expect(html).not.toContain('id="series-sermons-heading"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('rel="next"');
    expect(html).not.toContain('rel="prev"');

    const second = await route(new Request("http://localhost/sermons/page/2/"));
    const secondHtml = await second!.text();
    expect(secondHtml).toContain('<ol class="sermon-list" role="list" start="10">');
    expect(secondHtml).toContain('rel="prev"');
    expect(secondHtml).toContain("Show fewer recent sermons");
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
    expect(await empty!.text()).toContain("No published sermons matched");

    const landing = await route(new Request("http://localhost/sermons/"));
    const landingHtml = await landing!.text();
    expect(landingHtml).toContain("No sermons are available yet.");
    expect(landingHtml).not.toContain("Show more recent sermons");

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
    for (const match of archiveHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu)) {
      expect(csp).toContain(hash(match[1]!));
      expect(() => new Function(match[1]!)).not.toThrow();
    }
    for (const match of archiveHtml.matchAll(/<style>([\s\S]*?)<\/style>/gu)) expect(csp).toContain(hash(match[1]!));

    const boundary = await route(new Request("http://localhost/sermons/not-a-real-sermon/"));
    const boundaryCsp = boundary!.headers.get("content-security-policy")!;
    expect(boundary?.status).toBe(404);
    expect(boundaryCsp).not.toContain("script-src");
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

  it("renders an honest static home without invented branding", () => {
    const html = renderFrontendHomePage({ sermons: [], series: [] });
    expect(html).toContain("<h1>Sermon library</h1>");
    expect(html).toContain("Sermons are being prepared");
    expect(html).toContain('<a class="wordmark" href="/">Saving Grace Bible Church</a>');
    expect(html).not.toContain("brand-mark");
    expect(html).not.toContain("Scripture for faith and life");
    expect(html).not.toContain("Built around the sermon");
    expect(html.match(/<h1/gu)).toHaveLength(1);
    expect(html).toContain('<meta name="robots" content="index, follow"');
  });
});

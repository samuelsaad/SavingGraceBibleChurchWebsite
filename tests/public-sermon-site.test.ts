import { describe, expect, it } from "vitest";
import type { PublicSermonListQuery } from "../src/api/contracts/public-sermons";
import type { SermonDetail, SermonSummary } from "../src/domain/sermon";
import { createPublicSermonSiteHandler } from "../src/server/http/public-sermon-page";
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
    expect(html).toContain('<label for="sermon-search">Search</label>');
    expect(html).toContain('<label for="speaker-filter">Speaker</label>');
    expect(html).toContain('<label for="book-filter">Bible book</label>');
    expect(html).toContain('<label for="series-filter">Series</label>');
    expect(html).toContain('<summary>Advanced search</summary>');
    expect(html).toContain('data-active="true" open');
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain("Active filters");
    expect(html).toContain("Clear all filters");
    expect(html).toContain("@media (max-width:38rem)");
    expect(html).toContain(encodeURIComponent(summary.slug));
    expect(html).not.toContain('id="transcript-heading"');
    expect(html).not.toContain('id="topical-sermons-heading"');
    expect(html).not.toContain('id="series-sermons-heading"');
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
    expect(html).toContain("window.addEventListener('pageshow'");
    expect(html).toContain("advanced.open=true");
    expect(html).toContain("resetChapterAndVerse");
    expect(html).toContain("resetVerse");
    expect(html).toContain("dateFrom=2026-08-01&amp;order=ASC");
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

  it("renders a shareable mobile-friendly primary-passage browser independently of legacy Scripture filters", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);
    const response = await route(new Request(
      "http://localhost/sermons/?s=faith&sermon_topics=legacy-topic&passageBook=romans&passageChapter=8&passageVerse=1&passageEndVerse=4"
    ));
    const html = await response!.text();
    expect(response?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({
      query: "faith",
      passage: "legacy-topic",
      passageBook: "romans",
      passageChapter: 8,
      passageVerse: 1,
      passageEndVerse: 4
    });
    expect(html).toContain("Browse by Bible passage");
    expect(html).toContain('id="passage-book"');
    expect(html).toContain('<optgroup label="Old Testament">');
    expect(html).toContain('<optgroup label="New Testament">');
    expect(html).toContain('id="passage-chapter"');
    expect(html).toContain('id="passage-verse"');
    expect(html).not.toContain('id="passage-end-verse"');
    expect(html).toContain('<option value="">Choose a chapter</option>');
    expect(html).toContain('<option value="">Choose a verse</option>');
    expect(html).toContain('data-verses="1,2,3,4"');
    expect(html).toContain("Primary passage: Romans 8:1–4");
    expect(html).toContain("Preached from");
    expect(html).toContain("Clear passage");
    expect(html).toContain("sermon_topics=legacy-topic");
    expect(html).toContain("passageBook=romans");
    expect(response?.headers.get("content-security-policy")).toContain("script-src 'sha256-");
    expect(html).toContain("@media (max-width:38rem)");
  });

  it("renders three landscape recent sermons and fail-closed discovery carousels by default", async () => {
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
    expect(html.match(/class="landscape-card"/gu)).toHaveLength(3);
    expect(html).toContain("recent-one");
    expect(html).toContain("recent-three");
    expect(html).not.toContain("older-four");
    expect(html).toContain("Show more recent sermons");
    expect(html).toContain("Topical sermons");
    expect(html).toContain("No sermons have an approved topical classification yet.");
    expect(html).toContain('id="series-sermons-track"');
    expect(html).toContain('aria-label="Previous Series"');
    expect(html).toContain('aria-label="Next Series"');
    expect(html).toContain("scroll-snap-type:x proximity");
    expect(html).not.toContain("autoplay");
    const primaryRow = html.slice(
      html.indexOf('<div class="filter-primary">'),
      html.indexOf('<details class="advanced-search"')
    );
    expect(primaryRow.match(/<label for=/gu)).toHaveLength(4);
    expect(html).toContain('data-active="false"');
    expect(html).not.toContain('data-active="false" open');
  });

  it("shows only repository-declared topical sermons and never infers them from no-primary state", async () => {
    const repository = new SiteRepository();
    const route = createPublicSermonSiteHandler(repository);
    const empty = await route(new Request("http://localhost/sermons/"));
    expect(await empty!.text()).toContain("No sermons have an approved topical classification yet.");

    repository.topicalSermons = [summary];
    const explicit = await route(new Request("http://localhost/sermons/"));
    const html = await explicit!.text();
    expect(html).toContain('id="topical-sermons-track"');
    expect(html).toContain('aria-label="Previous Topical sermons"');
  });

  it("preserves expanded recent pagination in URLs and hides discovery carousels", async () => {
    const repository = new SiteRepository();
    repository.totalItems = 19;
    const route = createPublicSermonSiteHandler(repository);
    const response = await route(new Request("http://localhost/sermons/?view=recent"));
    const html = await response!.text();

    expect(repository.lastQuery).toMatchObject({ view: "recent", page: 1, pageSize: 9, order: "DESC" });
    expect(html).toContain("Show fewer recent sermons");
    expect(html).toContain("Recent sermons");
    expect(html).toContain('/sermons/page/2/#sermon-results');
    expect(html).not.toContain('id="topical-sermons-heading"');
    expect(html).not.toContain('id="series-sermons-heading"');
    expect(html).toContain('aria-current="page"');
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

    const missingPage = await route(new Request("http://localhost/sermons/page/2/"));
    expect(missingPage?.status).toBe(404);
    const missingHtml = await missingPage!.text();
    expect(missingHtml).toContain("That sermon archive page does not exist");
    expect(missingHtml).not.toContain("Private Draft Transcript");
    expect(missingHtml).not.toContain("Pending Sermon Title");
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
});

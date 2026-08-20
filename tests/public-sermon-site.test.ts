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
  books: [{ name: "Romans", slug: "romans" }]
};

class SiteRepository implements PublicSermonRepository {
  lastQuery: PublicSermonListQuery | null = null;
  totalItems = 10;
  disposition: PublicSermonPathDisposition | null = null;

  async listPublished(query: PublicSermonListQuery): Promise<PaginatedSermons> {
    this.lastQuery = query;
    return { data: [summary], totalItems: this.totalItems };
  }

  async findPublishedBySlug(slug: string): Promise<SermonDetail | null> {
    return slug === detail.slug ? detail : null;
  }

  async listPublishedFilterOptions(): Promise<PublicSermonFilterOptions> {
    return options;
  }

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
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain("Active filters");
    expect(html).toContain("Clear all filters");
    expect(html).toContain("@media (max-width:38rem)");
    expect(html).toContain(encodeURIComponent(summary.slug));
    expect(html).not.toContain('id="transcript-heading"');
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
    expect(html).toContain('id="passage-end-verse"');
    expect(html).toContain("Primary passage: Romans 8:1–4");
    expect(html).toContain("Preached from:");
    expect(html).toContain("Search sermons");
    expect(html).toContain("Clear passage");
    expect(html).toContain("sermon_topics=legacy-topic");
    expect(html).toContain("passageBook=romans");
    expect(response?.headers.get("content-security-policy")).toContain("script-src 'sha256-");
    expect(html).toContain("@media (max-width:38rem)");
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

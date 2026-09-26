import { describe, expect, it } from "vitest";
import type { PublicSermonListQuery } from "../src/api/contracts/public-sermons";
import type { SermonDetail, SermonSummary } from "../src/domain/sermon";
import { LocalFrontendPreviewSession } from "../src/server/auth/local-frontend-preview-session";
import { LocalTestIdentityProvider } from "../src/server/auth/local-test-identity-provider";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import type {
  PaginatedSermons,
  PublicSermonFilterOptions,
  PublicSermonPathDisposition,
  PublicSermonRepository
} from "../src/server/repositories/sermon-repository";

const summary: SermonSummary = {
  id: "75df2144-b557-50f6-98bd-011cd696bfb9",
  title: "An anonymised reviewed draft",
  slug: "an-anonymised-reviewed-draft",
  serviceDate: "2026-08-02",
  summary: "This anonymised approved description is long enough to exercise the private frontend without containing real sermon material.",
  speaker: { name: "Example Speaker", slug: "example-speaker" },
  series: [{ name: "Example Series", slug: "example-series" }],
  scriptureReferences: [],
  primaryPassages: [],
  primaryPassageState: "none",
  books: [{ name: "Romans", slug: "romans" }],
  primaryMedia: {
    provider: "youtube",
    mediaType: "video",
    externalId: "abcdefghijk",
    canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    title: "Anonymised sermon video"
  }
};

const detail: SermonDetail = {
  ...summary,
  seoDescription: null,
  body: null,
  media: [summary.primaryMedia!],
  transcript: { bodyText: "An approved anonymised transcript remains in initial HTML." },
  questionAnswers: Array.from({ length: 7 }, (_, index) => ({
    question: `Anonymised reflection question ${index + 1}?`,
    answer: `An anonymised complete answer for question ${index + 1}.`,
    displayOrder: index + 1
  })),
  relatedSermons: []
};

const options: PublicSermonFilterOptions = {
  speakers: [{ name: "Example Speaker", slug: "example-speaker", sermonCount: 1 }],
  series: [{ name: "Example Series", slug: "example-series", sermonCount: 1 }],
  passages: [],
  books: [{ name: "Romans", slug: "romans", sermonCount: 1 }],
  passageVerseAvailability: [{ bookSlug: "romans", chapter: 8, verses: [1, 2, 3, 4] }]
};

class PreviewRepository implements PublicSermonRepository {
  queryCount = 0;
  lastQuery: PublicSermonListQuery | null = null;

  async listPublished(query: PublicSermonListQuery): Promise<PaginatedSermons> {
    this.queryCount += 1;
    this.lastQuery = query;
    return { data: [summary], totalItems: 1 };
  }

  async findPublishedBySlug(slug: string): Promise<SermonDetail | null> {
    this.queryCount += 1;
    return slug === detail.slug ? detail : null;
  }

  async listPublishedFilterOptions(): Promise<PublicSermonFilterOptions> {
    this.queryCount += 1;
    return options;
  }

  async listPublishedTopicalSermons(): Promise<SermonSummary[]> { return []; }
  async listPublishedSeriesRepresentatives() { return [{ series: options.series[0]!, sermon: summary }]; }

  async listPublishedSitemapEntries() { return []; }
  async findPublicPathDisposition(): Promise<PublicSermonPathDisposition | null> { return null; }
}

async function authorisedRoute() {
  const repository = new PreviewRepository();
  const session = new LocalFrontendPreviewSession();
  const issued = await session.issue(new Request("http://127.0.0.1/api/v1/admin/frontend-preview-session", {
    method: "POST",
    headers: { "x-local-identity": "admin" }
  }), new LocalTestIdentityProvider(true, "development"));
  const cookie = issued.headers.get("set-cookie")!.split(";", 1)[0]!;
  return { repository, route: createLocalFrontendPreviewHandler(repository, session), cookie };
}

function masthead(html: string): string {
  return html.slice(html.indexOf('<header class="masthead"'), html.indexOf("</header>"));
}

describe("authenticated local frontend preview", () => {
  it("requires an issued administrator session and does not query on denial", async () => {
    const repository = new PreviewRepository();
    const session = new LocalFrontendPreviewSession();
    const route = createLocalFrontendPreviewHandler(repository, session);
    const denied = await route(new Request("http://127.0.0.1/frontend-preview/?preview=1", {
      headers: { "x-local-identity": "admin" }
    }));

    expect(denied?.status).toBe(401);
    expect(repository.queryCount).toBe(0);
    expect(denied?.headers.get("cache-control")).toContain("no-store");
    expect(denied?.headers.get("x-robots-tag")).toContain("noindex");
    const html = await denied!.text();
    expect(html).not.toContain(summary.title);
    expect(html).not.toContain('rel="canonical"');
  });

  it("issues a preview cookie only through the existing administrator identity", async () => {
    const session = new LocalFrontendPreviewSession();
    const identity = new LocalTestIdentityProvider(true, "development");
    expect((await session.issue(new Request("http://127.0.0.1/session", { method: "POST" }), identity)).status).toBe(401);
    const issued = await session.issue(new Request("http://127.0.0.1/session", {
      method: "POST",
      headers: { "x-local-identity": "admin" }
    }), identity);
    expect(issued.status).toBe(200);
    expect(issued.headers.get("set-cookie")).toContain("HttpOnly");
    expect(issued.headers.get("set-cookie")).toContain("SameSite=Strict");
  });

  it("renders the real shared homepage and detail components without indexable metadata", async () => {
    const { route, cookie } = await authorisedRoute();
    const home = await route(new Request("http://127.0.0.1/frontend-preview/", { headers: { cookie } }));
    const homeHtml = await home!.text();
    expect(home?.status).toBe(200);
    expect(homeHtml).toContain(summary.title);
    expect(homeHtml).toContain('<div class="preview-band" role="status">');
    expect(homeHtml).toContain("Private local frontend preview · Draft content · Not public or indexable");
    expect(homeHtml).not.toContain('rel="canonical"');
    expect(homeHtml).not.toContain('property="og:');
    expect(homeHtml).not.toContain("application/ld+json");
    expect(homeHtml).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
    expect(home?.headers.get("cache-control")).toBe("private, no-store, max-age=0, must-revalidate");
    expect(homeHtml).toContain('<h1 id="hero-heading" class="arrival__title">');
    expect(homeHtml).toContain('<h2 id="recent-heading" class="section__title">Recent Sermons</h2>');
    expect(homeHtml).toContain('<h3 class="card__title"><a href="/frontend-preview/sermons/an-anonymised-reviewed-draft/">An anonymised reviewed draft</a></h3>');
    expect(homeHtml).toContain('<span class="card__group">Pauline Epistles</span>');

    const landing = await route(new Request("http://127.0.0.1/frontend-preview/sermons-v1/", { headers: { cookie } }));
    const landingHtml = await landing!.text();
    expect(landing?.status).toBe(200);
    expect(landingHtml).toContain('<ul class="stats hero__stats" role="list"><li>1 sermon</li><li>1 of 66 books</li><li>1 speaker</li><li>1 series</li></ul>');
    expect(landingHtml).toContain('<a class="spine__link" href="/frontend-preview/books/romans/">');
    expect(landingHtml).toContain('<span class="spine__count" aria-hidden="true">1</span>');
    expect(landingHtml).toContain('<h2 id="latest-heading" class="section__title">Latest sermon</h2>');
    expect(landingHtml).toContain('<h3 class="entry__title"><a href="/frontend-preview/sermons/an-anonymised-reviewed-draft/">An anonymised reviewed draft</a></h3>');

    const sermon = await route(new Request(`http://127.0.0.1/frontend-preview/sermons/${summary.slug}/`, { headers: { cookie } }));
    const sermonHtml = await sermon!.text();
    expect(sermon?.status).toBe(200);
    expect(sermonHtml).toContain("No single primary passage (reviewed outcome)");
    expect(sermonHtml).not.toContain("Topical or multi-passage");
    expect(sermonHtml).toContain("An approved anonymised transcript");
    expect(sermonHtml).toContain('<details class="transcript" open data-open-for-print>');
    expect(sermonHtml.match(/<li class="question">/gu)).toHaveLength(7);
    expect(sermonHtml).toContain('data-video-id="abcdefghijk"');
    expect(sermonHtml).not.toContain("<iframe");
    expect(sermonHtml).not.toContain("autoplay");
    expect(sermonHtml).not.toContain('href="https://www.youtube.com/watch?v=abcdefghijk"');
    expect(sermonHtml).not.toContain("Open video");
    expect(sermonHtml).not.toContain("Related themes");
    expect(sermonHtml).toContain('<li><a href="/frontend-preview/books/romans/">Romans</a></li>');
    expect(sermonHtml).toContain('<dt>Bible book</dt><dd><a href="/frontend-preview/books/romans/">Romans</a></dd>');
    expect(sermon?.headers.get("content-security-policy")).toContain("frame-src https://www.youtube-nocookie.com");
    expect(home?.headers.get("content-security-policy")).not.toContain("frame-src");
  });

  it("preserves keyword filters and provides preview-only taxonomy pages", async () => {
    const { route, cookie, repository } = await authorisedRoute();
    const archive = await route(new Request("http://127.0.0.1/frontend-preview/sermons/?s=grace&sermon_speaker=example-speaker", { headers: { cookie } }));
    expect(archive?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({ query: "grace", speaker: "example-speaker", pageSize: 9 });
    expect(await archive!.text()).toContain('action="/frontend-preview/sermons/#results"');

    const index = await route(new Request("http://127.0.0.1/frontend-preview/speakers/", { headers: { cookie } }));
    const indexHtml = await index!.text();
    expect(indexHtml).toContain('<ul class="index" role="list"><li><a href="/frontend-preview/speakers/example-speaker/"><span>Example Speaker</span><span class="index__count">1 sermon</span></a></li></ul>');
    const speaker = await route(new Request("http://127.0.0.1/frontend-preview/speakers/example-speaker/", { headers: { cookie } }));
    const speakerHtml = await speaker!.text();
    expect(speaker?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({ speaker: "example-speaker", pageSize: 50 });
    expect(speakerHtml).toContain('<p class="eyebrow">Speaker</p>');
    expect(speakerHtml).toContain('<h1 class="title-page__title">Example Speaker</h1>');
    expect(speakerHtml).toContain("1 sermon");
    expect(speakerHtml).toContain('<p class="strip__label">The book preached from in this sermon</p>');
    expect(speakerHtml).toContain('<ol class="catalogue" role="list" start="1">');
    expect(speakerHtml).toContain('<h2 class="entry__title"><a href="/frontend-preview/sermons/an-anonymised-reviewed-draft/">');

    const books = await route(new Request("http://127.0.0.1/frontend-preview/books/", { headers: { cookie } }));
    const booksHtml = await books!.text();
    expect(books?.status).toBe(200);
    expect(booksHtml).toContain('<h1 class="title-page__title">Bible books</h1>');
    expect(booksHtml.match(/<li class="spine /gu)).toHaveLength(66);
    expect(booksHtml).toContain('<table class="canon-table">');
    expect(booksHtml.match(/<tr><td>/gu)).toHaveLength(66);
    expect(booksHtml).toContain('<td><a href="/frontend-preview/books/romans/">Romans</a></td><td>Pauline Epistles</td><td class="num">16</td><td class="num">1</td>');
    expect(booksHtml).toContain("<td>Genesis</td><td>Law / Pentateuch</td><td class=\"num\">50</td><td class=\"num\">—</td>");

    const book = await route(new Request("http://127.0.0.1/frontend-preview/books/romans/", { headers: { cookie } }));
    const bookHtml = await book!.text();
    expect(book?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({ book: "romans", pageSize: 50 });
    expect(bookHtml).toContain('<ol class="trail" role="list"><li><a href="/frontend-preview/books/">Bible books</a></li></ol>');
    expect(bookHtml).toContain('<h1 class="open-book__title" id="open-book-heading">Romans</h1>');
    expect(bookHtml).toContain('<h2 id="list-heading" class="section__title">Sermons in Romans</h2>');
    expect(bookHtml.match(/<span class="sr-only">Chapter \d+/gu)).toHaveLength(16);
    expect(bookHtml).toContain('href="/frontend-preview/sermons/?passageBook=romans&amp;passageChapter=8&amp;passageScope=chapter#canon"');
    expect(bookHtml).toContain('<span class="sr-only">Chapter 8, has sermons</span>');
    expect(bookHtml.match(/<h1/gu)).toHaveLength(1);
  });

  it("offers single-click discovery links inside a closed native Sermons menu and marks only the current section", async () => {
    const { route, cookie } = await authorisedRoute();
    const home = await route(new Request("http://127.0.0.1/frontend-preview/", { headers: { cookie } }));
    const html = await home!.text();
    const navigation = masthead(html);
    const expectedRoutes = [
      "/frontend-preview/",
      "/frontend-preview/sermons/",
      "/frontend-preview/speakers/",
      "/frontend-preview/series/",
      "/frontend-preview/books/"
    ];

    expect(navigation).toContain('<details class="masthead__menu" data-menu data-sermon-menu>');
    expect(navigation).toContain('<ul class="masthead__dropdown" id="sermon-navigation"><li><a href="/frontend-preview/sermons/" data-sermon-archive>All sermons</a></li><li><a href="/frontend-preview/speakers/">Speakers</a></li><li><a href="/frontend-preview/series/">Series</a></li><li><a href="/frontend-preview/books/">Books</a></li></ul>');
    expect(navigation).not.toContain('data-sermon-menu open');
    expect(navigation).toContain('aria-controls="sermon-navigation"');
    expect(html).toContain('<script data-enhancement="navigation">');
    expect(navigation.match(/aria-current="page"/gu)).toHaveLength(1);
    expect(navigation).toContain('<li><a href="/frontend-preview/" aria-current="page">Home</a></li>');
    expect(navigation).toContain('href="/frontend-preview/sermons/#sermon-search"');
    expect(navigation).toContain('aria-controls="primary-navigation" aria-expanded="false" data-mobile-toggle hidden');
    expect(navigation).toContain('<a class="button masthead__give" href="/frontend-preview/support-saving-grace-church-offering/">Give</a>');
    for (const routePath of expectedRoutes) expect(navigation).toContain(`href="${routePath}"`);
    expect(home?.headers.get("content-security-policy")).toContain("script-src 'sha256-");
    expect(html.match(/<h1/gu)).toHaveLength(1);

    const landing = await route(new Request("http://127.0.0.1/frontend-preview/sermons-v1/", { headers: { cookie } }));
    const landingHtml = await landing!.text();
    expect(masthead(landingHtml)).toContain('class="masthead__menu-toggle is-active"');
    expect(masthead(landingHtml).match(/aria-current="page"/gu) ?? []).toHaveLength(0);
    expect(landingHtml).toContain('<script data-enhancement="canon">');
    const script = landingHtml.slice(landingHtml.indexOf('<script data-enhancement="canon">'), landingHtml.indexOf("</script>", landingHtml.indexOf('<script data-enhancement="canon">')));
    for (const key of ["'ArrowRight'", "'ArrowLeft'", "'Home'", "'End'", "'Escape'", "'pageshow'"]) expect(script).toContain(key);
    expect(script).not.toContain("innerHTML");

    const speakers = await route(new Request("http://127.0.0.1/frontend-preview/speakers/", { headers: { cookie } }));
    const speakersNavigation = masthead(await speakers!.text());
    expect(speakersNavigation).toContain('<a href="/frontend-preview/speakers/" aria-current="page">Speakers</a>');
    expect(speakersNavigation).not.toContain('<a href="/frontend-preview/sermons/" aria-current="page">');
    expect(speakersNavigation.match(/aria-current="page"/gu)).toHaveLength(1);

    const archive = await route(new Request("http://127.0.0.1/frontend-preview/sermons/", { headers: { cookie } }));
    const archiveNavigation = masthead(await archive!.text());
    expect(archiveNavigation).toContain('<a href="/frontend-preview/sermons/" data-sermon-archive aria-current="page">All sermons</a>');
    expect(archiveNavigation).not.toContain(">SermonsV1</a>");
    expect(archiveNavigation).not.toContain(">SermonsV4</a>");
    expect(archiveNavigation.match(/aria-current="page"/gu)).toHaveLength(1);
  });

  it("has no preview sitemap, feed, or structured-data endpoint", async () => {
    const { route, cookie } = await authorisedRoute();
    for (const path of ["sitemap.xml", "feed.xml", "structured-data.json"]) {
      const result = await route(new Request(`http://127.0.0.1/frontend-preview/${path}`, { headers: { cookie } }));
      expect(result?.status).toBe(404);
      expect(await result!.text()).not.toContain(summary.title);
    }
  });

  it("redirects slashless preview detail and taxonomy URLs before querying content", async () => {
    const { route, cookie, repository } = await authorisedRoute();
    const detailResponse = await route(new Request(
      `http://127.0.0.1/frontend-preview/sermons/${summary.slug}`,
      { headers: { cookie } }
    ));
    expect(detailResponse?.status).toBe(307);
    expect(detailResponse?.headers.get("location")).toBe(`/frontend-preview/sermons/${summary.slug}/`);

    const taxonomy = await route(new Request(
      "http://127.0.0.1/frontend-preview/speakers/example-speaker",
      { headers: { cookie } }
    ));
    expect(taxonomy?.status).toBe(307);
    expect(taxonomy?.headers.get("location")).toBe("/frontend-preview/speakers/example-speaker/");
    expect(repository.queryCount).toBe(0);
  });
});

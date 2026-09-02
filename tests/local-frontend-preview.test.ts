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
  speakers: [{ name: "Example Speaker", slug: "example-speaker" }],
  series: [{ name: "Example Series", slug: "example-series" }],
  passages: [],
  books: [{ name: "Romans", slug: "romans" }],
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

function desktopNavigation(html: string): string {
  return html.slice(html.indexOf('<nav class="site-nav"'), html.indexOf('<details class="site-menu"'));
}

function mobileNavigation(html: string): string {
  return html.slice(html.indexOf('<details class="site-menu"'), html.indexOf("</header>"));
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
    expect(homeHtml).toContain('<div class="preview-banner" role="status">Private local frontend preview');
    expect(homeHtml).not.toContain('rel="canonical"');
    expect(homeHtml).not.toContain('property="og:');
    expect(homeHtml).not.toContain("application/ld+json");
    expect(homeHtml).toContain('<meta name="robots" content="noindex, nofollow, noarchive"');
    expect(home?.headers.get("cache-control")).toBe("private, no-store, max-age=0, must-revalidate");

    const sermon = await route(new Request(`http://127.0.0.1/frontend-preview/sermons/${summary.slug}/`, { headers: { cookie } }));
    const sermonHtml = await sermon!.text();
    expect(sermon?.status).toBe(200);
    expect(sermonHtml).toContain("No single primary passage (reviewed outcome)");
    expect(sermonHtml).not.toContain("Topical or multi-passage");
    expect(sermonHtml).toContain("An approved anonymised transcript");
    expect(sermonHtml.match(/class="qa-item"/gu)).toHaveLength(7);
    expect(sermonHtml).toContain('data-video-id="abcdefghijk"');
    expect(sermonHtml).not.toContain("<iframe");
    expect(sermonHtml).not.toContain("autoplay");
    expect(sermonHtml).not.toContain('href="https://www.youtube.com/watch?v=abcdefghijk"');
    expect(sermonHtml).not.toContain("Open video");
    expect(sermonHtml).not.toContain("Related themes");
    expect(sermon?.headers.get("content-security-policy")).toContain("frame-src https://www.youtube-nocookie.com");
    expect(home?.headers.get("content-security-policy")).not.toContain("frame-src");
  });

  it("preserves keyword filters and provides preview-only taxonomy pages", async () => {
    const { route, cookie, repository } = await authorisedRoute();
    const archive = await route(new Request("http://127.0.0.1/frontend-preview/sermons/?s=grace&sermon_speaker=example-speaker", { headers: { cookie } }));
    expect(archive?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({ query: "grace", speaker: "example-speaker", pageSize: 9 });
    expect(await archive!.text()).toContain('action="/frontend-preview/sermons/#sermon-results"');

    const index = await route(new Request("http://127.0.0.1/frontend-preview/speakers/", { headers: { cookie } }));
    const indexHtml = await index!.text();
    expect(indexHtml).toContain('<ul class="name-index" role="list"><li><a href="/frontend-preview/speakers/example-speaker/">Example Speaker</a></li></ul>');
    const speaker = await route(new Request("http://127.0.0.1/frontend-preview/speakers/example-speaker/", { headers: { cookie } }));
    const speakerHtml = await speaker!.text();
    expect(speaker?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({ speaker: "example-speaker", pageSize: 50 });
    expect(speakerHtml).toContain('<p class="page-head__kind">Speaker</p>');
    expect(speakerHtml).toContain("<h1>Example Speaker</h1>");
    expect(speakerHtml).toContain("1 sermon");
    expect(speakerHtml).toContain('<h2 class="sermon-item__title"><a href="/frontend-preview/sermons/an-anonymised-reviewed-draft/">');
  });

  it("groups sermon discovery routes in native disclosures enhanced for keyboard use", async () => {
    const { route, cookie } = await authorisedRoute();
    const home = await route(new Request("http://127.0.0.1/frontend-preview/", { headers: { cookie } }));
    const html = await home!.text();
    const desktop = desktopNavigation(html);
    const mobile = mobileNavigation(html);
    const expectedRoutes = [
      "/frontend-preview/sermons/",
      "/frontend-preview/speakers/",
      "/frontend-preview/series/",
      "/frontend-preview/books/"
    ];

    expect(desktop).toContain('<li><a href="/frontend-preview/" aria-current="page">Home</a></li>');
    expect(desktop).toContain('<details class="nav-disclosure nav-disclosure--desktop" data-nav-disclosure>');
    expect(desktop).toContain('<summary class="nav-disclosure__summary" aria-expanded="false">Sermons</summary>');
    expect(desktop).not.toContain('Home</a></li><li><a href="/frontend-preview/speakers/"');
    expect(mobile).toContain('<summary class="site-menu__summary" aria-expanded="false">Menu</summary>');
    expect(mobile).toContain('<details class="nav-disclosure nav-disclosure--mobile" data-nav-disclosure>');
    for (const routePath of expectedRoutes) {
      expect(desktop).toContain(`href="${routePath}"`);
      expect(mobile).toContain(`href="${routePath}"`);
    }
    expect(desktop.indexOf(expectedRoutes[0]!)).toBeLessThan(desktop.indexOf(expectedRoutes[1]!));
    expect(desktop.indexOf(expectedRoutes[1]!)).toBeLessThan(desktop.indexOf(expectedRoutes[2]!));
    expect(desktop.indexOf(expectedRoutes[2]!)).toBeLessThan(desktop.indexOf(expectedRoutes[3]!));
    expect(html).toContain('<script data-enhancement="navigation">');
    const script = html.slice(html.indexOf('<script data-enhancement="navigation">'), html.indexOf("</script>"));
    expect(script).toContain("'Escape'");
    expect(script).toContain("summary.focus()");
    expect(script).toContain("'focusout'");
    expect(script).toContain("'pointerdown'");
    expect(script).toContain("'aria-expanded'");
    expect(home?.headers.get("content-security-policy")).toContain("script-src 'sha256-");
    expect(html.match(/<h1/gu)).toHaveLength(1);
  });

  it("marks the sermon parent and the current child section independently", async () => {
    const { route, cookie } = await authorisedRoute();
    const speakers = await route(new Request("http://127.0.0.1/frontend-preview/speakers/", { headers: { cookie } }));
    const html = await speakers!.text();
    const desktop = desktopNavigation(html);

    expect(desktop).toContain('class="nav-disclosure__summary is-current"');
    expect(desktop).toContain('Sermons<span class="sr-only">, current section</span></summary>');
    expect(desktop).toContain('<a href="/frontend-preview/speakers/" aria-current="page">Speakers</a>');
    expect(desktop).not.toContain('<a href="/frontend-preview/sermons/" aria-current="page">Sermons</a>');
    expect(html).toContain('<a href="/frontend-preview/books/">Bible books</a>');
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

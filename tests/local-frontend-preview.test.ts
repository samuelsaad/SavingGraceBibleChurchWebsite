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
  books: [{ name: "Romans", slug: "romans" }]
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
    expect(homeHtml).toContain("Private local frontend preview");
    expect(homeHtml).not.toContain('rel="canonical"');
    expect(homeHtml).not.toContain("application/ld+json");

    const sermon = await route(new Request(`http://127.0.0.1/frontend-preview/sermons/${summary.slug}/`, { headers: { cookie } }));
    const sermonHtml = await sermon!.text();
    expect(sermon?.status).toBe(200);
    expect(sermonHtml).toContain("Topical or multi-passage sermon");
    expect(sermonHtml).toContain("An approved anonymised transcript");
    expect(sermonHtml.match(/class="qa-item"/gu)).toHaveLength(7);
    expect(sermonHtml).toContain('data-video-id="abcdefghijk"');
    expect(sermonHtml).not.toContain("autoplay");
    expect(sermonHtml).not.toContain("Related themes");
  });

  it("preserves keyword filters and provides preview-only taxonomy pages", async () => {
    const { route, cookie, repository } = await authorisedRoute();
    const archive = await route(new Request("http://127.0.0.1/frontend-preview/sermons/?s=grace&sermon_speaker=example-speaker", { headers: { cookie } }));
    expect(archive?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({ query: "grace", speaker: "example-speaker", pageSize: 9 });

    const index = await route(new Request("http://127.0.0.1/frontend-preview/speakers/", { headers: { cookie } }));
    expect(await index!.text()).toContain("Example Speaker");
    const speaker = await route(new Request("http://127.0.0.1/frontend-preview/speakers/example-speaker/", { headers: { cookie } }));
    expect(speaker?.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({ speaker: "example-speaker" });
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
    const detail = await route(new Request(
      `http://127.0.0.1/frontend-preview/sermons/${summary.slug}`,
      { headers: { cookie } }
    ));
    expect(detail?.status).toBe(307);
    expect(detail?.headers.get("location")).toBe(`/frontend-preview/sermons/${summary.slug}/`);

    const taxonomy = await route(new Request(
      "http://127.0.0.1/frontend-preview/speakers/example-speaker",
      { headers: { cookie } }
    ));
    expect(taxonomy?.status).toBe(307);
    expect(taxonomy?.headers.get("location")).toBe("/frontend-preview/speakers/example-speaker/");
    expect(repository.queryCount).toBe(0);
  });
});

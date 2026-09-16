import { describe, expect, it, vi } from "vitest";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import type { SermonSummary } from "../src/domain/sermon";
import { emptyFilterOptions } from "../src/frontend/pages/home";
import { renderSermonsV3 } from "../src/frontend/pages/v3";
import { previewRenderContext, publicRenderContext, restrictedRenderContext } from "../src/frontend/routes";
import { createPublicSermonSiteHandler } from "../src/server/http/public-sermon-page";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import { LocalFrontendPreviewSession } from "../src/server/auth/local-frontend-preview-session";
import { createSealedStagingHandler } from "../src/staging/handler";
import { embeddedStyleHashes } from "../src/server/http/frontend-response";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";

const sermon: SermonSummary = {
  id: "11111111-1111-4111-8111-111111111111", title: "An example sermon", slug: "an-example-sermon",
  serviceDate: "2026-08-02", summary: "An anonymised description retained exactly as supplied by the eligible repository projection for this frontend test.",
  speaker: { name: "Example speaker", slug: "example-speaker" }, series: [], books: [{ name: "Romans", slug: "romans" }],
  primaryPassages: [{ displayText: "Romans 8:1", isLead: true }], primaryPassageState: "assigned", scriptureReferences: [], primaryMedia: null
};
const options = { ...emptyFilterOptions, speakers: [{ ...sermon.speaker!, sermonCount: 11 }], books: [{ name: "Romans", slug: "romans", sermonCount: 11 }] };
function repository() {
  return {
    listPublished: vi.fn(async () => ({ data: [sermon], totalItems: 11 })),
    listPublishedFilterOptions: vi.fn(async () => options),
    listPublishedTopicalSermons: vi.fn(async () => [] as SermonSummary[]),
    listPublishedSeriesRepresentatives: vi.fn(async () => []),
    findPublishedBySlug: vi.fn(async () => null), listPublishedSitemapEntries: vi.fn(async () => []),
    findPublicPathDisposition: vi.fn(async () => null)
  } satisfies PublicSermonRepository;
}
describe("Sermons V3 alternate presentation", () => {
  it("uses the eligible repository and preserves combined filters, sorting and page size", async () => {
    const repo = repository();
    const response = await createPublicSermonSiteHandler(repo, restrictedRenderContext)(new Request("http://localhost/sermons-v3/page/2/?s=faith&sermon_book=romans&sermon_speaker=example-speaker&order=ASC"));
    const text = await response!.text();
    expect(response!.status).toBe(200);
    expect(repo.listPublished).toHaveBeenCalledWith(expect.objectContaining({ query: "faith", book: "romans", speaker: "example-speaker", order: "ASC", page: 2, pageSize: 9 }));
    expect(text).toContain('start="10"');
    expect(text).toContain("10-10 of 11 sermons");
    expect(text).toContain('href="/sermons-v3/?s=faith&amp;sermon_speaker=example-speaker&amp;sermon_book=romans&amp;order=ASC#v3-results"');
    expect(text).toContain('href="/sermons/an-example-sermon/"');
    expect(repo.listPublishedTopicalSermons).not.toHaveBeenCalled();
  });
  it("has native search and pagination and does not infer Topical from absent books or a series name", async () => {
    const repo = repository();
    repo.listPublishedTopicalSermons.mockResolvedValue([{ ...sermon, books: [], isTopical: false, title: "Not classified", series: [{ name: "Topical", slug: "topical" }] }, { ...sermon, books: [], isTopical: true, title: "Explicit topical example" }]);
    const response = await createPublicSermonSiteHandler(repo, restrictedRenderContext)(new Request("http://localhost/sermons-v3/"));
    const text = await response!.text();
    expect(text).toContain("Explicit topical example");
    expect(text).not.toContain("Not classified");
    expect(text).toContain('method="get" role="search"');
    expect(text).toContain('rel="next" href="/sermons-v3/page/2/#v3-results"');
    expect(text).toContain('href="/sermons-v3/" aria-current="page">Sermons V3</a>');
    expect(text).toContain('data-sermon-archive>SermonsV2</a>');
    expect(text).toContain('class="v3-book hue--pauline"');
    expect(text).toContain('href="/sermons/#shelf-heading">Explore the full Bible bookshelf');
    expect(text).not.toContain('data-enhancement="canon"');
  });
  it("applies alternate-page noindex and existing CSP hashing without public metadata in restricted mode", async () => {
    for (const context of [publicRenderContext, restrictedRenderContext]) {
      const response = await createPublicSermonSiteHandler(repository(), context)(new Request("http://localhost/sermons-v3/"));
      const text = await response!.text();
      expect(response!.headers.get("x-robots-tag")).toContain("noindex");
      expect(response!.headers.get("cache-control")).toContain("no-store");
      for (const hash of embeddedStyleHashes(text)) expect(response!.headers.get("content-security-policy")).toContain(hash);
      expect(response!.headers.get("content-security-policy")).not.toContain("unsafe-inline");
      if (context.mode === "public") expect(text).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/"');
      else expect(text).not.toMatch(/rel="canonical"|property="og:/);
    }
  });
  it("escapes sermon wording and search input", () => {
    const text = renderSermonsV3({ sermons: [{ ...sermon, title: '<script>alert("x")</script>' }], options, totalItems: 1, topicalSermons: [], seriesRepresentatives: [], hasQueryParameters: true, query: publicSermonListQuerySchema.parse({ query: '<img src=x onerror="bad">' }) }, restrictedRenderContext);
    expect(text).toContain("&lt;script&gt;");
    expect(text).not.toContain('<script>alert');
    expect(text).not.toContain('<img src=x');
  });
  it("denies preview before any data query and keeps sealed administrator routes disabled", async () => {
    const repo = repository();
    const preview = createLocalFrontendPreviewHandler(repo, new LocalFrontendPreviewSession());
    expect((await preview(new Request("http://localhost/frontend-preview/sermons-v3/")))!.status).toBe(401);
    expect(repo.listPublished).not.toHaveBeenCalled();
    const sealed = createSealedStagingHandler(repo, async () => {}, "a".repeat(40));
    for (const path of ["/admin", "/frontend-preview/sermons-v3/", "/api/v1/admin/sermons"]) {
      expect((await sealed(new Request(`http://localhost${path}`, { headers: { "x-local-identity": "admin" } }))).status).toBe(401);
    }
  });
  it("retains preview paths for links in the pure renderer", () => {
    const text = renderSermonsV3({ sermons: [sermon], options, totalItems: 11, topicalSermons: [], seriesRepresentatives: [], hasQueryParameters: false, query: publicSermonListQuerySchema.parse({}) }, previewRenderContext);
    expect(text).toContain('href="/frontend-preview/sermons-v3/page/2/#v3-results"');
    expect(text).toContain('href="/frontend-preview/sermons/an-example-sermon/"');
    expect(text).not.toContain('rel="canonical"');
  });
  it("rejects invalid filters, invalid pages and mutations; normalises slash and page-one URLs", async () => {
    const route = createPublicSermonSiteHandler(repository());
    for (const path of ["/sermons-v3/page/0/", "/sermons-v3/page/999/", "/sermons-v3/page/nope/"]) expect((await route(new Request(`http://localhost${path}`)))!.status).toBe(404);
    expect((await route(new Request("http://localhost/sermons-v3/?dateFrom=2026-08-20&dateTo=2026-08-01")))!.status).toBe(400);
    expect((await route(new Request("http://localhost/sermons-v3/", { method: "POST" })))!.status).toBe(405);
    for (const path of ["/sermons-v3", "/sermons-v3/page/1/"]) {
      const response = await route(new Request(`http://localhost${path}?s=faith`));
      expect(response!.status).toBe(301);
      expect(response!.headers.get("location")).toBe("/sermons-v3/?s=faith");
    }
  });
  it("renders an empty archive and does not put V3 in the sitemap", async () => {
    const repo = repository(); repo.listPublished.mockResolvedValue({ data: [], totalItems: 0 });
    const route = createPublicSermonSiteHandler(repo);
    expect(await (await route(new Request("http://localhost/sermons-v3/")))!.text()).toContain("No sermons found");
    expect(await (await route(new Request("http://localhost/sitemap-sermons.xml")))!.text()).not.toContain("sermons-v3");
  });
});

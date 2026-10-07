import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import type { PublicSermonListQuery } from "../src/api/contracts/public-sermons";
import type { SermonSummary } from "../src/domain/sermon";
import { emptyFilterOptions } from "../src/frontend";
import { publicRenderContext, restrictedRenderContext } from "../src/frontend/routes";
import { canonScript } from "../src/frontend/scripts/canon";
import { createAlternateArchiveHandlers } from "../src/server/http/alternate-archives";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import { createPublicSermonSiteHandler } from "../src/server/http/public-sermon-page";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";
import { createSealedStagingHandler } from "../src/staging/handler";

function repository() {
  const sermons: SermonSummary[] = Array.from({ length: 12 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `An anonymised sermon ${index + 1}`,
    slug: `anonymised-sermon-${index + 1}`,
    serviceDate: `2026-01-${String(28 - index).padStart(2, "0")}`,
    summary: "An anonymised approved description used only to verify archive routing and privacy.",
    speaker: { name: "Example Speaker", slug: "example-speaker" },
    series: [],
    scriptureReferences: [],
    primaryPassages: [{ displayText: "Romans 8:1–4", isLead: true }],
    primaryPassageState: "assigned",
    books: [{ name: "Romans", slug: "romans" }],
    primaryMedia: null
  }));
  return {
    listPublished: vi.fn(async (query: PublicSermonListQuery) => ({
      data: sermons.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      totalItems: sermons.length
    })),
    findPublishedBySlug: vi.fn(async () => null),
    listPublishedFilterOptions: vi.fn(async () => ({
      ...emptyFilterOptions,
      books: [{ name: "Romans", slug: "romans", sermonCount: 12 }],
      speakers: [{ name: "Example Speaker", slug: "example-speaker", sermonCount: 12 }]
    })),
    listPublishedTopicalSermons: vi.fn(async () => []),
    listPublishedSeriesRepresentatives: vi.fn(async () => []),
    listPublishedSitemapEntries: vi.fn(async () => []),
    findPublicPathDisposition: vi.fn(async () => null)
  } satisfies PublicSermonRepository;
}

describe("SermonsV5 route integration", () => {
  it.each(["#results", "#v4-results", "#v5-results"])("focuses the requested results target after navigation to %s", (hash) => {
    const focus = vi.fn();
    const getElementById = vi.fn((id: string) => id === hash.slice(1) ? { focus } : null);
    runInNewContext(canonScript, {
      document: { querySelectorAll: () => [], getElementById },
      window: { location: { hash }, matchMedia: () => ({ matches: false }), addEventListener: vi.fn() }
    });
    expect(getElementById).toHaveBeenCalledExactlyOnceWith(hash.slice(1));
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });

  it("uses the caller's eligible repository and existing filter contract in public and restricted contexts", async () => {
    for (const context of [publicRenderContext, restrictedRenderContext]) {
      const source = repository();
      const route = createPublicSermonSiteHandler(source, context);
      const response = await route(new Request("http://127.0.0.1/sermons-v5/?sermon_speaker=example-speaker&s=grace"));
      expect(response?.status).toBe(200);
      expect(source.listPublished).toHaveBeenCalledWith(expect.objectContaining({
        speaker: "example-speaker", query: "grace", page: 1, pageSize: 9
      }));
      expect(response?.headers.get("x-robots-tag")).toBe(context.mode === "public" ? "noindex, follow" : "noindex, nofollow, noarchive");
      expect(response?.headers.get("cache-control")).toContain("no-store");
      const html = await response!.text();
      expect(html).toContain('action="/sermons-v5/#v5-results"');
      if (context.mode === "public") {
        expect(html).toContain('rel="canonical" href="https://www.savinggrace.org.au/sermons/"');
      } else {
        expect(html).not.toContain('rel="canonical"');
        expect(html).not.toContain('property="og:');
        expect(html).not.toContain('application/ld+json');
        expect(html).toContain('<a href="/sermons-v4/" data-sermon-archive>SermonsV4</a>');
        expect(html).toContain('<a href="/sermons-v5/" aria-current="page">SermonsV5</a>');
      }
    }
  });

  it("keeps pagination, redirects, invalid filters and method handling within V5", async () => {
    const source = repository();
    const route = createAlternateArchiveHandlers(source, publicRenderContext);
    for (const path of ["/sermons-v5?s=grace", "/sermons-v5/page/1/?s=grace"]) {
      const response = await route(new Request(`http://127.0.0.1${path}`));
      expect(response?.status).toBe(301);
      expect(response?.headers.get("location")).toBe("/sermons-v5/?s=grace");
    }
    const secondPage = await route(new Request("http://127.0.0.1/sermons-v5/page/2/?sermon_book=romans"));
    expect(secondPage?.status).toBe(200);
    expect(source.listPublished).toHaveBeenLastCalledWith(expect.objectContaining({ book: "romans", page: 2, pageSize: 9 }));
    const html = await secondPage!.text();
    expect(html).toContain('href="/sermons-v5/?sermon_book=romans#v5-results" rel="prev"');
    for (const path of ["/sermons-v5/page/0/", "/sermons-v5/page/3/", "/sermons-v5/missing/"]) {
      expect((await route(new Request(`http://127.0.0.1${path}`)))?.status).toBe(404);
    }
    expect((await route(new Request("http://127.0.0.1/sermons-v5/?dateFrom=2026-08-09&dateTo=2026-08-02")))?.status).toBe(400);
    expect((await route(new Request("http://127.0.0.1/sermons-v5/", { method: "POST" })))?.status).toBe(405);
    expect(await route(new Request("http://127.0.0.1/sermons-v50/"))).toBeNull();
  });

  it("authenticates before any V5 data load in both protected preview namespaces", async () => {
    for (const root of ["/frontend-preview", "/draft-preview"] as const) {
      const source = repository();
      let authorized = false;
      const route = createLocalFrontendPreviewHandler(source, { authorizes: () => authorized }, { root });
      const denied = await route(new Request(`http://127.0.0.1${root}/sermons-v5/`));
      expect(denied?.status).toBe(401);
      expect(source.listPublished).not.toHaveBeenCalled();
      expect(source.listPublishedFilterOptions).not.toHaveBeenCalled();
      authorized = true;
      const response = await route(new Request(`http://127.0.0.1${root}/sermons-v5/`));
      expect(response?.status).toBe(200);
      expect(response?.headers.get("cache-control")).toContain("private, no-store");
      expect(response?.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
      const html = await response!.text();
      expect(html).toContain(`action="${root}/sermons-v5/#v5-results"`);
      expect(html).toContain(`href="${root}/sermons-v5/" aria-current="page">SermonsV5</a>`);
      expect(html).not.toContain('rel="canonical"');
      const redirect = await route(new Request(`http://127.0.0.1${root}/sermons-v5`));
      expect(redirect?.status).toBe(307);
      expect(redirect?.headers.get("location")).toBe(`${root}/sermons-v5/`);
    }
  });

  it("inherits the sealed visitor runtime's no-store/noindex and private-route denial", async () => {
    const source = repository();
    const route = createSealedStagingHandler(source, async () => {}, "a".repeat(40));
    for (const path of ["/admin/", "/frontend-preview/sermons-v5/", "/api/v1/admin/sermons"]) {
      expect((await route(new Request(`http://127.0.0.1${path}`))).status).toBe(401);
    }
    expect(source.listPublished).not.toHaveBeenCalled();
    const response = await route(new Request("http://127.0.0.1/sermons-v5/"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'sha256-");
    expect(response.headers.get("content-security-policy")).not.toContain("'unsafe-inline'");
    expect(await response.text()).not.toContain('rel="canonical"');
  });
});

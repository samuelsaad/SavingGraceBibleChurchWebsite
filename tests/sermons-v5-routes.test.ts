import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import type { PublicSermonListQuery } from "../src/api/contracts/public-sermons";
import type { SermonSummary } from "../src/domain/sermon";
import { emptyFilterOptions } from "../src/frontend";
import { draftPreviewRenderContext, previewRenderContext, publicRenderContext, restrictedRenderContext, type FrontendRenderContext } from "../src/frontend/routes";
import { canonScript } from "../src/frontend/scripts/canon";
import { createAlternateArchiveHandlers } from "../src/server/http/alternate-archives";
import { loadArchivePage } from "../src/server/http/frontend-archive-loader";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import { createPublicSermonSiteHandler } from "../src/server/http/public-sermon-page";
import type { PublicSermonFilterOptions, PublicSermonRepository } from "../src/server/repositories/sermon-repository";
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
      const response = await route(new Request("http://127.0.0.1/"+(context.mode==="public"?"sermons":"sermons-v5")+"/?sermon_speaker=example-speaker&s=grace"));
      expect(response?.status).toBe(200);
      expect(source.listPublished).toHaveBeenCalledWith(expect.objectContaining({
        speaker: "example-speaker", query: "grace", page: 1, pageSize: 9
      }));
      expect(response?.headers.get("x-robots-tag")).toBe(context.mode === "public" ? null : "noindex, nofollow, noarchive");
      expect(response?.headers.get("cache-control")).toContain("no-store");
      const html = await response!.text();
      expect(html).toContain('action="/'+(context.mode==='public'?'sermons':'sermons-v5')+'/#v5-results"');
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
    const route = createAlternateArchiveHandlers(source, restrictedRenderContext);
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


describe("V5 directory count destinations", () => {
  const globalOptions: PublicSermonFilterOptions = {
    ...emptyFilterOptions,
    series: [
      { name: "Shared series", slug: "shared-series", sermonCount: 2 },
      { name: "Other series", slug: "other-series", sermonCount: 5 }
    ],
    speakers: [
      { name: "Example Speaker", slug: "example-speaker", sermonCount: 12 },
      { name: "Other Speaker", slug: "other-speaker", sermonCount: 3 }
    ]
  };
  const contextualOptions: PublicSermonFilterOptions = {
    ...emptyFilterOptions,
    series: [{ name: "Shared series", slug: "shared-series", sermonCount: 1 }],
    speakers: [{ name: "Example Speaker", slug: "example-speaker", sermonCount: 1 }]
  };

  function countedRepository() {
    const base = repository();
    return {
      ...base,
      listPublished: vi.fn(async (query: PublicSermonListQuery) => {
        const totalItems = query.query ? 1
          : query.series ? globalOptions.series.find(item => item.slug === query.series)!.sermonCount!
          : query.speaker ? globalOptions.speakers.find(item => item.slug === query.speaker)!.sermonCount!
          : 12;
        const result = await base.listPublished(query);
        return { data: result.data.slice(0, totalItems), totalItems };
      }),
      listPublishedFilterOptions: vi.fn(async (query?: PublicSermonListQuery) => query?.query ? contextualOptions : globalOptions)
    } satisfies PublicSermonRepository;
  }

  function routeFor(source: PublicSermonRepository, context: FrontendRenderContext) {
    return context.mode === "preview" || context.mode === "draft-preview"
      ? createLocalFrontendPreviewHandler(source, { authorizes: () => true }, { root: context.basePath as "/frontend-preview" | "/draft-preview", context })
      : createPublicSermonSiteHandler(source, context);
  }

  it.each([publicRenderContext, restrictedRenderContext, previewRenderContext, draftPreviewRenderContext])(
    "matches each global directory count to its unfiltered destination while preserving the $mode finder",
    async (context) => {
      const source = countedRepository();
      const route = routeFor(source, context);
      const response = await route(new Request(`http://127.0.0.1${context.basePath}/${context.mode==="public"?"sermons":"sermons-v5"}/?sermon_speaker=example-speaker&s=synthetic`));
      expect(response?.status).toBe(200);
      expect(source.listPublishedFilterOptions).toHaveBeenCalledTimes(2);
      expect(source.listPublishedFilterOptions).toHaveBeenCalledWith(expect.objectContaining({ speaker: "example-speaker", query: "synthetic" }));
      expect(source.listPublishedFilterOptions).toHaveBeenCalledWith();
      const html = await response!.text();
      const finder = html.match(/<form class="finder__form"[\s\S]*?<\/form>/u)![0];
      expect(finder).toContain('value="shared-series">Shared series (1)</option>');
      expect(finder).toContain('value="example-speaker" selected>Example Speaker (1)</option>');
      expect(finder).not.toContain("Other series");
      expect(finder).not.toContain("Other Speaker");
      const tables = [...html.matchAll(/<table class="v5-directory">([\s\S]*?)<\/table>/gu)];
      expect(tables).toHaveLength(2);
      const rows = tables.flatMap(([, table]) => [...table!.matchAll(/<tr><th scope="row"><a class="v5-directory__link" href="([^"]+)"[\s\S]*?class="v5-directory__count">(\d+)<\/span><\/td><\/tr>/gu)]);
      expect(rows).toHaveLength(4);
      expect(rows.map(([, , count]) => Number(count))).toEqual([2, 5, 12, 3]);
      for (const [, href, count] of rows) {
        const destination = new URL(href!.replaceAll("&amp;", "&"), "http://127.0.0.1");
        expect(destination.pathname.startsWith(`${context.basePath}/`)).toBe(true);
        expect(destination.searchParams.has("s")).toBe(false);
        expect(destination.searchParams.size).toBe(context.mode === "preview" ? 0 : 1);
        const target = await route(new Request(destination));
        expect(target?.status).toBe(200);
        const targetHtml = await target!.text();
        if (context.mode === "preview") expect(targetHtml).toContain(`<span>${count} sermons</span>`);
        else if(context.mode==="public") expect(targetHtml).toContain(`<span>${count} sermons</span>`);
        else expect(targetHtml).toMatch(new RegExp(`id="results-status">${count} sermons`));
      }
    }
  );

  it.each(["", "view=recent", "page=2"])("reuses one eligible options result without active filters (%s)", async (search) => {
    const source = countedRepository();
    const loaded = await loadArchivePage(source, new URLSearchParams(search), null, { includeDirectoryOptions: true });
    expect(loaded.kind).toBe("page");
    expect(source.listPublishedFilterOptions).toHaveBeenCalledTimes(1);
    if (loaded.kind === "page") {
      expect(loaded.input.directoryOptions).toBe(loaded.input.options);
      expect(loaded.input.directoryOptions).toBe(globalOptions);
    }
  });

  it("does not load a global directory for the ordinary archive or V4", async () => {
    const source = countedRepository();
    const query = new URLSearchParams("sermon_speaker=example-speaker&s=synthetic");
    const loaded = await loadArchivePage(source, query, null);
    expect(loaded.kind).toBe("page");
    if (loaded.kind === "page") {
      expect(loaded.input).not.toHaveProperty("directoryOptions");
      expect(loaded.input.options).toBe(contextualOptions);
    }
    expect(source.listPublishedFilterOptions).toHaveBeenCalledTimes(1);
    source.listPublishedFilterOptions.mockClear();
    const response = await createAlternateArchiveHandlers(source, restrictedRenderContext)(new Request(`http://127.0.0.1/sermons-v4/?${query}`));
    expect(response?.status).toBe(200);
    expect(source.listPublishedFilterOptions).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ speaker: "example-speaker", query: "synthetic" }));
  });
});

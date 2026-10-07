import { beforeEach, describe, expect, it, vi } from "vitest";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import { publicMediaSchema, type SermonDetail, type SermonSummary } from "../src/domain/sermon";
import { emptyFilterOptions } from "../src/frontend";
import { renderSermonsV5Page } from "../src/frontend/pages/sermons-v5";
import { publicRenderContext, restrictedRenderContext } from "../src/frontend/routes";
import { createAlternateArchiveHandlers } from "../src/server/http/alternate-archives";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import { buildPublishedSermonDetailQuery, buildPublishedSermonListQuery } from "../src/server/queries/public-sermons";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";

vi.mock("../src/frontend/pages/sermons-v5", () => ({
  renderSermonsV5Page: vi.fn(() => "<!doctype html><title>Anonymous archive fixture</title>")
}));

function summary(index: number): SermonSummary {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    slug: `anonymous-archive-${index}`,
    title: `Anonymous archive example ${index}`,
    serviceDate: "2026-01-04",
    summary: "A synthetic approved description for isolated archive contract tests. It contains no real sermon wording.",
    speaker: { name: "Example Speaker", slug: "example-speaker" },
    series: [], scriptureReferences: [], primaryPassages: [], primaryPassageState: "none", books: [],
    primaryMedia: null
  };
}

function detail(sermon: SermonSummary): SermonDetail {
  return {
    ...sermon, seoDescription: null, body: null, media: [],
    transcript: { bodyText: "Anonymous transcript opening.\n\nAnonymous transcript closing." },
    questionAnswers: [], relatedSermons: []
  };
}

function source(sermons: SermonSummary[], details = sermons.map(detail)) {
  return {
    listPublished: vi.fn(async () => ({ data: sermons, totalItems: 100 })),
    findPublishedBySlug: vi.fn(async (slug: string) => details.find(item => item.slug === slug) ?? null),
    listPublishedFilterOptions: vi.fn(async () => emptyFilterOptions),
    listPublishedTopicalSermons: vi.fn(async () => []),
    listPublishedSeriesRepresentatives: vi.fn(async () => []),
    listPublishedSitemapEntries: vi.fn(async () => []),
    findPublicPathDisposition: vi.fn(async () => null)
  } satisfies PublicSermonRepository;
}

beforeEach(() => vi.clearAllMocks());

describe("V5 eligible archive description scope", () => {
  it.each([publicRenderContext, restrictedRenderContext])("uses only paginated summaries from the injected $mode repository without detail reads", async (context) => {
    const listed = [summary(1), summary(2)];
    const excluded = detail(summary(99));
    const details = listed.map(detail);
    const repository = source(listed, [...details, excluded]);
    const handler = createAlternateArchiveHandlers(repository, context);
    const response = await handler(new Request("http://127.0.0.1/sermons-v5/?s=example"));
    expect(response?.status).toBe(200);
    expect(repository.listPublished).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ query: "example", pageSize: 9 }));
    expect(repository.findPublishedBySlug).not.toHaveBeenCalled();
    expect(renderSermonsV5Page).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ sermons: listed }), context);
    const renderedInput = vi.mocked(renderSermonsV5Page).mock.calls[0]![0];
    expect(renderedInput.sermons).toBe(listed);
    expect(renderedInput).not.toHaveProperty("details");
    expect(renderedInput.sermons).not.toContainEqual(excluded);
    expect(JSON.stringify(renderedInput)).not.toContain("Anonymous transcript opening.");
    expect(repository.listPublishedTopicalSermons).not.toHaveBeenCalled();
    expect(repository.listPublishedSeriesRepresentatives).not.toHaveBeenCalled();
    expect(response?.headers.get("cache-control")).toContain("no-store");
    expect(response?.headers.get("x-robots-tag")).toBe(context.mode === "public" ? "noindex, follow" : "noindex, nofollow, noarchive");
  });

  it("preserves complete descriptions and page ordering independently of unavailable details", async () => {
    const listed = [summary(4), summary(3)];
    listed[0]!.summary = "A synthetic description opening.\n\n" + "This anonymous paragraph remains complete. ".repeat(24) + "The synthetic description ends here.";
    const repository = source(listed);
    repository.findPublishedBySlug.mockRejectedValue(new Error("Detail lookup must not be reached"));
    const response = await createAlternateArchiveHandlers(repository, publicRenderContext)(new Request("http://127.0.0.1/sermons-v5/page/2/?sermon_speaker=example-speaker"));
    expect(response?.status).toBe(200);
    expect(repository.listPublished).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ page: 2, pageSize: 9, speaker: "example-speaker" }));
    expect(repository.findPublishedBySlug).not.toHaveBeenCalled();
    expect(renderSermonsV5Page).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ sermons: listed }), publicRenderContext);
    expect(vi.mocked(renderSermonsV5Page).mock.calls[0]![0].sermons[0]!.summary).toBe(listed[0]!.summary);
  });

  it.each(["/frontend-preview", "/draft-preview"] as const)("denies %s before any summary or transcript lookup", async (root) => {
    const repository = source([summary(1)]);
    const handler = createLocalFrontendPreviewHandler(repository, { authorizes: () => false }, { root });
    const response = await handler(new Request(`http://127.0.0.1${root}/sermons-v5/`));
    expect(response?.status).toBe(401);
    expect(repository.listPublished).not.toHaveBeenCalled();
    expect(repository.listPublishedFilterOptions).not.toHaveBeenCalled();
    expect(repository.listPublishedTopicalSermons).not.toHaveBeenCalled();
    expect(repository.listPublishedSeriesRepresentatives).not.toHaveBeenCalled();
    expect(repository.findPublishedBySlug).not.toHaveBeenCalled();
    expect(renderSermonsV5Page).not.toHaveBeenCalled();
  });

  it("loads summaries through the protected handler after authorization and retains privacy headers", async () => {
    const listed = [summary(1)];
    const repository = source(listed);
    const handler = createLocalFrontendPreviewHandler(repository, { authorizes: () => true });
    const response = await handler(new Request("http://127.0.0.1/frontend-preview/sermons-v5/"));
    expect(response?.status).toBe(200);
    expect(repository.listPublished).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ page: 1, pageSize: 9 }));
    expect(repository.findPublishedBySlug).not.toHaveBeenCalled();
    expect(renderSermonsV5Page).toHaveBeenCalledWith(expect.objectContaining({ sermons: listed }), expect.objectContaining({ mode: "preview" }));
    expect(response?.headers.get("cache-control")).toContain("private, no-store");
    expect(response?.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
  });

  it.each(["v1", "v4"])("leaves %s as a summary-only presentation", async (presentation) => {
    const repository = source([summary(1)]);
    const response = await createAlternateArchiveHandlers(repository, publicRenderContext)(new Request(`http://127.0.0.1/sermons-${presentation}/`));
    expect(response?.status).toBe(200);
    expect(repository.findPublishedBySlug).not.toHaveBeenCalled();
    expect(renderSermonsV5Page).not.toHaveBeenCalled();
  });

  it("returns the generic unavailable response if summary loading fails", async () => {
    const repository = source([summary(1)]);
    repository.listPublished.mockRejectedValue(new Error("Anonymous backend failure"));
    const response = await createAlternateArchiveHandlers(repository, publicRenderContext)(new Request("http://127.0.0.1/sermons-v5/"));
    expect(response?.status).toBe(500);
    expect(await response!.text()).not.toContain("Anonymous backend failure");
    expect(repository.findPublishedBySlug).not.toHaveBeenCalled();
    expect(renderSermonsV5Page).not.toHaveBeenCalled();
  });
});

describe("stored media duration projection", () => {
  const media = {
    provider: "youtube", mediaType: "video", externalId: "abcdefghijk",
    canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk", title: "Anonymous media fixture"
  };

  it("retains supplied duration metadata and leaves absent duration absent", () => {
    expect(publicMediaSchema.parse({ ...media, durationSeconds: 3671 }).durationSeconds).toBe(3671);
    expect(publicMediaSchema.parse(media)).not.toHaveProperty("durationSeconds");
    expect(publicMediaSchema.parse({ ...media, durationSeconds: null }).durationSeconds).toBeNull();
    for (const durationSeconds of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
      expect(publicMediaSchema.safeParse({ ...media, durationSeconds }).success).toBe(false);
    }
  });

  it("projects the existing selected media column without adding transcript bodies to list queries", () => {
    const list = buildPublishedSermonListQuery(publicSermonListQuerySchema.parse({}));
    const full = buildPublishedSermonDetailQuery("anonymous-archive-1");
    expect(list.text).toContain("'durationSeconds', media.duration_seconds");
    expect(list.text).toContain("ORDER BY media.is_primary DESC, media.display_order, media.id");
    expect(list.text).not.toContain(" AS transcript");
    expect(full.text.match(/'durationSeconds', media\.duration_seconds/gu)).toHaveLength(2);
    expect(full.text).toContain("transcript.status = 'approved'");
  });
});


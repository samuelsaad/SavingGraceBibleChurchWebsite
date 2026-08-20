import { describe, expect, it } from "vitest";
import type { PublicSermonListQuery } from "../src/api/contracts/public-sermons";
import type { SermonDetail, SermonSummary } from "../src/domain/sermon";
import { createPublicApiRouter } from "../src/server/http/public-api-router";
import type {
  PaginatedSermons,
  PublicSermonFilterOptions,
  PublicSermonPathDisposition,
  PublicSermonRepository
} from "../src/server/repositories/sermon-repository";

const summary: SermonSummary = {
  id: "75df2144-b557-50f6-98bd-011cd696bfb9",
  title: "An anonymised sermon",
  slug: "an-anonymised-sermon",
  serviceDate: "2026-08-02",
  summary: null,
  speaker: { name: "Example Speaker", slug: "example-speaker" },
  series: [{ name: "Example Series", slug: "example-series" }],
  scriptureReferences: [{ displayText: "Romans 8:1", parseStatus: "exact" }],
  primaryPassages: [{ displayText: "Romans 8:1", isLead: true }],
  books: [{ name: "Romans", slug: "romans" }],
  primaryMedia: {
    provider: "youtube",
    mediaType: "video",
    externalId: "abcdefghijk",
    canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    title: "Video: An anonymised sermon"
  }
};

const detail: SermonDetail = {
  ...summary,
  seoDescription: null,
  body: null,
  media: [summary.primaryMedia!],
  transcript: { bodyText: "An approved transcript." },
  questionAnswers: [
    { question: "What does grace change?", answer: "It changes how we live.", displayOrder: 1 }
  ],
  relatedSermons: []
};

class FakeRepository implements PublicSermonRepository {
  lastQuery: PublicSermonListQuery | null = null;

  async listPublished(query: PublicSermonListQuery): Promise<PaginatedSermons> {
    this.lastQuery = query;
    return { data: [summary], totalItems: 1 };
  }

  async findPublishedBySlug(slug: string): Promise<SermonDetail | null> {
    return slug === detail.slug ? detail : null;
  }

  async listPublishedFilterOptions(): Promise<PublicSermonFilterOptions> {
    return { speakers: [], series: [], passages: [], books: [] };
  }

  async listPublishedSitemapEntries() {
    return [];
  }

  async findPublicPathDisposition(): Promise<PublicSermonPathDisposition | null> {
    return null;
  }
}

describe("public sermon HTTP vertical slice", () => {
  it("serves legacy-compatible list filters with pagination metadata", async () => {
    const repository = new FakeRepository();
    const route = createPublicApiRouter(repository);
    const response = await route(
      new Request(
        "http://localhost/api/v1/sermons?s=grace&sermon_speaker=example-speaker&sermon_dates=2026-08-02%20-%202026-08-09"
      )
    );

    expect(response.status).toBe(200);
    expect(repository.lastQuery).toMatchObject({
      query: "grace",
      speaker: "example-speaker",
      dateFrom: "2026-08-02",
      dateTo: "2026-08-09",
      page: 1,
      pageSize: 9
    });
    expect(await response.json()).toMatchObject({
      data: [{ slug: "an-anonymised-sermon" }],
      pagination: { totalItems: 1, totalPages: 1 }
    });
  });

  it("serves safe detail media and never returns source embed markup", async () => {
    const route = createPublicApiRouter(new FakeRepository());
    const response = await route(
      new Request("http://localhost/api/v1/sermons/an-anonymised-sermon")
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("abcdefghijk");
    expect(body).not.toContain("<iframe");
    expect(body).not.toContain("post_views_count");
    expect(body).not.toContain("legacyViewCount");
    expect(body).toContain("An approved transcript");
  });

  it("returns controlled validation, visibility-safe 404, and method errors", async () => {
    const route = createPublicApiRouter(new FakeRepository());
    expect(
      (await route(new Request("http://localhost/api/v1/sermons?dateFrom=2026-08-09&dateTo=2026-08-02"))).status
    ).toBe(400);
    expect(
      (await route(new Request("http://localhost/api/v1/sermons/not-published"))).status
    ).toBe(404);
    expect(
      (await route(new Request("http://localhost/api/v1/sermons", { method: "POST" }))).status
    ).toBe(405);
  });

  it("keeps large transcript and Q&A bodies out of list responses", async () => {
    const route = createPublicApiRouter(new FakeRepository());
    const body = await (await route(new Request("http://localhost/api/v1/sermons"))).text();

    expect(body).not.toContain("An approved transcript");
    expect(body).not.toContain("What does grace change");
  });
});

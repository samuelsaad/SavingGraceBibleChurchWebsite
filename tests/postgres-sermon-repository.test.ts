import { describe, expect, it } from "vitest";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import { PostgresSermonRepository, type SqlExecutor } from "../src/server/repositories/postgres-sermon-repository";

const row = {
  id: "75df2144-b557-50f6-98bd-011cd696bfb9",
  title: "An anonymised sermon",
  slug: "an-anonymised-sermon",
  service_date: "2026-08-02",
  summary: null,
  body: null,
  speaker: { name: "Example Speaker", slug: "example-speaker" },
  series: [],
  scripture_references: [{ displayText: "Romans 8:1", parseStatus: "exact" }],
  books: [{ name: "Romans", slug: "romans" }],
  primary_media: null,
  media: [],
  transcript: { bodyText: "Approved transcript" },
  question_answers: [{ question: "Why?", answer: "Grace.", displayOrder: 1 }],
  total_items: 1
};

const relatedRow = {
  ...row,
  id: "c964f4c0-182b-4de3-ac7b-5fb5fa6587ae",
  title: "A related anonymised sermon",
  slug: "a-related-anonymised-sermon",
  relationship_reasons: ["same_series"]
};

describe("PostgreSQL sermon repository", () => {
  it("maps a parameterized published list projection", async () => {
    const calls: Array<{ text: string; values: unknown[] | undefined }> = [];
    const executor: SqlExecutor = {
      async query(text, values) {
        calls.push({ text, values });
        const rows = text.includes("WITH current_sermon") ? [relatedRow] : [row];
        return { rows, rowCount: 1, command: "SELECT", oid: 0, fields: [] };
      }
    };
    const repository = new PostgresSermonRepository(executor);
    const result = await repository.listPublished(
      publicSermonListQuerySchema.parse({ speaker: "example-speaker" })
    );

    expect(result).toMatchObject({ totalItems: 1, data: [{ slug: row.slug }] });
    expect(calls[0]?.text).toContain("s.status = 'published'");
    expect(calls[0]?.text).not.toContain("example-speaker");
    expect(calls[0]?.values).toContain("example-speaker");
    expect(calls[0]?.text).not.toContain("sermon_legacy_metrics");
    expect(calls[0]?.text).not.toContain("sermon_media_source_audit");
  });

  it("performs a visibility-safe slug lookup", async () => {
    const calls: Array<{ text: string; values: unknown[] | undefined }> = [];
    const executor: SqlExecutor = {
      async query(text, values) {
        calls.push({ text, values });
        const rows = text.includes("WITH current_sermon") ? [relatedRow] : [row];
        return { rows, rowCount: 1, command: "SELECT", oid: 0, fields: [] };
      }
    };
    const repository = new PostgresSermonRepository(executor);
    const result = await repository.findPublishedBySlug("an-anonymised-sermon");

    expect(result?.media).toEqual([]);
    expect(result?.transcript?.bodyText).toBe("Approved transcript");
    expect(result?.relatedSermons).toMatchObject([
      { slug: "a-related-anonymised-sermon", relationshipReasons: ["same_series"] }
    ]);
    expect(calls[0]?.text).toContain("s.status = 'published'");
    expect(calls[0]?.values).toEqual(["an-anonymised-sermon"]);
    expect(calls[1]?.text).toContain("candidate.status = 'published'");
    expect(calls[1]?.text).toContain("ORDER BY s.related_score DESC, s.service_date DESC, s.id");
  });

  it("maps published-only filter options, sitemap entries, and reviewed dispositions", async () => {
    const calls: Array<{ text: string; values: unknown[] | undefined }> = [];
    const executor: SqlExecutor = {
      async query(text, values) {
        calls.push({ text, values });
        if (text.includes("AS speakers")) {
          return {
            rows: [{
              speakers: [{ name: "Example Speaker", slug: "example-speaker" }],
              series: [{ name: "Example Series", slug: "example-series" }],
              passages: [{ name: "Romans 8", slug: "romans-8" }],
              books: [{ name: "Romans", slug: "romans" }]
            }], rowCount: 1, command: "SELECT", oid: 0, fields: []
          };
        }
        if (text.includes("last_modified")) {
          return {
            rows: [{ slug: "an-anonymised-sermon", last_modified: "2026-08-02" }],
            rowCount: 1, command: "SELECT", oid: 0, fields: []
          };
        }
        return {
          rows: [{ status_code: 301, new_path: "/sermons/an-anonymised-sermon/" }],
          rowCount: 1, command: "SELECT", oid: 0, fields: []
        };
      }
    };
    const repository = new PostgresSermonRepository(executor);

    await expect(repository.listPublishedFilterOptions()).resolves.toMatchObject({
      speakers: [{ slug: "example-speaker" }],
      books: [{ slug: "romans" }]
    });
    await expect(repository.listPublishedSitemapEntries()).resolves.toEqual([
      { slug: "an-anonymised-sermon", lastModified: "2026-08-02" }
    ]);
    await expect(repository.findPublicPathDisposition("/sermons/old-sermon/")).resolves.toEqual({
      kind: "redirect",
      location: "/sermons/an-anonymised-sermon/"
    });

    expect(calls[0]?.text.match(/sermon.status = 'published'/g)).toHaveLength(4);
    expect(calls[1]?.text).toContain("status = 'published'");
    expect(calls[2]?.values).toEqual(["/sermons/old-sermon/"]);
  });
});

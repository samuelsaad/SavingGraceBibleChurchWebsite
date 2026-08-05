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
  speakers: [{ name: "Example Speaker", slug: "example-speaker" }],
  series: [],
  scripture_references: [{ displayText: "Romans 8:1", parseStatus: "exact" }],
  books: [{ name: "Romans", slug: "romans" }],
  primary_media: null,
  media: [],
  total_items: 1
};

describe("PostgreSQL sermon repository", () => {
  it("maps a parameterized published list projection", async () => {
    const calls: Array<{ text: string; values: unknown[] | undefined }> = [];
    const executor: SqlExecutor = {
      async query(text, values) {
        calls.push({ text, values });
        return { rows: [row], rowCount: 1, command: "SELECT", oid: 0, fields: [] };
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
        return { rows: [row], rowCount: 1, command: "SELECT", oid: 0, fields: [] };
      }
    };
    const repository = new PostgresSermonRepository(executor);
    const result = await repository.findPublishedBySlug("an-anonymised-sermon");

    expect(result?.media).toEqual([]);
    expect(calls[0]?.text).toContain("s.status = 'published'");
    expect(calls[0]?.values).toEqual(["an-anonymised-sermon"]);
  });
});

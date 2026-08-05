import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("PostgreSQL schema contract", () => {
  it("contains the required normalized and audit structures", async () => {
    const sql = await readFile("db/migrations/0001_initial.sql", "utf8");

    for (const table of [
      "sermons",
      "sermon_legacy_metrics",
      "sermon_speakers",
      "sermon_series_map",
      "scripture_references",
      "scripture_reference_sources",
      "sermon_media",
      "sermon_media_source_audit",
      "migration_records",
      "migration_warnings",
      "redirects"
    ]) {
      expect(sql).toContain(`CREATE TABLE ${table}`);
    }

    expect(sql).toContain("USING gin (search_vector)");
    expect(sql).toContain("lower(slug)");
    expect(sql).toContain("source_wordpress_id bigint UNIQUE");
    const sermonsDefinition = sql.match(/CREATE TABLE sermons \(([\s\S]*?)\n\);/)?.[1] ?? "";
    expect(sermonsDefinition).not.toContain("legacy_view_count");
    expect(sql).toContain("Never expose legacy counters through public API responses");
    expect(sql).not.toMatch(/CREATE TABLE\s+postmeta/i);
  });

  it("has an explicit reversible local rollback", async () => {
    const down = await readFile("db/migrations/0001_initial.down.sql", "utf8");
    expect(down).toContain("DROP TABLE IF EXISTS sermons");
    expect(down).toContain("DROP TABLE IF EXISTS sermon_legacy_metrics");
    expect(down).not.toContain("DROP EXTENSION");
  });

  it("adds reversible ownership, taxonomy concurrency, and safe audit outcomes", async () => {
    const [up, down] = await Promise.all([
      readFile("db/migrations/0002_admin_foundation.sql", "utf8"),
      readFile("db/migrations/0002_admin_foundation.down.sql", "utf8")
    ]);
    expect(up).toContain("created_by_subject");
    expect(up).toContain("updated_by_subject");
    expect(up).toContain("'admin', 'editor', 'contributor', 'system'");
    expect(up).toContain("ADD COLUMN outcome");
    expect(up.match(/ADD COLUMN row_version/g)).toHaveLength(3);
    expect(down).toContain("DROP COLUMN IF EXISTS created_by_subject");
    expect(down).toContain("DROP COLUMN IF EXISTS outcome");
  });

  it("adds reversible permanent-deletion tombstones and redirect/gone dispositions", async () => {
    const [up, down] = await Promise.all([
      readFile("db/migrations/0003_single_admin_deletion_seo.sql", "utf8"),
      readFile("db/migrations/0003_single_admin_deletion_seo.down.sql", "utf8")
    ]);
    expect(up).toContain("CREATE TABLE sermon_deletion_tombstones");
    expect(up).toContain("status_code IN (301, 302, 307, 308, 410)");
    expect(up).toContain("former_sermon_id uuid NOT NULL UNIQUE");
    expect(up).toContain("actor_role text NOT NULL DEFAULT 'admin'");
    expect(up).toContain("CHECK (actor_role IN ('admin', 'system'))");
    expect(up).toContain("Never store deleted body, media, source provenance");
    expect(up).not.toContain("former_title");
    expect(down).toContain("DROP TABLE IF EXISTS sermon_deletion_tombstones");
    expect(down).toContain("DROP COLUMN source_sermon_id");
  });
});

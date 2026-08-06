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

  it("reversibly replaces multi-speaker joins with one speaker and enrichment records", async () => {
    const [up, down] = await Promise.all([
      readFile("db/migrations/0004_sermon_enrichment_readiness.sql", "utf8"),
      readFile("db/migrations/0004_sermon_enrichment_readiness.down.sql", "utf8")
    ]);
    expect(up).toContain("HAVING count(*) > 1");
    expect(up).toContain("Migration 0004 refused multiple speaker relationships for sermon IDs");
    expect(up).toContain("ADD COLUMN speaker_id uuid");
    expect(up).toContain("DROP TABLE sermon_speakers");
    expect(up).toContain("CREATE TABLE sermon_transcripts");
    expect(up).toContain("CREATE TABLE sermon_question_answers");
    expect(up).toContain("CREATE VIEW sermon_content_readiness");
    expect(up).toContain("transcript_search_document");
    expect(up).toContain("question_answer_search_document");
    expect(down).toContain("CREATE TABLE sermon_speakers");
    expect(down).toContain("DROP TABLE IF EXISTS sermon_transcripts");
    expect(down).toContain("DROP COLUMN speaker_id");
  });

  it("reuses summary with a reversible approved-description lifecycle and approved-only search", async () => {
    const [up, down] = await Promise.all([
      readFile("db/migrations/0005_approved_sermon_descriptions.sql", "utf8"),
      readFile("db/migrations/0005_approved_sermon_descriptions.down.sql", "utf8")
    ]);
    expect(up).toContain("ADD COLUMN summary_status");
    expect(up).toContain("ADD COLUMN seo_description");
    expect(up).toContain("summary_search_document");
    expect(up).toContain("has_approved_description");
    expect(up).toContain("summary_status = 'approved'");
    expect(up).toContain("seo_description IS NULL OR summary_status = 'approved'");
    expect(up).not.toMatch(/ADD COLUMN (description|blurb)\b/);
    expect(down).toContain("DROP COLUMN IF EXISTS summary_status");
    expect(down).toContain("DROP CONSTRAINT IF EXISTS sermons_summary_plain_text_check");
    expect(down).toContain("coalesce(summary, '')");
  });

  it("stores reversible private Phase 3B.2 source provenance without sermon bodies", async () => {
    const [up, down] = await Promise.all([
      readFile("db/migrations/0006_phase3b2_pilot_provenance.sql", "utf8"),
      readFile("db/migrations/0006_phase3b2_pilot_provenance.down.sql", "utf8")
    ]);
    expect(up).toContain("CREATE TABLE sermon_enrichment_sources");
    expect(up).toContain("authorised_youtube_studio_export");
    expect(up).toContain("source_content_sha256");
    expect(up).toContain("warnings jsonb");
    expect(up).toContain("accuracy_review_status");
    expect(up).not.toMatch(/source_(?:body|transcript)_text/);
    expect(down).toContain("DROP TABLE IF EXISTS sermon_enrichment_sources");
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

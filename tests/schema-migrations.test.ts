import { describe, expect, it } from "vitest";
import {
  SchemaMigrationError,
  loadSchemaMigrations,
  normalizeMigrationSql,
  schemaMigrationChecksum,
  validateSchemaMigrationJournal,
  type SchemaMigrationJournalRow
} from "../src/migration/schema-migrations";

function receipts(
  migrations: Awaited<ReturnType<typeof loadSchemaMigrations>>,
  count = migrations.length
): SchemaMigrationJournalRow[] {
  return migrations.slice(0, count).map((migration) => ({
    migration_order: migration.order,
    migration_id: migration.id,
    checksum_sha256: migration.checksumSha256
  }));
}

describe("journalled PostgreSQL schema migrations", () => {
  it("normalises supported line endings before hashing paired up/down definitions", () => {
    const upLf = "BEGIN;\nSELECT 1;\nCOMMIT;\n";
    const downLf = "BEGIN;\nSELECT 2;\nCOMMIT;\n";
    expect(normalizeMigrationSql(upLf.replace(/\n/g, "\r\n"))).toBe(upLf);
    expect(schemaMigrationChecksum(upLf, downLf)).toBe(
      schemaMigrationChecksum(upLf.replace(/\n/g, "\r\n"), downLf.replace(/\n/g, "\r\n"))
    );
    expect(schemaMigrationChecksum(upLf, downLf)).not.toBe(
      schemaMigrationChecksum(upLf, downLf.replace("SELECT 2", "SELECT 3"))
    );
    expect(schemaMigrationChecksum(upLf, downLf)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("loads the seventeen canonical paired migrations in stable order", async () => {
    const migrations = await loadSchemaMigrations();
    expect(migrations.map((migration) => migration.id)).toEqual([
      "0001_initial",
      "0002_admin_foundation",
      "0003_single_admin_deletion_seo",
      "0004_sermon_enrichment_readiness",
      "0005_approved_sermon_descriptions",
      "0006_phase3b2_pilot_provenance",
      "0007_guided_sermon_review",
      "0008_atomic_sermon_review_items",
      "0009_pilot_completion_safeguards",
      "0010_zero_finding_guided_review",
      "0011_description_semantic_relationships",
      "0012_description_semantic_runtime_provenance",
      "0013_official_youtube_caption_provenance",
      "0014_primary_preaching_passages",
      "0015_optional_passage_and_grounding_identity",
      "0016_legacy_completed_passage_reviews",
      "0017_delegated_private_ai_review"
    ]);
    expect(migrations.map((migration) => migration.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(migrations.every((migration) => !/^\s*BEGIN;/i.test(migration.upBody))).toBe(true);
    expect(migrations.every((migration) => !/COMMIT;\s*$/i.test(migration.downBody))).toBe(true);
  });

  it("prevents a new guided review from completing with an unresolved passage decision", async () => {
    const migration = (await loadSchemaMigrations()).find((item) =>
      item.id === "0016_legacy_completed_passage_reviews"
    );
    expect(migration?.upBody).toContain("completed_enrichment_review_requires_primary_passage_decision");
    expect(migration?.upBody).toContain("sermon_enrichment_reviews_passage_decision_consistency");
    expect(migration?.upBody).not.toContain("SAMUEL-LEGACY-PASSAGE-REVIEW-CARRY-FORWARD-2026-08-31");
    expect(migration?.downBody).toContain("DROP FUNCTION enforce_completed_enrichment_review_passage_decision");
  });

  it("defines optional passage readiness and immutable transcript grounding in migration 0015", async () => {
    const migration = (await loadSchemaMigrations()).find((item) => item.id === "0015_optional_passage_and_grounding_identity");
    expect(migration?.upBody).toContain("grounding_revision_id uuid NOT NULL DEFAULT gen_random_uuid()");
    expect(migration?.upBody).toContain("rotate_sermon_transcript_grounding_revision");
    expect(migration?.upBody).toContain("NEW.body_text IS DISTINCT FROM OLD.body_text");
    expect(migration?.upBody).toContain("NEW.source_reference IS DISTINCT FROM OLD.source_reference");
    expect(migration?.upBody).toContain("relationship_role <> 'primary' OR canonical_book_id IS NOT NULL");
    expect(migration?.upBody).toContain("review.review_status = 'confirmed_none'");
    expect(migration?.downBody).toContain("DROP TABLE sermon_transcript_legacy_grounding_bindings");
  });

  it("accepts only an exact canonical prefix with matching checksums", async () => {
    const migrations = await loadSchemaMigrations();
    expect(validateSchemaMigrationJournal(migrations, [])).toBe(0);
    expect(validateSchemaMigrationJournal(migrations, receipts(migrations, 3))).toBe(3);
    expect(validateSchemaMigrationJournal(migrations, receipts(migrations))).toBe(17);
  });

  it("fails closed on duplicate, unknown, missing, reordered and changed receipts", async () => {
    const migrations = await loadSchemaMigrations();
    const valid = receipts(migrations);
    const cases: Array<{ rows: SchemaMigrationJournalRow[]; code: SchemaMigrationError["code"] }> = [
      { rows: [valid[0]!, { ...valid[0]!, migration_order: 2 }], code: "journal_state_failure" },
      {
        rows: [...valid, { migration_order: 8, migration_id: "0008_unknown", checksum_sha256: "a".repeat(64) }],
        code: "journal_state_failure"
      },
      { rows: [valid[0]!, valid[2]!], code: "journal_state_failure" },
      {
        rows: [valid[0]!, { ...valid[1]!, migration_id: "0003_single_admin_deletion_seo" }],
        code: "journal_state_failure"
      },
      { rows: [{ ...valid[0]!, checksum_sha256: "f".repeat(64) }], code: "migration_checksum_mismatch" }
    ];
    for (const item of cases) {
      try {
        validateSchemaMigrationJournal(migrations, item.rows);
        throw new Error("Expected invalid journal state to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaMigrationError);
        expect((error as SchemaMigrationError).code).toBe(item.code);
      }
    }
  });
});

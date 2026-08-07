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

  it("loads the seven canonical paired migrations in stable order", async () => {
    const migrations = await loadSchemaMigrations();
    expect(migrations.map((migration) => migration.id)).toEqual([
      "0001_initial",
      "0002_admin_foundation",
      "0003_single_admin_deletion_seo",
      "0004_sermon_enrichment_readiness",
      "0005_approved_sermon_descriptions",
      "0006_phase3b2_pilot_provenance",
      "0007_guided_sermon_review"
    ]);
    expect(migrations.map((migration) => migration.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(migrations.every((migration) => !/^\s*BEGIN;/i.test(migration.upBody))).toBe(true);
    expect(migrations.every((migration) => !/COMMIT;\s*$/i.test(migration.downBody))).toBe(true);
  });

  it("accepts only an exact canonical prefix with matching checksums", async () => {
    const migrations = await loadSchemaMigrations();
    expect(validateSchemaMigrationJournal(migrations, [])).toBe(0);
    expect(validateSchemaMigrationJournal(migrations, receipts(migrations, 3))).toBe(3);
    expect(validateSchemaMigrationJournal(migrations, receipts(migrations))).toBe(7);
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

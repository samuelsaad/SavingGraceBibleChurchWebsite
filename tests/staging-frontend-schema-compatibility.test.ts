import { describe, expect, it, vi } from "vitest";
import { stagingSchemaExpectation, verifyReleaseSchema } from "../src/staging/database-verification";
import { loadSchemaMigrations } from "../src/migration/schema-migrations";

describe("frontend-only staging schema compatibility", () => {
  it("keeps the normal exact 22-migration expectation", () => {
    expect(stagingSchemaExpectation({})).toBe(22);
    expect(stagingSchemaExpectation({ STAGING_SCHEMA_MIGRATIONS: "22" })).toBe(22);
  });
  it("admits an explicit 21 ledger only for the existing D-161 selector", () => {
    expect(stagingSchemaExpectation({ STAGING_SCHEMA_MIGRATIONS: "21", D161_RESTRICTED_ACCEPTANCE_ENABLED: "1" })).toBe(21);
    for (const env of [
      { STAGING_SCHEMA_MIGRATIONS: "20", D161_RESTRICTED_ACCEPTANCE_ENABLED: "1" },
      { STAGING_SCHEMA_MIGRATIONS: "21" },
      { STAGING_SCHEMA_MIGRATIONS: "21", D161_RESTRICTED_ACCEPTANCE_ENABLED: "1", D162_RESTRICTED_ACCEPTANCE_ENABLED: "1" },
      { STAGING_SCHEMA_MIGRATIONS: "21", D161_RESTRICTED_ACCEPTANCE_ENABLED: "1", D167_RESTRICTED_ACCEPTANCE_ENABLED: "1" },
    ]) expect(() => stagingSchemaExpectation(env)).toThrow("staging_schema_configuration_refused");
  });
  it("still verifies exact ordered checksums and refuses other prefix lengths or drift", async () => {
    const migrations = await loadSchemaMigrations();
    const rows = migrations.slice(0, 21).map(m => ({ migration_order: m.order, migration_id: m.id, checksum_sha256: m.checksumSha256 }));
    const client = { query: vi.fn().mockResolvedValue({ rows }) };
    await expect(verifyReleaseSchema(client, 21)).resolves.toEqual({ migrations: 21, pending: migrations.length - 21 });
    await expect(verifyReleaseSchema(client, 22)).rejects.toThrow();
    client.query.mockResolvedValue({ rows: rows.slice(0, 20) });
    await expect(verifyReleaseSchema(client, 21)).rejects.toThrow();
    client.query.mockResolvedValue({ rows: [...rows.slice(0, 20), { ...rows[20], checksum_sha256: "0".repeat(64) }] });
    await expect(verifyReleaseSchema(client, 21)).rejects.toThrow();
  });
});

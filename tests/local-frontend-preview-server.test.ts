import { describe, expect, it } from "vitest";
import {
  assertReadOnlyLocalDatabase,
  authorisedReadOnlyPreviewDatabaseName
} from "../src/migration/local-database-safety";
import { createPostgresPool } from "../src/server/database";

describe("read-only local frontend preview server boundary", () => {
  it("allows only the exact loopback test database without a write opt-in", () => {
    expect(() => assertReadOnlyLocalDatabase(
      "postgresql://127.0.0.1:5432/savinggrace_sermons_test"
    )).not.toThrow();
    for (const target of [
      "postgresql://127.0.0.1:5432/postgres",
      "postgresql://db.example.test:5432/savinggrace_sermons_test",
      "postgresql://127.0.0.1:5433/savinggrace_sermons_test"
    ]) {
      expect(() => assertReadOnlyLocalDatabase(target)).toThrow();
    }
  });

  it("allows only the token-bound disposable database for an integration preview", () => {
    const token = "20260901abcdef0123456789abcd";
    const target = `postgresql://127.0.0.1:5432/savinggrace_test_run_${token}`;
    expect(authorisedReadOnlyPreviewDatabaseName(target, {
      RUN_POSTGRES_INTEGRATION: "1",
      TEST_DATABASE_URL: target,
      DISPOSABLE_TEST_DATABASE_TOKEN: token,
      ALLOW_LOCAL_DB_WRITE: "1"
    })).toBe(`savinggrace_test_run_${token}`);
    expect(() => authorisedReadOnlyPreviewDatabaseName(target, {
      RUN_POSTGRES_INTEGRATION: "1",
      TEST_DATABASE_URL: "postgresql://127.0.0.1:5432/savinggrace_sermons_test",
      DISPOSABLE_TEST_DATABASE_TOKEN: token,
      ALLOW_LOCAL_DB_WRITE: "1"
    })).toThrow();
  });

  it("configures read-only PostgreSQL sessions independently of application queries", () => {
    const pool = createPostgresPool(
      "postgresql://127.0.0.1:5432/savinggrace_sermons_test",
      { readOnly: true, max: 2 }
    );
    const settings = pool.options as unknown as {
      max: number;
      application_name: string;
      options: string;
    };
    expect(settings).toMatchObject({
      max: 2,
      application_name: "saving-grace-frontend-preview-read-only",
      options: "-c default_transaction_read_only=on"
    });
    void pool.end();
  });
});

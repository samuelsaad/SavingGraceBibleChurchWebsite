import { describe, expect, it } from "vitest";
import {
  assertDisposableIntegrationTestDatabase,
  assertDisposableLocalDatabase,
  disposableIntegrationDatabaseName
} from "../src/migration/local-database-safety";

describe("local fixture loader safety gate", () => {
  it("accepts only opted-in loopback disposable database names", () => {
    expect(() =>
      assertDisposableLocalDatabase(
        "postgresql://local@127.0.0.1:5432/savinggrace_sermons_test",
        "1"
      )
    ).not.toThrow();
    expect(() =>
      assertDisposableLocalDatabase(
        "postgresql://local@db.example.test:5432/saving_grace_test",
        "1"
      )
    ).toThrow("loopback PostgreSQL");
    expect(() =>
      assertDisposableLocalDatabase(
        "postgresql://local@127.0.0.1:5432/another_test",
        "1"
      )
    ).toThrow("restricted to savinggrace_sermons_test");
    expect(() =>
      assertDisposableLocalDatabase(
        "postgresql://local@127.0.0.1:5433/savinggrace_sermons_test",
        "1"
      )
    ).toThrow("loopback PostgreSQL");
    expect(() =>
      assertDisposableLocalDatabase(
        "postgresql://local@127.0.0.1:5432/savinggrace_sermons_test",
        "0"
      )
    ).toThrow("opt in");
  });

  it("accepts only the exact strongly named integration-run database and rejects the pilot", () => {
    const token = "20260810t130000abcdef123456";
    const databaseName = disposableIntegrationDatabaseName(token);
    expect(() => assertDisposableIntegrationTestDatabase(
      `postgresql://127.0.0.1:5432/${databaseName}`,
      token,
      "1"
    )).not.toThrow();
    expect(() => assertDisposableIntegrationTestDatabase(
      "postgresql://127.0.0.1:5432/savinggrace_sermons_test",
      token,
      "1"
    )).toThrow("exact savinggrace_test_run_");
    expect(() => assertDisposableIntegrationTestDatabase(
      `postgresql://127.0.0.1:5432/${databaseName}`,
      "20260810t130000different1234",
      "1"
    )).toThrow("exact savinggrace_test_run_");
    expect(() => assertDisposableIntegrationTestDatabase(
      "postgresql://127.0.0.1:5432/savinggrace_test_run_guessable",
      "guessable",
      "1"
    )).toThrow("run token is invalid");
    expect(() => assertDisposableIntegrationTestDatabase(
      `postgresql://db.example.test:5432/${databaseName}`,
      token,
      "1"
    )).toThrow("loopback PostgreSQL");
    expect(() => assertDisposableIntegrationTestDatabase(
      `postgresql://127.0.0.1:5432/${databaseName}`,
      token,
      "0"
    )).toThrow("opt in");
  });
});

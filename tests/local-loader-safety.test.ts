import { describe, expect, it } from "vitest";
import { assertDisposableLocalDatabase } from "../src/migration/local-database-safety";

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
    ).toThrow("restricted to savinggrace_sermons_test");
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
    ).toThrow("restricted to savinggrace_sermons_test");
    expect(() =>
      assertDisposableLocalDatabase(
        "postgresql://local@127.0.0.1:5432/savinggrace_sermons_test",
        "0"
      )
    ).toThrow("opt in");
  });
});

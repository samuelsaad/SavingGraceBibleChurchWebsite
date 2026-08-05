import { describe, expect, it } from "vitest";
import { parseServerEnvironment } from "../src/config/environment";

describe("server configuration validation", () => {
  it("accepts local PostgreSQL configuration", () => {
    expect(
      parseServerEnvironment({
        DATABASE_URL: "postgresql://local@127.0.0.1:5432/saving_grace_local",
        PUBLIC_SITE_URL: "http://localhost:4321",
        LOG_LEVEL: "info"
      })
    ).toMatchObject({ LOG_LEVEL: "info" });
  });

  it("rejects non-PostgreSQL database URLs", () => {
    expect(() =>
      parseServerEnvironment({
        DATABASE_URL: "mysql://local@127.0.0.1:3306/legacy",
        PUBLIC_SITE_URL: "http://localhost:4321"
      })
    ).toThrow();
  });
});

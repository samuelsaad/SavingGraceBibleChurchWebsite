import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { resolveLocalDashboardAsset } from "../src/server/http/local-dashboard-static";

describe("local dashboard static routing", () => {
  const root = resolve("dist");

  it("maps admin SPA routes and built assets within the local dist root", () => {
    expect(resolveLocalDashboardAsset("/admin", root)).toBe(resolve(root, "admin/index.html"));
    expect(resolveLocalDashboardAsset("/admin/sermons/example", root)).toBe(
      resolve(root, "admin/index.html")
    );
    expect(resolveLocalDashboardAsset("/admin/sermons/example/review", root)).toBe(
      resolve(root, "admin/index.html")
    );
    expect(resolveLocalDashboardAsset("/_astro/dashboard.js", root)).toBe(
      resolve(root, "_astro/dashboard.js")
    );
  });

  it("rejects unrelated and path-traversal requests", () => {
    expect(resolveLocalDashboardAsset("/api/v1/admin/sermons", root)).toBeNull();
    expect(resolveLocalDashboardAsset("/_astro/%2e%2e/package.json", root)).toBeNull();
    expect(resolveLocalDashboardAsset("/%E0%A4%A", root)).toBeNull();
  });
});

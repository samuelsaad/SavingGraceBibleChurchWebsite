import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveLocalDashboardAsset, serveLocalDashboard } from "../src/server/http/local-dashboard-static";

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

  it("adds the preview-session bootstrap only while the local dashboard server is running", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "sgbc-dashboard-"));
    await mkdir(join(fixtureRoot, "admin"));
    await writeFile(join(fixtureRoot, "admin", "index.html"), "<!doctype html><body><main>Admin fixture</main></body>", "utf8");
    const dashboard = await serveLocalDashboard(new Request("http://127.0.0.1/admin"), true, fixtureRoot);
    expect(await dashboard!.text()).toContain('/__local/frontend-preview-link.js');
    const bootstrap = await serveLocalDashboard(new Request("http://127.0.0.1/__local/frontend-preview-link.js"), true, fixtureRoot);
    const script = await bootstrap!.text();
    expect(script).toContain("/api/v1/admin/frontend-preview-session");
    expect(script).toContain("/frontend-preview/");
    expect(await serveLocalDashboard(new Request("http://127.0.0.1/__local/frontend-preview-link.js"), false, fixtureRoot)).toBeNull();
  });
});

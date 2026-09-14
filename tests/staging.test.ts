import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";
import { stagingConfiguration, verifyStagingIdentity } from "../src/staging/guard";
import { createSealedStagingHandler } from "../src/staging/handler";
import { readOnlyVerificationHandler } from "../deployment/read-only-handler";
import { permittedPackagePath } from "../deployment/package-policy.mjs";

const environment = { NODE_ENV: "production", STAGING_SEALED: "1", DB_HOST: "db", DB_PORT: "5432",
  DB_NAME: "savinggrace_staging", RELEASE_COMMIT: "a".repeat(40) };
describe("sealed staging target and authentication boundary", () => {
  it("explicitly preserves strict-mode compilation without relying on unshipped workspace configuration", () => {
    const source = readFileSync(new URL("../deployment/build.mjs", import.meta.url), "utf8");
    expect(source).toContain("tsconfigRaw: { compilerOptions: { alwaysStrict: true } }");
  });
  it("packages private-review schema code without admitting private artifact directories or filenames", () => {
    for (const path of ["db/migrations/0017_delegated_private_ai_review.sql", "db/migrations/0018_remaining_private_ai_review.down.sql", "src/staging/guard.ts"]) {
      expect(permittedPackagePath(path)).toBe(true);
    }
    for (const path of ["private/example.json", "src/private/example.ts", "src/example.private.ts", "development-data/seed.json",
      "src/youtube/example.ts", "src/server/auth/local-test-identity.ts", "key.pem", ".env", "src/../private/file.ts", "/src/test.ts", "src\\test.ts"]) {
      expect(permittedPackagePath(path)).toBe(false);
    }
  });
  it("refuses every review write before reaching the temporary verification router", async () => {
    const read = vi.fn().mockResolvedValue(new Response("fixture"));
    const issue = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const handler = readOnlyVerificationHandler(issue, read);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      for (const path of ["/api/v1/admin/sermons", "/api/v1/admin/sermons/example/review", "/api/v1/admin/remaining-reviews"]) {
        expect((await handler(new Request("http://127.0.0.1" + path, { method }))).status).toBe(405);
      }
    }
    expect(read).not.toHaveBeenCalled(); expect(issue).not.toHaveBeenCalled();
    expect((await handler(new Request("http://example.invalid/api/v1/admin/sermons"))).status).toBe(403);
    expect((await handler(new Request("http://127.0.0.1/api/v1/admin/frontend-preview-session", { method: "POST" }))).status).toBe(204);
    expect(issue).toHaveBeenCalledOnce(); expect(read).not.toHaveBeenCalled();
  });
  it("accepts only the explicit container target and never enables a development identity", () => {
    expect(stagingConfiguration(environment).user).toBe("staging_reader");
    for (const change of [{ DB_HOST: "127.0.0.1" }, { DB_HOST: "remote.example" },
      { DB_NAME: "savinggrace_sermons_test" }, { DB_PORT: "5433" }, { NODE_ENV: "development" },
      { STAGING_SEALED: "0" }, { ENABLE_LOCAL_TEST_IDENTITIES: "1" }, { ENABLE_LOCAL_DASHBOARD: "1" },
      { DATABASE_URL: "forbidden" }, { PGOPTIONS: "forbidden" }, { RELEASE_COMMIT: "main" }]) {
      expect(() => stagingConfiguration({ ...environment, ...change })).toThrow("staging_configuration_refused");
    }
  });
  it("verifies actual database, PostgreSQL version, TCP port, read-only state and non-superuser identity", async () => {
    const row = { database: "savinggrace_staging", role: "staging_reader", version: 160014,
      port: 5432, tcp: true, read_only: "on", superuser: false };
    for (const change of [{}, { database: "other" }, { role: "postgres" }, { version: 170000 },
      { version: 150000 }, { port: 5433 }, { tcp: false }, { read_only: "off" }, { superuser: true }]) {
      const client = { query: vi.fn().mockResolvedValue({ rows: [{ ...row, ...change }] }) };
      if (Object.keys(change).length) await expect(verifyStagingIdentity(client)).rejects.toThrow("staging_target_refused");
      else await expect(verifyStagingIdentity(client)).resolves.toBeUndefined();
    }
  });
  it("denies private routes for every method and ignores forged identity, session and forwarded headers", async () => {
    const repo = new Proxy({}, { get() { throw new Error("private_route_reached_repository"); } }) as PublicSermonRepository;
    const handler = createSealedStagingHandler(repo, vi.fn(), "a".repeat(40));
    for (const path of ["/admin", "/admin/sermons/example/review", "/frontend-preview/", "/__local/frontend-preview-link.js",
      "/api/v1/admin/sermons", "/api/v1/admin/frontend-preview-session", "/%61dmin/sermons"]) {
      for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
        const response = await handler(new Request(`http://127.0.0.1${path}`, { method,
          headers: { "x-local-identity": "admin", cookie: "frontend-preview=anonymized", "x-forwarded-for": "127.0.0.1" } }));
        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(response.headers.get("x-robots-tag")).toContain("noindex");
        expect(await response.text()).toBe("staging_authentication_not_configured");
      }
    }
  });
  it("readiness really depends on the database and never exposes raw errors", async () => {
    const ready = vi.fn().mockResolvedValue(undefined);
    const handler = createSealedStagingHandler({} as PublicSermonRepository, ready, "a".repeat(40));
    expect((await handler(new Request("http://127.0.0.1/health/ready"))).status).toBe(200);
    expect(ready).toHaveBeenCalledOnce();
    ready.mockRejectedValue(new Error("anonymized-secret-and-content-canary"));
    const response = await handler(new Request("http://127.0.0.1/health/ready"));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("staging_unavailable");
  });
  it("retains anti-indexing and never exposes static admin bundles, models, dumps or source files", async () => {
    const handler = createSealedStagingHandler({} as PublicSermonRepository, vi.fn(), "a".repeat(40));
    for (const path of ["/_astro/example.js", "/private/example.json", "/.env", "/Dockerfile", "/db.dump", "/src/admin/dashboard.ts", "/models/example.bin"]) {
      expect((await handler(new Request(`http://127.0.0.1${path}`))).status).toBe(404);
    }
    expect(await (await handler(new Request("http://127.0.0.1/robots.txt"))).text()).toContain("Disallow: /");
  });
});

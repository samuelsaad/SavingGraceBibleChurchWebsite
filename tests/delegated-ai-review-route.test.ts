import { describe, expect, it, vi } from "vitest";
import { AdminSermonService } from "../src/application/admin-sermon-service";
import type { ApplicationIdentity } from "../src/application/authorization";
import type { AdminSermonRepository } from "../src/server/repositories/admin-sermon-repository";
import { createAdminApiRouter } from "../src/server/http/admin-api-router";

function route(identity: ApplicationIdentity | null) {
  const list = vi.fn().mockResolvedValue([{ sequence: 1, outcome: "incomplete", model: null }]);
  const repository = { listDelegatedAiReviews: list } as unknown as AdminSermonRepository;
  const handler = createAdminApiRouter(new AdminSermonService(repository), { authenticate: async () => identity });
  return { list, handler };
}

describe("private delegated review read-only status route", () => {
  it("denies unauthenticated access before reading private statuses", async () => {
    const { list, handler } = route(null);
    const response = await handler(new Request("http://127.0.0.1/api/v1/admin/ai-reviews"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(list).not.toHaveBeenCalled();
  });

  it("denies a non-administrator identity before reading private statuses", async () => {
    const { list, handler } = route({ subject: "fixture-denied", role: "viewer" } as unknown as ApplicationIdentity);
    const response = await handler(new Request("http://127.0.0.1/api/v1/admin/ai-reviews"));
    expect(response.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it("returns only the protected status projection without cache or indexing eligibility", async () => {
    const { list, handler } = route({ subject: "fixture-admin", role: "admin" });
    const response = await handler(new Request("http://127.0.0.1/api/v1/admin/ai-reviews"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    expect(await response.json()).toEqual({ data: [{ sequence: 1, outcome: "incomplete", model: null }] });
    expect(list).toHaveBeenCalledOnce();
  });

  it.each(["POST", "PATCH", "DELETE"])("offers no %s decision or approval endpoint", async method => {
    const { list, handler } = route({ subject: "fixture-admin", role: "admin" });
    const response = await handler(new Request("http://127.0.0.1/api/v1/admin/ai-reviews", { method }));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(list).not.toHaveBeenCalled();
  });
});

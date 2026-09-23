import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { logoBytes, logoPath } from "../src/frontend/assets/logo";
import { GET as staticLogo } from "../src/pages/brand/saving-grace-logo.png";
import { siteAssetPaths, siteAssetResponse } from "../src/server/http/site-assets";
import { createSealedStagingHandler } from "../src/staging/handler";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("embedded site assets", () => {
  it("serves only the allowlisted church logo, byte-identical everywhere, from embedded bytes", async () => {
    expect(siteAssetPaths).toEqual([logoPath]);
    const bytes = logoBytes();
    expect(bytes.byteLength).toBe(23_240);
    expect(sha256(bytes)).toBe("b617726b47e7456936246af30bdcd35ae31a4660aaa72e52637cd29f9f971c8f");
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const served = siteAssetResponse(new Request(`http://127.0.0.1${logoPath}`));
    expect(served?.status).toBe(200);
    expect(served?.headers.get("content-type")).toBe("image/png");
    expect(served?.headers.get("x-content-type-options")).toBe("nosniff");
    expect(sha256(new Uint8Array(await served!.arrayBuffer()))).toBe(sha256(bytes));

    const head = siteAssetResponse(new Request(`http://127.0.0.1${logoPath}`, { method: "HEAD" }));
    expect(head?.status).toBe(200);
    expect(await head!.text()).toBe("");
    expect(siteAssetResponse(new Request(`http://127.0.0.1${logoPath}`, { method: "POST" }))?.status).toBe(405);

    for (const path of ["/brand/", "/brand/other.png", "/brand/saving-grace-logo.png/", "/src/frontend/assets/logo.ts", "/brand/..%2Fsecret"]) {
      expect(siteAssetResponse(new Request(`http://127.0.0.1${path}`)), path).toBeNull();
    }

    const built = staticLogo();
    expect(built.headers.get("content-type")).toBe("image/png");
    expect(sha256(new Uint8Array(await built.arrayBuffer()))).toBe(sha256(bytes));
  });

  it("is delivered by the sealed visitor runtime with its private headers and without widening any other path", async () => {
    const handler = createSealedStagingHandler({} as PublicSermonRepository, vi.fn(), "a".repeat(40));
    const response = await handler(new Request(`http://127.0.0.1${logoPath}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(sha256(new Uint8Array(await response.arrayBuffer()))).toBe(sha256(logoBytes()));
    expect((await handler(new Request("http://127.0.0.1/brand/anything-else.png"))).status).toBe(404);
    expect((await handler(new Request(`http://127.0.0.1${logoPath}`, { method: "POST" }))).status).toBe(405);
  });
});

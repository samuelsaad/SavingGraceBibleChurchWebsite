import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { siteFontAssetBytes, siteFontAssets } from "../src/frontend/assets/fonts";
import { GET as staticFont, getStaticPaths } from "../src/pages/brand/fonts/[file]";
import { contentSecurityPolicy, cspHash } from "../src/server/http/frontend-response";
import { siteAssetPaths, siteAssetResponse } from "../src/server/http/site-assets";
import { createSealedStagingHandler } from "../src/staging/handler";
import type { PublicSermonRepository } from "../src/server/repositories/sermon-repository";

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const expectedHashes = {
  "vera-regular": "c4c45690b345435b2cba52ecabe275f05e49b389b39fe68ad03afbb551288d3d",
  "vera-bold": "cc037385e4d55bfde89b13e03091ee93bf40c0c52ddd391ff031ab276f13b8e9",
  "vera-license": "3361d054759a2fc686a2c058be82deaf9c2e6fe549be9004d7935a6c1736315d"
} as const;

describe("self-hosted font delivery", () => {
  it("preserves original font and license bytes across source, static and server delivery", async () => {
    expect(getStaticPaths().map(({ params }) => params.file)).toEqual([
      "bitstream-vera-sans-regular.ttf", "bitstream-vera-sans-bold.ttf", "bitstream-vera-license.txt"
    ]);
    for (const asset of siteFontAssets) {
      const disk = readFileSync(new URL(`../src/frontend/assets/fonts/${asset.file}`, import.meta.url));
      const bytes = siteFontAssetBytes(asset.id);
      expect(sha256(disk)).toBe(expectedHashes[asset.id]);
      expect(sha256(bytes)).toBe(expectedHashes[asset.id]);
      expect(asset.sha256).toBe(expectedHashes[asset.id]);
      expect(siteAssetPaths).toContain(asset.path);

      const served = siteAssetResponse(new Request(`http://127.0.0.1${asset.path}`))!;
      expect(served.status).toBe(200);
      expect(served.headers.get("content-type")).toBe(asset.type);
      expect(served.headers.get("x-content-type-options")).toBe("nosniff");
      expect(sha256(new Uint8Array(await served.arrayBuffer()))).toBe(expectedHashes[asset.id]);

      const built = await staticFont({ params: { file: asset.file } } as unknown as APIContext);
      expect(built.status).toBe(200);
      expect(built.headers.get("content-type")).toBe(asset.type);
      expect(sha256(new Uint8Array(await built.arrayBuffer()))).toBe(expectedHashes[asset.id]);

      const head = siteAssetResponse(new Request(`http://127.0.0.1${asset.path}`, { method: "HEAD" }))!;
      expect(head.headers.get("content-length")).toBe(String(bytes.byteLength));
      expect(await head.text()).toBe("");
      expect(siteAssetResponse(new Request(`http://127.0.0.1${asset.path}`, { method: "POST" }))?.status).toBe(405);
    }
    const license = new TextDecoder().decode(siteFontAssetBytes("vera-license"));
    expect(license).toContain("Copyright (c) 2003 by Bitstream, Inc.");
    expect(license).toContain("Permission is hereby granted, free of charge");
    expect(license).toContain("THE FONT SOFTWARE IS PROVIDED");
  });

  it("does not expose a font directory, unknown files or source files", async () => {
    for (const path of [
      "/brand/fonts/", "/brand/fonts/unknown.ttf", "/brand/fonts/bitstream-vera-sans-regular.ttf/",
      "/brand/fonts/..%2FREADME.md", "/brand/fonts/embed.mjs", "/src/frontend/assets/font-bytes.ts"
    ]) expect(siteAssetResponse(new Request(`http://127.0.0.1${path}`)), path).toBeNull();
    expect((await staticFont({ params: { file: "unknown.ttf" } } as unknown as APIContext)).status).toBe(404);
  });

  it("retains sealed-runtime privacy and denies private application paths", async () => {
    const ready = vi.fn();
    const handler = createSealedStagingHandler({} as PublicSermonRepository, ready, "a".repeat(40));
    for (const asset of siteFontAssets) {
      const response = await handler(new Request(`http://127.0.0.1${asset.path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("private, no-store");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(sha256(new Uint8Array(await response.arrayBuffer()))).toBe(expectedHashes[asset.id]);
    }
    for (const path of ["/admin/", "/frontend-preview/", "/api/v1/admin/sermons"]) {
      expect((await handler(new Request(`http://127.0.0.1${path}`))).status).toBe(401);
    }
    expect(ready).not.toHaveBeenCalled();
  });

  it("adds only same-origin font permission while retaining hashed styles, scripts and the frame gate", () => {
    const style = '@font-face{font-family:"Bitstream Vera Sans";src:url("/brand/fonts/bitstream-vera-sans-regular.ttf") format("truetype")}';
    const script = "document.documentElement.dataset.enhanced='true'";
    const policy = contentSecurityPolicy(`<style>${style}</style><script>${script}</script>`);
    expect(policy).toBe(`default-src 'none'; style-src ${cspHash(style)}; script-src ${cspHash(script)}; img-src 'self' data:; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
    expect(policy).not.toMatch(/https?:|unsafe-inline|unsafe-eval|font-src[^;]*(?:data:|\*)/u);
    expect(contentSecurityPolicy('<div data-video-frame></div>')).toContain("frame-src https://www.youtube-nocookie.com;");
    expect(contentSecurityPolicy("<p>No enhancements</p>")).toContain("style-src 'none';");
  });
});

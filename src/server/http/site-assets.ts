/**
 * The site's own static assets, served from bytes embedded in the frontend
 * package so every runtime delivers the identical file: the static Astro
 * build (through its own endpoint), the authenticated local preview, the
 * loopback verification server and the sealed visitor runtime, whose release
 * bundle contains only src/.
 *
 * Only an explicit allowlist is served; there is no directory or filesystem
 * lookup, so nothing outside these entries can be reached.
 */
import { logoBytes, logoPath } from "../../frontend/assets/logo";

interface SiteAsset {
  contentType: string;
  bytes: () => Uint8Array<ArrayBuffer>;
}

const siteAssets: ReadonlyMap<string, SiteAsset> = new Map([
  [logoPath, { contentType: "image/png", bytes: logoBytes }]
]);

const assetHeaders = {
  "Cache-Control": "public, max-age=86400",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
};

/** Returns the asset response for an allowlisted path, or null for any other request. */
export function siteAssetResponse(request: Request): Response | null {
  const pathname = new URL(request.url).pathname;
  const asset = siteAssets.get(pathname);
  if (!asset) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...assetHeaders, "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" }
    });
  }
  const bytes = asset.bytes();
  return new Response(request.method === "HEAD" ? null : bytes, {
    status: 200,
    headers: { ...assetHeaders, "Content-Type": asset.contentType, "Content-Length": String(bytes.byteLength) }
  });
}

/** Paths this handler serves, for tests and documentation. */
export const siteAssetPaths: readonly string[] = [...siteAssets.keys()];

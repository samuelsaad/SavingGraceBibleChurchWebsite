/**
 * The site's own static assets, served from bytes embedded in the frontend
 * package so every runtime delivers the identical file: the static Astro
 * build (through its own endpoints), the authenticated local preview, the
 * loopback verification server and the sealed visitor runtime, whose release
 * bundle contains only src/.
 *
 * Only an explicit allowlist is served (the church logo, its favicon and
 * touch icon and self-hosted fonts under /brand/, and the church website's images under
 * /media/); there is no directory or filesystem lookup, so nothing outside
 * these entries can be reached.
 */
import { logoBytes, logoPath } from "../../frontend/assets/logo";
import { siteFontAssetBytes, siteFontAssets } from "../../frontend/assets/fonts";
import { faviconPath, siteImageBytes, siteImages, touchIconPath, type MediaId } from "../../frontend/assets/media";

interface SiteAsset {
  contentType: string;
  bytes: () => Uint8Array<ArrayBuffer>;
}

const brandAssets: Array<[string, SiteAsset]> = [
  [logoPath, { contentType: "image/png", bytes: logoBytes }],
  [faviconPath, { contentType: "image/png", bytes: () => siteImageBytes("favicon-32") }],
  [touchIconPath, { contentType: "image/png", bytes: () => siteImageBytes("icon-192") }]
];

const mediaAssets: Array<[string, SiteAsset]> = siteImages
  .filter((image) => image.id !== "favicon-32" && image.id !== "icon-192")
  .map((image) => [image.path, { contentType: image.type, bytes: () => siteImageBytes(image.id as MediaId) }]);

const fontAssets: Array<[string, SiteAsset]> = siteFontAssets
  .map((asset) => [asset.path, { contentType: asset.type, bytes: () => siteFontAssetBytes(asset.id) }]);

const siteAssets: ReadonlyMap<string, SiteAsset> = new Map([...brandAssets, ...mediaAssets, ...fontAssets]);

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

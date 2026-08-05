import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2"
};

const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

export function resolveLocalDashboardAsset(
  pathname: string,
  distRoot = resolve("dist")
): string | null {
  let requested: string;
  try {
    requested = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relativeTarget = requested.startsWith("/_astro/")
    ? requested.slice(1)
    : requested === "/admin" || requested === "/admin/" || requested.startsWith("/admin/")
      ? "admin/index.html"
      : null;
  if (!relativeTarget) return null;
  if (/(^|[\\/])\.\.([\\/]|$)/.test(relativeTarget)) return null;
  const root = resolve(distRoot);
  const target = resolve(root, relativeTarget);
  const fromRoot = relative(root, target);
  if (fromRoot.startsWith("..") || fromRoot.includes(`${sep}..${sep}`)) return null;
  return target;
}

export async function serveLocalDashboard(
  request: Request,
  enabled: boolean,
  distRoot = resolve("dist")
): Promise<Response | null> {
  if (!enabled) return null;
  const target = resolveLocalDashboardAsset(new URL(request.url).pathname, distRoot);
  if (!target) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...securityHeaders, Allow: "GET, HEAD" }
    });
  }
  try {
    if (!(await stat(target)).isFile()) return new Response("Not found", { status: 404, headers: securityHeaders });
    const headers = {
      ...securityHeaders,
      "Content-Type": contentTypes[extname(target).toLowerCase()] ?? "application/octet-stream"
    };
    return new Response(request.method === "HEAD" ? null : await readFile(target), { status: 200, headers });
  } catch {
    return new Response("Dashboard build not found. Run npm run build first.", {
      status: 503,
      headers: { ...securityHeaders, "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

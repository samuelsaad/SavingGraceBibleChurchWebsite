import { randomBytes, timingSafeEqual } from "node:crypto";

const cookieName = "sgbc_d160_draft_preview";
const lifetimeSeconds = 8 * 60 * 60;

function equal(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookie(request: Request): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === cookieName) return value.join("=");
  }
  return null;
}

export class TunnelDraftPreviewSession {
  private readonly token = randomBytes(32).toString("base64url");
  private readonly nonce = randomBytes(32).toString("base64url");
  private expiresAt = 0;

  loginPage(): string {
    return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow,noarchive"><title>Protected draft preview</title></head><body><main><h1>Protected D-160 draft preview</h1><p>This read-only session is available only through the authenticated SSH tunnel.</p><form method="post" action="/draft-preview/session"><input type="hidden" name="nonce" value="${this.nonce}"><button type="submit">Start protected session</button></form></main></body></html>`;
  }

  async issue(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("application/x-www-form-urlencoded")) return new Response("Request refused", { status: 400 });
    const body = await request.text();
    if (body.length > 512 || !equal(new URLSearchParams(body).get("nonce") ?? "", this.nonce)) {
      return new Response("Request refused", { status: 403 });
    }
    this.expiresAt = Date.now() + lifetimeSeconds * 1000;
    return new Response(null, { status: 303, headers: {
      Location: "/draft-preview/", "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Set-Cookie": `${cookieName}=${this.token}; Path=/draft-preview; HttpOnly; SameSite=Strict; Max-Age=${lifetimeSeconds}`
    } });
  }

  authorizes(request: Request): boolean {
    const candidate = cookie(request);
    return Date.now() < this.expiresAt && candidate !== null && equal(candidate, this.token);
  }
}

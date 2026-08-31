import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IdentityProvider } from "./identity-provider";

const cookieName = "sgbc_local_frontend_preview";
const sessionLifetimeSeconds = 8 * 60 * 60;

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [candidateName, ...value] = part.trim().split("=");
    if (candidateName === name) return value.join("=");
  }
  return null;
}

function equalToken(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export class LocalFrontendPreviewSession {
  private readonly token = randomBytes(32).toString("base64url");
  private expiresAt = 0;

  async issue(request: Request, identityProvider: IdentityProvider): Promise<Response> {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: { code: "method_not_allowed" } }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", Allow: "POST", "Cache-Control": "no-store" }
      });
    }
    const identity = await identityProvider.authenticate(request);
    if (!identity || identity.role !== "admin") {
      return new Response(JSON.stringify({ error: { code: "authentication_required" } }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
    this.expiresAt = Date.now() + sessionLifetimeSeconds * 1_000;
    return new Response(JSON.stringify({ ready: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": `${cookieName}=${this.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetimeSeconds}`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  authorizes(request: Request): boolean {
    if (Date.now() >= this.expiresAt) return false;
    const candidate = cookieValue(request, cookieName);
    return candidate !== null && equalToken(candidate, this.token);
  }
}

export const localFrontendPreviewSessionCookieName = cookieName;

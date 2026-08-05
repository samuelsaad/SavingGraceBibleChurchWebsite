import type { ApplicationIdentity } from "../../application/authorization";
import type { IdentityProvider } from "./identity-provider";

export const localTestIdentity = Object.freeze({
  subject: "local-admin-0001",
  role: "admin"
} satisfies ApplicationIdentity);

/**
 * Loopback-development identity selector. It intentionally has no credentials
 * and must never be used as a production authenticator. Arbitrary subject/role
 * headers are ignored; the complete identity is resolved from this allowlist.
 */
export class LocalTestIdentityProvider implements IdentityProvider {
  constructor(
    private readonly enabled: boolean,
    private readonly runtimeEnvironment = process.env.NODE_ENV ?? "development"
  ) {}

  async authenticate(request: Request): Promise<ApplicationIdentity | null> {
    if (!this.enabled || this.runtimeEnvironment === "production") return null;
    const hostname = new URL(request.url).hostname;
    if (!new Set(["127.0.0.1", "localhost", "::1"]).has(hostname)) return null;
    const key = request.headers.get("x-local-identity");
    if (key !== "admin") return null;
    return localTestIdentity;
  }
}

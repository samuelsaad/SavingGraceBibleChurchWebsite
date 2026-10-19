import type { ApplicationIdentity } from "../../application/authorization";

/** Provider-independent boundary. The production managed provider is undecided.
 * Its adapter must verify trusted claims, individual admin membership and MFA
 * before returning an application identity; local/staging sessions do not prove it. */
export interface IdentityProvider {
  authenticate(request: Request): Promise<ApplicationIdentity | null>;
}

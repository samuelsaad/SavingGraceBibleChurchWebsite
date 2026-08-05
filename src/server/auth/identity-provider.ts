import type { ApplicationIdentity } from "../../application/authorization";

/** Provider-independent boundary. A future Cognito adapter must verify trusted
 * claims before returning an application identity. */
export interface IdentityProvider {
  authenticate(request: Request): Promise<ApplicationIdentity | null>;
}

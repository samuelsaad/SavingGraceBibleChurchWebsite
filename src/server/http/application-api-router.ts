import type { IdentityProvider } from "../auth/identity-provider";
import type { AdminSermonRepository } from "../repositories/admin-sermon-repository";
import type { PublicSermonRepository } from "../repositories/sermon-repository";
import { AdminSermonService } from "../../application/admin-sermon-service";
import { createAdminApiRouter } from "./admin-api-router";
import { createPublicApiRouter } from "./public-api-router";

export function createApplicationApiRouter(
  publicRepository: PublicSermonRepository,
  adminRepository: AdminSermonRepository,
  identityProvider: IdentityProvider
) {
  const publicRouter = createPublicApiRouter(publicRepository);
  const adminRouter = createAdminApiRouter(
    new AdminSermonService(adminRepository),
    identityProvider
  );
  return (request: Request): Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    return pathname.startsWith("/api/v1/admin/")
      ? adminRouter(request)
      : publicRouter(request);
  };
}

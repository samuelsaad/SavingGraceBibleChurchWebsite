import type { PublicSermonRepository } from "../repositories/sermon-repository";
import { createPublicSermonHandlers } from "./public-sermon-handlers";

export function createPublicApiRouter(repository: PublicSermonRepository) {
  const handlers = createPublicSermonHandlers(repository);

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: { code: "method_not_allowed" } }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", Allow: "GET" }
      });
    }

    if (url.pathname === "/api/v1/sermons" || url.pathname === "/api/v1/sermons/") {
      return handlers.list(request);
    }

    const detail = /^\/api\/v1\/sermons\/([^/]+)\/?$/.exec(url.pathname);
    if (detail) return handlers.detail(decodeURIComponent(detail[1]!));

    return new Response(JSON.stringify({ error: { code: "not_found" } }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  };
}

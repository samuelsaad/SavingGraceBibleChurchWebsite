export function readOnlyVerificationHandler(
  issueEphemeralSession: (request: Request) => Promise<Response>,
  read: (request: Request) => Promise<Response>
) {
  return (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (url.hostname !== "127.0.0.1") return Promise.resolve(new Response("loopback_required", { status: 403 }));
    if (request.method === "POST" && url.pathname === "/api/v1/admin/frontend-preview-session") {
      return issueEphemeralSession(request); // Existing in-memory session; no DB write.
    }
    if (request.method !== "GET" && request.method !== "HEAD") return Promise.resolve(new Response("read_only_verification", {
      status: 405, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", Allow: "GET, HEAD" }
    }));
    return read(request);
  };
}

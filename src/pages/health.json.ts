import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      kind: "build-information",
      service: "saving-grace-website",
      environment: "local-foundation",
      runtimeHealth: false
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );

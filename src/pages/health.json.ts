import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      status: "ok",
      service: "saving-grace-website",
      environment: "local-foundation"
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );

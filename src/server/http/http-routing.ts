/** Shared HTTP mechanics. HEAD follows the same route and headers as GET. */
export type OptionalHttpHandler = (request: Request) => Promise<Response | null>;
export function withHead(handler: OptionalHttpHandler): OptionalHttpHandler {
  return async request => {
    if (request.method !== "HEAD") return handler(request);
    const response = await handler(new Request(request, { method: "GET" }));
    return response ? new Response(null, { status: response.status, headers: response.headers }) : null;
  };
}

/** Resolve numeric pagination and slash variants in one step, without unsafe decoding. */
export function archiveRoute(pathname: string, root: string): { page: number; path: string } | null {
  if (pathname === root || pathname === root.slice(0, -1)) return { page: 1, path: root };
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}page/([0-9]+)/?$`, "u").exec(pathname);
  if (!match) return null;
  const page = Number(match[1]);
  if (!Number.isSafeInteger(page) || page < 1) return null;
  return { page, path: page === 1 ? root : `${root}page/${page}/` };
}

/** Only observed legacy taxonomy values lose one redundant leading, trailing or surrounding slash.
 * Unrelated query bytes (including campaign parameters) are kept verbatim. */
export function normalizedLegacyTermSearch(search:string):string {
  const keys=new Set(["sermon_series","sermon_speaker","sermon_topics","sermon_book"]);
  if(!search)return search;
  return "?"+search.slice(1).split("&").map(part=>{
    const entries=[...new URLSearchParams(part)];
    if(entries.length!==1)return part;
    const [key,value]=entries[0]!;
    if(!keys.has(key) || !/^\/?[a-z0-9-]+\/?$/u.test(value))return part;
    const equals=part.indexOf("=");
    return equals<0?part:part.slice(0,equals+1)+encodeURIComponent(value.replace(/^\//u,"").replace(/\/$/u,""));
  }).join("&");
}

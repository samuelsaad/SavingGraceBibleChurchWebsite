import type { IncomingHttpHeaders } from "node:http";

export interface NodeIncomingRequest extends AsyncIterable<Uint8Array> {
  method?: string | undefined;
  url?: string | undefined;
  headers: IncomingHttpHeaders;
}

export class IncomingRequestTooLargeError extends Error {}

export async function toWebRequest(
  incoming: NodeIncomingRequest,
  origin: string,
  maximumBodyBytes = 1_000_000
): Promise<Request> {
  const method = incoming.method ?? "GET";
  const url = new URL(incoming.url ?? "/", origin);
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers: incoming.headers as HeadersInit });
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of incoming) {
    size += chunk.byteLength;
    if (size > maximumBodyBytes) throw new IncomingRequestTooLargeError();
    chunks.push(chunk);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(url, {
    method,
    headers: incoming.headers as HeadersInit,
    ...(body ? { body } : {})
  });
}

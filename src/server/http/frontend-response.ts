/**
 * Builds HTTP responses for server-rendered frontend documents.
 *
 * The Content-Security-Policy is derived from the document itself: every
 * inline <script> and <style> body is hashed, and the YouTube frame source is
 * allowed only when the document contains a click-to-load video frame. The
 * header and the markup therefore cannot disagree.
 */
import { createHash } from "node:crypto";

const baseResponseHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff"
} as const;

const privatePreviewHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
} as const;

const scriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu;
const stylePattern = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gu;

export function cspHash(source: string): string {
  return `'sha256-${createHash("sha256").update(source).digest("base64")}'`;
}

function hashes(html: string, pattern: RegExp): string[] {
  return Array.from(html.matchAll(pattern), (match) => cspHash(match[1] ?? ""));
}

export function embeddedScriptHashes(html: string): string[] {
  return hashes(html, scriptPattern);
}

export function embeddedStyleHashes(html: string): string[] {
  return hashes(html, stylePattern);
}

export function contentSecurityPolicy(html: string): string {
  const scriptHashes = embeddedScriptHashes(html);
  const styleHashes = embeddedStyleHashes(html);
  // Only real plate markup (not the enhancement script's selector text) opens the frame source.
  const frameOrigins = [
    /<[a-z][^>]*\sdata-video-frame[\s>]/u.test(html) ? 'https://www.youtube-nocookie.com' : null,
    /<[a-z][^>]*\sdata-audio-frame[\s>]/u.test(html) ? 'https://embed.sermonaudio.com' : null
  ].filter(Boolean);
  const frame = frameOrigins.length ? ` frame-src ${frameOrigins.join(' ')};` : '';
  return `default-src 'none'; style-src ${styleHashes.length ? styleHashes.join(" ") : "'none'"};${scriptHashes.length ? ` script-src ${scriptHashes.join(" ")};` : ""} img-src 'self' data:; font-src 'self';${frame} base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
}

export interface FrontendResponseOptions {
  status?: number;
  privatePreview?: boolean;
  headers?: Record<string, string>;
}

/** Headers for a rendered document. */
export function frontendResponseHeaders(html: string, options: FrontendResponseOptions = {}): Record<string, string> {
  return {
    ...baseResponseHeaders,
    ...(options.privatePreview ? privatePreviewHeaders : {}),
    "Content-Security-Policy": contentSecurityPolicy(html),
    ...(options.headers ?? {})
  };
}

/** A complete response for a rendered document. */
export function frontendResponse(html: string, options: FrontendResponseOptions = {}): Response {
  return new Response(html, { status: options.status ?? 200, headers: frontendResponseHeaders(html, options) });
}

/** Headers for non-document responses (redirects, XML). */
export const plainResponseHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
} as const;

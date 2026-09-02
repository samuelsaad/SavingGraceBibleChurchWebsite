/**
 * Registry of the bounded client-side enhancements.
 *
 * Each script is a readable source string. The page shell embeds the scripts
 * a page asks for, and the response builder derives the Content-Security-
 * Policy hashes from the script and style bodies that were actually
 * embedded, so the header and the document can never disagree.
 */
import { createHash } from "node:crypto";
import { archiveScript } from "./archive";
import { navigationScript } from "./navigation";
import { sermonScript } from "./sermon";

export const enhancementScripts = {
  navigation: navigationScript,
  archive: archiveScript,
  sermon: sermonScript
} as const;

export type EnhancementScriptName = keyof typeof enhancementScripts;

export function sha256Source(source: string): string {
  return `'sha256-${createHash("sha256").update(source).digest("base64")}'`;
}

const scriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu;
const stylePattern = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gu;

/** CSP hashes of every inline script body present in a rendered document. */
export function embeddedScriptHashes(html: string): string[] {
  return Array.from(html.matchAll(scriptPattern), (match) => sha256Source(match[1] ?? ""));
}

/** CSP hashes of every inline style element present in a rendered document. */
export function embeddedStyleHashes(html: string): string[] {
  return Array.from(html.matchAll(stylePattern), (match) => sha256Source(match[1] ?? ""));
}

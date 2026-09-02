/**
 * Stylesheet composition. The core block is always emitted; pages add the
 * blocks they use so boundary and taxonomy pages carry no picker or player
 * CSS. Partials are authored readably and compacted at module load; the
 * result is inlined once per page and hashed into the Content-Security-
 * Policy by the server response builder.
 */
import { archiveStyles } from "./archive";
import { coreStyles } from "./core";
import { previewStyles } from "./preview";
import { sermonStyles } from "./sermon";

const blocks = {
  core: coreStyles,
  archive: archiveStyles,
  sermon: sermonStyles,
  preview: previewStyles
} as const;

export type StyleBlockName = Exclude<keyof typeof blocks, "core">;

/** Removes comments and collapses whitespace without touching values. */
export function compactCss(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\s+/gu, " ")
    .replace(/\s*([{};,>])\s*/gu, "$1")
    .replace(/;\}/gu, "}")
    .replace(/:\s+/gu, ":")
    .trim();
}

const compacted = Object.fromEntries(
  Object.entries(blocks).map(([name, source]) => [name, compactCss(source)])
) as Record<keyof typeof blocks, string>;

/** The stylesheet for a page: core plus the requested blocks, in order. */
export function siteStyles(extra: StyleBlockName[] = []): string {
  const names: Array<keyof typeof blocks> = ["core", ...new Set(extra)];
  return names.map((name) => compacted[name]).join("");
}

/** The complete stylesheet, for the static build and for tests. */
export function publicSiteStyles(): string {
  return siteStyles(["archive", "sermon"]);
}

/** Readable sources, for the stylesheet hygiene test. */
export const styleSources = blocks;

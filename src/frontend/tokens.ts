/**
 * Design tokens for "The Canon", the sermon frontend's visual system.
 *
 * Cool plaster ground, black-steel shelf boards, cloth-coloured book spines
 * and one gilt accent. Every colour, type, spacing, radius, elevation and
 * motion value in the stylesheet comes from here and is emitted once as
 * custom properties on `:root`; tests/frontend-design-tokens.test.ts checks
 * every text/surface and control pairing computed from these values.
 *
 * The site is light-only on purpose. Fonts are system stacks only: no font
 * file is downloaded or shipped.
 */

export const colour = {
  /** Explicit topical sermons: plum cloth, separate from the canonical book palette. */
  spineTopical: "#563650",
  /** Page ground: cool plaster. */
  ground: "#f5f5f2",
  /** Raised surfaces: inputs, catalogue cards, count stickers. */
  raised: "#ffffff",
  /** Recessed surfaces: the hero band, quiet notes, chips. */
  recessed: "#e8e8e3",
  /** Ruler cells without sermons and disabled controls. */
  tile: "#e3e4df",
  /** Primary text, shelf boards, bookends, primary buttons, footer, video plate. */
  ink: "#15181c",
  /** Secondary text: metadata, ledes, helper copy. */
  inkSoft: "#444a53",
  /** Tertiary text: ghost-spine labels, ordinals, disabled text. */
  inkMuted: "#596069",
  /** Decorative hairlines only; never a control boundary. */
  rule: "#d3d4cf",
  /** Borders of inputs, ghost spines, tokens and pagination (3:1 non-text). */
  ruleStrong: "#767b83",
  /** The single accent: eyebrows, section rules, current markers, applied filters. */
  gilt: "#7d5800",
  /** Accent tint: active tokens, current chips, the preview banner. */
  giltSoft: "#f5ecd2",
  /** Gilt lettering on dark surfaces. */
  giltBright: "#e8c170",
  /** Text on ink and on every spine hue. */
  onInk: "#f5f5f2",
  /** Muted text on ink surfaces. */
  onInkSoft: "#b9bec7",
  /** Cloth spine fills by literary group. */
  spineLaw: "#7d2a3a",
  spineHistory: "#7a4a1c",
  spineWisdom: "#56611f",
  spineMajorProphets: "#1f5f4e",
  spineMinorProphets: "#1e5468",
  spineGospelsActs: "#2f4f8f",
  spinePauline: "#4d3a8a",
  spineGeneral: "#7d2f6b",
  spineRevelation: "#1f2430",
  /** Print ground and ink. */
  groundPrint: "#ffffff",
  inkPrint: "#000000"
} as const;

export const font = {
  /** Display voice: large titles. */
  display: '"Sitka Banner", "Sitka Display", "Big Caslon", Baskerville, "Hoefler Text", "Iowan Old Style", "Book Antiqua", Georgia, ui-serif, serif',
  /** Reading voice: descriptions, transcripts, answers, ledes. */
  reading: '"Sitka Text", "Sitka Small", Charter, "Iowan Old Style", Georgia, "Noto Serif", ui-serif, serif',
  /** Signage voice: condensed caps for labels, spines, counts and navigation. */
  signage: 'Bahnschrift, "Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", "Helvetica Neue", system-ui, sans-serif',
  /** Interface voice: controls, metadata lines, helper copy. */
  ui: '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif'
} as const;

export const size = {
  small: "0.8125rem",
  ui: "0.9375rem",
  reading: "1.0625rem",
  lede: "1.25rem",
  h3: "1.375rem",
  cardTitle: "clamp(1.5rem, 1.2rem + 1vw, 2rem)",
  title: "clamp(2rem, 1.5rem + 2.2vw, 3.25rem)",
  display: "clamp(2.75rem, 1.9rem + 3.6vw, 5rem)",
  lineTight: "0.98",
  lineTitle: "1.05",
  lineUi: "1.45",
  lineReading: "1.72"
} as const;

export const space = {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.5rem",
  6: "2rem",
  7: "3rem",
  8: "4rem",
  9: "6rem"
} as const;

export const radius = {
  cell: "0.125rem",
  control: "0.25rem",
  card: "0.375rem",
  pill: "999px"
} as const;

export const shadow = {
  card: "0 1px 0 rgba(21, 24, 28, 0.06), 0 0.75rem 1.75rem rgba(21, 24, 28, 0.08)",
  lift: "0 0.5rem 1rem rgba(21, 24, 28, 0.18)"
} as const;

export const motion = {
  duration: "160ms",
  settle: "480ms",
  easing: "cubic-bezier(0.2, 0, 0, 1)"
} as const;

export const measure = {
  page: "76rem",
  prose: "68ch",
  transcript: "64ch",
  results: "56rem"
} as const;

export const breakpoint = {
  narrow: "38rem",
  mobile: "44rem",
  tablet: "60rem",
  wide: "76rem"
} as const;

/** Minimum standalone interactive target. */
export const targetSize = "2.75rem";

const kebab = (value: string): string => value.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

function group(prefix: string, values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => `--${prefix}-${kebab(name)}:${value};`)
    .join("");
}

/** Emits every token as a custom property on `:root`. */
export function tokensCss(): string {
  return `:root{${group("colour", colour)}${group("font", font)}${group("size", size)}${group("space", space)}${group("radius", radius)}${group("shadow", shadow)}${group("motion", motion)}${group("measure", measure)}--target-size:${targetSize};}`;
}

export type ColourToken = keyof typeof colour;

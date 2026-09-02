/**
 * Design tokens for the sermon frontend.
 *
 * Every colour, type, spacing, radius, elevation and motion value used by the
 * stylesheet comes from here and is emitted once as custom properties on
 * `:root`. The stylesheet partials reference tokens only, so the palette and
 * rhythm can be retuned in one place and the contrast test in
 * tests/frontend-design-tokens.test.ts checks every text/surface pairing.
 *
 * The site is light-only on purpose: the church's reading experience should
 * be identical for every visitor, and the palette is tuned for print-like
 * warmth rather than a dark theme.
 */

export const colour = {
  /** Page ground: warm, slightly off-white paper. */
  paper: "#faf7f1",
  /** Raised surfaces: inputs, carousel cards, the video frame surround. */
  paperRaised: "#fffdf9",
  /** Recessed surfaces: the passage picker and quiet notes. */
  paperDeep: "#f1ece2",
  /** Primary text. */
  ink: "#1c211d",
  /** Secondary text: metadata, ledes, helper copy. */
  inkSoft: "#4f5852",
  /** Tertiary text: small labels that still need AA. */
  inkMuted: "#5c665f",
  /** The single accent: links, primary buttons, selected states. */
  accent: "#1f4d3a",
  /** Accent hover/active. */
  accentStrong: "#163a2b",
  /** Soft accent tint for selected rows and active tokens. */
  accentSoft: "#e3ece6",
  /** Warm secondary accent for eyebrows and the applied-search marker. */
  ember: "#7d5119",
  /** Hairline rules. */
  rule: "#d8d2c6",
  /** Borders that must meet the 3:1 UI-component ratio on paper. */
  ruleStrong: "#7a746a",
  /** Keyboard focus ring. */
  focus: "#1a5fb4",
  /** Footer and video-frame ground. */
  inkSurface: "#1c211d",
  /** Text on ink surfaces. */
  onInk: "#f3efe7",
  /** Muted text on ink surfaces. */
  onInkSoft: "#c9d3cc",
  /** Neutral blue-grey chapter and verse tiles; no book group uses this hue. */
  tileNumber: "#d9e1e8",
  /** Book tiles by literary group: nine distinct hues at matched lightness. */
  tileLaw: "#e8dcc2",
  tileHistory: "#dae6d5",
  tileWisdom: "#ebe6c2",
  tileMajorProphets: "#e5d8e8",
  tileMinorProphets: "#dcdcee",
  tileGospelsActs: "#efd7cb",
  tilePauline: "#eed3d8",
  tileGeneral: "#e4e2da",
  tileRevelation: "#cfe3de",
  /** Disabled control surface and text. */
  disabledSurface: "#e6e3dc",
  disabledText: "#5a5a54",
  /** Tile outlines: definition only; the label identifies the control. */
  tileBorder: "#b9b2a6",
  /** Print ground and ink. */
  paperPrint: "#ffffff",
  inkPrint: "#000000"
} as const;

export const font = {
  /** Headings and reading text: a literary serif from each platform. */
  serif: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Charter, Georgia, "Times New Roman", serif',
  /** Interface text: labels, controls, metadata. */
  sans: '"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  /** Tabular numerals for chapter and verse tiles. */
  numeric: '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif'
} as const;

export const size = {
  xs: "0.8125rem",
  sm: "0.875rem",
  md: "1rem",
  base: "1.0625rem",
  lg: "1.25rem",
  xl: "1.5rem",
  "2xl": "clamp(1.75rem, 1.3rem + 1.6vw, 2.25rem)",
  "3xl": "clamp(2.1rem, 1.5rem + 2.4vw, 3.25rem)",
  lineTight: "1.15",
  lineUi: "1.45",
  lineReading: "1.7"
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
  tile: "0.125rem",
  control: "0.375rem",
  frame: "0.625rem",
  pill: "999px"
} as const;

export const shadow = {
  floating: "0 0.6rem 1.6rem rgba(28, 33, 29, 0.14)",
  frame: "0 0.4rem 1.2rem rgba(28, 33, 29, 0.10)"
} as const;

export const motion = {
  duration: "160ms",
  easing: "cubic-bezier(0.2, 0, 0, 1)"
} as const;

export const measure = {
  page: "72rem",
  prose: "68ch",
  transcript: "64ch"
} as const;

export const breakpoint = {
  /** Below this the header switches to the mobile menu. */
  mobile: "44rem",
  /** Below this multi-column layouts collapse. */
  tablet: "60rem",
  /** Below this remaining grids become single column. */
  narrow: "38rem"
} as const;

/** Minimum interactive target size (WCAG 2.5.8 comfortable target). */
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

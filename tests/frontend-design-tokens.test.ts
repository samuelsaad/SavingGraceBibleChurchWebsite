import { describe, expect, it } from "vitest";
import { colour, size, tokensCss } from "../src/frontend/tokens";
import { publicSiteStyles, styleSources } from "../src/frontend/styles";

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

export function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

const textOnPaper: Array<[keyof typeof colour, keyof typeof colour]> = [
  ["ink", "paper"], ["ink", "paperRaised"], ["ink", "paperDeep"], ["ink", "accentSoft"], ["ink", "tileNumber"],
  ["inkSoft", "paper"], ["inkSoft", "paperRaised"], ["inkSoft", "paperDeep"],
  ["inkMuted", "paper"], ["inkMuted", "paperRaised"], ["inkMuted", "paperDeep"],
  ["accent", "paper"], ["accent", "paperRaised"], ["accent", "paperDeep"], ["accent", "accentSoft"],
  ["accentStrong", "paper"], ["ember", "paper"], ["ember", "paperRaised"], ["ember", "paperDeep"],
  ["onInk", "accent"], ["onInk", "accentStrong"], ["onInk", "inkSurface"], ["onInk", "ember"],
  ["onInkSoft", "inkSurface"], ["disabledText", "disabledSurface"]
];

const tileTokens: Array<keyof typeof colour> = [
  "tileLaw", "tileHistory", "tileWisdom", "tileMajorProphets", "tileMinorProphets",
  "tileGospelsActs", "tilePauline", "tileGeneral", "tileRevelation"
];

const uiOnSurfaces: Array<[keyof typeof colour, keyof typeof colour]> = [
  ["focus", "paper"], ["focus", "paperRaised"], ["focus", "paperDeep"],
  ["ruleStrong", "paper"], ["ruleStrong", "paperRaised"], ["ruleStrong", "paperDeep"],
  ["accent", "paper"], ["ember", "tileNumber"]
];

describe("frontend design tokens", () => {
  it("keeps every text pairing at or above WCAG AA 4.5:1", () => {
    for (const [foreground, background] of textOnPaper) {
      expect(contrast(colour[foreground], colour[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps ink and the applied-search marker legible on all nine distinct book tints and the number tiles", () => {
    const tints = tileTokens.map((token) => colour[token]);
    expect(new Set(tints).size).toBe(9);
    expect(tints).not.toContain(colour.tileNumber);
    for (const token of [...tileTokens, "tileNumber" as const]) {
      expect(contrast(colour.ink, colour[token]), `ink on ${token}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour.ember, colour[token]), `ember marker on ${token}`).toBeGreaterThanOrEqual(3);
      expect(contrast(colour.onInk, colour.accent), "selected tile label").toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps focus rings and component borders at or above the 3:1 non-text ratio", () => {
    for (const [foreground, background] of uiOnSurfaces) {
      expect(contrast(colour[foreground], colour[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(3);
    }
    // The focus ring on a selected accent tile is drawn as an inset two-tone ring
    // whose inner band is paper-raised, so the visible ring contrasts with that band.
    expect(contrast(colour.focus, colour.paperRaised)).toBeGreaterThanOrEqual(3);
  });

  it("emits every token as a custom property and keeps the smallest text size at 13px or above", () => {
    const css = tokensCss();
    for (const token of Object.keys(colour)) {
      expect(css).toContain(`--colour-${token.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}:`);
    }
    expect(css).toContain("--size-2xl:");
    expect(css).toContain("--space-1:0.25rem");
    expect(Number.parseFloat(size.xs) * 16).toBeGreaterThanOrEqual(13);
  });

  it("uses tokens rather than colour literals in the stylesheet partials", () => {
    for (const [name, source] of Object.entries(styleSources)) {
      const body = name === "core" ? source.replace(tokensCss(), "") : source;
      expect(body, `${name} contains a colour literal`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/iu);
    }
    const compiled = publicSiteStyles();
    expect(compiled).toContain(":root{");
    expect(compiled).not.toContain("/*");
    expect(compiled).toContain('grid-template-areas:"meta series"');
  });
});

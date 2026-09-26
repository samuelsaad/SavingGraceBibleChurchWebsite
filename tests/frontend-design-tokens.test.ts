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

type Token = keyof typeof colour;

const textPairs: Array<[Token, Token]> = [
  ["ink", "ground"], ["ink", "raised"], ["ink", "recessed"], ["ink", "tile"], ["ink", "giltSoft"],
  ["inkSoft", "ground"], ["inkSoft", "raised"], ["inkSoft", "recessed"],
  ["inkMuted", "ground"], ["inkMuted", "raised"], ["inkMuted", "recessed"], ["inkMuted", "tile"],
  ["gilt", "ground"], ["gilt", "raised"], ["gilt", "recessed"], ["gilt", "giltSoft"],
  ["onInk", "ink"], ["onInkSoft", "ink"], ["giltBright", "ink"], ["giltBright", "spineRevelation"]
];

const spineTokens: Token[] = [
  "spineLaw", "spineHistory", "spineWisdom", "spineMajorProphets", "spineMinorProphets",
  "spineGospelsActs", "spinePauline", "spineGeneral", "spineRevelation"
];

const componentPairs: Array<[Token, Token]> = [
  ["ruleStrong", "ground"], ["ruleStrong", "raised"], ["ruleStrong", "recessed"],
  ["gilt", "ground"], ["gilt", "tile"], ["ink", "ground"]
];

describe("frontend design tokens", () => {
  it("keeps every text pairing at or above WCAG AA 4.5:1", () => {
    for (const [foreground, background] of textPairs) {
      expect(contrast(colour[foreground], colour[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps on-ink lettering legible on all nine distinct cloth spine hues and every hue distinct from the ground", () => {
    const hues = spineTokens.map((token) => colour[token]);
    expect(new Set(hues).size).toBe(9);
    for (const token of spineTokens) {
      expect(contrast(colour.onInk, colour[token]), `lettering on ${token}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour[token], colour.ground), `${token} against the ground`).toBeGreaterThanOrEqual(3);
      expect(contrast(colour[token], colour.raised), `${token} against raised surfaces`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps component boundaries and the focus ring at or above the 3:1 non-text ratio", () => {
    for (const [foreground, background] of componentPairs) {
      expect(contrast(colour[foreground], colour[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(3);
    }
    // The focus ring is ink with a ground halo, so it is visible on every spine hue and on ink itself.
    for (const token of spineTokens) expect(contrast(colour.ground, colour[token])).toBeGreaterThanOrEqual(3);
    expect(contrast(colour.ground, colour.ink)).toBeGreaterThanOrEqual(3);
  });

  it("emits every token as a custom property and keeps the smallest text size at 13px or above", () => {
    const css = tokensCss();
    for (const token of Object.keys(colour)) {
      expect(css).toContain(`--colour-${token.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}:`);
    }
    expect(css).toContain("--size-display:");
    expect(css).toContain("--space-1:0.25rem");
    expect(css).toContain('--font-signage:"Segoe UI"');
    expect(css).not.toMatch(/@font-face|url\(/u);
    expect(Number.parseFloat(size.small) * 16).toBeGreaterThanOrEqual(13);
  });

  it("uses tokens rather than colour literals in the stylesheet partials", () => {
    for (const [name, source] of Object.entries(styleSources)) {
      const body = name === "core" ? source.replace(tokensCss(), "") : source;
      expect(body, `${name} contains a colour literal`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/iu);
    }
    const compiled = publicSiteStyles();
    expect(compiled).toContain(":root{");
    expect(compiled).not.toContain("/*");
    expect(compiled).toContain(".spine--psalms{--sqrt:12.25;--i:18;");
    expect(compiled).toContain(".spine--obadiah{--sqrt:1;--i:30;");
    expect(compiled).toContain("@media (forced-colors:active)");
    expect(compiled).toContain("@media (prefers-reduced-motion:reduce)");
    expect(compiled).toContain("@media print{");
  });
});

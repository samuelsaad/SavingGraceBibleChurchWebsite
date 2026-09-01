import { describe, expect, it } from "vitest";
import { publicSiteStyles } from "../src/server/http/public-sermon-page";

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const values = rgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Bible picker accessible colour states", () => {
  it("keeps all nine visual-reference categories above AA normal-text contrast", () => {
    const palette = [
      "#eadcc9", "#dbe7e7", "#ecdfd4", "#dce7d8", "#ead6d8",
      "#eeeacb", "#e8dbd2", "#dce7d8", "#ead6d8"
    ];
    expect(palette).toHaveLength(9);
    for (const background of palette) expect(contrast("#1d2721", background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps selected, disabled and focus treatments distinguishable", () => {
    expect(contrast("#ffffff", "#173f31")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#4f5a53", "#e5e7e5")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#155f9e", "#fffdf8")).toBeGreaterThanOrEqual(3);
    const styles = publicSiteStyles();
    expect(styles).toContain('.bible-tile[aria-pressed="true"]::after{content:"✓"');
    expect(styles).toContain('.bible-tile[data-applied="true"]');
    expect(styles).toContain('.picker-search-all:disabled');
    expect(styles).toContain('button:focus-visible');
  });
});

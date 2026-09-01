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
  it("keeps all ten pastel categories above AA normal-text contrast", () => {
    const palette = [
      "#eadcc9", "#d9e8d7", "#f2e1ad", "#ded9ec", "#ead6de",
      "#d0e8e2", "#cedff0", "#e4dccd", "#d9e3ee", "#ead1c9"
    ];
    expect(palette).toHaveLength(10);
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

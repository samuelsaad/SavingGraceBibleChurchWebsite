import { describe, expect, it } from "vitest";
import { transformScripture } from "../src/domain/scripture";

const taxonomy = (value: string) => [
  {
    kind: "taxonomy" as const,
    originalValue: value,
    sourceTermId: 1,
    sourceTermTaxonomyId: 2
  }
];

describe("scripture dual-source provenance", () => {
  it("coalesces only an exact reversible match and retains both sources", () => {
    const result = transformScripture("Psalm 1:1-3", taxonomy("Psalm 1:1-3"));
    expect(result.warningCodes).toEqual([]);
    expect(result.references).toHaveLength(1);
    expect(result.references[0]?.sources).toHaveLength(2);
  });

  it("preserves conflicting values independently", () => {
    const result = transformScripture("Psalm 1:1-3", taxonomy("Psalms 1:1-3"));
    expect(result.warningCodes).toEqual(["scripture_source_conflict"]);
    expect(result.references.map((reference) => reference.displayText)).toEqual([
      "Psalm 1:1-3",
      "Psalms 1:1-3"
    ]);
  });

  it("flags a one-source-only reference", () => {
    const result = transformScripture("Selected Text", []);
    expect(result.warningCodes).toEqual(["scripture_single_source"]);
    expect(result.references[0]?.sources[0]?.originalValue).toBe("Selected Text");
  });
});

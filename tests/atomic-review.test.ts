import { describe, expect, it } from "vitest";
import { phase3b2AtomicReviewManifestSchema } from "../src/enrichment/atomic-review-contracts";
import { anonymisedAtomicManifest } from "./fixtures/atomic-review";

describe("atomic review contracts", () => {
  it("preserves exact 42/44 cardinality and the truthful combined category", () => {
    const parsed = phase3b2AtomicReviewManifestSchema.parse(anonymisedAtomicManifest());
    expect(parsed.records.map((item) => item.reviewItems.length)).toEqual([42, 44]);
    expect(parsed.records.flatMap((item) => item.reviewItems)).toHaveLength(86);
    expect(parsed.records.flatMap((item) => item.reviewItems).filter(
      (item) => item.category === "name_or_scripture_reference"
    )).toHaveLength(31);
    expect(JSON.stringify(parsed)).not.toMatch(/"category":"(?:name|scripture)"/);
    expect(JSON.stringify(parsed.records.flatMap((item) => item.reviewItems)))
      .not.toContain("possible_caption_errors_require_review");
  });

  it("creates byte-stable deterministic identities on repeated assembly", () => {
    const first = phase3b2AtomicReviewManifestSchema.parse(anonymisedAtomicManifest());
    const second = phase3b2AtomicReviewManifestSchema.parse(anonymisedAtomicManifest());
    expect(second).toEqual(first);
    expect(second.records.map((item) => item.reviewItemSetSha256)).toEqual(
      first.records.map((item) => item.reviewItemSetSha256)
    );
  });

  it("rejects missing, extra, duplicated, collided and reordered identities", () => {
    const missing = structuredClone(anonymisedAtomicManifest());
    missing.records[0]!.reviewItems.pop();
    expect(() => phase3b2AtomicReviewManifestSchema.parse(missing)).toThrow();

    const extra = structuredClone(anonymisedAtomicManifest());
    extra.records[0]!.reviewItems.push(structuredClone(extra.records[0]!.reviewItems[0]!));
    expect(() => phase3b2AtomicReviewManifestSchema.parse(extra)).toThrow();

    const collided = structuredClone(anonymisedAtomicManifest());
    collided.records[0]!.reviewItems[1]!.identitySha256 =
      collided.records[0]!.reviewItems[0]!.identitySha256;
    expect(() => phase3b2AtomicReviewManifestSchema.parse(collided)).toThrow();

    const reordered = structuredClone(anonymisedAtomicManifest());
    [reordered.records[0]!.reviewItems[0], reordered.records[0]!.reviewItems[1]] =
      [reordered.records[0]!.reviewItems[1]!, reordered.records[0]!.reviewItems[0]!];
    expect(() => phase3b2AtomicReviewManifestSchema.parse(reordered)).toThrow();
  });
});

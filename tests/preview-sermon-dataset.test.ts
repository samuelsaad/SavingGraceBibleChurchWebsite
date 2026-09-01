import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  loadTrackedPreviewDataset,
  previewDatasetAllowedSlugs,
  previewDatasetContentPath,
  previewDatasetManifestPath,
  previewSermonDatasetSchema,
  sha256
} from "../src/development-data/preview-sermon-dataset";

describe("tracked 15-sermon public development dataset", () => {
  it("has the exact authorised scope, counts, order, and integrity hashes", async () => {
    const loaded = await loadTrackedPreviewDataset();
    expect(loaded.dataset.sermons.map((sermon) => sermon.slug)).toEqual(previewDatasetAllowedSlugs);
    expect(loaded.dataset.sermons).toHaveLength(15);
    expect(loaded.dataset.sermons.reduce(
      (count, sermon) => count + sermon.questionAnswers.length,
      0
    )).toBe(103);
    expect(loaded.contentSha256).toBe(sha256(await readFile(previewDatasetContentPath)));
    expect(loaded.manifestSha256).toBe(sha256(await readFile(previewDatasetManifestPath)));
  });

  it("contains only the curated public seed contract rather than private provenance", async () => {
    const loaded = await loadTrackedPreviewDataset();
    const permittedSermonKeys = [
      "bibleBooks", "description", "media", "passageTerms", "primaryPassageDecision",
      "questionAnswers", "scriptureReferences", "series", "serviceDate", "slug", "speaker",
      "title", "transcript"
    ];
    for (const sermon of loaded.dataset.sermons) {
      expect(Object.keys(sermon).sort()).toEqual([...permittedSermonKeys].sort());
    }
    const serialized = JSON.stringify(loaded.dataset);
    for (const prohibitedKey of [
      "actorSubject", "adminSubject", "approvedBySubject", "auditEvents", "captionText",
      "cookie", "credential", "oauth", "password", "rawCaption", "reviewedBySubject", "session", "token"
    ]) {
      expect(serialized).not.toContain(`\"${prohibitedKey}\"`);
    }
  });

  it("rejects a missing, substituted, duplicated, or extra sermon identity", async () => {
    const loaded = await loadTrackedPreviewDataset();
    const missing = structuredClone(loaded.dataset);
    missing.sermons.pop();
    expect(previewSermonDatasetSchema.safeParse(missing).success).toBe(false);

    const duplicated = structuredClone(loaded.dataset);
    duplicated.sermons[1]!.slug = duplicated.sermons[0]!.slug;
    expect(previewSermonDatasetSchema.safeParse(duplicated).success).toBe(false);

    const substituted = structuredClone(loaded.dataset) as unknown as { sermons: Array<{ slug: string }> };
    substituted.sermons[0]!.slug = "not-an-authorised-sermon";
    expect(previewSermonDatasetSchema.safeParse(substituted).success).toBe(false);
  });
});

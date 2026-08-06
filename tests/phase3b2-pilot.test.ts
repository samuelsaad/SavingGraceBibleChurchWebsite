import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { enrichmentDraftBundleSchema } from "../src/enrichment/contracts";
import { phase3b2PilotManifestSchema } from "../src/enrichment/pilot-contracts";
import {
  canonicalYouTubeIdentity,
  prepareExistingCaptionText
} from "../src/enrichment/pilot-caption";

const ids = ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"] as const;

function longCaption(punctuated = true): string {
  const sentence = punctuated
    ? "the anonymised speaker explains a reviewed example and invites careful reflection."
    : "the anonymised speaker explains a reviewed example and invites careful reflection";
  return Array.from({ length: 110 }, () => sentence).join(" ");
}

function manifest() {
  return {
    schemaVersion: 1,
    sourceSnapshotId: "anonymised-three-record-pilot",
    allowlistedVideoIds: [...ids],
    records: ids.map((videoId, index) => ({
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}&list=playlist&tracking=ignored`,
      captionFilename: `anonymised-${index + 1}.txt`,
      captionLanguage: "en-AU",
      captionTrackType: "unknown",
      sourceWordPressId: 990_000 + index,
      title: `Anonymised pilot ${index + 1}`,
      slug: `anonymised-pilot-${index + 1}`,
      serviceDate: "1970-01-01",
      descriptionDraft: null,
      questionAnswers: []
    }))
  };
}

describe("Phase 3B.2 private caption pilot", () => {
  it("accepts only the explicit three-video allowlist and ignores playlist identity parameters", () => {
    expect(
      canonicalYouTubeIdentity(
        "https://www.youtube.com/watch?v=aaaaaaaaaaa&list=example&index=4&utm_source=test",
        ids
      )
    ).toEqual({
      videoId: "aaaaaaaaaaa",
      canonicalUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa"
    });
    expect(() =>
      canonicalYouTubeIdentity("https://www.youtube.com/watch?v=ddddddddddd", ids)
    ).toThrow("not in the private pilot allowlist");
    expect(() =>
      canonicalYouTubeIdentity("https://www.youtube.com/embed/aaaaaaaaaaa", ids)
    ).toThrow("watch URLs");
  });

  it("requires an exact one-to-one three-record mapping manifest", () => {
    expect(phase3b2PilotManifestSchema.parse(manifest()).records).toHaveLength(3);
    const invalid = manifest();
    invalid.records[2]!.videoId = ids[0];
    expect(() => phase3b2PilotManifestSchema.parse(invalid)).toThrow();
  });

  it("prepares only captions with safe sentence boundaries and preserves the word sequence", () => {
    const source = longCaption(true);
    const result = prepareExistingCaptionText(source);
    expect(result.usable).toBe(true);
    if (!result.usable) throw new Error("Expected usable anonymised caption");
    const sourceWords = source.toLocaleLowerCase("en-AU").match(/[a-z]+/g);
    const cleanedWords = result.cleanedText.toLocaleLowerCase("en-AU").match(/[a-z]+/g);
    expect(cleanedWords).toEqual(sourceWords);
    expect(result.cleanedText.startsWith("The anonymised")).toBe(true);
  });

  it("fails missing, short, unpunctuated, and unsafe sources without inventing text", () => {
    expect(prepareExistingCaptionText("").usable).toBe(false);
    const unpunctuated = prepareExistingCaptionText(longCaption(false));
    expect(unpunctuated).toMatchObject({
      usable: false,
      failure: { code: "manual_punctuation_required" }
    });
    expect(prepareExistingCaptionText(`${longCaption(true)} <iframe>`)).toMatchObject({
      usable: false,
      failure: { code: "unsafe_caption_markup" }
    });
  });

  it("retains explicit uncertainty markers for human review", () => {
    const source = `${longCaption(true)} [unclear wording].`;
    const result = prepareExistingCaptionText(source);
    expect(result.usable).toBe(true);
    if (!result.usable) throw new Error("Expected usable anonymised caption");
    expect(result.metrics.uncertaintyMarkerCount).toBe(1);
    expect(result.unresolvedPassages).toEqual([
      expect.objectContaining({ marker: "uncertain-1" })
    ]);
    expect(result.cleanedText).toContain("[unclear wording]");
  });

  it("accepts structured private provenance but grants no approval", () => {
    const parsed = enrichmentDraftBundleSchema.parse({
      schemaVersion: 3,
      sourceWordPressId: 990_001,
      targetSermonId: "75df2144-b557-50f6-98bd-011cd696bfb9",
      expectedRowVersion: 1,
      description: {
        bodyText: "An anonymised draft description that is long enough for later human review and remains private until an administrator explicitly approves it.",
        provenance: { sourceKind: "generated_draft", sourceReference: "anonymised-local-pilot" }
      },
      transcript: {
        bodyText: "An anonymised prepared transcript.",
        provenance: { sourceKind: "caption", sourceReference: "anonymised-local-pilot" }
      },
      questionAnswers: Array.from({ length: 5 }, (_, index) => ({
        question: `How should the anonymised example ${index + 1} be considered?`,
        answer: `The anonymised answer ${index + 1} remains a draft for human review.`,
        provenance: { sourceKind: "generated_draft", sourceReference: "anonymised-local-pilot" }
      })),
      sourceProvenance: {
        provider: "youtube",
        videoId: ids[0],
        canonicalUrl: `https://www.youtube.com/watch?v=${ids[0]}`,
        captionLanguage: "en-AU",
        captionTrackType: "unknown",
        originalFilename: "anonymised.txt",
        sourceContentSha256: "a".repeat(64),
        retrievalAttribution: "authorised_youtube_studio_export",
        sourceCharacterCount: 10_000,
        cleanedCharacterCount: 10_020,
        apparentCompleteness: "apparently_complete",
        uncertaintyMarkerCount: 0,
        warnings: [{ code: "human_review_required", safeDetail: "Human review remains required." }],
        unresolvedPassages: [],
        processingVersion: "test-v1",
        importedAt: "2026-08-06T00:00:00.000Z",
        processedAt: "2026-08-06T00:00:01.000Z",
        processingDurationMs: 1_000,
        estimatedReviewMinutes: 60,
        manualAttentionRequired: true,
        accuracyReviewStatus: "required"
      }
    });
    expect(parsed.schemaVersion).toBe(3);
    expect(JSON.stringify(parsed)).not.toMatch(/"status":"approved"|approvedBy/);
  });

  it("contains no audio/video download or external request implementation", async () => {
    const source = await readFile("src/enrichment/phase3b2-pilot.ts", "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(|https?\.request|youtube-dl|yt-dlp|ffmpeg|speech[-_ ]to[-_ ]text/i);
    expect(source).toContain("'phase3b2_pilot'");
    expect(source).not.toContain("VALUES ($1, 'wordpress', 'phase3b2_private_pilot'");
  });
});

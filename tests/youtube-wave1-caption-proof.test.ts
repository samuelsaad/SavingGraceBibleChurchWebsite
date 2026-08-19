import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildPrivateMappings,
  parseCanonicalYouTubeVideoId,
  resolveInitialWaveOne,
  safeAggregateMappingCounts,
  type CaptionInspectionRecord,
  type VerifiedSelection
} from "../src/youtube/wave1-caption-proof";
import { prepareWaveOneContent } from "../src/enrichment/wave1-enrichment";
import { enrichmentDraftBundleSchema } from "../src/enrichment/contracts";

const firstVideo = "AbCdEfGhI12";
const secondVideo = "JkLmNoPqR34";

describe("private 48-record mapping controls", () => {
  it("derives canonical identities while ignoring playlist and tracking parameters", () => {
    expect(parseCanonicalYouTubeVideoId(`https://www.youtube.com/watch?v=${firstVideo}&list=PL_anonymised&utm_source=test`))
      .toBe(firstVideo);
    expect(parseCanonicalYouTubeVideoId(`https://youtu.be/${secondVideo}?feature=shared`)).toBe(secondVideo);
    expect(parseCanonicalYouTubeVideoId(firstVideo)).toBe(firstVideo);
    expect(parseCanonicalYouTubeVideoId("not-video")).toBeNull();
  });

  it("records missing, malformed, duplicate and ambiguous metadata without guessing", () => {
    const records = buildPrivateMappings([101, 102, 103, 104], [
      { source_id: 101, youtube_metadata_value: `https://www.youtube.com/watch?v=${firstVideo}` },
      { source_id: 102, youtube_metadata_value: null },
      { source_id: 103, youtube_metadata_value: "malformed" },
      { source_id: 104, youtube_metadata_value: firstVideo },
      { source_id: 104, youtube_metadata_value: secondVideo }
    ]);
    expect(records).toMatchObject([
      { sourceId: 101, status: "mapped", videoId: firstVideo },
      { sourceId: 102, status: "missing", videoId: null },
      { sourceId: 103, status: "malformed", videoId: null },
      { sourceId: 104, status: "ambiguous", videoId: null }
    ]);
    expect(safeAggregateMappingCounts(records)).toEqual({ mapped: 1, missing: 1, malformed: 1, ambiguous: 1 });
  });

  it("detects duplicate rows and cross-record duplicate video identities", () => {
    expect(buildPrivateMappings([201], [
      { source_id: 201, youtube_metadata_value: firstVideo },
      { source_id: 201, youtube_metadata_value: firstVideo }
    ])).toMatchObject([{ status: "duplicate_metadata_rows", videoId: firstVideo, metadataRowCount: 2 }]);
    expect(buildPrivateMappings([201, 202], [
      { source_id: 201, youtube_metadata_value: firstVideo },
      { source_id: 202, youtube_metadata_value: firstVideo }
    ])).toMatchObject([
      { status: "duplicate_video_identity", videoId: null },
      { status: "duplicate_video_identity", videoId: null }
    ]);
  });

  it("rejects any mapping result outside the selected scope", () => {
    expect(() => buildPrivateMappings([301], [{ source_id: 302, youtube_metadata_value: firstVideo }])).toThrow();
  });
});

describe("predetermined Wave 1 replacement controls", () => {
  const selection: VerifiedSelection = {
    primary: [
      { sourceId: 401, selectionRank: 1, wave: 1, waveOrder: 1 },
      { sourceId: 402, selectionRank: 2, wave: 1, waveOrder: 2 }
    ],
    alternates: [{
      sourceId: 501,
      alternateOrder: 1,
      replacementForPrimarySourceId: 402,
      replacementPrimaryWave: 1,
      allowedReplacementReasons: ["missing_caption_export"]
    }],
    selectedSourceIds: [401, 402, 501]
  };
  const selected = (sourceId: number): CaptionInspectionRecord => ({
    sourceId,
    videoId: firstVideo,
    outcome: "selected",
    selection: {
      outcome: "selected",
      track: {
        id: "caption_1",
        videoId: firstVideo,
        language: "en",
        trackKind: "standard",
        audioTrackType: "primary",
        status: "serving",
        isDraft: false,
        lastUpdated: null
      },
      eligibleTrackCount: 1,
      warnings: []
    },
    durationMs: 1_000
  });

  it("retains an available primary and uses only its mapped alternate for an approved objective reason", () => {
    const resolved = resolveInitialWaveOne(selection, [
      selected(401),
      { ...selected(402), outcome: "no_eligible_track", selection: { outcome: "no_eligible_track", eligibleTrackCount: 0 } },
      selected(501)
    ]);
    expect(resolved).toEqual([
      { waveOrder: 1, primarySourceId: 401, resolvedSourceId: 401, resolution: "primary", reason: null },
      { waveOrder: 2, primarySourceId: 402, resolvedSourceId: 501, resolution: "alternate", reason: "missing_caption_export" }
    ]);
  });

  it("leaves a position unavailable when the mapped alternate is ineligible", () => {
    const resolved = resolveInitialWaveOne(selection, [
      selected(401),
      { ...selected(402), outcome: "wrong_channel", selection: null },
      selected(501)
    ]);
    expect(resolved[1]).toMatchObject({ resolution: "unavailable", resolvedSourceId: null, reason: "source_outside_authorized_workflow" });
  });
});

describe("provider, database and content-exclusion guardrails", () => {
  it("uses one exact-field read-only mapping and official caption reads without translation", async () => {
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const source = [
      await readFile(join(repositoryRoot, "src", "youtube", "wave1-caption-cli.ts"), "utf8"),
      await readFile(join(repositoryRoot, "src", "youtube", "wave1-caption-proof.ts"), "utf8")
    ].join("\n");
    expect(source).toContain("START TRANSACTION READ ONLY");
    expect(source).toContain("REPEATABLE READ");
    expect(source).toContain("asp_sermon_youtube");
    expect(source).toContain("LEFT JOIN wp_postmeta");
    expect(source).not.toMatch(/post_content|post_excerpt/iu);
    expect(source).toContain("youtube.captions.list");
    expect(source).toContain("youtube.captions.download");
    expect(source).toContain('tfmt: "vtt"');
    expect(source).not.toMatch(/\btlang\b/u);
    expect(source).not.toMatch(/youtube\.(?:captions\.(?:insert|update|delete)|videos\.(?:insert|update|delete))/u);
  });

  it("fails closed before metadata loading when administrator review state exists", async () => {
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const source = await readFile(join(repositoryRoot, "src", "enrichment", "wave1-process-cli.ts"), "utf8");
    expect(source).toContain('safeFailureStage = "protect_existing_review_state"');
    expect(source).toContain("sermon.summary_status NOT IN ('missing', 'draft')");
    expect(source).toContain("review.current_stage > 1 OR review.completed_at IS NOT NULL");
    expect(source).toContain("item.decision_status <> 'pending'");
    expect(source).toContain('"existing_reviewed_content"');
    expect(source.indexOf('safeFailureStage = "protect_existing_review_state"'))
      .toBeLessThan(source.indexOf('safeFailureStage = "import_private_metadata_shells"'));
  });
});

describe("anonymised Wave 1 preparation", () => {
  function longVtt(): Buffer {
    const blocks = ["WEBVTT", ""];
    for (let cue = 0; cue < 28; cue += 1) {
      const timestamp = (seconds: number) =>
        `00:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      const start = timestamp(cue * 3);
      const end = timestamp(cue * 3 + 2);
      const words = Array.from({ length: 24 }, (_, index) =>
        ["example", "teaching", "community", "reflection", "practice", "encouragement"][(cue + index) % 6]
      );
      if (cue === 10) words[12] = "[unclear]";
      blocks.push(`${start}.000 --> ${end}.000`, words.join(" "), "");
    }
    return Buffer.from(blocks.join("\n"));
  }

  it("adds readable structure without changing the source lexical sequence", () => {
    const prepared = prepareWaveOneContent(longVtt());
    expect(prepared.sourceWordCount).toBe(prepared.cleanedWordCount);
    expect(prepared.sourceWordSequenceSha256).toBe(prepared.cleanedWordSequenceSha256);
    expect(prepared.transcript).toContain(".\n\n");
    expect(prepared.description.length).toBeGreaterThanOrEqual(80);
    expect(prepared.description.length).toBeLessThanOrEqual(2_000);
    expect(prepared.questionAnswers).toHaveLength(7);
    expect(prepared.questionAnswers.every((item) => item.question.length > 0 && item.answer.length > 40)).toBe(true);
    expect(prepared.uncertaintyMarkers).toHaveLength(1);
    expect(prepared.warnings.map((warning) => warning.code)).toContain("administrator_accuracy_review_required");
  });

  it("accepts official API provenance while retaining mandatory human review", () => {
    const prepared = prepareWaveOneContent(longVtt());
    const parsed = enrichmentDraftBundleSchema.parse({
      schemaVersion: 3,
      sourceWordPressId: 123,
      targetSermonId: "11111111-1111-4111-8111-111111111111",
      expectedRowVersion: 1,
      description: { bodyText: prepared.description, provenance: { sourceKind: "generated_draft", sourceReference: "anonymised" } },
      transcript: { bodyText: prepared.transcript, provenance: { sourceKind: "caption", sourceReference: "anonymised" } },
      questionAnswers: prepared.questionAnswers.map((item) => ({ ...item, provenance: { sourceKind: "generated_draft", sourceReference: "anonymised" } })),
      sourceProvenance: {
        provider: "youtube",
        videoId: firstVideo,
        canonicalUrl: `https://www.youtube.com/watch?v=${firstVideo}`,
        captionLanguage: "en",
        captionTrackType: "automatic",
        originalFilename: "anonymised.vtt",
        sourceContentSha256: "a".repeat(64),
        retrievalAttribution: "authorised_youtube_data_api",
        sourceCharacterCount: 4_000,
        cleanedCharacterCount: prepared.transcript.length,
        apparentCompleteness: "requires_manual_review",
        uncertaintyMarkerCount: prepared.uncertaintyMarkers.length,
        warnings: prepared.warnings,
        unresolvedPassages: prepared.uncertaintyMarkers,
        processingVersion: "anonymised-v1",
        importedAt: "2026-01-01T00:00:00.000Z",
        processedAt: "2026-01-01T00:00:00.000Z",
        processingDurationMs: 1,
        estimatedReviewMinutes: 45,
        manualAttentionRequired: true,
        accuracyReviewStatus: "required"
      }
    });
    expect(parsed.schemaVersion).toBe(3);
    if (parsed.schemaVersion !== 3) throw new Error("Expected Phase 3B.2 provenance bundle");
    expect(parsed.sourceProvenance.retrievalAttribution).toBe("authorised_youtube_data_api");
    expect(parsed.sourceProvenance.accuracyReviewStatus).toBe("required");
  });
});

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
import {
  buildOfficialTitleRecords,
  buildPrivateOfficialTitleArtifact,
  exactWaveOneVideoAllowlist,
  verifyPrivateOfficialTitleArtifact,
  type WaveOneRetrievalIdentity
} from "../src/youtube/wave1-title-proof";
import { prepareWaveOneContent } from "../src/enrichment/wave1-enrichment";

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

describe("bounded official Wave 1 title provenance", () => {
  const videoIds = Array.from({ length: 12 }, (_, index) => `VideoId${String(index + 1).padStart(4, "0")}`);
  const retrieval = videoIds.map((videoId, index): WaveOneRetrievalIdentity => ({
    waveOrder: index + 1,
    primarySourceId: 700 + index,
    resolvedSourceId: 700 + index,
    outcome: "retrieved",
    videoId,
    channelId: "anonymised-church-channel"
  }));

  it("derives only the exact ordered 12-video retrieval allowlist", () => {
    expect(exactWaveOneVideoAllowlist([...retrieval].reverse())).toEqual(videoIds);
    expect(() => exactWaveOneVideoAllowlist(retrieval.slice(0, 11))).toThrow("exactly 12");
    expect(() => exactWaveOneVideoAllowlist([
      ...retrieval.slice(0, 11),
      { ...retrieval[11]!, videoId: videoIds[0]! }
    ])).toThrow("duplicate");
    expect(() => exactWaveOneVideoAllowlist([
      { ...retrieval[0]!, outcome: "unavailable", videoId: null },
      ...retrieval.slice(1)
    ])).toThrow("complete ordered videos");
  });

  it("preserves the exact UTF-8 title while excluding unnecessary snippet fields", () => {
    const exactTitle = "Anonymised Café  e\u0301vidence | Mark 10:46–50  ";
    const records = buildOfficialTitleRecords({
      allowlistedVideoIds: videoIds,
      expectedChannelId: "anonymised-church-channel",
      retrievedAt: "2026-08-20T00:00:00.000Z",
      items: videoIds.map((id, index) => ({
        id,
        snippet: {
          title: index === 0 ? exactTitle : `Anonymised title ${index + 1}`,
          channelId: "anonymised-church-channel",
          description: "discarded description",
          tags: ["discarded"],
          thumbnails: { default: { url: "https://invalid.example/discarded" } }
        }
      }))
    });
    expect(records[0]!.title).toBe(exactTitle);
    expect(JSON.stringify(records)).not.toMatch(/discarded description|thumbnails|tags/u);
    expect(records.every((record) => /^[a-f0-9]{64}$/u.test(record.recordSha256))).toBe(true);
    const artifact = buildPrivateOfficialTitleArtifact({
      expectedChannelId: "anonymised-church-channel",
      retrievedAt: "2026-08-20T00:00:00.000Z",
      records
    });
    expect(verifyPrivateOfficialTitleArtifact(artifact)).toEqual(artifact);
    const tampered = structuredClone(artifact);
    tampered.records[0]!.title = "Changed";
    expect(() => verifyPrivateOfficialTitleArtifact(tampered)).toThrow("integrity");
  });

  it("records missing, duplicate and wrong-channel videos for manual review without guessing", () => {
    const items = videoIds.slice(1).map((id, index) => ({
      id,
      snippet: { title: `Anonymised title ${index + 2}`, channelId: "anonymised-church-channel" }
    }));
    items.push({ ...items[0]! });
    items[1] = { ...items[1]!, snippet: { ...items[1]!.snippet, channelId: "another-channel" } };
    const records = buildOfficialTitleRecords({
      allowlistedVideoIds: videoIds,
      expectedChannelId: "anonymised-church-channel",
      retrievedAt: "2026-08-20T00:00:00.000Z",
      items
    });
    expect(records[0]).toMatchObject({ outcome: "manual_review_required", failureCode: "missing_video", title: null });
    expect(records[1]).toMatchObject({ outcome: "manual_review_required", failureCode: "duplicate_video", title: null });
    expect(records[2]).toMatchObject({ outcome: "manual_review_required", failureCode: "wrong_channel", title: null });
  });

  it("rejects any response identity outside the allowlist", () => {
    expect(() => buildOfficialTitleRecords({
      allowlistedVideoIds: videoIds,
      expectedChannelId: "anonymised-church-channel",
      retrievedAt: "2026-08-20T00:00:00.000Z",
      items: [{ id: "Outside00001", snippet: { title: "Outside", channelId: "anonymised-church-channel" } }]
    })).toThrow("outside");
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

  it("refuses to create any further transcript, description or Q&A drafts", () => {
    expect(() => prepareWaveOneContent(longVtt())).toThrow("mechanical_wave1_generation_retired");
  });
});

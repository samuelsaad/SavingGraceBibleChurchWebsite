import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeStudioExport,
  audioTrackTypeUnverifiedWarning,
  assertExactVideoScope,
  captionAudioAssociationProvenance,
  captionParseFailureCode,
  compareCaptionAnalyses,
  parseVttBytes,
  persistExactCaptionBytes,
  pilotYouTubeVideoIds,
  requireCommonPilotOwner,
  selectCaptionTrack,
  type CaptionTrackMetadata
} from "../src/youtube/pilot-caption-proof";

const temporaryDirectories: string[] = [];
const anonymisedVideoId = "AbCdEfGhI12";

function track(overrides: Partial<CaptionTrackMetadata> = {}): CaptionTrackMetadata {
  return {
    id: "caption_1",
    videoId: anonymisedVideoId,
    language: "en-AU",
    trackKind: "standard",
    audioTrackType: "primary",
    status: "serving",
    isDraft: false,
    lastUpdated: "2026-01-01T00:00:00Z",
    ...overrides
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("bounded pilot scope", () => {
  it("accepts only the exact unique allowlist", () => {
    expect(() => assertExactVideoScope(pilotYouTubeVideoIds, pilotYouTubeVideoIds)).not.toThrow();
    expect(() => assertExactVideoScope(["AbCdEfGhI12", "JkLmNoPqR34", "StUvWxYzA56"], pilotYouTubeVideoIds)).toThrow();
    expect(() => assertExactVideoScope([pilotYouTubeVideoIds[0], pilotYouTubeVideoIds[0], pilotYouTubeVideoIds[2]], pilotYouTubeVideoIds)).toThrow();
    expect(() => assertExactVideoScope(pilotYouTubeVideoIds.slice(0, 2), pilotYouTubeVideoIds)).toThrow();
  });

  it("requires every pilot video to have one common owner channel", () => {
    const scope = ["AbCdEfGhI12", "JkLmNoPqR34", "StUvWxYzA56"];
    expect(requireCommonPilotOwner(scope, scope.map((videoId) => ({ videoId, channelId: "church_channel" })))).toBe("church_channel");
    expect(() => requireCommonPilotOwner(scope, scope.slice(0, 2).map((videoId) => ({ videoId, channelId: "church_channel" })))).toThrow();
    expect(() => requireCommonPilotOwner(scope, scope.map((videoId, index) => ({
      videoId,
      channelId: index === 2 ? "different_channel" : "church_channel"
    })))).toThrow();
  });
});

describe("caption-track selection", () => {
  it("prefers one eligible standard track over ASR", () => {
    const selection = selectCaptionTrack(anonymisedVideoId, [
      track({ id: "automatic", trackKind: "ASR" }),
      track({ id: "human", trackKind: "standard" })
    ]);
    expect(selection).toMatchObject({ outcome: "selected", track: { id: "human" }, eligibleTrackCount: 2 });
  });

  it("uses one eligible ASR track when no standard track exists", () => {
    expect(selectCaptionTrack(anonymisedVideoId, [track({ trackKind: "ASR" })])).toMatchObject({
      outcome: "selected",
      track: { trackKind: "ASR" }
    });
  });

  it("allows one otherwise eligible unknown-audio track with an explicit provenance warning", () => {
    const selection = selectCaptionTrack(anonymisedVideoId, [track({ trackKind: "ASR", audioTrackType: "unknown" })]);
    expect(selection).toEqual({
      outcome: "selected",
      track: track({ trackKind: "ASR", audioTrackType: "unknown" }),
      eligibleTrackCount: 1,
      warnings: [audioTrackTypeUnverifiedWarning]
    });
    if (selection.outcome !== "selected") throw new Error("Expected fallback selection");
    expect(captionAudioAssociationProvenance(selection)).toEqual({
      audioTrackType: "unknown",
      primaryAudioAssociationConfirmed: false,
      warnings: [audioTrackTypeUnverifiedWarning]
    });
    expect(selectCaptionTrack(anonymisedVideoId, [track({ trackKind: "standard", audioTrackType: "unknown" })])).toMatchObject({
      outcome: "selected",
      warnings: [audioTrackTypeUnverifiedWarning]
    });
  });

  it("stops on equal-priority ambiguity", () => {
    expect(selectCaptionTrack(anonymisedVideoId, [track({ id: "one" }), track({ id: "two" })])).toEqual({
      outcome: "ambiguous_track",
      priority: "standard",
      eligibleTrackCount: 2
    });
    expect(selectCaptionTrack(anonymisedVideoId, [
      track({ id: "one", trackKind: "ASR" }),
      track({ id: "two", trackKind: "asr" })
    ])).toEqual({ outcome: "ambiguous_track", priority: "asr", eligibleTrackCount: 2 });
  });

  it("rejects absent, wrong-language, draft, non-serving, descriptive and unsupported tracks", () => {
    expect(selectCaptionTrack(anonymisedVideoId, [])).toEqual({ outcome: "no_eligible_track", eligibleTrackCount: 0 });
    expect(selectCaptionTrack(anonymisedVideoId, [
      track({ id: "french", language: "fr" }),
      track({ id: "draft", isDraft: true }),
      track({ id: "syncing", status: "syncing" }),
      track({ id: "dubbed", audioTrackType: "dubbed" }),
      track({ id: "descriptive", audioTrackType: "descriptive" }),
      track({ id: "unknown-kind", trackKind: "unknown" })
    ])).toEqual({ outcome: "no_eligible_track", eligibleTrackCount: 0 });
  });

  it("rejects unknown audio when it is not the video's sole caption track", () => {
    expect(selectCaptionTrack(anonymisedVideoId, [
      track({ id: "unknown-one", trackKind: "ASR", audioTrackType: "unknown" }),
      track({ id: "unknown-two", trackKind: "ASR", audioTrackType: "unknown" })
    ])).toEqual({ outcome: "no_eligible_track", eligibleTrackCount: 0 });
    expect(selectCaptionTrack(anonymisedVideoId, [
      track({ id: "unknown-one", trackKind: "ASR", audioTrackType: "unknown" }),
      track({ id: "french", language: "fr" })
    ])).toEqual({ outcome: "no_eligible_track", eligibleTrackCount: 0 });
  });

  it("rejects caption results that cross video identities", () => {
    expect(() => selectCaptionTrack(anonymisedVideoId, [track({ videoId: "ZyXwVuTsR98" })])).toThrow();
  });
});

describe("private caption validation and comparison", () => {
  const exactVtt = Buffer.from([
    "WEBVTT",
    "",
    "00:00:00.500 --> 00:00:02.000",
    "Alpha beta",
    "",
    "00:00:01.800 --> 00:00:04.250",
    "beta gamma",
    ""
  ].join("\r\n"));

  it("removes repeated rolling text when adjacent cues overlap or touch in time", () => {
    const official = parseVttBytes(exactVtt);
    const studio = analyzeStudioExport("Alpha beta gamma\n");
    expect(official).toMatchObject({ wordCount: 3, cueCount: 2, firstCueTimeMs: 500, finalCueTimeMs: 4_250 });
    expect(compareCaptionAnalyses(official, studio)).toMatchObject({
      normalizedWordSequenceMatches: true,
      meaningfulWordingDifference: false,
      requiresManualReview: false
    });
  });

  it("retains repeated words when adjacent cues have a positive time gap", () => {
    const parsed = parseVttBytes(Buffer.from([
      "WEBVTT",
      "",
      "00:00:00.000 --> 00:00:01.000",
      "Alpha beta",
      "",
      "00:00:01.100 --> 00:00:02.000",
      "beta gamma",
      ""
    ].join("\n")));
    expect(parsed).toMatchObject({ wordCount: 4, normalizedWords: ["alpha", "beta", "beta", "gamma"] });
  });

  it("flags any normalized wording difference for manual review", () => {
    const comparison = compareCaptionAnalyses(parseVttBytes(exactVtt), analyzeStudioExport("Alpha delta gamma\n"));
    expect(comparison).toMatchObject({
      normalizedWordSequenceMatches: false,
      meaningfulWordingDifference: true,
      requiresManualReview: true,
      commonPrefixWordCount: 1,
      commonSuffixWordCount: 1
    });
  });

  it("rejects malformed and non-UTF-8 downloads", () => {
    for (const [value, code] of [
      [Buffer.from("not vtt\n"), "invalid_webvtt_header"],
      [Buffer.from("WEBVTT\n\n00:00:05.000 --> 00:00:01.000\nwords\n"), "cue_time_reversed"],
      [Buffer.from([0xff, 0xfe, 0xfd]), "invalid_utf8"]
    ] as const) {
      try {
        parseVttBytes(value);
        throw new Error("Expected malformed fixture rejection");
      } catch (error) {
        expect(captionParseFailureCode(error)).toBe(code);
      }
    }
  });

  it("accepts optional WEBVTT header text and empty cues without inventing words", () => {
    const parsed = parseVttBytes(Buffer.from([
      "WEBVTT generated export",
      "",
      "00:00:00.000 --> 00:00:01.000",
      "",
      "00:00:01.000 --> 00:00:02.000",
      "Alpha beta",
      ""
    ].join("\n")));
    expect(parsed).toMatchObject({ cueCount: 2, wordCount: 2 });
  });

  it("keeps whitespace-only payload lines inside a cue until a truly empty separator", () => {
    const parsed = parseVttBytes(Buffer.from([
      "WEBVTT",
      "",
      "00:00:00.000 --> 00:00:02.000",
      " ",
      "<00:00:00.500>Alpha beta",
      ""
    ].join("\n")));
    expect(parsed).toMatchObject({ cueCount: 1, wordCount: 2, normalizedWords: ["alpha", "beta"] });
  });

  it("preserves exact bytes and makes identical reruns non-mutating", async () => {
    const root = await mkdtemp(join(tmpdir(), "youtube-caption-proof-"));
    temporaryDirectories.push(root);
    const first = await persistExactCaptionBytes(root, anonymisedVideoId, "caption_1", exactVtt);
    const second = await persistExactCaptionBytes(root, anonymisedVideoId, "caption_1", exactVtt);
    expect(first.persistence).toBe("created");
    expect(second).toEqual({ ...first, persistence: "unchanged" });
    expect(await readFile(first.path)).toEqual(exactVtt);
  });
});

describe("provider and content-exclusion guardrails", () => {
  it("contains only official read calls and never requests translation", async () => {
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const source = await readFile(join(repositoryRoot, "src", "youtube", "pilot-caption-cli.ts"), "utf8");
    expect(source).toContain("youtube.captions.list");
    expect(source).toContain("youtube.captions.download");
    expect(source).toContain('tfmt: "vtt"');
    expect(source).not.toMatch(/\btlang\b/u);
    expect(source).not.toMatch(/youtube\.(?:captions\.(?:insert|update|delete)|videos\.(?:insert|update|delete))/u);
    expect(source).not.toMatch(/(?:yt-dlp|youtube-dl|ffmpeg|speech[-_ ]to[-_ ]text|third[-_ ]party)/iu);
  });

  it("keeps credentials and private proof output outside tracked paths", async () => {
    const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const ignore = await readFile(join(repositoryRoot, ".gitignore"), "utf8");
    expect(ignore).toContain("/youtube-oath/");
    expect(ignore).toContain("phase-3b2-pilot/");
    const source = await readFile(join(repositoryRoot, "src", "youtube", "pilot-caption-cli.ts"), "utf8");
    expect(source).not.toMatch(/process\.(?:stdout|stderr)\.write\([^\n]*(?:studioSource|bytes|response\.data)/u);
  });
});

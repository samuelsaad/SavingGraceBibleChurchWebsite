import { describe, expect, it } from "vitest";
import {
  canonicalYouTubeUrl,
  normalizeSermonAudio,
  normalizeYouTube,
  resolveYouTubeIdentity,
  youtubeVideoIdFromUrl
} from "../src/domain/media";
import { transformLegacySermon } from "../src/migration/transform";
import { legacySermonFixture } from "./fixtures/legacy-sermon";

describe("media normalisation", () => {
  it("normalises a YouTube short link", () => {
    const result = normalizeYouTube("https://youtu.be/abcdefghijk", "Example");
    expect(result?.media).toMatchObject({
      provider: "youtube",
      externalId: "abcdefghijk",
      canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      title: "Video: Example"
    });
  });

  it("uses the video ID as canonical identity and removes unrelated query data", () => {
    expect(youtubeVideoIdFromUrl("https://www.youtube.com/watch?v=abcdefghijk&list=PL123&t=45&utm_source=test"))
      .toBe("abcdefghijk");
    expect(youtubeVideoIdFromUrl("https://youtu.be/abcdefghijk?si=tracking"))
      .toBe("abcdefghijk");
    expect(youtubeVideoIdFromUrl("https://m.youtube.com/shorts/abcdefghijk?feature=share"))
      .toBe("abcdefghijk");
    expect(youtubeVideoIdFromUrl("https://www.youtube.com/embed/abcdefghijk?start=45"))
      .toBe("abcdefghijk");
    expect(canonicalYouTubeUrl("abcdefghijk"))
      .toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(normalizeYouTube("https://www.youtube.com/watch?v=abcdefghijk&list=PL123", "Example")?.media)
      .toMatchObject({ externalId: "abcdefghijk", canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk" });
  });

  it("rejects insecure, malformed, and lookalike YouTube locations", () => {
    expect(youtubeVideoIdFromUrl("http://www.youtube.com/watch?v=abcdefghijk")).toBeNull();
    expect(youtubeVideoIdFromUrl("https://youtube.example/watch?v=abcdefghijk")).toBeNull();
    expect(youtubeVideoIdFromUrl("https://www.youtube.com/watch?v=too-short")).toBeNull();
    expect(youtubeVideoIdFromUrl("https://example.test/?next=https://youtu.be/abcdefghijk")).toBeNull();
  });

  it("resolves matching stored identities and fails closed on missing, invalid, or conflicts", () => {
    expect(resolveYouTubeIdentity([
      { videoId: "abcdefghijk", canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk" },
      { videoId: null, canonicalUrl: "https://youtu.be/abcdefghijk?si=discarded" }
    ])).toEqual({
      status: "available",
      videoId: "abcdefghijk",
      canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk"
    });
    expect(resolveYouTubeIdentity([])).toEqual({ status: "missing" });
    expect(resolveYouTubeIdentity([{ videoId: null, canonicalUrl: "https://example.test/video" }]))
      .toEqual({ status: "invalid" });
    expect(resolveYouTubeIdentity([
      { videoId: "abcdefghijk", canonicalUrl: null },
      { videoId: "lmnopqrstuv", canonicalUrl: null }
    ])).toEqual({ status: "conflicting" });
    expect(resolveYouTubeIdentity([
      { videoId: "abcdefghijk", canonicalUrl: "https://youtu.be/lmnopqrstuv" }
    ])).toEqual({ status: "invalid" });
  });

  it("extracts SermonAudio as inert text and never exposes raw iframe markup", () => {
    const source =
      '<iframe src="https://embed.sermonaudio.com/player/example-sermon" width="100"></iframe>';
    const normalized = normalizeSermonAudio(source, "Example");

    expect(normalized?.media.provider).toBe("sermonaudio");
    expect(JSON.stringify(normalized?.media)).not.toContain("<iframe");
    expect(normalized?.media.title).toBe("Audio: Example");
    expect(normalized?.sourceAudit.originalValue).toBe(source);

    const transformed = transformLegacySermon(
      legacySermonFixture({ meta: { biblePassage: null, youtube: null, audioEmbed: source } })
    );
    expect(JSON.stringify(transformed.report)).not.toContain("<iframe");
    expect(JSON.stringify(transformed.sermon)).not.toContain("<iframe");
    expect(transformed.privateSourceAudit?.mediaSources[0]?.originalValue).toBe(source);
  });

  it("rejects script-bearing or unapproved audio embeds", () => {
    expect(
      normalizeSermonAudio(
        '<script>alert(1)</script><iframe src="https://example.test/audio"></iframe>',
        "Unsafe"
      )
    ).toBeNull();
  });
});

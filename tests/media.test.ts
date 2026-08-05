import { describe, expect, it } from "vitest";
import { normalizeSermonAudio, normalizeYouTube } from "../src/domain/media";
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

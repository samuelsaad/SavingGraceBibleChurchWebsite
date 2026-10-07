import { describe, expect, it } from "vitest";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import { recordingDurationSchema, type PublicMedia, type SermonDetail, type SermonSummary } from "../src/domain/sermon";
import { sermonCard } from "../src/frontend/components/cards";
import { entry } from "../src/frontend/components/catalogue";
import { sermonMedia } from "../src/frontend/components/media";
import { recordingDuration, recordingDurationLabel, sermonRecordingDuration } from "../src/frontend/components/recording-duration";
import { sermonJournal } from "../src/frontend/components/sermon-journal";
import { renderPublicSermonPage } from "../src/frontend/pages/sermon";
import { siteLinks, publicRenderContext } from "../src/frontend/routes";
import { buildPublishedSermonDetailQuery, buildPublishedSermonListQuery, buildRelatedPublishedSermonsQuery } from "../src/server/queries/public-sermons";
import { PostgresSermonRepository, type SqlExecutor } from "../src/server/repositories/postgres-sermon-repository";

const youtube: PublicMedia = { provider: "youtube", mediaType: "video", externalId: "abcdefghijk",
  canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk", title: "Synthetic video", durationSeconds: null };
const audio: PublicMedia = { provider: "sermonaudio", mediaType: "audio", externalId: "101012345678",
  canonicalUrl: "https://www.sermonaudio.com/sermons/101012345678", title: "Synthetic audio", durationSeconds: 4328 };
const duration = recordingDurationSchema.parse({ provider: audio.provider, mediaType: audio.mediaType,
  externalId: audio.externalId, durationSeconds: audio.durationSeconds });
const summary: SermonSummary = {
  id: "00000000-0000-4000-8000-000000000001", title: "Anonymous duration fixture", slug: "anonymous-duration-fixture",
  serviceDate: "2026-01-04", summary: "This synthetic description contains no real sermon content and exists only to test recording metadata rendering.",
  speaker: { name: "Example Speaker", slug: "example-speaker" }, series: [], books: [], scriptureReferences: [],
  primaryPassages: [], primaryPassageState: "none", primaryMedia: youtube, recordingDuration: duration
};
const detail: SermonDetail = { ...summary, seoDescription: null, body: null, media: [youtube, audio],
  transcript: { bodyText: "A short anonymous transcript fixture." }, questionAnswers: [], relatedSermons: [] };

describe("recording duration display", () => {
  it.each([[1, "0:01"], [59, "0:59"], [60, "1:00"], [2732, "45:32"], [3599, "59:59"],
    [3600, "1:00:00"], [4328, "1:12:08"], [90061, "25:01:01"]])("formats %s seconds as %s", (seconds, expected) => {
    expect(recordingDuration(seconds as number)).toBe(expected);
  });

  it("refuses unknown, zero, fractional, negative and unsafe values without an estimate", () => {
    for (const value of [undefined, null, 0, -1, 1.1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(recordingDuration(value)).toBeNull();
    }
    expect(sermonRecordingDuration({ primaryMedia: { ...youtube, durationSeconds: 300 }, recordingDuration: null })).toBeNull();
    expect(sermonRecordingDuration({ primaryMedia: { ...youtube, durationSeconds: 300 } })).toMatchObject({ provider: "youtube", durationSeconds: 300 });
    expect(recordingDurationSchema.safeParse({ ...duration, mediaType: "video" }).success).toBe(false);
    expect(recordingDurationSchema.safeParse({ ...duration, durationSeconds: 0 }).success).toBe(false);
  });

  it("keeps the chosen audio duration separate from the unchanged primary video", () => {
    expect(sermonRecordingDuration(summary)).toEqual(duration);
    expect(summary.primaryMedia?.durationSeconds).toBeNull();
    const label = String(recordingDurationLabel(duration));
    expect(label).toContain('datetime="PT4328S"');
    expect(label).toContain('aria-label="SermonAudio audio duration: 1 hour, 12 minutes, 8 seconds"');
    expect(label).toContain(">1:12:08</time>");
    expect(label).not.toContain("YouTube");
  });

  it("renders the same recorded length in V5, cards, rows, related entries and detail metadata", () => {
    const links = siteLinks(publicRenderContext);
    const surfaces = [String(sermonJournal([summary], links)), String(sermonCard(summary, { links, headingLevel: 3, latest: true })),
      ...(["card", "row", "related"] as const).map(variant => String(entry(summary, { variant, headingLevel: 3, links }))),
      renderPublicSermonPage(detail)];
    for (const page of surfaces) {
      expect(page).toContain(">1:12:08</time>");
      expect(page).toContain("SermonAudio audio duration:");
      expect(page).not.toContain("Duration unavailable");
    }
    expect(String(sermonJournal([{ ...summary, recordingDuration: null }], links))).toContain("Duration unavailable");
  });

  it("labels each player with only its own duration and preserves deliberate loading", () => {
    const result = sermonMedia(detail);
    expect(String(result.video)).not.toContain("1:12:08");
    expect(String(result.video)).toContain("data-load-youtube");
    expect(String(result.audio[0])).toContain("Audio length:");
    expect(String(result.audio[0])).toContain(">1:12:08</time>");
    expect(String(result.audio[0])).toContain("data-load-sermonaudio");
    expect(String(result.audioLinks[0])).toContain(audio.canonicalUrl);
    expect(JSON.stringify(result)).not.toMatch(/<iframe|autoplay=|<audio|<video/u);
    expect(String(sermonMedia({ ...detail, media: [{ ...youtube, durationSeconds: 2732 }] }).video)).toContain(">45:32</time>");
  });
});

describe("recording duration query adapter", () => {
  it("adds the provider-bound projection without changing primary media or eligibility", () => {
    const statements = [buildPublishedSermonListQuery(publicSermonListQuerySchema.parse({})),
      buildPublishedSermonDetailQuery("anonymous-duration-fixture"), buildRelatedPublishedSermonsQuery(summary.id, 3)];
    for (const statement of statements) {
      expect(statement.text).toContain("AS primary_media");
      expect(statement.text).toContain("AS recording_duration");
      expect(statement.text).toContain("recording.duration_seconds > 0");
      expect(statement.text).toContain("ORDER BY CASE WHEN recording.provider = 'sermonaudio' THEN 0 ELSE 1 END");
      expect(statement.text).toContain("status = 'published'");
    }
  });

  it("carries secondary recording duration through list, detail, related and series adapters", async () => {
    const row = { id: summary.id, title: summary.title, slug: summary.slug, service_date: summary.serviceDate, summary: summary.summary,
      speaker: summary.speaker, series: [], scripture_references: [], primary_passages: [], primary_passage_state: "none", books: [],
      primary_media: youtube, recording_duration: duration, total_items: 1, media: [youtube, audio], body: null, seo_description: null,
      transcript: detail.transcript, question_answers: [], relationship_reasons: ["same_speaker"], representative_series: { name: "Example Series", slug: "example-series" } };
    const executor: SqlExecutor = { async query() { return { rows: [row], rowCount: 1, command: "SELECT", oid: 0, fields: [] }; } };
    const repository = new PostgresSermonRepository(executor);
    const listed = await repository.listPublished(publicSermonListQuerySchema.parse({}));
    const found = await repository.findPublishedBySlug(summary.slug);
    const series = await repository.listPublishedSeriesRepresentatives();
    for (const sermon of [listed.data[0], found, found?.relatedSermons[0], series[0]?.sermon]) {
      expect(sermon?.primaryMedia).toEqual(youtube);
      expect(sermon?.recordingDuration).toEqual(duration);
    }
  });
});

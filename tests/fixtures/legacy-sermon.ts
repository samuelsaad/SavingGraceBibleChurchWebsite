import type { LegacySermonRecord } from "../../src/migration/types";

export function legacySermonFixture(
  overrides: Partial<LegacySermonRecord> = {}
): LegacySermonRecord {
  return {
    sourceTable: "wp_posts",
    sourceId: 1001,
    postType: "sermons",
    postStatus: "publish",
    title: "An anonymised sermon",
    slug: "an-anonymised-sermon",
    postDateLocal: "2026-08-02 10:00:00",
    postDateGmt: "2026-08-02 00:00:00",
    postModifiedLocal: "2026-08-02 12:00:00",
    postModifiedGmt: "2026-08-02 02:00:00",
    body: "",
    summary: "",
    legacyViewCount: 10,
    speakers: [],
    series: [],
    books: [],
    passageTerms: [],
    meta: {
      biblePassage: null,
      youtube: null,
      audioEmbed: null
    },
    ...overrides
  };
}

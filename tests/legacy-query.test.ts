import { describe, expect, it } from "vitest";
import {
  InvalidLegacySermonQueryError,
  parseLegacyDateRange,
  translateLegacySermonQuery
} from "../src/api/legacy-sermon-query";

describe("legacy sermon query compatibility", () => {
  it("translates legacy filters and the inclusive date pair", () => {
    const translated = translateLegacySermonQuery(
      new URLSearchParams({
        s: "grace",
        sermon_speaker: "example-speaker",
        sermon_series: "example-series",
        sermon_topics: "romans-8",
        sermon_book: "romans",
        sermon_dates: "2026-08-02 - 2026-08-09"
      })
    );

    expect(translated).toEqual({
      query: "grace",
      speaker: "example-speaker",
      series: "example-series",
      passage: "romans-8",
      book: "romans",
      dateFrom: "2026-08-02",
      dateTo: "2026-08-09"
    });
  });

  it("rejects malformed and reversed date pairs", () => {
    expect(() => parseLegacyDateRange("2026-08-02")).toThrow(
      InvalidLegacySermonQueryError
    );
    expect(() => parseLegacyDateRange("2026-08-09 - 2026-08-02")).toThrow(
      "end must not precede start"
    );
  });

  it("gives explicit modern parameters precedence", () => {
    const translated = translateLegacySermonQuery(
      new URLSearchParams({ query: "modern", s: "legacy", dateFrom: "2026-08-02" })
    );
    expect(translated).toMatchObject({ query: "modern", dateFrom: "2026-08-02" });
  });
});

import { describe, expect, it } from "vitest";
import { runMigrationDryRun } from "../src/migration/importer";
import { transformLegacySermon } from "../src/migration/transform";
import { legacySermonFixture } from "./fixtures/legacy-sermon";

describe("Yang migration inclusion contract", () => {
  it("includes published and titled pending while excluding drafts, blank pending, and legacy sources", () => {
    const report = runMigrationDryRun([
      legacySermonFixture({ sourceId: 1, slug: "published", postStatus: "publish" }),
      legacySermonFixture({ sourceId: 2, slug: "pending", postStatus: "pending", title: "Pending" }),
      legacySermonFixture({ sourceId: 3, slug: "blank-pending", postStatus: "pending", title: "   " }),
      legacySermonFixture({ sourceId: 4, slug: null, postStatus: "draft" }),
      legacySermonFixture({ sourceId: 5, slug: "old-plugin", postType: "wpfc_sermon" }),
      legacySermonFixture({ sourceId: 6, sourceTable: "wp_sb_sermons", postType: null })
    ]);

    expect(report.summary).toMatchObject({
      total: 6,
      included: 2,
      excluded: 4,
      rejected: 0,
      publishedIncluded: 1,
      pendingIncluded: 1
    });
    expect(report.candidates.map((candidate) => candidate.status)).toEqual([
      "published",
      "pending"
    ]);
    expect(report.records.map((record) => record.reasonCode)).toEqual([
      "included_published",
      "included_titled_pending",
      "excluded_blank_pending_title",
      "excluded_draft",
      "excluded_legacy_post_type",
      "excluded_legacy_table"
    ]);
  });

  it("preserves a non-Sunday date and emits a review warning", () => {
    const result = transformLegacySermon(
      legacySermonFixture({ postDateLocal: "2026-08-03 10:00:00" })
    );

    expect(result.sermon?.serviceDate).toBe("2026-08-03");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({ code: "non_sunday_service_date" })
    );
  });

  it("keeps legacy views in private migration audit only", () => {
    const result = transformLegacySermon(legacySermonFixture({ legacyViewCount: 42 }));

    expect(result.privateSourceAudit?.legacyViewCount).toBe(42);
    expect(JSON.stringify(result.sermon)).not.toContain("legacyViewCount");
    expect(JSON.stringify(result.report)).not.toContain("legacyViewCount");
  });

  it("is deterministic across identical dry runs", () => {
    const records = [legacySermonFixture()];
    expect(runMigrationDryRun(records)).toEqual(runMigrationDryRun(records));
  });

  it("rejects a case-insensitive canonical slug collision", () => {
    const report = runMigrationDryRun([
      legacySermonFixture({ sourceId: 1, slug: "same-slug" }),
      legacySermonFixture({ sourceId: 2, slug: "same-slug" })
    ]);

    expect(report.summary).toMatchObject({ included: 1, rejected: 1 });
    expect(report.records[1]?.reasonCode).toBe("duplicate_canonical_slug");
  });
});

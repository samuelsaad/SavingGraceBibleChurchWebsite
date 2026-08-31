import { describe, expect, it } from "vitest";
import { buildPublishedSermonDetailQuery, buildPublishedSermonListQuery, buildPublishedSermonSitemapQuery } from "../src/server/queries/public-sermons";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";

describe("authoritative frontend sermon selector", () => {
  const query = publicSermonListQuerySchema.parse({ page: 1, pageSize: 9 });

  it("requires full approved current content for ordinary public routes", () => {
    const list = buildPublishedSermonListQuery(query, "public").text;
    const detail = buildPublishedSermonDetailQuery("anonymised-sermon", "public").text;
    for (const sql of [list, detail]) {
      expect(sql).toContain("status = 'published'");
      expect(sql).toContain("frontend_readiness.is_complete");
      expect(sql).toContain("frontend_readiness.has_required_passage_decision");
      expect(sql).toContain("summary_status = 'approved'");
      expect(sql).toContain("sermon-enrichment:v2");
      expect(sql).toContain("phase3b2c-wave1-extractive-drafts-v2");
      expect(sql).toContain("status <> 'approved'");
    }
  });

  it("limits preview selection to completed private pilot and Wave 1 records", () => {
    const sql = buildPublishedSermonListQuery(query, "completed_preview").text;
    expect(sql).toContain("status = 'draft'");
    expect(sql).toContain("published_at IS NULL");
    expect(sql).toContain("preview_review.current_stage = 6");
    expect(sql).toContain("preview_review.completed_at IS NOT NULL");
    expect(sql).toContain("frontend_readiness.has_required_passage_decision");
    expect(sql).toContain("phase3b2-caption-v1");
    expect(sql).toContain("phase3b2b-punctuation-v2");
    expect(sql).toContain("phase3b2c-wave1-extractive-drafts-v2");
  });

  it("keeps sitemap generation on the strict public selector", () => {
    const sql = buildPublishedSermonSitemapQuery().text;
    expect(sql).toContain("status = 'published'");
    expect(sql).not.toContain("status = 'draft'");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildPublishedSeriesRepresentativesQuery,
  buildPublishedSermonDetailQuery,
  buildPublishedSermonFilterOptionsQuery,
  buildPublishedSermonListQuery,
  buildPublishedSermonSitemapQuery
} from "../src/server/queries/public-sermons";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import { localFrontendPreviewScope } from "../src/server/restricted-preview-scope";

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
    expect(sql).toContain("source_status = 'public-development-dataset-v1'");
    expect(sql).toContain(" OR (");
    expect(sql).toContain("preview_review.current_stage = 6");
    expect(sql).toContain("preview_review.completed_at IS NOT NULL");
    expect(sql).toContain("frontend_readiness.has_required_passage_decision");
    expect(sql).toContain("phase3b2-caption-v1");
    expect(sql).toContain("phase3b2b-punctuation-v2");
    expect(sql).toContain("phase3b2c-wave1-extractive-drafts-v2");
  });

  it("does not add the tracked development-seed marker to public selectors", () => {
    const list = buildPublishedSermonListQuery(query, "public").text;
    const sitemap = buildPublishedSermonSitemapQuery().text;
    expect(list).not.toContain("public-development-dataset-v1");
    expect(sitemap).not.toContain("public-development-dataset-v1");
  });

  it("keeps sitemap generation on the strict public selector", () => {
    const sql = buildPublishedSermonSitemapQuery().text;
    expect(sql).toContain("status = 'published'");
    expect(sql).not.toContain("status = 'draft'");
  });

  it("uses stable recent and latest-per-series ordering", () => {
    const recent = buildPublishedSermonListQuery(query, "public").text;
    expect(recent).toContain("ORDER BY s.service_date DESC, s.id");

    const representatives = buildPublishedSeriesRepresentativesQuery("completed_preview").text;
    expect(representatives).toContain("PARTITION BY sermon_series.id");
    expect(representatives).toContain("ORDER BY sermon.service_date DESC, sermon.id");
    expect(representatives).toContain("WHERE ranked.representative_rank = 1");
  });

  it("derives selectable verses only from confirmed eligible single-chapter ranges", () => {
    const sql = buildPublishedSermonFilterOptionsQuery("completed_preview").text;
    expect(sql).toContain("primary_passage.relationship_role = 'primary'");
    expect(sql).toContain("primary_passage.review_status = 'confirmed'");
    expect(sql).toContain("primary_passage.start_chapter = primary_passage.end_chapter");
    expect(sql).toContain("generate_series(");
  });

  it("projects per-option sermon counts from distinct eligible sermons", () => {
    for (const mode of ["public", "completed_preview"] as const) {
      const sql = buildPublishedSermonFilterOptionsQuery(mode).text;
      expect(sql).toContain("count(DISTINCT sermon.id)::integer");
      expect(sql).toContain("'sermonCount', options.sermon_count");
      expect(sql.match(/GROUP BY/gu)?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it("matches a selected verse through inclusive primary-passage range overlap", () => {
    const passage = publicSermonListQuerySchema.parse({
      passageBook: "romans",
      passageChapter: 8,
      passageVerse: 3,
      page: 1,
      pageSize: 9
    });
    const sql = buildPublishedSermonListQuery(passage, "public").text;
    expect(sql).toContain("primary_filter.relationship_role = 'primary'");
    expect(sql).toContain("primary_filter.review_status = 'confirmed'");
    expect(sql).toContain("<=");
    expect(sql).toContain(">=");
  });

  it("enables D-161 accepted records locally only through the exact fail-closed gate", () => {
    expect(localFrontendPreviewScope({})).toBe("completed_preview");
    expect(localFrontendPreviewScope({ D161_RESTRICTED_ACCEPTANCE_ENABLED: "1" })).toBe("d161_restricted_accepted");
    expect(() => localFrontendPreviewScope({ D161_RESTRICTED_ACCEPTANCE_ENABLED: "0" })).toThrow(
      "d161_restricted_preview_configuration_refused"
    );
  });

  it("enables D-162 accepted records only through its newer fail-closed combined gate", () => {
    expect(localFrontendPreviewScope({ D162_RESTRICTED_ACCEPTANCE_ENABLED: "1" })).toBe("d162_restricted_accepted");
    expect(localFrontendPreviewScope({
      D161_RESTRICTED_ACCEPTANCE_ENABLED: "1",
      D162_RESTRICTED_ACCEPTANCE_ENABLED: "1"
    })).toBe("d162_restricted_accepted");
    expect(() => localFrontendPreviewScope({ D162_RESTRICTED_ACCEPTANCE_ENABLED: "0" })).toThrow(
      "d162_restricted_preview_configuration_refused"
    );
    const sql = buildPublishedSermonListQuery(query, "d162_restricted_accepted").text;
    expect(sql).toContain("sermon_restricted_acceptances");
    expect(sql).toContain("sermon_d161_restricted_acceptances");
    expect(sql).toContain("sermon_d162_restricted_acceptances");
    expect(sql).toContain("d162_restricted_acceptance_dependency");
  });

  it("exposes D-167 only behind an explicit protected scope, never in public or the existing 148-sermon selector", () => {
    expect(localFrontendPreviewScope({ D167_RESTRICTED_ACCEPTANCE_ENABLED: "1" })).toBe("d167_restricted_accepted");
    expect(() => localFrontendPreviewScope({ D167_RESTRICTED_ACCEPTANCE_ENABLED: "0" })).toThrow(
      "d167_restricted_preview_configuration_refused"
    );
    const protectedSql = buildPublishedSermonListQuery(query, "d167_restricted_accepted").text;
    expect(protectedSql).toContain("sermon_d167_restricted_acceptances");
    expect(protectedSql).toContain("d167_restricted_acceptance_dependency");
    for (const scope of ["public", "restricted_accepted", "d161_restricted_accepted"] as const) {
      expect(buildPublishedSermonListQuery(query, scope).text).not.toContain("sermon_d167_restricted_acceptances");
    }
    expect(buildPublishedSermonSitemapQuery().text).not.toContain("sermon_d167_restricted_acceptances");
  });
});

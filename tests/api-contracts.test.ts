import { describe, expect, it } from "vitest";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import {
  adminSermonListQuerySchema,
  applicationRoleSchema,
  controlledMediaInputSchema,
  createSermonInputSchema,
  enrichmentReviewItemDecisionInputSchema,
  enrichmentReviewProgressInputSchema,
  finishEnrichmentReviewInputSchema,
  permanentlyDeleteSermonInputSchema,
  updateSermonInputSchema
} from "../src/api/contracts/admin-sermons";
import {
  buildPublishedSermonDetailQuery,
  buildPublishedSermonListQuery
} from "../src/server/queries/public-sermons";

describe("public sermon API contract", () => {
  it("applies safe pagination defaults", () => {
    const parsed = publicSermonListQuerySchema.parse({});
    expect(parsed).toMatchObject({ page: 1, pageSize: 9, order: "DESC" });
  });

  it("rejects reversed date ranges", () => {
    expect(() =>
      publicSermonListQuerySchema.parse({ dateFrom: "2026-08-03", dateTo: "2026-08-02" })
    ).toThrow();
    expect(() => publicSermonListQuerySchema.parse({ dateFrom: "2026-02-30" })).toThrow();
  });

  it("builds parameterized search/filter SQL without interpolating user values", () => {
    const query = buildPublishedSermonListQuery(
      publicSermonListQuerySchema.parse({
        query: "grace' OR true--",
        speaker: "example-speaker",
        page: 2
      })
    );

    expect(query.text).not.toContain("grace' OR true--");
    expect(query.text).toContain("s.status = 'published'");
    expect(query.text).toContain("summary_status = 'approved'");
    expect(query.values).toContain("grace' OR true--");
    expect(query.values).toContain("%grace' OR true--%");
    expect(query.values).toContain("example-speaker");
  });

  it("keeps every taxonomy dimension as an independent AND predicate", () => {
    const query = buildPublishedSermonListQuery(
      publicSermonListQuerySchema.parse({
        speaker: "example-speaker",
        series: "example-series",
        passage: "romans-8",
        book: "romans"
      })
    );

    expect(query.text.match(/EXISTS \(/g)).toHaveLength(4);
    expect(query.text).not.toMatch(/relation\s*=>?\s*['"]OR/i);
    expect(query.values.slice(0, 4)).toEqual([
      "example-speaker",
      "example-series",
      "romans-8",
      "romans"
    ]);
  });

  it("keeps the detail body while gating description and SEO override together", () => {
    const query = buildPublishedSermonDetailQuery("an-anonymised-sermon");
    expect(query.text).toContain("s.body");
    expect(query.text.match(/summary_status = 'approved'/g)).toHaveLength(2);
  });
});

describe("admin sermon API contract", () => {
  it("has one active application role and validates admin list filters", () => {
    expect(applicationRoleSchema.parse("admin")).toBe("admin");
    expect(() => applicationRoleSchema.parse("editor")).toThrow();
    expect(() => applicationRoleSchema.parse("contributor")).toThrow();
    expect(
      adminSermonListQuerySchema.parse({
        query: "grace",
        serviceDateFrom: "2026-08-01",
        serviceDateTo: "2026-08-31"
      })
    ).toMatchObject({ page: 1, pageSize: 20 });
    expect(() =>
      adminSermonListQuerySchema.parse({
        serviceDateFrom: "2026-09-01",
        serviceDateTo: "2026-08-31"
      })
    ).toThrow();
  });

  it("requires optimistic concurrency and an actual edit", () => {
    expect(() => updateSermonInputSchema.parse({ rowVersion: 1 })).toThrow();
    expect(updateSermonInputSchema.parse({ rowVersion: 1, title: "Updated" })).toMatchObject({
      rowVersion: 1,
      title: "Updated"
    });
  });

  it("accepts an explicit Bible-book assignment and rejects duplicate relationships", () => {
    const bookId = "4b4ae324-6cf8-5510-9f77-c5c88a308fc4";
    expect(updateSermonInputSchema.parse({
      rowVersion: 1,
      bookClassificationIds: [bookId]
    })).toMatchObject({ bookClassificationIds: [bookId] });
    expect(() => updateSermonInputSchema.parse({
      rowVersion: 1,
      bookClassificationIds: [bookId, bookId]
    })).toThrow();
  });

  it("requires explicit, versioned guided-review progress and item decisions", () => {
    expect(enrichmentReviewProgressInputSchema.parse({
      sermonRowVersion: 3,
      reviewRowVersion: 2,
      currentStage: 4,
      identityStatus: "confirmed"
    })).toMatchObject({ currentStage: 4, identityStatus: "confirmed" });
    expect(() => enrichmentReviewProgressInputSchema.parse({
      sermonRowVersion: 3,
      reviewRowVersion: 2,
      currentStage: 7
    })).toThrow();
    expect(() => enrichmentReviewItemDecisionInputSchema.parse({
      sermonRowVersion: 3,
      reviewRowVersion: 2,
      itemRowVersion: 1,
      transcriptRowVersion: 5,
      decision: "pending"
    })).toThrow();
    expect(() => enrichmentReviewItemDecisionInputSchema.parse({
      sermonRowVersion: 3,
      reviewRowVersion: 2,
      itemRowVersion: 1,
      transcriptRowVersion: 5,
      decision: "corrected",
      originalWording: "Original wording"
    })).toThrow("Enter the reviewed correction");
    expect(() => enrichmentReviewItemDecisionInputSchema.parse({
      sermonRowVersion: 3,
      reviewRowVersion: 2,
      itemRowVersion: 1,
      transcriptRowVersion: 5,
      decision: "corrected",
      correctionText: "Corrected wording"
    })).toThrow("exact original transcript wording");
    expect(enrichmentReviewItemDecisionInputSchema.parse({
      sermonRowVersion: 3,
      reviewRowVersion: 2,
      itemRowVersion: 1,
      transcriptRowVersion: 5,
      decision: "left_unresolved"
    })).toMatchObject({ decision: "left_unresolved" });
    expect(finishEnrichmentReviewInputSchema.parse({
      sermonRowVersion: 3,
      reviewRowVersion: 2
    })).toEqual({ sermonRowVersion: 3, reviewRowVersion: 2 });
  });

  it("always creates a draft and rejects arbitrary status input", () => {
    const valid = {
      title: "Local draft",
      slug: "local-draft",
      serviceDate: "2026-08-02"
    };
    expect(createSermonInputSchema.parse(valid)).not.toHaveProperty("status");
    expect(() => createSermonInputSchema.parse({ ...valid, status: "published" })).toThrow();
  });

  it("requires bounded plain text and explicit status for sermon description edits", () => {
    const base = { title: "Local draft", slug: "local-draft", serviceDate: "2026-08-02" };
    expect(() => createSermonInputSchema.parse({
      ...base,
      summary: " ",
      summaryStatus: "draft"
    })).toThrow("Sermon description text is required");
    expect(() => createSermonInputSchema.parse({
      ...base,
      summary: "<script>unsafe</script>",
      summaryStatus: "draft"
    })).toThrow("Use plain text");
    expect(() => updateSermonInputSchema.parse({ rowVersion: 1, summary: "Edited text" })).toThrow(
      "Choose the sermon description review status"
    );
    expect(() => createSermonInputSchema.parse({
      ...base,
      summary: "Too short",
      summaryStatus: "approved"
    })).toThrow("at least 80 characters");
    expect(() => createSermonInputSchema.parse({
      ...base,
      seoDescription: "Metadata cannot bypass description approval"
    })).toThrow("requires an approved sermon description");
  });

  it("accepts only one nullable speaker and rejects unsafe enrichment content", () => {
    const base = { title: "Local draft", slug: "local-draft", serviceDate: "2026-08-02" };
    expect(createSermonInputSchema.parse({ ...base, speakerId: null })).toHaveProperty(
      "speakerId",
      null
    );
    expect(() =>
      createSermonInputSchema.parse({
        ...base,
        speakerIds: ["75df2144-b557-50f6-98bd-011cd696bfb9"]
      })
    ).toThrow();
    expect(() =>
      createSermonInputSchema.parse({
        ...base,
        transcript: {
          bodyText: "<script>alert(1)</script>",
          status: "draft",
          sourceKind: "manual",
          sourceReference: null
        }
      })
    ).toThrow("Use plain text");
  });

  it("allows only provider-matched controlled media", () => {
    expect(() =>
      controlledMediaInputSchema.parse({
        provider: "youtube",
        mediaType: "video",
        externalId: "abcdefghijk",
        canonicalUrl: "https://evil.example/embed/abcdefghijk",
        title: "Unsafe"
      })
    ).toThrow("Expected a YouTube URL");
    expect(() =>
      controlledMediaInputSchema.parse({
        provider: "youtube",
        mediaType: "video",
        externalId: "abcdefghijk",
        canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Controlled video",
        embedHtml: "<iframe>unsafe</iframe>"
      })
    ).toThrow();
  });

  it("requires explicit, bounded permanent-deletion confirmation data", () => {
    expect(
      permanentlyDeleteSermonInputSchema.parse({
        rowVersion: 3,
        confirmation: "historic-sermon",
        reason: "Duplicate content",
        seoDisposition: { kind: "gone" }
      })
    ).toMatchObject({ seoDisposition: { kind: "gone" } });
    expect(() =>
      permanentlyDeleteSermonInputSchema.parse({
        rowVersion: 3,
        confirmation: "historic-sermon",
        reason: "x",
        seoDisposition: { kind: "redirect", targetPath: "https://evil.example/" }
      })
    ).toThrow();
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { renderPublicSermonPage } from "../src/frontend/pages/sermon";
import { draftPreviewRenderContext } from "../src/frontend/routes";
import {
  buildPublishedSermonDetailQuery,
  frontendSermonEligibilitySql
} from "../src/server/queries/public-sermons";
import { TunnelDraftPreviewSession } from "../src/staging/draft-preview-session";

describe("D-160 protected draft preview", () => {
  it("keeps the exception exact and separate from public eligibility", () => {
    const draft = frontendSermonEligibilitySql("s", "d160_draft_preview");
    const publicSql = frontendSermonEligibilitySql("s", "public");
    expect(draft).toContain("phase3b2c_evaluation_36_batch_6_private");
    expect(draft).toContain("phase3b2c-evaluation-36-d160-v1");
    expect(draft).toContain("s.status = 'draft'");
    expect(draft).toContain("s.published_at IS NULL");
    expect(draft).toContain("draft_review.completed_at IS NULL");
    expect(draft).toContain("NOT EXISTS");
    expect(publicSql).toContain("s.status = 'published'");
    expect(publicSql).not.toContain("phase3b2c_evaluation_36_batch_6_private");
  });

  it("projects draft content and safe review evidence only in the D-160 detail query", () => {
    const draft = buildPublishedSermonDetailQuery("anonymous-sermon", "d160_draft_preview").text;
    const publicSql = buildPublishedSermonDetailQuery("anonymous-sermon", "public").text;
    expect(draft).toContain("AS review_warnings");
    expect(draft).toContain("AS review_provenance");
    expect(draft).toContain("source_content_sha256");
    expect(publicSql).toContain("'[]'::jsonb AS review_warnings");
    expect(publicSql).toContain("NULL AS review_provenance");
  });

  it("requires the tunnel login nonce before issuing an HttpOnly session", async () => {
    const session = new TunnelDraftPreviewSession();
    const page = session.loginPage();
    const nonce = /name="nonce" value="([^"]+)"/u.exec(page)?.[1];
    expect(nonce).toBeTruthy();
    const denied = await session.issue(new Request("http://127.0.0.1:8081/draft-preview/session", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "nonce=incorrect"
    }));
    expect(denied.status).toBe(403);
    const issued = await session.issue(new Request("http://127.0.0.1:8081/draft-preview/session", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ nonce: nonce! })
    }));
    expect(issued.status).toBe(303);
    const cookie = issued.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/draft-preview");
    expect(session.authorizes(new Request("http://127.0.0.1:8081/draft-preview/", {
      headers: { cookie: cookie.split(";")[0]! }
    }))).toBe(true);
  });

  it("renders honest draft state, warnings and no canonical or Open Graph metadata", () => {
    const page = renderPublicSermonPage({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Anonymous sermon",
      slug: "anonymous-sermon",
      serviceDate: "2024-01-01",
      summary: "A sufficiently long anonymised description that remains suitable for a private fixture and contains no real sermon material.",
      speaker: null,
      series: [],
      scriptureReferences: [],
      primaryPassages: [],
      primaryPassageState: "unresolved",
      books: [],
      primaryMedia: null,
      reviewState: "draft_awaiting_review",
      seoDescription: null,
      body: null,
      media: [],
      transcript: { bodyText: "An anonymised transcript fixture with complete sentences." },
      questionAnswers: [{
        question: "What should the listener consider?",
        answer: "The anonymised fixture provides a complete answer.",
        displayOrder: 1
      }],
      reviewWarnings: [{ code: "fixture_warning", detail: "Administrator review remains required." }],
      reviewProvenance: {
        sourceSha256: "a".repeat(64),
        processingVersion: "fixture-processing-v1",
        transcriptStatus: "draft",
        descriptionStatus: "draft",
        questionAnswerStatus: "draft"
      },
      relatedSermons: []
    }, draftPreviewRenderContext);
    expect(page).toContain("Draft review status");
    expect(page).toContain("awaiting administrator review");
    expect(page).toContain("fixture_warning");
    expect(page).toContain("noindex, nofollow, noarchive");
    expect(page).not.toContain('rel="canonical"');
    expect(page).not.toContain('property="og:');
  });

  it("keeps preview and database exposure on EC2 loopback in Compose", async () => {
    const compose = await readFile("deployment/d160-draft-preview-compose.yaml", "utf8");
    expect(compose).toContain("127.0.0.1:5433:5432");
    expect(compose).toContain("network_mode: host");
    expect(compose).not.toContain("0.0.0.0");
    expect(compose).toContain("entrypoint: [node, draft-preview.cjs]");
    expect(compose).toContain("read_only: true");
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  allowedDashboardActions,
  buildControlledMediaInputs,
  buildDeletionSeoDisposition,
  expectedPublicSermonUrl,
  isResolvedReviewDecision,
  unresolvedReviewQueue,
  shouldWarnAboutSlugChange
} from "../src/admin/dashboard-model";

describe("Phase 3B administration dashboard", () => {
  it("models lifecycle, safe media, slug warnings, and deletion SEO choices", () => {
    expect(allowedDashboardActions("archived")).toEqual(["restore"]);
    expect(allowedDashboardActions("draft")).not.toContain("schedule");
    expect(allowedDashboardActions("published")).toEqual(["unpublish", "archive"]);
    expect(expectedPublicSermonUrl("grace-alone")).toBe(
      "https://www.savinggrace.org.au/sermons/grace-alone/"
    );
    expect(shouldWarnAboutSlugChange("old", "new", "2026-08-05T00:00:00.000Z")).toBe(true);
    expect(shouldWarnAboutSlugChange("old", "new", null)).toBe(false);
    expect(
      buildControlledMediaInputs({
        youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        youtubeTitle: "Video",
        sermonAudioUrl: "",
        sermonAudioTitle: ""
      })
    ).toEqual([
      {
        provider: "youtube",
        mediaType: "video",
        externalId: null,
        canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Video"
      }
    ]);
    expect(buildDeletionSeoDisposition("gone", "")).toEqual({ kind: "gone" });
    expect(buildDeletionSeoDisposition("redirect", "/sermons/replacement/")).toEqual({
      kind: "redirect",
      targetPath: "/sermons/replacement/"
    });
  });

  it("keeps resolved findings out of the active review queue", () => {
    const items = [
      { category: "caption_error", decisionStatus: "accepted" as const, id: "resolved" },
      { category: "caption_error", decisionStatus: "pending" as const, id: "pending" },
      { category: "name_or_scripture_reference", decisionStatus: "rejected" as const, id: "rejected" },
      { category: "name_or_scripture_reference", decisionStatus: "corrected" as const, id: "corrected" }
    ];
    expect(isResolvedReviewDecision("accepted")).toBe(true);
    expect(isResolvedReviewDecision("corrected")).toBe(true);
    expect(unresolvedReviewQueue(items).map((item) => item.id)).toEqual(["pending", "rejected"]);
    expect(unresolvedReviewQueue(items, "caption_error").map((item) => item.id)).toEqual(["pending"]);
  });

  it("contains the protected accessible shell and required workflows without a role selector", async () => {
    const [page, client, service] = await Promise.all([
      readFile("src/pages/admin/index.astro", "utf8"),
      readFile("src/admin/dashboard.ts", "utf8"),
      readFile("src/application/admin-sermon-service.ts", "utf8")
    ]);
    expect(page).toContain('href="#admin-main"');
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain('meta name="robots" content="noindex');
    expect(page).toContain("<style is:global>");
    expect(page).toContain("Local development only");
    expect(page).toContain("@media (max-width: 800px)");
    expect(page).toContain("@media (max-width: 480px)");
    expect(page).toContain("#review-transcript-body { width: 100%; min-height: 65vh");
    expect(page).toContain(".review-qa-card textarea[name=\"answer\"] { min-height: 16rem");
    expect(page).toContain(".review-workflow-layout");
    expect(page).toContain(".filters, .form-grid { grid-template-columns: 1fr; }");
    expect(page).toContain(".form-grid .wide { grid-column: auto; }");
    expect(page).toContain(".grid-two > * { min-width: 0; }");
    expect(page).toContain(".panel { min-width: 0;");
    expect(page).toContain("overflow-x: hidden");
    expect(page).toContain(":focus-visible");
    expect(client).toContain('name="serviceDateTo"');
    expect(client).toContain("Permanently delete sermon");
    expect(client).toContain("This action cannot be undone");
    expect(client).toContain("Unsaved changes");
    expect(client).toContain("Private local pilot only");
    expect(client).toContain("Phase 3B.2 pilot work queue");
    expect(client).toContain("Bible-book assignment required");
    expect(client).toContain("Primary Bible book");
    expect(client).toContain("Primary preaching passage");
    expect(client).toContain("Confirm entered passages");
    expect(client).toContain("Reject title proposal");
    expect(client).toContain("Confirm no primary passage");
    expect(client).toContain("data-primary-passage-control");
    expect(client).toContain("/primary-passage-decision");
    expect(client).toContain("No Bible book assigned");
    expect(client).toContain("Completed editorial stages are read-only");
    expect(client).toContain("isBibleBookControl");
    expect(client).toContain("1. Sermon basics");
    expect(client).toContain("6. Review and publish");
    expect(client).toContain("Completion checklist");
    expect(client).toContain("Sermon description");
    expect(client).toContain("sermon-description-count");
    expect(client).toContain('data-description-status="in_review"');
    expect(client).toContain("withApprovedDescription");
    expect(client).toContain("description_awaiting_review");
    expect(client).toContain("Private caption source and warnings");
    expect(client).toContain("Authorised YouTube Studio export");
    expect(client).toContain("accuracyReviewStatus");
    expect(client).toContain("Guided private review");
    expect(client).toContain("Identity and provenance");
    expect(client).toContain("Flagged review items");
    expect(client).toContain("Associated transcript wording");
    expect(client).toContain('id="review-item-category"');
    expect(client).not.toContain('id="review-item-status"');
    expect(client).toContain("Resolved history");
    expect(client).toContain("controls.forEach((control) => { control.disabled = true; })");
    expect(client).not.toContain('id="scheduled-for"');
    expect(client).toContain("presentItemCount");
    expect(client).toContain("itemSetMatches");
    expect(client).toContain("supportingContext");
    expect(client).toContain("Final review summary");
    expect(client).toContain("Technical provenance");
    expect(client).toContain("Administrator relationships");
    expect(client).toContain("Publicly eligible");
    expect(client).toContain("data-review-item-decision=\"left_unresolved\"");
    expect(client).toContain("Finish review");
    expect(client).toContain("Save and pause");
    expect(client).toContain("/review/finish");
    expect(client).toContain("/review/items/");
    expect(client).toContain("/review/empty-item-set/acknowledge");
    expect(client).toContain("No atomic flagged review items were generated for this source.");
    expect(client).toContain("Confirm inspection of no flagged items");
    expect(client).toContain("requiresEmptyItemSetAcknowledgement");
    expect(client).toContain("stageCompletion.findings");
    expect(client).toContain("Complete earlier stage first");
    expect(client).toContain("Generated description and Q&A quarantined.");
    expect(client).toContain("Superseded defective generation — replacement required.");
    expect(client).toContain("Transcript-grounded replacement draft.");
    expect(client).toContain("summary.trim().length < 80 || quarantined");
    expect(service).toContain("Save changed transcript wording as draft");
    expect(service).toContain("superseded extractive Wave 1 generator");
    expect(service).toContain("generated draft is stale");
    expect(client).toContain("/^\\/admin\\/sermons\\/[0-9a-f-]+\\/review$/i");
    const guidedRouteSource = client.slice(
      client.indexOf("const enrichmentReviewStages"),
      client.indexOf("async function renderSermonList")
    );
    expect(guidedRouteSource).toContain('serviceDate === "1970-01-01"');
    expect(guidedRouteSource).toContain("<details class=\"technical-provenance\">");
    expect(guidedRouteSource).toContain("if (stage === 1)");
    expect(guidedRouteSource).not.toContain("data-transition");
    expect(guidedRouteSource).not.toContain("open-delete");
    expect(guidedRouteSource).not.toContain("permanent-delete");
    expect(page).toContain("Phase 3B.2 private review rehearsal");
    expect(client).toContain('name="speakerId"');
    expect(client).not.toContain('name="speakerIds"');
    expect(client).toContain("x-local-identity\", \"admin");
    expect(`${page}\n${client}`).not.toMatch(/role selector|local-editor|local-contributor/i);
    expect(client).not.toContain("<iframe");
  });
});

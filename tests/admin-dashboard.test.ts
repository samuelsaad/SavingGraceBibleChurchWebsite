import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  allowedDashboardActions,
  buildControlledMediaInputs,
  buildDeletionSeoDisposition,
  expectedPublicSermonUrl,
  shouldWarnAboutSlugChange
} from "../src/admin/dashboard-model";

describe("Phase 3B administration dashboard", () => {
  it("models lifecycle, safe media, slug warnings, and deletion SEO choices", () => {
    expect(allowedDashboardActions("archived")).toEqual(["restore"]);
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

  it("contains the protected accessible shell and required workflows without a role selector", async () => {
    const [page, client] = await Promise.all([
      readFile("src/pages/admin/index.astro", "utf8"),
      readFile("src/admin/dashboard.ts", "utf8")
    ]);
    expect(page).toContain('href="#admin-main"');
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain('meta name="robots" content="noindex');
    expect(page).toContain("Local development only");
    expect(page).toContain("@media (max-width: 800px)");
    expect(page).toContain("@media (max-width: 480px)");
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
    expect(client).toContain("Local demonstration data only");
    expect(client).toContain("anonymised records");
    expect(client).toContain("1. Sermon basics");
    expect(client).toContain("6. Review and publish");
    expect(client).toContain("Completion checklist");
    expect(client).toContain("Sermon description");
    expect(client).toContain("sermon-description-count");
    expect(client).toContain('data-description-status="in_review"');
    expect(client).toContain("withApprovedDescription");
    expect(client).toContain("description_awaiting_review");
    expect(client).toContain('name="speakerId"');
    expect(client).not.toContain('name="speakerIds"');
    expect(client).toContain("x-local-identity\", \"admin");
    expect(`${page}\n${client}`).not.toMatch(/role selector|local-editor|local-contributor/i);
    expect(client).not.toContain("<iframe");
  });
});

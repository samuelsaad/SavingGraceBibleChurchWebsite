import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("private admin workspace presentation", () => {
  it("gives the review form a full-width row, outside the evidence disclosure", async () => {
    const page = await readFile("src/pages/admin/index.astro", "utf8");
    const client = await readFile("src/admin/dashboard.ts", "utf8");
    expect(page.includes(".review-workflow-layout { display: grid; grid-template-columns: minmax(0, 1fr)")).toBe(true);
    expect(client.includes('<details class="panel review-evidence-summary">')).toBe(true);
    expect(client).toMatch(/<\/section><\/details>\s+<div class="review-workflow-layout">/u);
    expect(client).toMatch(/\$\{reviewStageNavigation\(review\)\}\s+<div class="review-stage-workspace">/u);
    expect(client.includes("current?.complete && review.review.currentStage === 6")).toBe(true);
    expect(client.includes("No repeated substantive review or completion click is needed")).toBe(true);
  });

  it("uses current projections, keeps outstanding requirements visible and does not alter review mutations", async () => {
    const client = await readFile("src/admin/dashboard.ts", "utf8");
    expect(client.includes("privateCompletionIsCurrent(sermon)")).toBe(true);
    expect(client.includes("remainingPrivateReviewRequirements(sermon)")).toBe(true);
    expect(client.includes('class="remaining-requirements"')).toBe(true);
    expect(client.includes('api<WorkbenchSnapshot>("/api/v1/admin/workbench")')).toBe(true);
    expect(client.includes("workbenchBanner(current)")).toBe(true);
    expect(client.includes("review.progress.stageCompletion.final && readOnlyStage !== undefined")).toBe(true);
    expect(client.includes('control.setAttribute("aria-disabled", "true")')).toBe(true);
    expect(client.includes("if (dirty && !confirmDiscard()) return")).toBe(true);
  });

  it("provides exception navigation, labelled filters and keyboard-safe mobile navigation", async () => {
    const page = await readFile("src/pages/admin/index.astro", "utf8");
    const client = await readFile("src/admin/dashboard.ts", "utf8");
    for (const text of ['data-nav="remaining-reviews"', 'data-nav="ai-reviews"', 'class="nav-backdrop"', "not personal sign-in"]) {
      expect(page.includes(text), text).toBe(true);
    }
    for (const text of ["sidebar.inert = mobileNavigation.matches && !open", "workspace.inert = open", 'event.key === "Escape"', 'event.key === "Tab"', "event.metaKey", 'class="filter-more"', 'name="passageReviewState"']) {
      expect(client.includes(text), text).toBe(true);
    }
  });
});

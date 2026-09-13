// Offline browser regression: synthetic data only, every request intercepted.
// Build first. Set PLAYWRIGHT_MODULE_PATH to an already-installed Playwright.
// Optional ADMIN_UI_SCREENSHOT_DIR must be an ignored local output directory.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const origin = "http://127.0.0.1:4999";
const stamp = "2026-01-01T00:00:00.000Z";
const fixtureId = n => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const speaker = { id: fixtureId(10), name: "Example speaker", slug: "example-speaker" };
const book = { id: fixtureId(11), name: "Romans", slug: "romans", canonicalBookId: 45 };
const decisions = Array.from({ length: 3 }, (_, index) => ["description", ...Array.from({ length: 7 }, (_, q) => `qa:${fixtureId(100 + q)}`)].map((artifactKey, i) => ({
  sermonId: fixtureId(index + 1), title: `Example sermon ${index + 1}`, artifactKey, displayOrder: i || null,
  outcome: "accepted", reviewedAt: stamp, model: index === 1 ? null : "gpt-6-astra",
  humanApprovalPreserved: index === 1, identityConfirmed: true, findingsComplete: true,
  informationNeeded: null, exceptionCode: null, standingWarnings: []
}))).flat();
const makeStatus = complete => ({ decision: "D-157", privateComplete: complete, canComplete: false,
  completedAt: complete ? stamp : null, completionReviewerSubject: complete ? "codex-astra-remaining-private-review" : null,
  remaining: complete ? [] : ["Primary-passage evidence required"], passageBasis: "primary_passage",
  components: Object.fromEntries(["identity", "speaker", "findings", "transcript", "passage", "media"].map(component => [component, {
    state: !complete && component === "passage" ? "needs_human" : "ai_accepted", accepted: complete || component !== "passage",
    exceptionCode: !complete && component === "passage" ? "explicit_passage_unavailable" : null,
    informationNeeded: !complete && component === "passage" ? "Confirm the primary passage from retained evidence." : null,
    model: "gpt-6-astra", reviewerSubject: "codex-astra-remaining-private-review", reviewedAt: stamp, warnings: []
  }])) });
const sermons = Array.from({ length: 3 }, (_, index) => ({
  id: fixtureId(index + 1), title: ["Example of a readable sermon title", "Example of a preserved human review", "Example awaiting passage evidence"][index],
  slug: `example-${index + 1}`, serviceDate: "2026-01-01", status: "draft", rowVersion: 1, updatedAt: stamp,
  publishedAt: null, scheduledFor: null, speaker, series: [], books: [book], scriptureReferences: [], primaryPassageReview: null,
  primaryPassage: { state: "proposed_passage", displayText: "Romans 8:1–4" }, youtubeSource: null, media: [],
  summary: "An entirely synthetic description for testing the interface. No real sermon content is included in this fixture.", summaryStatus: "draft", summarySourceReference: null,
  transcript: { bodyText: "Synthetic reading sample. This text tests the review workspace and has no relationship to any sermon.\n\n".repeat(20), status: "draft", rowVersion: 1 },
  questionAnswers: Array.from({ length: 7 }, (_, q) => ({ id: fixtureId(100 + q), question: `Example question ${q + 1}?`, answer: "A synthetic answer for interface testing, with no sermon source.", displayOrder: q + 1, status: "draft", sourceReference: null, rowVersion: 1 })),
  enrichmentReview: { currentStage: 3, completedAt: index < 2 ? stamp : null, pendingItemCount: 0, totalItemCount: 0 },
  remainingReview: makeStatus(index < 2),
  delegatedReview: { decision: "D-156", description: { artifactKey: "description", state: index === 1 ? "human_approved" : "ai_accepted", model: "gpt-6-astra" },
    questions: Array.from({ length: 7 }, (_, q) => ({ artifactKey: `qa:${fixtureId(100 + q)}`, displayOrder: q + 1, state: index === 1 ? "human_approved" : "ai_accepted" })),
    descriptionComplete: true, questionsComplete: true, substantiveComplete: true, aiAcceptedQuestions: index === 1 ? 0 : 7, humanApprovedQuestions: index === 1 ? 7 : 0, identityConfirmed: true, findingsComplete: true },
  readiness: { isComplete: false, isContentComplete: false, hasOneSpeaker: true, hasRequiredBibleBook: true, hasRequiredPassageDecision: false, hasApprovedDescription: false, hasApprovedTranscript: false, approvedQuestionCount: 0, totalQuestionCount: 7, hasRequiredQuestionAnswers: false, allQuestionsApproved: false, hasValidControlledMedia: true, issues: [] },
  generatedTextMechanicalQa: null,
  enrichmentSource: { videoId: "fixture-only", originalFilename: "synthetic.vtt", retrievalAttribution: "authorised_youtube_data_api", captionLanguage: "en", captionTrackType: "automatic", sourceContentSha256: "a".repeat(64), processingVersion: "fixture", processedAt: stamp, sourceCharacterCount: 100, cleanedCharacterCount: 100, estimatedReviewMinutes: 1, warnings: [], unresolvedPassages: [] }
}));
const html = await readFile("dist/admin/index.html", "utf8");
let stage = 3;
let mutations = 0;
let blockedExternal = 0;
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", () => errors.push("browser_script_error"));
  const queries = [];
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) { blockedExternal++; return route.abort(); }
    if (route.request().method() !== "GET") { mutations++; return route.fulfill({ status: 403, json: {} }); }
    if (url.pathname.startsWith("/_astro/")) {
      const path = resolve("dist", `.${url.pathname}`);
      assert(path.startsWith(resolve("dist") + "/") || path.startsWith(resolve("dist") + "\\"));
      return route.fulfill({ body: await readFile(path), contentType: extname(path) === ".css" ? "text/css" : "text/javascript" });
    }
    if (url.pathname.startsWith("/admin")) return route.fulfill({ body: html, contentType: "text/html" });
    let json;
    if (url.pathname.endsWith("/remaining-reviews")) json = { data: sermons.map(s => ({ sermonId: s.id, title: s.title, review: s.remainingReview })) };
    else if (url.pathname.endsWith("/ai-reviews")) json = { data: decisions };
    else if (url.pathname.includes("/taxonomies/")) json = { data: url.pathname.endsWith("speakers") ? [speaker] : url.pathname.endsWith("books") ? [book] : [] };
    else if (url.pathname.endsWith("/review")) {
      const sermon = sermons.find(s => url.pathname.includes(s.id)) || sermons[0];
      const complete = sermon.remainingReview.privateComplete;
      json = { sermon, recordPosition: 1, recordCount: 3, review: { currentStage: stage, identityStatus: "confirmed", rowVersion: 1, emptyItemSetAcknowledgedAt: stamp, completedAt: complete ? stamp : null }, items: [],
        progress: { stageCompletion: { identity: true, findings: true, transcript: complete, description: complete, questionAnswers: complete, final: complete }, percentReviewed: complete ? 100 : 33, totalItemCount: 0, resolvedItemCount: 0, unresolvedItemCount: 0, presentItemCount: 0, reviewSetVerified: true, canFinish: false } };
    } else if (url.pathname === "/api/v1/admin/sermons") {
      queries.push(url.search);
      const data = url.searchParams.get("query") === "absent" ? [] : sermons;
      json = { data, countsByStatus: { draft: 3, pending: 0, scheduled: 0, published: 0, unpublished: 0, archived: 0 },
        readinessProgress: { total: 3, complete: 0, remaining: 3, withOneSpeaker: 3, withRequiredPassageDecision: 0, withApprovedDescription: 0, withApprovedTranscript: 0, withRequiredQuestionAnswers: 0, withValidControlledMedia: 3 },
        pagination: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1 } };
    } else return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json });
  });
  async function open(path) {
    await page.goto(origin + path);
    await page.locator('#admin-main[aria-busy="false"]').waitFor();
    assert.equal(await page.getByRole("heading", { name: "Administration unavailable" }).count(), 0);
  }
  async function geometry() {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "page_overflow");
    assert.equal(errors.length, 0, "client_errors");
  }
  const results = [];
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["/admin", "/admin/sermons", "/admin/remaining-reviews", "/admin/ai-reviews?all=1", `/admin/sermons/${fixtureId(1)}/review`]) {
      await open(path); await geometry();
      if (path === "/admin") {
        assert.deepEqual(await page.locator(".overview-stats strong").allTextContents(), ["3", "2", "1", "3 / 3"]);
        if (process.env.ADMIN_UI_SCREENSHOT_DIR && [1440,390].includes(width)) {
          await mkdir(process.env.ADMIN_UI_SCREENSHOT_DIR, { recursive: true });
          await page.screenshot({ path: resolve(process.env.ADMIN_UI_SCREENSHOT_DIR, `admin-overview-${width}.png`), fullPage: true });
        }
      }
      if (path.endsWith("/review")) {
        const fits = await page.evaluate(() => {
          const layout = document.querySelector(".review-workflow-layout").getBoundingClientRect();
          const form = document.querySelector(".review-stage-workspace").getBoundingClientRect();
          return form.width >= layout.width - 2;
        });
        assert(fits, "review_workspace_narrow_column_regression");
        assert(await page.locator('[data-transcript-action="approve"]').isDisabled(), "completed_review_read_only");
        if (process.env.ADMIN_UI_SCREENSHOT_DIR && width === 1440) await page.screenshot({ path: resolve(process.env.ADMIN_UI_SCREENSHOT_DIR, "admin-review-desktop.png"), fullPage: true });
      }
    }
    results.push({ width, routes: 5, overflow: false });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await open("/admin");
  assert(await page.locator("#admin-sidebar").evaluate(el => el.inert));
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  assert(await page.locator(".workspace").evaluate(el => el.inert));
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.locator(".sidebar a").last().evaluate(el => el === document.activeElement), true);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".sidebar a").first().evaluate(el => el === document.activeElement), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".menu-button").evaluate(el => el === document.activeElement), true);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.locator('.sidebar [data-nav="remaining-reviews"]').click();
  await page.locator('#admin-main[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('.sidebar [data-nav="remaining-reviews"]').getAttribute("aria-current"), "page");
  assert.equal(await page.locator(".workspace").evaluate(el => el.inert), false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open("/admin/sermons?passageBook=45&passageChapter=8&passageVerse=1&passageReviewState=proposed_passage&seriesId=fixture-series");
  assert.equal(await page.locator(".filter-more").getAttribute("open"), "");
  assert.equal(await page.locator('[name="passageBook"]').inputValue(), "45");
  await page.locator('[name="query"]').fill("absent");
  await page.getByRole("button", { name: "Search sermons", exact: true }).click();
  await page.locator(".empty-state").waitFor();
  assert(queries.at(-1).includes("passageBook=45"));
  await open("/admin/sermons");
  await page.locator(".review-status-details summary").first().click();
  assert(await page.locator(".review-status-details").first().getByText("AI reviewed and accepted", { exact: true }).isVisible());
  for (stage of [1,2,4,5,6]) { await open(`/admin/sermons/${fixtureId(1)}/review`); await geometry(); }
  stage = 3; await open(`/admin/sermons/${fixtureId(3)}/review`);
  assert(await page.locator('.review-stage-nav [data-review-stage="4"]').isDisabled());
  // 200% browser-equivalent CSS viewport reflow, plus explicit zoom geometry.
  await page.setViewportSize({ width: 720, height: 500 }); await open("/admin/sermons"); await geometry();
  await page.setViewportSize({ width: 1440, height: 1000 }); await open("/admin");
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); await geometry();
  assert.equal(mutations, 0, "no_review_write_requests");
  assert.equal(blockedExternal, 0, "no_external_requests");
  process.stdout.write(JSON.stringify({ result: "passed", results, stages: 6, mobileKeyboard: "passed", filters: "passed", zoom: "passed", mutations, externalRequests: blockedExternal }) + "\n");
} finally { await browser.close(); }

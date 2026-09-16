import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const origin = "http://127.0.0.1:4361";
const browser = await chromium.launch({ channel: "msedge", headless: true });
let stage = "startup";
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  let writes = 0, external = 0;
  await context.route("**/*", async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin) { external++; return route.abort(); }
    if (!["GET", "HEAD"].includes(request.method()) && !request.url().endsWith("/api/v1/admin/frontend-preview-session")) {
      writes++; return route.abort();
    }
    return route.continue();
  });
  const anonymous = await context.request.get(`${origin}/api/v1/admin/remaining-reviews`);
  assert.equal(anonymous.status(), 401);
  stage = "admin_overview";
  await page.goto(`${origin}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("144") && document.body.innerText.includes("155"));
  stage = "review_counts";
  const response = await context.request.get(`${origin}/api/v1/admin/remaining-reviews`, { headers: { "x-local-identity": "admin" } });
  const packet = await response.json();
  assert.equal(response.status(), 200);
  assert.equal(packet.data.length, 155);
  assert.equal(packet.data.filter(item => item.review.privateComplete).length, 144);
  assert.equal(packet.data.filter(item => !item.review.privateComplete).length, 11);
  stage = "exception_queue";
  await page.goto(`${origin}/admin/remaining-reviews`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.innerText.includes("11"));
  await page.reload({ waitUntil: "domcontentloaded" });
  const session = await context.request.post(`${origin}/api/v1/admin/frontend-preview-session`, { headers: { "x-local-identity": "admin" } });
  assert.equal(session.status(), 200);
  for (const path of ["/frontend-preview/", "/frontend-preview/sermons/"]) {
    stage = path === "/frontend-preview/" ? "creative_home" : "creative_archive";
    const preview = await page.goto(origin + path, { waitUntil: "domcontentloaded" });
    assert.equal(preview.status(), 200);
    assert.match(preview.headers()["cache-control"], /no-store/);
    assert.match(preview.headers()["x-robots-tag"], /noindex/);
    assert.equal(await page.locator('[data-sermon-menu] a').count(), 5);
    assert.equal(await page.locator('.entry__tab .tab__count').count(), 0);
    assert.equal(await page.locator('.entry__tab').count(), await page.locator('.entry').count());
    assert.equal(await page.locator('link[rel="canonical"],script[type="application/ld+json"]').count(), 0);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  assert.equal(writes, 0); assert.equal(external, 0);
  console.log(JSON.stringify({ status: "passed", adminRecords: 155, privateComplete: 144,
    genuineExceptions: 11, previewRoutes: 2, anonymousDenied: true, refresh: true,
    bookTabs: true, fiveItemMenu: true, realMutations: 0, externalRequests: 0, screenshots: 0 }));
} catch { console.error(JSON.stringify({ status: "integrated_browser_verification_failed", stage })); process.exitCode = 1; }
finally { await browser.close(); }

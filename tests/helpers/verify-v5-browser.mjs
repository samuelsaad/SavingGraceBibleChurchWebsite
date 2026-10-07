/** Browser checks against v5-browser-fixture.ts only. No application DB reads.
 * Supply PLAYWRIGHT_MODULE_PATH for an already installed Playwright package.
 * Optional --capture writes only anonymous fixture images under private/. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';

const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH);
const origin = 'http://127.0.0.1:4413';
const path = '/sermons-v5/';
const browser = await chromium.launch({headless: true, channel: 'msedge'});
let step = 'start', errors = 0, external = 0, checks = 0;
try {
  const context = await browser.newContext();
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== origin) { external++; return route.abort(); }
    if (route.request().method() !== 'GET') return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', () => errors++);
  const visit = async (suffix = path) => {
    const response = await page.goto(origin + suffix);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['cache-control'], /no-store/);
    assert.match(response.headers()['x-robots-tag'], /noindex/);
    await page.evaluate(() => document.fonts.ready);
    // This guard prevents accidentally capturing real application records.
    assert((await page.locator('.journal__title').first().textContent()).startsWith('Anonymous layout example'));
  };
  const ids = () => page.locator('[data-sermon-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-sermon-id')));
  const more = () => page.locator('[data-v5-more]');
  if (process.argv.includes('--capture')) await mkdir('private/v5-browsing', {recursive: true});
  for (const width of [1440, 768, 390, 320]) {
    step = 'responsive_' + width;
    await page.setViewportSize({width, height: 1000});
    await visit();
    assert.equal((await ids()).length, 9);
    assert.equal(await page.locator('.journal__entry--featured').count(), 1);
    assert.equal(await page.locator('#v5-shelf').getAttribute('open'), null);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await page.locator('.journal__duration--known').count(), 6);
    assert.equal((await page.locator('.journal__duration--known time').nth(1).textContent()).trim(), '1:12:08');
    assert.equal(await page.locator('iframe').count(), 0);
    const contrast = await page.locator('.journal__duration--known').evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node);
      function rgb(color) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => v / 255);
      }
      function luminance(color) { return rgb(color).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0); }
      const a = luminance(style.color), b = luminance(style.backgroundColor);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    }));
    assert(contrast.every(value => value >= 4.5));
    assert((await more().boundingBox()).height >= 44);
    if (process.argv.includes('--capture') && [1440, 390].includes(width)) {
      await page.locator('.v5__featured').screenshot({path: `private/v5-browsing/feature-${width}.png`});
      await page.locator('.v5__browse').screenshot({path: `private/v5-browsing/browse-${width}.png`});
    }
    checks++;
  }
  step = 'append_and_duplicate_click';
  await visit();
  const original = await ids();
  let pageRequests = 0;
  page.on('request', request => { if (request.isNavigationRequest() === false && request.url().includes('/page/2/')) pageRequests++; });
  await page.route('**/sermons-v5/page/2/', async route => { await new Promise(resolve => setTimeout(resolve, 250)); await route.continue(); });
  await more().evaluate(link => { link.click(); link.click(); });
  await page.waitForFunction(() => document.querySelectorAll('[data-sermon-id]').length === 18);
  assert.equal(pageRequests, 1);
  assert.equal(await more().getAttribute('href'), '/sermons-v5/page/3/#v5-results');
  assert.deepEqual((await ids()).slice(0, 9), original);
  assert.equal(new Set(await ids()).size, 18);
  assert.equal(await page.locator('.journal__entry--featured').count(), 1);
  assert.equal(await page.locator(':focus').getAttribute('href'), '/sermons/anonymous-layout-10/');
  assert.equal(new URL(page.url()).pathname, path);
  const newToggle = page.locator('.journal__toggle').nth(9);
  await newToggle.focus(); await page.keyboard.press('Enter');
  assert.equal(await newToggle.getAttribute('aria-expanded'), 'true');
  await page.evaluate(() => document.dispatchEvent(new Event('v5:appended')));
  await page.keyboard.press('Enter');
  assert.equal(await newToggle.getAttribute('aria-expanded'), 'false');
  await more().click();
  await page.waitForFunction(() => document.querySelectorAll('[data-sermon-id]').length === 25);
  assert.equal(new Set(await ids()).size, 25);
  assert.equal(await more().count(), 0);
  assert.equal(await page.locator('[data-v5-progress]').textContent(), 'Showing 25 of 25 sermons');
  assert.equal(await page.getByRole('table').count(), 2);
  assert.equal(await page.locator('.pagination [aria-current="page"]').textContent(), 'Page 3');
  assert.deepEqual(await ids(), Array.from({length: 25}, (_, i) => '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0')));
  checks++;
  step = 'direct_page_and_filters';
  await page.getByRole('link', {name: 'Page 2', exact: true}).click();
  assert.equal((await ids()).length, 9); assert.equal(await page.locator('.journal__entry--featured').count(), 0);
  await visit(path + '?sermon_speaker=example-speaker-one&order=ASC');
  assert.equal((await ids()).length, 9);
  await more().click(); await page.waitForFunction(() => document.querySelectorAll('[data-sermon-id]').length === 13);
  assert.equal(new Set(await ids()).size, 13); assert.equal(await more().count(), 0);
  checks++;
  for (const failure of ['unauthorized', 'changed-total', 'wrong-page', 'wrong-origin', 'network']) {
    step = 'fallback_' + failure;
    await visit();
    await page.unroute('**/sermons-v5/page/2/');
    if (failure === 'wrong-origin') await more().evaluate(link => { link.href = 'https://example.invalid/sermons-v5/page/2/'; });
    else await page.route('**/sermons-v5/page/2/', async route => {
      if (failure === 'network') return route.abort();
      if (failure === 'unauthorized') return route.fulfill({status: 401, contentType: 'text/html', body: '<p>Sign in required</p>'});
      const response = await route.fetch();
      const source = await response.text();
      return route.fulfill({response, body: failure === 'wrong-page' ? source.replace('data-page="2"', 'data-page="3"') : source.replace('data-total="25"', 'data-total="26"')});
    });
    await more().click();
    await page.waitForFunction(() => document.querySelector('[data-v5-more]').hasAttribute('data-v5-fallback'));
    assert.equal((await ids()).length, 9);
    assert.equal(await more().getAttribute('aria-disabled'), null);
    assert.equal(new URL(await more().getAttribute('href'), origin).origin, origin);
    assert.match(await page.locator('[data-v5-load-status]').textContent(), /could not be added/);
    checks++;
  }
  await page.unroute('**/sermons-v5/page/2/');
  step = 'reduced_motion';
  await page.emulateMedia({reducedMotion: 'reduce'}); await visit();
  await page.locator('.journal__entry--featured').hover();
  assert.equal(await page.locator('.journal__entry--featured .tab').evaluate(el => getComputedStyle(el).transform), 'none');
  checks++;
  step = 'no_javascript';
  const nojs = await browser.newContext({javaScriptEnabled: false});
  const plain = await nojs.newPage(); await plain.goto(origin + path);
  assert.equal(await plain.locator('.journal__description.is-collapsed').count(), 0);
  await plain.getByRole('link', {name: 'More sermons', exact: true}).click();
  assert.equal(new URL(plain.url()).pathname, path + 'page/2/');
  assert.equal(await plain.locator('[data-sermon-id]').count(), 9);
  checks++; await nojs.close();
  assert.equal(errors, 0); assert.equal(external, 0);
  console.log(JSON.stringify({outcome: 'passed', checks, viewportWidths: [1440, 768, 390, 320], scriptErrors: errors, externalRequests: external, databaseAccess: false, anonymousScreenshots: process.argv.includes('--capture')}));
} catch (error) {
  console.log(JSON.stringify({outcome: 'failed', step, error: error.message, checks})); process.exitCode = 1;
} finally { await browser.close(); }

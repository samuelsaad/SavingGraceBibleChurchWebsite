/** Local anonymous fixture only. Requires v5-browser-fixture.ts on 4413.
 * PLAYWRIGHT_MODULE_PATH locates an already installed browser-test runtime.
 * --capture writes anonymous screenshots to ignored private storage only. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';

const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH);
const browser = await chromium.launch({headless: true, channel: 'msedge'});
const origin = 'http://127.0.0.1:4413';
const folder = 'private/v5-browsing/mobile';
const capture = process.argv.includes('--capture');
const results = [], failures = [];
let errors = 0, external = 0, step = 'start';
const routes = ['/', '/sermons-v5/', '/sermons/anonymous-layout-01/', '/about/', '/ministries/', '/events/', '/contact/', '/support-saving-grace-church-offering/'];
await mkdir(folder, {recursive: true});
try {
  const context = await browser.newContext({hasTouch: true, isMobile: true, viewport: {width: 390, height: 844}});
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin !== origin) { external++; return route.abort(); }
    if (route.request().method() !== 'GET') return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', () => errors++);
  const visit = async route => {
    const response = await page.goto(origin + route);
    assert.equal(response.status(), 200);
    await page.evaluate(() => document.fonts.ready);
    if (route === '/sermons-v5/') assert((await page.locator('.journal__title').first().textContent()).startsWith('Anonymous layout example'));
  };
  const measure = async (width, route, state = 'normal') => {
    const data = await page.evaluate(() => {
      const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
      return {
        documentWidth: document.documentElement.scrollWidth,
        inputFonts: [...document.querySelectorAll('input:not([type=hidden]), select')].filter(visible).map(e => parseFloat(getComputedStyle(e).fontSize)),
        overflowClasses: [...new Set([...document.querySelectorAll('main *, header *, footer *')].filter(visible).filter(e => {
          const r = e.getBoundingClientRect();
          return r.right > document.documentElement.clientWidth + 1 && !e.closest('.sr-only,.skip-link');
        }).map(e => e.tagName.toLowerCase() + '.' + String(e.className).replaceAll(' ', '.')))].slice(0, 12)
      };
    });
    results.push({width, route, state, ...data});
    if (data.documentWidth > width + 1 || data.inputFonts.some(size => size < 16)) failures.push({width, route, state, ...data});
  };
  for (const size of [{width:320,height:740},{width:390,height:844},{width:768,height:1024},{width:844,height:390},{width:1440,height:1000}]) {
    await page.setViewportSize(size);
    for (const route of routes) {
      step = `render_${size.width}_${route}`;
      await visit(route);
      await measure(size.width, route);
      if (capture && size.width === 390 && route === '/sermons-v5/') {
        await page.screenshot({path: `${folder}/after-top.png`});
        await page.locator('.v5__featured').screenshot({path: `${folder}/after-feature.png`});
        await page.locator('.v5__indexes').screenshot({path: `${folder}/after-tables.png`});
      }
      if (capture && size.width === 1440 && route === '/sermons-v5/') await page.locator('.v5__featured').screenshot({path: `${folder}/after-desktop.png`});
    }
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({width, height: 844});
    for (const route of routes) {
      step = `large_text_${width}_${route}`;
      await visit(route);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
        const date = document.querySelector('.journal__date time');
        if (date) date.textContent = '28 September 2026';
      });
      await measure(width, route, '200-percent-text');
      if (capture && width === 320 && route === '/sermons-v5/') {
        await page.locator('.v5__featured').screenshot({path: `${folder}/after-large-text.png`});
        await page.locator('.v5__indexes').screenshot({path: `${folder}/after-large-tables.png`});
      }
    }
  }
  step = 'touch_controls';
  await page.setViewportSize({width:390,height:844});
  await visit('/sermons-v5/');
  const minimumTouch = async selector => {
    const boxes = await page.locator(selector).evaluateAll(nodes => nodes.map(e => {
      const r = e.getBoundingClientRect(); return {width: r.width, height: r.height};
    }));
    assert(boxes.length > 0);
    assert(boxes.every(r => r.width >= 43.9 && r.height >= 43.9));
  };
  await minimumTouch('[data-site-toggle], .finder__submit button, .journal__toggle, .journal__open, .pagination a, .v5__more');
  const hitSpine = await page.locator('.journal__tab a.tab').first().evaluate(e => {
    const r = e.getBoundingClientRect(), style = getComputedStyle(e, '::after');
    const x = r.left + r.width / 2 - 21;
    return parseFloat(style.width) >= 44 && e.contains(document.elementFromPoint(x, r.top + 10));
  });
  // Scroll into view before hit testing; no need to navigate the taxonomy.
  if (!hitSpine) {
    const tab = page.locator('.journal__tab a.tab').first(); await tab.scrollIntoViewIfNeeded();
    assert(await tab.evaluate(e => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.left + r.width / 2 - 21, Math.max(1,r.top + 10))); }));
  }
  const search = await page.locator('.finder__submit button').boundingBox();
  const form = await page.locator('.finder__row').boundingBox(); assert(Math.abs(search.width - form.width) <= 1);
  await page.locator('#v5-shelf > summary').click();
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  await minimumTouch('.spine__link');
  await measure(390, '/sermons-v5/', 'shelf-open');
  if(capture) await page.locator('#v5-shelf').screenshot({path:`${folder}/after-shelf.png`});
  step = 'nested_menu';
  await page.locator('[data-site-toggle]').click();
  const menu = page.locator('[data-sermon-menu] > summary');
  await menu.click(); await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('[data-site-toggle]').getAttribute('aria-expanded'), 'true');
  assert(await menu.evaluate(e => e === document.activeElement));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-site-toggle]').getAttribute('aria-expanded'), 'false');
  step = 'landscape_discovery';
  await page.setViewportSize({width:844,height:390});
  await visit('/sermons-v5/?passageBook=genesis&passageScope=book');
  // Chapter grids are touch-sized even beyond the narrow-phone breakpoint.
  if(await page.locator('.ruler__cell').count()) await minimumTouch('.ruler__cell');
  await measure(844, '/sermons-v5/', 'landscape-discovery');
  step = 'detail_disclosure';
  await page.setViewportSize({width:320,height:740}); await visit('/sermons/anonymous-layout-01/');
  assert.equal(await page.locator('iframe[src]').count(), 0);
  await page.locator('.transcript__summary').click(); assert.equal(await page.locator('.transcript').getAttribute('open'), null);
  await page.locator('.transcript__summary').click(); assert.notEqual(await page.locator('.transcript').getAttribute('open'), null);
  await minimumTouch('.transcript__summary');
  step = 'no_javascript';
  const plain = await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:740}});
  await plain.route('**/*',r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
  const noJs = await plain.newPage(); await noJs.goto(origin+'/sermons-v5/');
  await noJs.locator('[data-sermon-menu] > summary').click();
  assert(await noJs.evaluate(() => document.documentElement.scrollWidth <= 320));
  assert(await noJs.getByRole('link',{name:'SermonsV5',exact:true}).isVisible());
  await plain.close();
  await writeFile(`${folder}/verification.json`, JSON.stringify({results, failures, errors, external},null,2));
  assert.equal(failures.length,0); assert.equal(errors,0); assert.equal(external,0);
  console.log(JSON.stringify({outcome:'passed',pageSizeChecks:results.length,normalSizes:[320,390,768,844,1440],textScales:[100,200],touchTargets:true,nestedMenu:true,noJavaScript:true,transcriptDisclosure:true,errors,external,screenshots:capture?'anonymous only':'none'}));
} catch(error) {
  await writeFile(`${folder}/verification.json`, JSON.stringify({results, failures, errors, external},null,2));
  console.log(JSON.stringify({outcome:'failed',step,errorType:error.name,message:error.message,failures})); process.exitCode=1;
} finally { await browser.close(); }

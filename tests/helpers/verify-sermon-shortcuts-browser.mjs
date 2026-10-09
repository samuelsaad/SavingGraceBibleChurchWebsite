/** Offline interaction checks against the anonymous V5 fixture only.
 * Provider requests are fulfilled locally; no recording is retrieved. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium} = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH);
const origin = 'http://127.0.0.1:4413';
const browser = await chromium.launch({headless: true, channel: 'msedge'});
let checks = 0, step = 'start';
try {
  const context = await browser.newContext();
  const external = [], errors = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin && request.method() === 'GET') return route.continue();
    external.push(request.url());
    return route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>Offline player fixture</title><p>Provider request verified locally.</p>'});
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const visitList = async () => {
    await page.goto(origin + '/sermons-v5/');
    assert((await page.locator('.journal__title').first().textContent()).startsWith('Anonymous layout example'));
  };
  const action = (ordinal, name) => page.locator(`a[data-sermon-action="${name}"][href="/sermons/anonymous-layout-${String(ordinal).padStart(2, '0')}/${name === 'video' ? '#play-video' : name === 'audio' ? '#play-audio' : '#transcript'}"]`);
  for (const width of [1440, 390, 320]) {
    step = 'targets_' + width;
    await page.setViewportSize({width, height: 1000}); await visitList();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const name of ['audio', 'video', 'transcript']) {
      const box = await action(1, name).boundingBox();
      assert(box.width >= 44 && box.height >= 44);
    }
    assert.equal(external.length, 0); checks++;
  }
  if (process.argv.includes('--capture')) {
    await mkdir('private/sermon-shortcuts', {recursive: true});
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 1000}); await visitList();
      await page.locator('.v5__featured').screenshot({path: `private/sermon-shortcuts/card-${width}.png`});
    }
  }
  step = 'youtube_keyboard';
  await visitList(); await action(1, 'video').focus(); await page.keyboard.press('Enter');
  await page.waitForURL('**/sermons/anonymous-layout-01/#play-video');
  await page.locator('[data-video-frame] iframe').waitFor();
  assert.equal(await page.locator('iframe').count(), 1);
  assert.equal(await page.locator('iframe').getAttribute('src'), 'https://www.youtube-nocookie.com/embed/fixture0001?autoplay=1');
  assert.match(await page.locator('iframe').getAttribute('allow'), /autoplay/);
  assert.equal(await page.locator('[data-audio-frame] iframe').count(), 0);
  await page.waitForFunction(() => document.activeElement?.tagName === 'IFRAME', null, {timeout: 5000}).catch(async error => { console.error(JSON.stringify(await page.evaluate(() => ({active: document.activeElement?.outerHTML?.slice(0,300), state: document.readyState, frame: document.querySelector('[data-video-frame]')?.outerHTML?.slice(0,500)})))); throw error; });
  assert.equal(await page.locator('iframe').evaluate(frame => document.activeElement === frame), true);
  assert.equal(await page.locator('a[href*="youtube.com"],a[href*="sermonaudio.com"]').count(), 0); checks++;
  step = 'audio_matching_record_and_back';
  await visitList(); await action(2, 'audio').click();
  await page.waitForURL('https://www.sermonaudio.com/sermons/1111111111112/a?autoplay=1');
  assert.match(await page.title(), /Offline player/);
  await page.goBack(); assert.equal(new URL(page.url()).pathname, '/sermons-v5/'); checks++;
  step = 'transcript_and_reopen';
  await action(1, 'transcript').click(); await page.waitForURL('**/anonymous-layout-01/#transcript');
  assert.equal(await page.locator('#transcript details').evaluate(node => node.open), true);
  assert.equal(await page.locator(':focus').getAttribute('id'), 'transcript-heading');
  await page.locator('#transcript details').evaluate(node => { node.open = false; });
  await page.locator('[data-contents] a[href="#transcript"]').click();
  assert.equal(await page.locator('#transcript details').evaluate(node => node.open), true);
  assert.equal(await page.locator(':focus').getAttribute('id'), 'transcript-heading'); checks++;
  step = 'missing_content';
  for (const [ordinal, name, expected] of [[2, 'video', 'YouTube video'], [3, 'audio', 'SermonAudio recording'], [4, 'transcript', 'Transcript']]) {
    await visitList(); const before = external.length;
    await action(ordinal, name).click();
    await page.locator('#sermon-shortcut-status').waitFor();
    assert.equal(await page.locator('#sermon-shortcut-status').textContent(), expected + ' is not available for this sermon.');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'sermon-shortcut-status');
    assert.equal(await page.locator('iframe').count(), 0); assert.equal(external.length, before); checks++;
  }
  step = 'ordinary_visits_and_manual_loading';
  for (const hash of ['', '#watch']) {
    const before = external.length; await page.goto(origin + '/sermons/anonymous-layout-01/' + hash);
    assert.equal(await page.locator('iframe').count(), 0); assert.equal(external.length, before);
    assert.equal(await page.locator('#transcript details').evaluate(node => node.open), false);
  }
  await page.locator('[data-load-youtube]').click();
  assert.equal(await page.locator('[data-video-frame] iframe').getAttribute('src'), 'https://www.youtube-nocookie.com/embed/fixture0001');
  assert.doesNotMatch(await page.locator('[data-video-frame] iframe').getAttribute('allow'), /autoplay/);
  await page.locator('[data-load-sermonaudio]').click();
  await page.locator('[data-audio-frame] iframe').waitFor();
  await page.evaluate(() => { location.hash = '#play-audio'; });
  await page.waitForURL('https://www.sermonaudio.com/sermons/1111111111111/a?autoplay=1'); checks++;
  step = 'appended_card';
  await visitList(); await page.locator('[data-v5-more]').click();
  await action(10, 'video').waitFor(); await action(10, 'video').click();
  await page.locator('[data-video-frame] iframe').waitFor();
  assert.equal(await page.locator('iframe').getAttribute('src'), 'https://www.youtube-nocookie.com/embed/fixture0010?autoplay=1'); checks++;
  step = 'global_directory_counts';
  await visitList();
  const directories = () => page.locator('.v5-directory-section').evaluateAll(sections => sections.map(section => ({
    rows: [...section.querySelectorAll('tbody tr')].map(row => ({href: row.querySelector('a').getAttribute('href'), count: row.querySelector('.v5-directory__count').textContent.trim()}))
  })));
  const allDirectoryRows = await directories();
  await page.goto(origin + '/sermons-v5/?sermon_speaker=example-speaker-one');
  assert.deepEqual(await directories(), allDirectoryRows);
  await page.goto(origin + '/sermons-v5/?sermon_series=anonymous-series&sermon_speaker=example-speaker-two');
  assert.deepEqual(await directories(), allDirectoryRows); checks++;
  step = 'question_answers';
  await page.goto(origin + '/sermons/anonymous-layout-01/#questions');
  const toggles = page.locator('[data-toggle-answer]');
  assert.equal(await toggles.count(), 5);
  assert.equal(await page.locator('.question__answer:visible').count(), 0);
  assert.equal(await page.getByRole('button', {name: /Show answer for question/}).count(), 5);
  assert.equal(await page.locator('a[href*="youtube.com"],a[href*="sermonaudio.com"]').count(), 0);
  const fullAnswers = await page.locator('.question__answer').allTextContents();
  const settleAnswers = () => page.evaluate(() => Promise.all(document.querySelector('#questions').getAnimations({subtree:true}).map(animation => animation.finished.catch(() => {}))));
  await toggles.nth(0).focus(); await page.keyboard.press('Enter');
  assert(await page.locator('#question-answer-1').evaluate(node => node.getAnimations().some(animation => animation.transitionProperty === 'grid-template-rows')));
  await settleAnswers();
  assert.equal(await toggles.nth(0).getAttribute('aria-expanded'), 'true');
  assert.equal(await toggles.nth(0).evaluate(node => document.activeElement === node), true);
  assert.equal(await page.locator('.question__answer:visible').count(), 1);
  assert.equal(await toggles.nth(0).textContent(), 'Hide answer for question 1');
  await toggles.nth(1).focus(); await page.keyboard.press('Space'); await settleAnswers();
  assert.equal(await page.locator('.question__answer:visible').count(), 2);
  await toggles.nth(0).click();
  await page.waitForFunction(() => document.querySelector('#question-answer-1').hidden);
  assert.equal(await page.locator('.question__answer:visible').count(), 1);
  assert.equal(await toggles.nth(1).getAttribute('aria-expanded'), 'true');
  assert.equal(await toggles.nth(0).getAttribute('aria-expanded'), 'false');
  assert.deepEqual(await page.locator('.question__answer').allTextContents(), fullAnswers); checks++;
  step = 'question_motion_reversal';
  await toggles.nth(0).evaluate(async button => {
    button.click(); await new Promise(requestAnimationFrame);
    button.click(); await new Promise(requestAnimationFrame);
    button.click();
  });
  await settleAnswers();
  assert.equal(await toggles.nth(0).getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#question-answer-1').evaluate(node => node.hidden || node.inert), false);
  await toggles.nth(0).click(); await page.waitForFunction(() => document.querySelector('#question-answer-1').hidden); checks++;
  step = 'question_reduced_motion';
  await page.emulateMedia({reducedMotion:'reduce'});
  await toggles.nth(0).click();
  assert.equal(await page.locator('#question-answer-1').evaluate(node => node.getAnimations().length), 0);
  assert.equal(await toggles.nth(0).getAttribute('aria-expanded'), 'true');
  await toggles.nth(0).click();
  assert.equal(await page.locator('#question-answer-1').evaluate(node => node.hidden), true);
  await page.emulateMedia({reducedMotion:'no-preference'}); checks++;
  step = 'question_print';
  assert.equal(await page.locator('#transcript details').evaluate(node => node.open), false);
  await page.evaluate(() => {window.dispatchEvent(new Event('beforeprint')); window.dispatchEvent(new Event('beforeprint'));});
  assert.equal(await page.locator('#transcript details').evaluate(node => node.open), true);
  assert.equal(await page.locator('.question__answer:visible').count(), 5);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.locator('#transcript details').evaluate(node => node.open), false);
  assert.equal(await page.locator('.question__answer:visible').count(), 1);
  assert.equal(await toggles.nth(1).getAttribute('aria-expanded'), 'true');
  await page.emulateMedia({media: 'print'});
  assert.equal(await page.locator('.question__answer:visible').count(), 5);
  assert.equal(await page.locator('[data-toggle-answer]:visible').count(), 0);
  await page.emulateMedia({media: 'screen'}); checks++;
  step = 'question_responsive';
  for (const width of [1440,390,320]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(origin + '/sermons/anonymous-layout-01/#questions');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const button of await toggles.all()) {
      const box = await button.boundingBox(); assert(box.height >= 44);
    }
    if (await toggles.nth(1).getAttribute('aria-expanded') !== 'true') await toggles.nth(1).click();
    await settleAnswers();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (process.argv.includes('--capture') && width !== 320) {
      await page.locator('#questions').screenshot({path:`private/sermon-shortcuts/questions-${width}.png`});
    }
    checks++;
  }
  step = 'question_rtl';
  await page.goto(origin + '/sermons/anonymous-layout-05/#questions');
  assert.equal(await page.locator('.questions').getAttribute('dir'), 'rtl');
  assert.equal(await page.locator('.question__answer:visible').count(), 0);
  await page.locator('[data-toggle-answer]').first().click(); await settleAnswers();
  assert.equal(await page.locator('.question__answer:visible').count(), 1);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); checks++;
  step = 'no_javascript';
  const passive = await browser.newContext({javaScriptEnabled: false});
  await passive.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const nojs = await passive.newPage(); await nojs.goto(origin + '/sermons-v5/');
  await nojs.locator('[data-sermon-action="transcript"]').first().click();
  assert.equal(await nojs.locator('#transcript details').evaluate(node => node.open), false);
  await nojs.locator('.transcript__summary').focus();
  await nojs.keyboard.press('Enter');
  assert.equal(await nojs.locator('#transcript details').evaluate(node => node.open), true);
  assert.equal(await nojs.locator('iframe').count(), 0);
  assert.equal(await nojs.locator('.question__answer:visible').count(), 5);
  assert.equal(await nojs.locator('[data-toggle-answer]:visible').count(), 0);
  assert.equal(await nojs.locator('a[href*="youtube.com"],a[href*="sermonaudio.com"]').count(), 0);
  await passive.close(); checks++;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({status: 'passed', checks, actualProviderRequests: 0, interceptedPlayerRequests: external.length, widths: [1440,390,320]}));
} catch (error) {
  console.error(JSON.stringify({status: 'failed', step, message: error.message})); process.exitCode = 1;
} finally { await browser.close(); }

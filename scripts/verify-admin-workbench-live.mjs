// Read-only local smoke check. Never capture private content or submit decisions.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const origin='http://127.0.0.1:4406';
let step='start';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const context=await browser.newContext();let blockedWrites=0;
 await context.route('**/*',route=>{
  const r=route.request();if(new URL(r.url()).origin!==origin)return route.abort();
  if(r.method()!=='GET'){blockedWrites++;return route.fulfill({status:403,json:{error:{code:'verification_read_only'}}});}
  return route.continue();
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',()=>errors.push('client_error'));
 step='api';const res=await fetch(origin+'/api/v1/admin/workbench',{headers:{'x-local-identity':'admin'}});assert.equal(res.status,200);const snapshot=await res.json();
 for(const width of [1440,390]) {
  step='overview_'+width;await page.setViewportSize({width,height:1000});await page.goto(origin+'/admin');await page.locator('#admin-main[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('.wb-summary strong').textContent(),`${snapshot.counts.complete} of ${snapshot.counts.total} sermons complete`);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[data-wb-view="complete"]').click();assert.equal(await page.locator('.wb-item').count(),Math.min(20,snapshot.counts.complete));
  if(snapshot.counts.complete>20){await page.locator('[data-wb-next]').click();assert((await page.locator('[data-wb-count]').textContent()).startsWith('21–'));}
 }
 const types=['speaker','identity','transcript','description'];let inspected=0;
 for(const component of types) {
  const r=snapshot.data.find(row=>!row.complete&&row.concerns.some(c=>c.component===component));if(!r)continue;
  const stage={speaker:1,identity:1,transcript:3,description:4}[component];step='evidence_'+component;
  await page.goto(`${origin}/admin/sermons/${r.id}/review?viewStage=${stage}`);await page.locator('#admin-main[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('.wb-record-banner.is-attention').count(),1);
  assert.equal(await page.locator(`[data-review-view="${stage}"][aria-current="step"]`).count(),1);
  assert.equal(await page.getByRole('heading',{name:'Administration unavailable'}).count(),0);inspected++;
 }
 assert.equal(errors.length,0);console.log(JSON.stringify({result:'passed',counts:snapshot.counts,realEvidenceForms:inspected,widths:[1440,390],reviewWrites:0,blockedWrites,clientErrors:errors.length}));
}catch(error){console.log(JSON.stringify({result:'failed',step,errorType:error?.name??'unknown'}));process.exitCode=1;}
finally{await browser.close();}

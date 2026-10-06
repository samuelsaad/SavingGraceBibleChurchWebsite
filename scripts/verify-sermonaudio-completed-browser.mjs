// Existing loopback development mechanism only. No decisions, screenshots,
// external media requests, credential output or sermon prose in the report.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const origin=process.env.D175_LOCAL_ORIGIN||'http://127.0.0.1:4411';
assert.match(origin,/^http:\/\/127\.0\.0\.1:44\d\d$/u);
const checkpoint=JSON.parse(await readFile('private/sermonaudio-119-completion/checkpoint.private.json','utf8'));
assert.equal(checkpoint.manifestSha256,'a4fa3627682043c4b06aa65ddbebdab75f1fc29aec93e2d250bda537d9b0cd2b');
const records=Object.entries(checkpoint.records).filter(([,r])=>r.sermonId).map(([sequence,r])=>({sequence:Number(sequence),id:r.sermonId}));
let step='start',blockedWrites=0,blockedExternal=0,checked=0;const errors=[];
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const context=await browser.newContext();
 await context.route('**/*',route=>{const r=route.request(),url=new URL(r.url());
  if(url.origin!==origin){blockedExternal++;return route.abort();}
  if(r.method()!=='GET'&&!(r.method()==='POST'&&url.pathname==='/api/v1/admin/frontend-preview-session')){blockedWrites++;return route.fulfill({status:403,json:{error:{code:'verification_read_only'}}});}
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',()=>errors.push('client_error'));
 step='unauthenticated';assert.equal((await fetch(origin+'/api/v1/admin/workbench')).status,401);assert([401,403].includes((await fetch(origin+'/frontend-preview/')).status));
 const response=await fetch(origin+'/api/v1/admin/workbench',{headers:{'x-local-identity':'admin'}});assert.equal(response.status,200);const snapshot=await response.json();
 step='normal_development_preview_flow';await page.goto(origin+'/admin');await page.locator('#admin-main[aria-busy="false"]').waitFor();await page.getByRole('link',{name:'Frontend preview',exact:true}).waitFor();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const r of records){
   step=`admin_${r.sequence}_${width}`;assert(snapshot.data.find(s=>s.id===r.id)?.complete);
   const res=await fetch(origin+`/api/v1/admin/sermons/${r.id}`,{headers:{'x-local-identity':'admin'}});assert.equal(res.status,200);const detail=await res.json();
   await page.goto(origin+`/admin/sermons/${r.id}/review`);await page.locator('[data-completed-sermon]').waitFor();assert.equal(await page.locator('.wb-record-banner.is-attention').count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   step=`frontend_${r.sequence}_${width}`;await page.goto(origin+`/frontend-preview/sermons/${detail.slug}/`);await page.locator('.sermon__body').waitFor();
   assert.equal(await page.locator('.question').count(),detail.questionAnswers.length);assert.equal(await page.locator('iframe[src]').count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(await page.locator('[aria-labelledby="draft-review-heading"]').count(),0);
   assert.deepEqual(await page.locator('.sermon-section--description .prose p').allTextContents(),detail.summary.split(/\n\s*\n/u).filter(Boolean).map(p=>p.trim()));
   const ordered=[...detail.questionAnswers].sort((a,b)=>a.displayOrder-b.displayOrder);for(let i=0;i<ordered.length;i++){assert((await page.locator('.question__title').nth(i).textContent()).includes(ordered[i].question));assert((await page.locator('.question__answer').nth(i).textContent()).includes(ordered[i].answer));}
   const link=page.getByRole('link',{name:/Listen on SermonAudio/u});assert(await link.count());const mediaHref=await link.first().getAttribute('href');assert(detail.media.some(m=>m.provider==='sermonaudio'&&m.canonicalUrl===mediaHref));
   if(r.sequence===4){assert.equal(await page.locator('.sermon__title').getAttribute('lang'),'ar');assert.equal(await page.locator('.transcript__body').evaluate(el=>getComputedStyle(el).direction),'rtl');}
   checked++;
  }
 }
 assert.equal(errors.length,0);console.log(JSON.stringify({result:'passed',records:records.length,renderChecks:checked,widths:[1440,390],counts:snapshot.counts,screenshots:0,reviewWrites:0,blockedWrites,blockedExternal,clientErrors:errors.length,authentication:'existing_loopback_development_identity'}));
}catch(error){console.log(JSON.stringify({result:'failed',step,errorType:error?.name??'unknown'}));process.exitCode=1;}
finally{await browser.close();}

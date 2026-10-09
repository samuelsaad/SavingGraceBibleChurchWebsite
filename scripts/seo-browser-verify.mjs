/** Read-only loopback browser proof. External providers/analytics never load. */
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH);
const base=process.env.SEO_BROWSER_ORIGIN??'http://127.0.0.1:4440';if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(base))throw Error('seo_browser_origin');
const bundle=JSON.parse(await readFile(process.argv[2],'utf8')),output=process.argv[3];if(!output?.replaceAll('\\','/').split('/').includes('private'))throw Error('seo_browser_private_output');await mkdir(output,{recursive:true});
const sermons=bundle.pages.filter(p=>p.kind==='sermon'),arabic=sermons.find(p=>p.language.startsWith('ar')),audio=sermons.find(p=>p.sermon.media.some(m=>m.provider==='sermonaudio')&&!p.sermon.media.some(m=>m.provider==='youtube'));
const paths=[...new Set(['/', '/sermons/','/sermons/page/2/',bundle.pages.find(p=>p.kind==='page'&&p.path!=='/'&&!p.path.includes('/page/'))?.path,sermons[0].path,arabic?.path,audio?.path].filter(Boolean))];
const browser=await chromium.launch({headless:true,channel:'msedge'}),results=[],errors=[];let externalRequests=0;
try{
 for(const javascript of [true,false]){
  const context=await browser.newContext({javaScriptEnabled:javascript});await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();externalRequests++;return route.abort();});
  if(javascript)await context.addInitScript(()=>{window.__seoMetrics={lcp:null,cls:0};new PerformanceObserver(list=>{for(const e of list.getEntries())window.__seoMetrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__seoMetrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
  const page=await context.newPage();page.on('pageerror',()=>errors.push('uncaught_browser_error'));
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:900});
   for(const path of paths){const response=await page.goto(base+path,{waitUntil:'networkidle'});const status=response.status();
    const info=await page.evaluate(()=>({h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length,overflow:document.documentElement.scrollWidth>innerWidth,canonical:document.querySelector('link[rel=canonical]')?.getAttribute('href'),title:!!document.title,robots:document.querySelector('meta[name=robots]')?.getAttribute('content'),anchors:document.querySelectorAll('a[href]').length,lang:document.documentElement.lang,dir:document.querySelector('.sermon__body')?.getAttribute('dir'),metrics:window.__seoMetrics??null,domBytes:document.documentElement.outerHTML.length}));
    results.push({path,width,javascript,status,...info});assert.equal(status,200);assert.equal(info.h1,1);assert.equal(info.main,1);assert.equal(info.overflow,false);assert.ok(info.canonical?.startsWith('https://www.savinggrace.org.au/'));assert.ok(info.anchors>5);
    if(javascript&&width===390&&(path==='/sermons/'||path===arabic?.path))await page.screenshot({path:output+'/'+(path==='/sermons/'?'archive':'arabic')+'-mobile.png',fullPage:true});
   }
  }
  await context.close();
 }
 assert.equal(errors.length,0);
}finally{await browser.close();await writeFile(output+'/browser.private.json',JSON.stringify({results,errors,externalRequestsBlocked:externalRequests,conditions:{browser:'headless Edge',cpuThrottle:false,networkThrottle:false,externalResources:'blocked',fieldEvidence:false,inp:'not measured',comparisonToLiveSource:'not performed'},capturedAt:new Date().toISOString()},null,2));}
console.log(JSON.stringify({outcome:'seo_browser_passed',responses:results.length,errors:errors.length,externalRequestsBlocked:externalRequests,maxCLS:Math.max(...results.map(r=>r.metrics?.cls??0)),maxLCPms:Math.max(...results.map(r=>r.metrics?.lcp??0))}));

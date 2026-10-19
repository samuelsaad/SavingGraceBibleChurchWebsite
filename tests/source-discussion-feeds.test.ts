import{describe,it,expect}from'vitest';import{createSourceDiscussionFeedGuard}from'../src/seo/source-discussion-feeds';import{sourcePageSchema,sha256}from'../src/seo/source-public-model';import{defaultSiteSettings}from'../src/frontend/content/site-snapshot';
const parent='/event/anonymous/2026-01-01/',path=parent+'feed/',page=sourcePageSchema.parse({path,kind:'asset',sourceUrl:'https://www.savinggrace.org.au'+path,sourceId:null,capturedAt:'2026-01-01T00:00:00Z',responseSha256:sha256('anonymous'),title:'Original public resource',heading:'Original public resource',description:null,indexable:false,canonicalSource:null,publishedAt:null,modifiedAt:null,content:[],sermon:null,asset:{storageKey:sha256('anonymous')+'.rss',sha256:sha256('anonymous'),contentType:'application/rss+xml',bytes:9}});
const snapshot={pages:[],posts:[],events:[],venues:{},home:null,settings:defaultSiteSettings,assets:{},routes:[]};
describe('retained discussion-feed publication boundary',()=>{
 it('withdraws only the exact retained child when the parent is gone and restores its access with the parent',()=>{
  const guard=(status:200|410)=>createSourceDiscussionFeedGuard([page],{mode:'public',basePath:'',siteContent:{...snapshot,routes:[{path:parent,entityId:'event',status,targetPath:null}]}});
  const request=new Request(page.sourceUrl);expect(guard(410)(request)?.status).toBe(410);expect(guard(410)(request)?.headers.get('x-robots-tag')).toBe('noindex');expect(guard(200)(request)).toBeNull();expect(guard(410)(new Request('https://www.savinggrace.org.au/events/feed/'))).toBeNull();
 });
 it('follows only same-identity parent dispositions and refuses loops or unrelated redirects',()=>{
  const routes=[{path:parent,entityId:'event',status:301 as const,targetPath:'/renamed-event/'},{path:'/renamed-event/',entityId:'event',status:410 as const,targetPath:null}];let context={mode:'public' as const,basePath:'' as const,siteContent:{...snapshot,routes}};expect(createSourceDiscussionFeedGuard([page],context)(new Request(page.sourceUrl))?.status).toBe(410);
  expect(()=>createSourceDiscussionFeedGuard([page],{...context,siteContent:{...context.siteContent,routes:[routes[0]!,{...routes[1]!,entityId:'other'}]}})(new Request(page.sourceUrl))).toThrow('identity_changed');
 });
});

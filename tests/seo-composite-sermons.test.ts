import {describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {CompositeSourceSermonRepository,createCompositeSourceSermonRepository,publicEditorialBindingsSql,type PublicEditorialSermon} from '../src/seo/composite-sermon-repository';
import {sourcePageSchema} from '../src/seo/source-public-model';
import {sermonDetailSchema} from '../src/domain/sermon';
import {publicSermonListQuerySchema} from '../src/api/contracts/public-sermons';
import {frontendSermonEligibilitySql} from '../src/server/queries/public-sermons';
import {createSeoHttpAdapter} from '../src/seo/http-adapter';
import type {PublicSermonRepository} from '../src/server/repositories/sermon-repository';
const origin='https://www.savinggrace.org.au',query=()=>publicSermonListQuerySchema.parse({pageSize:50});
const original=()=>sourcePageSchema.parse({path:'/sermons/source-original/',kind:'sermon',sourceUrl:origin+'/sermons/source-original/',sourceId:987001,capturedAt:'2026-10-09T00:00:00Z',responseSha256:'a'.repeat(64),title:'Exact original document title',heading:'Original visible title',description:null,indexable:true,canonicalSource:origin+'/sermons/source-original/',publishedAt:'2004-01-01T00:00:00Z',modifiedAt:null,content:[{tag:'p',text:'Original public fixture wording.'}],passageTerms:[{name:'John 1:1–4',slug:'john-1-1-4'}],sermon:{id:'11111111-1111-4111-8111-111111111111',slug:'source-original',title:'Original visible title',serviceDate:'2004-01-01',summary:null,speaker:{name:'Original speaker',slug:'original-speaker'},series:[{name:'Fixture series',slug:'fixture-series'}],books:[{name:'John',slug:'john'}],scriptureReferences:[{displayText:'John 1:1–4',parseStatus:'unparsed'}],primaryPassages:[],primaryPassageState:'unresolved',primaryMedia:null,seoDescription:null,body:'Original public fixture wording.',media:[],transcript:null,questionAnswers:[],relatedSermons:[]}});
function approved(overrides:Partial<PublicEditorialSermon>={}):PublicEditorialSermon{return{detail:sermonDetailSchema.parse({...original().sermon!,id:'22222222-2222-4222-8222-222222222222',slug:'evaluation-fixture',title:'Imported replacement title',summary:'Approvedsynthetickeyword appears in this anonymous approved description, which contains only invented testing prose and no actual sermon text.',transcript:{bodyText:'Approvedtranscripttoken from an anonymous fixture.'},questionAnswers:[{question:'An anonymous question?',answer:'Approvedanswertoken from an anonymous answer.',displayOrder:1}],primaryPassages:[{displayText:'John 1:1–4',isLead:true}],primaryPassageState:'assigned'}),sourceWordpressId:'987001',editorialChanges:{},passageTerms:[],lastModified:'2026-10-09',...overrides};}
async function withHttp(repository:PublicSermonRepository,run:(base:string)=>Promise<void>){
 let base='';const server=createServer(async(req,res)=>{try{const handler=createSeoHttpAdapter({policy:{environment:'production',canonicalOrigin:origin},sermons:repository}),response=await handler(new Request(origin+req.url));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.statusCode=500;res.end('anonymous_fixture_error');}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw Error('fixture_listener');base='http://127.0.0.1:'+address.port;
 try{await run(base);}finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
describe('ordinary approved editorial content with source originals',()=>{
 it('preserves existing sealed-staging acceptance without admitting it through the normal production projection',async()=>{
  const staged=approved();staged.detail.reviewState='draft_awaiting_review';
  await expect(CompositeSourceSermonRepository.create([original()],[staged],async()=>null)).rejects.toThrow('source_editorial_private_projection');
  const repository=await CompositeSourceSermonRepository.create([original()],[staged],async()=>null,true);
  const detail=await repository.findPublishedBySlug('source-original');expect(detail?.reviewState).toBe('draft_awaiting_review');expect(detail?.transcript?.bodyText).toContain('Approvedtranscripttoken');
 });
 it('keeps the original public page complete when no enrichment is eligible',async()=>{
  const repository=await CompositeSourceSermonRepository.create([original()],[],async()=>null);
  await withHttp(repository,async base=>{const response=await fetch(base+'/sermons/source-original/'),body=await response.text();expect(response.status).toBe(200);expect(body).toContain('Original public fixture wording.');expect(body).toContain('<title>Exact original document title</title>');expect(body).not.toContain('Approvedsynthetickeyword');expect(body).not.toContain('id="transcript-heading"');});
 });
 it('adds approved enrichment at the verified original URL and new eligible sermons to HTML, search and sitemap',async()=>{
  const entry=approved(),newEntry=approved({sourceWordpressId:null});newEntry.detail={...newEntry.detail,id:'33333333-3333-4333-8333-333333333333',slug:'new-approved-fixture',title:'A new approved fixture',summary:'Newpublicationtoken is part of an invented approved description for a completely new sermon test fixture, with no real source material.'};
  const repository=await CompositeSourceSermonRepository.create([original()],[entry,newEntry],async()=>null);
  expect((await repository.listPublished(query())).totalItems).toBe(2);expect((await repository.findPublishedBySlug('source-original'))?.title).toBe('Original visible title');expect(await repository.findPublishedBySlug('evaluation-fixture')).toBeNull();
  expect(await repository.findPublicPathDisposition('/sermons/evaluation-fixture/')).toEqual({kind:'redirect',location:'/sermons/source-original/'});
  for(const word of ['Approvedsynthetickeyword','Approvedtranscripttoken','Approvedanswertoken'])expect((await repository.listPublished({...query(),query:word})).data.some(row=>row.slug==='source-original')).toBe(true);
  await withHttp(repository,async base=>{const response=await fetch(base+'/sermons/source-original/'),body=await response.text();expect(body).toContain('Approvedsynthetickeyword');expect(body).toContain('Approvedtranscripttoken');expect(body).toContain('Original public fixture wording.');expect(body.indexOf('Approvedsynthetickeyword')).toBeLessThan(body.indexOf('id="transcript-heading"'));expect(body).toContain('rel="canonical" href="'+origin+'/sermons/source-original/"');expect(await(await fetch(base+'/sermons/new-approved-fixture/')).text()).toContain('Newpublicationtoken');const sitemap=await(await fetch(base+'/sitemap-sermons.xml')).text();expect(sitemap).toContain('/sermons/source-original/');expect(sitemap).toContain('/sermons/new-approved-fixture/');expect(sitemap).not.toContain('evaluation-fixture');});
 });
 it('honors explicit administrator edits even before recapture and flattens repeated aliases to the edited canonical',async()=>{
  const entry=approved({editorialChanges:{title:'2026-01-01T00:00:00Z',slug:'2026-01-01T00:00:00Z',seoDescription:'2026-01-01T00:00:00Z',body:'2026-01-01T00:00:00Z'}});entry.detail={...entry.detail,slug:'final-editorial',title:'Explicit editorial title',seoDescription:'Explicit editorial metadata',body:'Explicit editorial body.'};
  const repository=await CompositeSourceSermonRepository.create([original()],[entry],async path=>path==='/sermons/first-alias/'?{kind:'redirect',location:'/sermons/second-alias/'}:path==='/sermons/second-alias/'?{kind:'redirect',location:'/sermons/final-editorial/'}:null);
  expect(repository.verifiedSourceShortlinks()).toEqual({'987001':'/sermons/final-editorial/'});
  for(const path of ['/sermons/source-original/','/sermons/first-alias/','/sermons/second-alias/'])expect(await repository.findPublicPathDisposition(path)).toEqual({kind:'redirect',location:'/sermons/final-editorial/'});
  await withHttp(repository,async base=>{const moved=await fetch(base+'/sermons/source-original/',{redirect:'manual'});expect(moved.status).toBe(301);expect(moved.headers.get('location')).toBe('/sermons/final-editorial/');const body=await(await fetch(base+'/sermons/final-editorial/')).text();expect(body).toContain('<title>Explicit editorial title</title>');expect(body).toContain('name="description" content="Explicit editorial metadata"');expect(body).toContain('Explicit editorial body.');expect(body).not.toContain('Original public fixture wording.');});
  expect(original().content[0]?.text).toBe('Original public fixture wording.');
 });
 it('does not resurrect withdrawn originals or expose private projection inputs',async()=>{
  const repository=await CompositeSourceSermonRepository.create([],[],async path=>path==='/sermons/source-original/'?{kind:'gone'}:null);
  await withHttp(repository,async base=>{expect((await fetch(base+'/sermons/source-original/')).status).toBe(410);expect(await(await fetch(base+'/sitemap-sermons.xml')).text()).not.toContain('/sermons/source-original/');});
  const entry=approved();entry.detail.reviewState='draft_awaiting_review';await expect(CompositeSourceSermonRepository.create([original()],[entry],async()=>null)).rejects.toThrow('private_projection');
 });
 it('fails closed on ambiguous source identities and conflicting final routes',async()=>{
  const entry=approved(),duplicate=approved();duplicate.detail={...duplicate.detail,id:'44444444-4444-4444-8444-444444444444',slug:'another-approved'};await expect(CompositeSourceSermonRepository.create([original()],[entry,duplicate],async()=>null)).rejects.toThrow('duplicate_identity');
  const unrelated=approved({sourceWordpressId:null});unrelated.detail.slug='source-original';await expect(CompositeSourceSermonRepository.create([original()],[unrelated],async()=>null)).rejects.toThrow('route_collision');
 });
 it('uses the unchanged public eligibility SQL and no private scope in the production factory',async()=>{
  const statements:string[]=[];const repository=await createCompositeSourceSermonRepository([original()],{query:async text=>{statements.push(text);return{rows:[],rowCount:0,command:'SELECT',oid:0,fields:[]};}});
  expect(statements).toEqual([publicEditorialBindingsSql]);expect(publicEditorialBindingsSql).toContain(frontendSermonEligibilitySql('s','public'));expect(publicEditorialBindingsSql).toContain("a.actor_role='admin'");expect(publicEditorialBindingsSql).toContain("a.action='sermon.update'");expect(publicEditorialBindingsSql).not.toContain('d175');expect((await repository.listPublished(query())).totalItems).toBe(1);
 });
});

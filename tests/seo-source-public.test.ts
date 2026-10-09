import {describe,expect,it} from "vitest";
import {publicSermonListQuerySchema} from "../src/api/contracts/public-sermons";
import {sourcePageSchema,sourceBundleSchema,sourceVersionHash,type SourcePublicPage} from "../src/seo/source-public-model";
import {SourcePublicSermonRepository} from "../src/seo/source-public-repository";
import {createSourcePublicPageHandler,sourcePublicSitemap} from "../src/seo/source-public-handler";
import {renderSourceContent} from "../src/frontend/source-content";
import {publicRenderContext,restrictedRenderContext} from "../src/frontend/routes";
import {createSeoHttpAdapter} from "../src/seo/http-adapter";
import type {SourceNode} from "../src/domain/source-content";

const hash="b".repeat(64),origin="https://www.savinggrace.org.au";
function page(number=1,overrides:Partial<SourcePublicPage>={}):SourcePublicPage{
  const slug="anonymous-source-"+number,path="/sermons/"+slug+"/";
  return sourcePageSchema.parse({path,kind:"sermon",sourceUrl:origin+path,sourceId:900000+number,capturedAt:"2026-10-09T00:00:00Z",responseSha256:hash,
    title:"Anonymous source document "+number,heading:"Anonymous source "+number,description:"Original source metadata.",language:"en",indexable:true,
    canonicalSource:origin+path,publishedAt:"2004-01-01T00:00:00Z",modifiedAt:null,content:[{tag:"p",text:"Original public wording remains visible."}],
    passageTerms:[{name:"John 21:1–14",slug:"john-211-14"}],links:[],mediaReferences:[],issues:[],
    sermon:{id:"00000000-0000-4000-8000-"+String(number).padStart(12,"0"),title:"Anonymous source "+number,slug,serviceDate:"2026-01-"+String(number).padStart(2,"0"),
      summary:null,speaker:{name:"Example Speaker",slug:"example-speaker"},series:[{name:"Example Series",slug:"example-series"}],books:[{name:"John",slug:"john"}],
      scriptureReferences:[{displayText:"John 21:1–14",parseStatus:"unparsed"}],primaryPassages:[],primaryPassageState:"unresolved",primaryMedia:null,seoDescription:null,
      body:"Original source discussion of hope.",media:[],transcript:null,questionAnswers:[],relatedSermons:[]},...overrides});
}
function query(input:Record<string,unknown>={}){return publicSermonListQuerySchema.parse(input);}
describe("source-public provenance model",()=>{
  it("rejects source identity mismatch, generated enrichment, review attribution and unsafe routes",()=>{
    const original=page();
    for(const change of [{sourceUrl:origin+"/different/"},{sourceUrl:origin+original.path+"?preview=true"},
      {path:"//untrusted.test/",sourceUrl:"https://untrusted.test/"},
      {sermon:{...original.sermon!,summary:"Unapproved generated summary"}},
      {sermon:{...original.sermon!,transcript:{bodyText:"Draft transcript"}}},
      {sermon:{...original.sermon!,questionAnswers:[{question:"Generated?",answer:"Yes",displayOrder:1}]}},
      {sermon:{...original.sermon!,reviewWarnings:[]}},
      {sermon:{...original.sermon!,sourcePublic:{content:[],indexable:true,title:"Pretend",description:null,publishedAt:null,modifiedAt:null}}},
      {indexable:true,issues:["unresolved_source"]}]){
      expect(()=>sourcePageSchema.parse({...original,...change})).toThrow();
    }
  });
  it("binds every bundle route and rejects duplicates or missing optimistic versions",()=>{
    const original=page(),bundle={format:"sgbc-source-public-v1",capturedAt:original.capturedAt,inventorySha256:hash,pages:[original],expectedVersions:{[original.path]:null}};
    expect(sourceBundleSchema.parse(bundle).pages).toHaveLength(1);
    expect(()=>sourceBundleSchema.parse({...bundle,pages:[original,original]})).toThrow();
    expect(()=>sourceBundleSchema.parse({...bundle,expectedVersions:{}})).toThrow();
  });
  it("makes source metadata/content changes visible in a deterministic version digest",()=>{
    const original=page(),baseline=sourceVersionHash(original);
    expect(sourceVersionHash({...original})).toBe(baseline);
    expect(sourceVersionHash({...original,content:[{tag:"p",text:"Changed source wording."}]})).not.toBe(baseline);
    expect(sourceVersionHash({...original,modifiedAt:"2005-01-01T00:00:00Z"})).not.toBe(baseline);
    expect(sourceVersionHash({...original,responseSha256:"c".repeat(64)})).not.toBe(baseline);
  });
});
describe("frozen source-public repository",()=>{
  it("filters exact source passage slugs with combined AND/date/order/pagination semantics",async()=>{
    const first=page(1),second=page(2),third=page(3);third.sermon!.speaker={name:"Other Speaker",slug:"other-speaker"};
    second.passageTerms=[{name:"John 20:1",slug:"john-201"}];second.sermon!.scriptureReferences=[{displayText:"John 20:1",parseStatus:"unparsed"}];
    const repository=new SourcePublicSermonRepository([first,second,third]);
    expect((await repository.listPublished(query({passage:"john-211-14",speaker:"example-speaker",series:"example-series",book:"john",query:"hope",dateFrom:"2026-01-01",dateTo:"2026-01-02"}))).data.map(row=>row.slug)).toEqual([first.sermon!.slug]);
    expect((await repository.listPublished(query({passage:"john-211"}))).totalItems).toBe(0);
    expect((await repository.listPublished(query({order:"ASC",pageSize:1,page:2}))).data[0]?.slug).toBe(second.sermon!.slug);
    expect((await repository.listPublished(query({order:"DESC",pageSize:1,page:1}))).data[0]?.slug).toBe(third.sermon!.slug);
  });
  it("counts distinct eligible source sermons per explicit term and does not put source bodies in summaries",async()=>{
    const first=page(1),second=page(2);first.sermon!.series.push({...first.sermon!.series[0]!});first.passageTerms.push({...first.passageTerms[0]!});
    const repository=new SourcePublicSermonRepository([first,second]),options=await repository.listPublishedFilterOptions();
    expect(options.series[0]?.sermonCount).toBe(2);expect(options.passages).toEqual([{name:"John 21:1–14",slug:"john-211-14",sermonCount:2}]);
    const list=await repository.listPublished(query());expect(list.data[0]).not.toHaveProperty("body");expect(list.data[0]).not.toHaveProperty("sourcePublic");expect(list.data[0]).not.toHaveProperty("transcript");expect(list.data[0]?.summary).toBeNull();
  });
  it("uses only complete explicit source references for bounded verse discovery",async()=>{
    const exact=page(),ambiguous=page(2),chapter=page(3);
    ambiguous.passageTerms=[];ambiguous.sermon!.scriptureReferences=[{displayText:"Thoughts about John 21:1–14 and John 20:1",parseStatus:"unparsed"}];
    ambiguous.sermon!.title="John 21:1–14 title alone does not count";
    chapter.passageTerms=[{name:"John 20",slug:"john-20"}];chapter.sermon!.scriptureReferences=[{displayText:"John 20",parseStatus:"unparsed"}];
    const repository=new SourcePublicSermonRepository([exact,ambiguous,chapter]);
    expect((await repository.listPublished(query({passageBook:"john",passageChapter:21,passageVerse:14}))).data.map(row=>row.slug)).toEqual([exact.sermon!.slug]);
    expect((await repository.listPublished(query({passageBook:"john",passageChapter:21,passageVerse:15}))).totalItems).toBe(0);
    const availability=(await repository.listPublishedFilterOptions()).passageVerseAvailability;
    expect(availability).toEqual([{bookSlug:"john",chapter:21,verses:Array.from({length:14},(_,index)=>index+1)}]);
    expect((await repository.listPublished(query({passageBook:"john",passageChapter:20}))).data.map(row=>row.slug)).toEqual([chapter.sermon!.slug]);
    expect((await repository.listPublished(query({passageBook:"john",passageChapter:20,passageVerse:1}))).totalItems).toBe(0);
  });
  it("does not let callers mutate the frozen source or returned nested summaries and details",async()=>{
    const original=page(),repository=new SourcePublicSermonRepository([original]);
    original.sermon!.title="Injected title";original.content[0]!.text="Injected source body";
    const first=await repository.findPublishedBySlug("anonymous-source-1");
    expect(first?.title).toBe("Anonymous source 1");expect(first?.sourcePublic?.content[0]?.text).toBe("Original public wording remains visible.");
    first!.sourcePublic!.content[0]!.text="Mutated result";first!.series[0]!.name="Mutated series";
    const summary=(await repository.listPublished(query())).data[0]!;summary.series[0]!.name="Mutated summary";
    const again=await repository.findPublishedBySlug("anonymous-source-1");expect(again?.sourcePublic?.content[0]?.text).toBe("Original public wording remains visible.");expect(again?.series[0]?.name).toBe("Example Series");
  });
  it("preserves source noindex and excludes unresolved originals from discovery",async()=>{
    const noindex=page(1,{indexable:false}),unresolved=page(2,{indexable:false,issues:["missing_source_heading"]});
    const repository=new SourcePublicSermonRepository([noindex,unresolved]);
    expect((await repository.listPublished(query())).totalItems).toBe(1);expect(await repository.listPublishedSitemapEntries()).toEqual([]);
    expect((await repository.findPublishedBySlug(noindex.sermon!.slug))?.sourcePublic?.indexable).toBe(false);expect(await repository.findPublishedBySlug(unresolved.sermon!.slug)).toBeNull();
  });
  it("preserves Arabic source identity and uses canonical encoded lookup without fake enrichment",async()=>{
    const original=page(),slug="%d9%85%d8%ab%d8%a7%d9%84",path="/sermons/"+slug+"/";
    original.path=path;original.sourceUrl=origin+path;original.sermon!.slug=slug;original.language="ar";original.sermon!.language="ar";
    const repository=new SourcePublicSermonRepository([original]);
    expect((await repository.findPublishedBySlug("مثال"))?.slug).toBe(slug);
    const detail=await repository.findPublishedBySlug(slug.toUpperCase());expect(detail?.language).toBe("ar");expect(detail?.summary).toBeNull();expect(detail?.transcript).toBeNull();expect(detail?.questionAnswers).toEqual([]);
  });
  it("rejects duplicate source identities and malformed source-only payloads",()=>{
    const original=page();expect(()=>new SourcePublicSermonRepository([original,original])).toThrow("duplicate_sermon");
    expect(()=>new SourcePublicSermonRepository([{...original,sermon:{...original.sermon!,summary:"Injected"}}])).toThrow();
  });
});
describe("source-only initial HTML and safe markup",()=>{
  it("renders original source wording and metadata initially without transcripts, Q&A or invented approvals",async()=>{
    const original=page(),route=createSeoHttpAdapter({policy:{environment:"production",canonicalOrigin:origin},sermons:new SourcePublicSermonRepository([original])});
    const response=await route(new Request(origin+original.path)),html=await response.text();
    expect(response.status).toBe(200);expect(html).toContain("Original public wording remains visible.");expect(html).toContain("<title>Anonymous source document 1</title>");
    expect(html).not.toContain('id="transcript-heading"');expect(html).not.toContain('class="question"');expect(html).not.toContain("approved description");
    const noindex={...original,indexable:false},hidden=createSeoHttpAdapter({policy:{environment:"production",canonicalOrigin:origin},sermons:new SourcePublicSermonRepository([noindex])});
    expect(await (await hidden(new Request(origin+original.path))).text()).toContain('name="robots" content="noindex, follow"');
  });
  it("retains safe original text/links while removing executable protocols and forbidden tags",()=>{
    const rendered=String(renderSourceContent([{tag:"p",text:'<script>alert("x")</script>'},{tag:"a",href:"javascript:alert(1)",text:"Unsafe link"},
      {tag:"img",src:"data:text/html,unsafe",alt:"Unsafe image"},{tag:"a",href:origin+"/about/?x=1&y=2",text:"Internal link"},{tag:"a",href:"https://example.test/?q=a&b=c",text:"External"}]));
    expect(rendered).toContain("&lt;script&gt;");expect(rendered).not.toContain('href="javascript:');expect(rendered).not.toContain("<img");expect(rendered).toContain('href="/about/?x=1&amp;y=2"');
    expect(()=>renderSourceContent([{tag:"script",text:"alert(1)"}])).toThrow("source_content_tag");
    let nested:SourceNode={tag:"text",text:"Bounded"};for(let i=0;i<52;i++)nested={tag:"div",children:[nested]};
    expect(()=>renderSourceContent([nested])).toThrow("source_content_depth");
  });
  it("serves source page fallback only for resolved snapshots and protects rehearsal identity",async()=>{
    const original=page(),source=sourcePageSchema.parse({...original,path:"/anonymous-page/",sourceUrl:origin+"/anonymous-page/",kind:"page",sermon:null,indexable:false});
    const handler=createSourcePublicPageHandler([source]);
    const response=await handler(new Request(origin+source.path),publicRenderContext);expect(response?.status).toBe(200);expect(await response?.text()).toContain('name="robots" content="noindex, follow"');
    expect(sourcePublicSitemap([source])).toEqual([]);
    const isolated=await handler(new Request(origin+source.path),restrictedRenderContext);expect(await isolated?.text()).not.toContain('rel="canonical"');
    expect(await handler(new Request(origin+"/absent/"),publicRenderContext)).toBeNull();
  });
});

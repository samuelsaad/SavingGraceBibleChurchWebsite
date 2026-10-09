import {sourceSeo} from './source-metadata';
import type { PublicSermonListQuery } from "../api/contracts/public-sermons";
import type { SermonDetail, SermonSummary } from "../domain/sermon";
import { canonicalStoredSermonSlug } from "../domain/slug";
import { bibleBookById, bibleBookBySlug, biblePassageIntervalsOverlap, extractPrimaryPassageFromTitle, resolveBibleBook, type StructuredBiblePassage } from "../domain/bible-passage";
import type { PublicSermonRepository, PublicSermonFilterOptions, PublicSermonFilterOption } from "../server/repositories/sermon-repository";
import { sourcePageSchema, type SourcePublicPage } from "./source-public-model";

function sourceReferenceTexts(page: SourcePublicPage): string[] {
  return [...new Set([...page.sermon!.scriptureReferences.map(item=>item.displayText), ...page.passageTerms.map(item=>item.name)])];
}
/** The parser sees only an entire explicit source reference, never a title/body. */
function exactSourceRanges(page: SourcePublicPage): StructuredBiblePassage[] {
  return sourceReferenceTexts(page).flatMap(text=>{
    const result=extractPrimaryPassageFromTitle(text);
    return result.outcome==="one_valid_reference" && result.passage.originalReferenceText===text.normalize("NFKC").trim() ? [result.passage] : [];
  });
}
function matchesSourcePassage(page:SourcePublicPage,query:Partial<PublicSermonListQuery>):boolean {
  if(!query.passageBook)return true;
  const book=bibleBookBySlug(query.passageBook);if(!book)return false;
  const ranges=exactSourceRanges(page).filter(range=>range.canonicalBookId===book.id);
  if(query.passageChapter===undefined)return ranges.length>0 || sourceReferenceTexts(page).some(text=>resolveBibleBook(text)?.id===book.id);
  return ranges.some(range=>(query.passageVerse===undefined || range.startVerse!==null&&range.endVerse!==null) && biblePassageIntervalsOverlap(range,{
    canonicalBookId:book.id,startChapter:query.passageChapter!,endChapter:query.passageChapter!,
    startVerse:query.passageVerse??null,endVerse:query.passageEndVerse??query.passageVerse??null
  }));
}
function verseAvailability(pages:readonly SourcePublicPage[]):PublicSermonFilterOptions["passageVerseAvailability"] {
  const rows=new Map<string,{bookSlug:string;chapter:number;verses:Set<number>}>();
  for(const page of pages)for(const range of exactSourceRanges(page)){
    // Chapter-only source labels give no evidence for exact verse coverage.
    if(range.startVerse===null || range.endVerse===null)continue;
    const book=bibleBookById(range.canonicalBookId)!;
    for(let chapter=range.startChapter;chapter<=range.endChapter;chapter++){
      const key=book.slug+":"+chapter;
      const row=rows.get(key)??{bookSlug:book.slug,chapter,verses:new Set<number>()};
      for(let verse=chapter===range.startChapter?range.startVerse:1;verse<=(chapter===range.endChapter?range.endVerse:book.verseCounts[chapter-1]!);verse++)row.verses.add(verse);
      rows.set(key,row);
    }
  }
  return [...rows.values()].sort((a,b)=>a.bookSlug.localeCompare(b.bookSlug)||a.chapter-b.chapter).map(row=>({...row,verses:[...row.verses].sort((a,b)=>a-b)}));
}
function termOptions(pages:readonly SourcePublicPage[],pick:(page:SourcePublicPage)=>readonly {name:string;slug:string}[]):PublicSermonFilterOption[] {
  const terms=new Map<string,PublicSermonFilterOption>();
  for(const page of pages)for(const term of new Map(pick(page).map(item=>[item.slug,item])).values()){
    const previous=terms.get(term.slug);
    if(previous && previous.name!==term.name)throw new Error("source_public_taxonomy_conflict");
    terms.set(term.slug,{...term,sermonCount:(previous?.sermonCount??0)+1});
  }
  return [...terms.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.slug.localeCompare(b.slug));
}

/** A private immutable copy of a verified source-only projection; no enrichment repository is read. */
export class SourcePublicSermonRepository implements PublicSermonRepository {
  private readonly pages: SourcePublicPage[];
  constructor(pages:readonly SourcePublicPage[],private readonly disposition?:(path:string)=>Promise<import("../server/repositories/sermon-repository").PublicSermonPathDisposition|null>) {
    this.pages=pages.map(page=>sourcePageSchema.parse(structuredClone(page))).filter(page=>page.kind==="sermon"&&page.sermon&&page.issues.length===0);
    if(this.pages.some(page=>canonicalStoredSermonSlug(page.sermon!.slug)!==page.sermon!.slug))throw new Error("source_public_sermon_slug_invalid");
    if(new Set(this.pages.map(page=>page.sermon!.slug)).size!==this.pages.length
      || new Set(this.pages.map(page=>page.sermon!.id)).size!==this.pages.length)throw new Error("source_public_duplicate_sermon");
  }
  private selected(query?:Partial<PublicSermonListQuery>):SourcePublicPage[] {
    return this.pages.filter(page=>{
      if(!query)return true;
      const sermon=page.sermon!;
      if(query.speaker&&sermon.speaker?.slug!==query.speaker)return false;
      if(query.series&&!sermon.series.some(term=>term.slug===query.series))return false;
      if(query.book&&!sermon.books.some(term=>term.slug===query.book))return false;
      if(query.passage&&!page.passageTerms.some(term=>term.slug===query.passage))return false;
      if(query.dateFrom&&sermon.serviceDate<query.dateFrom || query.dateTo&&sermon.serviceDate>query.dateTo)return false;
      if(!matchesSourcePassage(page,query))return false;
      const text=[sermon.title,sermon.speaker?.name,...sermon.series.map(term=>term.name),...sermon.books.map(term=>term.name),...sourceReferenceTexts(page),sermon.body].filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("en-AU");
      return !query.query||query.query.normalize("NFKC").toLocaleLowerCase("en-AU").split(/\s+/u).every(term=>text.includes(term));
    });
  }
  private summary(page:SourcePublicPage):SermonSummary {
    const {sourcePublic,seoDescription,body,media,transcript,questionAnswers,relatedSermons,reviewWarnings,reviewProvenance,relatedThemes,...summary}=page.sermon!;
    return structuredClone(summary);
  }
  async listPublished(query:PublicSermonListQuery) {
    const rows=this.selected(query).sort((a,b)=>{
      const compared=a.sermon!.serviceDate.localeCompare(b.sermon!.serviceDate)||a.sermon!.id.localeCompare(b.sermon!.id);
      return query.order==="ASC"?compared:-compared;
    });
    return {totalItems:rows.length,data:rows.slice((query.page-1)*query.pageSize,query.page*query.pageSize).map(page=>this.summary(page))};
  }
  async findPublishedBySlug(slug:string):Promise<SermonDetail|null> {
    const normalized=canonicalStoredSermonSlug(slug),page=this.pages.find(item=>item.sermon!.slug===normalized);
    if(!page)return null;
    const sermon=structuredClone(page.sermon!);
    return {...sermon,sourcePublic:{language:page.language,content:structuredClone(page.content),indexable:page.indexable,title:page.title,description:page.description,...(page.socialType?{socialType:page.socialType}:{}),...(page.socialTitle?{socialTitle:page.socialTitle}:{}),...(page.socialDescription?{socialDescription:page.socialDescription}:{}),...(sourceSeo(page).image?{socialImage:sourceSeo(page).image}:{}),publishedAt:page.publishedAt,modifiedAt:page.modifiedAt},
      relatedSermons:this.pages.filter(item=>item.path!==page.path&&item.sermon!.series.some(term=>sermon.series.some(other=>other.slug===term.slug)))
        .sort((a,b)=>b.sermon!.serviceDate.localeCompare(a.sermon!.serviceDate)||a.sermon!.id.localeCompare(b.sermon!.id)).slice(0,3)
        .map(item=>({...this.summary(item),relationshipReasons:["same_series"]}))};
  }
  async listPublishedFilterOptions(query?:PublicSermonListQuery):Promise<PublicSermonFilterOptions> {
    const pages=this.selected(query);
    return {speakers:termOptions(pages,page=>page.sermon!.speaker?[page.sermon!.speaker]:[]),
      series:termOptions(pages,page=>page.sermon!.series),books:termOptions(pages,page=>page.sermon!.books),
      passages:termOptions(pages,page=>page.passageTerms),passageVerseAvailability:verseAvailability(pages)};
  }
  async listPublishedTopicalSermons(){return this.pages.filter(page=>page.sermon!.isTopical).map(page=>this.summary(page));}
  async listPublishedSeriesRepresentatives(){
    const options=await this.listPublishedFilterOptions();
    return options.series.map(series=>({series,sermon:this.summary(this.pages.filter(page=>page.sermon!.series.some(term=>term.slug===series.slug))
      .sort((a,b)=>b.sermon!.serviceDate.localeCompare(a.sermon!.serviceDate)||a.sermon!.id.localeCompare(b.sermon!.id))[0]!)}));
  }
  async listPublishedSitemapEntries(){return this.pages.filter(page=>page.indexable).map(page=>({slug:page.sermon!.slug,lastModified:(page.modifiedAt??page.publishedAt??page.sermon!.serviceDate).slice(0,10)}));}
  async findPublicPathDisposition(path:string){return this.disposition?await this.disposition(path):null;}
}

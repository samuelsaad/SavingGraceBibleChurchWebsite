/** Source originals plus the unchanged, normally approved public editorial projection. */
import {z} from 'zod';
import type {PublicSermonListQuery} from '../api/contracts/public-sermons';
import {sermonDetailSchema,type SermonDetail,type SermonSummary} from '../domain/sermon';
import {canonicalStoredSermonSlug} from '../domain/slug';
import {bibleBookById,bibleBookBySlug,biblePassageIntervalsOverlap,extractPrimaryPassageFromTitle,resolveBibleBook,type StructuredBiblePassage} from '../domain/bible-passage';
import {PostgresSermonRepository,type SqlExecutor} from '../server/repositories/postgres-sermon-repository';
import {frontendSermonEligibilitySql} from '../server/queries/public-sermons';
import type {PublicSermonRepository,PublicSermonFilterOptions,PublicSermonPathDisposition} from '../server/repositories/sermon-repository';
import {sourcePageSchema,sourceVersionHash,type SourcePublicPage} from './source-public-model';
import {SourcePublicSermonRepository} from './source-public-repository';

const term=z.object({name:z.string(),slug:z.string()});
const bindingSchema=z.object({id:z.uuid(),slug:z.string(),source_wordpress_id:z.string().regex(/^[1-9][0-9]*$/u).nullable(),last_modified:z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),editorial_changes:z.record(z.string(),z.string()),passage_terms:z.array(term)});
/** No bodies or guessed UUID identity: joins use the unique stored WordPress ID. */
export const publicEditorialBindingsSql=`SELECT s.id,s.slug,s.source_wordpress_id::text,
 to_char(s.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS last_modified,
 COALESCE((SELECT jsonb_object_agg(changed.field,changed.at) FROM (
  SELECT field.value AS field,max(a.created_at) AS at FROM audit_events a
  CROSS JOIN LATERAL jsonb_array_elements_text(a.changed_fields) field(value)
  WHERE a.entity_type='sermon' AND a.entity_id=s.id AND a.actor_role='admin'
   AND a.action='sermon.update' AND a.outcome='succeeded' GROUP BY field.value
 ) changed),'{}'::jsonb) AS editorial_changes,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('name',t.name,'slug',t.slug) ORDER BY t.slug)
  FROM sermon_source_terms m JOIN source_taxonomy_terms t ON t.id=m.source_taxonomy_term_id
  WHERE m.sermon_id=s.id AND t.taxonomy='sermon_topics'),'[]'::jsonb) AS passage_terms
 FROM sermons s WHERE ${frontendSermonEligibilitySql('s','public')}
 AND NOT EXISTS(SELECT 1 FROM source_public_routes original WHERE original.source_wordpress_id=s.source_wordpress_id
  AND (original.withdrawn OR EXISTS(SELECT 1 FROM redirects disposition WHERE disposition.old_path=original.path AND disposition.status_code=410)))
 ORDER BY s.id`;

export interface PublicEditorialSermon {
 detail:SermonDetail;
 sourceWordpressId:string|null;
 editorialChanges:Readonly<Record<string,string>>;
 passageTerms:readonly {name:string;slug:string}[];
 lastModified:string;
 /** An existing explicit same-sermon 301, verified by the production factory. */
 canonicalSlug?:string;
}
interface RecordProjection {detail:SermonDetail;passageTerms:readonly {name:string;slug:string}[];lastModified:string;indexable:boolean;}
const summary=(detail:SermonDetail):SermonSummary=>{
 const {sourcePublic,seoDescription,body,media,transcript,questionAnswers,relatedSermons,reviewWarnings,reviewProvenance,relatedThemes,...value}=detail;
 return structuredClone(value);
};
const pathFor=(slug:string)=>'/sermons/'+slug+'/';
const words=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('en-AU');
function ranges(record:RecordProjection):StructuredBiblePassage[]{
 const texts=[...record.detail.primaryPassages.map(p=>p.displayText),...record.detail.scriptureReferences.map(p=>p.displayText),...record.passageTerms.map(p=>p.name)];
 return texts.flatMap(text=>{const result=extractPrimaryPassageFromTitle(text);return result.outcome==='one_valid_reference'&&result.passage.originalReferenceText===text.normalize('NFKC').trim()?[result.passage]:[];});
}
function matches(record:RecordProjection,query?:Partial<PublicSermonListQuery>):boolean{
 if(!query)return true;const sermon=record.detail;
 if(query.speaker&&sermon.speaker?.slug!==query.speaker||query.series&&!sermon.series.some(t=>t.slug===query.series)||query.book&&!sermon.books.some(t=>t.slug===query.book)||query.passage&&!record.passageTerms.some(t=>t.slug===query.passage))return false;
 if(query.dateFrom&&sermon.serviceDate<query.dateFrom||query.dateTo&&sermon.serviceDate>query.dateTo)return false;
 if(query.passageBook){const book=bibleBookBySlug(query.passageBook);if(!book)return false;const selected=ranges(record).filter(p=>p.canonicalBookId===book.id);
  if(query.passageChapter===undefined){if(!selected.length&&!record.passageTerms.some(p=>resolveBibleBook(p.name)?.id===book.id))return false;}
  else if(!selected.some(p=>(query.passageVerse===undefined||p.startVerse!==null&&p.endVerse!==null)&&biblePassageIntervalsOverlap(p,{canonicalBookId:book.id,startChapter:query.passageChapter!,endChapter:query.passageChapter!,startVerse:query.passageVerse??null,endVerse:query.passageEndVerse??query.passageVerse??null})))return false;
 }
 const text=words([sermon.title,sermon.speaker?.name,...sermon.series.map(t=>t.name),...sermon.books.map(t=>t.name),...sermon.scriptureReferences.map(p=>p.displayText),...record.passageTerms.map(p=>p.name),sermon.body,sermon.summary,sermon.transcript?.bodyText,...sermon.questionAnswers.flatMap(q=>[q.question,q.answer])].filter(Boolean).join(' '));
 return !query.query||words(query.query).split(/\s+/u).every(word=>text.includes(word));
}
const newest=(a:RecordProjection,b:RecordProjection)=>b.detail.serviceDate.localeCompare(a.detail.serviceDate)||a.detail.id.localeCompare(b.detail.id);

/** Inputs are already-public delegate results; production uses the guarded factory below. */
export class CompositeSourceSermonRepository implements PublicSermonRepository {
 private readonly records:RecordProjection[]=[];
 private readonly aliases=new Map<string,string>();
 private readonly bySlug=new Map<string,RecordProjection>();
 private readonly sourceShortlinks=new Map<string,string>();
 private readonly nativeSlugs=new Map<string,string>();
 private readonly relatedCache=new Map<string,Promise<SermonDetail['relatedSermons']>>();
 private constructor(private readonly disposition:(path:string)=>Promise<PublicSermonPathDisposition|null>,private readonly relatedLoader?:(id:string,slug:string)=>Promise<SermonDetail['relatedSermons']>){}
 static async create(pages:readonly SourcePublicPage[],approved:readonly PublicEditorialSermon[],disposition:(path:string)=>Promise<PublicSermonPathDisposition|null>,acceptedStaging=false,relatedLoader?:(id:string,slug:string)=>Promise<SermonDetail['relatedSermons']>){
  const repository=new CompositeSourceSermonRepository(disposition,relatedLoader),source=new SourcePublicSermonRepository(pages);
  const candidates=pages.map(p=>sourcePageSchema.parse(p)).filter(p=>p.kind==='sermon'&&!p.issues.length);
  const sourceIds=candidates.flatMap(page=>page.sourceId===null?[]:[page.sourceId]);if(new Set(sourceIds).size!==sourceIds.length)throw Error('source_editorial_duplicate_identity');
  const bySource=new Map<string,PublicEditorialSermon>(),ids=new Set<string>();
  for(const item of approved){sermonDetailSchema.parse(item.detail);if(item.detail.sourcePublic||!acceptedStaging&&(item.detail.reviewState||item.detail.reviewProvenance))throw Error('source_editorial_private_projection');
   repository.nativeSlugs.set(item.detail.id,item.detail.slug);
   if(ids.has(item.detail.id))throw Error('source_editorial_duplicate_identity');ids.add(item.detail.id);
   if(item.sourceWordpressId!==null){if(!/^[1-9][0-9]*$/u.test(item.sourceWordpressId)||bySource.has(item.sourceWordpressId))throw Error('source_editorial_duplicate_identity');bySource.set(item.sourceWordpressId,item);}
  }
  const used=new Set<string>();
  for(const page of candidates){
   let detail=(await source.findPublishedBySlug(page.sermon!.slug))!;
   const editorial=page.sourceId===null?undefined:bySource.get(String(page.sourceId));
   let lastModified=(page.modifiedAt??page.publishedAt??detail.serviceDate).slice(0,10),passageTerms=page.passageTerms;
   if(editorial){used.add(editorial.detail.id);const current=structuredClone(editorial.detail),changes=editorial.editorialChanges,edited=(...fields:string[])=>fields.some(field=>Object.hasOwn(changes,field));
    const originalSlug=detail.slug,slug=edited('slug')||editorial.canonicalSlug===current.slug?current.slug:originalSlug;
    detail={...detail,id:current.id,slug,summary:current.summary,transcript:current.transcript,questionAnswers:current.questionAnswers,primaryPassages:current.primaryPassages,primaryPassageState:current.primaryPassageState,...(acceptedStaging?{reviewState:current.reviewState,reviewWarnings:current.reviewWarnings,reviewProvenance:current.reviewProvenance}:{}),
     ...(edited('title')?{title:current.title}:{}),...(edited('serviceDate')?{serviceDate:current.serviceDate}:{}),...(edited('speakerId')?{speaker:current.speaker}:{}),
     ...(edited('seriesIds')?{series:current.series}:{}),...(edited('bookClassificationIds')?{books:current.books}:{}),...(edited('scriptureReferences')?{scriptureReferences:current.scriptureReferences}:{}),
     ...(edited('media')?{media:current.media,primaryMedia:current.primaryMedia,recordingDuration:current.recordingDuration}:{}),
     ...(edited('body')?{body:current.body}:{}),...(edited('seoDescription')?{seoDescription:current.seoDescription}:{}),relatedSermons:current.relatedSermons};
    if(edited('scriptureReferences'))passageTerms=[...editorial.passageTerms];
    // Source body and metadata remain immutable defaults, not inferred editorial text.
    if(edited('body'))detail.sourcePublic!.content=current.body?[{tag:'p',text:current.body}]:[];
    if(edited('title')){detail.sourcePublic!.title=current.title;detail.sourcePublic!.socialTitle=current.title;}
    if(edited('seoDescription')){detail.sourcePublic!.description=current.seoDescription??current.summary;detail.sourcePublic!.socialDescription=current.seoDescription??current.summary??'';}
    const timestamps=Object.values(changes).filter(value=>Number.isFinite(Date.parse(value))).sort((a,b)=>Date.parse(b)-Date.parse(a));
    if(timestamps[0]&&Date.parse(timestamps[0])>Date.parse(lastModified)){lastModified=new Date(timestamps[0]).toISOString().slice(0,10);detail.sourcePublic!.modifiedAt=new Date(timestamps[0]).toISOString();}
    if(originalSlug!==slug)repository.aliases.set(pathFor(originalSlug),pathFor(slug));
    if(current.slug!==slug)repository.aliases.set(pathFor(current.slug),pathFor(slug));
   }
   repository.records.push({detail,passageTerms,lastModified,indexable:page.indexable});
   if(page.sourceId!==null)repository.sourceShortlinks.set(String(page.sourceId),pathFor(detail.slug));
  }
  for(const item of approved)if(!used.has(item.detail.id))repository.records.push({detail:structuredClone(item.detail),passageTerms:structuredClone(item.passageTerms),lastModified:item.lastModified,indexable:true});
  const recordIds=new Set<string>();
  for(const record of repository.records){const slug=canonicalStoredSermonSlug(record.detail.slug);if(slug!==record.detail.slug||repository.bySlug.has(slug)||recordIds.has(record.detail.id))throw Error('source_editorial_route_collision');repository.bySlug.set(slug,record);recordIds.add(record.detail.id);}
  for(const [alias,target]of repository.aliases)if(alias===target||repository.bySlug.has(alias.slice(9,-1)))throw Error('source_editorial_route_collision');
  return repository;
 }
 private selected(query?:Partial<PublicSermonListQuery>){return this.records.filter(record=>matches(record,query));}
 verifiedSourceShortlinks():Readonly<Record<string,string>>{return Object.fromEntries(this.sourceShortlinks);}
 async listPublished(query:PublicSermonListQuery){const rows=this.selected(query).sort((a,b)=>query.order==='ASC'?-newest(a,b):newest(a,b));return{totalItems:rows.length,data:rows.slice((query.page-1)*query.pageSize,query.page*query.pageSize).map(r=>summary(r.detail))};}
 async findPublishedBySlug(slug:string){const normalized=canonicalStoredSermonSlug(slug),record=normalized?this.bySlug.get(normalized):undefined;if(!record)return null;const detail=structuredClone(record.detail),byId=new Map(this.records.map(r=>[r.detail.id,r]));
  const nativeSlug=this.nativeSlugs.get(detail.id);
  if(nativeSlug&&this.relatedLoader){
   let pending=this.relatedCache.get(detail.id);
   if(!pending){pending=this.relatedLoader(detail.id,nativeSlug).catch(error=>{this.relatedCache.delete(detail.id);throw error;});this.relatedCache.set(detail.id,pending);}
   detail.relatedSermons=structuredClone(await pending);
  }
  detail.relatedSermons=detail.relatedSermons.flatMap(related=>{const target=byId.get(related.id);return target&&target.detail.id!==detail.id?[{...summary(target.detail),relationshipReasons:related.relationshipReasons}]:[];}).slice(0,3);
  if(!detail.relatedSermons.length)detail.relatedSermons=this.records.filter(r=>r.detail.id!==detail.id&&r.detail.series.some(t=>detail.series.some(s=>s.slug===t.slug))).sort(newest).slice(0,3).map(r=>({...summary(r.detail),relationshipReasons:['same_series' as const]}));
  return detail;
 }
 async listPublishedFilterOptions(query?:PublicSermonListQuery):Promise<PublicSermonFilterOptions>{
  const rows=this.selected(query),terms=(pick:(r:RecordProjection)=>readonly {name:string;slug:string}[])=>{const map=new Map<string,{name:string;slug:string;sermonCount:number}>();for(const row of rows)for(const t of new Map(pick(row).map(t=>[t.slug,t])).values()){const old=map.get(t.slug);map.set(t.slug,{...t,sermonCount:(old?.sermonCount??0)+1});}return[...map.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.slug.localeCompare(b.slug));};
  const availability=new Map<string,{bookSlug:string;chapter:number;verses:Set<number>}>();
  for(const row of rows)for(const range of ranges(row)){if(range.startVerse===null||range.endVerse===null)continue;const book=bibleBookById(range.canonicalBookId)!;for(let chapter=range.startChapter;chapter<=range.endChapter;chapter++){const key=book.slug+':'+chapter,entry=availability.get(key)??{bookSlug:book.slug,chapter,verses:new Set<number>()};for(let verse=chapter===range.startChapter?range.startVerse:1;verse<=(chapter===range.endChapter?range.endVerse:book.verseCounts[chapter-1]!);verse++)entry.verses.add(verse);availability.set(key,entry);}}
  return{speakers:terms(r=>r.detail.speaker?[r.detail.speaker]:[]),series:terms(r=>r.detail.series),books:terms(r=>r.detail.books),passages:terms(r=>r.passageTerms),passageVerseAvailability:[...availability.values()].sort((a,b)=>a.bookSlug.localeCompare(b.bookSlug)||a.chapter-b.chapter).map(r=>({...r,verses:[...r.verses].sort((a,b)=>a-b)}))};
 }
 async listPublishedTopicalSermons(){return this.records.filter(r=>r.detail.isTopical).sort(newest).map(r=>summary(r.detail));}
 async listPublishedSeriesRepresentatives(){return(await this.listPublishedFilterOptions()).series.map(series=>({series,sermon:summary(this.records.filter(r=>r.detail.series.some(t=>t.slug===series.slug)).sort(newest)[0]!.detail)}));}
 async listPublishedSitemapEntries(){return this.records.filter(r=>r.indexable).map(r=>({slug:r.detail.slug,lastModified:r.lastModified}));}
 async findPublicPathDisposition(path:string){
  if(this.aliases.has(path))return{kind:'redirect' as const,location:this.aliases.get(path)!};
  const selected=await this.disposition(path);if(selected?.kind!=='redirect')return selected;
  const seen=new Set<string>([path]);let target=selected.location;
  while(!seen.has(target)&&seen.size<16){seen.add(target);target=this.aliases.get(target)??target;if(this.bySlug.has(target.slice(9,-1)))return{kind:'redirect' as const,location:target};const next=await this.disposition(target);if(next?.kind==='gone')return next;if(next?.kind!=='redirect')return null;target=next.location;}
  return null;
 }
}

/** This is the only production constructor: every enrichment detail crosses the normal public gate. */
export async function createCompositeSourceSermonRepository(pages:readonly SourcePublicPage[],database:SqlExecutor,acceptedStageRepository?:PublicSermonRepository):Promise<CompositeSourceSermonRepository>{
 const editorial=acceptedStageRepository??new PostgresSermonRepository(database,'public'),sql=acceptedStageRepository?publicEditorialBindingsSql.replace(frontendSermonEligibilitySql('s','public'),"s.deleted_at IS NULL AND s.status NOT IN ('unpublished','archived')"):publicEditorialBindingsSql,rows=(await database.query(sql)).rows.map(row=>bindingSchema.parse(row));
 if(rows.length>10000)throw Error('source_editorial_corpus_limit');
 const originals=[...pages],moved=new Set<string>();
 // readSourcePublicPages excludes redirected paths. Retain original wording only
 // when an active 301 proves this exact source identity moved to its eligible row.
 const unmatched=rows.filter(row=>row.source_wordpress_id!==null&&!pages.some(page=>page.kind==='sermon'&&String(page.sourceId)===row.source_wordpress_id));
 if(unmatched.length){const retired=(await database.query(`SELECT s.id,v.payload,v.version_sha256,d.new_path
  FROM sermons s JOIN source_public_routes r ON r.source_wordpress_id=s.source_wordpress_id
  JOIN source_public_versions v USING(version_sha256) JOIN redirects d ON d.old_path=r.path
  WHERE s.id=ANY($1::uuid[]) AND NOT r.withdrawn AND d.status_code=301 AND d.source_sermon_id=s.id
   AND d.new_path='/sermons/'||s.slug||'/'`,[unmatched.map(row=>row.id)])).rows;
  for(const row of retired){const page=sourcePageSchema.parse(row.payload),binding=unmatched.find(item=>item.id===row.id);
   if(!binding||sourceVersionHash(page)!==row.version_sha256||page.kind!=='sermon'||String(page.sourceId)!==binding.source_wordpress_id||row.new_path!==pathFor(binding.slug))throw Error('source_editorial_redirect_identity');
   originals.push(page);moved.add(binding.id);
  }
 }
 const approved:PublicEditorialSermon[]=[];
 for(let start=0;start<rows.length;start+=4){const batch=await Promise.all(rows.slice(start,start+4).map(async row=>{const detail=await (editorial.findPublishedSnapshotBySlug?.(row.slug)??editorial.findPublishedBySlug(row.slug));if(!detail){if(acceptedStageRepository)return null;throw Error('source_editorial_changed_during_snapshot');}if(detail.id!==row.id)throw Error('source_editorial_changed_during_snapshot');return{detail,sourceWordpressId:row.source_wordpress_id,editorialChanges:row.editorial_changes,passageTerms:row.passage_terms,lastModified:row.last_modified,...(moved.has(row.id)?{canonicalSlug:row.slug}:{})};}));approved.push(...batch.filter((item):item is NonNullable<typeof item>=>item!==null));}
 return CompositeSourceSermonRepository.create(originals,approved,path=>editorial.findPublicPathDisposition(path),Boolean(acceptedStageRepository),async(id,slug)=>{const current=await editorial.findPublishedBySlug(slug);if(current&&current.id!==id)throw Error('source_editorial_related_changed');return current?.relatedSermons??[];});
}

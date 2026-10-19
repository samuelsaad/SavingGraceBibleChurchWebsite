import {resolveHref} from '../frontend/content/markup';
import {displayedEvents} from './calendar-subscriptions';
/** Live RSS from the same published snapshot; no draft lookup or generated-content bypass. */
import type{CmsSnapshot,CmsPublishedDocument}from'../cms/model';
import type{FrontendSiteSnapshot}from'../frontend/content/site-snapshot';
import type{PublicSermonRepository}from'../server/repositories/sermon-repository';
import type{SourcePublicPage}from'./source-public-model';
import type{SourceRssFacts}from'./rss-facts';
import{sha256,stableJson,sourceOrigin}from'./source-public-model';
import{publicSermonListQuerySchema}from'../api/contracts/public-sermons';
import{renderSourceContent}from'../frontend/source-content';
import{renderBlocks}from'../frontend/components/blocks';
import{publicRenderContext}from'../frontend/routes';
import{calendarOccurrenceEvents}from'./legacy-calendar-identities';
import{melbourneToday,occurrencesBetween}from'../frontend/content/events';
import{melbourneUtc}from'../frontend/pages/church';

type Entry={path:string;title:string;guid:string;isPermaLink:boolean;publishedAt:string|null;modifiedAt?:string|undefined;description:string;content:string;creator?:string|undefined;categories:readonly string[];sourceId?:number;unchanged:boolean;cancelled?:boolean};
const escape=(value:string)=>value.replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
const cdata=(value:string)=>'<![CDATA['+value.replaceAll(']]>',']]]]><![CDATA[>')+']]>';
const absolute=(href:string)=>new URL(href,sourceOrigin).href;
const absoluteMarkup=(value:string)=>value.replace(/\b(href|src)="(\/(?!\/)[^"]*)"/gu,(_,name:string,path:string)=>name+'="'+sourceOrigin+path+'"');
const sameDate=(a:string|null,b:string|null)=>a===null&&b===null||Boolean(a&&b&&Date.parse(a)===Date.parse(b));
const documentFor=(cms:CmsSnapshot,kind:string,id:string)=>cms.entities.find(doc=>doc.kind===kind&&doc.content.id===id);
const unchanged=(facts:SourceRssFacts,doc:CmsPublishedDocument|undefined)=>Boolean(doc&&facts.baselineDocuments[String(doc.content.id)]===sha256(stableJson(doc.content)));
function calendarInstant(date:string,time:string):string{const stamp=melbourneUtc(date,time);return stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u,'$1-$2-$3T$4:$5:$6Z');}
export interface SourceRssOptions{pages:readonly SourcePublicPage[];facts:ReadonlyMap<string,SourceRssFacts>;cms:CmsSnapshot;content:FrontendSiteSnapshot;sermons:PublicSermonRepository;sourceBindings:Readonly<Record<string,string>>;firstCmsPublishedAt?:Readonly<Record<string,string>>;nativeSermonPublishedAt?:Readonly<Record<string,string>>;now?:()=>Date}
export function createSourceRssHandler(options:SourceRssOptions){
 const feeds=new Map(options.pages.filter(page=>options.facts.has(page.path)&&!page.issues.length).map(page=>[page.path,page]));
 const context={...publicRenderContext,siteContent:options.content};
 const image=(value:string)=>{try{const u=new URL(value,sourceOrigin),match=/^\/(?:www\.)?savinggrace\.org\.au(\/wp-content\/uploads\/.+)$/u.exec(u.pathname);if(['i0.wp.com','i1.wp.com','i2.wp.com'].includes(u.hostname)&&match&&[...u.searchParams.keys()].every(key=>['resize','fit','crop','ssl','w','h','quality','strip'].includes(key))&&options.pages.some(page=>page.path===match[1]&&page.kind==='asset'&&!page.issues.length&&page.asset?.contentType.startsWith('image/')))return match[1]!;}catch{}return value;};
 const nodes=(value:SourceRssFacts['items'][number]['content'])=>absoluteMarkup(String(renderSourceContent(value,href=>absolute(resolveHref(href,context)),{image})));
 const originalByCanonical=new Map(options.pages.filter(page=>page.kind==='sermon').map(page=>[options.sourceBindings[String(page.sourceId)]??page.path,page]));
 const render=(blocks:Parameters<typeof renderBlocks>[0])=>absoluteMarkup(String(renderBlocks(blocks,{context,today:melbourneToday(options.now?.()),sermons:[]})));
 return async(request:Request):Promise<Response|null>=>{
  const url=new URL(request.url),page=feeds.get(url.pathname);if(!page)return null;
  const missing=()=>new Response(null,{status:404,headers:{'X-Robots-Tag':'noindex','Cache-Control':'no-store'}});
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  if([...url.searchParams.keys()].some(key=>key!=='paged'&&!/^utm_[a-z_]+$|^(?:gclid|wbraid|gbraid)$/u.test(key))||url.searchParams.getAll('paged').length>1||url.searchParams.has('paged')&&!/^[1-9][0-9]{0,2}$/u.test(url.searchParams.get('paged')!))return missing();
  const number=Number(url.searchParams.get('paged')??1);
  const facts=options.facts.get(page.path)!,now=options.now?.()??new Date(),entries:Entry[]=[];
  if(facts.kind==='posts')for(const post of options.content.posts){
   const route=options.cms.routes.find(row=>row.path===post.path);if(route&&route.status!==200)continue;
   const doc=documentFor(options.cms,'post',post.id),sourceId=doc?Number((doc.content.source as {id?:number}|undefined)?.id??/^source-public:post:([1-9][0-9]*):/u.exec(doc.key)?.[1]):null;
   const source=options.pages.find(row=>row.kind==='post'&&(sourceId&&row.sourceId===sourceId||row.path===post.path));
   const original=facts.items.find(item=>source&&item.sourceId===source.sourceId||item.path===post.path),legacy=source?.sourceId?facts.legacyGuids[String(source.sourceId)]:undefined,baseline=unchanged(facts,doc);
   const sourceDate=original?.publishedAt??source?.publishedAt??legacy?.publishedAt??null;
   const publishedAt=sourceDate??options.firstCmsPublishedAt?.[doc?.id??'']??null;
   entries.push({path:post.path,title:post.title,guid:original?.guid??legacy?.guid??'urn:sgbc:post:'+(doc?.id??post.id),isPermaLink:original?.isPermaLink??legacy?.isPermaLink??false,publishedAt,modifiedAt:options.content.modifiedAtByPath?.[post.path],description:baseline&&original?nodes(original.description):render(post.description?[{kind:'paragraph',text:post.description}]:[]),content:baseline&&original?nodes(original.content):render(post.blocks),creator:original?.creator,categories:original?.categories??[],...(source?.sourceId?{sourceId:source.sourceId}:{}),unchanged:baseline&&Boolean(original&&original.path===post.path&&original.title===post.title&&sameDate(original.publishedAt,publishedAt))});
  }
  if(facts.kind==='sermons'){
   for(let number=1;number<=200;number++){
    const batch=await options.sermons.listPublished(publicSermonListQuerySchema.parse({page:number,pageSize:50,order:'DESC'}));if(batch.totalItems>10000)throw Error('rss_publication_bound');
    for(const sermon of batch.data){const path='/sermons/'+sermon.slug+'/',source=originalByCanonical.get(path),original=facts.items.find(item=>source&&item.sourceId===source.sourceId||item.path===path),legacy=source?.sourceId?facts.legacyGuids[String(source.sourceId)]:undefined,doc=source?options.cms.entities.find(item=>item.content.template==='source-sermon'&&(item.content.source as {id?:number}|undefined)?.id===source.sourceId):undefined;
     const publishedAt=original?.publishedAt??source?.publishedAt??legacy?.publishedAt??options.nativeSermonPublishedAt?.[sermon.id]??null;
     const baseline=doc?unchanged(facts,doc):true,livePage=options.content.pages.find(page=>page.path===path),changedContent=doc&&!baseline&&livePage?render(livePage.blocks):null;
     entries.push({path,title:sermon.title,guid:original?.guid??legacy?.guid??'urn:sgbc:sermon:'+sermon.id,isPermaLink:original?.isPermaLink??legacy?.isPermaLink??false,publishedAt,description:changedContent??(original?nodes(original.description):source?'':render(sermon.summary?[{kind:'paragraph',text:sermon.summary}]:[])),content:changedContent??(original?nodes(original.content):legacy?.content?nodes(legacy.content):''),creator:original?.creator,categories:original?.categories??[],...(source?.sourceId?{sourceId:source.sourceId}:{}),unchanged:Boolean(original&&original.path===path&&original.title===sermon.title&&sameDate(original.publishedAt,publishedAt)&&baseline)});}
    if(number*50>=batch.totalItems)break;
   }
  }
  if(facts.kind==='events'){
   const from=melbourneToday(now),until=new Date(Date.parse(from+'T00:00:00Z')+366*86400000).toISOString().slice(0,10),excluded=new Set(facts.excludedBaselineEventIds),all=[...options.content.events,...(options.content.cancelledCalendarEvents??[])].filter(event=>{if(!excluded.has(event.id))return true;const doc=documentFor(options.cms,'event',event.id),cancelled=options.cms.cancelledCalendarEvents?.find(item=>item.content.id===event.id);return doc?!unchanged(facts,doc):Boolean(cancelled&&facts.baselineDocuments[event.id]!==sha256(stableJson(cancelled.content)));});
   const occurrenceEvents=calendarOccurrenceEvents(all,options.content.legacyCalendarOccurrences??[],{from,until},now);
   for(const base of all){if(base.schedule.kind==='single'||!base.calendarRevision||base.calendarRevision.cancelled)continue;for(const date of base.schedule.exclusions??[]){if(date<from||date>until||occurrenceEvents.some(existing=>existing.id===base.id+'-'+date)||!occurrencesBetween({...base,schedule:{...base.schedule,exclusions:[]}},date,date,1).length)continue;const cancelled={...base,schedule:{...base.schedule,exclusions:[]},calendarRevision:{...base.calendarRevision,cancelled:true}};occurrenceEvents.push(...calendarOccurrenceEvents([cancelled],options.content.legacyCalendarOccurrences??[],{from:date,until:date},now));}}
   for(const event of displayedEvents(occurrenceEvents,new URL(sourceOrigin+'/events/feed/?eventDisplay=upcoming'),now)){
    if(event.schedule.kind!=='single')throw Error('rss_occurrence_required');const date=event.schedule.date,base=all.find(row=>event.id===row.id+'-'+date);if(!base)throw Error('rss_occurrence_identity_missing');
    const doc=documentFor(options.cms,'event',base.id),original=facts.items.find(item=>item.eventId===base.id),baseline=unchanged(facts,doc),cancelled=event.calendarRevision?.cancelled===true,originalPath=new URL(event.calendarIdentity?.url??(sourceOrigin+base.path)).pathname,path=originalPath!==base.path?originalPath:facts.eventPaths?.[base.id]?facts.eventPaths[base.id]+date+'/':base.path;
    const description=cancelled?'<p>This gathering has been cancelled.</p>':baseline&&original?nodes(original.description):render(event.description.map(text=>({kind:'paragraph' as const,text}))),content=cancelled?description:baseline&&original?nodes(original.content):render([...(event.description.map(text=>({kind:'paragraph' as const,text}))),...(event.modules??[])]);
    // Original event RSS reused a base GUID for different dates. Keep its exact
    // base identity, adding the actual occurrence date so distinct gatherings
    // no longer overwrite one another in a subscriber's reader.
    const guid=original?original.guid+'#sgbc-occurrence='+date:'urn:sgbc:event:'+sha256(event.calendarIdentity?.uid??base.id+'-'+date);
    entries.push({path,title:(cancelled?'Cancelled: ':'')+event.title,guid,isPermaLink:false,publishedAt:calendarInstant(date,event.start),modifiedAt:event.calendarIdentity?.modifiedAt??base.calendarRevision?.modifiedAt,description,content,creator:original?.creator,categories:original?.categories??[],unchanged:false,cancelled});
   }
  }
  entries.sort((a,b)=>{const order=(Date.parse(a.publishedAt??'')||0)-(Date.parse(b.publishedAt??'')||0);return(facts.kind==='events'?order:-order)||a.path.localeCompare(b.path);});
  if(number>Math.max(1,Math.ceil(entries.length/facts.limit)))return missing();
  const selected=entries.slice((number-1)*facts.limit,number*facts.limit);if(new Set(selected.map(item=>item.guid)).size!==selected.length)throw Error('rss_duplicate_public_identity');
  const siteUnchanged=options.content.settings.siteName===facts.baselineSiteName;
  const title=siteUnchanged?facts.channel.title:facts.channel.title.includes(facts.baselineSiteName)?facts.channel.title.replace(facts.baselineSiteName,options.content.settings.siteName):options.content.settings.siteName;
  const modified=[facts.channel.lastBuildDate,...selected.flatMap(item=>[item.modifiedAt,item.publishedAt])].filter((value):value is string=>Boolean(value&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now.getTime())).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  const image=facts.channel.image;
  const xml='<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:sy="http://purl.org/rss/1.0/modules/syndication/" xmlns:sgbc="https://www.savinggrace.org.au/feed-status"><channel><title>'+escape(title)+'</title><atom:link href="'+escape(sourceOrigin+page.path+(number>1?'?paged='+number:''))+'" rel="self" type="application/rss+xml"/><link>'+escape(absolute(new URL(facts.channel.link).pathname))+'</link><description>'+escape(facts.channel.description)+'</description><language>'+escape(facts.channel.language)+'</language>'+(modified?'<lastBuildDate>'+escape(new Date(modified).toUTCString())+'</lastBuildDate>':'')+'<generator>Saving Grace Bible Church website</generator>'+(facts.channel.updatePeriod?'<sy:updatePeriod>'+escape(facts.channel.updatePeriod)+'</sy:updatePeriod>':'')+(facts.channel.updateFrequency?'<sy:updateFrequency>'+facts.channel.updateFrequency+'</sy:updateFrequency>':'')+(image?'<image><url>'+escape(image.url)+'</url><title>'+escape(image.title)+'</title><link>'+escape(image.link)+'</link>'+(image.width?'<width>'+image.width+'</width>':'')+(image.height?'<height>'+image.height+'</height>':'')+'</image>':'')+selected.map(item=>'<item><title>'+escape(item.title)+'</title><link>'+escape(sourceOrigin+item.path)+'</link>'+(item.creator?'<dc:creator>'+cdata(item.creator)+'</dc:creator>':'')+(item.publishedAt?'<pubDate>'+escape(new Date(item.publishedAt).toUTCString())+'</pubDate>':'')+item.categories.map(category=>'<category>'+cdata(category)+'</category>').join('')+'<guid isPermaLink="'+String(item.isPermaLink)+'">'+escape(item.guid)+'</guid><description>'+cdata(item.description)+'</description><content:encoded>'+cdata(item.content)+'</content:encoded>'+(item.cancelled?'<sgbc:status>cancelled</sgbc:status>':'')+'</item>').join('')+'</channel></rss>\n';
  const etag='"'+sha256(xml)+'"',headers={'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':'no-cache, max-age=0, must-revalidate','X-Robots-Tag':'noindex, follow','X-Content-Type-Options':'nosniff',ETag:etag};
  return request.headers.get('if-none-match')===etag?new Response(null,{status:304,headers}):new Response(request.method==='HEAD'?null:xml,{headers});
 };
}

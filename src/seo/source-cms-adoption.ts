/** Verified original public content becomes ordinary revisions; existing ownership wins. */
import type {CmsEntity,CmsRoute,CmsSeed,CmsVenuePayload} from '../cms/model';
import {validateCmsContent} from '../cms/validation';
import type {SourceNode} from '../domain/source-content';
import {sha256,type SourcePublicPage} from './source-public-model';
export function simplifySourceNodes(nodes:readonly SourceNode[]):SourceNode[]{
 return nodes.flatMap(node=>{const children=simplifySourceNodes(node.children??[]);return ['div','span'].includes(node.tag)&&!node.id&&!node.lang&&!node.dir&&!node.title?[...(node.text?[{tag:'text',text:node.text}]:[]),...children]:[{...node,...(node.children?{children}:{})}];});
}
function wallClock(value:string){const date=new Date(value);if(!Number.isFinite(date.getTime()))throw Error('source_cms_event_date');const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};}
export function sourceCmsAdoption(pages:readonly SourcePublicPage[],entities:readonly CmsEntity[],routes:readonly CmsRoute[]){
 const owned=new Set([...routes.map(r=>r.path),...entities.flatMap(e=>[e.draft.content.path,e.published?.content.path].filter((path):path is string=>typeof path==='string'))]);
 const keys=new Set(entities.map(e=>e.key));const venues=entities.filter(e=>e.kind==='venue'&&e.published).map(e=>e.published!.content as unknown as CmsVenuePayload);
 const seeds:CmsSeed[]=[],held:Array<{path:string;reason:string}>=[];let unchanged=0;
 for(const page of pages){
  if(['asset','feed'].includes(page.kind)||page.issues.length)continue;
  const hash=sha256(page.path).slice(0,16),key=`source-public:${page.kind}:${page.sourceId??'path'}:${hash}`;
  if(keys.has(key)){unchanged++;continue;}if(owned.has(page.path)){held.push({path:page.path,reason:'existing_editorial_ownership_preserved'});continue;}
  if(page.path.includes('?')||page.kind!=='sermon'&&/^\/(?:sermons|speakers|series|books)(?:\/|$)/u.test(page.path)){held.push({path:page.path,reason:'runtime_archive_or_query_not_ordinary_document'});continue;}
  const id=`source-${page.sourceId??'path'}-${hash}`;
  const seo={title:page.title,description:page.description??'',...(page.socialTitle?{socialTitle:page.socialTitle}:{}),...(page.socialDescription?{socialDescription:page.socialDescription}:{}),noindex:!page.indexable};
  const modules=[{id:'original-content',enabled:true,block:{kind:'source-content' as const,nodes:simplifySourceNodes(page.content)}}];let kind:CmsSeed['kind']='page',payload:object;
  if(page.kind==='event'){
   const fact=page.structuredData?.primary;if(fact?.type!=='Event'||!fact.endDate){held.push({path:page.path,reason:'verified_event_facts_incomplete'});continue;}
   const matches=venues.filter(v=>v.name===fact.location?.name&&v.address===fact.location?.address?.streetAddress);
   const start=wallClock(fact.startDate),end=wallClock(fact.endDate);
   if(matches.length!==1||start.date!==end.date||end.time<start.time){held.push({path:page.path,reason:'event_venue_or_date_not_representable'});continue;}
   kind='event';payload={id,title:page.heading,path:page.path,schedule:{kind:'single',date:start.date},start:start.time,end:end.time,venue:matches[0]!.id,description:[],modules,calendarVisible:false,legacyPaths:[],sourceIds:page.sourceId?[page.sourceId]:[],seo,status:'published'};
  }else if(page.kind==='post'&&page.publishedAt){kind='post';payload={id,path:page.path,title:page.heading,date:wallClock(page.publishedAt).date,description:page.description??'',modules,seo,status:'published',legacyPaths:[]};}
  else payload={...(page.kind==='sermon'?{template:'source-sermon'}:{}),id,path:page.path,title:page.heading,heading:page.heading,description:page.description??'',section:page.kind==='sermon'?'sermons':page.kind==='archive'?'events':'resources',status:'published',modules,seo,legacyPaths:[],...(page.sourceId?{source:{id:page.sourceId,link:page.sourceUrl,status:'publish',modified:page.modifiedAt??''}}:{})};
  try{validateCmsContent(kind,payload);seeds.push({key,kind,title:page.heading,path:page.path,payload,publish:true});}catch{held.push({path:page.path,reason:'current_cms_contract_not_representable'});}
 }
 return {seeds,held,unchanged};
}

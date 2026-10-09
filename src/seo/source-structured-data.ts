import {sourceStructuredDataSchema,sourceStructuredPathSchema,type SourceNode,type SourcePrimaryStructuredData,type SourceStructuredData} from '../domain/source-content';
import {sha256,stableJson,sourceHosts} from './source-public-model';

export interface SourceSchemaCapture {
 url:string;primaryHeading?:string;template?:string;schema?:unknown[];bodySha256:string;
 contentTree?:SourceNode[];eventMetadataTree?:SourceNode[];
 publishedAt?:string|null;modifiedAt?:string|null;language?:string;
 images?:Array<{url?:string|null;lazyUrl?:string|null}>;
 links?:Array<{url?:string;href?:string;text?:string}>;
}
type ObjectValue=Record<string,unknown>;
function object(value:unknown):ObjectValue|null{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as ObjectValue:null;}
/** Decode text entities only; no source markup is executed or copied. */
export function sourceSchemaText(value:unknown,maximum=4000):string|null{
 if(typeof value!=='string'||value.length>Math.max(20000,maximum))return null;
 const text=value.replace(/<[^>]*>/gu,' ').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/giu,(_all,entity:string)=>{
  const token=entity.toLowerCase();if(token.startsWith('#')){const number=Number.parseInt(token.slice(token[1]==='x'?2:1),token[1]==='x'?16:10);return number>0&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff)?String.fromCodePoint(number):'';}return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '} as Record<string,string>)[token]!;
 }).replace(/\s+/gu,' ').trim();return text&&text.length<=maximum?text:null;
}
const normalized=(value:unknown)=>sourceSchemaText(value,10000000)?.normalize('NFKC').toLocaleLowerCase('en-AU')??'';
function route(value:unknown):string|null{
 if(typeof value!=='string'||value.length>2000)return null;
 try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||!sourceHosts.has(url.hostname)||url.port||url.username||url.password)return null;const path=url.pathname+url.search;return sourceStructuredPathSchema.safeParse(path).success?path:null;}catch{return null;}
}
function reference(value:unknown){return typeof value==='string'?value:object(value)?.['@id'];}
function nodesText(nodes:readonly SourceNode[],depth=0):string{if(depth>50)throw Error('source_schema_content_depth');return nodes.map(node=>[node.text??'',nodesText(node.children??[],depth+1)].join(' ')).join(' ');}
function schemaNodes(input:unknown[]):ObjectValue[]{
 const result:ObjectValue[]=[];let count=0;const visit=(value:unknown,depth:number)=>{if(++count>20000||depth>30)throw Error('source_schema_size');if(Array.isArray(value)){value.forEach(item=>visit(item,depth+1));return;}const node=object(value);if(!node)return;if(typeof node['@type']==='string')result.push(node);for(const child of Object.values(node))if(child&&typeof child==='object')visit(child,depth+1);};visit(input,0);return result;
}
function exactDate(value:unknown):string|null{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)||!Number.isFinite(Date.parse(value)))return null;const calendar=value.slice(0,10);return new Date(calendar+'T00:00:00Z').toISOString().slice(0,10)===calendar?value:null;}
/** Compare the observed local date/time; never invent an offset or current year. */
function visibleEventDate(value:unknown,visible:string,path:string):string|null{
 const date=exactDate(value);if(!date)return null;const [year,month,day]=date.slice(0,10).split('-').map(Number),hour=Number(date.slice(11,13)),minute=date.slice(14,16);
 const monthName=['january','february','march','april','may','june','july','august','september','october','november','december'][month!-1]!;
 const words=visible.replace(/[^\p{L}\p{N}:]+/gu,' ').trim();
 const dayVisible=[`${monthName} ${day}`,`${day} ${monthName}`,date.slice(0,10).replaceAll('-',' ')].some(token=>new RegExp(`(?:^| )${token}(?= |$)`,'u').test(words));
 const yearVisible=new RegExp(`(?:^|\\D)${year}(?:\\D|$)`,'u').test(words)||path.includes(date.slice(0,10));
 const meridiem=hour<12?'am':'pm',clock=hour%12||12;
 const timeVisible=[`${clock}:${minute} ${meridiem}`,`${clock}:${minute}${meridiem}`].some(token=>new RegExp(`(?:^| )${token}(?= |$)`,'u').test(words))||new RegExp(`(?:^| )${String(hour).padStart(2,'0')}:${minute}(?! ?(?:am|pm))(?= |$)`,'u').test(words);
 return dayVisible&&yearVisible&&timeVisible?date:null;
}

/** Primary identity and visible facts only; related cards and arbitrary graph properties are excluded. */
export function extractSourceStructuredData(capture:SourceSchemaCapture):{value?:SourceStructuredData;omitted:string[]}{
 const path=route(capture.url),heading=sourceSchemaText(capture.primaryHeading),omitted:string[]=[];if(!path||!heading||!capture.schema?.length)return {omitted};
 const nodes=schemaNodes(capture.schema),visible=normalized(nodesText([...(capture.contentTree??[]),...(capture.eventMetadataTree??[])]));
 const visibleFact=(value:unknown)=>{const text=sourceSchemaText(value);return text&&visible.includes(normalized(text))?text:undefined;};
 let primary:SourcePrimaryStructuredData|undefined,primaryOriginal:ObjectValue|undefined;
 const type=capture.template==='event'?'Event':capture.template==='post'?'BlogPosting':null;
 if(type){
  const candidates=nodes.filter(node=>node['@type']===type&&(type==='Event'?route(node.url):route(reference(node.mainEntityOfPage))??route(node['@id']))===path&&normalized(type==='Event'?node.name:node.headline)===normalized(heading));
  const unique=[...new Map(candidates.map(node=>[stableJson(node),node])).values()];
  if(unique.length===1){const node=unique[0]!;primaryOriginal=node;
   const rawImage=Array.isArray(node.image)?node.image[0]:node.image,imagePath=route(object(rawImage)?.url??rawImage),observedImages=new Set((capture.images??[]).flatMap(image=>[route(image.url),route(image.lazyUrl)]).filter(Boolean));
   const image=imagePath&&observedImages.has(imagePath)?{imagePath}:{};
   if(type==='Event'){
    const startDate=visibleEventDate(node.startDate,visible,path),endDate=visibleEventDate(node.endDate,visible,path),location=object(node.location),name=visibleFact(location?.name),address=object(location?.address);
    if(startDate){const fields=Object.fromEntries(['streetAddress','addressLocality','addressRegion','postalCode','addressCountry'].flatMap(key=>{const value=visibleFact(address?.[key]);return value?[[key,value]]:[]}));const description=visibleFact(node.description);primary={type:'Event',path,name:heading,startDate,...(endDate?{endDate}:{}),...(description?{description}:{}),...image,...(name?{location:{name,...(Object.keys(fields).length?{address:fields}:{})}}:{})};if(node.endDate&&!endDate)omitted.push('event_end_not_visible');}
    else omitted.push('event_start_not_visible');
    if(node.description&&!visibleFact(node.description))omitted.push('event_description_not_visible');
   }else{
    const datePublished=exactDate(node.datePublished),dateModified=exactDate(node.dateModified),language=typeof node.inLanguage==='string'&&node.inLanguage===capture.language?node.inLanguage:undefined;
    primary={type:'BlogPosting',path,headline:heading,...(datePublished&&capture.publishedAt&&Date.parse(datePublished)===Date.parse(capture.publishedAt)?{datePublished}:{}),...(dateModified&&capture.modifiedAt&&Date.parse(dateModified)===Date.parse(capture.modifiedAt)?{dateModified}:{}),...(language?{inLanguage:language}:{}),...image};
   }
  }else if(unique.length>1)omitted.push('ambiguous_primary_schema');else if(nodes.some(node=>node['@type']===type))omitted.push('primary_schema_identity_mismatch');
 }
 const breadcrumbCandidates=nodes.filter(node=>node['@type']==='BreadcrumbList'&&route(node['@id'])===path),breadcrumbUnique=[...new Map(breadcrumbCandidates.map(node=>[stableJson(node),node])).values()];
 let breadcrumbs:SourceStructuredData['breadcrumbs'],breadcrumbOriginal:ObjectValue|undefined;
 if(breadcrumbUnique.length===1){const node=breadcrumbUnique[0]!,items=Array.isArray(node.itemListElement)?node.itemListElement:[];
  if(items.length>0&&items.length<=20){const result=items.map((raw,index)=>{const item=object(raw),name=sourceSchemaText(item?.name),last=index===items.length-1,itemPath=route(reference(item?.item))??(last&&normalized(name)===normalized(heading)?path:null);if(!item||item['@type']!=='ListItem'||item.position!==index+1||!name||!itemPath)return null;const visibleLink=(capture.links??[]).some(link=>route(link.url??link.href)===itemPath&&normalized(link.text)===normalized(name));return last&&itemPath===path&&normalized(name)===normalized(heading)||visibleLink?{name,path:itemPath}:null;});
   if(result.every(item=>item!==null)&&result.at(-1)?.path===path){breadcrumbs=result as NonNullable<typeof breadcrumbs>;breadcrumbOriginal=node;}else omitted.push('breadcrumb_identity_or_visible_link_mismatch');
  }
 }else if(breadcrumbUnique.length>1)omitted.push('ambiguous_breadcrumb_schema');
 if(!primary&&!breadcrumbs)return {omitted};
 const value=sourceStructuredDataSchema.parse({responseSha256:capture.bodySha256,schemaSha256:sha256(stableJson({primary:primary?primaryOriginal:undefined,breadcrumbs:breadcrumbOriginal})),...(primary?{primary}:{}),...(breadcrumbs?{breadcrumbs}:{})});
 return {value,omitted};
}

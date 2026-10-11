import { z } from 'zod';
import {sourceNodeSchema} from '../domain/source-content';
import {canonicalStoredSermonSlug} from '../domain/slug';
import { ApplicationError } from '../application/errors';
import { cmsKinds, type CmsDocument, type CmsKind } from './model';

export const cmsKeySchema=z.string().regex(/^[a-z0-9][a-z0-9:._-]{0,119}$/u);
const short=z.string().max(500), title=z.string().min(1).max(240);
export function safeCmsHref(value:string):boolean {
 if(!value||/[\u0000-\u0020\u007f\\]/u.test(value)||value.startsWith('//'))return false;
 if(value.startsWith('/'))return !/%(?:2f|5c|00|0a|0d)/iu.test(value)&&!value.split(/[?#]/u)[0]!.split('/').includes('..');
 if(value.startsWith('#'))return /^#[A-Za-z][\w:.-]*$/u.test(value);
 if(/^mailto:/iu.test(value))return /^mailto:[^\s@?]+@[^\s@?]+(?:\?[^\r\n]*)?$/u.test(value);
 if(/^tel:/iu.test(value))return /^tel:\+?[0-9().-]+$/u.test(value);
 try{const parsed=new URL(value);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password;}catch{return false;}
}
export const cmsHrefSchema=z.string().max(2048).refine(safeCmsHref,'Choose an internal page, HTTPS link, email or telephone link');
const asset=z.string().min(1).max(240).refine(v=>/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(v)||/^\/cms-assets\/[a-f0-9]{64}\.(?:png|jpg|jpeg|webp|gif|pdf)$/u.test(v),'Choose an available image or document');
const rich=z.string().max(60000).superRefine((value,ctx)=>{for(const match of value.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu))if(!safeCmsHref(match[1]!))ctx.addIssue({code:'custom',message:'Rich text contains an unsafe link'});});
export function originalSermonPath(path:string):boolean{const slug=/^\/sermons\/([^/]+)\/$/u.exec(path)?.[1];return Boolean(slug&&canonicalStoredSermonSlug(slug)===slug);}
export const cmsPathSchema=z.string().max(240).refine(path=>/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/u.test(path)||originalSermonPath(path),'Use a lowercase page address with a trailing slash');
const legacyPath=z.string().max(500).refine(v=>v.startsWith('/')&&!v.startsWith('//')&&!/[\\\u0000-\u0020?#]/u.test(v),'Invalid legacy path');
const id=z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/u);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine(v=>{const parsed=new Date(v+'T12:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===v;},'Choose a valid date');
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u);
const bool=z.boolean();
const focalPoint=z.object({x:z.number().min(0).max(100),y:z.number().min(0).max(100)}).strict();
const seoText=(max:number)=>z.string().max(max).refine(value=>!/[<>\u0000-\u001f\u007f]/u.test(value),'Use plain text without HTML');
export const cmsSeoSchema=z.object({title:seoText(240).optional(),description:seoText(1000).optional(),socialTitle:seoText(240).optional(),socialDescription:seoText(1000).optional(),image:z.union([asset,z.literal('')]).optional(),imageAlt:seoText(500).optional(),noindex:bool.optional(),replaceSourceContent:bool.optional()}).strict();
const mediaPlacement={mediaAlt:short.optional(),mediaFocalPoint:focalPoint.optional()};
const source=z.object({id:z.number().int().nonnegative(),link:cmsHrefSchema,status:z.enum(['publish','draft','private']),modified:z.string().max(60)}).strict();
const tile=z.object({...mediaPlacement,title,text:rich.optional(),href:cmsHrefSchema.nullable(),media:z.union([asset,z.literal('')]).optional(),eyebrow:short.optional(),linkLabel:short.optional()}).strict();
const blocks:z.ZodType<unknown>=z.lazy(()=>z.discriminatedUnion('kind',[
 z.object({kind:z.literal('source-content'),nodes:z.array(sourceNodeSchema).max(20000)}).strict(),
 z.object({kind:z.literal('paragraph'),text:rich,lede:bool.optional()}).strict(),
 z.object({kind:z.literal('heading'),level:z.union([z.literal(2),z.literal(3),z.literal(4)]),text:title,id:id.optional()}).strict(),
 z.object({kind:z.literal('list'),ordered:bool.optional(),items:z.array(rich).max(200)}).strict(),
 z.object({kind:z.literal('quote'),text:rich,cite:short.optional()}).strict(),
 z.object({kind:z.literal('figure'),media:asset,caption:rich.optional(),alt:short.optional(),focalPoint:z.object({x:z.number().min(0).max(100),y:z.number().min(0).max(100)}).strict().optional(),size:z.enum(['full','inset','portrait']).optional()}).strict(),
 z.object({kind:z.literal('callout'),title:title.optional(),text:rich}).strict(),
 z.object({kind:z.literal('panel'),title:title.optional(),columns:z.union([z.literal(1),z.literal(2),z.literal(3)]).optional(),blocks:z.array(blocks).max(100)}).strict(),
 z.object({kind:z.literal('tiles'),items:z.array(tile).max(60),columns:z.union([z.literal(2),z.literal(3),z.literal(4)]).optional()}).strict(),
 z.object({kind:z.literal('people'),items:z.array(z.object({...mediaPlacement,name:title,role:short,media:z.union([asset,z.literal('')]).optional(),email:z.union([z.email(),z.literal('')]).optional(),text:z.array(rich).max(50)}).strict()).max(60)}).strict(),
 z.object({kind:z.literal('timeline'),items:z.array(z.object({when:short,title,text:rich}).strict()).max(100)}).strict(),
 z.object({kind:z.literal('next-event'),event:id,label:short}).strict(),
 z.object({kind:z.literal('video'),videoId:z.string().regex(/^[A-Za-z0-9_-]{11}$/u),title}).strict(),
 z.object({kind:z.literal('playlist'),listId:z.string().regex(/^[A-Za-z0-9_-]{10,100}$/u),title}).strict(),
 z.object({kind:z.literal('downloads'),items:z.array(z.object({title,text:rich,href:cmsHrefSchema,label:short}).strict()).max(100)}).strict(),
 z.object({kind:z.literal('hymns'),items:z.array(z.object({title,text:rich,href:cmsHrefSchema}).strict()).max(100)}).strict(),
 z.object({kind:z.literal('index'),items:z.array(z.object({href:cmsHrefSchema,title,text:rich}).strict()).max(100)}).strict(),
 z.object({kind:z.literal('sermon-cards'),heading:title,text:rich.optional(),linkLabel:short,limit:z.number().int().min(1).max(24).optional(),order:z.enum(['ASC','DESC']).optional(),sermonIds:z.array(z.uuid()).max(24).optional()}).strict(),
 z.object({kind:z.literal('external-plate'),title,text:rich,href:cmsHrefSchema,label:short}).strict(),
 z.object({kind:z.literal('book'),...mediaPlacement,media:asset,text:rich}).strict(),
 z.object({kind:z.literal('contact-panel'),name:title,addressLines:z.array(short).max(10),telephone:z.object({label:short,href:cmsHrefSchema}).strict(),email:z.email(),map:z.object({label:short,href:cmsHrefSchema}).strict()}).strict(),
 z.object({kind:z.literal('giving-methods'),heading:title.optional(),intro:rich,button:z.object({label:short,href:cmsHrefSchema}).strict(),methods:z.array(z.object({title,text:rich}).strict()).max(20),bank:z.object({title,account:short,lines:z.array(short).max(20)}).strict(),online:z.object({title,links:z.array(z.object({label:short,href:cmsHrefSchema}).strict()).max(20)}).strict()}).strict(),
 z.object({kind:z.literal('events-calendar'),upcomingHeading:short.optional(),regularHeading:short.optional(),pastHeading:short.optional(),subscribeLabel:short.optional(),days:z.number().int().min(1).max(366).optional(),limit:z.number().int().min(1).max(400).optional(),showUpcoming:bool.optional(),showRegular:bool.optional(),showPast:bool.optional()}).strict(),
 z.object({kind:z.literal('blog-list'),heading:title.optional(),limit:z.number().int().min(1).max(100).optional(),order:z.enum(['ASC','DESC']).optional()}).strict(),
 z.object({kind:z.literal('sitemap-list')}).strict(),
 z.object({kind:z.literal('home-arrival'),...mediaPlacement,hero:z.object({nameLine1:short,nameLine2:short,newHere:short,serviceTime:short,address:short,join:short,joinHref:cmsHrefSchema,place:short,moreLabel:short.optional(),moreHref:cmsHrefSchema.optional()}).strict(),media:asset,services:z.object({heading:title,items:z.array(z.object({id,enabled:bool,title,text:rich,href:cmsHrefSchema}).strict()).max(20)}).strict()}).strict(),
 z.object({kind:z.literal('home-welcome'),...mediaPlacement,heading:title,paragraph:rich,pillars:z.array(z.object({id,title,text:rich,href:cmsHrefSchema,readMore:short,enabled:bool}).strict()).max(20),media:asset}).strict(),
 z.object({kind:z.literal('home-about'),heading:title,paragraph:rich,learnMore:short,learnMoreHref:cmsHrefSchema,giving:z.object({heading:title,link:short,href:cmsHrefSchema,quote:rich,attribution:short,enabled:bool}).strict()}).strict(),
 z.object({kind:z.literal('home-sermons'),heading:title,viewAll:short,limit:z.number().int().min(1).max(24),order:z.enum(['ASC','DESC']),sermonIds:z.array(z.uuid()).max(24)}).strict(),
 z.object({kind:z.literal('home-events'),heading:title,viewCalendar:short,viewCalendarHref:cmsHrefSchema,days:z.number().int().min(1).max(366),limit:z.number().int().min(1).max(40)}).strict()
]));
export const cmsPresentationSchema=z.object({background:z.enum(['default','white','soft','ink']).optional(),spacing:z.enum(['compact','normal','roomy']).optional(),alignment:z.enum(['left','center']).optional(),width:z.enum(['full','reading']).optional()}).strict();
export const cmsModuleSchema=z.object({id,enabled:bool,block:blocks,presentation:cmsPresentationSchema.optional()}).strict();
const modules=z.array(cmsModuleSchema).max(250).superRefine((items,ctx)=>{if(new Set(items.map(item=>item.id)).size!==items.length)ctx.addIssue({code:'custom',message:'Section identities must be unique'});});
const menu:z.ZodType<unknown>=z.lazy(()=>z.object({label:title,href:cmsHrefSchema,children:z.array(menu).max(50).optional(),id:id.optional(),sub:bool.optional(),enabled:bool.optional()}).strict());
const menuList=z.array(menu).max(60);
const status=z.enum(['published','draft','private']);
const page=z.object({template:z.literal('source-sermon').optional(),seo:cmsSeoSchema.optional(),id,path:cmsPathSchema,title,heading:title.optional(),status:status.default('draft'),section:z.enum(['home','about','teaching','ministries','events','resources','giving','contact','blog','sermons']),parent:id.optional(),description:z.string().max(1000),legacyPaths:z.array(legacyPath).max(100).default([]),source:source.optional(),eyebrow:short.optional(),lede:rich.optional(),hero:z.object({media:asset,treatment:z.enum(['banner','aside']),enabled:bool.optional(),alt:short.optional(),focalPoint:z.object({x:z.number().min(0).max(100),y:z.number().min(0).max(100)}).strict().optional()}).strict().optional(),modules,asideModules:modules.optional(),related:z.array(id).max(100).optional(),notes:z.array(rich).max(100).optional()}).strict();
const post=z.object({...mediaPlacement,seo:cmsSeoSchema.optional(),id,path:cmsPathSchema,title,date,description:z.string().max(1000),media:z.union([asset,z.literal('')]).optional(),source:source.optional(),modules,status:status.optional(),legacyPaths:z.array(legacyPath).max(100).optional()}).strict();
const settings=z.object({
 primaryMenu:menuList,footerMenu:menuList,
 navigationCopy:z.object({home:short,aboutUs:short,sermons:short,ministries:short,newsEvents:short,contactUs:short,give:short,search:short,sitemap:short}).strict(),
 contactCopy:z.object({heading:short,name:short,addressLine1:short,addressLine2:short,telephone:short,telephoneHref:cmsHrefSchema,email:short,emailAddress:z.email(),directions:short,directionsHref:cmsHrefSchema}).strict(),
 footerServicesCopy:z.object({heading:short,morning:short,evening:short,morningLink:short,eveningLink:short,morningHref:cmsHrefSchema.optional(),eveningHref:cmsHrefSchema.optional()}).strict(),getInvolvedHeading:short,sermonFooterHeading:short,
 bottomBarCopy:z.object({copyright:short,backToTop:short,followUs:short}).strict(),
 socialPlatforms:z.array(z.object({id:z.enum(['facebook','youtube','instagram','podcast']),name:short,href:cmsHrefSchema.nullable(),enabled:bool}).strict()).max(4),
 notice:z.object({text:rich,enabled:bool}).strict(),branding:z.object({logoAsset:asset,footerLogoAsset:asset,faviconAsset:asset,touchIconAsset:asset,logoAlt:short}).strict(),
 headerAction:z.object({enabled:bool,label:short,href:cmsHrefSchema}).strict().optional(),archiveAbout:z.object({enabled:bool,heading:title,text:rich}).strict().optional(),footerExtraMenu:menuList.optional(),
 footerVisibility:z.object({contact:bool,navigation:bool,services:bool,recentSermon:bool,social:bool,archiveLinks:bool}).strict(),siteName:title
}).strict();
const schedule=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('single'),date}).strict(),
 z.object({kind:z.literal('weekly'),weekday:z.number().int().min(0).max(6),from:date,until:date.optional(),exclusions:z.array(date).max(1000).optional()}).strict(),
 z.object({kind:z.literal('monthly-first'),weekday:z.number().int().min(0).max(6),from:date,until:date.optional(),exclusions:z.array(date).max(1000).optional()}).strict()
]).refine(s=>s.kind==='single'||!s.until||s.until>=s.from,'Recurrence end must follow its start');
const event=z.object({...mediaPlacement,seo:cmsSeoSchema.optional(),id,title,path:cmsPathSchema,schedule,start:time,end:time,venue:id,description:z.array(rich).max(100),calendarVisible:bool.optional(),modules:modules.optional(),page:id.optional(),media:z.union([asset,z.literal('')]).optional(),legacyPaths:z.array(legacyPath).max(100),sourceIds:z.array(z.number().int().positive()).max(100),tag:short.optional(),status:status.optional()}).strict();
const venue=z.object({id,name:title,address:short,locality:short,phone:short.optional(),href:cmsHrefSchema.optional(),mapHref:cmsHrefSchema.optional(),legacyPath}).strict();
export const cmsContentSchemas={page,post,home:z.object({seo:cmsSeoSchema.optional(),title,description:z.string().max(1000),modules}).strict(),settings,navigation:z.object({primaryMenu:menuList,footerMenu:menuList}).strict(),event,venue};
export function validateCmsContent(kind:CmsKind,value:unknown):CmsDocument {
 let count=0;
 function bounded(v:unknown,depth:number):void {if(depth>16||++count>20000)throw new ApplicationError(400,'invalid_request','Content is too deeply nested or large');if(v&&typeof v==='object')for(const child of Object.values(v))bounded(child,depth+1);}
 bounded(value,0);
 const parsed=cmsContentSchemas[kind].parse(value) as CmsDocument;
 if(new TextEncoder().encode(JSON.stringify(parsed)).byteLength>1_900_000)throw new ApplicationError(400,'content_too_large','Split this content into smaller pages or sections');
 const path=pathForContent(kind,parsed);if(path!==null)assertCmsRoutePath(kind,path,parsed.template==='source-sermon');
 const preservedEventLegacy:Record<string,string>={'sunday-evening-service':'/series/sunday-evening-service/','tuesday-bible-study':'/series/tuesday-bible-study/','mens-theological-study':'/series/mens-theological-study/','womans-study':'/series/womans-study/','mens-study':'/series/mens-leadership-study/'};
 for(const legacy of Array.isArray(parsed.legacyPaths)?parsed.legacyPaths:[])if(typeof legacy==='string'&&!(kind==='event'&&legacy===preservedEventLegacy[String(parsed.id)])&&/^\/(?:api|admin|frontend-preview|draft-preview|cms-preview|cms-editor-frame|__local|cms-assets|media|brand|health|sermons(?:-v[145])?|speakers|series|books)(?:\/|$)/u.test(legacy))throw new ApplicationError(400,'reserved_path','Legacy addresses cannot replace application routes');
 if(parsed.template==='source-sermon'&&(!parsed.source||((parsed.source as Record<string,unknown>).status!=='publish')||!Array.isArray(parsed.modules)||parsed.modules.some((module:unknown)=>(module as {block?:{kind?:string}}).block?.kind!=='source-content')))throw new ApplicationError(400,'invalid_source_content','Original sermon pages use verified original content sections');
 const moduleIds=new Set<string>(),headingIds=new Set<string>();
 const walk=(value:unknown):void=>{if(!value||typeof value!=='object')return;const object=value as Record<string,unknown>;if(object.block&&typeof object.id==='string'){if(moduleIds.has(object.id))throw new ApplicationError(400,'duplicate_module_id','Section identities must be unique across the page');moduleIds.add(object.id);}if(object.kind==='heading'&&typeof object.id==='string'){if(headingIds.has(object.id))throw new ApplicationError(400,'duplicate_heading_id','Heading anchors must be unique across the page');headingIds.add(object.id);}Object.values(object).forEach(walk);};walk(parsed);
 return parsed;
}
export function pathForContent(kind:CmsKind,content:CmsDocument):string|null {return kind==='home'?'/':kind==='page'||kind==='post'||kind==='event'?String(content.path):null;}
export function assertCmsRoutePath(kind:CmsKind,path:string,originalSermon=false):void {
 if(originalSermon&&kind==='page'&&originalSermonPath(path))return;
 cmsPathSchema.parse(path);
 if(path==='/'&&kind!=='home'||/^\/(?:api|admin|frontend-preview|draft-preview|cms-preview|cms-editor-frame|__local|cms-assets|media|brand|health|sermons(?:-v[145])?|speakers|series|books)(?:\/|$)/u.test(path))throw new ApplicationError(400,'reserved_path','This address belongs to an existing application route');
 if(kind==='event'&&!/^\/(?:events\/[a-z0-9-]+|event\/[a-z0-9-]+(?:\/\d{4}-\d{2}-\d{2})?)\/$/u.test(path))throw new ApplicationError(400,'invalid_event_path','Events use an address under /events/');
}
export const cmsCreateSchema=z.object({key:cmsKeySchema,kind:z.enum(cmsKinds),content:z.record(z.string(),z.unknown())}).strict();
export const cmsSaveSchema=z.object({expectedRowVersion:z.number().int().positive(),content:z.record(z.string(),z.unknown())}).strict();
export const cmsRevisionActionSchema=z.object({expectedRowVersion:z.number().int().positive(),revisionId:z.uuid()}).strict();
export const cmsUnpublishSchema=z.object({expectedRowVersion:z.number().int().positive(),disposition:z.enum(['gone','redirect']),targetPath:cmsPathSchema.optional()}).strict().refine(v=>v.disposition==='redirect'?Boolean(v.targetPath):!v.targetPath,'A redirect requires a destination; removal must not include one');

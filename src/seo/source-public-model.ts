import {sourceNodeSchema,sourceStructuredDataSchema} from '../domain/source-content';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {sermonDetailSchema} from '../domain/sermon';

export const sourceOrigin='https://www.savinggrace.org.au';
export const sourceHosts=new Set(['www.savinggrace.org.au','savinggrace.org.au']);
const digestSchema=z.string().regex(/^[a-f0-9]{64}$/u);
export function sha256(value:string|Uint8Array){return createHash('sha256').update(value).digest('hex');}
export function stableJson(value:unknown):string{if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';if(value!==null&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,v])=>JSON.stringify(k)+':'+stableJson(v)).join(',')+'}';return JSON.stringify(value);}
export const sourcePathSchema=z.string().min(1).max(2000).refine(value=>{
 try{const u=new URL(value,sourceOrigin);return value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u0020]/u.test(value)&&u.origin===sourceOrigin&&u.pathname+u.search===value&&(!u.search||([...u.searchParams].length<=10&&[...u.searchParams].every(([key,val])=>/^(?:sermon_series|sermon_speaker|sermon_topics|sermon_book|p|page_id|feed|ical|outlook-ical|related_series|eventDisplay|tribe_events_cat|post_type|paged|tag|shortcode|tribe-bar-date|eventDate|pagename|tribe_organizer|tribe_venue|page|resize|ssl)$/u.test(key)&&/^[a-zA-Z0-9,._-]{1,200}$/u.test(val))))&&!u.hash&&!/^\/(?:admin|api|frontend-preview|draft-preview|cms-preview|cms-editor-frame|related-themes-evaluation|cms-assets)(?:\/|$)/u.test(value);}catch{return false;}
},'Expected a safe source-public pathname');
export const sourcePageSchema=z.object({
 path:sourcePathSchema,kind:z.enum(['sermon','page','post','taxonomy','archive','event','attachment','feed','asset']),
 sourceUrl:z.url().refine(value=>{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&sourceHosts.has(u.hostname)&&!u.username&&!u.password;}),
 sourceId:z.number().int().positive().nullable(),capturedAt:z.iso.datetime(),responseSha256:digestSchema,
 hasOriginalHeading:z.boolean().optional(),
 title:z.string().min(1).max(2000),heading:z.string().min(1).max(2000),description:z.string().max(10000).nullable(),
 socialTitle:z.string().max(2000).optional(),socialType:z.enum(['website','article']).optional(),socialDescription:z.string().max(10000).optional(),socialImageSource:z.string().max(2000).optional(),
 language:z.string().regex(/^[a-z]{2,3}(?:[-_][A-Za-z]{2,4})?$/u).default('en'),indexable:z.boolean(),
 canonicalSource:z.string().max(2000).nullable(),publishedAt:z.iso.datetime({offset:true}).nullable(),modifiedAt:z.iso.datetime({offset:true}).nullable(),
 content:z.array(sourceNodeSchema).max(20000),
 structuredData:sourceStructuredDataSchema.optional(),
 passageTerms:z.array(z.object({name:z.string().min(1),slug:z.string().min(1)}).strict()).default([]),
 links:z.array(z.string().max(2000)).max(20000).default([]),
 mediaReferences:z.array(z.string().max(2000)).max(100).default([]),
 asset:z.object({storageKey:z.string().regex(/^[a-f0-9]{64}\.(?:png|jpg|webp|gif|avif|svg|ico|pdf|doc|docx|xls|xlsx|ppt|pptx|rss|atom|ics)$/u),sha256:digestSchema,contentType:z.string().min(1).max(100),bytes:z.number().int().positive().max(52428800)}).strict().optional(),
 sermon:sermonDetailSchema.nullable(),issues:z.array(z.string().max(300)).max(100).default([])
}).strict().superRefine((value,ctx)=>{
 if(value.structuredData){const data=value.structuredData;if(data.responseSha256!==value.responseSha256||data.primary&&data.primary.path!==value.path||data.breadcrumbs&&data.breadcrumbs.at(-1)?.path!==value.path)ctx.addIssue({code:'custom',message:'Source schema must bind the exact response and primary route'});if(data.primary&&(data.primary.type==='Event'&&value.kind!=='event'||data.primary.type==='BlogPosting'&&value.kind!=='post'))ctx.addIssue({code:'custom',message:'Source schema type must match the primary page'});if(data.primary&&(data.primary.type==='Event'?data.primary.name:data.primary.headline)!==value.heading)ctx.addIssue({code:'custom',message:'Source schema heading must match visible content'});}
 if(new URL(value.sourceUrl).pathname+new URL(value.sourceUrl).search!==value.path||new URL(value.sourceUrl).hash)ctx.addIssue({code:'custom',message:'Source URL must exactly identify its route'});
 if(value.path.includes('?')&&value.kind!=='archive'&&value.kind!=='asset')ctx.addIssue({code:'custom',message:'Only observed archive or verified resource queries are admitted'});
 if((value.kind==='asset')!==Boolean(value.asset))ctx.addIssue({code:'custom',message:'An asset requires verified file metadata'});
 if(value.asset){const types:Record<string,string>={rss:'application/rss+xml',atom:'application/atom+xml',ics:'text/calendar',png:'image/png',jpg:'image/jpeg',webp:'image/webp',gif:'image/gif',avif:'image/avif',svg:'image/svg+xml',ico:'image/x-icon',pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};const ext=value.asset.storageKey.split('.').at(-1)!;if(value.asset.contentType!==types[ext])ctx.addIssue({code:'custom',message:'Asset MIME must match the verified file type'});}
 if(value.asset&&(!value.asset.storageKey.startsWith(value.asset.sha256+'.')||value.responseSha256!==value.asset.sha256))ctx.addIssue({code:'custom',message:'Asset bytes must bind both content address and response'});
 if((value.kind==='sermon')!==Boolean(value.sermon))ctx.addIssue({code:'custom',message:'A source sermon requires the explicit sermon projection'});
 if(value.sermon&&(value.sermon.summary||value.sermon.transcript||value.sermon.questionAnswers.length||value.sermon.reviewState||value.sermon.relatedThemes||value.sermon.reviewWarnings||value.sermon.reviewProvenance||value.sermon.sourcePublic))ctx.addIssue({code:'custom',message:'A source-only version cannot contain generated enrichment or review attribution'});
 if(value.sermon&&value.path!==`/sermons/${value.sermon.slug}/`)ctx.addIssue({code:'custom',message:'Source sermon slug/path mismatch'});
 if(value.issues.length&&value.indexable)ctx.addIssue({code:'custom',message:'Unresolved source extraction cannot be marked indexable'});
});
export type SourcePublicPage=z.infer<typeof sourcePageSchema>;
export const sourceBundleSchema=z.object({format:z.literal('sgbc-source-public-v1'),capturedAt:z.iso.datetime(),inventorySha256:digestSchema,pages:z.array(sourcePageSchema).max(10000),expectedVersions:z.record(z.string(),digestSchema.nullable())}).strict().superRefine((value,ctx)=>{const paths=value.pages.map(p=>p.path);if(new Set(paths).size!==paths.length)ctx.addIssue({code:'custom',message:'Duplicate source route'});if(paths.some(path=>!Object.hasOwn(value.expectedVersions,path)))ctx.addIssue({code:'custom',message:'Every source route requires an expected prior version'});});
export type SourcePublicBundle=z.infer<typeof sourceBundleSchema>;
export const sourceVersionHash=(page:SourcePublicPage)=>sha256(stableJson(page));

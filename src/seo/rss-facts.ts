/** Typed facts extracted offline from a hash-verified original public RSS response. */
import {z} from 'zod';
import {sourceNodeSchema} from '../domain/source-content';
const hash=z.string().regex(/^[a-f0-9]{64}$/u),text=z.string().max(10000);
const path=z.string().min(1).max(2000).refine(value=>{try{const u=new URL(value,'https://www.savinggrace.org.au');return value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u0020]/u.test(value)&&u.origin==='https://www.savinggrace.org.au'&&u.pathname===value&&!u.search&&!u.hash&&!/^\/(?:admin|api|cms-preview|cms-editor-frame|frontend-preview)(?:\/|$)/u.test(value);}catch{return false;}});
const guid=z.string().min(1).max(2000).refine(value=>!/[\u0000-\u0020\u007f<>]/u.test(value)&&(/^[a-z][a-z0-9+.-]*:/iu.test(value)));
const date=z.iso.datetime({offset:true});
export const sourceRssFactsSchema=z.object({
 responseSha256:hash,baselineSiteName:text,kind:z.enum(['posts','sermons','events']),limit:z.number().int().min(1).max(50),
 channel:z.object({title:text,description:text,link:z.url(),language:z.string().max(40),lastBuildDate:date.nullable(),updatePeriod:z.enum(['hourly','daily','weekly','monthly','yearly']).optional(),updateFrequency:z.number().int().positive().max(100).optional(),image:z.object({url:z.url(),title:text,link:z.url(),width:z.number().int().positive().max(1000).optional(),height:z.number().int().positive().max(1000).optional()}).strict().optional()}).strict(),
 items:z.array(z.object({sourceId:z.number().int().positive().nullable(),path,guid,isPermaLink:z.boolean(),title:text,publishedAt:date.nullable(),description:z.array(sourceNodeSchema).max(20000),content:z.array(sourceNodeSchema).max(20000),creator:text.optional(),categories:z.array(text).max(100),eventId:z.string().max(120).optional()}).strict()).max(50),
 legacyGuids:z.record(z.string().regex(/^[1-9][0-9]*$/u),z.object({guid,isPermaLink:z.boolean(),publishedAt:date.nullable().optional(),content:z.array(sourceNodeSchema).max(20000).optional()}).strict()),
 baselineDocuments:z.record(z.string().min(1).max(120),hash),
 eventPaths:z.record(z.string().min(1).max(120),path).optional(),
 excludedBaselineEventIds:z.array(z.string().min(1).max(120)).max(1000)
}).strict().superRefine((value,ctx)=>{if(new Set(value.items.map(item=>item.path)).size!==value.items.length)ctx.addIssue({code:'custom',message:'RSS source entries must identify distinct public paths'});if(value.kind!=='events'&&new Set(value.items.map(item=>item.guid)).size!==value.items.length)ctx.addIssue({code:'custom',message:'Original content RSS identifiers must be unique'});});
export type SourceRssFacts=z.infer<typeof sourceRssFactsSchema>;

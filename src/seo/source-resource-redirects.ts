import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {SqlExecutor} from '../server/repositories/postgres-sermon-repository';
import {sourcePageSchema,sourcePathSchema,sourceVersionHash,sha256,stableJson} from './source-public-model';
const digest=z.string().regex(/^[a-f0-9]{64}$/u);
const resourceQuery=/^(?:\/(?:feed\/)?\?attachment_id=[1-9][0-9]{0,14}(?:\/feed\/)?|\/\?p=[1-9][0-9]{0,14})$/u;
const originalUrl=z.url().refine(value=>{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&['savinggrace.org.au','www.savinggrace.org.au'].includes(u.hostname)&&!u.username&&!u.password&&!u.hash&&!u.port;});
export const resourceRedirectManifestSchema=z.object({format:z.literal('sgbc-original-resource-redirects-v1'),sourceInventorySha256:digest,rows:z.array(z.object({oldPath:z.string().refine(value=>sourcePathSchema.safeParse(value).success||resourceQuery.test(value)),newPath:sourcePathSchema,sourceUrl:originalUrl,sourceDestination:originalUrl,sourceStatus:z.literal(301),sourceRecordSha256:digest,assetSha256:digest}).strict()).max(2000)}).strict().superRefine((value,context)=>{
 const old=new Set(value.rows.map(row=>row.oldPath));
 if(old.size!==value.rows.length)context.addIssue({code:'custom',message:'Repeated original resource URL'});
 for(const row of value.rows){const from=new URL(row.sourceUrl),to=new URL(row.sourceDestination);if(!(row.oldPath.endsWith('/')||resourceQuery.test(row.oldPath))||['/','/sermons/','/events/'].includes(row.oldPath)||row.oldPath===row.newPath||old.has(row.newPath)||from.pathname+from.search!==row.oldPath||to.pathname+to.search!==row.newPath||row.newPath.includes('?'))context.addIssue({code:'custom',message:'Expected exact direct source resource paths'});}
});
const resourceOriginalPathSchema=z.string().refine(value=>sourcePathSchema.safeParse(value).success||resourceQuery.test(value),'Expected an observed original attachment path');
const reason='verified_original_attachment_resource';
const auditAction='seo.original_resource_redirect';
export async function importSourceResourceRedirects(db:SqlExecutor,input:unknown){
 return applyVerifiedResourceRedirects(db,resourceRedirectManifestSchema.parse(input));
}
export async function importSourceResourceManifest(db:SqlExecutor,input:unknown){
 return input!==null&&typeof input==='object'&&'format'in input&&input.format==='sgbc-original-sitemap-image-redirects-v1'?importSourceSitemapImageRedirects(db,input):importSourceResourceRedirects(db,input);
}
const sitemapImageRedirectSchema=z.object({format:z.literal('sgbc-original-sitemap-image-redirects-v1'),sourceInventorySha256:digest,rows:z.array(z.object({oldPath:sourcePathSchema,newPath:sourcePathSchema,sourceParentPath:sourcePathSchema,sourceParentResponseSha256:digest,sourceSitemapResponseSha256:digest,assetSha256:digest}).strict()).max(1000)}).strict();
/** An original image hint may name a resized WordPress attachment. Its current
 * immutable parent version must bind both that exact hint and the verified file.
 * This is a new migration redirect, never a claimed original HTTP 301. */
export async function importSourceSitemapImageRedirects(db:SqlExecutor,input:unknown){
 const manifest=sitemapImageRedirectSchema.parse(input);
 if(new Set(manifest.rows.map(row=>row.oldPath)).size!==manifest.rows.length)throw Error('source_image_redirect_duplicate');
 await db.query('SELECT pg_advisory_xact_lock(181,29)');
 for(const row of manifest.rows){
  const resized=/^(\/wp-content\/uploads\/.+)-([1-9][0-9]{0,4})x([1-9][0-9]{0,4})(\.(?:jpe?g|png|webp))$/iu.exec(row.oldPath);
  if(!resized||row.newPath!==resized[1]!+resized[4]!||row.oldPath.includes('?')||row.newPath.includes('?')||manifest.rows.some(other=>other.oldPath===row.newPath))throw Error('source_image_redirect_identity');
  const parent=(await db.query('SELECT v.payload::text AS payload,v.version_sha256 FROM source_public_routes r JOIN source_public_versions v USING(version_sha256) WHERE r.path=$1 AND NOT r.withdrawn FOR SHARE OF r',[row.sourceParentPath])).rows[0]as{payload:string;version_sha256:string}|undefined;
  if(!parent)throw Error('source_image_redirect_parent_missing');
  const page=sourcePageSchema.parse(JSON.parse(parent.payload));
  if(sourceVersionHash(page)!==parent.version_sha256||page.responseSha256!==row.sourceParentResponseSha256||!page.sourceId||page.issues.length||!page.sitemapImages?.some(image=>{const original=new URL(image.originalUrl);return ['www.savinggrace.org.au','savinggrace.org.au'].includes(original.hostname)&&!original.search&&original.pathname===row.oldPath&&image.path===row.newPath&&image.sha256===row.assetSha256&&image.sourceSitemapResponseSha256===row.sourceSitemapResponseSha256;}))throw Error('source_image_redirect_provenance');
 }
 return applyVerifiedResourceRedirects(db,manifest);
}
async function applyVerifiedResourceRedirects(db:SqlExecutor,manifest:{sourceInventorySha256:string;rows:readonly{oldPath:string;newPath:string;assetSha256:string;sourceUrl?:string}[]}){
 const manifestSha256=sha256(stableJson(manifest));
 await db.query("SET LOCAL savinggrace.application_request='on'");await db.query('SELECT pg_advisory_xact_lock(181,29)');
 const result={manifestSha256,inserted:0,unchanged:0,held:[] as Array<{urlSha256:string;reason:string}>};
 for(const row of manifest.rows){
  const hold=(reason:string)=>result.held.push({urlSha256:sha256(row.sourceUrl??'https://www.savinggrace.org.au'+row.oldPath),reason});
  const target=(await db.query(`SELECT v.payload::text AS payload,v.version_sha256 FROM source_public_routes r JOIN source_public_versions v USING(version_sha256) WHERE r.path=$1 AND NOT r.withdrawn FOR SHARE OF r`,[row.newPath])).rows[0] as {payload:unknown;version_sha256:string}|undefined;
  if(!target){hold('verified_destination_unavailable');continue;}
  const page=sourcePageSchema.parse(typeof target.payload==='string'?JSON.parse(target.payload):target.payload);
  if(sourceVersionHash(page)!==target.version_sha256||page.kind!=='asset'||page.issues.length||page.asset?.sha256!==row.assetSha256){hold('destination_evidence_stale');continue;}
  const conflicting=(await db.query(`SELECT 1 FROM redirects WHERE old_path=$1 UNION ALL SELECT 1 FROM cms_routes WHERE path=$2 UNION ALL SELECT 1 FROM sermons WHERE '/sermons/'||slug||'/'=$2 UNION ALL SELECT 1 FROM source_public_routes r JOIN source_public_versions v USING(version_sha256) WHERE r.path=$2 AND (r.withdrawn OR v.payload->>'kind'<>'asset' OR v.payload->'asset'->>'sha256'<>$3) LIMIT 1`,[row.newPath,row.oldPath,row.assetSha256])).rowCount;
  if(conflicting){hold('existing_editorial_ownership_or_intermediate_destination');continue;}
  const existing=(await db.query('SELECT id,new_path,status_code FROM redirects WHERE old_path=$1 FOR UPDATE',[row.oldPath])).rows[0] as {id:string;new_path:string;status_code:number}|undefined;
  if(existing){if(existing.new_path===row.newPath&&existing.status_code===301)result.unchanged++;else hold('existing_url_disposition_preserved');continue;}
  const id=randomUUID();await db.query('INSERT INTO redirects(id,old_path,new_path,status_code,reason,verified_at) VALUES($1,$2,$3,301,$4,now())',[id,row.oldPath,row.newPath,reason]);
  await db.query(`INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id) VALUES('source-public-migration','system',$1,'redirect',$2,$3::jsonb,$4)`,[auditAction,id,JSON.stringify(['old_path','new_path','status_code','assetSha256:'+row.assetSha256,'newPath:'+row.newPath]),'d182-resource-redirects:'+manifestSha256]);result.inserted++;
 }
 return result;
}
/** Only a current verified owned binary is a destination; native sermon gates stay separate. */
export async function readSourceResourceRedirects(db:SqlExecutor):Promise<ReadonlyMap<string,string>>{
 const rows=(await db.query(`SELECT d.old_path,d.new_path,v.payload::text AS payload,v.version_sha256 FROM redirects d JOIN source_public_routes r ON r.path=d.new_path JOIN source_public_versions v USING(version_sha256) WHERE d.status_code=301 AND d.reason=$1 AND d.source_sermon_id IS NULL AND d.verified_at IS NOT NULL AND NOT r.withdrawn AND v.payload->>'kind'='asset' AND NOT EXISTS(SELECT 1 FROM redirects next WHERE next.old_path=d.new_path) AND NOT EXISTS(SELECT 1 FROM cms_routes WHERE path=d.old_path) AND EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_id=d.id AND a.entity_type='redirect' AND a.actor_role='system' AND a.action=$2 AND a.outcome='succeeded' AND a.changed_fields @> jsonb_build_array('assetSha256:'||(v.payload->'asset'->>'sha256'),'newPath:'||d.new_path)) ORDER BY d.old_path LIMIT 2001`,[reason,auditAction])).rows as Array<{old_path:string;new_path:string;payload:unknown;version_sha256:string}>;
 if(rows.length>2000)throw Error('source_resource_redirect_limit');const result=new Map<string,string>();
 for(const row of rows){const page=sourcePageSchema.parse(typeof row.payload==='string'?JSON.parse(row.payload):row.payload);resourceOriginalPathSchema.parse(row.old_path);sourcePathSchema.parse(row.new_path);if(sourceVersionHash(page)!==row.version_sha256||page.kind!=='asset'||page.path!==row.new_path||page.issues.length||row.old_path===row.new_path||row.new_path.includes('?'))throw Error('source_resource_redirect_integrity');result.set(row.old_path,row.new_path);}
 return result;
}

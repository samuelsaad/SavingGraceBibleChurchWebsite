/** Historical accepted pilots retain their stored identities; only verified public routing is reconciled. */
import{PostgresSermonRepository,type SqlExecutor}from'../server/repositories/postgres-sermon-repository';import type{PublicSermonPathDisposition}from'../server/repositories/sermon-repository';
import type{SourcePublicPage}from'./source-public-model';import{sha256}from'./source-public-model';import type{PublicEditorialSermon}from'./composite-sermon-repository';
export interface OriginalNativeIdentity{nativeId:string;legacySourceId:string;originalSourceId:string;originalPath:string;mediaIdentitySha256:string}
export const originalNativeIdentities:readonly OriginalNativeIdentity[]=[
 {nativeId:'01fb553d-80bc-5773-a59a-5b06ef20496e',legacySourceId:'990102',originalSourceId:'29074',originalPath:'/sermons/the-best-christmas-present/',mediaIdentitySha256:'8edf1d290ba82dbb158e7933c6fe38992b50b2f83ea233cf17f4f1a430a9d746'},
 {nativeId:'c94b8a59-95d5-532a-a628-0485aeb906b7',legacySourceId:'990103',originalSourceId:'29092',originalPath:'/sermons/god-hates-divorce/',mediaIdentitySha256:'eb00e47c8c937ce9887f5b8c9945c8ce67d8877e67c33d8184213c363cc8a92a'},
 {nativeId:'f4f8d9da-c736-5320-a576-1a036f779b8c',legacySourceId:'990101',originalSourceId:'30118',originalPath:'/sermons/jesus-is-calling-you/',mediaIdentitySha256:'193ee534f6f2684562132067112d5a1e4b8cf362623c4189bdecd961ff99713e'}
];
export function originalStoredSourceId(nativeId:string,storedId:string|null,bindings:readonly OriginalNativeIdentity[]=originalNativeIdentities):string|null{
 const binding=bindings.find(b=>b.nativeId===nativeId);if(!binding)return storedId;if(storedId!==binding.legacySourceId&&storedId!==binding.originalSourceId)throw Error('original_pilot_identity_binding_changed');return binding.originalSourceId;
}
export function originalEditorialIdentity(pages:readonly SourcePublicPage[],item:PublicEditorialSermon,bindings:readonly OriginalNativeIdentity[]=originalNativeIdentities):string|null{
 const binding=bindings.find(b=>b.nativeId===item.detail.id);if(!binding)return item.sourceWordpressId;originalStoredSourceId(item.detail.id,item.sourceWordpressId,bindings);
 const sameMedia=(m:{provider:string;externalId:string|null})=>typeof m.externalId==='string'&&sha256(m.provider+':'+m.externalId)===binding.mediaIdentitySha256;
 const matches=pages.filter(page=>page.kind==='sermon'&&String(page.sourceId)===binding.originalSourceId&&page.path===binding.originalPath&&!page.issues.length&&page.sermon?.media.some(sameMedia));
 if(matches.length!==1||String(matches[0]!.sourceId)!==binding.originalSourceId||matches[0]!.path!==binding.originalPath)throw Error('original_pilot_identity_binding_changed');
 return binding.originalSourceId;
}

/** The frozen correspondence survives approved native media edits and withdrawals.
 * These are identity projections, never stored-ID edits or approval decisions. */
export function originalNativeSourceIdSql(alias:string,bindings:readonly OriginalNativeIdentity[]=originalNativeIdentities):string{
 if(!/^[a-z][a-z0-9_]*$/u.test(alias)||bindings.length>3||bindings.some(b=>!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(b.nativeId)&&/^[1-9][0-9]*$/u.test(b.legacySourceId)&&/^[1-9][0-9]*$/u.test(b.originalSourceId))))throw Error('original_pilot_sql_binding');
 return bindings.length?'(CASE '+bindings.map(b=>`WHEN ${alias}.id='${b.nativeId}'::uuid AND ${alias}.source_wordpress_id=${b.legacySourceId} THEN ${b.originalSourceId}`).join(' ')+` ELSE ${alias}.source_wordpress_id END)`:`${alias}.source_wordpress_id`;
}
export const originalNativeStatesSql=`SELECT id::text,source_wordpress_id::text,slug,status,deleted_at IS NOT NULL AS deleted FROM sermons WHERE id=ANY($1::uuid[]) ORDER BY id`;
export interface OriginalNativeWithdrawal{nativeId:string;originalSourceId:string;originalPath:string;nativePath:string;disposition:NonNullable<PublicSermonPathDisposition>}
export async function readOriginalNativeWithdrawals(database:SqlExecutor,bindings:readonly OriginalNativeIdentity[]=originalNativeIdentities):Promise<OriginalNativeWithdrawal[]>{
 originalNativeSourceIdSql('s',bindings);if(!bindings.length)return[];
 const rows=(await database.query(originalNativeStatesSql,[bindings.map(b=>b.nativeId)])).rows,output:OriginalNativeWithdrawal[]=[],repository=new PostgresSermonRepository(database,'public');
 for(const row of rows){const binding=bindings.find(b=>b.nativeId===row.id);if(!binding||![binding.legacySourceId,binding.originalSourceId].includes(String(row.source_wordpress_id))||typeof row.slug!=='string'||typeof row.status!=='string'||typeof row.deleted!=='boolean')throw Error('original_pilot_identity_binding_changed');if(!row.deleted&&!['unpublished','archived'].includes(row.status))continue;const nativePath='/sermons/'+row.slug+'/';output.push({nativeId:binding.nativeId,originalSourceId:binding.originalSourceId,originalPath:binding.originalPath,nativePath,disposition:await repository.findPublicPathDisposition(nativePath)??{kind:'gone'}});}
 return output;
}

/** Historical accepted pilots retain their stored identities; only verified public routing is reconciled. */
import type{SourcePublicPage}from'./source-public-model';import{sha256}from'./source-public-model';import type{PublicEditorialSermon}from'./composite-sermon-repository';
export interface OriginalNativeIdentity{nativeId:string;legacySourceId:string;originalSourceId:string;originalPath:string;mediaIdentitySha256:string}
export const originalNativeIdentities:readonly OriginalNativeIdentity[]=[
 {nativeId:'01fb553d-80bc-5773-a59a-5b06ef20496e',legacySourceId:'990102',originalSourceId:'29074',originalPath:'/sermons/the-best-christmas-present/',mediaIdentitySha256:'8edf1d290ba82dbb158e7933c6fe38992b50b2f83ea233cf17f4f1a430a9d746'},
 {nativeId:'c94b8a59-95d5-532a-a628-0485aeb906b7',legacySourceId:'990103',originalSourceId:'29092',originalPath:'/sermons/god-hates-divorce/',mediaIdentitySha256:'eb00e47c8c937ce9887f5b8c9945c8ce67d8877e67c33d8184213c363cc8a92a'},
 {nativeId:'f4f8d9da-c736-5320-a576-1a036f779b8c',legacySourceId:'990101',originalSourceId:'30118',originalPath:'/sermons/jesus-is-calling-you/',mediaIdentitySha256:'193ee534f6f2684562132067112d5a1e4b8cf362623c4189bdecd961ff99713e'}
];
export function originalEditorialIdentity(pages:readonly SourcePublicPage[],item:PublicEditorialSermon,bindings:readonly OriginalNativeIdentity[]=originalNativeIdentities):string|null{
 const binding=bindings.find(b=>b.nativeId===item.detail.id&&b.legacySourceId===item.sourceWordpressId);if(!binding)return item.sourceWordpressId;
 const sameMedia=(m:{provider:string;externalId:string|null})=>typeof m.externalId==='string'&&sha256(m.provider+':'+m.externalId)===binding.mediaIdentitySha256;
 const matches=pages.filter(page=>page.kind==='sermon'&&!page.issues.length&&page.sermon?.media.some(sameMedia));
 if(matches.length!==1||String(matches[0]!.sourceId)!==binding.originalSourceId||matches[0]!.path!==binding.originalPath||!item.detail.media.some(sameMedia))throw Error('original_pilot_identity_binding_changed');
 return binding.originalSourceId;
}

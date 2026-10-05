import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {canonicalSermonAudioUrl,sermonAudioIdPattern} from '../domain/sermonaudio';
import {PostgresAdminSermonTransaction} from '../server/repositories/postgres-admin-sermon-repository';
import {canonicalReviewJson} from '../domain/delegated-ai-review';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const sermonAudioLinkSchema=z.object({sermonId:z.uuid(),sourceWordPressId:z.number().int().positive(),expectedVersion:z.number().int().positive(),
 sermonAudioId:z.string().regex(sermonAudioIdPattern),sourceSha256:z.string().regex(/^[a-f0-9]{64}$/u),planSha256:z.string().regex(/^[a-f0-9]{64}$/u),
 evidence:z.array(z.string().regex(/^[a-z_]+$/u)).min(2),mediaBeforeSha256:z.string().regex(/^[a-f0-9]{64}$/u)}).strict();
export type SermonAudioLink=z.infer<typeof sermonAudioLinkSchema>;
/** JSONB and driver rows differ in object key order and Date representation.
 * Canonicalize values, never omit a field or reorder the media sequence. */
export const mediaSnapshotHash=(rows:unknown)=>hash(canonicalReviewJson(JSON.parse(JSON.stringify(rows))));
/** Same transactional/audited primitives as metadata repairs, with an extra
 * media-freshness guard. This task must not silently stale immutable review or
 * restricted acceptance dependencies. Such links remain private proposals. */
export async function applyVerifiedSermonAudioLink(client:PoolClient,raw:unknown){
 const p=sermonAudioLinkSchema.parse(raw);
 const row=(await client.query('SELECT source_wordpress_id,row_version,status,deleted_at FROM sermons WHERE id=$1 FOR UPDATE',[p.sermonId])).rows[0];
 if(!row||Number(row.source_wordpress_id)!==p.sourceWordPressId)return{outcome:'conflicting' as const,reason:'source_identity_changed'};
 const media=(await client.query('SELECT to_jsonb(m) row FROM sermon_media m WHERE sermon_id=$1 ORDER BY display_order,id FOR UPDATE',[p.sermonId])).rows.map(r=>r.row);
 const canonical=canonicalSermonAudioUrl(p.sermonAudioId)!;
 const audio=media.filter(m=>m.provider==='sermonaudio');
 if(audio.length){if(audio.length===1&&audio[0].external_id===p.sermonAudioId&&audio[0].canonical_url===canonical)return{outcome:'unchanged' as const,reason:'already_correct'};
 return{outcome:'conflicting' as const,reason:'existing_audio_mapping_differs'};}
 if(row.row_version!==p.expectedVersion||mediaSnapshotHash(media)!==p.mediaBeforeSha256)return{outcome:'conflicting' as const,reason:'concurrent_metadata_change'};
 if(row.deleted_at||row.status==='archived')return{outcome:'pending' as const,reason:'record_status_prohibits_update'};
 const review=(await client.query(`SELECT
 EXISTS(SELECT 1 FROM sermon_enrichment_reviews WHERE sermon_id=$1 AND completed_at IS NOT NULL) human_completed,
 EXISTS(SELECT 1 FROM sermon_ai_component_reviews WHERE sermon_id=$1 AND component IN('media','completion') AND outcome IN('accepted','accepted_source_limitation')) reviewed_dependency`,[p.sermonId])).rows[0];
 const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename ~ '^sermon_([a-z0-9]+_)?restricted_acceptances$' ORDER BY tablename")).rows;
 let acceptance=false;for(const t of tables){if(!/^sermon_([a-z0-9]+_)?restricted_acceptances$/u.test(t.tablename))throw Error('sermonaudio_table_refused');
 if((await client.query(`SELECT 1 FROM "${t.tablename}" WHERE sermon_id=$1 LIMIT 1`,[p.sermonId])).rows.length)acceptance=true;}
 if(acceptance||review?.human_completed||review?.reviewed_dependency)return{outcome:'pending' as const,reason:'immutable_media_review_dependency'};
 return insertVerifiedSermonAudioLink(client,p,media);
}
/** Internal persistence primitive. Callers must lock and validate the source,
 * media, version and review dependencies in the same transaction first. */
export async function insertVerifiedSermonAudioLink(client:PoolClient,p:SermonAudioLink,media:Record<string,any>[]){
 const canonical=canonicalSermonAudioUrl(p.sermonAudioId)!;
 const original=JSON.stringify({policy:'source-identity-and-official-recording-v1',sourceSha256:p.sourceSha256,planSha256:p.planSha256,evidence:p.evidence,previousMedia:media});
 const inserted=(await client.query(`INSERT INTO sermon_media(sermon_id,media_type,provider,external_id,source_url,canonical_url,title,is_primary,display_order,availability_status)
 VALUES($1,'audio','sermonaudio',$2,$3,$3,'Sermon audio',false,$4,'available') RETURNING id`,[p.sermonId,p.sermonAudioId,canonical,Math.max(-1,...media.map(m=>m.display_order))+1])).rows[0];
 await client.query('INSERT INTO sermon_media_source_audit(sermon_media_id,source_meta_key,original_value,source_value_sha256) VALUES($1,$2,$3,$4)',[inserted.id,'verified_sermonaudio_link',original,hash(original)]);
 await client.query('UPDATE sermons SET row_version=row_version+1,updated_at=now(),updated_by_subject=$2 WHERE id=$1 AND row_version=$3',[p.sermonId,'requested-sermonaudio-media-link',p.expectedVersion]);
 await new PostgresAdminSermonTransaction(client).appendAudit({actorSubject:'requested-sermonaudio-media-link',actorRole:'system',action:'sermon.verified_audio_link_added',entityType:'sermon',entityId:p.sermonId,outcome:'succeeded',changedFields:['sermon_media'],requestCorrelationId:p.planSha256});
 return{outcome:'linked' as const,reason:'verified_media_added',mediaId:inserted.id};
}

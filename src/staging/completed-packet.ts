import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalReviewJson} from '../domain/delegated-ai-review';
import {completedMembershipSha256,currentCompletedEligibilitySql,validateCompletedIds} from '../domain/completed-staging';
import {databaseFingerprint} from './database-verification';

export type TransferRow=Record<string,unknown>;
export const completedTables=[
 'media_assets','speakers','series','bible_books','book_classifications','source_taxonomy_terms','sermons',
 'sermon_enrichment_sources','sermon_transcripts','sermon_transcript_legacy_grounding_bindings','sermon_media',
 'sermon_primary_passage_reviews','scripture_references','scripture_reference_sources','sermon_question_answers',
 'sermon_enrichment_draft_imports','sermon_enrichment_reviews','sermon_enrichment_review_items','sermon_extensions',
 'sermon_legacy_metrics','sermon_resources','sermon_series_map','sermon_book_classifications','sermon_source_terms',
 'delegated_ai_review_scopes','remaining_ai_review_scopes','delegated_ai_review_members','remaining_ai_review_members',
 'sermon_ai_content_reviews','sermon_ai_metadata_assignments','sermon_ai_component_reviews',
 'd169_review_member_bindings','d169_generation_correction_evidence',
 'sermon_restricted_acceptances','sermon_d161_restricted_acceptances','sermon_d162_restricted_acceptances',
 'sermon_d167_restricted_acceptances','sermon_d168_restricted_acceptances','sermon_d169_restricted_acceptances',
 'sermon_restricted_acceptance_withdrawals','sermon_d161_restricted_acceptance_withdrawals',
 'sermon_d162_restricted_acceptance_withdrawals','sermon_d167_restricted_acceptance_withdrawals',
 'sermon_d168_restricted_acceptance_withdrawals','sermon_d169_restricted_acceptance_withdrawals',
 'sermon_media_source_audit','audit_events'
] as const;
export type TransferTable=typeof completedTables[number];
export const sharedTables=new Set<string>(['media_assets','speakers','series','bible_books','book_classifications','source_taxonomy_terms','delegated_ai_review_scopes','remaining_ai_review_scopes']);
export type TransferPacket={version:1;decision:'D-171';membershipSha256:string;ids:string[];sourceFingerprint:string;tables:Record<TransferTable,{keys:string[];rows:TransferRow[]}>;sha256:string};
export const digest=(v:unknown)=>createHash('sha256').update(canonicalReviewJson(v)).digest('hex');
export const quoted=(s:string)=>{if(!/^[a-z][a-z0-9_]*$/u.test(s))throw Error('d171_identifier_refused');return '"'+s+'"';};
export const packetHash=(p:TransferPacket)=>digest({...p,sha256:''});
export const frozenSourcePacketSha256='744b1c1f7fa5e8640e93fb31799b2a3f928f250743f8cde826e41735150a9db1';
export async function primaryKeys(c:Pick<PoolClient,'query'>,table:string):Promise<string[]>{
 const rows=(await c.query("SELECT a.attname name FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey) WHERE i.indrelid=('public.'||$1)::regclass AND i.indisprimary ORDER BY array_position(i.indkey,a.attnum)",[table])).rows;
 if(!rows.length)throw Error('d171_primary_key_missing');return rows.map(r=>String(r.name));
}
export function completedClause(t:TransferTable){
 if(t==='sermons')return 'id=ANY($1::uuid[])';
 if(t==='speakers')return 'id IN(SELECT speaker_id FROM sermons WHERE id=ANY($1::uuid[])) OR source_term_id IN(SELECT sp.source_term_id FROM sermons s JOIN speakers sp ON sp.id=s.speaker_id WHERE s.id=ANY($1::uuid[]))';
 if(t==='series')return 'id IN(SELECT series_id FROM sermon_series_map WHERE sermon_id=ANY($1::uuid[]))';
 if(t==='bible_books')return 'id IN(SELECT canonical_book_id FROM scripture_references WHERE sermon_id=ANY($1::uuid[]) UNION SELECT canonical_book_id FROM book_classifications WHERE id IN(SELECT book_classification_id FROM sermon_book_classifications WHERE sermon_id=ANY($1::uuid[])))';
 if(t==='book_classifications')return 'id IN(SELECT book_classification_id FROM sermon_book_classifications WHERE sermon_id=ANY($1::uuid[]))';
 if(t==='source_taxonomy_terms')return 'id IN(SELECT source_taxonomy_term_id FROM sermon_source_terms WHERE sermon_id=ANY($1::uuid[]))';
 if(t==='media_assets')return 'id IN(SELECT featured_asset_id FROM sermons WHERE id=ANY($1::uuid[]) UNION SELECT thumbnail_asset_id FROM sermon_media WHERE sermon_id=ANY($1::uuid[]) UNION SELECT asset_id FROM sermon_resources WHERE sermon_id=ANY($1::uuid[]) UNION SELECT image_asset_id FROM speakers WHERE id IN(SELECT speaker_id FROM sermons WHERE id=ANY($1::uuid[])) UNION SELECT image_asset_id FROM series WHERE id IN(SELECT series_id FROM sermon_series_map WHERE sermon_id=ANY($1::uuid[])))';
 if(t.endsWith('_scopes'))return "id IN(SELECT scope_id FROM "+(t.startsWith('delegated')?'delegated':'remaining')+"_ai_review_members WHERE sermon_id=ANY($1::uuid[])) OR id='"+(t.startsWith('delegated')?'D-156':'D-157')+"'";
 if(t==='sermon_media_source_audit')return 'sermon_media_id IN(SELECT id FROM sermon_media WHERE sermon_id=ANY($1::uuid[]))';
 // Only immutable system events needed by the existing media acceptance guard;
 // administrator audit history, accounts and sessions are never exported.
 if(t==='audit_events')return "entity_type='sermon' AND entity_id=ANY($1::uuid[]) AND actor_role='system' AND action IN('sermon.sermonaudio_media_review','sermon.sermonaudio_acceptance_refresh')";
 return 'sermon_id=ANY($1::uuid[])';
}
export async function currentCompletedIds(c:Pick<PoolClient,'query'>){return (await c.query('SELECT s.id FROM sermons s WHERE '+currentCompletedEligibilitySql('s')+' ORDER BY s.id')).rows.map(r=>String(r.id));}
export function validateCompletedPacket(raw:unknown):TransferPacket{
 const p=raw as TransferPacket;
 if(!p||p.version!==1||p.decision!=='D-171'||p.membershipSha256!==completedMembershipSha256||!p.tables||p.sha256!==packetHash(p))throw Error('d171_packet_invalid');
 const ids=new Set(validateCompletedIds(p.ids));
 if(Object.keys(p.tables).sort().join()!==[...completedTables].sort().join())throw Error('d171_table_scope_invalid');
 const media=new Set(p.tables.sermon_media.rows.map(r=>r.id));
 for(const table of completedTables){const data=p.tables[table];if(!Array.isArray(data.rows)||!data.keys.length||data.keys.some(k=>!/^[a-z][a-z0-9_]*$/u.test(k)))throw Error('d171_table_invalid');const seen=new Set<string>();
  for(const row of data.rows){if(Object.keys(row).some(k=>!/^[a-z][a-z0-9_]*$/u.test(k))||data.keys.some(k=>row[k]===undefined||row[k]===null))throw Error('d171_row_invalid');const key=digest(data.keys.map(k=>row[k]));if(seen.has(key))throw Error('d171_duplicate_key');seen.add(key);
   if(table==='sermons'?!ids.has(String(row.id)):!sharedTables.has(table)&&table!=='audit_events'&&table!=='sermon_media_source_audit'&&!ids.has(String(row.sermon_id)))throw Error('d171_row_scope_invalid');
   if(table==='audit_events'&&(row.actor_role!=='system'||row.entity_type!=='sermon'||!ids.has(String(row.entity_id))||!['sermon.sermonaudio_media_review','sermon.sermonaudio_acceptance_refresh'].includes(String(row.action))))throw Error('d171_audit_scope_invalid');
   if(table==='sermon_media_source_audit'&&!media.has(row.sermon_media_id))throw Error('d171_media_scope_invalid');
  }
 }
 validateCompletedIds(p.tables.sermons.rows.map(r=>r.id));
 if(p.sha256!==frozenSourcePacketSha256)throw Error('d171_frozen_packet_mismatch');
 return p;
}
export async function captureCompletedPacket(c:PoolClient):Promise<TransferPacket>{
 const ids=validateCompletedIds(await currentCompletedIds(c));
 const p:TransferPacket={version:1,decision:'D-171',membershipSha256:completedMembershipSha256,ids,sourceFingerprint:(await databaseFingerprint(c)).sha256,tables:{} as TransferPacket['tables'],sha256:''};
 for(const t of completedTables){const keys=await primaryKeys(c,t);p.tables[t]={keys,rows:(await c.query('SELECT to_jsonb(t) row FROM '+quoted(t)+' t WHERE '+completedClause(t)+' ORDER BY '+keys.map(quoted).join(','),[ids])).rows.map(r=>r.row)};}
 p.sha256=packetHash(p);return validateCompletedPacket(p);
}

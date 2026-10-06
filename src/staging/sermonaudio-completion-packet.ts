import type {PoolClient} from 'pg';
import {deterministicSourceUuid} from '../migration/identity';
import {assertD175SourceMembership,d175ManifestSha256,d175SourceMembershipSha256,d175SourceNamespace,d175ReviewNamespace,d175AcceptanceNamespace,d175Actor,d175AcceptanceAction,d175AcceptanceSql} from '../domain/sermonaudio-completion';
import {completedClause,digest,quoted,primaryKeys,type TransferRow,type TransferTable} from './completed-packet';
import {databaseFingerprint} from './database-verification';

// Put the already-pending guided row between source and transcript insertion.
// Its source FK exists, while transcript seeding then sees the exact row. Never
// delete a trigger-created review or overwrite an administrator decision.
export const sermonAudioCompletionTables=[
 'media_assets','speakers','series','bible_books','book_classifications','sermons',
 'sermon_enrichment_sources','sermon_enrichment_reviews','sermon_transcripts',
 'sermon_media','scripture_references','sermon_question_answers',
 'sermon_enrichment_draft_imports','sermon_extensions','sermon_series_map',
 'sermon_book_classifications','audit_events'
] as const satisfies readonly TransferTable[];
export type SermonAudioCompletionTable=typeof sermonAudioCompletionTables[number];
const shared=new Set<string>(['media_assets','speakers','series','bible_books','book_classifications']);
export const d175TransferAuditActions=['sermon.enrichment_draft_imported','sermon.d175_source_import','sermon.d175_ai_review',d175AcceptanceAction] as const;
export type SermonAudioCompletionPacket={
 version:1;decision:'D-175';manifestSha256:string;sourceMembershipSha256:string;
 frozenSourceIds:number[];ids:string[];sourceFingerprint:string;
 tables:Record<SermonAudioCompletionTable,{keys:string[];rows:TransferRow[]}>;sha256:string;
};
export function sermonAudioCompletionPacketHash(p:SermonAudioCompletionPacket){return digest({...p,sha256:''});}
function fail(code:string):never{throw Error('d175_transfer_'+code);}
export function validateSermonAudioTransferRows(t:SermonAudioCompletionTable,rows:TransferRow[],keys:string[],members:ReadonlyMap<string,number>){
 if(!Array.isArray(rows)||!keys.length||keys.some(k=>!/^[a-z][a-z0-9_]*$/u.test(k)))fail('table_invalid');
 const seen=new Set<string>();
 for(const r of rows){
  if(!r||Object.keys(r).some(k=>!/^[a-z][a-z0-9_]*$/u.test(k))||keys.some(k=>r[k]===undefined||r[k]===null))fail('row_invalid');
  const key=digest(keys.map(k=>r[k]));if(seen.has(key))fail('duplicate_key');seen.add(key);
  if(shared.has(t))continue;
  const id=String(t==='sermons'?r.id:t==='audit_events'?r.entity_id:r.sermon_id);
  if(!members.has(id))fail('record_out_of_scope');
  if(t==='sermons'&&(Number(r.source_wordpress_id)!==members.get(id)||r.status!=='draft'||r.published_at!==null||r.scheduled_for!==null||r.deleted_at!==null||r.summary_status!=='draft'||r.summary_approved_at!==null||r.summary_reviewed_at!==null))fail('private_status_required');
  if((t==='sermon_transcripts'||t==='sermon_question_answers')&&(r.status!=='draft'||r.approved_at!==null||r.reviewed_at!==null||r.approved_by_subject!==null||r.reviewed_by_subject!==null))fail('human_content_authority_excluded');
  if(t==='sermon_enrichment_reviews'&&(r.identity_status!=='pending'||r.completed_at!==null||r.completed_by_subject!==null||r.updated_by_subject!==null))fail('human_progress_excluded');
  if(t==='sermon_extensions'&&![d175SourceNamespace,d175ReviewNamespace,d175AcceptanceNamespace].includes(String(r.namespace)))fail('extension_scope_invalid');
  if(t==='audit_events'&&(r.actor_role!=='system'||r.actor_subject!==d175Actor||r.entity_type!=='sermon'||r.outcome!=='succeeded'||!d175TransferAuditActions.includes(r.action as typeof d175TransferAuditActions[number])))fail('audit_scope_invalid');
 }
}
export function validateSermonAudioCompletionPacket(raw:unknown):SermonAudioCompletionPacket{
 const p=raw as SermonAudioCompletionPacket;
 if(!p||Object.keys(p).sort().join()!==['version','decision','manifestSha256','sourceMembershipSha256','frozenSourceIds','ids','sourceFingerprint','tables','sha256'].sort().join()||p.version!==1||p.decision!=='D-175'||p.manifestSha256!==d175ManifestSha256||p.sourceMembershipSha256!==d175SourceMembershipSha256||!/^[a-f0-9]{64}$/u.test(p.sourceFingerprint)||p.sha256!==sermonAudioCompletionPacketHash(p))fail('packet_invalid');
 assertD175SourceMembership(p.frozenSourceIds);
 if(!Array.isArray(p.ids)||!p.ids.length||p.ids.length>119||new Set(p.ids).size!==p.ids.length||Object.keys(p.tables).sort().join()!==[...sermonAudioCompletionTables].sort().join())fail('membership_invalid');
 const members=new Map(p.frozenSourceIds.map(source=>[deterministicSourceUuid('wordpress-sermon',source),source]));
 if(p.ids.some(id=>!members.has(id)))fail('record_out_of_scope');
 const selected=new Map(p.ids.map(id=>[id,members.get(id)!]));
 for(const t of sermonAudioCompletionTables){const data=p.tables[t];validateSermonAudioTransferRows(t,data.rows,data.keys,selected);}
 if(p.tables.sermons.rows.length!==p.ids.length||digest(p.tables.sermons.rows.map(r=>r.id).sort())!==digest([...p.ids].sort()))fail('sermon_set_mismatch');
 for(const id of p.ids){
  const ext=p.tables.sermon_extensions.rows.filter(r=>r.sermon_id===id);
  if(ext.length!==3||ext.some(r=>r.schema_version!==1))fail('provenance_incomplete');
  for(const namespace of [d175SourceNamespace,d175ReviewNamespace,d175AcceptanceNamespace])if(ext.filter(r=>r.namespace===namespace).length!==1)fail('provenance_incomplete');
  const source=ext.find(r=>r.namespace===d175SourceNamespace)!.payload as Record<string,unknown>;
  if(source.manifestSha256!==d175ManifestSha256||source.sourceMembershipSha256!==d175SourceMembershipSha256||Number(source.sourceWordPressId)!==selected.get(id)||source.broadcaster!=='savinggrace'||source.audioVerified!==false||!['en','ar'].includes(String(source.language)))fail('source_evidence_mismatch');
  const audits=p.tables.audit_events.rows.filter(r=>r.entity_id===id);
  if(audits.length!==4||d175TransferAuditActions.some(a=>audits.filter(r=>r.action===a).length!==1))fail('system_audit_incomplete');
  if(p.tables.sermon_transcripts.rows.filter(r=>r.sermon_id===id).length!==1)fail('transcript_incomplete');
  const qa=p.tables.sermon_question_answers.rows.filter(r=>r.sermon_id===id).sort((a,b)=>Number(a.display_order)-Number(b.display_order));
  if(qa.length<5||qa.length>10||qa.some((r,i)=>Number(r.display_order)!==i+1))fail('question_order_invalid');
  const media=p.tables.sermon_media.rows.filter(r=>r.sermon_id===id);
  if(media.length!==1||media[0]!.provider!=='sermonaudio'||media[0]!.external_id!==source.sermonAudioId)fail('recording_identity_mismatch');
 }
 return p;
}
export async function captureSermonAudioCompletionPacket(c:PoolClient,sourceIds:number[]):Promise<SermonAudioCompletionPacket>{
 assertD175SourceMembership(sourceIds);
 const ids=(await c.query('SELECT s.id FROM sermons s WHERE s.source_wordpress_id=ANY($1::bigint[]) AND '+d175AcceptanceSql('s')+' ORDER BY s.id',[sourceIds])).rows.map(r=>String(r.id));
 if(!ids.length)fail('no_current_acceptances');
 const p:SermonAudioCompletionPacket={version:1,decision:'D-175',manifestSha256:d175ManifestSha256,sourceMembershipSha256:d175SourceMembershipSha256,frozenSourceIds:[...sourceIds],ids,sourceFingerprint:(await databaseFingerprint(c)).sha256,tables:{} as SermonAudioCompletionPacket['tables'],sha256:''};
 for(const t of sermonAudioCompletionTables){
  const keys=await primaryKeys(c,t);
  const clause=t==='audit_events'?"entity_type='sermon' AND entity_id=ANY($1::uuid[]) AND actor_subject='"+d175Actor+"' AND actor_role='system' AND action IN("+d175TransferAuditActions.map(a=>"'"+a+"'").join(',')+")":completedClause(t);
  p.tables[t]={keys,rows:(await c.query('SELECT to_jsonb(t) row FROM '+quoted(t)+' t WHERE '+clause+' ORDER BY '+keys.map(quoted).join(','),[ids])).rows.map(r=>r.row)};
 }
 p.sha256=sermonAudioCompletionPacketHash(p);return validateSermonAudioCompletionPacket(p);
}
/** Only dependencies of this one target. Whole catalogues, accounts, sessions,
 * legacy review scopes and unrelated administrative history are never sent. */
export function sermonAudioTargetRows(p:SermonAudioCompletionPacket,id:string){
 if(!p.ids.includes(id))fail('record_out_of_scope');
 const result=Object.fromEntries(sermonAudioCompletionTables.map(t=>[t,p.tables[t].rows.filter(r=>t==='sermons'?r.id===id:t==='audit_events'?r.entity_id===id:!shared.has(t)&&r.sermon_id===id)])) as Record<SermonAudioCompletionTable,TransferRow[]>;
 const sermon=result.sermons[0]!,speaker=p.tables.speakers.rows.find(r=>r.id===sermon.speaker_id);
 if(!speaker)fail('speaker_dependency_missing');result.speakers=[speaker];
 const seriesIds=new Set(result.sermon_series_map.map(r=>r.series_id));result.series=p.tables.series.rows.filter(r=>seriesIds.has(r.id));
 const classIds=new Set(result.sermon_book_classifications.map(r=>r.book_classification_id));result.book_classifications=p.tables.book_classifications.rows.filter(r=>classIds.has(r.id));
 const bookIds=new Set([...result.scripture_references.map(r=>r.canonical_book_id),...result.book_classifications.map(r=>r.canonical_book_id)]);result.bible_books=p.tables.bible_books.rows.filter(r=>bookIds.has(r.id));
 const assetIds=new Set([sermon.featured_asset_id,speaker.image_asset_id,...result.series.map(r=>r.image_asset_id),...result.sermon_media.map(r=>r.thumbnail_asset_id)]);result.media_assets=p.tables.media_assets.rows.filter(r=>assetIds.has(r.id));
 return result;
}

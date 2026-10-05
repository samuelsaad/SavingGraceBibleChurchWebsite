import {readFile,writeFile} from 'node:fs/promises';
import {validateCompletedPacket,type TransferPacket,type TransferRow} from '../staging/completed-packet';
import {completedMembershipSha256,validateCompletedIds} from '../domain/completed-staging';
import {deriveProjectSnapshotHashes,serializeProjectSnapshot,sha256,snapshotCounts,validateProjectSermonSnapshot,projectSermonSnapshotVersion,type ProjectSermonSnapshot} from './project-sermon-snapshot';

const pick=(r:TransferRow,keys:string)=>Object.fromEntries(keys.split(' ').filter(k=>k in r).map(k=>[k,r[k]]));
/** An explicit display projection, never operational review/account/audit data. */
export function completedDisplayProjection(packet:TransferPacket):ProjectSermonSnapshot{
 validateCompletedPacket(packet);const t=packet.tables;
 const sermons=t.sermons.rows.map(r=>({...pick(r,'id title slug summary body status service_date published_at scheduled_for source_wordpress_id source_status source_created_local source_created_gmt source_modified_local source_modified_gmt created_at updated_at speaker_id historical_backfill_required summary_status summary_source_kind summary_source_reference summary_created_at summary_updated_at summary_reviewed_at summary_approved_at seo_description row_version'),summary_sha256:r.summary===null?null:sha256(String(r.summary))}));
 const transcripts=t.sermon_transcripts.rows.map(r=>({...pick(r,'sermon_id body_text status source_kind source_reference created_at updated_at reviewed_at approved_at grounding_revision_id row_version'),content_sha256:sha256(String(r.body_text))}));
 const questionAnswers=t.sermon_question_answers.rows.map(r=>({...pick(r,'id sermon_id question_text answer_text display_order status source_kind source_reference created_at updated_at reviewed_at approved_at row_version'),content_sha256:sha256(`${r.question_text}\n${r.answer_text}`)}));
 const snapshot:ProjectSermonSnapshot={schemaVersion:projectSermonSnapshotVersion,source:{databaseClass:'local-disposable-postgresql',snapshotIsolation:'repeatable-read-read-only',exportedAt:new Date().toISOString()},tables:{
  sermons,transcripts,questionAnswers,
  speakers:t.speakers.rows.map(r=>pick(r,'id name slug biography source_term_id source_term_taxonomy_id created_at updated_at row_version')),
  series:t.series.rows.map(r=>pick(r,'id name slug description source_term_id source_term_taxonomy_id created_at updated_at row_version')),
  bookClassifications:t.book_classifications.rows.map(r=>pick(r,'id name slug canonical_book_id classification_type review_status source_term_id source_term_taxonomy_id created_at updated_at row_version')),
  sourceTaxonomyTerms:t.source_taxonomy_terms.rows.map(r=>pick(r,'id source_system taxonomy source_term_id source_term_taxonomy_id name slug description source_parent_id source_order source_stored_count created_at updated_at')),
  sermonSeries:t.sermon_series_map.rows.map(r=>pick(r,'sermon_id series_id display_order is_primary created_at')),
  sermonBooks:t.sermon_book_classifications.rows.map(r=>pick(r,'sermon_id book_classification_id display_order created_at')),
  sermonSourceTerms:t.sermon_source_terms.rows.map(r=>pick(r,'sermon_id source_taxonomy_term_id source_relationship_order created_at')),
  scriptureReferences:t.scripture_references.rows.map(r=>pick(r,'id sermon_id display_text canonical_book_id start_chapter start_verse end_chapter end_verse display_order parse_status created_at updated_at relationship_role is_lead original_reference_text provenance review_status reviewed_at parser_version row_version')),
  media:t.sermon_media.rows.map(r=>pick(r,'id sermon_id media_type provider external_id canonical_url title duration_seconds is_primary display_order availability_status created_at updated_at')),
  enrichmentSources:t.sermon_enrichment_sources.rows.map(r=>pick(r,'sermon_id provider video_id canonical_url caption_language caption_track_type source_content_sha256 processing_version accuracy_review_status warnings apparent_completeness uncertainty_marker_count manual_attention_required')),
  extensions:[],guidedReviews:[],guidedReviewItems:[],primaryPassageReviews:[],aiContentReviews:[],aiComponentReviews:[],aiMetadataAssignments:[],restrictedAcceptances:[]
 }};
 snapshot.tables.questionAnswers.sort((a,b)=>String(a.sermon_id).localeCompare(String(b.sermon_id))||Number(a.display_order)-Number(b.display_order)||String(a.id).localeCompare(String(b.id)));
 validateCompletedIds(snapshot.tables.sermons.map(r=>r.id));return validateProjectSermonSnapshot(snapshot);
}
async function main(){
 const p=validateCompletedPacket(JSON.parse(await readFile('private/d171/001-source.private.json','utf8')));
 const snapshot=completedDisplayProjection(p),content=serializeProjectSnapshot(snapshot);
 const manifest={schemaVersion:projectSermonSnapshotVersion,contentFile:'sermons.json',contentSha256:sha256(content),counts:snapshotCounts(snapshot),...deriveProjectSnapshotHashes(snapshot),decision:'D-171',completedMembershipSha256,sourcePacketSha256:p.sha256,operationalDataExcluded:['held sermons','accounts','sessions','credentials','oauth material','raw captions','administrator subjects','audit events','operational reviews and acceptances','private filenames'],importMode:'private-development-projection'};
 // This replaces only the previously authorized tracked projection; historical
 // dataset commits remain intact and no application database is imported.
 await writeFile('development-data/project-sermon-snapshot-v1/sermons.json',content);
 await writeFile('development-data/project-sermon-snapshot-v1/manifest.json',serializeProjectSnapshot(manifest));
 const reread=await readFile('development-data/project-sermon-snapshot-v1/sermons.json');if(sha256(reread)!==manifest.contentSha256)throw Error('d171_export_reread_failed');
 console.log(JSON.stringify({outcome:'curated',sermons:sermonsCount(snapshot),transcripts:snapshot.tables.transcripts.length,qa:snapshot.tables.questionAnswers.length,contentSha256:manifest.contentSha256,administrationRows:0}));
}
const sermonsCount=(s:ProjectSermonSnapshot)=>s.tables.sermons.length;
if(process.argv[1]?.replaceAll('\\','/').endsWith('/completed-sermon-export.ts'))main().catch(()=>{console.error('d171_curated_export_failed');process.exitCode=1;});

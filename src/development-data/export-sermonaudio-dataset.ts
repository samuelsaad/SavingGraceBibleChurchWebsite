import {readFile,mkdir,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Pool,type PoolClient} from 'pg';
import {protectedLocalPostgresPassword,protectedLocalPostgresUser} from '../migration/protected-local-postgres';
import {readFrozenInventory,completionManifestSha256} from '../sermonaudio/completion';
import {persistImmutable} from '../sermonaudio/private-artifacts';
import {d175AcceptanceSql,d175SourceNamespace,d175AcceptanceNamespace} from '../domain/sermonaudio-completion';
import {sermonAudioDatasetDirectory,portableReviewSummary,portableSummaryNamespace,validatePortableSermonAudioProjection,loadSermonAudioPortableDataset} from './sermonaudio-portable-dataset';
import {serializeProjectSnapshot,sha256,snapshotCounts,deriveProjectSnapshotHashes,projectSermonSnapshotVersion,type ProjectSermonSnapshot,type JsonRow} from './project-sermon-snapshot';

const columns={
 speakers:'id name slug biography source_term_id source_term_taxonomy_id created_at updated_at row_version',
 series:'id name slug description source_term_id source_term_taxonomy_id created_at updated_at row_version',
 book_classifications:'id name slug canonical_book_id classification_type review_status source_term_id source_term_taxonomy_id created_at updated_at row_version',
 sermons:'id title slug summary body status service_date published_at scheduled_for source_wordpress_id source_status source_created_local source_created_gmt source_modified_local source_modified_gmt search_terms deleted_at created_at updated_at speaker_id historical_backfill_required summary_status summary_source_kind summary_source_reference summary_created_at summary_updated_at summary_reviewed_at summary_approved_at seo_description',
 sermon_series_map:'sermon_id series_id display_order is_primary created_at',
 sermon_book_classifications:'sermon_id book_classification_id display_order created_at',
 scripture_references:'id sermon_id display_text canonical_book_id start_chapter start_verse end_chapter end_verse display_order parse_status created_at updated_at relationship_role is_lead original_reference_text provenance review_status reviewed_at parser_version row_version',
 sermon_media:'id sermon_id media_type provider external_id canonical_url title duration_seconds is_primary display_order availability_status created_at updated_at',
 sermon_transcripts:'sermon_id body_text status source_kind source_reference created_at updated_at reviewed_at approved_at grounding_revision_id',
 sermon_question_answers:'id sermon_id question_text answer_text display_order status source_kind source_reference created_at updated_at reviewed_at approved_at'
} as const;
const projectionNames={speakers:'speakers',series:'series',book_classifications:'bookClassifications',sermons:'sermons',sermon_series_map:'sermonSeries',sermon_book_classifications:'sermonBooks',scripture_references:'scriptureReferences',sermon_media:'media',sermon_transcripts:'transcripts',sermon_question_answers:'questionAnswers'} as const;
const selectClause=(table:keyof typeof columns)=>table==='sermons'?'id=ANY($1::uuid[])':table==='speakers'?'id IN(SELECT speaker_id FROM sermons WHERE id=ANY($1::uuid[]))':table==='series'?'id IN(SELECT series_id FROM sermon_series_map WHERE sermon_id=ANY($1::uuid[]))':table==='book_classifications'?'id IN(SELECT book_classification_id FROM sermon_book_classifications WHERE sermon_id=ANY($1::uuid[]))':'sermon_id=ANY($1::uuid[])';
async function rows(c:PoolClient,table:keyof typeof columns,ids:string[]){
 const names=columns[table].split(' '),order=table==='sermon_question_answers'?'sermon_id,display_order,id':table==='sermon_transcripts'?'sermon_id':table==='sermon_series_map'?'sermon_id,display_order':table==='sermon_book_classifications'?'sermon_id,display_order':'id';
 return (await c.query('SELECT '+names.map(n=>'"'+n+'"').join(',')+' FROM "'+table+'" WHERE '+selectClause(table)+' ORDER BY '+order,[ids])).rows as JsonRow[];
}
async function existingText(path:string){try{const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw Error('d175_export_path_type');return await readFile(path,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}}

/** Exact reviewed collection only; not a dump, seed over the working database,
 * operational review export, or source-download export. */
export async function exportSermonAudioDataset(){
 if(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim()!=='codex/sermonaudio-119-complete')throw Error('d175_dataset_branch_refused');
 const inventory=await readFrozenInventory('../sermonaudio-transcript-retrieval/private/sermonaudio-transcript-retrieval');
 const sourceIds=inventory.targets.map(t=>t.source.sourceWordPressId);
 const p=new Pool({host:'127.0.0.1',port:5432,database:'savinggrace_sermons_test',user:protectedLocalPostgresUser,password:protectedLocalPostgresPassword,max:1,options:'-c default_transaction_read_only=on -c timezone=UTC'}),c=await p.connect();
 const contentPath=join(sermonAudioDatasetDirectory,'sermons.json'),old=await existingText(contentPath);
 let snapshot:ProjectSermonSnapshot;
 try{
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const t=(await c.query("SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port,current_setting('server_version_num')::int version,current_setting('transaction_read_only') ro")).rows[0];
  if(t.db!=='savinggrace_sermons_test'||t.host!=='127.0.0.1'||t.port!==5432||t.version<160000||t.version>=170000||t.ro!=='on')throw Error('d175_export_target_refused');
  const members=(await c.query('SELECT s.id,'+d175AcceptanceSql('s')+' accepted FROM sermons s WHERE source_wordpress_id=ANY($1::bigint[]) ORDER BY s.id',[sourceIds])).rows;
  if(members.length!==119||members.some(r=>!r.accepted))throw Error('d175_export_current_119_acceptances_required');
  const ids=members.map(r=>String(r.id));
  const empty=['sourceTaxonomyTerms','sermonSourceTerms','enrichmentSources','guidedReviews','guidedReviewItems','primaryPassageReviews','aiContentReviews','aiComponentReviews','aiMetadataAssignments','restrictedAcceptances'];
  const tables=Object.fromEntries(empty.map(k=>[k,[]])) as unknown as ProjectSermonSnapshot['tables'];
  for(const table of Object.keys(columns) as Array<keyof typeof columns>)tables[projectionNames[table]]=await rows(c,table,ids);
  for(const r of tables.sermons)Object.assign(r,{status:'draft',published_at:null,scheduled_for:null,summary_status:'draft',summary_reviewed_at:null,summary_approved_at:null,summary_sha256:sha256(String(r.summary))});
  for(const r of tables.transcripts)Object.assign(r,{status:'draft',reviewed_at:null,approved_at:null,content_sha256:sha256(String(r.body_text))});
  for(const r of tables.questionAnswers)Object.assign(r,{status:'draft',reviewed_at:null,approved_at:null,content_sha256:sha256(`${String(r.question_text)}\n${String(r.answer_text)}`)});
  for(const r of tables.scriptureReferences)Object.assign(r,{review_status:'unreviewed',reviewed_at:null});
  const summaries=(await c.query('SELECT p.sermon_id,p.payload source,a.payload receipt,p.created_at,p.updated_at FROM sermon_extensions p JOIN sermon_extensions a ON a.sermon_id=p.sermon_id AND a.namespace=$2 WHERE p.namespace=$3 AND p.sermon_id=ANY($1::uuid[]) ORDER BY p.sermon_id',[ids,d175AcceptanceNamespace,d175SourceNamespace])).rows;
  tables.extensions=summaries.map(r=>({sermon_id:r.sermon_id,namespace:portableSummaryNamespace,schema_version:1,payload:portableReviewSummary(r.source,r.receipt),created_at:r.created_at,updated_at:r.updated_at}));
  const exportedAt=old?JSON.parse(old).source.exportedAt:new Date().toISOString();
  snapshot=validatePortableSermonAudioProjection({schemaVersion:projectSermonSnapshotVersion,source:{databaseClass:'local-disposable-postgresql',snapshotIsolation:'repeatable-read-read-only',exportedAt},tables},sourceIds);
 }finally{await c.query('ROLLBACK');c.release();await p.end();}
 const content=serializeProjectSnapshot(snapshot),manifest={schemaVersion:projectSermonSnapshotVersion,decision:'D-175',sourceManifestSha256:completionManifestSha256,sourceMembershipSha256:'00dcc94e2ffff5db065ab83060fe7d79a4d8787310b120479446c9563f9eb818',sourceWordPressIds:sourceIds,contentFile:'sermons.json',contentSha256:sha256(content),counts:snapshotCounts(snapshot),...deriveProjectSnapshotHashes(snapshot),operationalDataExcluded:['credentials','original download exports','accounts','sessions','administrator identities','private audit exports','operational acceptance records','local configuration','audio/video files'],importMode:'private-development-projection',portableAcceptanceAuthority:false};
 await mkdir(sermonAudioDatasetDirectory,{recursive:true});
 await persistImmutable(contentPath,content);await persistImmutable(join(sermonAudioDatasetDirectory,'manifest.json'),serializeProjectSnapshot(manifest));
 const verified=await loadSermonAudioPortableDataset();
 return {outcome:old?'unchanged':'exported',sermons:119,contentSha256:verified.contentSha256,manifestSha256:verified.manifestSha256,portableAcceptanceAuthority:false};
}

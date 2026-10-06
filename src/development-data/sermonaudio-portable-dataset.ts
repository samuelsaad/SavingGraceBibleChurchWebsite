import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {z} from 'zod';
import {assertD175SourceMembership,d175ManifestSha256,d175SourceMembershipSha256,d175PortableSummaryNamespace} from '../domain/sermonaudio-completion';
import {validateProjectSermonSnapshot,validateProjectSermonManifest,deriveProjectSnapshotHashes,snapshotCounts,sha256,type ProjectSermonSnapshot,type JsonRow} from './project-sermon-snapshot';

export const sermonAudioDatasetDirectory=resolve('development-data/sermonaudio-119-v1');
export const portableSummaryNamespace=d175PortableSummaryNamespace;
const hash=z.string().regex(/^[a-f0-9]{64}$/u);
export const portableSummarySchema=z.object({
 decision:z.literal('D-175'),manifestSha256:z.literal(d175ManifestSha256),language:z.enum(['en','ar']),
 sourceSha256:hash,transcriptSha256:hash,metadataSha256:hash,candidateSha256:hash,reviewArtifactSha256:hash,
 sourceCaptureDate:z.iso.datetime(),sourceRetrievedAt:z.iso.datetime(),broadcaster:z.literal('savinggrace'),
 sermonAudioId:z.string().regex(/^\d+$/u),substantiveReview:z.literal('AI accepted'),independentReviewer:z.literal(false),
 audioVerified:z.literal(false),humanApprovalClaimed:z.literal(false),uncertaintyRetainedInternally:z.literal(true),
 portableAcceptanceAuthority:z.literal(false)
}).strict();

/** Informational projection only; never operational receipt/audit authority. */
export function portableReviewSummary(source:JsonRow,receipt:JsonRow){
 return portableSummarySchema.parse({decision:'D-175',manifestSha256:d175ManifestSha256,
  language:source.language,sourceSha256:source.sourceSha256,transcriptSha256:source.transcriptSha256,
  metadataSha256:source.metadataSha256,candidateSha256:receipt.candidateHash,reviewArtifactSha256:receipt.reviewArtifactHash,
  sourceCaptureDate:source.sourceCaptureDate,sourceRetrievedAt:source.sourceRetrievedAt,
  broadcaster:source.broadcaster,sermonAudioId:source.sermonAudioId,substantiveReview:'AI accepted',
  independentReviewer:false,audioVerified:false,humanApprovalClaimed:false,uncertaintyRetainedInternally:true,portableAcceptanceAuthority:false});
}

export function validatePortableSermonAudioProjection(raw:unknown,expectedSourceIds:readonly number[]):ProjectSermonSnapshot{
 const s=validateProjectSermonSnapshot(raw);
 const actual=s.tables.sermons.map(r=>Number(r.source_wordpress_id)).sort((a,b)=>a-b);
 if(new Set(actual).size!==actual.length||JSON.stringify(actual)!==JSON.stringify([...expectedSourceIds].sort((a,b)=>a-b)))throw Error('d175_dataset_source_scope');
 for(const table of ['guidedReviews','guidedReviewItems','primaryPassageReviews','aiContentReviews','aiComponentReviews','aiMetadataAssignments','restrictedAcceptances'] as const)
  if(s.tables[table].length)throw Error('d175_dataset_contains_operational_authority');
 for(const sermon of s.tables.sermons)if(sermon.status!=='draft'||sermon.summary_status!=='draft'||sermon.published_at!==null||sermon.scheduled_for!==null||sermon.summary_reviewed_at!==null||sermon.summary_approved_at!==null)throw Error('d175_dataset_lifecycle');
 for(const content of [...s.tables.transcripts,...s.tables.questionAnswers])if(content.status!=='draft'||content.reviewed_at!==null||content.approved_at!==null)throw Error('d175_dataset_content_authority');
 const summaries=new Set<string>();
 for(const row of s.tables.extensions){
  if(row.namespace!==portableSummaryNamespace||summaries.has(String(row.sermon_id)))throw Error('d175_dataset_extension_authority');
  portableSummarySchema.parse(row.payload);summaries.add(String(row.sermon_id));
 }
 if(summaries.size!==s.tables.sermons.length)throw Error('d175_dataset_missing_safe_summary');
 for(const passage of s.tables.scriptureReferences)if(passage.review_status==='confirmed'||passage.reviewed_at!==null)throw Error('d175_dataset_passage_authority');
 return s;
}

export async function loadSermonAudioPortableDataset(){
 const [contentBytes,manifestBytes]=await Promise.all([readFile(resolve(sermonAudioDatasetDirectory,'sermons.json')),readFile(resolve(sermonAudioDatasetDirectory,'manifest.json'))]);
 const raw=JSON.parse(manifestBytes.toString('utf8')),manifest=validateProjectSermonManifest(raw);
 if(raw.decision!=='D-175'||raw.sourceManifestSha256!==d175ManifestSha256||raw.sourceMembershipSha256!==d175SourceMembershipSha256||raw.portableAcceptanceAuthority!==false||!Array.isArray(raw.sourceWordPressIds))throw Error('d175_dataset_manifest');
 assertD175SourceMembership(raw.sourceWordPressIds);
 if(sha256(contentBytes)!==manifest.contentSha256)throw Error('d175_dataset_content_hash');
 const snapshot=validatePortableSermonAudioProjection(JSON.parse(contentBytes.toString('utf8')),raw.sourceWordPressIds);
 if(JSON.stringify(snapshotCounts(snapshot))!==JSON.stringify(manifest.counts))throw Error('d175_dataset_counts');
 for(const [k,v] of Object.entries(deriveProjectSnapshotHashes(snapshot)))if(raw[k]!==v)throw Error('d175_dataset_projection_hash');
 return {snapshot,manifest,contentSha256:sha256(contentBytes),manifestSha256:sha256(manifestBytes)};
}

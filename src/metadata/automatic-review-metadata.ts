import type { PoolClient } from "pg";
import { bookHash } from "../scripture/automatic-primary-book";
import { resolveSourceSpeaker, reviewMetadataPolicy, type SourceSpeakerEvidence } from "../domain/review-metadata";
import { PostgresAdminSermonTransaction } from "../server/repositories/postgres-admin-sermon-repository";

export const reviewMetadataActor = "local-source-metadata-reconciliation";
export const reviewMetadataAction = "sermon.source_speaker_prefilled";
export interface SpeakerPlanRecord {
  id: string; sourceWordPressId: number; rowVersion: number; speakerId: string | null;
  evidence: SourceSpeakerEvidence | null; metadataHash: string;
  assessment: ReturnType<typeof resolveSourceSpeaker>;
}

export async function inspectSpeakerMetadata(client: PoolClient, evidence: SourceSpeakerEvidence[], ids?: string[]): Promise<SpeakerPlanRecord[]> {
  const catalogue = (await client.query<{id:string; source_term_id:string|null}>("SELECT id,source_term_id FROM speakers ORDER BY id")).rows
    .map(s=>({id:s.id,sourceTermId:s.source_term_id===null?null:Number(s.source_term_id)}));
  const rows = (await client.query<{id:string;source_wordpress_id:string;row_version:number;speaker_id:string|null;explicitly_cleared:boolean;metadata_hash:string}>(`
    SELECT s.id,s.source_wordpress_id,s.row_version,s.speaker_id,
      EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_id=s.id AND a.actor_role='admin'
        AND a.action='sermon.speaker_assignment_updated' AND a.outcome='succeeded') explicitly_cleared,
      encode(digest(jsonb_build_object('metadata',jsonb_build_object('id',s.id,'source',s.source_wordpress_id,
        'speaker',s.speaker_id,'version',s.row_version),'review',(SELECT to_jsonb(r) FROM sermon_enrichment_reviews r WHERE r.sermon_id=s.id),
        'audit',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM audit_events a WHERE a.entity_id=s.id))::text,'sha256'),'hex') metadata_hash
    FROM sermons s WHERE ($1::uuid[] IS NULL OR s.id=ANY($1::uuid[])) ORDER BY s.id`,[ids??null])).rows;
  return rows.map(r=>{
    const matches=evidence.filter(e=>String(e.sourceWordPressId)===String(r.source_wordpress_id));
    const source=matches.length===1?matches[0]!:null;
    return {id:r.id,sourceWordPressId:Number(r.source_wordpress_id),rowVersion:r.row_version,speakerId:r.speaker_id,
      evidence:source,metadataHash:r.metadata_hash,assessment:resolveSourceSpeaker(r.speaker_id,source,catalogue,r.explicitly_cleared)};
  });
}

/** Guarded caller owns the transaction. Original source and existing choices are never updated. */
export async function applySpeakerPlan(client: PoolClient, plan: SpeakerPlanRecord[], hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)||new Set(plan.map(r=>r.id)).size!==plan.length) throw Error("metadata_invalid_plan");
  const transaction=new PostgresAdminSermonTransaction(client);
  const results: Array<{id:string;outcome:string}>=[];
  for(const record of plan) {
    if(record.speakerId!==null||record.assessment.speakerId===null) {results.push({id:record.id,outcome:record.assessment.reason});continue;}
    await client.query("SELECT id FROM sermons WHERE id=$1 FOR UPDATE",[record.id]);
    const prior=await client.query(`SELECT 1 FROM audit_events WHERE entity_id=$1 AND actor_subject=$2 AND action=$3
      AND request_correlation_id=$4 AND outcome='succeeded'`,[record.id,reviewMetadataActor,reviewMetadataAction,hash]);
    const current=(await inspectSpeakerMetadata(client,record.evidence?[record.evidence]:[],[record.id]))[0];
    if(prior.rowCount) {results.push({id:record.id,outcome:current?.speakerId===record.assessment.speakerId?'unchanged':'intervening_edit_preserved'});continue;}
    if(!current||current.metadataHash!==record.metadataHash||current.sourceWordPressId!==record.sourceWordPressId) {
      results.push({id:record.id,outcome:'conflict_preserved'});continue;
    }
    if(current.assessment.speakerId!==record.assessment.speakerId) throw Error("metadata_mapping_drift");
    await transaction.updateSermon(record.id,{rowVersion:record.rowVersion,speakerId:record.assessment.speakerId},reviewMetadataActor);
    await transaction.refreshSearchTerms(record.id);
    // Use existing invalidation only if a previously completed identity actually changes.
    const progress=await client.query("SELECT identity_status,completed_at FROM sermon_enrichment_reviews WHERE sermon_id=$1",[record.id]);
    if(progress.rows.some(r=>r.identity_status==='confirmed'||r.completed_at!==null)) await transaction.reopenEnrichmentReview(record.id,true,reviewMetadataActor);
    await transaction.appendAudit({actorSubject:reviewMetadataActor,actorRole:'system',action:reviewMetadataAction,
      entityType:'sermon',entityId:record.id,outcome:'succeeded',changedFields:['speakerId'],requestCorrelationId:hash});
    results.push({id:record.id,outcome:'assigned'});
  }
  return {policy:reviewMetadataPolicy,planSha256:hash,results};
}

export const speakerPlanHash = (plan: unknown) => bookHash(JSON.stringify(plan));

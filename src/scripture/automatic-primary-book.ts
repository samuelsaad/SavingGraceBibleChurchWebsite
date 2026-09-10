import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { assessPrimaryBook, primaryBookResolutionVersion, type PrimaryBookEvidence, type PrimaryBookAssessment } from "../domain/primary-book-resolution";
import { formatBiblePassage } from "../domain/bible-passage";

export const automaticBookActor = "local-automatic-primary-book";
export const automaticBookAction = "sermon.primary_book_metadata_prepared";
export const bookHash = (value: string) => createHash("sha256").update(value).digest("hex");
export interface BookPlanRecord { id: string; rowVersion: number; evidence: PrimaryBookEvidence;
  metadataHash: string; assessment: PrimaryBookAssessment }

/** Only passage/source metadata leaves the database; never sermon prose. */
export async function inspectPrimaryBooks(client: PoolClient, ids?: string[]): Promise<BookPlanRecord[]> {
  const rows = await client.query<{ id: string; row_version: number; evidence: PrimaryBookEvidence; metadata_hash: string }>(`
    SELECT s.id,s.row_version,
      jsonb_build_object('reviewStatus',p.review_status,
        'references',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'displayText',r.display_text,
          'canonicalBookId',r.canonical_book_id,'startChapter',r.start_chapter,'startVerse',r.start_verse,
          'endChapter',r.end_chapter,'endVerse',r.end_verse,'relationshipRole',r.relationship_role,
          'isLead',r.is_lead,'reviewStatus',r.review_status,'provenance',r.provenance) ORDER BY r.display_order)
          FROM scripture_references r WHERE r.sermon_id=s.id),'[]'::jsonb),
        'sourcePassages',COALESCE((SELECT jsonb_agg(DISTINCT x.original_value) FROM scripture_reference_sources x
          WHERE x.sermon_id=s.id AND x.source_kind='postmeta' AND x.source_meta_key='asp_sermon_bible_passage'),'[]'::jsonb),
        'sourceTitles',COALESCE((SELECT jsonb_agg(left(m.title,length(m.title)-length(' — private evaluation source')) ORDER BY m.id)
          FROM sermon_media m WHERE m.sermon_id=s.id AND m.provider='youtube'
          AND right(m.title,length(' — private evaluation source'))=' — private evaluation source'
          AND e.retrieval_attribution='authorised_youtube_data_api'),'[]'::jsonb)) AS evidence,
      encode(digest(jsonb_build_object('sermon',jsonb_build_object('id',s.id,'title',s.title,'version',s.row_version),
        'review',to_jsonb(p),'references',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM scripture_references r WHERE r.sermon_id=s.id),
        'sources',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM scripture_reference_sources x WHERE x.sermon_id=s.id),
        'media',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM sermon_media m WHERE m.sermon_id=s.id),
        'progress',(SELECT to_jsonb(g) FROM sermon_enrichment_reviews g WHERE g.sermon_id=s.id))::text,'sha256'),'hex') AS metadata_hash
    FROM sermons s LEFT JOIN sermon_primary_passage_reviews p ON p.sermon_id=s.id
    LEFT JOIN sermon_enrichment_sources e ON e.sermon_id=s.id
    WHERE ($1::uuid[] IS NULL OR s.id=ANY($1::uuid[])) ORDER BY s.id`, [ids ?? null]);
  return rows.rows.map(r => ({ id: r.id, rowVersion: r.row_version, evidence: r.evidence,
    metadataHash: r.metadata_hash, assessment: assessPrimaryBook(r.evidence) }));
}

/** Caller owns the guarded transaction and sermon lock. Does not record a human decision. */
export async function prepareAutomaticPrimaryBook(client: PoolClient, record: BookPlanRecord,
  correlation: string, bumpVersion = true): Promise<"changed" | "unchanged"> {
  const a = record.assessment;
  if (a.outcome === "preserved_human_selection" || a.outcome === "already_correct") return "unchanged";
  const review = await client.query("SELECT review_status,parser_version FROM sermon_primary_passage_reviews WHERE sermon_id=$1 FOR UPDATE", [record.id]);
  if (review.rows[0] && (review.rows[0].review_status !== "pending" || review.rows[0].parser_version === primaryBookResolutionVersion)) return "unchanged";
  // The schema's evidence-source enum is not broadened or falsely attributed. Without
  // title provenance, canonical field mapping is handled by the owning input/import path.
  if (!review.rowCount && record.evidence.sourceTitles.length === 0) return "unchanged";
  if (a.outcome === "newly_assigned" && a.passage) {
    if (a.referenceId) {
      await client.query(`UPDATE scripture_references SET canonical_book_id=$2,row_version=row_version+1,updated_at=now()
        WHERE id=$1 AND canonical_book_id IS NULL AND review_status='unreviewed'`, [a.referenceId, a.passage.canonicalBookId]);
    } else {
      // Only a title-backed pending proposal uses title_proposal provenance.
      if (a.reason !== "preserved_source_title") return "unchanged";
      await client.query(`INSERT INTO scripture_references (sermon_id,display_text,canonical_book_id,start_chapter,start_verse,
        end_chapter,end_verse,display_order,parse_status,relationship_role,is_lead,original_reference_text,provenance,review_status,parser_version)
        VALUES($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(max(display_order),-1)+1 FROM scripture_references WHERE sermon_id=$1),
          'exact','primary',true,$8,'title_proposal','proposed',$9)`,
      [record.id, formatBiblePassage(a.passage), a.passage.canonicalBookId,a.passage.startChapter,a.passage.startVerse,
        a.passage.endChapter,a.passage.endVerse,a.originalText,primaryBookResolutionVersion]);
    }
  }
  if (!review.rowCount) await client.query(`INSERT INTO sermon_primary_passage_reviews
    (sermon_id,proposal_outcome,evidence_source,evidence_sha256,parser_version)
    VALUES($1,$2,'local_youtube_title',$3,$4)`, [record.id,
    a.outcome === "newly_assigned" ? "proposed" : a.reason === "missing_explicit_passage" ? "no_reference" : "manual_review_required",
    bookHash(JSON.stringify(record.evidence.sourceTitles)), primaryBookResolutionVersion]);
  if (bumpVersion) {
    await client.query(`UPDATE sermons SET row_version=row_version+1,updated_at=now(),updated_by_subject=$2 WHERE id=$1`, [record.id,automaticBookActor]);
    await client.query(`UPDATE sermon_enrichment_reviews SET identity_status='pending',current_stage=1,
      completed_at=NULL,completed_by_subject=NULL,row_version=row_version+1,updated_at=now(),updated_by_subject=$2
      WHERE sermon_id=$1 AND (identity_status='confirmed' OR completed_at IS NOT NULL)`, [record.id,automaticBookActor]);
  }
  await client.query(`INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id,outcome)
    VALUES($1,'system',$2,'sermon',$3,'["primaryPassageReview","scriptureReferences"]'::jsonb,$4,'succeeded')`,
  [automaticBookActor,automaticBookAction,record.id,correlation]);
  return "changed";
}

export async function applyBookPlan(client: PoolClient, records: BookPlanRecord[], hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash) || new Set(records.map(r=>r.id)).size !== records.length) throw Error("book_invalid_plan");
  const outcomes: Array<{ id: string; result: string }> = [];
  for (const record of records) {
    await client.query("SELECT id FROM sermons WHERE id=$1 FOR UPDATE", [record.id]);
    const current = (await inspectPrimaryBooks(client,[record.id]))[0];
    if (!current) { outcomes.push({id:record.id,result:"identity_missing"}); continue; }
    const previous = await client.query(`SELECT 1 FROM audit_events WHERE entity_id=$1 AND action=$2
      AND actor_subject=$3 AND request_correlation_id=$4`, [record.id,automaticBookAction,automaticBookActor,hash]);
    if (previous.rowCount) { outcomes.push({id:record.id,result:"unchanged"}); continue; }
    if (current.metadataHash !== record.metadataHash) { outcomes.push({id:record.id,result:"concurrent_metadata_edit_preserved"}); continue; }
    if (JSON.stringify(current.assessment) !== JSON.stringify(record.assessment)) throw Error("book_policy_drift");
    outcomes.push({id:record.id,result:await prepareAutomaticPrimaryBook(client,current,hash)});
  }
  return outcomes;
}

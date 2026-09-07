import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { atomicReviewItemSetSha256, atomicReviewItemUuid } from "./atomic-review-contracts";

export const providerRedactionWarning = {
  code: "provider_redacted_word_requires_administrator_review",
  safeDetail: "The source retains a provider-redacted word marker. No missing wording has been inferred."
} as const;

/** Metadata only: never replace the source marker or infer the missing words. */
export function fourthBatchReviewFindings(
  transcript: string, sermonId: string, sourceRecordKey: string, transcriptSha256: string
) {
  if (!/^authorised-record-[1-9]\d*$/u.test(sourceRecordKey) ||
    !/^[0-9a-f-]{36}$/u.test(sermonId) ||
    createHash("sha256").update(transcript, "utf8").digest("hex") !== transcriptSha256) {
    throw new Error("d155_review_finding_source_mismatch");
  }
  const items = [...transcript.matchAll(/\[ __ \]/gu)].map((match, index) => {
    const categoryOrdinal = index + 1;
    const characterStart = match.index;
    const detail = `Provider-redacted word at character offset ${characterStart}. Verify the unresolved wording; do not infer it automatically.`;
    const identity = {
      schemaVersion: 1, sourceRecordKey, category: "caption_error", categoryOrdinal, detail,
      supportingParagraphs: [transcript.slice(0, characterStart).split(/\n\s*\n/u).length],
      transcriptSermonId: sermonId, sourceTranscriptSha256: transcriptSha256
    };
    const identitySha256 = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
    return { ...identity, identitySha256, id: atomicReviewItemUuid(identitySha256),
      itemKey: `atomic-${identitySha256}`, sourceMarker: match[0], displayOrder: categoryOrdinal };
  });
  if (items.length > 100) throw new Error("d155_review_finding_limit_exceeded");
  return {
    items, setSha256: atomicReviewItemSetSha256(items),
    unresolvedPassages: items.map(item => ({ marker: `uncertain-${item.categoryOrdinal}`, safeReason: item.detail }))
  };
}

type Findings = ReturnType<typeof fourthBatchReviewFindings>;

/** Called only inside a new D-155 import transaction, never for existing records. */
export async function insertFourthBatchReviewFindings(client: PoolClient, sermonId: string, findings: Findings) {
  for (const item of findings.items) {
    await client.query(`INSERT INTO sermon_enrichment_review_items (
      id,sermon_id,item_key,category,display_order,label,guidance,source_marker,decision_status,
      correction_text,transcript_row_version,decided_by_subject,decided_at,item_identity_sha256,
      source_record_key,category_ordinal,finding_detail,supporting_paragraphs,source_transcript_sha256,atomic_schema_version
    ) VALUES ($1,$2,$3,'caption_error',$4,$5,$6,$7,'pending',NULL,1,NULL,NULL,$8,$9,$4,$6,$10::integer[],$11,1)`,
    [item.id,sermonId,item.itemKey,item.displayOrder,`Caption finding ${item.categoryOrdinal}`,
      item.detail,item.sourceMarker,item.identitySha256,item.sourceRecordKey,item.supportingParagraphs,item.sourceTranscriptSha256]);
  }
  const result = await client.query(`UPDATE sermon_enrichment_reviews SET expected_item_count=$2,expected_item_set_sha256=$3
    WHERE sermon_id=$1 AND identity_status='pending' AND current_stage=1 AND completed_at IS NULL
      AND empty_item_set_acknowledged_at IS NULL`, [sermonId,findings.items.length,findings.setSha256]);
  if (result.rowCount !== 1) throw new Error("d155_review_finding_gate_conflict");
}

export async function verifyFourthBatchReviewFindings(client: PoolClient, sermonId: string, findings: Findings): Promise<boolean> {
  const source = await client.query<{ matches: boolean }>(`SELECT
    source.uncertainty_marker_count=$2 AND source.unresolved_passages=$3::jsonb
    AND ($2=0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(source.warnings) w WHERE w->>'code'=$4))
    AND review.expected_item_count=$2 AND review.expected_item_set_sha256=$5
    AND review.atomic_schema_version=1 AND review.identity_status='pending' AND review.current_stage=1
    AND review.completed_by_subject IS NULL AND review.completed_at IS NULL
    AND review.empty_item_set_acknowledged_by_subject IS NULL AND review.empty_item_set_acknowledged_at IS NULL AS matches
    FROM sermon_enrichment_sources source JOIN sermon_enrichment_reviews review ON review.sermon_id=source.sermon_id
    WHERE source.sermon_id=$1`, [sermonId,findings.items.length,JSON.stringify(findings.unresolvedPassages),providerRedactionWarning.code,findings.setSha256]);
  if (source.rows[0]?.matches !== true) return false;
  const rows = await client.query(`SELECT id,item_key,category,display_order,label,guidance,source_marker,
    decision_status,correction_text,transcript_row_version,decided_by_subject,decided_at,item_identity_sha256,
    source_record_key,category_ordinal,finding_detail,supporting_paragraphs,source_transcript_sha256,atomic_schema_version
    FROM sermon_enrichment_review_items WHERE sermon_id=$1 ORDER BY display_order`, [sermonId]);
  return rows.rows.length === findings.items.length && rows.rows.every((row, index) => {
    const item = findings.items[index]!;
    return row.id===item.id && row.item_key===item.itemKey && row.category==="caption_error" &&
      row.display_order===item.displayOrder && row.label===`Caption finding ${item.categoryOrdinal}` &&
      row.guidance===item.detail && row.source_marker===item.sourceMarker && row.decision_status==="pending" &&
      row.correction_text===null && row.transcript_row_version===1 && row.decided_by_subject===null && row.decided_at===null &&
      row.item_identity_sha256===item.identitySha256 && row.source_record_key===item.sourceRecordKey &&
      row.category_ordinal===item.categoryOrdinal && row.finding_detail===item.detail &&
      JSON.stringify(row.supporting_paragraphs)===JSON.stringify(item.supportingParagraphs) &&
      row.source_transcript_sha256===item.sourceTranscriptSha256 && row.atomic_schema_version===1;
  });
}

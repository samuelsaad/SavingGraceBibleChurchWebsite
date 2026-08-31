import type { Pool, PoolClient } from "pg";
import { authorisedLocalDatabaseName } from "../migration/local-database-safety";

export const legacyPassageCarryForwardAuthorization =
  "SAMUEL-LEGACY-PASSAGE-REVIEW-CARRY-FORWARD-2026-08-31" as const;
export const legacyPassageCarryForwardActor = "local-admin-0001" as const;
export const legacyPassageCarryForwardAction =
  "sermon.legacy_primary_passage_review_carried_forward" as const;

const pilotVersions = ["phase3b2-caption-v1", "phase3b2b-punctuation-v2"] as const;
const waveOneVersion = "phase3b2c-wave1-extractive-drafts-v2" as const;
const current15Versions = [...pilotVersions, waveOneVersion] as const;

export interface LegacyPassageCandidate {
  reviewComplete: boolean;
  completedBefore0015: boolean;
  priorContentDecisionsIntact: boolean;
  passageReviewStatus: "pending" | "confirmed_passage" | "confirmed_none" | "rejected";
  passageReviewer: string | null;
  passageReviewedAtPresent: boolean;
  proposedReferenceCount: number;
  proposedPrimaryCount: number;
  proposedLeadCount: number;
  structurallyValidProposedPrimaryCount: number;
  confirmedPrimaryCount: number;
  confirmedLeadCount: number;
  confirmedByActorCount: number;
  proposalExistedByCompletion: boolean;
  proposalUnchangedThroughCompletion: boolean;
  passageAuditAfterCompletionCount: number;
  authorizationAuditCount: number;
}

export type LegacyPassageClassification =
  | { outcome: "carry_forward" }
  | { outcome: "preserved" }
  | { outcome: "pending"; reasons: string[] }
  | { outcome: "conflict"; reasons: string[] };

export function classifyLegacyCompletedPassage(
  candidate: LegacyPassageCandidate
): LegacyPassageClassification {
  if (candidate.authorizationAuditCount > 1) {
    return { outcome: "conflict", reasons: ["duplicate_authorization_audit"] };
  }
  if (candidate.authorizationAuditCount === 1) {
    const preserved = candidate.passageReviewStatus === "confirmed_passage" &&
      candidate.passageReviewer === legacyPassageCarryForwardActor &&
      candidate.passageReviewedAtPresent && candidate.confirmedPrimaryCount > 0 &&
      candidate.confirmedLeadCount === 1 &&
      candidate.confirmedByActorCount === candidate.confirmedPrimaryCount;
    return preserved
      ? { outcome: "preserved" }
      : { outcome: "conflict", reasons: ["authorization_audit_state_mismatch"] };
  }

  const reasons: string[] = [];
  if (!candidate.reviewComplete) reasons.push("six_stage_review_incomplete");
  if (!candidate.completedBefore0015) reasons.push("completion_not_before_0015");
  if (!candidate.priorContentDecisionsIntact) reasons.push("prior_content_review_not_intact");
  if (candidate.passageReviewStatus !== "pending" || candidate.passageReviewer !== null ||
      candidate.passageReviewedAtPresent) {
    reasons.push(`passage_state_${candidate.passageReviewStatus}`);
  }
  if (candidate.proposedReferenceCount === 0 || candidate.proposedPrimaryCount === 0) {
    reasons.push("missing_primary_passage");
  }
  if (candidate.proposedPrimaryCount !== candidate.structurallyValidProposedPrimaryCount) {
    reasons.push("malformed_primary_passage");
  }
  if (candidate.proposedLeadCount !== 1) reasons.push("ambiguous_primary_passage");
  if (!candidate.proposalExistedByCompletion || !candidate.proposalUnchangedThroughCompletion ||
      candidate.passageAuditAfterCompletionCount > 0) {
    reasons.push("passage_created_or_changed_after_completion");
  }
  return reasons.length ? { outcome: "pending", reasons } : { outcome: "carry_forward" };
}

interface ScopedRow {
  id: string;
  title: string;
  slug: string;
  processing_version: string;
}

interface CandidateRow extends LegacyPassageCandidate {
  sermon_id: string;
  title: string;
  passage_display: string | null;
}

export interface LegacyPassageCarryForwardRecord {
  sermonId: string;
  title: string;
  passage: string | null;
  outcome: "carried_forward" | "preserved" | "explicit_decision_preserved" | "pending";
  reasons: string[];
}

export interface LegacyPassageCarryForwardResult {
  outcome: "legacy_completed_passage_review_carry_forward_complete";
  inspectedRecords: 15;
  carriedForward: number;
  preservedFromPriorRun: number;
  leftPending: number;
  confirmedNoPrimaryPreserved: 1;
  records: LegacyPassageCarryForwardRecord[];
  protectedStateSha256: string;
  transcriptRowsChanged: 0;
  descriptionRowsChanged: 0;
  questionAnswerRowsChanged: 0;
  completedReviewRowsChanged: 0;
  publicRecordsCreated: 0;
  semanticRowsCreated: 0;
}

export class LegacyPassageCarryForwardError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "LegacyPassageCarryForwardError";
  }
}

async function verifyTarget(client: PoolClient): Promise<Date> {
  const expectedDatabase = authorisedLocalDatabaseName();
  const result = await client.query<{
    database_ok: boolean;
    version_ok: boolean;
    loopback_ok: boolean;
    port_ok: boolean;
    migration_count: number;
    migration_max_order: number;
    migration_0015_applied_at: Date | null;
    migration_0016: number;
    later_migrations: number;
  }>(`SELECT
       current_database() = $1 AS database_ok,
       current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS version_ok,
       inet_server_addr() = '127.0.0.1'::inet AS loopback_ok,
       inet_server_port() = 5432 AS port_ok,
       (SELECT count(*)::integer FROM schema_migrations) AS migration_count,
       (SELECT COALESCE(max(migration_order), 0)::integer FROM schema_migrations) AS migration_max_order,
       (SELECT applied_at FROM schema_migrations
        WHERE migration_id = '0015_optional_passage_and_grounding_identity') AS migration_0015_applied_at,
       (SELECT count(*)::integer FROM schema_migrations
        WHERE migration_id = '0016_legacy_completed_passage_reviews') AS migration_0016,
       (SELECT count(*)::integer FROM schema_migrations WHERE migration_order > 16) AS later_migrations`,
  [expectedDatabase]);
  const row = result.rows[0];
  if (!row?.database_ok || !row.version_ok || !row.loopback_ok || !row.port_ok ||
      row.migration_count !== 16 || row.migration_max_order !== 16 ||
      row.migration_0016 !== 1 || row.later_migrations !== 0 || !row.migration_0015_applied_at) {
    throw new LegacyPassageCarryForwardError(
      "postgres_target_mismatch",
      "Local PostgreSQL identity or migration checkpoint changed"
    );
  }
  return row.migration_0015_applied_at;
}

async function readAndLockScope(client: PoolClient): Promise<ScopedRow[]> {
  const result = await client.query<ScopedRow>(
    `SELECT sermon.id, sermon.title, sermon.slug, source.processing_version
     FROM sermons sermon
     JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
     WHERE source.processing_version = ANY($1::text[])
     ORDER BY source.processing_version, sermon.id
     FOR UPDATE OF sermon, source`,
    [current15Versions]
  );
  if (result.rowCount !== 15 || new Set(result.rows.map((row) => row.id)).size !== 15 ||
      result.rows.filter((row) => pilotVersions.includes(row.processing_version as typeof pilotVersions[number])).length !== 3 ||
      result.rows.filter((row) => row.processing_version === waveOneVersion).length !== 12) {
    throw new LegacyPassageCarryForwardError(
      "current_15_scope_mismatch",
      "The exact three-pilot and 12-Wave-1 scope changed"
    );
  }
  const ids = result.rows.map((row) => row.id);
  await client.query(
    "SELECT sermon_id FROM sermon_enrichment_reviews WHERE sermon_id = ANY($1::uuid[]) FOR UPDATE",
    [ids]
  );
  await client.query(
    "SELECT sermon_id FROM sermon_primary_passage_reviews WHERE sermon_id = ANY($1::uuid[]) FOR UPDATE",
    [ids]
  );
  await client.query(
    "SELECT id FROM scripture_references WHERE sermon_id = ANY($1::uuid[]) FOR UPDATE",
    [ids]
  );
  return result.rows;
}

async function protectedStateHash(client: PoolClient, ids: string[]): Promise<string> {
  const result = await client.query<{ protected_sha256: string }>(
    `WITH qa AS (
       SELECT item.sermon_id,
              jsonb_agg(jsonb_build_object(
                'id', item.id,
                'order', item.display_order,
                'body', encode(digest(convert_to(item.question_text || E'\n' || item.answer_text, 'UTF8'), 'sha256'), 'hex'),
                'status', item.status,
                'source_kind', item.source_kind,
                'source_reference', item.source_reference,
                'reviewed_by', item.reviewed_by_subject,
                'approved_by', item.approved_by_subject,
                'row_version', item.row_version
              ) ORDER BY item.display_order, item.id) AS state
       FROM sermon_question_answers item
       WHERE item.sermon_id = ANY($1::uuid[])
       GROUP BY item.sermon_id
     ), protected AS (
       SELECT sermon.id,
              jsonb_build_object(
                'sermon_row_version', sermon.row_version,
                'status', sermon.status,
                'summary_body', encode(digest(convert_to(COALESCE(sermon.summary, ''), 'UTF8'), 'sha256'), 'hex'),
                'summary_status', sermon.summary_status,
                'summary_source', sermon.summary_source_reference,
                'summary_reviewed_by', sermon.summary_reviewed_by_subject,
                'summary_approved_by', sermon.summary_approved_by_subject,
                'summary_row_version', sermon.summary_row_version,
                'transcript_body', encode(digest(convert_to(transcript.body_text, 'UTF8'), 'sha256'), 'hex'),
                'transcript_status', transcript.status,
                'transcript_source', transcript.source_reference,
                'transcript_reviewed_by', transcript.reviewed_by_subject,
                'transcript_approved_by', transcript.approved_by_subject,
                'transcript_row_version', transcript.row_version,
                'grounding_revision', transcript.grounding_revision_id,
                'qa', qa.state,
                'review_identity', review.identity_status,
                'review_stage', review.current_stage,
                'review_completed_by', review.completed_by_subject,
                'review_completed_at', review.completed_at,
                'review_row_version', review.row_version
              ) AS state
       FROM sermons sermon
       JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
       JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
       JOIN qa ON qa.sermon_id = sermon.id
       WHERE sermon.id = ANY($1::uuid[])
     )
     SELECT encode(digest(convert_to(jsonb_agg(state ORDER BY id)::text, 'UTF8'), 'sha256'), 'hex')
              AS protected_sha256
     FROM protected`,
    [ids]
  );
  const hash = result.rows[0]?.protected_sha256;
  if (!hash) throw new LegacyPassageCarryForwardError("protected_state_missing", "Protected review state could not be hashed");
  return hash;
}

async function readCandidates(
  client: PoolClient,
  ids: string[],
  migration0015AppliedAt: Date
): Promise<CandidateRow[]> {
  const result = await client.query<CandidateRow>(
    `SELECT sermon.id AS sermon_id,
            sermon.title,
            (review.completed_at IS NOT NULL AND review.current_stage = 6) AS "reviewComplete",
            (review.completed_at < $2::timestamptz) AS "completedBefore0015",
            (
              review.identity_status = 'confirmed'
              AND transcript.status = 'approved'
              AND encode(digest(convert_to(transcript.body_text, 'UTF8'), 'sha256'), 'hex') = review.expected_transcript_sha256
              AND sermon.summary_status = 'approved'
              AND (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = sermon.id) BETWEEN 5 AND 10
              AND NOT EXISTS (SELECT 1 FROM sermon_question_answers qa WHERE qa.sermon_id = sermon.id AND qa.status <> 'approved')
              AND NOT EXISTS (SELECT 1 FROM sermon_enrichment_review_items item
                              WHERE item.sermon_id = sermon.id AND item.decision_status IN ('pending', 'rejected', 'left_unresolved'))
            ) AS "priorContentDecisionsIntact",
            passage.review_status AS "passageReviewStatus",
            passage.reviewed_by_subject AS "passageReviewer",
            (passage.reviewed_at IS NOT NULL) AS "passageReviewedAtPresent",
            count(ref.id) FILTER (WHERE ref.review_status = 'proposed')::integer AS "proposedReferenceCount",
            count(ref.id) FILTER (WHERE ref.review_status = 'proposed' AND ref.relationship_role = 'primary')::integer AS "proposedPrimaryCount",
            count(ref.id) FILTER (WHERE ref.review_status = 'proposed' AND ref.relationship_role = 'primary' AND ref.is_lead)::integer AS "proposedLeadCount",
            count(ref.id) FILTER (
              WHERE ref.review_status = 'proposed' AND ref.relationship_role = 'primary'
                AND ref.canonical_book_id IS NOT NULL
                AND (ref.start_chapter IS NULL) = (ref.end_chapter IS NULL)
                AND (ref.start_verse IS NULL OR ref.start_chapter IS NOT NULL)
                AND (ref.end_verse IS NULL OR (ref.start_verse IS NOT NULL AND ref.end_chapter IS NOT NULL))
                AND (ref.start_chapter IS NULL OR
                  (ref.end_chapter * 1000 + COALESCE(ref.end_verse, 999)) >=
                  (ref.start_chapter * 1000 + COALESCE(ref.start_verse, 0)))
            )::integer AS "structurallyValidProposedPrimaryCount",
            count(ref.id) FILTER (WHERE ref.review_status = 'confirmed' AND ref.relationship_role = 'primary')::integer AS "confirmedPrimaryCount",
            count(ref.id) FILTER (WHERE ref.review_status = 'confirmed' AND ref.relationship_role = 'primary' AND ref.is_lead)::integer AS "confirmedLeadCount",
            count(ref.id) FILTER (WHERE ref.review_status = 'confirmed' AND ref.relationship_role = 'primary'
                                  AND ref.reviewer_subject = $3)::integer AS "confirmedByActorCount",
            COALESCE(bool_and(ref.created_at <= review.completed_at) FILTER (WHERE ref.review_status = 'proposed'), false)
              AS "proposalExistedByCompletion",
            COALESCE(bool_and(ref.updated_at <= review.completed_at) FILTER (WHERE ref.review_status = 'proposed'), false)
              AS "proposalUnchangedThroughCompletion",
            (SELECT count(*)::integer FROM audit_events event
             WHERE event.entity_id = sermon.id
               AND event.action LIKE 'sermon.primary_passage%'
               AND event.created_at > review.completed_at) AS "passageAuditAfterCompletionCount",
            (SELECT count(*)::integer FROM audit_events event
             WHERE event.entity_id = sermon.id
               AND event.actor_subject = $3
               AND event.action = $4
               AND event.request_correlation_id = $5) AS "authorizationAuditCount",
            string_agg(ref.display_text, '; ' ORDER BY ref.display_order, ref.id)
              FILTER (WHERE ref.relationship_role = 'primary' AND ref.review_status IN ('proposed', 'confirmed')) AS passage_display
     FROM sermons sermon
     JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
     JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
     JOIN sermon_primary_passage_reviews passage ON passage.sermon_id = sermon.id
     LEFT JOIN scripture_references ref ON ref.sermon_id = sermon.id
     WHERE sermon.id = ANY($1::uuid[])
     GROUP BY sermon.id, sermon.title, review.completed_at, review.current_stage,
              review.identity_status, review.expected_transcript_sha256,
              transcript.status, transcript.body_text, passage.review_status,
              passage.reviewed_by_subject, passage.reviewed_at`,
    [ids, migration0015AppliedAt, legacyPassageCarryForwardActor,
      legacyPassageCarryForwardAction, legacyPassageCarryForwardAuthorization]
  );
  if (result.rowCount !== 15) {
    throw new LegacyPassageCarryForwardError("candidate_scope_mismatch", "Passage-review candidate rows are incomplete");
  }
  return result.rows;
}

async function verifyFinalState(client: PoolClient, ids: string[]): Promise<{
  confirmed: number;
  confirmedNone: number;
  pending: number;
  complete: number;
  publicRecords: number;
  semanticRows: number;
}> {
  const result = await client.query<{
    confirmed: number;
    confirmed_none: number;
    pending: number;
    complete: number;
    public_records: number;
    semantic_rows: number;
  }>(`SELECT
       count(*) FILTER (WHERE passage.review_status = 'confirmed_passage')::integer AS confirmed,
       count(*) FILTER (WHERE passage.review_status = 'confirmed_none')::integer AS confirmed_none,
       count(*) FILTER (WHERE passage.review_status = 'pending')::integer AS pending,
       count(*) FILTER (WHERE readiness.is_complete)::integer AS complete,
       count(*) FILTER (WHERE sermon.status = 'published')::integer AS public_records,
       (SELECT count(*)::integer FROM description_semantic_relationships relation
        WHERE relation.source_sermon_id = ANY($1::uuid[])
           OR relation.neighbour_sermon_id = ANY($1::uuid[])) AS semantic_rows
     FROM sermons sermon
     JOIN sermon_primary_passage_reviews passage ON passage.sermon_id = sermon.id
     JOIN sermon_content_readiness readiness ON readiness.sermon_id = sermon.id
     WHERE sermon.id = ANY($1::uuid[])`, [ids]);
  const row = result.rows[0];
  if (!row) throw new LegacyPassageCarryForwardError("final_state_missing", "Final passage state could not be verified");
  return {
    confirmed: row.confirmed,
    confirmedNone: row.confirmed_none,
    pending: row.pending,
    complete: row.complete,
    publicRecords: row.public_records,
    semanticRows: row.semantic_rows
  };
}

export async function carryForwardLegacyCompletedPassageReviews(
  pool: Pool
): Promise<LegacyPassageCarryForwardResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    const migration0015AppliedAt = await verifyTarget(client);
    await client.query("SELECT pg_advisory_xact_lock($1::integer, $2::integer)", [1_397_176_899, 1_397_112_016]);
    const scope = await readAndLockScope(client);
    const ids = scope.map((row) => row.id);
    const beforeHash = await protectedStateHash(client, ids);
    const candidates = await readCandidates(client, ids, migration0015AppliedAt);
    const classified = candidates.map((candidate) => ({
      candidate,
      classification: classifyLegacyCompletedPassage(candidate)
    }));
    const conflicts = classified.filter((item) => item.classification.outcome === "conflict");
    if (conflicts.length) {
      throw new LegacyPassageCarryForwardError(
        "carry_forward_state_conflict",
        "Existing carry-forward audit evidence conflicts with current passage state"
      );
    }
    const eligible = classified.filter((item) => item.classification.outcome === "carry_forward");
    const preserved = classified.filter((item) => item.classification.outcome === "preserved");
    if (eligible.length + preserved.length !== 9) {
      throw new LegacyPassageCarryForwardError(
        "eligible_count_mismatch",
        "The proven carry-forward population is no longer exactly nine records"
      );
    }
    const godsWill = classified.filter((item) =>
      item.candidate.title === "God's Will For The Local Church" &&
      item.candidate.passageReviewStatus === "confirmed_none"
    );
    if (godsWill.length !== 1) {
      throw new LegacyPassageCarryForwardError(
        "confirmed_none_preservation_failure",
        "The existing no-primary-passage decision is missing or changed"
      );
    }

    if (eligible.length) {
      const eligibleIds = eligible.map((item) => item.candidate.sermon_id);
      const decisionTime = await client.query<{ decided_at: Date }>("SELECT clock_timestamp() AS decided_at");
      const decidedAt = decisionTime.rows[0]!.decided_at;
      const referenceUpdate = await client.query(
        `UPDATE scripture_references
         SET review_status = 'confirmed', reviewer_subject = $2, reviewed_at = $3,
             updated_at = $3, row_version = row_version + 1
         WHERE sermon_id = ANY($1::uuid[]) AND review_status = 'proposed'
           AND relationship_role IN ('primary', 'supporting')`,
        [eligibleIds, legacyPassageCarryForwardActor, decidedAt]
      );
      if (referenceUpdate.rowCount !== eligible.reduce(
        (total, item) => total + item.candidate.proposedReferenceCount, 0
      )) {
        throw new LegacyPassageCarryForwardError(
          "passage_reference_update_mismatch",
          "The exact eligible passage relationships could not be confirmed"
        );
      }
      const reviewUpdate = await client.query(
        `UPDATE sermon_primary_passage_reviews
         SET review_status = 'confirmed_passage', reviewed_by_subject = $2,
             reviewed_at = $3, updated_at = $3, row_version = row_version + 1
         WHERE sermon_id = ANY($1::uuid[]) AND review_status = 'pending'`,
        [eligibleIds, legacyPassageCarryForwardActor, decidedAt]
      );
      if (reviewUpdate.rowCount !== eligibleIds.length) {
        throw new LegacyPassageCarryForwardError(
          "passage_review_update_mismatch",
          "The exact eligible passage decisions could not be carried forward"
        );
      }
      await client.query(
        `INSERT INTO audit_events (
           actor_subject, actor_role, action, entity_type, entity_id, changed_fields,
           request_correlation_id, outcome, created_at
         )
         SELECT $2, 'admin', $3, 'sermon', eligible_id,
                '["primaryPassageReview.reviewStatus","scriptureReferences.reviewStatus"]'::jsonb,
                $4, 'succeeded', $5
         FROM unnest($1::uuid[]) eligible_id`,
        [eligibleIds, legacyPassageCarryForwardActor, legacyPassageCarryForwardAction,
          legacyPassageCarryForwardAuthorization, decidedAt]
      );
      await client.query("SELECT refresh_sermon_enrichment(eligible_id) FROM unnest($1::uuid[]) eligible_id", [eligibleIds]);
    }

    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    const afterHash = await protectedStateHash(client, ids);
    if (beforeHash !== afterHash) {
      throw new LegacyPassageCarryForwardError(
        "protected_state_changed",
        "Transcript, description, Q&A or completed-review evidence changed"
      );
    }
    const final = await verifyFinalState(client, ids);
    if (final.confirmed !== 9 || final.confirmedNone !== 1 || final.pending !== 5 ||
        final.complete !== 10 || final.publicRecords !== 0 || final.semanticRows !== 0) {
      throw new LegacyPassageCarryForwardError(
        "final_state_mismatch",
        "The final passage, privacy or semantic state is not the expected bounded result"
      );
    }
    await client.query("COMMIT");
    return {
      outcome: "legacy_completed_passage_review_carry_forward_complete",
      inspectedRecords: 15,
      carriedForward: eligible.length,
      preservedFromPriorRun: preserved.length,
      leftPending: 5,
      confirmedNoPrimaryPreserved: 1,
      records: classified.map(({ candidate, classification }) => ({
        sermonId: candidate.sermon_id,
        title: candidate.title,
        passage: candidate.passage_display,
        outcome: candidate.passageReviewStatus === "confirmed_none"
          ? "explicit_decision_preserved"
          : classification.outcome === "carry_forward"
            ? "carried_forward"
            : classification.outcome === "preserved"
              ? "preserved"
              : "pending",
        reasons: candidate.passageReviewStatus === "confirmed_none"
          ? []
          : "reasons" in classification ? classification.reasons : []
      })),
      protectedStateSha256: afterHash,
      transcriptRowsChanged: 0,
      descriptionRowsChanged: 0,
      questionAnswerRowsChanged: 0,
      completedReviewRowsChanged: 0,
      publicRecordsCreated: 0,
      semanticRowsCreated: 0
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { AdminSermonService } from "../application/admin-sermon-service";
import { deterministicSourceUuid } from "../migration/identity";
import { PostgresAdminSermonRepository } from "../server/repositories/postgres-admin-sermon-repository";

export const wave1ReviewRepairActor = "local-wave1-review-metadata-repair" as const;
export const wave1ReviewRepairAction = "sermon.enrichment_review_metadata_repaired" as const;
export const wave1ReviewProcessingVersion = "phase3b2c-wave1-extractive-drafts-v2" as const;
const expectedWave1Count = 12;
const emptyItemSetSha256 = createHash("sha256").update("", "utf8").digest("hex");
const sourceRecordKeyPattern = /^authorised-record-[1-9][0-9]*$/u;

interface ReviewSnapshot {
  sermon_id: string;
  source_wordpress_id: string;
  immutable_evidence_sha256: string;
  identity_status: "pending" | "confirmed";
  current_stage: number;
  completed_review: boolean;
  empty_acknowledged: boolean;
  source_record_key: string | null;
  expected_item_count: number | null;
  expected_item_set_sha256: string | null;
  expected_transcript_sha256: string | null;
  expected_transcript_row_version: number | null;
  atomic_schema_version: number | null;
  transcript_sha256: string;
  transcript_row_version: number;
  stored_item_count: number;
  atomic_item_count: number;
  decision_count: number;
  blocking_review_audit_count: number;
  identity_audit_count: number;
  repair_audit_count: number;
  source_key_collision: boolean;
  transcript_exists: boolean;
  description_exists: boolean;
  qa_count: number;
  nonblank_qa_count: number;
  content_progress_count: number;
  private_draft: boolean;
  provenance_valid: boolean;
  warning_count: number;
  unresolved_marker_count: number;
  uncertainty_count_consistent: boolean;
}

export interface Wave1ReviewRepairResult {
  outcome: "repaired" | "unchanged";
  scopedReviewCount: number;
  repairedReviewCount: number;
  unchangedReviewCount: number;
  verifiedReviewSetCount: number;
  zeroFindingReviewSetCount: number;
  preservedIdentityConfirmationCount: number;
  preservedDecisionCount: number;
  completedReviewCount: number;
  approvalOrContentProgressCount: number;
  publicSearchCandidateCount: number;
  semanticEligibleCount: number;
  semanticBuildCount: number;
  semanticRelationshipCount: number;
  immutableEvidencePreserved: boolean;
}

export interface Wave1GuidedReviewApplicationResult {
  applicationVerifiedReviewSetCount: number;
  emptyAcknowledgementAvailableCount: number;
  stageTwoReadyCount: number;
  laterStagesLockedCount: number;
  contentDisplayed: false;
  identifiersDisplayed: false;
}

export class Wave1ReviewRepairError extends Error {
  constructor(
    public readonly code:
      | "database_target_mismatch"
      | "wave_scope_mismatch"
      | "content_or_provenance_mismatch"
      | "administrator_progress_requires_manual_reconciliation"
      | "review_metadata_shape_mismatch"
      | "repair_verification_failure",
    message: string
  ) {
    super(message);
    this.name = "Wave1ReviewRepairError";
  }
}

async function verifyTarget(client: PoolClient): Promise<void> {
  const result = await client.query<{
    database_ok: boolean;
    version_ok: boolean;
    loopback_ok: boolean;
    port_ok: boolean;
    migration_count: number;
    latest_migration: number;
    migrations_after_0013: number;
  }>(
    `SELECT
       current_database() = 'savinggrace_sermons_test' AS database_ok,
       current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS version_ok,
       inet_server_addr() = '127.0.0.1'::inet AS loopback_ok,
       inet_server_port() = 5432 AS port_ok,
       (SELECT count(*)::integer FROM schema_migrations) AS migration_count,
       (SELECT max(migration_order)::integer FROM schema_migrations) AS latest_migration,
       (SELECT count(*)::integer FROM schema_migrations WHERE migration_order > 13) AS migrations_after_0013`
  );
  const state = result.rows[0]!;
  if (!state.database_ok || !state.version_ok || !state.loopback_ok || !state.port_ok ||
    state.migration_count !== 13 || state.latest_migration !== 13 || state.migrations_after_0013 !== 0) {
    throw new Wave1ReviewRepairError(
      "database_target_mismatch",
      "The local PostgreSQL target or migration ledger did not match the authorised Wave 1 repair boundary"
    );
  }
}

async function semanticCounts(client: PoolClient): Promise<{
  eligible: number;
  builds: number;
  relationships: number;
}> {
  const result = await client.query<{ eligible: number; builds: number; relationships: number }>(
    `SELECT
       (SELECT count(*)::integer FROM sermon_description_semantic_eligibility) AS eligible,
       (SELECT count(*)::integer FROM description_semantic_builds) AS builds,
       (SELECT count(*)::integer FROM description_semantic_relationships) AS relationships`
  );
  return result.rows[0]!;
}

async function loadSnapshots(client: PoolClient, lockRows: boolean): Promise<ReviewSnapshot[]> {
  const result = await client.query<ReviewSnapshot>(
    `SELECT
       sermon.id AS sermon_id,
       sermon.source_wordpress_id::text AS source_wordpress_id,
       encode(digest(convert_to(jsonb_build_object(
         'sermon', to_jsonb(sermon),
         'transcript', to_jsonb(transcript),
         'question_answers', COALESCE((
           SELECT jsonb_agg(to_jsonb(qa) ORDER BY qa.id)
           FROM sermon_question_answers qa WHERE qa.sermon_id = sermon.id
         ), '[]'::jsonb),
         'source', to_jsonb(source),
         'review_progress', jsonb_build_object(
           'identity_status', review.identity_status,
           'current_stage', review.current_stage,
           'completed_by_subject', review.completed_by_subject,
           'completed_at', review.completed_at,
           'empty_acknowledged_by_subject', review.empty_item_set_acknowledged_by_subject,
           'empty_acknowledged_at', review.empty_item_set_acknowledged_at,
           'updated_by_subject', review.updated_by_subject,
           'updated_at', review.updated_at
         ),
         'review_items', COALESCE((
           SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)
           FROM sermon_enrichment_review_items item WHERE item.sermon_id = sermon.id
         ), '[]'::jsonb),
         'genuine_review_audit', COALESCE((
           SELECT jsonb_agg(to_jsonb(audit) ORDER BY audit.id)
           FROM audit_events audit
           WHERE audit.entity_id = sermon.id AND audit.action <> $2
         ), '[]'::jsonb)
       )::text, 'UTF8'), 'sha256'), 'hex') AS immutable_evidence_sha256,
       review.identity_status,
       review.current_stage,
       review.completed_at IS NOT NULL AS completed_review,
       review.empty_item_set_acknowledged_at IS NOT NULL AS empty_acknowledged,
       review.source_record_key,
       review.expected_item_count,
       review.expected_item_set_sha256,
       review.expected_transcript_sha256,
       review.expected_transcript_row_version,
       review.atomic_schema_version,
       encode(digest(convert_to(transcript.body_text, 'UTF8'), 'sha256'), 'hex') AS transcript_sha256,
       transcript.row_version AS transcript_row_version,
       (SELECT count(*)::integer FROM sermon_enrichment_review_items item
        WHERE item.sermon_id = sermon.id) AS stored_item_count,
       (SELECT count(*)::integer FROM sermon_enrichment_review_items item
        WHERE item.sermon_id = sermon.id AND item.item_identity_sha256 IS NOT NULL) AS atomic_item_count,
       (SELECT count(*)::integer FROM sermon_enrichment_review_items item
        WHERE item.sermon_id = sermon.id AND item.decision_status <> 'pending') AS decision_count,
       (SELECT count(*)::integer FROM audit_events audit
        WHERE audit.entity_id = sermon.id AND (
          audit.action LIKE 'sermon.enrichment_review_item_%'
          OR audit.action IN ('sermon.enrichment_zero_findings_acknowledged', 'sermon.enrichment_review_finished')
        )) AS blocking_review_audit_count,
       (SELECT count(*)::integer FROM audit_events audit
        WHERE audit.entity_id = sermon.id AND audit.action IN (
          'sermon.enrichment_identity_confirmed', 'sermon.enrichment_identity_reopened'
        )) AS identity_audit_count,
       (SELECT count(*)::integer FROM audit_events audit
        WHERE audit.entity_id = sermon.id AND audit.action = $2) AS repair_audit_count,
       EXISTS (
         SELECT 1 FROM sermon_enrichment_reviews other
         WHERE other.sermon_id <> sermon.id
           AND other.source_record_key = 'authorised-record-' || sermon.source_wordpress_id::text
       ) AS source_key_collision,
       char_length(transcript.body_text) > 0 AS transcript_exists,
       sermon.summary IS NOT NULL AND char_length(sermon.summary) > 0 AS description_exists,
       (SELECT count(*)::integer FROM sermon_question_answers qa WHERE qa.sermon_id = sermon.id) AS qa_count,
       (SELECT count(*)::integer FROM sermon_question_answers qa
        WHERE qa.sermon_id = sermon.id
          AND char_length(qa.question_text) > 0 AND char_length(qa.answer_text) > 0) AS nonblank_qa_count,
       ((CASE WHEN sermon.summary_status <> 'draft' OR sermon.summary_reviewed_at IS NOT NULL
          OR sermon.summary_approved_at IS NOT NULL THEN 1 ELSE 0 END)
        + (CASE WHEN transcript.status <> 'draft' OR transcript.reviewed_at IS NOT NULL
          OR transcript.approved_at IS NOT NULL THEN 1 ELSE 0 END)
        + (SELECT count(*) FROM sermon_question_answers qa
           WHERE qa.sermon_id = sermon.id AND (
             qa.status <> 'draft' OR qa.reviewed_at IS NOT NULL OR qa.approved_at IS NOT NULL
           )))::integer AS content_progress_count,
       sermon.status = 'draft' AND sermon.published_at IS NULL AS private_draft,
       source.source_content_sha256 ~ '^[0-9a-f]{64}$'
         AND source.retrieval_attribution = 'authorised_youtube_data_api'
         AND source.manual_attention_required
         AND source.accuracy_review_status = 'required' AS provenance_valid,
       jsonb_array_length(source.warnings) AS warning_count,
       jsonb_array_length(source.unresolved_passages) AS unresolved_marker_count,
       source.uncertainty_marker_count = jsonb_array_length(source.unresolved_passages)
         AS uncertainty_count_consistent
     FROM sermons sermon
     JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
     JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
     JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
     WHERE source.processing_version = $1
     ORDER BY sermon.source_wordpress_id, sermon.id
     ${lockRows ? "FOR UPDATE OF sermon, transcript, source, review" : ""}`,
    [wave1ReviewProcessingVersion, wave1ReviewRepairAction]
  );
  return result.rows;
}

function expectationsAreNull(record: ReviewSnapshot): boolean {
  return record.source_record_key === null && record.expected_item_count === null &&
    record.expected_item_set_sha256 === null && record.expected_transcript_sha256 === null &&
    record.expected_transcript_row_version === null && record.atomic_schema_version === null;
}

function expectationsAreVerified(record: ReviewSnapshot): boolean {
  return record.source_record_key !== null && sourceRecordKeyPattern.test(record.source_record_key) &&
    record.expected_item_count === 0 && record.expected_item_set_sha256 === emptyItemSetSha256 &&
    record.expected_transcript_sha256 === record.transcript_sha256 &&
    record.expected_transcript_row_version === record.transcript_row_version &&
    record.atomic_schema_version === 1 && record.stored_item_count === 0 && record.atomic_item_count === 0;
}

function assertSafeScope(records: readonly ReviewSnapshot[]): void {
  if (records.length !== expectedWave1Count || new Set(records.map((record) => record.sermon_id)).size !== expectedWave1Count ||
    new Set(records.map((record) => record.source_wordpress_id)).size !== expectedWave1Count) {
    throw new Wave1ReviewRepairError("wave_scope_mismatch", "The repair scope was not exactly the 12 Wave 1 review records");
  }
  for (const record of records) {
    if (!record.transcript_exists || !record.description_exists || record.qa_count !== 7 ||
      record.nonblank_qa_count !== 7 || !record.private_draft || !record.provenance_valid ||
      record.warning_count === 0 || record.unresolved_marker_count !== 0 ||
      !record.uncertainty_count_consistent || record.source_key_collision) {
      throw new Wave1ReviewRepairError(
        "content_or_provenance_mismatch",
        "A Wave 1 body, privacy, provenance, warning or zero-finding precondition did not match"
      );
    }
    if (record.completed_review || record.empty_acknowledged || record.decision_count !== 0 ||
      record.blocking_review_audit_count !== 0 || record.content_progress_count !== 0 ||
      record.current_stage > 2) {
      throw new Wave1ReviewRepairError(
        "administrator_progress_requires_manual_reconciliation",
        "Review decisions or content progress exist beyond the identity confirmation that this repair can preserve"
      );
    }
    if (!expectationsAreNull(record) && !expectationsAreVerified(record)) {
      throw new Wave1ReviewRepairError(
        "review_metadata_shape_mismatch",
        "Existing non-null Wave 1 review expectations do not form a verified zero-finding set"
      );
    }
  }
}

function immutableEvidence(records: readonly ReviewSnapshot[]): Map<string, string> {
  return new Map(records.map((record) => [record.sermon_id, record.immutable_evidence_sha256]));
}

async function publicCandidateCount(client: PoolClient): Promise<number> {
  const result = await client.query<{ total: number }>(
    `SELECT count(*)::integer AS total
     FROM sermons sermon
     JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
     WHERE source.processing_version = $1 AND sermon.status = 'published' AND sermon.deleted_at IS NULL`,
    [wave1ReviewProcessingVersion]
  );
  return result.rows[0]!.total;
}

export async function repairWave1GuidedReviewMetadata(pool: Pool): Promise<Wave1ReviewRepairResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await client.query("SELECT pg_advisory_xact_lock(1397176901, 1397176918)");
    await verifyTarget(client);
    const semanticsBefore = await semanticCounts(client);
    if (semanticsBefore.eligible !== 0 || semanticsBefore.builds !== 0 || semanticsBefore.relationships !== 0) {
      throw new Wave1ReviewRepairError(
        "content_or_provenance_mismatch",
        "Unexpected semantic data exists; the guided-review repair stopped without changing it"
      );
    }
    const before = await loadSnapshots(client, true);
    assertSafeScope(before);
    const beforeEvidence = immutableEvidence(before);
    const repairTargets = before.filter(expectationsAreNull);

    for (const record of repairTargets) {
      const sourceRecordKey = `authorised-record-${record.source_wordpress_id}`;
      const updated = await client.query(
        `UPDATE sermon_enrichment_reviews
         SET source_record_key = $2,
             expected_item_count = 0,
             expected_item_set_sha256 = $3,
             expected_transcript_sha256 = $4,
             expected_transcript_row_version = $5,
             atomic_schema_version = 1,
             row_version = row_version + 1
         WHERE sermon_id = $1
           AND source_record_key IS NULL
           AND expected_item_count IS NULL
           AND expected_item_set_sha256 IS NULL
           AND expected_transcript_sha256 IS NULL
           AND expected_transcript_row_version IS NULL
           AND atomic_schema_version IS NULL`,
        [record.sermon_id, sourceRecordKey, emptyItemSetSha256, record.transcript_sha256, record.transcript_row_version]
      );
      if (updated.rowCount !== 1) {
        throw new Wave1ReviewRepairError("repair_verification_failure", "A Wave 1 review row changed during repair");
      }
      await client.query(
        `INSERT INTO audit_events (
           id, actor_subject, actor_role, action, entity_type, entity_id,
           changed_fields, request_correlation_id, outcome
         ) VALUES ($1, $2, 'system', $3, 'sermon', $4,
           '["enrichmentReview.expectedItemSet"]'::jsonb, $5, 'succeeded')
         ON CONFLICT (id) DO NOTHING`,
        [
          deterministicSourceUuid("wave1-review-metadata-repair-audit", record.sermon_id),
          wave1ReviewRepairActor,
          wave1ReviewRepairAction,
          record.sermon_id,
          `wave1-review-repair-${record.sermon_id}`
        ]
      );
    }

    const after = await loadSnapshots(client, false);
    assertSafeScope(after);
    if (after.some((record) => !expectationsAreVerified(record))) {
      throw new Wave1ReviewRepairError("repair_verification_failure", "One or more Wave 1 review sets remain unverified");
    }
    if (after.some((record) => beforeEvidence.get(record.sermon_id) !== record.immutable_evidence_sha256)) {
      throw new Wave1ReviewRepairError(
        "repair_verification_failure",
        "Content, provenance, privacy, decisions or administrator progress changed during metadata repair"
      );
    }
    const semanticsAfter = await semanticCounts(client);
    const publicCandidates = await publicCandidateCount(client);
    if (semanticsAfter.eligible !== semanticsBefore.eligible || semanticsAfter.builds !== semanticsBefore.builds ||
      semanticsAfter.relationships !== semanticsBefore.relationships || publicCandidates !== 0 ||
      after.some((record) => record.repair_audit_count !== 1)) {
      throw new Wave1ReviewRepairError("repair_verification_failure", "Privacy, semantic or repair-audit verification failed");
    }
    await client.query("COMMIT");
    return {
      outcome: repairTargets.length > 0 ? "repaired" : "unchanged",
      scopedReviewCount: after.length,
      repairedReviewCount: repairTargets.length,
      unchangedReviewCount: after.length - repairTargets.length,
      verifiedReviewSetCount: after.filter(expectationsAreVerified).length,
      zeroFindingReviewSetCount: after.filter((record) => record.expected_item_count === 0).length,
      preservedIdentityConfirmationCount: after.filter((record) => record.identity_status === "confirmed").length,
      preservedDecisionCount: after.reduce((sum, record) => sum + record.decision_count, 0),
      completedReviewCount: after.filter((record) => record.completed_review).length,
      approvalOrContentProgressCount: after.reduce((sum, record) => sum + record.content_progress_count, 0),
      publicSearchCandidateCount: publicCandidates,
      semanticEligibleCount: semanticsAfter.eligible,
      semanticBuildCount: semanticsAfter.builds,
      semanticRelationshipCount: semanticsAfter.relationships,
      immutableEvidencePreserved: true
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyWave1GuidedReviewApplication(
  pool: Pool
): Promise<Wave1GuidedReviewApplicationResult> {
  const targets = await pool.query<{ id: string }>(
    `SELECT sermon.id
     FROM sermons sermon
     JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
     WHERE source.processing_version = $1
     ORDER BY sermon.source_wordpress_id, sermon.id`,
    [wave1ReviewProcessingVersion]
  );
  if (targets.rowCount !== expectedWave1Count ||
    new Set(targets.rows.map((target) => target.id)).size !== expectedWave1Count) {
    throw new Wave1ReviewRepairError(
      "wave_scope_mismatch",
      "The application verification scope was not exactly the 12 Wave 1 review records"
    );
  }

  const service = new AdminSermonService(new PostgresAdminSermonRepository(pool));
  const identity = { subject: "local-admin-0001", role: "admin" as const };
  const reviews = [];
  for (const target of targets.rows) {
    reviews.push(await service.enrichmentReviewDetail(target.id, identity));
  }
  const applicationVerifiedReviewSetCount = reviews.filter((review) =>
    review.progress.reviewSetVerified &&
    review.progress.itemSetMatches &&
    review.progress.transcriptMatchesExpected &&
    review.progress.totalItemCount === 0 &&
    review.items.length === 0
  ).length;
  const emptyAcknowledgementAvailableCount = reviews.filter((review) =>
    review.progress.requiresEmptyItemSetAcknowledgement &&
    !review.progress.stageCompletion.findings
  ).length;
  const stageTwoReadyCount = reviews.filter((review) =>
    review.review.identityStatus === "confirmed" &&
    review.review.currentStage === 2 &&
    review.progress.reviewSetVerified &&
    review.progress.requiresEmptyItemSetAcknowledgement
  ).length;
  const laterStagesLockedCount = reviews.filter((review) =>
    !review.progress.stageCompletion.findings &&
    !review.progress.stageCompletion.transcript &&
    !review.progress.stageCompletion.description &&
    !review.progress.stageCompletion.questionAnswers &&
    !review.progress.stageCompletion.final &&
    !review.progress.canFinish
  ).length;
  if (applicationVerifiedReviewSetCount !== expectedWave1Count ||
    emptyAcknowledgementAvailableCount !== expectedWave1Count ||
    stageTwoReadyCount !== 1 || laterStagesLockedCount !== expectedWave1Count) {
    throw new Wave1ReviewRepairError(
      "repair_verification_failure",
      "The guided-review application did not expose the repaired Wave 1 stage gates safely"
    );
  }
  return {
    applicationVerifiedReviewSetCount,
    emptyAcknowledgementAvailableCount,
    stageTwoReadyCount,
    laterStagesLockedCount,
    contentDisplayed: false,
    identifiersDisplayed: false
  };
}

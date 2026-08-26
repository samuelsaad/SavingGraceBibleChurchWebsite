import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { deterministicSourceUuid } from "../migration/identity";
import {
  applyIndisputableMechanicalCorrections,
  inspectGeneratedText,
  type GeneratedTextContentArea,
  type GeneratedTextMechanicalIssueCode
} from "./generated-text-mechanical-qa";

export const current15MechanicalQaActor = "local-current15-generated-text-mechanical-qa" as const;
export const current15MechanicalQaAction = "sermon.generated_text_mechanical_correction" as const;
export const current15MechanicalQaQueryVersion = "current15-generated-text-mechanical-qa-v1" as const;

const scopedProcessingVersions = [
  "phase3b2-caption-v1",
  "phase3b2b-punctuation-v2",
  "phase3b2c-wave1-extractive-drafts-v2"
] as const;

const expectedVersionCounts = new Map<string, number>([
  [scopedProcessingVersions[0], 1],
  [scopedProcessingVersions[1], 2],
  [scopedProcessingVersions[2], 12]
]);

interface QuestionAnswerRow {
  id: string;
  question: string;
  answer: string;
  status: "draft" | "in_review" | "approved";
  sourceKind: "manual" | "imported" | "generated_draft";
  sourceReference: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  rowVersion: number;
}

interface ScopedSermonRow {
  id: string;
  title: string;
  status: string;
  publishedAt: string | null;
  historicalBackfillRequired: boolean;
  rowVersion: number;
  summary: string | null;
  summaryStatus: "missing" | "draft" | "in_review" | "approved";
  summarySourceKind: "manual" | "imported" | "generated_draft";
  summarySourceReference: string | null;
  summaryReviewedAt: string | null;
  summaryApprovedAt: string | null;
  summaryRowVersion: number;
  processingVersion: string;
  questionAnswers: QuestionAnswerRow[];
}

interface EvidenceSnapshot {
  sermonProtectedSha256: string;
  sermonProtectedFieldHashes: Record<string, string>;
  transcriptProtectedSha256: string;
  sourceProtectedSha256: string;
  questionProtectedSha256: string;
  passageProtectedSha256: string;
  administratorEvidenceSha256: string;
  publicCandidateCount: number;
  semanticEligibleCount: number;
  semanticBuildCount: number;
  semanticRelationshipCount: number;
}

export interface SafeCorrectionSummary {
  sermon: string;
  contentArea: GeneratedTextContentArea;
  category: GeneratedTextMechanicalIssueCode;
  correctionCount: number;
}

export interface SafeFindingSummary {
  sermon: string;
  contentArea: GeneratedTextContentArea;
  category: GeneratedTextMechanicalIssueCode;
  severity: "blocking" | "review";
  findingCount: number;
}

export interface Current15MechanicalQaResult {
  outcome: "corrected" | "unchanged";
  queryVersion: typeof current15MechanicalQaQueryVersion;
  scopedSermonCount: number;
  pilotCount: number;
  waveOneCount: number;
  descriptionCount: number;
  questionAnswerCount: number;
  correctionCount: number;
  correctedSermonCount: number;
  correctionAuditCount: number;
  corrections: SafeCorrectionSummary[];
  unresolvedFindings: SafeFindingSummary[];
  approvedContentCorrectionCount: 0;
  privacyStatePreserved: true;
  administratorProgressPreserved: true;
  provenancePreserved: true;
  transcriptBodiesChanged: 0;
  semanticRowsChanged: 0;
}

export class Current15MechanicalQaError extends Error {
  constructor(
    public readonly code:
      | "database_target_mismatch"
      | "current15_scope_mismatch"
      | "approved_or_reviewed_content_requires_human_action"
      | "repair_verification_failure",
    message: string
  ) {
    super(message);
    this.name = "Current15MechanicalQaError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function verifyTarget(client: PoolClient): Promise<void> {
  const identity = await client.query<{
    databaseOk: boolean;
    versionOk: boolean;
    loopbackOk: boolean;
    portOk: boolean;
    migrationCount: number;
    latestMigration: number;
    migrationIds: string[];
  }>(`SELECT
      current_database() = 'savinggrace_sermons_test' AS "databaseOk",
      current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS "versionOk",
      inet_server_addr() = '127.0.0.1'::inet AS "loopbackOk",
      inet_server_port() = 5432 AS "portOk",
      (SELECT count(*)::integer FROM schema_migrations) AS "migrationCount",
      (SELECT max(migration_order)::integer FROM schema_migrations) AS "latestMigration",
      (SELECT array_agg(migration_id ORDER BY migration_order) FROM schema_migrations) AS "migrationIds"`);
  const expectedMigrations = [
    "0001_initial", "0002_admin_foundation", "0003_single_admin_deletion_seo",
    "0004_sermon_enrichment_readiness", "0005_approved_sermon_descriptions",
    "0006_phase3b2_pilot_provenance", "0007_guided_sermon_review",
    "0008_atomic_sermon_review_items", "0009_pilot_completion_safeguards",
    "0010_zero_finding_guided_review", "0011_description_semantic_relationships",
    "0012_description_semantic_runtime_provenance", "0013_official_youtube_caption_provenance",
    "0014_primary_preaching_passages"
  ];
  const state = identity.rows[0];
  if (!state || !state.databaseOk || !state.versionOk || !state.loopbackOk || !state.portOk ||
    state.migrationCount !== 14 || state.latestMigration !== 14 ||
    JSON.stringify(state.migrationIds) !== JSON.stringify(expectedMigrations)) {
    throw new Current15MechanicalQaError(
      "database_target_mismatch",
      "The PostgreSQL identity or migration ledger does not match the authorised current-15 boundary"
    );
  }
}

async function loadScope(client: PoolClient, lockRows: boolean): Promise<ScopedSermonRow[]> {
  const result = await client.query<{
    id: string;
    title: string;
    status: string;
    publishedAt: string | null;
    historicalBackfillRequired: boolean;
    rowVersion: number;
    summary: string | null;
    summaryStatus: ScopedSermonRow["summaryStatus"];
    summarySourceKind: ScopedSermonRow["summarySourceKind"];
    summarySourceReference: string | null;
    summaryReviewedAt: string | null;
    summaryApprovedAt: string | null;
    summaryRowVersion: number;
    processingVersion: string;
    questionAnswers: QuestionAnswerRow[];
  }>(`SELECT
      sermon.id,
      sermon.title,
      sermon.status,
      sermon.published_at::text AS "publishedAt",
      sermon.historical_backfill_required AS "historicalBackfillRequired",
      sermon.row_version AS "rowVersion",
      sermon.summary,
      sermon.summary_status AS "summaryStatus",
      sermon.summary_source_kind AS "summarySourceKind",
      sermon.summary_source_reference AS "summarySourceReference",
      sermon.summary_reviewed_at::text AS "summaryReviewedAt",
      sermon.summary_approved_at::text AS "summaryApprovedAt",
      sermon.summary_row_version AS "summaryRowVersion",
      source.processing_version AS "processingVersion",
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', qa.id,
        'question', qa.question_text,
        'answer', qa.answer_text,
        'status', qa.status,
        'sourceKind', qa.source_kind,
        'sourceReference', qa.source_reference,
        'reviewedAt', qa.reviewed_at,
        'approvedAt', qa.approved_at,
        'rowVersion', qa.row_version
      ) ORDER BY qa.display_order) FROM sermon_question_answers qa WHERE qa.sermon_id = sermon.id), '[]'::jsonb)
        AS "questionAnswers"
    FROM sermons sermon
    JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
    WHERE source.processing_version = ANY($1::text[])
    ORDER BY sermon.service_date, sermon.id
    ${lockRows ? "FOR UPDATE OF sermon, source" : ""}`,
  [scopedProcessingVersions]);
  return result.rows;
}

function assertScope(records: readonly ScopedSermonRow[]): void {
  if (records.length !== 15 || new Set(records.map((record) => record.id)).size !== 15) {
    throw new Current15MechanicalQaError("current15_scope_mismatch", "The generated-text QA scope is not exactly 15 sermons");
  }
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.processingVersion, (counts.get(record.processingVersion) ?? 0) + 1);
  if ([...expectedVersionCounts].some(([version, expected]) => counts.get(version) !== expected) ||
    [...counts].some(([version]) => !expectedVersionCounts.has(version))) {
    throw new Current15MechanicalQaError(
      "current15_scope_mismatch",
      "The three-pilot and 12-sermon Wave 1 processing-version counts do not match"
    );
  }
  if (records.some((record) => record.summary === null || record.questionAnswers.length < 5 || record.questionAnswers.length > 10)) {
    throw new Current15MechanicalQaError(
      "current15_scope_mismatch",
      "A current-15 description or Q&A set is missing or outside the approved size boundary"
    );
  }
}

async function evidenceSnapshot(client: PoolClient): Promise<EvidenceSnapshot> {
  const result = await client.query<EvidenceSnapshot>(`WITH scope AS (
      SELECT sermon.id
      FROM sermons sermon
      JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
      WHERE source.processing_version = ANY($1::text[])
    )
    SELECT
      encode(digest(convert_to((SELECT jsonb_agg(to_jsonb(sermon) - ARRAY[
          'summary', 'summary_updated_at', 'summary_row_version', 'updated_at', 'updated_by_subject',
          'summary_search_document', 'question_answer_search_document', 'search_vector', 'row_version'
        ]::text[] ORDER BY sermon.id) FROM sermons sermon JOIN scope ON scope.id = sermon.id)::text,
        'UTF8'), 'sha256'), 'hex') AS "sermonProtectedSha256",
      (SELECT jsonb_object_agg(field_name, field_sha256)
       FROM (
         SELECT field_name,
           encode(digest(convert_to(jsonb_agg(field_value ORDER BY sermon.id)::text, 'UTF8'), 'sha256'), 'hex') AS field_sha256
         FROM sermons sermon
         JOIN scope ON scope.id = sermon.id
         CROSS JOIN LATERAL jsonb_each(to_jsonb(sermon) - ARRAY[
           'summary', 'summary_updated_at', 'summary_row_version', 'updated_at', 'updated_by_subject',
           'summary_search_document', 'question_answer_search_document', 'search_vector', 'row_version'
         ]::text[]) fields(field_name, field_value)
         GROUP BY field_name
       ) hashes) AS "sermonProtectedFieldHashes",
      encode(digest(convert_to((SELECT jsonb_agg(to_jsonb(transcript) ORDER BY transcript.sermon_id)
          FROM sermon_transcripts transcript JOIN scope ON scope.id = transcript.sermon_id)::text,
        'UTF8'), 'sha256'), 'hex') AS "transcriptProtectedSha256",
      encode(digest(convert_to((SELECT jsonb_agg(to_jsonb(source) ORDER BY source.sermon_id)
          FROM sermon_enrichment_sources source JOIN scope ON scope.id = source.sermon_id)::text,
        'UTF8'), 'sha256'), 'hex') AS "sourceProtectedSha256",
      encode(digest(convert_to((SELECT jsonb_agg(to_jsonb(qa) - ARRAY[
          'question_text', 'answer_text', 'updated_at', 'row_version'
        ]::text[] ORDER BY qa.sermon_id, qa.display_order)
          FROM sermon_question_answers qa JOIN scope ON scope.id = qa.sermon_id)::text,
        'UTF8'), 'sha256'), 'hex') AS "questionProtectedSha256",
      encode(digest(convert_to((SELECT COALESCE(jsonb_agg(to_jsonb(review) ORDER BY review.sermon_id), '[]'::jsonb)
          FROM sermon_primary_passage_reviews review JOIN scope ON scope.id = review.sermon_id)::text,
        'UTF8'), 'sha256'), 'hex') AS "passageProtectedSha256",
      encode(digest(convert_to(jsonb_build_object(
        'reviews', (SELECT COALESCE(jsonb_agg(to_jsonb(review) ORDER BY review.sermon_id), '[]'::jsonb)
          FROM sermon_enrichment_reviews review JOIN scope ON scope.id = review.sermon_id),
        'items', (SELECT COALESCE(jsonb_agg(to_jsonb(item) ORDER BY item.sermon_id, item.display_order), '[]'::jsonb)
          FROM sermon_enrichment_review_items item JOIN scope ON scope.id = item.sermon_id),
        'decisions', (SELECT COALESCE(jsonb_agg(to_jsonb(audit) ORDER BY audit.id), '[]'::jsonb)
          FROM audit_events audit JOIN scope ON scope.id = audit.entity_id
          WHERE audit.action <> $2)
      )::text, 'UTF8'), 'sha256'), 'hex') AS "administratorEvidenceSha256",
      (SELECT count(*)::integer FROM sermons sermon JOIN scope ON scope.id = sermon.id
        WHERE sermon.status = 'published' AND sermon.deleted_at IS NULL) AS "publicCandidateCount",
      (SELECT count(*)::integer FROM sermon_description_semantic_eligibility) AS "semanticEligibleCount",
      (SELECT count(*)::integer FROM description_semantic_builds) AS "semanticBuildCount",
      (SELECT count(*)::integer FROM description_semantic_relationships) AS "semanticRelationshipCount"`,
    [scopedProcessingVersions, current15MechanicalQaAction]);
  return result.rows[0]!;
}

async function correctionAuditCount(client: PoolClient): Promise<number> {
  const result = await client.query<{ total: number }>(`WITH scope AS (
      SELECT sermon.id
      FROM sermons sermon
      JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
      WHERE source.processing_version = ANY($1::text[])
    )
    SELECT count(*)::integer AS total
    FROM audit_events audit
    JOIN scope ON scope.id = audit.entity_id
    WHERE audit.actor_subject = $2 AND audit.actor_role = 'system' AND audit.action = $3
      AND audit.outcome = 'succeeded'`,
    [scopedProcessingVersions, current15MechanicalQaActor, current15MechanicalQaAction]);
  return result.rows[0]!.total;
}

function groupFindings(records: readonly ScopedSermonRow[]): SafeFindingSummary[] {
  const grouped = new Map<string, SafeFindingSummary>();
  for (const record of records) {
    const report = inspectGeneratedText(record.summary ?? "", record.questionAnswers);
    for (const finding of report.issues) {
      const key = [record.title, finding.contentArea, finding.code, finding.severity].join("\u0000");
      const current = grouped.get(key);
      if (current) current.findingCount += 1;
      else grouped.set(key, {
        sermon: record.title,
        contentArea: finding.contentArea,
        category: finding.code,
        severity: finding.severity,
        findingCount: 1
      });
    }
  }
  return [...grouped.values()].sort((left, right) =>
    left.sermon.localeCompare(right.sermon) || left.contentArea.localeCompare(right.contentArea) ||
    left.category.localeCompare(right.category));
}

function addCorrections(
  target: SafeCorrectionSummary[],
  sermon: string,
  contentArea: GeneratedTextContentArea,
  corrections: Partial<Record<GeneratedTextMechanicalIssueCode, number>>,
  auditCategories: Set<string>
): void {
  for (const [category, count] of Object.entries(corrections) as Array<[GeneratedTextMechanicalIssueCode, number]>) {
    if (count <= 0) continue;
    const existing = target.find((item) =>
      item.sermon === sermon && item.contentArea === contentArea && item.category === category);
    if (existing) existing.correctionCount += count;
    else target.push({ sermon, contentArea, category, correctionCount: count });
    auditCategories.add(`${contentArea}.${category}`);
  }
}

export async function repairCurrent15GeneratedTextMechanicalQa(pool: Pool): Promise<Current15MechanicalQaResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await client.query("SELECT pg_advisory_xact_lock(1397176901, 1397176921)");
    await verifyTarget(client);
    const before = await loadScope(client, true);
    assertScope(before);
    const evidenceBefore = await evidenceSnapshot(client);
    const auditCountBefore = await correctionAuditCount(client);
    if (evidenceBefore.publicCandidateCount !== 0 || evidenceBefore.semanticEligibleCount !== 0 ||
      evidenceBefore.semanticBuildCount !== 0 || evidenceBefore.semanticRelationshipCount !== 0) {
      throw new Current15MechanicalQaError(
        "current15_scope_mismatch",
        "The current-15 privacy or no-semantic-data precondition does not match"
      );
    }

    const corrections: SafeCorrectionSummary[] = [];
    const affectedSermons = new Set<string>();
    const auditCategoriesBySermon = new Map<string, Set<string>>();
    for (const sermon of before) {
      const auditCategories = new Set<string>();
      auditCategoriesBySermon.set(sermon.id, auditCategories);
      const description = applyIndisputableMechanicalCorrections(sermon.summary ?? "");
      if (description.correctionCount > 0) {
        if (sermon.summaryStatus !== "draft" || sermon.summarySourceKind !== "generated_draft" ||
          sermon.summaryReviewedAt !== null || sermon.summaryApprovedAt !== null) {
          throw new Current15MechanicalQaError(
            "approved_or_reviewed_content_requires_human_action",
            "A mechanical description defect exists in content that is not an unreviewed generated draft"
          );
        }
        const updated = await client.query(
          `UPDATE sermons
           SET summary = $2, summary_updated_at = now(), summary_row_version = summary_row_version + 1
           WHERE id = $1 AND summary = $3 AND summary_status = 'draft'
             AND summary_source_kind = 'generated_draft'
             AND summary_reviewed_at IS NULL AND summary_approved_at IS NULL`,
          [sermon.id, description.text, sermon.summary]
        );
        if (updated.rowCount !== 1) {
          throw new Current15MechanicalQaError("repair_verification_failure", "A description changed during correction");
        }
        affectedSermons.add(sermon.id);
        addCorrections(corrections, sermon.title, "description", description.corrections, auditCategories);
      }

      for (const qa of sermon.questionAnswers) {
        const question = applyIndisputableMechanicalCorrections(qa.question);
        const answer = applyIndisputableMechanicalCorrections(qa.answer);
        if (question.correctionCount + answer.correctionCount === 0) continue;
        if (qa.status !== "draft" || qa.sourceKind !== "generated_draft" || qa.reviewedAt !== null || qa.approvedAt !== null) {
          throw new Current15MechanicalQaError(
            "approved_or_reviewed_content_requires_human_action",
            "A mechanical Q&A defect exists in content that is not an unreviewed generated draft"
          );
        }
        const updated = await client.query(
          `UPDATE sermon_question_answers
           SET question_text = $2, answer_text = $3, updated_at = now(), row_version = row_version + 1
           WHERE id = $1 AND question_text = $4 AND answer_text = $5 AND status = 'draft'
             AND source_kind = 'generated_draft' AND reviewed_at IS NULL AND approved_at IS NULL`,
          [qa.id, question.text, answer.text, qa.question, qa.answer]
        );
        if (updated.rowCount !== 1) {
          throw new Current15MechanicalQaError("repair_verification_failure", "A Q&A pair changed during correction");
        }
        affectedSermons.add(sermon.id);
        addCorrections(corrections, sermon.title, "question", question.corrections, auditCategories);
        addCorrections(corrections, sermon.title, "answer", answer.corrections, auditCategories);
      }
    }

    for (const sermonId of affectedSermons) {
      const original = before.find((record) => record.id === sermonId)!;
      await client.query(
        `UPDATE sermons
         SET updated_at = now(), updated_by_subject = $2, row_version = row_version + 1,
             historical_backfill_required = $3
         WHERE id = $1`,
        [sermonId, current15MechanicalQaActor, original.historicalBackfillRequired]
      );
      const auditCategories = [...(auditCategoriesBySermon.get(sermonId) ?? new Set<string>())].sort();
      const contentHash = sha256(JSON.stringify(auditCategories));
      await client.query(
        `INSERT INTO audit_events (
           id, actor_subject, actor_role, action, entity_type, entity_id,
           changed_fields, request_correlation_id, outcome
         ) VALUES ($1, $2, 'system', $3, 'sermon', $4, $5::jsonb, $6, 'succeeded')
         ON CONFLICT (id) DO NOTHING`,
        [
          deterministicSourceUuid("current15-generated-text-mechanical-qa-audit", `${sermonId}:${contentHash}`),
          current15MechanicalQaActor,
          current15MechanicalQaAction,
          sermonId,
          JSON.stringify(auditCategories),
          `current15-generated-text-mechanical-qa-${sermonId}-${contentHash.slice(0, 12)}`
        ]
      );
    }

    const after = await loadScope(client, false);
    assertScope(after);
    for (const original of before) {
      const current = after.find((record) => record.id === original.id)!;
      const expectedSummary = applyIndisputableMechanicalCorrections(original.summary ?? "").text;
      const descriptionChanged = expectedSummary !== original.summary;
      const sermonChanged = affectedSermons.has(original.id);
      if (current.summary !== expectedSummary || current.questionAnswers.length !== original.questionAnswers.length ||
        current.rowVersion !== original.rowVersion + (sermonChanged ? 1 : 0) ||
        current.summaryRowVersion !== original.summaryRowVersion + (descriptionChanged ? 1 : 0)) {
        throw new Current15MechanicalQaError("repair_verification_failure", "A corrected description or Q&A set does not match its exact expected result");
      }
      for (const originalQa of original.questionAnswers) {
        const currentQa = current.questionAnswers.find((item) => item.id === originalQa.id);
        const expectedQuestion = applyIndisputableMechanicalCorrections(originalQa.question).text;
        const expectedAnswer = applyIndisputableMechanicalCorrections(originalQa.answer).text;
        const qaChanged = expectedQuestion !== originalQa.question || expectedAnswer !== originalQa.answer;
        if (!currentQa || currentQa.question !== applyIndisputableMechanicalCorrections(originalQa.question).text ||
          currentQa.answer !== applyIndisputableMechanicalCorrections(originalQa.answer).text ||
          currentQa.rowVersion !== originalQa.rowVersion + (qaChanged ? 1 : 0)) {
          throw new Current15MechanicalQaError("repair_verification_failure", "A corrected Q&A pair does not match its exact expected result");
        }
      }
    }
    const evidenceAfter = await evidenceSnapshot(client);
    const auditCountAfter = await correctionAuditCount(client);
    const changedSermonFields = [...new Set([
      ...Object.keys(evidenceBefore.sermonProtectedFieldHashes),
      ...Object.keys(evidenceAfter.sermonProtectedFieldHashes)
    ])].filter((field) => evidenceBefore.sermonProtectedFieldHashes[field] !== evidenceAfter.sermonProtectedFieldHashes[field]);
    const changedEvidence = [
      evidenceAfter.sermonProtectedSha256 !== evidenceBefore.sermonProtectedSha256
        ? `sermon_protected_fields(${changedSermonFields.join("|")})`
        : null,
      evidenceAfter.transcriptProtectedSha256 !== evidenceBefore.transcriptProtectedSha256 ? "transcript" : null,
      evidenceAfter.sourceProtectedSha256 !== evidenceBefore.sourceProtectedSha256 ? "source_provenance" : null,
      evidenceAfter.questionProtectedSha256 !== evidenceBefore.questionProtectedSha256 ? "question_protected_fields" : null,
      evidenceAfter.passageProtectedSha256 !== evidenceBefore.passageProtectedSha256 ? "passage_evidence" : null,
      evidenceAfter.administratorEvidenceSha256 !== evidenceBefore.administratorEvidenceSha256 ? "administrator_progress" : null,
      evidenceAfter.publicCandidateCount !== evidenceBefore.publicCandidateCount ? "public_visibility" : null,
      evidenceAfter.semanticEligibleCount !== evidenceBefore.semanticEligibleCount ? "semantic_eligibility" : null,
      evidenceAfter.semanticBuildCount !== evidenceBefore.semanticBuildCount ? "semantic_builds" : null,
      evidenceAfter.semanticRelationshipCount !== evidenceBefore.semanticRelationshipCount ? "semantic_relationships" : null
    ].filter((item): item is string => item !== null);
    if (changedEvidence.length > 0) {
      throw new Current15MechanicalQaError(
        "repair_verification_failure",
        `Unexpected protected evidence change: ${changedEvidence.join(", ")}`
      );
    }
    if (auditCountAfter !== auditCountBefore + affectedSermons.size) {
      throw new Current15MechanicalQaError(
        "repair_verification_failure",
        "The safe system correction-audit count did not match the exact affected-sermon count"
      );
    }
    await client.query("COMMIT");
    return {
      outcome: corrections.length > 0 ? "corrected" : "unchanged",
      queryVersion: current15MechanicalQaQueryVersion,
      scopedSermonCount: after.length,
      pilotCount: after.filter((record) => record.processingVersion !== scopedProcessingVersions[2]).length,
      waveOneCount: after.filter((record) => record.processingVersion === scopedProcessingVersions[2]).length,
      descriptionCount: after.filter((record) => record.summary !== null).length,
      questionAnswerCount: after.reduce((sum, record) => sum + record.questionAnswers.length, 0),
      correctionCount: corrections.reduce((sum, item) => sum + item.correctionCount, 0),
      correctedSermonCount: affectedSermons.size,
      correctionAuditCount: auditCountAfter,
      corrections,
      unresolvedFindings: groupFindings(after),
      approvedContentCorrectionCount: 0,
      privacyStatePreserved: true,
      administratorProgressPreserved: true,
      provenancePreserved: true,
      transcriptBodiesChanged: 0,
      semanticRowsChanged: 0
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { lstat, mkdir, open, readFile } from "node:fs/promises";
import type { Pool, PoolClient } from "pg";
import { enrichmentDraftBundleSchema, type EnrichmentDraftBundle } from "./contracts";
import {
  lexicalWordOffsets,
  sermonEnrichmentRequestSchema,
  sermonEnrichmentRequestSha256,
  sermonEnrichmentResultSchema,
  sermonEnrichmentResultSha256,
  sha256Utf8,
  validateSermonEnrichmentResult,
  type CurrentApprovedTranscript,
  type SermonEnrichmentRequest,
  type SermonEnrichmentResult
} from "./sermon-enrichment-contracts";
import {
  groundedSermonEnrichmentSourceReference,
  sermonEnrichmentSkillName,
  sermonEnrichmentSkillVersion,
  supersededWave1GenerationVersion
} from "./sermon-enrichment-policy";
import { deterministicSourceUuid } from "../migration/identity";

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(sourceDirectory, "..", "..");
const privateRoot = join(repositoryRoot, "private", "phase-3b2c-wave1", "enrichment-repair");
const originalBundlePath = join(repositoryRoot, "private", "phase-3b2c-wave1", "prepared-private", "wave-01.private.json");
export const canaryRequestPath = join(privateRoot, "canary-request.private.json");
export const canaryResultPath = join(privateRoot, "canary-result.private.json");
export const canaryEvidencePath = join(privateRoot, "canary-import-evidence.private.json");
export const canaryReplacementActor = "local-sermon-enrichment-canary" as const;
export const canaryReplacementAction = "sermon.enrichment_draft_replaced" as const;
const expectedWaveOneCount = 12;
type Phase3Bundle = Extract<EnrichmentDraftBundle, { schemaVersion: 3 }>;

type TargetRow = {
  sermon_id: string;
  source_wordpress_id: string;
  sermon_status: string;
  published_at: string | null;
  sermon_row_version: number;
  summary: string | null;
  summary_status: string;
  summary_source_kind: string;
  summary_source_reference: string | null;
  summary_reviewed_at: string | null;
  summary_approved_at: string | null;
  summary_reviewed_by_subject: string | null;
  summary_approved_by_subject: string | null;
  transcript_body: string;
  transcript_status: string;
  transcript_row_version: number;
  transcript_approved_at: string | null;
  source_processing_version: string;
  source_evidence_sha256: string;
  review_evidence_sha256: string;
  genuine_audit_sha256: string;
  review_current_stage: number;
  review_completed_at: string | null;
};

type QuestionRow = {
  id: string;
  display_order: number;
  question_text: string;
  answer_text: string;
  status: string;
  source_kind: string;
  source_reference: string | null;
  reviewed_by_subject: string | null;
  approved_by_subject: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
};

export interface CanaryPreparationResult {
  outcome: "created" | "unchanged";
  transcriptApproved: true;
  transcriptBindingRecorded: true;
  originalBundlePreserved: true;
  privateRequest: true;
  contentDisplayed: false;
  identifiersDisplayed: false;
}

export interface CanaryValidationResult {
  valid: true;
  descriptionWordCount: number;
  questionAnswerCount: number;
  supportCount: number;
  maximumCopiedWordRun: number;
  mechanicalProofreadCompleted: true;
  mechanicalProofreadOutcome: "passed" | "passed_with_review_flags";
  mechanicalReviewFlagCount: number;
  transcriptBindingCurrent: true;
  originalBundlePreserved: true;
  privateDraftOnly: true;
  contentDisplayed: false;
  identifiersDisplayed: false;
}

export interface CanaryImportResult {
  outcome: "replaced_as_private_draft" | "unchanged";
  replacementCount: number;
  quarantinedRecordCount: number;
  replacementQuestionAnswerCount: number;
  approvalMarkerCount: number;
  publicCandidateCount: number;
  publicSearchCandidateCount: number;
  semanticEligibleCount: number;
  semanticBuildCount: number;
  semanticRelationshipCount: number;
  transcriptPreserved: true;
  sourceProvenancePreserved: true;
  administratorEvidencePreserved: true;
  otherWaveOneRecordsPreserved: true;
  supersededBundlePreserved: true;
  contentDisplayed: false;
  identifiersDisplayed: false;
}

export interface CanaryPreservedEvidence {
  transcriptSha256: string;
  sourceEvidenceSha256: string;
  reviewEvidenceSha256: string;
  genuineAdministratorAuditSha256: string;
  otherWaveOneEvidenceSha256: string;
  supersededBundleSha256: string;
}

export function canaryPreservedEvidenceMatches(
  before: CanaryPreservedEvidence,
  after: CanaryPreservedEvidence
): boolean {
  return canonical(before) === canonical(after);
}

export class SermonEnrichmentCanaryError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SermonEnrichmentCanaryError";
  }
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  const sort = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sort(nested)]));
    }
    return input;
  };
  return JSON.stringify(sort(value));
}

function questionAnswerSetSha256(items: readonly { question: string; answer: string }[]): string {
  return sha256Utf8(canonical(items.map((item, index) => ({
    displayOrder: index + 1,
    questionSha256: sha256Utf8(item.question),
    answerSha256: sha256Utf8(item.answer)
  }))));
}

async function loadPrivateJson(path: string): Promise<{ bytes: Buffer; value: unknown }> {
  const file = await lstat(path).catch(() => null);
  if (!file?.isFile() || file.isSymbolicLink()) {
    throw new SermonEnrichmentCanaryError("private_artifact_invalid", "A required private enrichment artifact is unavailable");
  }
  const bytes = await readFile(path);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) as unknown };
}

function safePrivateRelativePath(path: string): string {
  const value = relative(repositoryRoot, path).split(sep).join("/");
  if (!value.startsWith("private/phase-3b2c-wave1/") || value.includes("..")) {
    throw new SermonEnrichmentCanaryError("private_path_invalid", "A private enrichment path escaped its approved root");
  }
  return value;
}

async function persistPrivateNoClobber(
  path: string,
  value: unknown,
  equivalent: (existing: unknown) => boolean
): Promise<"created" | "unchanged"> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  try {
    const handle = await open(path, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return "created";
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    const existing = (await loadPrivateJson(path)).value;
    if (!equivalent(existing)) {
      throw new SermonEnrichmentCanaryError("private_artifact_conflict", "An existing private enrichment artifact differs from the current operation");
    }
    return "unchanged";
  }
}

async function verifyDatabaseTarget(client: PoolClient): Promise<void> {
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
  const row = result.rows[0]!;
  if (!row.database_ok || !row.version_ok || !row.loopback_ok || !row.port_ok || row.migration_count !== 13 ||
    row.latest_migration !== 13 || row.migrations_after_0013 !== 0) {
    throw new SermonEnrichmentCanaryError("database_target_mismatch", "The local PostgreSQL target or migration ledger is outside the authorised canary boundary");
  }
}

async function loadOriginalBundle(): Promise<{ bundle: Phase3Bundle; bytes: Buffer; bundleSha256: string }> {
  const loaded = await loadPrivateJson(originalBundlePath);
  const bundle = enrichmentDraftBundleSchema.parse(loaded.value);
  if (bundle.schemaVersion !== 3 || bundle.questionAnswers.length !== 7 ||
    bundle.sourceProvenance.processingVersion !== supersededWave1GenerationVersion) {
    throw new SermonEnrichmentCanaryError("original_bundle_mismatch", "The original Wave 1 canary bundle does not match the superseded generation scope");
  }
  return { bundle, bytes: loaded.bytes, bundleSha256: sha256Bytes(loaded.bytes) };
}

async function loadTarget(client: PoolClient, bundle: EnrichmentDraftBundle, lock: boolean): Promise<TargetRow> {
  const result = await client.query<TargetRow>(
    `SELECT
       sermon.id AS sermon_id,
       sermon.source_wordpress_id::text AS source_wordpress_id,
       sermon.status AS sermon_status,
       sermon.published_at::text AS published_at,
       sermon.row_version AS sermon_row_version,
       sermon.summary,
       sermon.summary_status,
       sermon.summary_source_kind,
       sermon.summary_source_reference,
       sermon.summary_reviewed_at::text,
       sermon.summary_approved_at::text,
       sermon.summary_reviewed_by_subject,
       sermon.summary_approved_by_subject,
       transcript.body_text AS transcript_body,
       transcript.status AS transcript_status,
       transcript.row_version AS transcript_row_version,
       transcript.approved_at::text AS transcript_approved_at,
       source.processing_version AS source_processing_version,
       encode(digest(convert_to(to_jsonb(source)::text, 'UTF8'), 'sha256'), 'hex') AS source_evidence_sha256,
       encode(digest(convert_to(to_jsonb(review)::text, 'UTF8'), 'sha256'), 'hex') AS review_evidence_sha256,
       encode(digest(convert_to(COALESCE((
         SELECT jsonb_agg(to_jsonb(audit) ORDER BY audit.id)
         FROM audit_events audit
         WHERE audit.entity_id = sermon.id AND audit.action <> $3
       ), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex') AS genuine_audit_sha256,
       review.current_stage AS review_current_stage,
       review.completed_at::text AS review_completed_at
     FROM sermons sermon
     JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
     JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
     JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
     WHERE sermon.id = $1 AND sermon.source_wordpress_id = $2
     ${lock ? "FOR UPDATE OF sermon, transcript, source, review" : ""}`,
    [bundle.targetSermonId, bundle.sourceWordPressId, canaryReplacementAction]
  );
  if (result.rowCount !== 1) {
    throw new SermonEnrichmentCanaryError("target_identity_mismatch", "The stable source and application identities did not resolve one canary sermon");
  }
  return result.rows[0]!;
}

async function loadQuestions(client: PoolClient, sermonId: string, lock: boolean): Promise<QuestionRow[]> {
  const result = await client.query<QuestionRow>(
    `SELECT id, display_order, question_text, answer_text, status, source_kind, source_reference,
            reviewed_by_subject, approved_by_subject, reviewed_at::text, approved_at::text
     FROM sermon_question_answers
     WHERE sermon_id = $1
     ORDER BY display_order
     ${lock ? "FOR UPDATE" : ""}`,
    [sermonId]
  );
  return result.rows;
}

function currentTranscript(row: TargetRow): CurrentApprovedTranscript {
  if (row.transcript_status !== "approved" || !row.transcript_approved_at) {
    throw new SermonEnrichmentCanaryError("approved_transcript_required", "The canary does not have a current approved transcript");
  }
  return {
    sermonId: row.sermon_id,
    sourceWordPressId: Number(row.source_wordpress_id),
    rowVersion: row.transcript_row_version,
    status: "approved",
    approvedAt: new Date(row.transcript_approved_at).toISOString(),
    bodyText: row.transcript_body
  };
}

function assertPrivateDraftTarget(row: TargetRow): void {
  if (row.sermon_status !== "draft" || row.published_at !== null || row.source_processing_version !== supersededWave1GenerationVersion ||
    row.review_completed_at !== null) {
    throw new SermonEnrichmentCanaryError("target_state_mismatch", "The canary is not an incomplete private Wave 1 draft");
  }
}

function originalMatchesDatabase(row: TargetRow, questions: readonly QuestionRow[], bundle: EnrichmentDraftBundle): boolean {
  return row.summary === bundle.description.bodyText && row.summary_status === "draft" &&
    row.summary_source_kind === bundle.description.provenance.sourceKind &&
    row.summary_source_reference === bundle.description.provenance.sourceReference &&
    row.summary_reviewed_at === null && row.summary_approved_at === null &&
    row.summary_reviewed_by_subject === null && row.summary_approved_by_subject === null &&
    questions.length === bundle.questionAnswers.length && questions.every((question, index) => {
      const expected = bundle.questionAnswers[index]!;
      return question.display_order === index + 1 && question.question_text === expected.question &&
        question.answer_text === expected.answer && question.status === "draft" &&
        question.source_kind === expected.provenance.sourceKind &&
        question.source_reference === expected.provenance.sourceReference &&
        question.reviewed_by_subject === null && question.approved_by_subject === null &&
        question.reviewed_at === null && question.approved_at === null;
    });
}

function buildRequest(
  row: TargetRow,
  bundle: EnrichmentDraftBundle,
  bundleSha256: string,
  requestedAt: string
): SermonEnrichmentRequest {
  const transcript = currentTranscript(row);
  const withoutIntegrity: Omit<SermonEnrichmentRequest, "integrity"> = {
    schemaVersion: 1,
    privateContent: true,
    skillName: sermonEnrichmentSkillName,
    skillVersion: sermonEnrichmentSkillVersion,
    requestedAt,
    target: { sourceWordPressId: transcript.sourceWordPressId, sermonId: transcript.sermonId },
    transcript: {
      sermonId: transcript.sermonId,
      rowVersion: transcript.rowVersion,
      status: "approved",
      approvedAt: transcript.approvedAt,
      sha256: sha256Utf8(transcript.bodyText),
      characterCount: transcript.bodyText.length,
      wordCount: lexicalWordOffsets(transcript.bodyText).length,
      bodyText: transcript.bodyText
    },
    original: {
      bundleRelativePath: safePrivateRelativePath(originalBundlePath),
      bundleSha256,
      descriptionSha256: sha256Utf8(bundle.description.bodyText),
      questionAnswerSetSha256: questionAnswerSetSha256(bundle.questionAnswers)
    },
    requirements: {
      descriptionWordMinimum: 180,
      descriptionWordMaximum: 220,
      questionAnswerMinimum: 5,
      questionAnswerMaximum: 10,
      questionAnswerTarget: 7,
      privateDraftOnly: true,
      administratorApprovalRequired: true
    }
  };
  return sermonEnrichmentRequestSchema.parse({
    ...withoutIntegrity,
    integrity: { canonicalSha256: sermonEnrichmentRequestSha256(withoutIntegrity) }
  });
}

function requestEquivalent(existing: unknown, current: SermonEnrichmentRequest): boolean {
  const parsed = sermonEnrichmentRequestSchema.safeParse(existing);
  if (!parsed.success || parsed.data.integrity.canonicalSha256 !== sermonEnrichmentRequestSha256(parsed.data)) return false;
  const left = { ...parsed.data, requestedAt: current.requestedAt, integrity: current.integrity };
  return canonical(left) === canonical(current);
}

export async function prepareSermonEnrichmentCanary(pool: Pool): Promise<CanaryPreparationResult> {
  const original = await loadOriginalBundle();
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await verifyDatabaseTarget(client);
    const row = await loadTarget(client, original.bundle, false);
    const questions = await loadQuestions(client, row.sermon_id, false);
    assertPrivateDraftTarget(row);
    currentTranscript(row);
    if (!originalMatchesDatabase(row, questions, original.bundle)) {
      throw new SermonEnrichmentCanaryError("original_content_or_progress_mismatch", "The defective draft bodies or administrator decision state no longer match the preserved bundle");
    }
    const request = buildRequest(row, original.bundle, original.bundleSha256, new Date().toISOString());
    await client.query("COMMIT");
    const outcome = await persistPrivateNoClobber(canaryRequestPath, request, (existing) => requestEquivalent(existing, request));
    return {
      outcome,
      transcriptApproved: true,
      transcriptBindingRecorded: true,
      originalBundlePreserved: true,
      privateRequest: true,
      contentDisplayed: false,
      identifiersDisplayed: false
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function loadRequestAndResult(): Promise<{ request: SermonEnrichmentRequest; result: SermonEnrichmentResult }> {
  const request = sermonEnrichmentRequestSchema.parse((await loadPrivateJson(canaryRequestPath)).value);
  const result = sermonEnrichmentResultSchema.parse((await loadPrivateJson(canaryResultPath)).value);
  if (request.integrity.canonicalSha256 !== sermonEnrichmentRequestSha256(request) ||
    result.integrity.canonicalSha256 !== sermonEnrichmentResultSha256(result) ||
    result.requestSha256 !== request.integrity.canonicalSha256 ||
    result.skillVersion !== request.skillVersion ||
    canonical(result.target) !== canonical(request.target) || canonical(result.transcript) !== canonical({ ...request.transcript, bodyText: undefined }) ||
    canonical(result.original) !== canonical(request.original)) {
    throw new SermonEnrichmentCanaryError("request_result_binding_mismatch", "The private generation result does not match its exact request or original evidence");
  }
  return { request, result };
}

async function validateAgainstDatabase(
  client: PoolClient,
  original: Awaited<ReturnType<typeof loadOriginalBundle>>,
  result: SermonEnrichmentResult,
  lock: boolean
): Promise<{ row: TargetRow; questions: QuestionRow[]; validation: ReturnType<typeof validateSermonEnrichmentResult> }> {
  const row = await loadTarget(client, original.bundle, lock);
  const questions = await loadQuestions(client, row.sermon_id, lock);
  assertPrivateDraftTarget(row);
  const validation = validateSermonEnrichmentResult(result, currentTranscript(row));
  if (!validation.valid) {
    throw new SermonEnrichmentCanaryError(
      "grounded_result_validation_failed",
      `The canary result failed ${validation.issues.length} private structure, transcript-binding or grounding checks`
    );
  }
  return { row, questions, validation };
}

export async function validateSermonEnrichmentCanary(pool: Pool): Promise<CanaryValidationResult> {
  const original = await loadOriginalBundle();
  const { result } = await loadRequestAndResult();
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await verifyDatabaseTarget(client);
    const { validation } = await validateAgainstDatabase(client, original, result, false);
    if ((await lstat(originalBundlePath)).isSymbolicLink() || sha256Bytes(await readFile(originalBundlePath)) !== result.original.bundleSha256) {
      throw new SermonEnrichmentCanaryError("original_bundle_mismatch", "The preserved original private bundle changed");
    }
    await client.query("COMMIT");
    return {
      valid: true,
      descriptionWordCount: validation.metrics.descriptionWordCount,
      questionAnswerCount: validation.metrics.questionAnswerCount,
      supportCount: validation.metrics.supportCount,
      maximumCopiedWordRun: validation.metrics.maximumCopiedWordRun,
      mechanicalProofreadCompleted: true,
      mechanicalProofreadOutcome: validation.mechanicalQa!.outcome as "passed" | "passed_with_review_flags",
      mechanicalReviewFlagCount: validation.mechanicalQa!.reviewIssueCount,
      transcriptBindingCurrent: true,
      originalBundlePreserved: true,
      privateDraftOnly: true,
      contentDisplayed: false,
      identifiersDisplayed: false
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function waveOneCounts(client: PoolClient): Promise<{
  scoped: number;
  replacements: number;
  quarantined: number;
  replacement_qas: number;
  approval_markers: number;
  public_candidates: number;
  public_search_candidates: number;
  semantic_eligible: number;
  semantic_builds: number;
  semantic_relationships: number;
}> {
  const result = await client.query<{
    scoped: number;
    replacements: number;
    quarantined: number;
    replacement_qas: number;
    approval_markers: number;
    public_candidates: number;
    public_search_candidates: number;
    semantic_eligible: number;
    semantic_builds: number;
    semantic_relationships: number;
  }>(
    `SELECT
       count(DISTINCT sermon.id)::integer AS scoped,
       count(DISTINCT sermon.id) FILTER (WHERE sermon.summary_source_reference LIKE 'sermon-enrichment:v1:%')::integer AS replacements,
       count(DISTINCT sermon.id) FILTER (WHERE sermon.summary_source_reference LIKE '%:' || $2)::integer AS quarantined,
       count(qa.id) FILTER (WHERE qa.source_reference LIKE 'sermon-enrichment:v1:%')::integer AS replacement_qas,
       (count(DISTINCT sermon.id) FILTER (WHERE sermon.summary_status <> 'draft' OR sermon.summary_reviewed_at IS NOT NULL OR sermon.summary_approved_at IS NOT NULL)
        + count(qa.id) FILTER (WHERE qa.status <> 'draft' OR qa.reviewed_at IS NOT NULL OR qa.approved_at IS NOT NULL))::integer AS approval_markers,
       count(DISTINCT sermon.id) FILTER (WHERE sermon.status = 'published' OR sermon.published_at IS NOT NULL)::integer AS public_candidates,
       count(DISTINCT sermon.id) FILTER (WHERE sermon.status = 'published' AND sermon.deleted_at IS NULL AND sermon.summary_status = 'approved')::integer AS public_search_candidates,
       (SELECT count(*)::integer FROM sermon_description_semantic_eligibility) AS semantic_eligible,
       (SELECT count(*)::integer FROM description_semantic_builds) AS semantic_builds,
       (SELECT count(*)::integer FROM description_semantic_relationships) AS semantic_relationships
     FROM sermons sermon
     JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id AND source.processing_version = $1
     LEFT JOIN sermon_question_answers qa ON qa.sermon_id = sermon.id`,
    [supersededWave1GenerationVersion, supersededWave1GenerationVersion]
  );
  return result.rows[0]!;
}

async function otherWaveOneEvidence(client: PoolClient, targetId: string): Promise<string> {
  const result = await client.query<{ evidence: string }>(
    `SELECT encode(digest(convert_to(COALESCE(jsonb_agg(payload ORDER BY source_wordpress_id), '[]'::jsonb)::text, 'UTF8'), 'sha256'), 'hex') AS evidence
     FROM (
       SELECT sermon.source_wordpress_id,
              jsonb_build_object(
                'sermon', to_jsonb(sermon),
                'transcript', to_jsonb(transcript),
                'source', to_jsonb(source),
                'review', to_jsonb(review),
                'questions', COALESCE((SELECT jsonb_agg(to_jsonb(qa) ORDER BY qa.id) FROM sermon_question_answers qa WHERE qa.sermon_id = sermon.id), '[]'::jsonb),
                'audit', COALESCE((SELECT jsonb_agg(to_jsonb(audit) ORDER BY audit.id) FROM audit_events audit WHERE audit.entity_id = sermon.id), '[]'::jsonb)
              ) AS payload
       FROM sermons sermon
       JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
       JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
       JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
       WHERE source.processing_version = $1 AND sermon.id <> $2
     ) evidence_rows`,
    [supersededWave1GenerationVersion, targetId]
  );
  return result.rows[0]!.evidence;
}

function isReplacementState(row: TargetRow, questions: readonly QuestionRow[], result: SermonEnrichmentResult, reference: string): boolean {
  return row.summary === result.description.bodyText && row.summary_status === "draft" &&
    row.summary_source_kind === "generated_draft" && row.summary_source_reference === reference &&
    row.summary_reviewed_at === null && row.summary_approved_at === null &&
    row.summary_reviewed_by_subject === null && row.summary_approved_by_subject === null &&
    questions.length === result.questionAnswers.length && questions.every((question, index) => {
      const expected = result.questionAnswers[index]!;
      return question.display_order === expected.displayOrder && question.question_text === expected.question &&
        question.answer_text === expected.answer && question.status === "draft" &&
        question.source_kind === "generated_draft" && question.source_reference === reference &&
        question.reviewed_by_subject === null && question.approved_by_subject === null &&
        question.reviewed_at === null && question.approved_at === null;
    });
}

export async function importSermonEnrichmentCanary(pool: Pool): Promise<CanaryImportResult> {
  const original = await loadOriginalBundle();
  const { result } = await loadRequestAndResult();
  const reference = groundedSermonEnrichmentSourceReference(
    result.transcript.sha256,
    result.transcript.rowVersion,
    result.integrity.canonicalSha256
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await client.query("SELECT pg_advisory_xact_lock(1397176901, 1397176921)");
    await verifyDatabaseTarget(client);
    const checked = await validateAgainstDatabase(client, original, result, true);
    const beforeTranscript = sha256Utf8(canonical({
      body: checked.row.transcript_body,
      status: checked.row.transcript_status,
      rowVersion: checked.row.transcript_row_version,
      approvedAt: checked.row.transcript_approved_at
    }));
    const beforeSource = checked.row.source_evidence_sha256;
    const beforeReview = checked.row.review_evidence_sha256;
    const beforeAudit = checked.row.genuine_audit_sha256;
    const otherEvidence = await otherWaveOneEvidence(client, checked.row.sermon_id);
    const alreadyReplaced = isReplacementState(checked.row, checked.questions, result, reference);
    if (!alreadyReplaced && !originalMatchesDatabase(checked.row, checked.questions, original.bundle)) {
      throw new SermonEnrichmentCanaryError("administrator_or_content_conflict", "The canary content or administrator state changed; replacement was refused");
    }

    if (!alreadyReplaced) {
      const updatedDescription = await client.query(
        `UPDATE sermons
         SET summary = $2,
             summary_status = 'draft',
             summary_source_kind = 'generated_draft',
             summary_source_reference = $3,
             summary_updated_at = now(),
             summary_reviewed_by_subject = NULL,
             summary_approved_by_subject = NULL,
             summary_reviewed_at = NULL,
             summary_approved_at = NULL,
             summary_row_version = summary_row_version + 1,
             updated_by_subject = $4,
             updated_at = now(),
             row_version = row_version + 1
         WHERE id = $1 AND summary_status = 'draft' AND summary_source_reference = $5`,
        [checked.row.sermon_id, result.description.bodyText, reference, canaryReplacementActor, original.bundle.description.provenance.sourceReference]
      );
      if (updatedDescription.rowCount !== 1) {
        throw new SermonEnrichmentCanaryError("atomic_replacement_conflict", "The description changed during the atomic replacement");
      }
      for (const item of result.questionAnswers) {
        const existing = checked.questions[item.displayOrder - 1]!;
        const updatedQuestion = await client.query(
          `UPDATE sermon_question_answers
           SET question_text = $3,
               answer_text = $4,
               status = 'draft',
               source_kind = 'generated_draft',
               source_reference = $5,
               reviewed_by_subject = NULL,
               approved_by_subject = NULL,
               reviewed_at = NULL,
               approved_at = NULL,
               updated_at = now(),
               row_version = row_version + 1
           WHERE id = $1 AND sermon_id = $2 AND display_order = $6
             AND status = 'draft' AND source_reference = $7`,
          [existing.id, checked.row.sermon_id, item.question, item.answer, reference, item.displayOrder, original.bundle.questionAnswers[item.displayOrder - 1]!.provenance.sourceReference]
        );
        if (updatedQuestion.rowCount !== 1) {
          throw new SermonEnrichmentCanaryError("atomic_replacement_conflict", "A Q&A pair changed during the atomic replacement");
        }
      }
      await client.query(
        `INSERT INTO audit_events (
           id, actor_subject, actor_role, action, entity_type, entity_id,
           changed_fields, request_correlation_id, outcome
         ) VALUES ($1, $2, 'system', $3, 'sermon', $4,
           '["summary","summarySourceReference","questionAnswers"]'::jsonb, $5, 'succeeded')
         ON CONFLICT (id) DO NOTHING`,
        [
          deterministicSourceUuid("sermon-enrichment-canary-replacement", result.integrity.canonicalSha256),
          canaryReplacementActor,
          canaryReplacementAction,
          checked.row.sermon_id,
          `sermon-enrichment-canary-${result.integrity.canonicalSha256.slice(0, 16)}`
        ]
      );
    }

    const after = await validateAgainstDatabase(client, original, result, false);
    if (!isReplacementState(after.row, after.questions, result, reference)) {
      throw new SermonEnrichmentCanaryError("replacement_verification_failed", "The stored replacement does not exactly match the validated private result");
    }
    const afterTranscript = sha256Utf8(canonical({
      body: after.row.transcript_body,
      status: after.row.transcript_status,
      rowVersion: after.row.transcript_row_version,
      approvedAt: after.row.transcript_approved_at
    }));
    const preservationBefore: CanaryPreservedEvidence = {
      transcriptSha256: beforeTranscript,
      sourceEvidenceSha256: beforeSource,
      reviewEvidenceSha256: beforeReview,
      genuineAdministratorAuditSha256: beforeAudit,
      otherWaveOneEvidenceSha256: otherEvidence,
      supersededBundleSha256: result.original.bundleSha256
    };
    const preservationAfter: CanaryPreservedEvidence = {
      transcriptSha256: afterTranscript,
      sourceEvidenceSha256: after.row.source_evidence_sha256,
      reviewEvidenceSha256: after.row.review_evidence_sha256,
      genuineAdministratorAuditSha256: after.row.genuine_audit_sha256,
      otherWaveOneEvidenceSha256: await otherWaveOneEvidence(client, after.row.sermon_id),
      supersededBundleSha256: sha256Bytes(await readFile(originalBundlePath))
    };
    if (!canaryPreservedEvidenceMatches(preservationBefore, preservationAfter)) {
      throw new SermonEnrichmentCanaryError("preservation_verification_failed", "Transcript, provenance, administrator evidence or another Wave 1 record changed");
    }
    const counts = await waveOneCounts(client);
    if (counts.scoped !== expectedWaveOneCount || counts.replacements !== 1 || counts.quarantined !== 11 ||
      counts.replacement_qas !== result.questionAnswers.length || counts.approval_markers !== 0 ||
      counts.public_candidates !== 0 || counts.public_search_candidates !== 0 || counts.semantic_eligible !== 0 ||
      counts.semantic_builds !== 0 || counts.semantic_relationships !== 0 ||
      sha256Bytes(await readFile(originalBundlePath)) !== result.original.bundleSha256) {
      throw new SermonEnrichmentCanaryError("scope_or_privacy_verification_failed", "Wave 1 scope, privacy, semantic or superseded-bundle verification failed");
    }
    await client.query("COMMIT");
    const evidence = {
      schemaVersion: 1,
      privateContent: true,
      resultSha256: result.integrity.canonicalSha256,
      importedAt: new Date().toISOString(),
      outcome: alreadyReplaced ? "unchanged" : "replaced_as_private_draft",
      counts,
      preservation: preservationAfter
    };
    await persistPrivateNoClobber(canaryEvidencePath, evidence, (existing) => {
      if (!existing || typeof existing !== "object") return false;
      const current = existing as Record<string, unknown>;
      return current.resultSha256 === evidence.resultSha256 && canonical(current.counts) === canonical(evidence.counts) &&
        canonical(current.preservation) === canonical(evidence.preservation);
    });
    return {
      outcome: alreadyReplaced ? "unchanged" : "replaced_as_private_draft",
      replacementCount: counts.replacements,
      quarantinedRecordCount: counts.quarantined,
      replacementQuestionAnswerCount: counts.replacement_qas,
      approvalMarkerCount: counts.approval_markers,
      publicCandidateCount: counts.public_candidates,
      publicSearchCandidateCount: counts.public_search_candidates,
      semanticEligibleCount: counts.semantic_eligible,
      semanticBuildCount: counts.semantic_builds,
      semanticRelationshipCount: counts.semantic_relationships,
      transcriptPreserved: true,
      sourceProvenancePreserved: true,
      administratorEvidencePreserved: true,
      otherWaveOneRecordsPreserved: true,
      supersededBundlePreserved: true,
      contentDisplayed: false,
      identifiersDisplayed: false
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function verifySermonEnrichmentCanary(pool: Pool): Promise<CanaryImportResult> {
  const result = await importSermonEnrichmentCanary(pool);
  if (result.outcome !== "unchanged") {
    throw new SermonEnrichmentCanaryError("idempotency_verification_failed", "The canary verification expected an unchanged second import");
  }
  return result;
}

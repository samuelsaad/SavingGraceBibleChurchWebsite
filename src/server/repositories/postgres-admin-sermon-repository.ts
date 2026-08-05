import type { Pool, PoolClient, QueryResultRow } from "pg";
import type {
  AdminSermonListQuery,
  CreateSermonInput,
  DeletionSeoDisposition,
  TaxonomyKind,
  UpdateSermonInput
} from "../../api/contracts/admin-sermons";
import { ApplicationError } from "../../application/errors";
import type { ContentReadinessIssue, ContentReadinessResult } from "../../domain/content-readiness";
import type { SermonStatus } from "../../domain/sermon";
import type {
  AdminSermonRepository,
  AdminSermonTransaction,
  AuditEventDto,
  AuditEventInput,
  DeletionTombstoneDto,
  DeletionTombstoneInput,
  StoredSermonDetail,
  StoredSermonPage,
  StoredSermonSummary,
  TaxonomyDto,
  TaxonomyUpdateInput,
  TaxonomyWriteInput
} from "./admin-sermon-repository";

type SermonRow = QueryResultRow & {
  id: string;
  title: string;
  slug: string;
  status: SermonStatus;
  service_date: string;
  scheduled_for: string | null;
  published_at: string | null;
  row_version: number;
  updated_at: string;
  summary?: string | null;
  summary_status?: StoredSermonDetail["summaryStatus"];
  summary_source_kind?: StoredSermonDetail["summarySourceKind"];
  summary_source_reference?: string | null;
  summary_created_at?: string | null;
  summary_updated_at?: string | null;
  summary_reviewed_at?: string | null;
  summary_approved_at?: string | null;
  summary_row_version?: number;
  seo_description?: string | null;
  body?: string | null;
  speaker: StoredSermonDetail["speaker"];
  series: StoredSermonDetail["series"];
  historical_backfill_required: boolean;
  readiness: {
    isComplete: boolean;
    hasOneSpeaker: boolean;
    hasApprovedDescription: boolean;
    hasApprovedTranscript: boolean;
    approvedQuestionCount: number;
    totalQuestionCount: number;
    allQuestionsApproved: boolean;
    hasValidControlledMedia: boolean;
    transcriptStatus: "missing" | "draft" | "in_review" | "approved" | null;
  };
  books?: StoredSermonDetail["books"];
  scripture_references?: StoredSermonDetail["scriptureReferences"];
  media?: StoredSermonDetail["media"];
  transcript?: StoredSermonDetail["transcript"];
  question_answers?: StoredSermonDetail["questionAnswers"];
};

const timestamp = (column: string): string =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const sermonSummaryProjection = `
  s.id,
  s.title,
  s.slug,
  s.status,
  to_char(s.service_date, 'YYYY-MM-DD') AS service_date,
  CASE WHEN s.scheduled_for IS NULL THEN NULL ELSE ${timestamp("s.scheduled_for")} END AS scheduled_for,
  CASE WHEN s.published_at IS NULL THEN NULL ELSE ${timestamp("s.published_at")} END AS published_at,
  s.row_version,
  ${timestamp("s.updated_at")} AS updated_at,
  (
    SELECT jsonb_build_object('id', sp.id, 'name', sp.name, 'slug', sp.slug)
    FROM speakers sp
    WHERE sp.id = s.speaker_id
  ) AS speaker,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', sr.id, 'name', sr.name, 'slug', sr.slug)
      ORDER BY sm.display_order, sr.id)
    FROM sermon_series_map sm
    JOIN series sr ON sr.id = sm.series_id
    WHERE sm.sermon_id = s.id
  ), '[]'::jsonb) AS series,
  s.historical_backfill_required,
  (
    SELECT jsonb_build_object(
      'isComplete', readiness.is_complete,
      'hasOneSpeaker', readiness.has_one_speaker,
      'hasApprovedDescription', readiness.has_approved_description,
      'hasApprovedTranscript', readiness.has_approved_transcript,
      'approvedQuestionCount', readiness.approved_question_count,
      'totalQuestionCount', readiness.total_question_count,
      'allQuestionsApproved', readiness.all_questions_approved,
      'hasValidControlledMedia', readiness.has_valid_controlled_media,
      'transcriptStatus', (
        SELECT transcript.status FROM sermon_transcripts transcript
        WHERE transcript.sermon_id = s.id
      )
    )
    FROM sermon_content_readiness readiness
    WHERE readiness.sermon_id = s.id
  ) AS readiness`;

const sermonDetailProjection = `${sermonSummaryProjection},
  s.summary,
  s.summary_status,
  s.summary_source_kind,
  s.summary_source_reference,
  CASE WHEN s.summary_created_at IS NULL THEN NULL ELSE ${timestamp("s.summary_created_at")} END AS summary_created_at,
  CASE WHEN s.summary_updated_at IS NULL THEN NULL ELSE ${timestamp("s.summary_updated_at")} END AS summary_updated_at,
  CASE WHEN s.summary_reviewed_at IS NULL THEN NULL ELSE ${timestamp("s.summary_reviewed_at")} END AS summary_reviewed_at,
  CASE WHEN s.summary_approved_at IS NULL THEN NULL ELSE ${timestamp("s.summary_approved_at")} END AS summary_approved_at,
  s.summary_row_version,
  s.seo_description,
  s.body,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', bc.id, 'name', bc.name, 'slug', bc.slug)
      ORDER BY sbc.display_order, bc.id)
    FROM sermon_book_classifications sbc
    JOIN book_classifications bc ON bc.id = sbc.book_classification_id
    WHERE sbc.sermon_id = s.id
  ), '[]'::jsonb) AS books,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ref.id,
      'displayText', ref.display_text,
      'canonicalBookId', ref.canonical_book_id,
      'startChapter', ref.start_chapter,
      'startVerse', ref.start_verse,
      'endChapter', ref.end_chapter,
      'endVerse', ref.end_verse,
      'parseStatus', ref.parse_status
    ) ORDER BY ref.display_order, ref.id)
    FROM scripture_references ref
    WHERE ref.sermon_id = s.id
  ), '[]'::jsonb) AS scripture_references,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', media.id,
      'provider', media.provider,
      'mediaType', media.media_type,
      'externalId', media.external_id,
      'canonicalUrl', media.canonical_url,
      'title', media.title
    ) ORDER BY media.display_order, media.id)
    FROM sermon_media media
    WHERE media.sermon_id = s.id
      AND media.provider IN ('youtube', 'sermonaudio')
      AND media.canonical_url IS NOT NULL
      AND media.title IS NOT NULL
  ), '[]'::jsonb) AS media,
  (
    SELECT jsonb_build_object(
      'bodyText', transcript.body_text,
      'status', transcript.status,
      'sourceKind', transcript.source_kind,
      'sourceReference', transcript.source_reference,
      'rowVersion', transcript.row_version,
      'reviewedAt', CASE WHEN transcript.reviewed_at IS NULL THEN NULL ELSE ${timestamp("transcript.reviewed_at")} END,
      'approvedAt', CASE WHEN transcript.approved_at IS NULL THEN NULL ELSE ${timestamp("transcript.approved_at")} END
    )
    FROM sermon_transcripts transcript
    WHERE transcript.sermon_id = s.id
  ) AS transcript,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', qa.id,
      'question', qa.question_text,
      'answer', qa.answer_text,
      'displayOrder', qa.display_order,
      'status', qa.status,
      'sourceKind', qa.source_kind,
      'sourceReference', qa.source_reference,
      'rowVersion', qa.row_version,
      'reviewedAt', CASE WHEN qa.reviewed_at IS NULL THEN NULL ELSE ${timestamp("qa.reviewed_at")} END,
      'approvedAt', CASE WHEN qa.approved_at IS NULL THEN NULL ELSE ${timestamp("qa.approved_at")} END
    ) ORDER BY qa.display_order, qa.id)
    FROM sermon_question_answers qa
    WHERE qa.sermon_id = s.id
  ), '[]'::jsonb) AS question_answers`;

function readinessFromRow(row: SermonRow): ContentReadinessResult {
  const value = row.readiness;
  const issues: ContentReadinessIssue[] = [];
  if (!value.hasOneSpeaker) {
    issues.push({ path: "speakerId", code: "missing_speaker", message: "Choose one speaker before scheduling or publishing." });
  }
  if (!value.hasApprovedDescription) {
    const hasText = Boolean(row.summary?.trim());
    issues.push({
      path: hasText ? "summaryStatus" : "summary",
      code: hasText ? "description_awaiting_review" : "missing_description",
      message: hasText
        ? "The sermon description must be reviewed and approved."
        : "Add a sermon description before scheduling or publishing."
    });
  }
  if (!value.hasApprovedTranscript) {
    const status = row.transcript?.status ?? value.transcriptStatus;
    issues.push({
      path: status && status !== "missing" ? "transcript.status" : "transcript.bodyText",
      code: status && status !== "missing" ? "transcript_awaiting_review" : "missing_transcript",
      message: status && status !== "missing"
        ? "The full transcript must be reviewed and approved."
        : "Add the complete transcript."
    });
  }
  const hasRequiredQuestionAnswers =
    value.totalQuestionCount >= 5 &&
    value.totalQuestionCount <= 10 &&
    value.allQuestionsApproved;
  if (value.totalQuestionCount < 5 || value.totalQuestionCount > 10) {
    issues.push({ path: "questionAnswers", code: "insufficient_questions", message: "Add between 5 and 10 complete questions with answers." });
  } else if (!value.allQuestionsApproved) {
    issues.push({ path: "questionAnswers", code: "questions_awaiting_review", message: "Every question and answer must be reviewed and approved." });
  }
  if (!value.hasValidControlledMedia) {
    issues.push({ path: "media", code: "missing_media", message: "Add at least one valid controlled YouTube or SermonAudio item." });
  }
  return {
    isComplete: value.isComplete,
    hasOneSpeaker: value.hasOneSpeaker,
    hasApprovedDescription: value.hasApprovedDescription,
    hasApprovedTranscript: value.hasApprovedTranscript,
    approvedQuestionCount: value.approvedQuestionCount,
    totalQuestionCount: value.totalQuestionCount,
    hasRequiredQuestionAnswers,
    allQuestionsApproved: value.allQuestionsApproved,
    hasValidControlledMedia: value.hasValidControlledMedia,
    issues
  };
}

function summaryFromRow(row: SermonRow): StoredSermonSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    serviceDate: row.service_date,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    rowVersion: row.row_version,
    updatedAt: row.updated_at,
    speaker: row.speaker ?? null,
    series: row.series ?? [],
    historicalBackfillRequired: row.historical_backfill_required,
    readiness: readinessFromRow(row)
  };
}

function detailFromRow(row: SermonRow): StoredSermonDetail {
  return {
    ...summaryFromRow(row),
    summary: row.summary ?? null,
    summaryStatus: row.summary_status ?? "missing",
    summarySourceKind: row.summary_source_kind ?? "manual",
    summarySourceReference: row.summary_source_reference ?? null,
    summaryCreatedAt: row.summary_created_at ?? null,
    summaryUpdatedAt: row.summary_updated_at ?? null,
    summaryReviewedAt: row.summary_reviewed_at ?? null,
    summaryApprovedAt: row.summary_approved_at ?? null,
    summaryRowVersion: row.summary_row_version ?? 1,
    seoDescription: row.seo_description ?? null,
    body: row.body ?? null,
    books: row.books ?? [],
    scriptureReferences: row.scripture_references ?? [],
    media: row.media ?? [],
    transcript: row.transcript ?? null,
    questionAnswers: row.question_answers ?? []
  };
}

interface DatabaseError {
  code?: string;
}

function translateDatabaseError(error: unknown): never {
  const code = (error as DatabaseError).code;
  if (code === "23505") {
    throw new ApplicationError(409, "duplicate_value", "A record with that slug already exists");
  }
  if (code === "23503" || code === "23514" || code === "22001") {
    throw new ApplicationError(400, "invalid_request", "The request violates a data constraint");
  }
  throw error;
}

const taxonomyConfiguration = {
  speakers: { table: "speakers", description: "biography", entityType: "speaker" },
  series: { table: "series", description: "description", entityType: "series" },
  books: { table: "book_classifications", description: null, entityType: "book_classification" }
} as const;

function taxonomyProjection(kind: TaxonomyKind): string {
  const config = taxonomyConfiguration[kind];
  const description = config.description ? config.description : "NULL::text";
  const canonical = kind === "books" ? "canonical_book_id" : "NULL::smallint";
  return `id, name, slug, ${description} AS description,
    ${canonical} AS canonical_book_id, row_version,
    ${timestamp("updated_at")} AS updated_at`;
}

function taxonomyFromRow(kind: TaxonomyKind, row: QueryResultRow): TaxonomyDto {
  return {
    id: row.id as string,
    kind,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    canonicalBookId: (row.canonical_book_id as number | null) ?? null,
    rowVersion: row.row_version as number,
    updatedAt: row.updated_at as string
  };
}

class PostgresAdminSermonTransaction implements AdminSermonTransaction {
  constructor(private readonly client: PoolClient) {}

  async findSermonForUpdate(id: string): Promise<StoredSermonDetail | null> {
    const result = await this.client.query(
      `SELECT ${sermonDetailProjection}
       FROM sermons s
       WHERE s.id = $1 AND s.deleted_at IS NULL
       FOR UPDATE OF s`,
      [id]
    );
    const row = result.rows[0] as SermonRow | undefined;
    return row ? detailFromRow(row) : null;
  }

  async insertSermon(input: CreateSermonInput, actorSubject: string): Promise<string> {
    const result = await this.client.query<{ id: string }>(
      `INSERT INTO sermons (
         title, slug, summary, summary_status, summary_source_kind,
         summary_source_reference, summary_created_at, summary_updated_at,
         summary_reviewed_by_subject, summary_approved_by_subject,
         summary_reviewed_at, summary_approved_at, seo_description,
         body, status, service_date, speaker_id, created_by_subject, updated_by_subject
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         CASE WHEN $3::text IS NULL THEN NULL ELSE now() END,
         CASE WHEN $3::text IS NULL THEN NULL ELSE now() END,
         CASE WHEN $4 IN ('in_review', 'approved') THEN $10 ELSE NULL END,
         CASE WHEN $4 = 'approved' THEN $10 ELSE NULL END,
         CASE WHEN $4 IN ('in_review', 'approved') THEN now() ELSE NULL END,
         CASE WHEN $4 = 'approved' THEN now() ELSE NULL END,
         $7, $8, 'draft', $9::date, $11, $10, $10
       )
       RETURNING id`,
      [
        input.title,
        input.slug,
        input.summary,
        input.summaryStatus,
        input.summarySourceKind,
        input.summarySourceReference,
        input.seoDescription,
        input.body,
        input.serviceDate,
        actorSubject,
        input.speakerId
      ]
    );
    return result.rows[0]!.id;
  }

  async updateSermon(id: string, input: UpdateSermonInput, actorSubject: string): Promise<void> {
    const columns: Array<[keyof UpdateSermonInput, string, string?]> = [
      ["title", "title"],
      ["slug", "slug"],
      ["serviceDate", "service_date", "::date"],
      ["summary", "summary"],
      ["summaryStatus", "summary_status"],
      ["summarySourceKind", "summary_source_kind"],
      ["summarySourceReference", "summary_source_reference"],
      ["seoDescription", "seo_description"],
      ["body", "body"],
      ["speakerId", "speaker_id"]
    ];
    const values: unknown[] = [];
    const sets: string[] = [];
    for (const [key, column, cast = ""] of columns) {
      if (input[key] !== undefined) {
        values.push(input[key]);
        sets.push(`${column} = $${values.length}${cast}`);
      }
    }
    const descriptionChanged = [
      "summary",
      "summaryStatus",
      "summarySourceKind",
      "summarySourceReference"
    ].some((key) => input[key as keyof UpdateSermonInput] !== undefined);
    if (descriptionChanged) {
      let summaryIsNullExpression = "summary IS NULL";
      if (input.summary !== undefined) {
        values.push(input.summary);
        summaryIsNullExpression = `$${values.length}::text IS NULL`;
      }
      let resultingStatusExpression = "summary_status";
      if (input.summaryStatus !== undefined) {
        values.push(input.summaryStatus);
        resultingStatusExpression = `$${values.length}::text`;
      }
      values.push(actorSubject);
      const actorParameter = `$${values.length}`;
      sets.push(
        `summary_created_at = CASE WHEN ${summaryIsNullExpression} THEN NULL ELSE COALESCE(summary_created_at, now()) END`,
        `summary_updated_at = CASE WHEN ${summaryIsNullExpression} THEN NULL ELSE now() END`,
        `summary_reviewed_by_subject = CASE WHEN ${resultingStatusExpression} IN ('in_review', 'approved') THEN ${actorParameter} ELSE NULL END`,
        `summary_approved_by_subject = CASE WHEN ${resultingStatusExpression} = 'approved' THEN ${actorParameter} ELSE NULL END`,
        `summary_reviewed_at = CASE WHEN ${resultingStatusExpression} IN ('in_review', 'approved') THEN now() ELSE NULL END`,
        `summary_approved_at = CASE WHEN ${resultingStatusExpression} = 'approved' THEN now() ELSE NULL END`,
        "summary_row_version = summary_row_version + 1"
      );
    }
    values.push(actorSubject, id);
    sets.push(
      `updated_by_subject = $${values.length - 1}`,
      "updated_at = now()",
      "row_version = row_version + 1"
    );
    await this.client.query(
      `UPDATE sermons SET ${sets.join(", ")} WHERE id = $${values.length}`,
      values
    );
  }

  async transitionSermon(
    id: string,
    status: SermonStatus,
    scheduledFor: string | null,
    publishedAt: string | null,
    actorSubject: string
  ): Promise<void> {
    await this.client.query(
      `UPDATE sermons
       SET status = $2,
           scheduled_for = $3::timestamptz,
           published_at = $4::timestamptz,
           updated_by_subject = $5,
           updated_at = now(),
           row_version = row_version + 1
       WHERE id = $1`,
      [id, status, scheduledFor, publishedAt, actorSubject]
    );
  }

  async recordSlugRedirect(sermonId: string, oldSlug: string, newSlug: string): Promise<void> {
    const oldPath = `/sermons/${oldSlug}/`;
    const newPath = `/sermons/${newSlug}/`;
    await this.client.query(
      `UPDATE redirects
       SET new_path = $2,
           status_code = 301,
           reason = 'sermon_slug_changed',
           source_sermon_id = COALESCE(source_sermon_id, $3),
           verified_at = NULL,
           updated_at = now()
       WHERE new_path = $1 AND status_code IN (301, 302, 307, 308)`,
      [oldPath, newPath, sermonId]
    );
    const result = await this.client.query(
      `INSERT INTO redirects (
         old_path, new_path, status_code, reason, source_sermon_id
       ) VALUES ($1, $2, 301, 'sermon_slug_changed', $3)
       ON CONFLICT (old_path) DO UPDATE
       SET new_path = EXCLUDED.new_path,
           status_code = 301,
           reason = EXCLUDED.reason,
           source_sermon_id = EXCLUDED.source_sermon_id,
           verified_at = NULL,
           updated_at = now()
       WHERE redirects.source_sermon_id IS NULL
          OR redirects.source_sermon_id = EXCLUDED.source_sermon_id
       RETURNING id`,
      [oldPath, newPath, sermonId]
    );
    if (result.rowCount !== 1) {
      throw new ApplicationError(
        409,
        "redirect_conflict",
        "The previous slug already has an unrelated URL disposition"
      );
    }
  }

  async validateRedirectTarget(targetPath: string, deletingSermonId: string): Promise<boolean> {
    const result = await this.client.query<{ valid: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM sermons
         WHERE id <> $2
           AND status = 'published'
           AND deleted_at IS NULL
           AND '/sermons/' || slug || '/' = $1
       ) AS valid`,
      [targetPath, deletingSermonId]
    );
    return result.rows[0]!.valid;
  }

  async recordDeletionDisposition(
    sermonId: string,
    formerSlug: string,
    disposition: DeletionSeoDisposition,
    reason: string
  ): Promise<void> {
    const oldPath = `/sermons/${formerSlug}/`;
    const targetPath = disposition.kind === "redirect" ? disposition.targetPath : null;
    const statusCode = disposition.kind === "redirect" ? 301 : 410;
    await this.client.query(
      `UPDATE redirects
       SET new_path = $2,
           status_code = $3,
           reason = $4,
           source_sermon_id = COALESCE(source_sermon_id, $5),
           verified_at = NULL,
           updated_at = now()
       WHERE new_path = $1 AND status_code IN (301, 302, 307, 308)`,
      [oldPath, targetPath, statusCode, `permanent deletion: ${reason}`, sermonId]
    );
    const result = await this.client.query(
      `INSERT INTO redirects (
         old_path, new_path, status_code, reason, source_sermon_id
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (old_path) DO UPDATE
       SET new_path = EXCLUDED.new_path,
           status_code = EXCLUDED.status_code,
           reason = EXCLUDED.reason,
           source_sermon_id = EXCLUDED.source_sermon_id,
           verified_at = NULL,
           updated_at = now()
       WHERE redirects.source_sermon_id IS NULL
          OR redirects.source_sermon_id = EXCLUDED.source_sermon_id
       RETURNING id`,
      [oldPath, targetPath, statusCode, `permanent deletion: ${reason}`, sermonId]
    );
    if (result.rowCount !== 1) {
      throw new ApplicationError(
        409,
        "redirect_conflict",
        "The sermon path already has an unrelated URL disposition"
      );
    }
  }

  async insertDeletionTombstone(input: DeletionTombstoneInput): Promise<void> {
    await this.client.query(
      `INSERT INTO sermon_deletion_tombstones (
         former_sermon_id, former_slug, actor_subject, reason,
         was_previously_published, seo_disposition, redirect_target_path,
         request_correlation_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.formerSermonId,
        input.formerSlug,
        input.actorSubject,
        input.reason,
        input.wasPreviouslyPublished,
        input.seoDisposition?.kind ?? null,
        input.seoDisposition?.kind === "redirect" ? input.seoDisposition.targetPath : null,
        input.requestCorrelationId
      ]
    );
  }

  async deleteSermon(id: string): Promise<void> {
    const result = await this.client.query("DELETE FROM sermons WHERE id = $1", [id]);
    if (result.rowCount !== 1) {
      throw new ApplicationError(404, "not_found", "Sermon was not found");
    }
  }

  async validateRelationshipIds(input: {
    speakerId?: string | null | undefined;
    seriesIds?: string[] | undefined;
    bookClassificationIds?: string[] | undefined;
  }): Promise<string | null> {
    if (input.speakerId) {
      const speaker = await this.client.query<{ present: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM speakers WHERE id = $1) AS present",
        [input.speakerId]
      );
      if (!speaker.rows[0]!.present) return "speakerId";
    }
    const dimensions = [
      ["seriesIds", "series"],
      ["bookClassificationIds", "book_classifications"]
    ] as const;
    for (const [field, table] of dimensions) {
      const ids = input[field];
      if (ids === undefined || ids.length === 0) continue;
      const result = await this.client.query<{ count: number }>(
        `SELECT count(*)::integer AS count FROM ${table} WHERE id = ANY($1::uuid[])`,
        [ids]
      );
      if (result.rows[0]!.count !== ids.length) return field;
    }
    return null;
  }

  async replaceRelationships(
    id: string,
    input: {
      speakerId?: CreateSermonInput["speakerId"] | undefined;
      seriesIds?: CreateSermonInput["seriesIds"] | undefined;
      bookClassificationIds?: CreateSermonInput["bookClassificationIds"] | undefined;
      scriptureReferences?: CreateSermonInput["scriptureReferences"] | undefined;
      media?: CreateSermonInput["media"] | undefined;
      transcript?: CreateSermonInput["transcript"] | undefined;
      questionAnswers?: CreateSermonInput["questionAnswers"] | undefined;
    },
    actorSubject: string
  ): Promise<void> {
    if (input.seriesIds !== undefined) {
      await this.client.query("DELETE FROM sermon_series_map WHERE sermon_id = $1", [id]);
      for (const [order, seriesId] of input.seriesIds.entries()) {
        await this.client.query(
          `INSERT INTO sermon_series_map (sermon_id, series_id, display_order, is_primary)
           VALUES ($1, $2, $3, $4)`,
          [id, seriesId, order, order === 0]
        );
      }
    }
    if (input.bookClassificationIds !== undefined) {
      await this.client.query("DELETE FROM sermon_book_classifications WHERE sermon_id = $1", [id]);
      for (const [order, bookId] of input.bookClassificationIds.entries()) {
        await this.client.query(
          `INSERT INTO sermon_book_classifications (
             sermon_id, book_classification_id, display_order
           ) VALUES ($1, $2, $3)`,
          [id, bookId, order]
        );
      }
    }
    if (input.scriptureReferences !== undefined) {
      await this.client.query("DELETE FROM scripture_references WHERE sermon_id = $1", [id]);
      for (const [order, reference] of input.scriptureReferences.entries()) {
        const inserted = await this.client.query<{ id: string }>(
          `INSERT INTO scripture_references (
             sermon_id, display_text, canonical_book_id, start_chapter, start_verse,
             end_chapter, end_verse, display_order, parse_status
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'curated')
           RETURNING id`,
          [
            id,
            reference.displayText,
            reference.canonicalBookId,
            reference.startChapter,
            reference.startVerse,
            reference.endChapter,
            reference.endVerse,
            order
          ]
        );
        await this.client.query(
          `INSERT INTO scripture_reference_sources (
             scripture_reference_id, sermon_id, source_kind, original_value
           ) VALUES ($1, $2, 'curated', $3)`,
          [inserted.rows[0]!.id, id, reference.displayText]
        );
      }
    }
    if (input.media !== undefined) {
      await this.client.query("DELETE FROM sermon_media WHERE sermon_id = $1", [id]);
      for (const [order, media] of input.media.entries()) {
        await this.client.query(
          `INSERT INTO sermon_media (
             sermon_id, media_type, provider, external_id, canonical_url,
             title, is_primary, display_order, availability_status
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unknown')`,
          [
            id,
            media.mediaType,
            media.provider,
            media.externalId,
            media.canonicalUrl,
            media.title,
            order === 0,
            order
          ]
        );
      }
    }
    if (input.transcript !== undefined) {
      const reviewed = input.transcript.status === "in_review" || input.transcript.status === "approved";
      const approved = input.transcript.status === "approved";
      await this.client.query(
        `INSERT INTO sermon_transcripts (
           sermon_id, body_text, status, source_kind, source_reference,
           reviewed_by_subject, approved_by_subject, reviewed_at, approved_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (sermon_id) DO UPDATE SET
           body_text = EXCLUDED.body_text,
           status = EXCLUDED.status,
           source_kind = EXCLUDED.source_kind,
           source_reference = EXCLUDED.source_reference,
           reviewed_by_subject = EXCLUDED.reviewed_by_subject,
           approved_by_subject = EXCLUDED.approved_by_subject,
           reviewed_at = EXCLUDED.reviewed_at,
           approved_at = EXCLUDED.approved_at,
           updated_at = now(),
           row_version = sermon_transcripts.row_version + 1`,
        [
          id,
          input.transcript.bodyText,
          input.transcript.status,
          input.transcript.sourceKind,
          input.transcript.sourceReference,
          reviewed ? actorSubject : null,
          approved ? actorSubject : null,
          reviewed ? new Date().toISOString() : null,
          approved ? new Date().toISOString() : null
        ]
      );
    }
    if (input.questionAnswers !== undefined) {
      for (const [index, item] of input.questionAnswers.entries()) {
        const reviewed = item.status === "in_review" || item.status === "approved";
        const approved = item.status === "approved";
        await this.client.query(
          `INSERT INTO sermon_question_answers (
             sermon_id, question_text, answer_text, display_order, status,
             source_kind, source_reference, reviewed_by_subject, approved_by_subject,
             reviewed_at, approved_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (sermon_id, display_order) DO UPDATE SET
             question_text = EXCLUDED.question_text,
             answer_text = EXCLUDED.answer_text,
             status = EXCLUDED.status,
             source_kind = EXCLUDED.source_kind,
             source_reference = EXCLUDED.source_reference,
             reviewed_by_subject = EXCLUDED.reviewed_by_subject,
             approved_by_subject = EXCLUDED.approved_by_subject,
             reviewed_at = EXCLUDED.reviewed_at,
             approved_at = EXCLUDED.approved_at,
             updated_at = now(),
             row_version = sermon_question_answers.row_version + 1`,
          [
            id,
            item.question,
            item.answer,
            index + 1,
            item.status,
            item.sourceKind,
            item.sourceReference,
            reviewed ? actorSubject : null,
            approved ? actorSubject : null,
            reviewed ? new Date().toISOString() : null,
            approved ? new Date().toISOString() : null
          ]
        );
      }
      await this.client.query(
        "DELETE FROM sermon_question_answers WHERE sermon_id = $1 AND display_order > $2",
        [id, input.questionAnswers.length]
      );
    }
  }

  async refreshSearchTerms(id: string): Promise<void> {
    await this.client.query(
      `UPDATE sermons s SET search_terms = concat_ws(' ',
       (SELECT sp.name FROM speakers sp WHERE sp.id = s.speaker_id),
         (SELECT string_agg(sr.name, ' ' ORDER BY sm.display_order, sr.id)
          FROM sermon_series_map sm JOIN series sr ON sr.id = sm.series_id
          WHERE sm.sermon_id = s.id),
         (SELECT string_agg(ref.display_text, ' ' ORDER BY ref.display_order, ref.id)
          FROM scripture_references ref WHERE ref.sermon_id = s.id),
         (SELECT string_agg(bc.name, ' ' ORDER BY sbc.display_order, bc.id)
          FROM sermon_book_classifications sbc
          JOIN book_classifications bc ON bc.id = sbc.book_classification_id
          WHERE sbc.sermon_id = s.id)
       )
       WHERE s.id = $1`,
      [id]
    );
    await this.client.query("SELECT refresh_sermon_enrichment($1)", [id]);
  }

  async insertTaxonomy(kind: TaxonomyKind, input: TaxonomyWriteInput): Promise<TaxonomyDto> {
    const config = taxonomyConfiguration[kind];
    let result;
    if (kind === "books") {
      result = await this.client.query(
        `INSERT INTO book_classifications (
           name, slug, canonical_book_id, classification_type, review_status
         ) VALUES ($1, $2, $3, $4, 'approved')
         RETURNING ${taxonomyProjection(kind)}`,
        [input.name, input.slug, input.canonicalBookId, input.canonicalBookId ? "canonical" : "unresolved"]
      );
    } else {
      result = await this.client.query(
        `INSERT INTO ${config.table} (name, slug, ${config.description})
         VALUES ($1, $2, $3)
         RETURNING ${taxonomyProjection(kind)}`,
        [input.name, input.slug, input.description]
      );
    }
    return taxonomyFromRow(kind, result.rows[0]!);
  }

  async findTaxonomyForUpdate(kind: TaxonomyKind, id: string): Promise<TaxonomyDto | null> {
    const config = taxonomyConfiguration[kind];
    const result = await this.client.query(
      `SELECT ${taxonomyProjection(kind)} FROM ${config.table} WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return result.rows[0] ? taxonomyFromRow(kind, result.rows[0]) : null;
  }

  async updateTaxonomy(
    kind: TaxonomyKind,
    id: string,
    input: TaxonomyUpdateInput
  ): Promise<TaxonomyDto> {
    const config = taxonomyConfiguration[kind];
    const values: unknown[] = [];
    const sets: string[] = [];
    if (input.name !== undefined) {
      values.push(input.name);
      sets.push(`name = $${values.length}`);
    }
    if (input.slug !== undefined) {
      values.push(input.slug);
      sets.push(`slug = $${values.length}`);
    }
    if (input.description !== undefined && config.description) {
      values.push(input.description);
      sets.push(`${config.description} = $${values.length}`);
    }
    if (input.canonicalBookId !== undefined && kind === "books") {
      values.push(input.canonicalBookId);
      sets.push(
        `canonical_book_id = $${values.length}`,
        `classification_type = CASE WHEN $${values.length}::smallint IS NULL THEN 'unresolved' ELSE 'canonical' END`
      );
    }
    sets.push("updated_at = now()", "row_version = row_version + 1");
    values.push(id);
    const result = await this.client.query(
      `UPDATE ${config.table} SET ${sets.join(", ")}
       WHERE id = $${values.length}
       RETURNING ${taxonomyProjection(kind)}`,
      values
    );
    return taxonomyFromRow(kind, result.rows[0]!);
  }

  async appendAudit(event: AuditEventInput): Promise<void> {
    await this.client.query(
      `INSERT INTO audit_events (
         actor_subject, actor_role, action, entity_type, entity_id,
         changed_fields, request_correlation_id, outcome
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        event.actorSubject,
        event.actorRole,
        event.action,
        event.entityType,
        event.entityId,
        JSON.stringify(event.changedFields),
        event.requestCorrelationId,
        event.outcome
      ]
    );
  }
}

export class PostgresAdminSermonRepository implements AdminSermonRepository {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(work: (transaction: AdminSermonTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(new PostgresAdminSermonTransaction(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof ApplicationError) throw error;
      translateDatabaseError(error);
    } finally {
      client.release();
    }
  }

  async listSermons(query: AdminSermonListQuery): Promise<StoredSermonPage> {
    const values: unknown[] = [];
    const conditions = ["s.deleted_at IS NULL"];
    if (query.query) {
      values.push(`%${query.query}%`);
      conditions.push(`(s.title ILIKE $${values.length} OR s.slug ILIKE $${values.length})`);
    }
    if (query.status) {
      values.push(query.status);
      conditions.push(`s.status = $${values.length}`);
    }
    if (query.speakerId) {
      values.push(query.speakerId);
      conditions.push(`s.speaker_id = $${values.length}`);
    }
    if (query.seriesId) {
      values.push(query.seriesId);
      conditions.push(
        `EXISTS (SELECT 1 FROM sermon_series_map sm
                 WHERE sm.sermon_id = s.id AND sm.series_id = $${values.length})`
      );
    }
    if (query.serviceDateFrom) {
      values.push(query.serviceDateFrom);
      conditions.push(`s.service_date >= $${values.length}::date`);
    }
    if (query.serviceDateTo) {
      values.push(query.serviceDateTo);
      conditions.push(`s.service_date <= $${values.length}::date`);
    }
    if (query.contentIssue === "complete") {
      conditions.push("EXISTS (SELECT 1 FROM sermon_content_readiness r WHERE r.sermon_id = s.id AND r.is_complete)");
    } else if (query.contentIssue === "missing_speaker") {
      conditions.push("s.speaker_id IS NULL");
    } else if (query.contentIssue === "missing_description") {
      conditions.push("(s.summary IS NULL OR char_length(trim(s.summary)) = 0)");
    } else if (query.contentIssue === "description_awaiting_review") {
      conditions.push("s.summary IS NOT NULL AND s.summary_status IN ('draft', 'in_review')");
    } else if (query.contentIssue === "missing_transcript") {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM sermon_transcripts transcript
        WHERE transcript.sermon_id = s.id AND char_length(trim(transcript.body_text)) > 0
      )`);
    } else if (query.contentIssue === "transcript_awaiting_review") {
      conditions.push(`EXISTS (
        SELECT 1 FROM sermon_transcripts transcript
        WHERE transcript.sermon_id = s.id AND transcript.status IN ('draft', 'in_review')
      )`);
    } else if (query.contentIssue === "insufficient_questions") {
      conditions.push("(SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) NOT BETWEEN 5 AND 10");
    } else if (query.contentIssue === "questions_awaiting_review") {
      conditions.push(`EXISTS (
        SELECT 1 FROM sermon_question_answers qa
        WHERE qa.sermon_id = s.id AND qa.status <> 'approved'
      )`);
    } else if (query.contentIssue === "missing_media") {
      conditions.push("EXISTS (SELECT 1 FROM sermon_content_readiness r WHERE r.sermon_id = s.id AND NOT r.has_valid_controlled_media)");
    }

    const [count, statusCounts, readinessProgressResult] = await Promise.all([
      this.pool.query<{ total: number }>(
        `SELECT count(*)::integer AS total FROM sermons s WHERE ${conditions.join(" AND ")}`,
        values
      ),
      this.pool.query<{ status: SermonStatus; total: number }>(
        `SELECT status, count(*)::integer AS total
         FROM sermons
         WHERE deleted_at IS NULL
         GROUP BY status`
      ),
      this.pool.query<{
        total: number;
        complete: number;
        with_one_speaker: number;
        with_approved_description: number;
        with_approved_transcript: number;
        with_required_question_answers: number;
        with_valid_controlled_media: number;
      }>(
        `SELECT
           count(*)::integer AS total,
           count(*) FILTER (WHERE is_complete)::integer AS complete,
           count(*) FILTER (WHERE has_one_speaker)::integer AS with_one_speaker,
           count(*) FILTER (WHERE has_approved_description)::integer AS with_approved_description,
           count(*) FILTER (WHERE has_approved_transcript)::integer AS with_approved_transcript,
           count(*) FILTER (
             WHERE total_question_count BETWEEN 5 AND 10 AND all_questions_approved
           )::integer AS with_required_question_answers,
           count(*) FILTER (WHERE has_valid_controlled_media)::integer AS with_valid_controlled_media
         FROM sermon_content_readiness`
      )
    ]);
    values.push(query.pageSize, (query.page - 1) * query.pageSize);
    const rows = await this.pool.query(
      `SELECT ${sermonSummaryProjection}
       FROM sermons s
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.updated_at DESC, s.id
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    const countsByStatus: Record<SermonStatus, number> = {
      draft: 0,
      pending: 0,
      scheduled: 0,
      published: 0,
      unpublished: 0,
      archived: 0
    };
    for (const row of statusCounts.rows) countsByStatus[row.status] = row.total;
    const progress = readinessProgressResult.rows[0]!;
    return {
      data: (rows.rows as SermonRow[]).map(summaryFromRow),
      totalItems: count.rows[0]!.total,
      countsByStatus,
      readinessProgress: {
        total: progress.total,
        complete: progress.complete,
        remaining: progress.total - progress.complete,
        withOneSpeaker: progress.with_one_speaker,
        withApprovedDescription: progress.with_approved_description,
        withApprovedTranscript: progress.with_approved_transcript,
        withRequiredQuestionAnswers: progress.with_required_question_answers,
        withValidControlledMedia: progress.with_valid_controlled_media
      }
    };
  }

  async findSermon(id: string): Promise<StoredSermonDetail | null> {
    const result = await this.pool.query(
      `SELECT ${sermonDetailProjection}
       FROM sermons s
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id]
    );
    const row = result.rows[0] as SermonRow | undefined;
    return row ? detailFromRow(row) : null;
  }

  async hasSermonOrTombstone(id: string): Promise<boolean> {
    const result = await this.pool.query<{ present: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM sermons WHERE id = $1 AND deleted_at IS NULL)
           OR EXISTS (SELECT 1 FROM sermon_deletion_tombstones WHERE former_sermon_id = $1)
           AS present`,
      [id]
    );
    return result.rows[0]!.present;
  }

  async listTaxonomies(kind: TaxonomyKind): Promise<TaxonomyDto[]> {
    const config = taxonomyConfiguration[kind];
    const result = await this.pool.query(
      `SELECT ${taxonomyProjection(kind)} FROM ${config.table} ORDER BY lower(name), id`
    );
    return result.rows.map((row) => taxonomyFromRow(kind, row));
  }

  async listAuditEvents(sermonId: string): Promise<AuditEventDto[]> {
    const result = await this.pool.query(
      `SELECT id,
              actor_subject AS "actorSubject",
              actor_role AS "actorRole",
              action,
              entity_type AS "entityType",
              entity_id AS "entityId",
              outcome,
              changed_fields AS "changedFields",
              request_correlation_id AS "requestCorrelationId",
              ${timestamp("created_at")} AS "createdAt"
       FROM audit_events
       WHERE entity_type = 'sermon' AND entity_id = $1
       ORDER BY created_at DESC, id`,
      [sermonId]
    );
    return result.rows as AuditEventDto[];
  }

  async listRecentAuditEvents(limit: number): Promise<AuditEventDto[]> {
    const result = await this.pool.query(
      `SELECT id,
              actor_subject AS "actorSubject",
              actor_role AS "actorRole",
              action,
              entity_type AS "entityType",
              entity_id AS "entityId",
              outcome,
              changed_fields AS "changedFields",
              request_correlation_id AS "requestCorrelationId",
              ${timestamp("created_at")} AS "createdAt"
       FROM audit_events
       ORDER BY created_at DESC, id
       LIMIT $1`,
      [limit]
    );
    return result.rows as AuditEventDto[];
  }

  async listDeletionTombstones(limit: number): Promise<DeletionTombstoneDto[]> {
    const result = await this.pool.query(
      `SELECT id,
              former_sermon_id AS "formerSermonId",
              former_slug AS "formerSlug",
              actor_subject AS "actorSubject",
              actor_role AS "actorRole",
              action,
              reason,
              was_previously_published AS "wasPreviouslyPublished",
              seo_disposition AS "seoDisposition",
              redirect_target_path AS "redirectTargetPath",
              request_correlation_id AS "requestCorrelationId",
              ${timestamp("created_at")} AS "createdAt"
       FROM sermon_deletion_tombstones
       ORDER BY created_at DESC, id
       LIMIT $1`,
      [limit]
    );
    return result.rows as DeletionTombstoneDto[];
  }
}

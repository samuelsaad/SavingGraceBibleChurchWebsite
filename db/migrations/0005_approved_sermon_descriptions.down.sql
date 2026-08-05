BEGIN;

DROP VIEW IF EXISTS sermon_content_readiness;
DROP TRIGGER IF EXISTS sermons_refresh_description_enrichment ON sermons;
DROP FUNCTION IF EXISTS refresh_sermon_enrichment_from_sermon();

DROP INDEX sermons_search_vector_idx;
ALTER TABLE sermons DROP COLUMN search_vector;
ALTER TABLE sermons ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce(search_terms, '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(summary, '')), 'C') ||
  setweight(to_tsvector('english'::regconfig, coalesce(body, '')), 'D') ||
  setweight(to_tsvector('english'::regconfig, coalesce(transcript_search_document, '')), 'D') ||
  setweight(to_tsvector('english'::regconfig, coalesce(question_answer_search_document, '')), 'D')
) STORED;
CREATE INDEX sermons_search_vector_idx ON sermons USING gin (search_vector);

ALTER TABLE sermons
  DROP CONSTRAINT IF EXISTS sermons_summary_plain_text_check,
  DROP CONSTRAINT IF EXISTS sermons_summary_lifecycle_check,
  DROP CONSTRAINT IF EXISTS sermons_summary_review_check,
  DROP CONSTRAINT IF EXISTS sermons_summary_approval_check,
  DROP CONSTRAINT IF EXISTS sermons_seo_description_check,
  DROP CONSTRAINT IF EXISTS sermons_seo_description_approval_check;

CREATE OR REPLACE FUNCTION refresh_sermon_enrichment(target_sermon_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE sermons s
  SET transcript_search_document = COALESCE((
        SELECT transcript.body_text
        FROM sermon_transcripts transcript
        WHERE transcript.sermon_id = s.id AND transcript.status = 'approved'
      ), ''),
      question_answer_search_document = COALESCE((
        SELECT string_agg(qa.question_text || ' ' || qa.answer_text, ' ' ORDER BY qa.display_order)
        FROM sermon_question_answers qa
        WHERE qa.sermon_id = s.id AND qa.status = 'approved'
      ), ''),
      historical_backfill_required = s.source_wordpress_id IS NOT NULL AND NOT (
        s.speaker_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM sermon_transcripts transcript
          WHERE transcript.sermon_id = s.id
            AND transcript.status = 'approved'
            AND char_length(trim(transcript.body_text)) > 0
        )
        AND (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) BETWEEN 5 AND 10
        AND NOT EXISTS (
          SELECT 1 FROM sermon_question_answers qa
          WHERE qa.sermon_id = s.id AND qa.status <> 'approved'
        )
        AND EXISTS (
          SELECT 1 FROM sermon_media media
          WHERE media.sermon_id = s.id
            AND media.provider IN ('youtube', 'sermonaudio')
            AND media.canonical_url IS NOT NULL
            AND char_length(trim(media.title)) > 0
        )
        AND NOT EXISTS (
          SELECT 1 FROM sermon_media media
          WHERE media.sermon_id = s.id
            AND (
              media.provider NOT IN ('youtube', 'sermonaudio')
              OR media.canonical_url IS NULL
              OR media.title IS NULL
              OR char_length(trim(media.title)) = 0
            )
        )
      )
  WHERE s.id = target_sermon_id;
$$;

ALTER TABLE sermons
  DROP COLUMN IF EXISTS seo_description,
  DROP COLUMN IF EXISTS summary_search_document,
  DROP COLUMN IF EXISTS summary_row_version,
  DROP COLUMN IF EXISTS summary_approved_at,
  DROP COLUMN IF EXISTS summary_reviewed_at,
  DROP COLUMN IF EXISTS summary_approved_by_subject,
  DROP COLUMN IF EXISTS summary_reviewed_by_subject,
  DROP COLUMN IF EXISTS summary_updated_at,
  DROP COLUMN IF EXISTS summary_created_at,
  DROP COLUMN IF EXISTS summary_source_reference,
  DROP COLUMN IF EXISTS summary_source_kind,
  DROP COLUMN IF EXISTS summary_status;

CREATE VIEW sermon_content_readiness AS
SELECT
  s.id AS sermon_id,
  s.source_wordpress_id,
  (s.speaker_id IS NOT NULL) AS has_one_speaker,
  EXISTS (
    SELECT 1 FROM sermon_transcripts transcript
    WHERE transcript.sermon_id = s.id
      AND transcript.status = 'approved'
      AND char_length(trim(transcript.body_text)) > 0
  ) AS has_approved_transcript,
  (SELECT count(*)::integer FROM sermon_question_answers qa
   WHERE qa.sermon_id = s.id AND qa.status = 'approved') AS approved_question_count,
  (SELECT count(*)::integer FROM sermon_question_answers qa
   WHERE qa.sermon_id = s.id) AS total_question_count,
  (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) > 0
  AND NOT EXISTS (
    SELECT 1 FROM sermon_question_answers qa
    WHERE qa.sermon_id = s.id AND qa.status <> 'approved'
  ) AS all_questions_approved,
  EXISTS (
    SELECT 1 FROM sermon_media media
    WHERE media.sermon_id = s.id
      AND media.provider IN ('youtube', 'sermonaudio')
      AND media.canonical_url IS NOT NULL
      AND char_length(trim(media.title)) > 0
  ) AND NOT EXISTS (
    SELECT 1 FROM sermon_media media
    WHERE media.sermon_id = s.id
      AND (
        media.provider NOT IN ('youtube', 'sermonaudio')
        OR media.canonical_url IS NULL
        OR media.title IS NULL
        OR char_length(trim(media.title)) = 0
      )
  ) AS has_valid_controlled_media,
  (
    s.speaker_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM sermon_transcripts transcript
      WHERE transcript.sermon_id = s.id
        AND transcript.status = 'approved'
        AND char_length(trim(transcript.body_text)) > 0
    )
    AND (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) BETWEEN 5 AND 10
    AND NOT EXISTS (
      SELECT 1 FROM sermon_question_answers qa
      WHERE qa.sermon_id = s.id AND qa.status <> 'approved'
    )
    AND EXISTS (
      SELECT 1 FROM sermon_media media
      WHERE media.sermon_id = s.id
        AND media.provider IN ('youtube', 'sermonaudio')
        AND media.canonical_url IS NOT NULL
        AND char_length(trim(media.title)) > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM sermon_media media
      WHERE media.sermon_id = s.id
        AND (
          media.provider NOT IN ('youtube', 'sermonaudio')
          OR media.canonical_url IS NULL
          OR media.title IS NULL
          OR char_length(trim(media.title)) = 0
        )
    )
  ) AS is_complete
FROM sermons s
WHERE s.deleted_at IS NULL;

SELECT refresh_sermon_enrichment(id) FROM sermons WHERE deleted_at IS NULL;

COMMIT;

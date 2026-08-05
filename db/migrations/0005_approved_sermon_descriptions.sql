BEGIN;

ALTER TABLE sermons
  ADD COLUMN summary_status text NOT NULL DEFAULT 'missing'
    CHECK (summary_status IN ('missing', 'draft', 'in_review', 'approved')),
  ADD COLUMN summary_source_kind text NOT NULL DEFAULT 'manual'
    CHECK (summary_source_kind IN ('manual', 'imported', 'generated_draft')),
  ADD COLUMN summary_source_reference text CHECK (
    summary_source_reference IS NULL
    OR char_length(summary_source_reference) BETWEEN 1 AND 500
  ),
  ADD COLUMN summary_created_at timestamptz,
  ADD COLUMN summary_updated_at timestamptz,
  ADD COLUMN summary_reviewed_by_subject text,
  ADD COLUMN summary_approved_by_subject text,
  ADD COLUMN summary_reviewed_at timestamptz,
  ADD COLUMN summary_approved_at timestamptz,
  ADD COLUMN summary_row_version integer NOT NULL DEFAULT 1 CHECK (summary_row_version > 0),
  ADD COLUMN summary_search_document text NOT NULL DEFAULT '',
  ADD COLUMN seo_description text;

UPDATE sermons
SET summary = NULL
WHERE summary IS NOT NULL AND char_length(trim(summary)) = 0;

UPDATE sermons
SET summary_status = 'draft',
    summary_source_kind = CASE
      WHEN source_wordpress_id IS NOT NULL THEN 'imported'
      ELSE 'manual'
    END,
    summary_created_at = created_at,
    summary_updated_at = updated_at
WHERE summary IS NOT NULL;

ALTER TABLE sermons
  ADD CONSTRAINT sermons_summary_plain_text_check
    CHECK (summary IS NULL OR summary !~ '<[^>]+>'),
  ADD CONSTRAINT sermons_summary_lifecycle_check CHECK (
    (summary_status = 'missing' AND summary IS NULL)
    OR (
      summary_status IN ('draft', 'in_review')
      AND char_length(trim(summary)) BETWEEN 1 AND 2000
    )
    OR (
      summary_status = 'approved'
      AND char_length(trim(summary)) BETWEEN 80 AND 2000
    )
  ),
  ADD CONSTRAINT sermons_summary_review_check CHECK (
    summary_status NOT IN ('in_review', 'approved')
    OR (summary_reviewed_at IS NOT NULL AND summary_reviewed_by_subject IS NOT NULL)
  ),
  ADD CONSTRAINT sermons_summary_approval_check CHECK (
    summary_status <> 'approved'
    OR (summary_approved_at IS NOT NULL AND summary_approved_by_subject IS NOT NULL)
  ),
  ADD CONSTRAINT sermons_seo_description_check CHECK (
    seo_description IS NULL
    OR (
      char_length(trim(seo_description)) BETWEEN 1 AND 320
      AND seo_description !~ '<[^>]+>'
    )
  ),
  ADD CONSTRAINT sermons_seo_description_approval_check CHECK (
    seo_description IS NULL OR summary_status = 'approved'
  );

DROP INDEX sermons_search_vector_idx;
ALTER TABLE sermons DROP COLUMN search_vector;
ALTER TABLE sermons ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce(search_terms, '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(summary_search_document, '')), 'C') ||
  setweight(to_tsvector('english'::regconfig, coalesce(body, '')), 'D') ||
  setweight(to_tsvector('english'::regconfig, coalesce(transcript_search_document, '')), 'D') ||
  setweight(to_tsvector('english'::regconfig, coalesce(question_answer_search_document, '')), 'D')
) STORED;
CREATE INDEX sermons_search_vector_idx ON sermons USING gin (search_vector);

DROP VIEW sermon_content_readiness;

CREATE OR REPLACE FUNCTION refresh_sermon_enrichment(target_sermon_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE sermons s
  SET summary_search_document = CASE
        WHEN s.summary_status = 'approved' THEN COALESCE(s.summary, '')
        ELSE ''
      END,
      transcript_search_document = COALESCE((
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
        AND s.summary_status = 'approved'
        AND char_length(trim(s.summary)) BETWEEN 80 AND 2000
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

CREATE FUNCTION refresh_sermon_enrichment_from_sermon()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_sermon_enrichment(NEW.id);
  RETURN NEW;
END
$$;

CREATE TRIGGER sermons_refresh_description_enrichment
AFTER INSERT OR UPDATE OF summary, summary_status ON sermons
FOR EACH ROW EXECUTE FUNCTION refresh_sermon_enrichment_from_sermon();

CREATE VIEW sermon_content_readiness AS
SELECT
  s.id AS sermon_id,
  s.source_wordpress_id,
  (s.speaker_id IS NOT NULL) AS has_one_speaker,
  (
    s.summary_status = 'approved'
    AND char_length(trim(s.summary)) BETWEEN 80 AND 2000
  ) AS has_approved_description,
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
    AND s.summary_status = 'approved'
    AND char_length(trim(s.summary)) BETWEEN 80 AND 2000
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

COMMENT ON COLUMN sermons.summary IS
  'Bounded plain-text sermon description. Only approved values are public, searchable, or launch-ready.';
COMMENT ON COLUMN sermons.seo_description IS
  'Optional controlled SEO/social description override. It is distinct from the visible sermon description.';
COMMENT ON VIEW sermon_content_readiness IS
  'Derived publication and launch-readiness facts, including one approved description for every included sermon.';

COMMIT;

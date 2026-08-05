BEGIN;

DO $$
DECLARE
  affected_sermon_ids text;
BEGIN
  SELECT string_agg(sermon_id::text, ', ' ORDER BY sermon_id::text)
  INTO affected_sermon_ids
  FROM (
    SELECT sermon_id
    FROM sermon_speakers
    GROUP BY sermon_id
    HAVING count(*) > 1
  ) anomalies;

  IF affected_sermon_ids IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Migration 0004 refused multiple speaker relationships for sermon IDs: '
        || affected_sermon_ids;
  END IF;
END
$$;

ALTER TABLE sermons
  ADD COLUMN speaker_id uuid,
  ADD COLUMN historical_backfill_required boolean NOT NULL DEFAULT false,
  ADD COLUMN transcript_search_document text NOT NULL DEFAULT '',
  ADD COLUMN question_answer_search_document text NOT NULL DEFAULT '';

UPDATE sermons s
SET speaker_id = relationship.speaker_id
FROM (
  SELECT sermon_id, min(speaker_id::text)::uuid AS speaker_id
  FROM sermon_speakers
  GROUP BY sermon_id
) relationship
WHERE relationship.sermon_id = s.id;

ALTER TABLE sermons
  ADD CONSTRAINT sermons_speaker_id_fkey
    FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE RESTRICT;

CREATE INDEX sermons_speaker_filter_idx
  ON sermons (speaker_id, service_date DESC, id)
  WHERE speaker_id IS NOT NULL AND deleted_at IS NULL;

DROP TABLE sermon_speakers;

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

CREATE TABLE sermon_transcripts (
  sermon_id uuid PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  body_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'missing'
    CHECK (status IN ('missing', 'draft', 'in_review', 'approved')),
  source_kind text NOT NULL DEFAULT 'manual'
    CHECK (source_kind IN ('manual', 'caption', 'transcription', 'imported', 'generated_draft')),
  source_reference text CHECK (
    source_reference IS NULL OR char_length(source_reference) BETWEEN 1 AND 500
  ),
  reviewed_by_subject text,
  approved_by_subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (body_text !~ '<[^>]+>'),
  CHECK (status = 'missing' OR char_length(trim(body_text)) > 0),
  CHECK (
    status NOT IN ('in_review', 'approved')
    OR (reviewed_at IS NOT NULL AND reviewed_by_subject IS NOT NULL)
  ),
  CHECK (
    status <> 'approved'
    OR (approved_at IS NOT NULL AND approved_by_subject IS NOT NULL)
  )
);

CREATE TABLE sermon_question_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  question_text text NOT NULL CHECK (char_length(trim(question_text)) BETWEEN 1 AND 1000),
  answer_text text NOT NULL CHECK (char_length(trim(answer_text)) BETWEEN 1 AND 10000),
  display_order integer NOT NULL CHECK (display_order BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved')),
  source_kind text NOT NULL DEFAULT 'manual'
    CHECK (source_kind IN ('manual', 'imported', 'generated_draft')),
  source_reference text CHECK (
    source_reference IS NULL OR char_length(source_reference) BETWEEN 1 AND 500
  ),
  reviewed_by_subject text,
  approved_by_subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (question_text !~ '<[^>]+>'),
  CHECK (answer_text !~ '<[^>]+>'),
  CHECK (
    status NOT IN ('in_review', 'approved')
    OR (reviewed_at IS NOT NULL AND reviewed_by_subject IS NOT NULL)
  ),
  CHECK (
    status <> 'approved'
    OR (approved_at IS NOT NULL AND approved_by_subject IS NOT NULL)
  ),
  UNIQUE (sermon_id, display_order)
);

CREATE INDEX sermon_question_answers_sermon_status_idx
  ON sermon_question_answers (sermon_id, status, display_order);

CREATE TABLE sermon_enrichment_draft_imports (
  sermon_id uuid PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  source_wordpress_id bigint NOT NULL,
  content_checksum text NOT NULL CHECK (content_checksum ~ '^[0-9a-f]{64}$'),
  imported_by_subject text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION refresh_sermon_enrichment(target_sermon_id uuid)
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

CREATE FUNCTION refresh_sermon_enrichment_from_child()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_sermon_enrichment(OLD.sermon_id);
    RETURN OLD;
  END IF;

  PERFORM refresh_sermon_enrichment(NEW.sermon_id);
  RETURN NEW;
END
$$;

CREATE TRIGGER sermon_transcripts_refresh_enrichment
AFTER INSERT OR UPDATE OR DELETE ON sermon_transcripts
FOR EACH ROW EXECUTE FUNCTION refresh_sermon_enrichment_from_child();

CREATE TRIGGER sermon_question_answers_refresh_enrichment
AFTER INSERT OR UPDATE OR DELETE ON sermon_question_answers
FOR EACH ROW EXECUTE FUNCTION refresh_sermon_enrichment_from_child();

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

UPDATE sermons
SET historical_backfill_required = source_wordpress_id IS NOT NULL;

SELECT refresh_sermon_enrichment(id) FROM sermons WHERE deleted_at IS NULL;

COMMENT ON COLUMN sermons.speaker_id IS
  'The sole runtime speaker relationship. Nullable only while a draft or historical backfill record is incomplete.';
COMMENT ON TABLE sermon_transcripts IS
  'Plain-text full transcripts with explicit human review and approval. Public output includes approved body text only.';
COMMENT ON TABLE sermon_question_answers IS
  'Ordered plain-text sermon questions and answers. Generated drafts remain non-public until human approval.';
COMMENT ON VIEW sermon_content_readiness IS
  'Derived publication and launch-readiness facts; the production gate requires every included historical record to be complete.';

COMMIT;

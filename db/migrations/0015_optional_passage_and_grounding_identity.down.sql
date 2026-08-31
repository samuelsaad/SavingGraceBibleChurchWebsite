BEGIN;

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
        AND EXISTS (
          SELECT 1 FROM sermon_book_classifications classification
          JOIN book_classifications book ON book.id = classification.book_classification_id
          WHERE classification.sermon_id = s.id
            AND book.canonical_book_id IS NOT NULL
        )
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

CREATE VIEW sermon_content_readiness AS
SELECT
  s.id AS sermon_id,
  s.source_wordpress_id,
  (s.speaker_id IS NOT NULL) AS has_one_speaker,
  EXISTS (
    SELECT 1 FROM sermon_book_classifications classification
    JOIN book_classifications book ON book.id = classification.book_classification_id
    WHERE classification.sermon_id = s.id
      AND book.canonical_book_id IS NOT NULL
  ) AS has_required_bible_book,
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
  ) AS is_content_complete,
  (
    s.speaker_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM sermon_book_classifications classification
      JOIN book_classifications book ON book.id = classification.book_classification_id
      WHERE classification.sermon_id = s.id
        AND book.canonical_book_id IS NOT NULL
    )
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

COMMENT ON VIEW sermon_content_readiness IS
  'Separates reviewed content from required canonical Bible-book metadata and replacement-launch completeness.';

ALTER TABLE scripture_references
  DROP CONSTRAINT scripture_references_structured_parentage_check,
  DROP CONSTRAINT scripture_references_primary_structure_check,
  ADD CONSTRAINT scripture_references_primary_structure_check CHECK (
    relationship_role <> 'primary' OR
    (
      canonical_book_id IS NOT NULL AND
      start_chapter IS NOT NULL AND
      end_chapter IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION enforce_primary_passage_review_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_sermon_id uuid;
  decision_status text;
  confirmed_primary_count integer;
  confirmed_lead_count integer;
BEGIN
  target_sermon_id := COALESCE(NEW.sermon_id, OLD.sermon_id);
  SELECT review_status INTO decision_status
  FROM sermon_primary_passage_reviews
  WHERE sermon_id = target_sermon_id;
  SELECT
    count(*) FILTER (WHERE relationship_role = 'primary' AND review_status = 'confirmed'),
    count(*) FILTER (WHERE relationship_role = 'primary' AND review_status = 'confirmed' AND is_lead)
  INTO confirmed_primary_count, confirmed_lead_count
  FROM scripture_references
  WHERE sermon_id = target_sermon_id;
  IF confirmed_primary_count > 0 AND decision_status IS DISTINCT FROM 'confirmed_passage' THEN
    RAISE EXCEPTION 'confirmed_primary_passage_requires_explicit_review_decision';
  END IF;
  IF decision_status = 'confirmed_passage' AND
     (confirmed_primary_count < 1 OR confirmed_lead_count <> 1) THEN
    RAISE EXCEPTION 'confirmed_passage_decision_requires_exactly_one_lead_primary';
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER sermon_transcripts_rotate_grounding_revision ON sermon_transcripts;
DROP FUNCTION rotate_sermon_transcript_grounding_revision();
DROP TABLE sermon_transcript_legacy_grounding_bindings;
DROP INDEX sermon_transcripts_grounding_revision_uq;
ALTER TABLE sermon_transcripts DROP COLUMN grounding_revision_id;

COMMIT;

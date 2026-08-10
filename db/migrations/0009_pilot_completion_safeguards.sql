BEGIN;

DROP VIEW sermon_content_readiness;

ALTER TABLE sermon_enrichment_reviews
  DROP CONSTRAINT sermon_enrichment_reviews_atomic_expectation_check,
  ADD CONSTRAINT sermon_enrichment_reviews_atomic_expectation_check CHECK (
    (
      source_record_key IS NULL
      AND expected_item_count IS NULL
      AND expected_item_set_sha256 IS NULL
      AND expected_transcript_sha256 IS NULL
      AND expected_transcript_row_version IS NULL
      AND atomic_schema_version IS NULL
    )
    OR
    (
      source_record_key ~ '^authorised-record-[1-9][0-9]*$'
      AND expected_item_count BETWEEN 0 AND 200
      AND expected_item_set_sha256 ~ '^[0-9a-f]{64}$'
      AND expected_transcript_sha256 ~ '^[0-9a-f]{64}$'
      AND expected_transcript_row_version > 0
      AND atomic_schema_version = 1
    )
  );

UPDATE sermon_enrichment_reviews
SET current_stage = 6
WHERE completed_at IS NOT NULL AND current_stage <> 6;

ALTER TABLE sermon_enrichment_reviews
  ADD CONSTRAINT sermon_enrichment_reviews_completed_stage_check
    CHECK (completed_at IS NULL OR current_stage = 6);

ALTER TABLE audit_events
  ADD COLUMN review_item_identity_sha256 text,
  ADD CONSTRAINT audit_events_review_item_identity_check CHECK (
    review_item_identity_sha256 IS NULL
    OR review_item_identity_sha256 ~ '^[0-9a-f]{64}$'
  );

UPDATE audit_events audit
SET review_item_identity_sha256 = item.item_identity_sha256
FROM sermon_enrichment_review_items item
WHERE audit.entity_type = 'sermon'
  AND audit.entity_id = item.sermon_id
  AND audit.actor_subject = item.decided_by_subject
  AND audit.created_at = item.decided_at
  AND audit.action = 'sermon.enrichment_review_item_' || item.decision_status
  AND item.item_identity_sha256 IS NOT NULL
  AND (
    SELECT count(*)
    FROM sermon_enrichment_review_items candidate
    WHERE candidate.sermon_id = audit.entity_id
      AND candidate.decided_by_subject = audit.actor_subject
      AND candidate.decided_at = audit.created_at
      AND 'sermon.enrichment_review_item_' || candidate.decision_status = audit.action
      AND candidate.item_identity_sha256 IS NOT NULL
  ) = 1;

CREATE FUNCTION protect_audit_events_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('savinggrace.application_request', true) = 'on' THEN
    RAISE EXCEPTION 'audit_events_are_append_only_for_application_requests';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER audit_events_append_only_for_application
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION protect_audit_events_append_only();

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

COMMENT ON COLUMN audit_events.review_item_identity_sha256 IS
  'Stable non-content identity for an exactly attributable atomic review-item decision. Legacy ambiguous events remain null.';
COMMENT ON VIEW sermon_content_readiness IS
  'Separates reviewed content from required canonical Bible-book metadata and replacement-launch completeness.';

COMMIT;

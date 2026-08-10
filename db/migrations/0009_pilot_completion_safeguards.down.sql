BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM audit_events WHERE review_item_identity_sha256 IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM sermon_enrichment_reviews WHERE expected_item_count = 0
  ) THEN
    RAISE EXCEPTION 'pilot_safeguards_rollback_refused_preserved_evidence';
  END IF;
END;
$$;

DROP VIEW sermon_content_readiness;
DROP TRIGGER audit_events_append_only_for_application ON audit_events;
DROP FUNCTION protect_audit_events_append_only();

ALTER TABLE audit_events
  DROP CONSTRAINT audit_events_review_item_identity_check,
  DROP COLUMN review_item_identity_sha256;

ALTER TABLE sermon_enrichment_reviews
  DROP CONSTRAINT sermon_enrichment_reviews_completed_stage_check,
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
      AND expected_item_count BETWEEN 1 AND 200
      AND expected_item_set_sha256 ~ '^[0-9a-f]{64}$'
      AND expected_transcript_sha256 ~ '^[0-9a-f]{64}$'
      AND expected_transcript_row_version > 0
      AND atomic_schema_version = 1
    )
  );

CREATE OR REPLACE FUNCTION refresh_sermon_enrichment(target_sermon_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE sermons s
  SET summary_search_document = CASE WHEN s.summary_status = 'approved' THEN COALESCE(s.summary, '') ELSE '' END,
      transcript_search_document = COALESCE((
        SELECT transcript.body_text FROM sermon_transcripts transcript
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
        AND EXISTS (SELECT 1 FROM sermon_transcripts transcript WHERE transcript.sermon_id = s.id AND transcript.status = 'approved' AND char_length(trim(transcript.body_text)) > 0)
        AND (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) BETWEEN 5 AND 10
        AND NOT EXISTS (SELECT 1 FROM sermon_question_answers qa WHERE qa.sermon_id = s.id AND qa.status <> 'approved')
        AND EXISTS (SELECT 1 FROM sermon_media media WHERE media.sermon_id = s.id AND media.provider IN ('youtube', 'sermonaudio') AND media.canonical_url IS NOT NULL AND char_length(trim(media.title)) > 0)
        AND NOT EXISTS (SELECT 1 FROM sermon_media media WHERE media.sermon_id = s.id AND (media.provider NOT IN ('youtube', 'sermonaudio') OR media.canonical_url IS NULL OR media.title IS NULL OR char_length(trim(media.title)) = 0))
      )
  WHERE s.id = target_sermon_id;
$$;

CREATE VIEW sermon_content_readiness AS
SELECT
  s.id AS sermon_id,
  s.source_wordpress_id,
  (s.speaker_id IS NOT NULL) AS has_one_speaker,
  (s.summary_status = 'approved' AND char_length(trim(s.summary)) BETWEEN 80 AND 2000) AS has_approved_description,
  EXISTS (SELECT 1 FROM sermon_transcripts transcript WHERE transcript.sermon_id = s.id AND transcript.status = 'approved' AND char_length(trim(transcript.body_text)) > 0) AS has_approved_transcript,
  (SELECT count(*)::integer FROM sermon_question_answers qa WHERE qa.sermon_id = s.id AND qa.status = 'approved') AS approved_question_count,
  (SELECT count(*)::integer FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) AS total_question_count,
  (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) > 0
    AND NOT EXISTS (SELECT 1 FROM sermon_question_answers qa WHERE qa.sermon_id = s.id AND qa.status <> 'approved') AS all_questions_approved,
  EXISTS (SELECT 1 FROM sermon_media media WHERE media.sermon_id = s.id AND media.provider IN ('youtube', 'sermonaudio') AND media.canonical_url IS NOT NULL AND char_length(trim(media.title)) > 0)
    AND NOT EXISTS (SELECT 1 FROM sermon_media media WHERE media.sermon_id = s.id AND (media.provider NOT IN ('youtube', 'sermonaudio') OR media.canonical_url IS NULL OR media.title IS NULL OR char_length(trim(media.title)) = 0)) AS has_valid_controlled_media,
  (
    s.speaker_id IS NOT NULL
    AND s.summary_status = 'approved'
    AND char_length(trim(s.summary)) BETWEEN 80 AND 2000
    AND EXISTS (SELECT 1 FROM sermon_transcripts transcript WHERE transcript.sermon_id = s.id AND transcript.status = 'approved' AND char_length(trim(transcript.body_text)) > 0)
    AND (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) BETWEEN 5 AND 10
    AND NOT EXISTS (SELECT 1 FROM sermon_question_answers qa WHERE qa.sermon_id = s.id AND qa.status <> 'approved')
    AND EXISTS (SELECT 1 FROM sermon_media media WHERE media.sermon_id = s.id AND media.provider IN ('youtube', 'sermonaudio') AND media.canonical_url IS NOT NULL AND char_length(trim(media.title)) > 0)
    AND NOT EXISTS (SELECT 1 FROM sermon_media media WHERE media.sermon_id = s.id AND (media.provider NOT IN ('youtube', 'sermonaudio') OR media.canonical_url IS NULL OR media.title IS NULL OR char_length(trim(media.title)) = 0))
  ) AS is_complete
FROM sermons s
WHERE s.deleted_at IS NULL;

SELECT refresh_sermon_enrichment(id) FROM sermons WHERE deleted_at IS NULL;

COMMIT;

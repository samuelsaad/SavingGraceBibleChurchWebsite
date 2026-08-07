BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sermon_enrichment_reviews review
    WHERE review.completed_at IS NOT NULL OR review.completed_by_subject IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'atomic_review_rollback_refused_completed_review';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM sermon_enrichment_review_items item
    WHERE item.decision_status <> 'pending'
       OR item.correction_text IS NOT NULL
       OR item.decided_by_subject IS NOT NULL
       OR item.decided_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'atomic_review_rollback_refused_existing_decision';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM audit_events audit
    JOIN sermon_enrichment_reviews review ON review.sermon_id = audit.entity_id
    WHERE audit.action LIKE 'sermon.enrichment_review_item_%'
       OR audit.action = 'sermon.enrichment_review_finished'
       OR audit.actor_subject = 'local-admin-0001'
  ) THEN
    RAISE EXCEPTION 'atomic_review_rollback_refused_relevant_audit';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM sermon_enrichment_reviews review
    JOIN sermon_transcripts transcript ON transcript.sermon_id = review.sermon_id
    WHERE review.atomic_schema_version = 1
      AND (
        review.expected_transcript_row_version <> transcript.row_version
        OR review.expected_transcript_sha256 <>
          encode(digest(convert_to(transcript.body_text, 'UTF8'), 'sha256'), 'hex')
        OR review.expected_item_count <> (
          SELECT count(*) FROM sermon_enrichment_review_items item
          WHERE item.sermon_id = review.sermon_id
        )
        OR review.expected_item_count <> (
          SELECT count(*) FROM sermon_enrichment_review_items item
          WHERE item.sermon_id = review.sermon_id
            AND item.item_identity_sha256 IS NOT NULL
        )
        OR review.expected_item_set_sha256 <> (
          SELECT encode(digest(convert_to(string_agg(
            item.item_identity_sha256, E'\n' ORDER BY item.display_order
          ), 'UTF8'), 'sha256'), 'hex')
          FROM sermon_enrichment_review_items item
          WHERE item.sermon_id = review.sermon_id
            AND item.item_identity_sha256 IS NOT NULL
        )
      )
  ) OR EXISTS (
    SELECT 1
    FROM sermon_enrichment_review_items item
    LEFT JOIN sermon_enrichment_reviews review ON review.sermon_id = item.sermon_id
    WHERE item.item_identity_sha256 IS NOT NULL
      AND review.atomic_schema_version IS DISTINCT FROM 1
  ) THEN
    RAISE EXCEPTION 'atomic_review_rollback_refused_identity_or_transcript_mismatch';
  END IF;
END;
$$;

DELETE FROM sermon_enrichment_review_items
WHERE item_identity_sha256 IS NOT NULL;

UPDATE sermon_enrichment_reviews
SET source_record_key = NULL,
    expected_item_count = NULL,
    expected_item_set_sha256 = NULL,
    expected_transcript_sha256 = NULL,
    expected_transcript_row_version = NULL,
    atomic_schema_version = NULL;

CREATE OR REPLACE FUNCTION seed_sermon_enrichment_review(target_sermon_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  transcript_version integer;
  unresolved_count integer;
  caption_item_count integer;
  combined_warning_detail text;
BEGIN
  SELECT transcript.row_version
  INTO transcript_version
  FROM sermon_transcripts transcript
  WHERE transcript.sermon_id = target_sermon_id;

  IF transcript_version IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sermon_enrichment_sources source
    WHERE source.sermon_id = target_sermon_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO sermon_enrichment_reviews (sermon_id)
  VALUES (target_sermon_id)
  ON CONFLICT (sermon_id) DO NOTHING;

  SELECT jsonb_array_length(source.unresolved_passages)
  INTO unresolved_count
  FROM sermon_enrichment_sources source
  WHERE source.sermon_id = target_sermon_id;

  INSERT INTO sermon_enrichment_review_items (
    sermon_id, item_key, category, display_order, label, guidance,
    source_marker, transcript_row_version
  )
  SELECT
    target_sermon_id,
    'caption-passage-' || passage.ordinality,
    'caption_error',
    passage.ordinality::integer,
    'Possible caption wording',
    COALESCE(NULLIF(passage.value->>'safeReason', ''), 'Check this wording against the sermon context.'),
    NULLIF(passage.value->>'marker', ''),
    transcript_version
  FROM sermon_enrichment_sources source
  CROSS JOIN LATERAL jsonb_array_elements(source.unresolved_passages)
    WITH ORDINALITY AS passage(value, ordinality)
  WHERE source.sermon_id = target_sermon_id
  ON CONFLICT (sermon_id, item_key) DO NOTHING;

  INSERT INTO sermon_enrichment_review_items (
    sermon_id, item_key, category, display_order, label, guidance,
    source_marker, transcript_row_version
  )
  SELECT
    target_sermon_id,
    'caption-general',
    'caption_error',
    1,
    'Possible caption errors',
    COALESCE(NULLIF(warning.value->>'safeDetail', ''), 'Read the transcript carefully for possible caption errors.'),
    NULL,
    transcript_version
  FROM sermon_enrichment_sources source
  CROSS JOIN LATERAL jsonb_array_elements(source.warnings) AS warning(value)
  WHERE source.sermon_id = target_sermon_id
    AND COALESCE(unresolved_count, 0) = 0
    AND warning.value->>'code' = 'possible_caption_errors_require_review'
  ON CONFLICT (sermon_id, item_key) DO NOTHING;

  SELECT CASE
    WHEN COALESCE(unresolved_count, 0) > 0 THEN unresolved_count
    WHEN EXISTS (
      SELECT 1
      FROM sermon_enrichment_sources source
      CROSS JOIN LATERAL jsonb_array_elements(source.warnings) AS warning(value)
      WHERE source.sermon_id = target_sermon_id
        AND warning.value->>'code' = 'possible_caption_errors_require_review'
    ) THEN 1
    ELSE 0
  END
  INTO caption_item_count;

  SELECT warning.value->>'safeDetail'
  INTO combined_warning_detail
  FROM sermon_enrichment_sources source
  CROSS JOIN LATERAL jsonb_array_elements(source.warnings) AS warning(value)
  WHERE source.sermon_id = target_sermon_id
    AND warning.value->>'code' = 'names_and_scripture_references_require_verification'
  LIMIT 1;

  IF combined_warning_detail IS NOT NULL THEN
    INSERT INTO sermon_enrichment_review_items (
      sermon_id, item_key, category, display_order, label, guidance,
      source_marker, transcript_row_version
    ) VALUES
      (
        target_sermon_id,
        'name-verification',
        'name',
        caption_item_count + 1,
        'Names require verification',
        combined_warning_detail,
        NULL,
        transcript_version
      ),
      (
        target_sermon_id,
        'scripture-verification',
        'scripture',
        caption_item_count + 2,
        'Scripture references require verification',
        combined_warning_detail,
        NULL,
        transcript_version
      )
    ON CONFLICT (sermon_id, item_key) DO NOTHING;
  END IF;
END;
$$;

SELECT seed_sermon_enrichment_review(source.sermon_id)
FROM sermon_enrichment_sources source
ORDER BY source.sermon_id;

DROP INDEX sermon_enrichment_review_items_atomic_identity_idx;

ALTER TABLE sermon_enrichment_review_items
  DROP CONSTRAINT sermon_enrichment_review_items_atomic_shape_check,
  DROP CONSTRAINT sermon_enrichment_review_items_category_check,
  DROP COLUMN atomic_schema_version,
  DROP COLUMN source_transcript_sha256,
  DROP COLUMN supporting_paragraphs,
  DROP COLUMN finding_detail,
  DROP COLUMN category_ordinal,
  DROP COLUMN source_record_key,
  DROP COLUMN item_identity_sha256,
  ADD CONSTRAINT sermon_enrichment_review_items_category_check
    CHECK (category IN ('caption_error', 'name', 'scripture'));

ALTER TABLE sermon_enrichment_reviews
  DROP CONSTRAINT sermon_enrichment_reviews_source_record_key_unique,
  DROP CONSTRAINT sermon_enrichment_reviews_atomic_expectation_check,
  DROP COLUMN atomic_schema_version,
  DROP COLUMN expected_transcript_row_version,
  DROP COLUMN expected_transcript_sha256,
  DROP COLUMN expected_item_set_sha256,
  DROP COLUMN expected_item_count,
  DROP COLUMN source_record_key;

COMMENT ON TABLE sermon_enrichment_review_items IS
  'Private typed review decisions tied to a transcript row version. Missing decisions never imply acceptance.';

COMMIT;

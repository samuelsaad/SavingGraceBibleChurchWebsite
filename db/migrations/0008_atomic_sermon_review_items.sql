BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sermon_enrichment_reviews review
    WHERE review.completed_at IS NOT NULL OR review.completed_by_subject IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'atomic_review_migration_refused_completed_review';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM sermon_enrichment_review_items item
    WHERE item.decision_status <> 'pending'
       OR item.correction_text IS NOT NULL
       OR item.decided_by_subject IS NOT NULL
       OR item.decided_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'atomic_review_migration_refused_existing_decision';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM audit_events audit
    JOIN sermon_enrichment_reviews review ON review.sermon_id = audit.entity_id
    WHERE audit.action LIKE 'sermon.enrichment_review_item_%'
       OR audit.action = 'sermon.enrichment_review_finished'
       OR audit.actor_subject = 'local-admin-0001'
  ) THEN
    RAISE EXCEPTION 'atomic_review_migration_refused_relevant_audit';
  END IF;
END;
$$;

ALTER TABLE sermon_enrichment_reviews
  ADD COLUMN source_record_key text,
  ADD COLUMN expected_item_count integer,
  ADD COLUMN expected_item_set_sha256 text,
  ADD COLUMN expected_transcript_sha256 text,
  ADD COLUMN expected_transcript_row_version integer,
  ADD COLUMN atomic_schema_version integer,
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
  ),
  ADD CONSTRAINT sermon_enrichment_reviews_source_record_key_unique UNIQUE (source_record_key);

ALTER TABLE sermon_enrichment_review_items
  DROP CONSTRAINT sermon_enrichment_review_items_category_check,
  ADD COLUMN item_identity_sha256 text,
  ADD COLUMN source_record_key text,
  ADD COLUMN category_ordinal integer,
  ADD COLUMN finding_detail text,
  ADD COLUMN supporting_paragraphs integer[],
  ADD COLUMN source_transcript_sha256 text,
  ADD COLUMN atomic_schema_version integer,
  ADD CONSTRAINT sermon_enrichment_review_items_category_check CHECK (
    category IN ('caption_error', 'name_or_scripture_reference', 'name', 'scripture')
  ),
  ADD CONSTRAINT sermon_enrichment_review_items_atomic_shape_check CHECK (
    (
      item_identity_sha256 IS NULL
      AND source_record_key IS NULL
      AND category_ordinal IS NULL
      AND finding_detail IS NULL
      AND supporting_paragraphs IS NULL
      AND source_transcript_sha256 IS NULL
      AND atomic_schema_version IS NULL
      AND category IN ('caption_error', 'name', 'scripture')
    )
    OR
    (
      item_identity_sha256 ~ '^[0-9a-f]{64}$'
      AND item_key = 'atomic-' || item_identity_sha256
      AND source_record_key ~ '^authorised-record-[1-9][0-9]*$'
      AND category IN ('caption_error', 'name_or_scripture_reference')
      AND category_ordinal BETWEEN 1 AND 100
      AND char_length(finding_detail) BETWEEN 1 AND 1000
      AND cardinality(supporting_paragraphs) BETWEEN 1 AND 100
      AND source_transcript_sha256 ~ '^[0-9a-f]{64}$'
      AND atomic_schema_version = 1
    )
  );

CREATE UNIQUE INDEX sermon_enrichment_review_items_atomic_identity_idx
  ON sermon_enrichment_review_items (item_identity_sha256)
  WHERE item_identity_sha256 IS NOT NULL;

CREATE OR REPLACE FUNCTION seed_sermon_enrichment_review(target_sermon_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  transcript_version integer;
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
END;
$$;

COMMENT ON TABLE sermon_enrichment_review_items IS
  'Private atomic review decisions. Legacy aggregate rows are transitional only and never count as atomic review items.';

COMMIT;

BEGIN;

CREATE TABLE sermon_enrichment_reviews (
  sermon_id uuid PRIMARY KEY REFERENCES sermon_enrichment_sources(sermon_id) ON DELETE CASCADE,
  identity_status text NOT NULL DEFAULT 'pending'
    CHECK (identity_status IN ('pending', 'confirmed')),
  current_stage smallint NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 6),
  completed_by_subject text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_subject text,
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (
    (completed_at IS NULL AND completed_by_subject IS NULL)
    OR (completed_at IS NOT NULL AND completed_by_subject IS NOT NULL)
  )
);

COMMENT ON TABLE sermon_enrichment_reviews IS
  'Private guided administrator-review progress. A pending row is not a review decision or approval.';

CREATE TABLE sermon_enrichment_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id uuid NOT NULL REFERENCES sermon_enrichment_reviews(sermon_id) ON DELETE CASCADE,
  item_key text NOT NULL,
  category text NOT NULL CHECK (category IN ('caption_error', 'name', 'scripture')),
  display_order integer NOT NULL CHECK (display_order > 0),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  guidance text NOT NULL CHECK (char_length(guidance) BETWEEN 1 AND 1000),
  source_marker text,
  decision_status text NOT NULL DEFAULT 'pending'
    CHECK (decision_status IN ('pending', 'accepted', 'corrected', 'left_unresolved', 'rejected')),
  correction_text text,
  transcript_row_version integer NOT NULL CHECK (transcript_row_version > 0),
  decided_by_subject text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  UNIQUE (sermon_id, item_key),
  UNIQUE (sermon_id, display_order),
  CHECK (
    (decision_status = 'pending'
      AND correction_text IS NULL
      AND decided_by_subject IS NULL
      AND decided_at IS NULL)
    OR
    (decision_status = 'corrected'
      AND source_marker IS NOT NULL
      AND char_length(trim(correction_text)) > 0
      AND decided_by_subject IS NOT NULL
      AND decided_at IS NOT NULL)
    OR
    (decision_status IN ('accepted', 'left_unresolved', 'rejected')
      AND correction_text IS NULL
      AND decided_by_subject IS NOT NULL
      AND decided_at IS NOT NULL)
  )
);

COMMENT ON TABLE sermon_enrichment_review_items IS
  'Private typed review decisions tied to a transcript row version. Missing decisions never imply acceptance.';

CREATE INDEX sermon_enrichment_review_items_queue_idx
  ON sermon_enrichment_review_items (sermon_id, decision_status, category, display_order);

CREATE INDEX sermon_enrichment_reviews_resume_idx
  ON sermon_enrichment_reviews (completed_at, updated_at DESC);

CREATE FUNCTION seed_sermon_enrichment_review(target_sermon_id uuid)
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

CREATE FUNCTION seed_sermon_enrichment_review_from_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM seed_sermon_enrichment_review(NEW.sermon_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sermon_enrichment_sources_seed_review
AFTER INSERT ON sermon_enrichment_sources
FOR EACH ROW EXECUTE FUNCTION seed_sermon_enrichment_review_from_source();

CREATE TRIGGER sermon_transcripts_seed_enrichment_review
AFTER INSERT ON sermon_transcripts
FOR EACH ROW EXECUTE FUNCTION seed_sermon_enrichment_review_from_source();

SELECT seed_sermon_enrichment_review(source.sermon_id)
FROM sermon_enrichment_sources source
ORDER BY source.sermon_id;

COMMIT;

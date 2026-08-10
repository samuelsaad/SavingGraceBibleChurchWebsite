BEGIN;

ALTER TABLE sermon_enrichment_reviews
  ADD COLUMN empty_item_set_acknowledged_by_subject text,
  ADD COLUMN empty_item_set_acknowledged_at timestamptz,
  ADD CONSTRAINT sermon_enrichment_reviews_empty_item_set_acknowledgement_check CHECK (
    (
      empty_item_set_acknowledged_by_subject IS NULL
      AND empty_item_set_acknowledged_at IS NULL
    )
    OR
    (
      expected_item_count = 0
      AND empty_item_set_acknowledged_by_subject IS NOT NULL
      AND empty_item_set_acknowledged_at IS NOT NULL
    )
  );

COMMENT ON COLUMN sermon_enrichment_reviews.empty_item_set_acknowledged_by_subject IS
  'Administrator who explicitly confirmed inspection of a verified empty atomic finding set.';

COMMENT ON COLUMN sermon_enrichment_reviews.empty_item_set_acknowledged_at IS
  'Time of the explicit empty-set acknowledgement. Null is never treated as approval.';

WITH verified_empty_reviews AS (
  SELECT review.sermon_id
  FROM sermon_enrichment_reviews review
  JOIN sermon_transcripts transcript ON transcript.sermon_id = review.sermon_id
  WHERE review.expected_item_count = 0
    AND review.expected_item_set_sha256 =
      encode(digest(convert_to('', 'UTF8'), 'sha256'), 'hex')
    AND review.expected_transcript_sha256 =
      encode(digest(convert_to(transcript.body_text, 'UTF8'), 'sha256'), 'hex')
    AND NOT EXISTS (
      SELECT 1
      FROM sermon_enrichment_review_items item
      WHERE item.sermon_id = review.sermon_id
    )
)
UPDATE sermon_enrichment_reviews review
SET expected_transcript_row_version = transcript.row_version,
    current_stage = CASE
      WHEN review.completed_at IS NULL
        AND review.identity_status = 'confirmed'
        AND review.empty_item_set_acknowledged_at IS NULL
      THEN 2
      ELSE review.current_stage
    END,
    updated_at = now(),
    updated_by_subject = 'migration-0010',
    row_version = review.row_version + 1
FROM sermon_transcripts transcript
JOIN verified_empty_reviews verified ON verified.sermon_id = transcript.sermon_id
WHERE review.sermon_id = verified.sermon_id
  AND (
    review.expected_transcript_row_version IS DISTINCT FROM transcript.row_version
    OR (
      review.completed_at IS NULL
      AND review.identity_status = 'confirmed'
      AND review.empty_item_set_acknowledged_at IS NULL
      AND review.current_stage <> 2
    )
  );

COMMIT;

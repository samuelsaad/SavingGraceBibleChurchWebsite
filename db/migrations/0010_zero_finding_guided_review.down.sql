BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sermon_enrichment_reviews
    WHERE empty_item_set_acknowledged_at IS NOT NULL
       OR empty_item_set_acknowledged_by_subject IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'zero_finding_review_rollback_refused_acknowledgement_evidence';
  END IF;
END;
$$;

ALTER TABLE sermon_enrichment_reviews
  DROP CONSTRAINT sermon_enrichment_reviews_empty_item_set_acknowledgement_check,
  DROP COLUMN empty_item_set_acknowledged_at,
  DROP COLUMN empty_item_set_acknowledged_by_subject;

COMMIT;

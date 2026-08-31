BEGIN;

DROP TRIGGER sermon_enrichment_reviews_passage_decision_consistency
  ON sermon_enrichment_reviews;
DROP FUNCTION enforce_completed_enrichment_review_passage_decision();

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
  IF decision_status = 'confirmed_none' AND confirmed_primary_count <> 0 THEN
    RAISE EXCEPTION 'confirmed_no_primary_passage_cannot_have_confirmed_coordinates';
  END IF;
  RETURN NULL;
END
$$;

COMMIT;

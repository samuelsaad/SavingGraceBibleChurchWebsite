BEGIN;

CREATE FUNCTION enforce_completed_enrichment_review_passage_decision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND NOT (
    EXISTS (
      SELECT 1
      FROM sermon_primary_passage_reviews review
      WHERE review.sermon_id = NEW.sermon_id
        AND review.review_status = 'confirmed_none'
    )
    OR EXISTS (
      SELECT 1
      FROM sermon_primary_passage_reviews review
      JOIN scripture_references passage ON passage.sermon_id = review.sermon_id
      WHERE review.sermon_id = NEW.sermon_id
        AND review.review_status = 'confirmed_passage'
        AND passage.relationship_role = 'primary'
        AND passage.review_status = 'confirmed'
        AND passage.is_lead
        AND passage.canonical_book_id IS NOT NULL
    )
  ) THEN
    RAISE EXCEPTION 'completed_enrichment_review_requires_primary_passage_decision';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER sermon_enrichment_reviews_passage_decision_consistency
AFTER INSERT OR UPDATE OF completed_at, completed_by_subject ON sermon_enrichment_reviews
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_completed_enrichment_review_passage_decision();

CREATE OR REPLACE FUNCTION enforce_primary_passage_review_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_sermon_id uuid;
  decision_status text;
  confirmed_primary_count integer;
  confirmed_lead_count integer;
  completed_review_exists boolean;
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
  SELECT EXISTS (
    SELECT 1 FROM sermon_enrichment_reviews review
    WHERE review.sermon_id = target_sermon_id AND review.completed_at IS NOT NULL
  ) INTO completed_review_exists;
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
  IF completed_review_exists AND decision_status NOT IN ('confirmed_passage', 'confirmed_none') THEN
    RAISE EXCEPTION 'completed_enrichment_review_requires_primary_passage_decision';
  END IF;
  RETURN NULL;
END
$$;

COMMIT;

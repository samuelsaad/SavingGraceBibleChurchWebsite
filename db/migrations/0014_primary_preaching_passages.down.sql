BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sermon_primary_passage_reviews) OR EXISTS (
    SELECT 1 FROM scripture_references
    WHERE relationship_role <> 'unclassified'
       OR is_lead
       OR provenance <> 'legacy_import'
       OR review_status <> 'unreviewed'
       OR reviewer_subject IS NOT NULL
       OR reviewed_at IS NOT NULL
       OR parser_version IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'primary_passage_rollback_refused_preserved_review_evidence';
  END IF;
END
$$;

DROP TRIGGER IF EXISTS sermon_primary_passage_reviews_consistency ON sermon_primary_passage_reviews;
DROP TRIGGER IF EXISTS scripture_references_primary_review_consistency ON scripture_references;
DROP FUNCTION IF EXISTS enforce_primary_passage_review_consistency();

DROP TABLE IF EXISTS sermon_primary_passage_reviews;
DROP INDEX IF EXISTS scripture_references_confirmed_primary_overlap_idx;
DROP INDEX IF EXISTS scripture_references_one_confirmed_lead_primary_uq;

ALTER TABLE scripture_references
  DROP CONSTRAINT IF EXISTS scripture_references_structured_range_order_check,
  DROP CONSTRAINT IF EXISTS scripture_references_row_version_positive_check,
  DROP CONSTRAINT IF EXISTS scripture_references_proposal_provenance_check,
  DROP CONSTRAINT IF EXISTS scripture_references_review_attribution_check,
  DROP CONSTRAINT IF EXISTS scripture_references_primary_structure_check,
  DROP CONSTRAINT IF EXISTS scripture_references_lead_role_check,
  DROP CONSTRAINT IF EXISTS scripture_references_review_status_check,
  DROP CONSTRAINT IF EXISTS scripture_references_provenance_check,
  DROP CONSTRAINT IF EXISTS scripture_references_relationship_role_check,
  DROP COLUMN IF EXISTS row_version,
  DROP COLUMN IF EXISTS parser_version,
  DROP COLUMN IF EXISTS reviewed_at,
  DROP COLUMN IF EXISTS reviewer_subject,
  DROP COLUMN IF EXISTS review_status,
  DROP COLUMN IF EXISTS provenance,
  DROP COLUMN IF EXISTS original_reference_text,
  DROP COLUMN IF EXISTS is_lead,
  DROP COLUMN IF EXISTS relationship_role;

COMMIT;

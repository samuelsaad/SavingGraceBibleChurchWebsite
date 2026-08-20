BEGIN;

ALTER TABLE scripture_references
  ADD COLUMN relationship_role text NOT NULL DEFAULT 'unclassified',
  ADD COLUMN is_lead boolean NOT NULL DEFAULT false,
  ADD COLUMN original_reference_text text,
  ADD COLUMN provenance text NOT NULL DEFAULT 'legacy_import',
  ADD COLUMN review_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN reviewer_subject text,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN parser_version text,
  ADD COLUMN row_version integer NOT NULL DEFAULT 1;

ALTER TABLE scripture_references
  ADD CONSTRAINT scripture_references_relationship_role_check
    CHECK (relationship_role IN ('primary', 'supporting', 'unclassified')),
  ADD CONSTRAINT scripture_references_provenance_check
    CHECK (provenance IN ('legacy_import', 'administrator', 'title_proposal', 'administrator_correction')),
  ADD CONSTRAINT scripture_references_review_status_check
    CHECK (review_status IN ('unreviewed', 'proposed', 'confirmed', 'rejected')),
  ADD CONSTRAINT scripture_references_lead_role_check
    CHECK (NOT is_lead OR relationship_role = 'primary'),
  ADD CONSTRAINT scripture_references_primary_structure_check
    CHECK (
      relationship_role <> 'primary' OR
      (
        canonical_book_id IS NOT NULL AND
        start_chapter IS NOT NULL AND
        end_chapter IS NOT NULL
      )
    ),
  ADD CONSTRAINT scripture_references_review_attribution_check
    CHECK (
      (review_status IN ('confirmed', 'rejected') AND reviewer_subject IS NOT NULL AND reviewed_at IS NOT NULL) OR
      (review_status IN ('unreviewed', 'proposed') AND reviewer_subject IS NULL AND reviewed_at IS NULL)
    ),
  ADD CONSTRAINT scripture_references_proposal_provenance_check
    CHECK (
      review_status <> 'proposed' OR
      (provenance = 'title_proposal' AND parser_version IS NOT NULL AND original_reference_text IS NOT NULL)
    ),
  ADD CONSTRAINT scripture_references_row_version_positive_check CHECK (row_version > 0),
  ADD CONSTRAINT scripture_references_structured_range_order_check CHECK (
    canonical_book_id IS NULL OR start_chapter IS NULL OR end_chapter IS NULL OR
    (end_chapter * 1000 + COALESCE(end_verse, 999)) >=
      (start_chapter * 1000 + COALESCE(start_verse, 0))
  );

CREATE UNIQUE INDEX scripture_references_one_confirmed_lead_primary_uq
  ON scripture_references (sermon_id)
  WHERE relationship_role = 'primary' AND review_status = 'confirmed' AND is_lead;

CREATE INDEX scripture_references_confirmed_primary_overlap_idx
  ON scripture_references (
    canonical_book_id,
    (start_chapter * 1000 + COALESCE(start_verse, 0)),
    (end_chapter * 1000 + COALESCE(end_verse, 999)),
    sermon_id
  )
  WHERE relationship_role = 'primary' AND review_status = 'confirmed';

CREATE TABLE sermon_primary_passage_reviews (
  sermon_id uuid PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  proposal_outcome text NOT NULL
    CHECK (proposal_outcome IN ('proposed', 'no_reference', 'manual_review_required', 'administrator_entered')),
  evidence_source text NOT NULL
    CHECK (evidence_source IN ('local_youtube_title', 'administrator')),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  parser_version text NOT NULL CHECK (char_length(parser_version) BETWEEN 1 AND 100),
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'confirmed_passage', 'confirmed_none', 'rejected')),
  reviewed_by_subject text,
  reviewed_at timestamptz,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (
    (review_status = 'pending' AND reviewed_by_subject IS NULL AND reviewed_at IS NULL) OR
    (review_status <> 'pending' AND reviewed_by_subject IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

COMMENT ON TABLE sermon_primary_passage_reviews IS
  'Private proposal/review state only. Exact local source-title evidence remains in ignored private storage.';

CREATE FUNCTION enforce_primary_passage_review_consistency()
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
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER scripture_references_primary_review_consistency
AFTER INSERT OR UPDATE OR DELETE ON scripture_references
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_primary_passage_review_consistency();

CREATE CONSTRAINT TRIGGER sermon_primary_passage_reviews_consistency
AFTER INSERT OR UPDATE OR DELETE ON sermon_primary_passage_reviews
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_primary_passage_review_consistency();

COMMIT;

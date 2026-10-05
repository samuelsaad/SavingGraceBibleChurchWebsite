BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM scripture_references WHERE provenance='ai_transcript_proposal')
    OR EXISTS (SELECT 1 FROM sermon_primary_passage_reviews WHERE evidence_source='retained_transcript')
    OR EXISTS (SELECT 1 FROM sermon_ai_metadata_assignments WHERE scope_id='D-169' AND component='passage') THEN
    RAISE EXCEPTION 'd169_passage_evidence_prevents_schema_rollback';
  END IF;
END $$;

ALTER TABLE scripture_references DROP CONSTRAINT scripture_references_d169_transcript_origin_check;
ALTER TABLE scripture_references DROP CONSTRAINT scripture_references_provenance_check;
ALTER TABLE scripture_references ADD CONSTRAINT scripture_references_provenance_check
  CHECK (provenance IN ('legacy_import','administrator','title_proposal','administrator_correction'));
ALTER TABLE scripture_references DROP CONSTRAINT scripture_references_proposal_provenance_check;
ALTER TABLE scripture_references ADD CONSTRAINT scripture_references_proposal_provenance_check
  CHECK (review_status <> 'proposed' OR
    (provenance='title_proposal' AND parser_version IS NOT NULL AND original_reference_text IS NOT NULL));

ALTER TABLE sermon_primary_passage_reviews DROP CONSTRAINT sermon_primary_passage_reviews_d169_transcript_origin_check;
ALTER TABLE sermon_primary_passage_reviews DROP CONSTRAINT sermon_primary_passage_reviews_evidence_source_check;
ALTER TABLE sermon_primary_passage_reviews ADD CONSTRAINT sermon_primary_passage_reviews_evidence_source_check
  CHECK (evidence_source IN ('local_youtube_title','administrator'));

COMMIT;

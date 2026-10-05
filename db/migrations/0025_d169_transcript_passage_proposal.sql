BEGIN;

-- New D-169 proposals retain their actual transcript origin. Existing source
-- classes and human review states keep exactly their previous meaning.
ALTER TABLE scripture_references DROP CONSTRAINT scripture_references_provenance_check;
ALTER TABLE scripture_references ADD CONSTRAINT scripture_references_provenance_check
  CHECK (provenance IN ('legacy_import','administrator','title_proposal','administrator_correction','ai_transcript_proposal'));
ALTER TABLE scripture_references DROP CONSTRAINT scripture_references_proposal_provenance_check;
ALTER TABLE scripture_references ADD CONSTRAINT scripture_references_proposal_provenance_check
  CHECK (review_status <> 'proposed' OR
    (provenance IN ('title_proposal','ai_transcript_proposal') AND parser_version IS NOT NULL AND original_reference_text IS NOT NULL));
ALTER TABLE scripture_references ADD CONSTRAINT scripture_references_d169_transcript_origin_check
  CHECK (provenance <> 'ai_transcript_proposal' OR
    (parser_version IS NOT NULL AND parser_version='d169-transcript-supported-private-proposal-v1'));

ALTER TABLE sermon_primary_passage_reviews DROP CONSTRAINT sermon_primary_passage_reviews_evidence_source_check;
ALTER TABLE sermon_primary_passage_reviews ADD CONSTRAINT sermon_primary_passage_reviews_evidence_source_check
  CHECK (evidence_source IN ('local_youtube_title','administrator','retained_transcript'));
ALTER TABLE sermon_primary_passage_reviews ADD CONSTRAINT sermon_primary_passage_reviews_d169_transcript_origin_check
  CHECK (evidence_source <> 'retained_transcript' OR parser_version='d169-transcript-supported-private-proposal-v1');

COMMIT;

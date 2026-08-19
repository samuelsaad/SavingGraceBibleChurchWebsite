BEGIN;

ALTER TABLE sermon_enrichment_sources
  DROP CONSTRAINT sermon_enrichment_sources_retrieval_attribution_check,
  ADD CONSTRAINT sermon_enrichment_sources_retrieval_attribution_check
    CHECK (retrieval_attribution IN (
      'authorised_youtube_studio_export',
      'authorised_youtube_data_api'
    ));

COMMIT;

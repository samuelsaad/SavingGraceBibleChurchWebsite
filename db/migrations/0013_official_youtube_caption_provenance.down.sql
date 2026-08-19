BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sermon_enrichment_sources
    WHERE retrieval_attribution <> 'authorised_youtube_studio_export'
  ) THEN
    RAISE EXCEPTION 'Cannot roll back official YouTube caption provenance while dependent rows exist';
  END IF;
END
$$;

ALTER TABLE sermon_enrichment_sources
  DROP CONSTRAINT sermon_enrichment_sources_retrieval_attribution_check,
  ADD CONSTRAINT sermon_enrichment_sources_retrieval_attribution_check
    CHECK (retrieval_attribution = 'authorised_youtube_studio_export');

COMMIT;

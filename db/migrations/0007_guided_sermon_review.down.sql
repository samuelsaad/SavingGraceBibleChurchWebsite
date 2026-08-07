BEGIN;

DROP TRIGGER IF EXISTS sermon_enrichment_sources_seed_review ON sermon_enrichment_sources;
DROP TRIGGER IF EXISTS sermon_transcripts_seed_enrichment_review ON sermon_transcripts;
DROP FUNCTION IF EXISTS seed_sermon_enrichment_review_from_source();
DROP FUNCTION IF EXISTS seed_sermon_enrichment_review(uuid);
DROP TABLE IF EXISTS sermon_enrichment_review_items;
DROP TABLE IF EXISTS sermon_enrichment_reviews;

COMMIT;

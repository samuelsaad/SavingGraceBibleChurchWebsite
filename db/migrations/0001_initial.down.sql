BEGIN;

DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS redirects;
DROP TABLE IF EXISTS migration_warnings;
DROP TABLE IF EXISTS migration_records;
DROP TABLE IF EXISTS migration_runs;
DROP TABLE IF EXISTS sermon_extensions;
DROP TABLE IF EXISTS sermon_resources;
DROP TABLE IF EXISTS sermon_media_source_audit;
DROP TABLE IF EXISTS sermon_media;
DROP TABLE IF EXISTS scripture_reference_sources;
DROP TABLE IF EXISTS scripture_references;
DROP TABLE IF EXISTS sermon_source_terms;
DROP TABLE IF EXISTS sermon_book_classifications;
DROP TABLE IF EXISTS sermon_series_map;
DROP TABLE IF EXISTS sermon_speakers;
DROP TABLE IF EXISTS source_taxonomy_terms;
DROP TABLE IF EXISTS book_classifications;
DROP TABLE IF EXISTS bible_books;
DROP TABLE IF EXISTS series;
DROP TABLE IF EXISTS speakers;
DROP TABLE IF EXISTS sermon_legacy_metrics;
DROP TABLE IF EXISTS sermons;
DROP TABLE IF EXISTS media_assets;

COMMIT;

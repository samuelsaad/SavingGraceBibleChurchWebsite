BEGIN;

DROP TRIGGER IF EXISTS sermons_remove_stale_description_semantics ON sermons;
DROP FUNCTION IF EXISTS remove_stale_description_semantic_relationships();
DROP VIEW IF EXISTS sermon_description_semantic_eligibility;
DROP TABLE IF EXISTS description_semantic_relationships;
DROP TABLE IF EXISTS description_semantic_builds;

COMMIT;

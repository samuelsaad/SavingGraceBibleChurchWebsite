BEGIN;
DROP TABLE IF EXISTS accepted_description_semantic_active;
DROP TABLE IF EXISTS accepted_description_semantic_members;
DROP TABLE IF EXISTS accepted_description_semantic_builds;
DROP TABLE IF EXISTS accepted_description_semantic_vectors;
DROP FUNCTION IF EXISTS reject_accepted_semantic_artifact_update();
COMMIT;

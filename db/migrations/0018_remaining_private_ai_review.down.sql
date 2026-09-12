BEGIN;
DROP TABLE sermon_ai_metadata_assignments;
DROP TABLE sermon_ai_component_reviews;
DROP TABLE remaining_ai_review_members;
DROP TABLE remaining_ai_review_scopes;
DROP FUNCTION protect_remaining_ai_review_history();
COMMIT;

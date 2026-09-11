BEGIN;
DROP TRIGGER qa_protect_ai_content ON sermon_question_answers;
DROP TRIGGER sermons_protect_ai_content ON sermons;
DROP FUNCTION protect_ai_reviewed_content_from_import();
DROP TABLE sermon_ai_content_reviews;
DROP TABLE delegated_ai_review_members;
DROP TABLE delegated_ai_review_scopes;
DROP FUNCTION protect_delegated_ai_review_history();
COMMIT;

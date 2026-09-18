BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sermon_d161_restricted_acceptances)
    OR EXISTS (SELECT 1 FROM sermon_ai_content_reviews WHERE scope_id='D-161')
    OR EXISTS (SELECT 1 FROM sermon_ai_component_reviews WHERE scope_id='D-161') THEN
    RAISE EXCEPTION 'd161_evidence_prevents_schema_rollback';
  END IF;
END $$;
DROP TRIGGER sermon_d161_restricted_acceptance_withdrawals_immutable ON sermon_d161_restricted_acceptance_withdrawals;
DROP TRIGGER sermon_d161_restricted_acceptances_immutable ON sermon_d161_restricted_acceptances;
DROP TABLE sermon_d161_restricted_acceptance_withdrawals;
DROP TABLE sermon_d161_restricted_acceptances;
DROP FUNCTION protect_d161_restricted_acceptance_history();
DROP FUNCTION d161_restricted_acceptance_dependency(uuid);

ALTER TABLE sermon_ai_metadata_assignments DROP CONSTRAINT sermon_ai_metadata_assignments_reviewer_subject_check;
ALTER TABLE sermon_ai_metadata_assignments ADD CONSTRAINT sermon_ai_metadata_assignments_reviewer_subject_check
  CHECK (reviewer_subject='codex-astra-remaining-private-review');
ALTER TABLE sermon_ai_component_reviews DROP CONSTRAINT sermon_ai_component_reviews_reviewer_subject_check;
ALTER TABLE sermon_ai_component_reviews ADD CONSTRAINT sermon_ai_component_reviews_reviewer_subject_check
  CHECK (reviewer_subject='codex-astra-remaining-private-review');
ALTER TABLE sermon_ai_component_reviews DROP CONSTRAINT sermon_ai_component_reviews_provenance_check;
ALTER TABLE sermon_ai_component_reviews ADD CONSTRAINT sermon_ai_component_reviews_provenance_check CHECK (
  provenance->>'reviewer_kind'='ai' AND provenance->>'provider'='OpenAI'
  AND provenance->>'model'='gpt-6-astra' AND provenance->>'execution_surface'='Codex'
  AND provenance->>'separately_billed_api_used'='false');
ALTER TABLE sermon_ai_content_reviews DROP CONSTRAINT sermon_ai_content_reviews_reviewer_subject_check;
ALTER TABLE sermon_ai_content_reviews ADD CONSTRAINT sermon_ai_content_reviews_reviewer_subject_check
  CHECK (reviewer_subject='codex-astra-delegated-review');
ALTER TABLE sermon_ai_content_reviews DROP CONSTRAINT sermon_ai_content_reviews_provenance_check;
ALTER TABLE sermon_ai_content_reviews ADD CONSTRAINT sermon_ai_content_reviews_provenance_check CHECK (
  provenance->>'reviewer_kind'='ai' AND provenance->>'provider'='OpenAI'
  AND provenance->>'model'='gpt-6-astra' AND provenance->>'execution_surface'='Codex');
ALTER TABLE remaining_ai_review_scopes DROP CONSTRAINT remaining_ai_review_scopes_id_check;
ALTER TABLE remaining_ai_review_scopes ADD CONSTRAINT remaining_ai_review_scopes_id_check CHECK (id='D-157');
ALTER TABLE delegated_ai_review_scopes DROP CONSTRAINT delegated_ai_review_scopes_id_check;
ALTER TABLE delegated_ai_review_scopes ADD CONSTRAINT delegated_ai_review_scopes_id_check CHECK (id='D-156');
COMMIT;

BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sermon_d167_restricted_acceptances)
    OR EXISTS (SELECT 1 FROM sermon_ai_content_reviews WHERE scope_id='D-167')
    OR EXISTS (SELECT 1 FROM sermon_ai_component_reviews WHERE scope_id='D-167')
    OR EXISTS (SELECT 1 FROM sermon_ai_metadata_assignments WHERE scope_id='D-167')
    OR EXISTS (SELECT 1 FROM delegated_ai_review_scopes WHERE id='D-167')
    OR EXISTS (SELECT 1 FROM remaining_ai_review_scopes WHERE id='D-167') THEN
    RAISE EXCEPTION 'd167_evidence_prevents_schema_rollback';
  END IF;
END $$;
DROP TRIGGER sermon_d167_restricted_acceptance_withdrawals_immutable ON sermon_d167_restricted_acceptance_withdrawals;
DROP TRIGGER sermon_d167_restricted_acceptances_immutable ON sermon_d167_restricted_acceptances;
DROP TABLE sermon_d167_restricted_acceptance_withdrawals;
DROP TABLE sermon_d167_restricted_acceptances;
DROP FUNCTION protect_d167_restricted_acceptance_history();
DROP FUNCTION d167_restricted_acceptance_dependency(uuid);

ALTER TABLE sermon_ai_metadata_assignments DROP CONSTRAINT sermon_ai_metadata_assignments_reviewer_subject_check;
ALTER TABLE sermon_ai_metadata_assignments ADD CONSTRAINT sermon_ai_metadata_assignments_reviewer_subject_check CHECK (
  (scope_id='D-157' AND reviewer_subject='codex-astra-remaining-private-review')
  OR (scope_id='D-161' AND reviewer_subject='codex-d161-d160-private-review')
  OR (scope_id='D-162' AND reviewer_subject='codex-d162-private-review'));
ALTER TABLE sermon_ai_component_reviews DROP CONSTRAINT sermon_ai_component_reviews_reviewer_subject_check;
ALTER TABLE sermon_ai_component_reviews ADD CONSTRAINT sermon_ai_component_reviews_reviewer_subject_check CHECK (
  (scope_id='D-157' AND reviewer_subject='codex-astra-remaining-private-review')
  OR (scope_id='D-161' AND reviewer_subject='codex-d161-d160-private-review')
  OR (scope_id='D-162' AND reviewer_subject='codex-d162-private-review'));
ALTER TABLE sermon_ai_component_reviews DROP CONSTRAINT sermon_ai_component_reviews_provenance_check;
ALTER TABLE sermon_ai_component_reviews ADD CONSTRAINT sermon_ai_component_reviews_provenance_check CHECK (
  provenance->>'reviewer_kind'='ai' AND provenance->>'provider'='OpenAI'
  AND provenance->>'execution_surface'='Codex'
  AND provenance->>'separately_billed_api_used'='false'
  AND ((scope_id='D-157' AND provenance->>'model'='gpt-6-astra')
    OR (scope_id IN ('D-161','D-162') AND provenance->>'model'='not_exposed_by_runtime')));
ALTER TABLE sermon_ai_content_reviews DROP CONSTRAINT sermon_ai_content_reviews_reviewer_subject_check;
ALTER TABLE sermon_ai_content_reviews ADD CONSTRAINT sermon_ai_content_reviews_reviewer_subject_check CHECK (
  (scope_id='D-156' AND reviewer_subject='codex-astra-delegated-review')
  OR (scope_id='D-161' AND reviewer_subject='codex-d161-d160-private-review')
  OR (scope_id='D-162' AND reviewer_subject='codex-d162-private-review'));
ALTER TABLE sermon_ai_content_reviews DROP CONSTRAINT sermon_ai_content_reviews_provenance_check;
ALTER TABLE sermon_ai_content_reviews ADD CONSTRAINT sermon_ai_content_reviews_provenance_check CHECK (
  provenance->>'reviewer_kind' = 'ai' AND provenance->>'provider' = 'OpenAI'
  AND provenance->>'execution_surface' = 'Codex'
  AND ((scope_id='D-156' AND provenance->>'model'='gpt-6-astra')
    OR (scope_id IN ('D-161','D-162') AND provenance->>'model'='not_exposed_by_runtime')));
ALTER TABLE remaining_ai_review_scopes DROP CONSTRAINT remaining_ai_review_scopes_id_check;
ALTER TABLE remaining_ai_review_scopes ADD CONSTRAINT remaining_ai_review_scopes_id_check CHECK (id IN ('D-157','D-161','D-162'));
ALTER TABLE delegated_ai_review_scopes DROP CONSTRAINT delegated_ai_review_scopes_id_check;
ALTER TABLE delegated_ai_review_scopes ADD CONSTRAINT delegated_ai_review_scopes_id_check CHECK (id IN ('D-156','D-161','D-162'));
COMMIT;

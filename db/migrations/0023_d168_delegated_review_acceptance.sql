BEGIN;

-- D-168 adds one exact review/acceptance profile without changing any earlier review or acceptance evidence.
ALTER TABLE delegated_ai_review_scopes DROP CONSTRAINT delegated_ai_review_scopes_id_check;
ALTER TABLE delegated_ai_review_scopes ADD CONSTRAINT delegated_ai_review_scopes_id_check
  CHECK (id IN ('D-156','D-161','D-162','D-167','D-168'));
ALTER TABLE remaining_ai_review_scopes DROP CONSTRAINT remaining_ai_review_scopes_id_check;
ALTER TABLE remaining_ai_review_scopes ADD CONSTRAINT remaining_ai_review_scopes_id_check
  CHECK (id IN ('D-157','D-161','D-162','D-167','D-168'));

ALTER TABLE sermon_ai_content_reviews DROP CONSTRAINT sermon_ai_content_reviews_provenance_check;
ALTER TABLE sermon_ai_content_reviews ADD CONSTRAINT sermon_ai_content_reviews_provenance_check CHECK (
  provenance->>'reviewer_kind' = 'ai' AND provenance->>'provider' = 'OpenAI'
  AND provenance->>'execution_surface' = 'Codex'
  AND ((scope_id='D-156' AND provenance->>'model'='gpt-6-astra')
    OR (scope_id IN ('D-161','D-162','D-167','D-168') AND provenance->>'model'='not_exposed_by_runtime')));
ALTER TABLE sermon_ai_content_reviews DROP CONSTRAINT sermon_ai_content_reviews_reviewer_subject_check;
ALTER TABLE sermon_ai_content_reviews ADD CONSTRAINT sermon_ai_content_reviews_reviewer_subject_check CHECK (
  (scope_id='D-156' AND reviewer_subject='codex-astra-delegated-review')
  OR (scope_id='D-161' AND reviewer_subject='codex-d161-d160-private-review')
  OR (scope_id='D-162' AND reviewer_subject='codex-d162-private-review')
  OR (scope_id='D-167' AND reviewer_subject='codex-d167-private-review')
  OR (scope_id='D-168' AND reviewer_subject='codex-d168-private-review'));

ALTER TABLE sermon_ai_component_reviews DROP CONSTRAINT sermon_ai_component_reviews_provenance_check;
ALTER TABLE sermon_ai_component_reviews ADD CONSTRAINT sermon_ai_component_reviews_provenance_check CHECK (
  provenance->>'reviewer_kind'='ai' AND provenance->>'provider'='OpenAI'
  AND provenance->>'execution_surface'='Codex'
  AND provenance->>'separately_billed_api_used'='false'
  AND ((scope_id='D-157' AND provenance->>'model'='gpt-6-astra')
    OR (scope_id IN ('D-161','D-162','D-167','D-168') AND provenance->>'model'='not_exposed_by_runtime')));
ALTER TABLE sermon_ai_component_reviews DROP CONSTRAINT sermon_ai_component_reviews_reviewer_subject_check;
ALTER TABLE sermon_ai_component_reviews ADD CONSTRAINT sermon_ai_component_reviews_reviewer_subject_check CHECK (
  (scope_id='D-157' AND reviewer_subject='codex-astra-remaining-private-review')
  OR (scope_id='D-161' AND reviewer_subject='codex-d161-d160-private-review')
  OR (scope_id='D-162' AND reviewer_subject='codex-d162-private-review')
  OR (scope_id='D-167' AND reviewer_subject='codex-d167-private-review')
  OR (scope_id='D-168' AND reviewer_subject='codex-d168-private-review'));
ALTER TABLE sermon_ai_metadata_assignments DROP CONSTRAINT sermon_ai_metadata_assignments_reviewer_subject_check;
ALTER TABLE sermon_ai_metadata_assignments ADD CONSTRAINT sermon_ai_metadata_assignments_reviewer_subject_check CHECK (
  (scope_id='D-157' AND reviewer_subject='codex-astra-remaining-private-review')
  OR (scope_id='D-161' AND reviewer_subject='codex-d161-d160-private-review')
  OR (scope_id='D-162' AND reviewer_subject='codex-d162-private-review')
  OR (scope_id='D-167' AND reviewer_subject='codex-d167-private-review')
  OR (scope_id='D-168' AND reviewer_subject='codex-d168-private-review'));

CREATE TABLE sermon_d168_restricted_acceptances (
  sermon_id uuid PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision='D-168'),
  source_manifest_sha256 text NOT NULL CHECK (source_manifest_sha256='87e2d08e592a089cd7bfe1fcc42c5e8399f1bbd78b83d49de8e2933c1b8df21a'),
  acceptance_manifest_sha256 text NOT NULL CHECK (acceptance_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  content_dependency_sha256 text NOT NULL CHECK (content_dependency_sha256 ~ '^[a-f0-9]{64}$'),
  fingerprint_format text NOT NULL CHECK (fingerprint_format='d168-utc-jsonb-v1'),
  accepted_row_version integer NOT NULL CHECK (accepted_row_version > 0),
  authorized_by text NOT NULL CHECK (authorized_by='samuel-saad-d168-authorization'),
  executed_by text NOT NULL CHECK (executed_by='codex-d168-private-review'),
  manual_review_claimed boolean NOT NULL CHECK (manual_review_claimed=false),
  passage_basis text NOT NULL CHECK (passage_basis IN ('primary_passage','no_single_primary')),
  environment text NOT NULL CHECK (environment IN ('local_loopback','sealed_staging')),
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sermon_d168_restricted_acceptance_withdrawals (
  sermon_id uuid PRIMARY KEY REFERENCES sermon_d168_restricted_acceptances(sermon_id) ON DELETE CASCADE,
  authorization_reference text NOT NULL CHECK (char_length(authorization_reference) BETWEEN 8 AND 200),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  executed_by text NOT NULL CHECK (executed_by='codex-d168-private-review'),
  withdrawn_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION d168_restricted_acceptance_dependency(target uuid) RETURNS text
LANGUAGE sql STABLE SET timezone='UTC' SET datestyle='ISO, YMD' AS $$
  SELECT encode(digest(jsonb_build_object(
    'format','d168-utc-jsonb-v1',
    'base',restricted_acceptance_dependency(target),
    'content_scope',(SELECT to_jsonb(sc) FROM delegated_ai_review_scopes sc WHERE sc.id='D-168'),
    'component_scope',(SELECT to_jsonb(sc) FROM remaining_ai_review_scopes sc WHERE sc.id='D-168'),
    'content_reviews',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.artifact_key,r.created_at,r.id)
      FROM sermon_ai_content_reviews r WHERE r.scope_id='D-168' AND r.sermon_id=target),
    'component_reviews',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.component,r.created_at,r.id)
      FROM sermon_ai_component_reviews r WHERE r.scope_id='D-168' AND r.sermon_id=target),
    'assignments',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.component,r.created_at,r.id)
      FROM sermon_ai_metadata_assignments r WHERE r.scope_id='D-168' AND r.sermon_id=target)
  )::text,'sha256'),'hex');
$$;

CREATE FUNCTION protect_d168_restricted_acceptance_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND pg_trigger_depth()>1
    AND COALESCE(current_setting('savinggrace.application_request',true),'')='on'
    AND NOT EXISTS (SELECT 1 FROM sermons WHERE id=OLD.sermon_id)
    AND EXISTS (SELECT 1 FROM sermon_deletion_tombstones WHERE former_sermon_id=OLD.sermon_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'd168_restricted_acceptance_history_is_immutable';
END
$$;
CREATE TRIGGER sermon_d168_restricted_acceptances_immutable BEFORE UPDATE OR DELETE ON sermon_d168_restricted_acceptances
  FOR EACH ROW EXECUTE FUNCTION protect_d168_restricted_acceptance_history();
CREATE TRIGGER sermon_d168_restricted_acceptance_withdrawals_immutable BEFORE UPDATE OR DELETE ON sermon_d168_restricted_acceptance_withdrawals
  FOR EACH ROW EXECUTE FUNCTION protect_d168_restricted_acceptance_history();

COMMENT ON TABLE sermon_d168_restricted_acceptances IS
  'D-168 AI-attributed restricted-environment acceptance for the exact ninth cohort; not human approval or internet-publication authority.';
COMMIT;

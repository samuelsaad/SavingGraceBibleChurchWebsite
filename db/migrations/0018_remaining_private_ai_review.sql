BEGIN;

-- D-157 is additive attribution. No human lifecycle, readiness view, content,
-- legacy completion trigger or publication guard is changed by this migration.
CREATE TABLE remaining_ai_review_scopes (
  id text PRIMARY KEY CHECK (id = 'D-157'),
  scope_sha256 text NOT NULL CHECK (scope_sha256 ~ '^[0-9a-f]{64}$'),
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[0-9a-f]{64}$'),
  member_count integer NOT NULL CHECK (member_count > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE remaining_ai_review_members (
  scope_id text NOT NULL REFERENCES remaining_ai_review_scopes(id),
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence > 0),
  PRIMARY KEY(scope_id, sermon_id), UNIQUE(scope_id, sequence)
);
CREATE TABLE sermon_ai_component_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id text NOT NULL, sermon_id uuid NOT NULL,
  component text NOT NULL CHECK (component IN ('identity','speaker','findings','transcript','passage','media','completion')),
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  dependency_sha256 text NOT NULL CHECK (dependency_sha256 ~ '^[0-9a-f]{64}$'),
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('accepted','accepted_source_limitation','needs_human')),
  assessment jsonb NOT NULL CHECK (jsonb_typeof(assessment) = 'object'),
  provenance jsonb NOT NULL CHECK (
    provenance->>'reviewer_kind' = 'ai' AND provenance->>'provider' = 'OpenAI'
    AND provenance->>'model' = 'gpt-6-astra' AND provenance->>'execution_surface' = 'Codex'
    AND provenance->>'separately_billed_api_used' = 'false'),
  reviewer_subject text NOT NULL CHECK (reviewer_subject = 'codex-astra-remaining-private-review'),
  reviewed_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(scope_id, sermon_id) REFERENCES remaining_ai_review_members(scope_id, sermon_id) ON DELETE CASCADE,
  UNIQUE(scope_id, sermon_id, component, request_sha256),
  CHECK (component <> 'completion' OR outcome = 'accepted')
);
CREATE INDEX sermon_ai_component_reviews_current_idx
  ON sermon_ai_component_reviews(sermon_id, component, created_at DESC, id DESC);

CREATE TABLE sermon_ai_metadata_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope_id text NOT NULL, sermon_id uuid NOT NULL,
  component text NOT NULL CHECK (component IN ('speaker','passage')),
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[0-9a-f]{64}$'),
  input_sha256 text NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  output_sha256 text NOT NULL CHECK (output_sha256 ~ '^[0-9a-f]{64}$'),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'object'),
  previous_metadata jsonb NOT NULL, current_metadata jsonb NOT NULL,
  reviewer_subject text NOT NULL CHECK (reviewer_subject = 'codex-astra-remaining-private-review'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(scope_id,sermon_id) REFERENCES remaining_ai_review_members(scope_id,sermon_id) ON DELETE CASCADE,
  UNIQUE(scope_id,sermon_id,component,request_sha256)
);

CREATE FUNCTION protect_remaining_ai_review_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Only a later separately authorised guarded parent deletion can cascade.
  -- Direct history deletion and every scope/decision rewrite remain forbidden.
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME IN ('remaining_ai_review_members','sermon_ai_component_reviews','sermon_ai_metadata_assignments') THEN
    IF pg_trigger_depth() > 1
      AND COALESCE(current_setting('savinggrace.application_request', true), '') = 'on'
      AND NOT EXISTS (SELECT 1 FROM sermons WHERE id = OLD.sermon_id)
      AND EXISTS (SELECT 1 FROM sermon_deletion_tombstones WHERE former_sermon_id = OLD.sermon_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'remaining_ai_review_history_is_immutable';
END
$$;
CREATE TRIGGER remaining_ai_review_scopes_immutable BEFORE UPDATE OR DELETE ON remaining_ai_review_scopes
  FOR EACH ROW EXECUTE FUNCTION protect_remaining_ai_review_history();
CREATE TRIGGER remaining_ai_review_members_immutable BEFORE UPDATE OR DELETE ON remaining_ai_review_members
  FOR EACH ROW EXECUTE FUNCTION protect_remaining_ai_review_history();
CREATE TRIGGER sermon_ai_component_reviews_immutable BEFORE UPDATE OR DELETE ON sermon_ai_component_reviews
  FOR EACH ROW EXECUTE FUNCTION protect_remaining_ai_review_history();
CREATE TRIGGER sermon_ai_metadata_assignments_immutable BEFORE UPDATE OR DELETE ON sermon_ai_metadata_assignments
  FOR EACH ROW EXECUTE FUNCTION protect_remaining_ai_review_history();

COMMIT;

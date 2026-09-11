BEGIN;

-- D-156 explicitly authorises the smallest additive distinction from human review.
-- Existing lifecycle approval columns and publication/readiness views are unchanged.
CREATE TABLE delegated_ai_review_scopes (
  id text PRIMARY KEY CHECK (id = 'D-156'),
  scope_sha256 text NOT NULL CHECK (scope_sha256 ~ '^[0-9a-f]{64}$'),
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[0-9a-f]{64}$'),
  member_count integer NOT NULL CHECK (member_count > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE delegated_ai_review_members (
  scope_id text NOT NULL REFERENCES delegated_ai_review_scopes(id),
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence > 0),
  PRIMARY KEY(scope_id, sermon_id),
  UNIQUE(scope_id, sequence)
);
CREATE TABLE sermon_ai_content_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope_id text NOT NULL, sermon_id uuid NOT NULL,
  artifact_key text NOT NULL CHECK (artifact_key = 'description' OR artifact_key ~ '^qa:[0-9a-f-]{36}$'),
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[0-9a-f]{64}$'),
  transcript_sha256 text NOT NULL CHECK (transcript_sha256 ~ '^[0-9a-f]{64}$'),
  grounding_revision_id uuid NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  input_sha256 text NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  output_sha256 text NOT NULL CHECK (output_sha256 ~ '^[0-9a-f]{64}$'),
  input_version integer NOT NULL CHECK (input_version > 0),
  output_version integer NOT NULL CHECK (output_version >= input_version),
  outcome text NOT NULL CHECK (outcome IN ('accepted','corrected_accepted','needs_human')),
  correction_round integer NOT NULL CHECK (correction_round IN (0,1)),
  original_content jsonb NOT NULL, current_content jsonb NOT NULL,
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence) = 'array'),
  coverage jsonb NOT NULL CHECK (jsonb_typeof(coverage) = 'array'),
  assessment jsonb NOT NULL,
  provenance jsonb NOT NULL CHECK (provenance->>'reviewer_kind' = 'ai' AND provenance->>'provider' = 'OpenAI'
    AND provenance->>'model' = 'gpt-6-astra' AND provenance->>'execution_surface' = 'Codex'),
  reviewer_subject text NOT NULL CHECK (reviewer_subject = 'codex-astra-delegated-review'),
  reviewed_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(scope_id, sermon_id) REFERENCES delegated_ai_review_members(scope_id, sermon_id) ON DELETE CASCADE,
  UNIQUE(scope_id, sermon_id, artifact_key, request_sha256),
  CHECK ((outcome = 'corrected_accepted' AND correction_round = 1 AND input_sha256 <> output_sha256 AND output_version = input_version + 1)
    OR (outcome <> 'corrected_accepted' AND input_sha256 = output_sha256 AND output_version = input_version))
);
CREATE INDEX sermon_ai_content_reviews_current_idx ON sermon_ai_content_reviews(sermon_id, artifact_key, created_at DESC);

CREATE FUNCTION protect_delegated_ai_review_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Samuel's post-rejection authority preserves the existing guarded permanent
  -- deletion workflow. This permits no direct history deletion or scope rewrite.
  -- The application must already have removed the parent and created its minimal
  -- non-content tombstone in the same guarded transaction.
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME IN ('delegated_ai_review_members', 'sermon_ai_content_reviews') THEN
    IF pg_trigger_depth() > 1
      AND COALESCE(current_setting('savinggrace.application_request', true), '') = 'on'
      AND NOT EXISTS (SELECT 1 FROM sermons WHERE id = OLD.sermon_id)
      AND EXISTS (SELECT 1 FROM sermon_deletion_tombstones WHERE former_sermon_id = OLD.sermon_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'delegated_ai_review_history_is_immutable';
END
$$;
CREATE TRIGGER delegated_ai_review_scopes_immutable BEFORE UPDATE OR DELETE ON delegated_ai_review_scopes
FOR EACH ROW EXECUTE FUNCTION protect_delegated_ai_review_history();
CREATE TRIGGER delegated_ai_review_members_immutable BEFORE UPDATE OR DELETE ON delegated_ai_review_members
FOR EACH ROW EXECUTE FUNCTION protect_delegated_ai_review_history();
CREATE TRIGGER sermon_ai_content_reviews_immutable BEFORE UPDATE OR DELETE ON sermon_ai_content_reviews
FOR EACH ROW EXECUTE FUNCTION protect_delegated_ai_review_history();

-- Imports have no application marker. Genuine administrator edits may change
-- current content; hash/version matching then makes AI evidence stale.
CREATE FUNCTION protect_ai_reviewed_content_from_import() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid; target_key text; old_content jsonb; changed boolean;
BEGIN
  IF TG_TABLE_NAME = 'sermons' THEN
    target_id := OLD.id; target_key := 'description';
    old_content := jsonb_build_object('description', OLD.summary);
    changed := NEW.summary IS DISTINCT FROM OLD.summary;
  ELSE
    target_id := OLD.sermon_id; target_key := 'qa:' || OLD.id::text;
    old_content := jsonb_build_object('question', OLD.question_text, 'answer', OLD.answer_text);
    IF TG_OP = 'DELETE' THEN changed := true;
    ELSE changed := NEW.question_text IS DISTINCT FROM OLD.question_text OR NEW.answer_text IS DISTINCT FROM OLD.answer_text OR NEW.display_order <> OLD.display_order;
    END IF;
  END IF;
  IF changed AND COALESCE(current_setting('savinggrace.application_request', true),'') <> 'on'
    AND EXISTS (SELECT 1 FROM sermon_ai_content_reviews r WHERE r.sermon_id=target_id AND r.artifact_key=target_key
      AND r.outcome IN ('accepted','corrected_accepted') AND r.current_content=old_content) THEN
    RAISE EXCEPTION 'import_conflicts_with_ai_reviewed_content';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER sermons_protect_ai_content BEFORE UPDATE OF summary ON sermons
FOR EACH ROW EXECUTE FUNCTION protect_ai_reviewed_content_from_import();
CREATE TRIGGER qa_protect_ai_content BEFORE UPDATE OR DELETE ON sermon_question_answers
FOR EACH ROW EXECUTE FUNCTION protect_ai_reviewed_content_from_import();

COMMIT;

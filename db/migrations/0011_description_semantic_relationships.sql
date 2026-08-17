BEGIN;

CREATE VIEW sermon_description_semantic_eligibility AS
SELECT
  sermon.id AS sermon_id,
  sermon.summary AS approved_description,
  encode(digest(convert_to(sermon.summary, 'UTF8'), 'sha256'), 'hex') AS description_sha256
FROM sermons sermon
WHERE sermon.status = 'published'
  AND sermon.deleted_at IS NULL
  AND sermon.summary_status = 'approved'
  AND sermon.summary IS NOT NULL
  AND char_length(trim(sermon.summary)) > 0;

COMMENT ON VIEW sermon_description_semantic_eligibility IS
  'Shared generation, storage and retrieval eligibility. Exposes only sermon identity, approved public description and its hash.';

CREATE TABLE description_semantic_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_fingerprint text NOT NULL UNIQUE CHECK (build_fingerprint ~ '^[a-f0-9]{64}$'),
  pipeline_fingerprint text NOT NULL CHECK (pipeline_fingerprint ~ '^[a-f0-9]{64}$'),
  pipeline_version text NOT NULL CHECK (pipeline_version = 'description-only-semantic-v1'),
  input_field text NOT NULL CHECK (input_field = 'approved_public_description'),
  input_mode text NOT NULL CHECK (input_mode = 'symmetric_document'),
  query_prefix text CHECK (query_prefix IS NULL),
  document_prefix text CHECK (document_prefix IS NULL),
  text_normalisation text NOT NULL CHECK (text_normalisation = 'exact_utf8'),
  model_identifier text NOT NULL CHECK (char_length(trim(model_identifier)) BETWEEN 1 AND 240),
  model_sha256 text NOT NULL CHECK (model_sha256 ~ '^[a-f0-9]{64}$'),
  tokenizer_identifier text NOT NULL CHECK (char_length(trim(tokenizer_identifier)) BETWEEN 1 AND 240),
  tokenizer_sha256 text NOT NULL CHECK (tokenizer_sha256 ~ '^[a-f0-9]{64}$'),
  pooling text NOT NULL CHECK (pooling IN ('mean', 'cls')),
  normalisation text NOT NULL CHECK (normalisation = 'l2_float32'),
  truncation_max_tokens integer NOT NULL CHECK (truncation_max_tokens BETWEEN 1 AND 65536),
  dimensions integer NOT NULL CHECK (dimensions BETWEEN 1 AND 4096),
  corpus_build_version text NOT NULL CHECK (char_length(trim(corpus_build_version)) BETWEEN 1 AND 200),
  quality_policy_id text NOT NULL CHECK (char_length(trim(quality_policy_id)) BETWEEN 1 AND 200),
  minimum_cosine_score real NOT NULL CHECK (minimum_cosine_score BETWEEN -1 AND 1),
  maximum_results integer NOT NULL CHECK (maximum_results BETWEEN 1 AND 20),
  eligible_sermon_count integer NOT NULL CHECK (eligible_sermon_count >= 0),
  relationship_count integer NOT NULL CHECK (relationship_count >= 0),
  quality_status text NOT NULL DEFAULT 'pending'
    CHECK (quality_status IN ('pending', 'approved', 'rejected')),
  quality_approved_by_subject text,
  quality_approved_at timestamptz,
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pipeline_fingerprint, corpus_build_version),
  CHECK (
    (quality_status = 'approved'
      AND quality_approved_by_subject IS NOT NULL
      AND quality_approved_at IS NOT NULL)
    OR
    (quality_status <> 'approved'
      AND quality_approved_by_subject IS NULL
      AND quality_approved_at IS NULL)
  )
);

COMMENT ON TABLE description_semantic_builds IS
  'Private model-independent build provenance. Pending builds are never public Related themes evidence.';

CREATE TABLE description_semantic_relationships (
  build_id uuid NOT NULL REFERENCES description_semantic_builds(id) ON DELETE CASCADE,
  source_sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  neighbour_sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  source_description_sha256 text NOT NULL CHECK (source_description_sha256 ~ '^[a-f0-9]{64}$'),
  neighbour_description_sha256 text NOT NULL CHECK (neighbour_description_sha256 ~ '^[a-f0-9]{64}$'),
  rank integer NOT NULL CHECK (rank > 0),
  raw_cosine_score real NOT NULL CHECK (raw_cosine_score BETWEEN -1 AND 1),
  generated_at timestamptz NOT NULL,
  PRIMARY KEY (build_id, source_sermon_id, neighbour_sermon_id),
  UNIQUE (build_id, source_sermon_id, rank),
  CHECK (source_sermon_id <> neighbour_sermon_id)
);

CREATE INDEX description_semantic_relationships_source_idx
  ON description_semantic_relationships (source_sermon_id, build_id, rank);
CREATE INDEX description_semantic_relationships_neighbour_idx
  ON description_semantic_relationships (neighbour_sermon_id, build_id);

COMMENT ON TABLE description_semantic_relationships IS
  'Private precomputed description-only scores. Stores no description, transcript, Q&A, metadata or embedding vector.';

CREATE FUNCTION remove_stale_description_semantic_relationships()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
    OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
    OR OLD.summary_status IS DISTINCT FROM NEW.summary_status
    OR OLD.summary IS DISTINCT FROM NEW.summary
  THEN
    DELETE FROM description_semantic_relationships relationship
    WHERE relationship.source_sermon_id = NEW.id
       OR relationship.neighbour_sermon_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER sermons_remove_stale_description_semantics
AFTER UPDATE OF status, deleted_at, summary_status, summary ON sermons
FOR EACH ROW EXECUTE FUNCTION remove_stale_description_semantic_relationships();

COMMIT;

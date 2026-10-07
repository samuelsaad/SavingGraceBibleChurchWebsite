BEGIN;

CREATE TABLE accepted_description_semantic_vectors (
  pipeline_fingerprint text NOT NULL CHECK (pipeline_fingerprint ~ '^[a-f0-9]{64}$'),
  description_sha256 text NOT NULL CHECK (description_sha256 ~ '^[a-f0-9]{64}$'),
  dimensions integer NOT NULL CHECK (dimensions BETWEEN 1 AND 4096),
  vector real[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pipeline_fingerprint, description_sha256),
  CHECK (array_ndims(vector)=1 AND cardinality(vector)=dimensions),
  CHECK (array_position(vector,NULL) IS NULL AND NOT vector && ARRAY['NaN'::real,'Infinity'::real,'-Infinity'::real])
);
CREATE TABLE accepted_description_semantic_builds (
  build_fingerprint text PRIMARY KEY CHECK (build_fingerprint ~ '^[a-f0-9]{64}$'),
  environment text NOT NULL CHECK (environment IN ('local','staging_public','staging_protected')),
  frontend_scope text NOT NULL CHECK (frontend_scope IN ('d175_local_completed','d175_completed')),
  corpus_sha256 text NOT NULL CHECK (corpus_sha256 ~ '^[a-f0-9]{64}$'),
  pipeline_fingerprint text NOT NULL CHECK (pipeline_fingerprint ~ '^[a-f0-9]{64}$'),
  plan jsonb NOT NULL CHECK (jsonb_typeof(plan)='object' AND plan->>'schemaVersion'='accepted-description-index-v2'),
  generated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(build_fingerprint,environment,frontend_scope),
  CHECK (environment='local' OR frontend_scope='d175_completed')
);
CREATE TABLE accepted_description_semantic_members (
  build_fingerprint text NOT NULL REFERENCES accepted_description_semantic_builds(build_fingerprint) ON DELETE CASCADE,
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  source_identity text NOT NULL,
  description_sha256 text NOT NULL CHECK (description_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK (state IN ('indexed','unsupported_language','duplicate_source','conflicting_source','input_too_long','unusable_input')),
  PRIMARY KEY(build_fingerprint,sermon_id)
);
CREATE UNIQUE INDEX accepted_semantic_indexed_source_uq ON accepted_description_semantic_members(build_fingerprint,source_identity) WHERE state='indexed';
CREATE TABLE accepted_description_semantic_active (
  environment text NOT NULL,
  frontend_scope text NOT NULL,
  build_fingerprint text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(environment,frontend_scope),
  FOREIGN KEY(build_fingerprint,environment,frontend_scope) REFERENCES accepted_description_semantic_builds(build_fingerprint,environment,frontend_scope)
);
CREATE FUNCTION reject_accepted_semantic_artifact_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Accepted semantic artifacts are immutable'; END $$;
CREATE TRIGGER accepted_semantic_vectors_immutable BEFORE UPDATE ON accepted_description_semantic_vectors FOR EACH ROW EXECUTE FUNCTION reject_accepted_semantic_artifact_update();
CREATE TRIGGER accepted_semantic_builds_immutable BEFORE UPDATE ON accepted_description_semantic_builds FOR EACH ROW EXECUTE FUNCTION reject_accepted_semantic_artifact_update();
COMMENT ON TABLE accepted_description_semantic_active IS 'Evaluation-only active index. Does not confer publication or semantic visitor-release authority.';
COMMENT ON TABLE accepted_description_semantic_vectors IS 'Private resumable float32 cache. Never exposed to clients or committed to Git.';
COMMIT;

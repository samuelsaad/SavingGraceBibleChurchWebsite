BEGIN;
CREATE TABLE source_public_versions (
 version_sha256 text PRIMARY KEY CHECK (version_sha256 ~ '^[0-9a-f]{64}$'),
 source_url text NOT NULL,
 source_wordpress_id bigint,
 source_captured_at timestamptz NOT NULL,
 response_sha256 text NOT NULL CHECK (response_sha256 ~ '^[0-9a-f]{64}$'),
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE source_public_routes (
 path text PRIMARY KEY CHECK (path LIKE '/%' AND path NOT LIKE '//%'),
 version_sha256 text NOT NULL REFERENCES source_public_versions(version_sha256),
 source_wordpress_id bigint,
 withdrawn boolean NOT NULL DEFAULT false,
 row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX source_public_wordpress_idx ON source_public_routes(source_wordpress_id);
CREATE TABLE source_public_imports (
 bundle_sha256 text PRIMARY KEY CHECK (bundle_sha256 ~ '^[0-9a-f]{64}$'),
 inventory_sha256 text NOT NULL CHECK (inventory_sha256 ~ '^[0-9a-f]{64}$'),
 imported_at timestamptz NOT NULL DEFAULT now(),
 release_commit text NOT NULL CHECK (release_commit ~ '^[0-9a-f]{40}$'),
 changes jsonb NOT NULL CHECK (jsonb_typeof(changes) = 'array')
);
CREATE FUNCTION protect_source_public_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Source-public migration history is immutable'; END;
$$;
CREATE TRIGGER source_public_versions_immutable BEFORE UPDATE OR DELETE ON source_public_versions FOR EACH ROW EXECUTE FUNCTION protect_source_public_history();
CREATE TRIGGER source_public_imports_immutable BEFORE UPDATE OR DELETE ON source_public_imports FOR EACH ROW EXECUTE FUNCTION protect_source_public_history();
COMMIT;

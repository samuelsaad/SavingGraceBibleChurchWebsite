BEGIN;

ALTER TABLE description_semantic_builds
  ADD COLUMN model_revision text NOT NULL
    CHECK (model_revision ~ '^[a-f0-9]{40}$'),
  ADD COLUMN runtime_identifier text NOT NULL
    CHECK (char_length(trim(runtime_identifier)) BETWEEN 1 AND 240),
  ADD COLUMN runtime_version text NOT NULL
    CHECK (char_length(trim(runtime_version)) BETWEEN 1 AND 100),
  ADD COLUMN runtime_package_integrity text NOT NULL
    CHECK (runtime_package_integrity ~ '^sha512-[A-Za-z0-9+/]+={0,2}$');

COMMENT ON COLUMN description_semantic_builds.model_revision IS
  'Immutable upstream model revision included in the pipeline fingerprint.';
COMMENT ON COLUMN description_semantic_builds.runtime_package_integrity IS
  'Exact npm registry SHA-512 integrity included in the pipeline fingerprint.';

COMMIT;

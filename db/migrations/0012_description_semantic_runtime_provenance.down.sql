BEGIN;

ALTER TABLE description_semantic_builds
  DROP COLUMN IF EXISTS runtime_package_integrity,
  DROP COLUMN IF EXISTS runtime_version,
  DROP COLUMN IF EXISTS runtime_identifier,
  DROP COLUMN IF EXISTS model_revision;

COMMIT;

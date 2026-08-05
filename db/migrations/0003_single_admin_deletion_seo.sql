BEGIN;

UPDATE audit_events
SET actor_role = 'admin'
WHERE actor_role IN ('editor', 'contributor');

ALTER TABLE audit_events
  DROP CONSTRAINT audit_events_actor_role_check,
  ADD CONSTRAINT audit_events_actor_role_check
    CHECK (actor_role IN ('admin', 'system'));

ALTER TABLE redirects
  ADD COLUMN source_sermon_id uuid;

ALTER TABLE redirects
  ALTER COLUMN new_path DROP NOT NULL,
  DROP CONSTRAINT redirects_status_code_check,
  DROP CONSTRAINT redirects_check,
  ADD CONSTRAINT redirects_status_code_check
    CHECK (status_code IN (301, 302, 307, 308, 410)),
  ADD CONSTRAINT redirects_disposition_shape_check CHECK (
    old_path LIKE '/%'
    AND (
      (status_code = 410 AND new_path IS NULL)
      OR
      (status_code IN (301, 302, 307, 308)
       AND new_path LIKE '/%'
       AND old_path <> new_path)
    )
  );

CREATE INDEX redirects_source_sermon_idx
  ON redirects (source_sermon_id)
  WHERE source_sermon_id IS NOT NULL;

CREATE TABLE sermon_deletion_tombstones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  former_sermon_id uuid NOT NULL UNIQUE,
  former_slug text NOT NULL CHECK (
    char_length(former_slug) BETWEEN 1 AND 200
    AND former_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  actor_subject text NOT NULL CHECK (char_length(actor_subject) BETWEEN 1 AND 200),
  actor_role text NOT NULL DEFAULT 'admin' CHECK (actor_role = 'admin'),
  action text NOT NULL DEFAULT 'sermon.permanent_delete'
    CHECK (action = 'sermon.permanent_delete'),
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 500),
  was_previously_published boolean NOT NULL,
  seo_disposition text CHECK (seo_disposition IN ('redirect', 'gone')),
  redirect_target_path text,
  request_correlation_id text NOT NULL CHECK (
    char_length(request_correlation_id) BETWEEN 1 AND 100
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (was_previously_published AND seo_disposition IS NOT NULL)
    OR
    (NOT was_previously_published AND seo_disposition IS NULL)
  ),
  CHECK (
    (seo_disposition = 'redirect'
      AND redirect_target_path ~ '^/sermons/[a-z0-9]+(-[a-z0-9]+)*/$')
    OR
    (seo_disposition = 'gone' AND redirect_target_path IS NULL)
    OR
    (seo_disposition IS NULL AND redirect_target_path IS NULL)
  )
);

CREATE INDEX sermon_deletion_tombstones_created_idx
  ON sermon_deletion_tombstones (created_at DESC, id);

COMMENT ON TABLE sermon_deletion_tombstones IS
  'Minimal non-content audit tombstones for approved permanent sermon deletion. Never store deleted body, media, source provenance, credentials, or secrets here.';

COMMENT ON COLUMN audit_events.actor_role IS
  'Approved application administrator or non-human system audit actor. Editor and contributor are not active roles.';

COMMIT;

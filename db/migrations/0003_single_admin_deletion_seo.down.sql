BEGIN;

DROP TABLE IF EXISTS sermon_deletion_tombstones;
DROP INDEX IF EXISTS redirects_source_sermon_idx;

ALTER TABLE audit_events
  DROP CONSTRAINT audit_events_actor_role_check,
  ADD CONSTRAINT audit_events_actor_role_check
    CHECK (actor_role IN ('admin', 'editor', 'contributor', 'system'));

DELETE FROM redirects
WHERE status_code = 410 OR new_path IS NULL;

ALTER TABLE redirects
  DROP CONSTRAINT redirects_disposition_shape_check,
  DROP CONSTRAINT redirects_status_code_check,
  DROP COLUMN source_sermon_id,
  ALTER COLUMN new_path SET NOT NULL,
  ADD CONSTRAINT redirects_status_code_check
    CHECK (status_code IN (301, 302, 307, 308)),
  ADD CONSTRAINT redirects_check
    CHECK (old_path LIKE '/%' AND new_path LIKE '/%' AND old_path <> new_path);

COMMENT ON COLUMN audit_events.actor_role IS NULL;

COMMIT;

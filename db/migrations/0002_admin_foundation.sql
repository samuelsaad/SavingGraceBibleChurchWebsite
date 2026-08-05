BEGIN;

ALTER TABLE sermons
  ADD COLUMN created_by_subject text,
  ADD COLUMN updated_by_subject text,
  ADD CONSTRAINT sermons_created_by_subject_length_check
    CHECK (created_by_subject IS NULL OR char_length(created_by_subject) BETWEEN 1 AND 200),
  ADD CONSTRAINT sermons_updated_by_subject_length_check
    CHECK (updated_by_subject IS NULL OR char_length(updated_by_subject) BETWEEN 1 AND 200);

CREATE INDEX sermons_created_by_subject_idx
  ON sermons (created_by_subject, updated_at DESC)
  WHERE created_by_subject IS NOT NULL;

ALTER TABLE speakers
  ADD COLUMN row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0);

ALTER TABLE series
  ADD COLUMN row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0);

ALTER TABLE book_classifications
  ADD COLUMN row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0);

UPDATE audit_events
SET actor_role = CASE actor_role
  WHEN 'administrator' THEN 'admin'
  WHEN 'content_manager' THEN 'editor'
  ELSE actor_role
END;

ALTER TABLE audit_events
  DROP CONSTRAINT audit_events_actor_role_check,
  ADD CONSTRAINT audit_events_actor_role_check
    CHECK (actor_role IN ('admin', 'editor', 'contributor', 'system')),
  ADD COLUMN outcome text NOT NULL DEFAULT 'succeeded'
    CHECK (outcome IN ('succeeded', 'denied', 'failed'));

COMMIT;

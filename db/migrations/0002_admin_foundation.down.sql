BEGIN;

ALTER TABLE audit_events DROP COLUMN IF EXISTS outcome;
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_actor_role_check;
UPDATE audit_events
SET actor_role = CASE actor_role
  WHEN 'admin' THEN 'administrator'
  WHEN 'editor' THEN 'content_manager'
  WHEN 'contributor' THEN 'content_manager'
  ELSE actor_role
END;
ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_actor_role_check
    CHECK (actor_role IN ('content_manager', 'administrator', 'system'));

DROP INDEX IF EXISTS sermons_created_by_subject_idx;
ALTER TABLE sermons
  DROP COLUMN IF EXISTS updated_by_subject,
  DROP COLUMN IF EXISTS created_by_subject;

ALTER TABLE speakers DROP COLUMN IF EXISTS row_version;
ALTER TABLE series DROP COLUMN IF EXISTS row_version;
ALTER TABLE book_classifications DROP COLUMN IF EXISTS row_version;

COMMIT;

BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM cms_entities) OR EXISTS(SELECT 1 FROM cms_revisions) THEN
  RAISE EXCEPTION 'CMS rollback refuses existing content or revisions; use a compatible application rollback and retain content history';
 END IF;
END $$;
DROP TABLE cms_routes;
ALTER TABLE cms_entities DROP CONSTRAINT cms_draft_owned_revision,DROP CONSTRAINT cms_published_owned_revision;
DROP TABLE cms_revisions;
DROP FUNCTION protect_cms_revisions();
DROP TABLE cms_entities;
COMMIT;

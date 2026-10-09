BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM source_public_imports) OR EXISTS (SELECT 1 FROM source_public_versions) THEN
 RAISE EXCEPTION 'Preserve source migration history: use scoped route withdrawal or restore the verified backup';
 END IF;
END $$;
DROP TABLE source_public_routes;
DROP TABLE source_public_imports;
DROP TABLE source_public_versions;
DROP FUNCTION protect_source_public_history();
COMMIT;

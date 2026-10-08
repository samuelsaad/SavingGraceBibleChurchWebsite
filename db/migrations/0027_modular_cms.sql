BEGIN;
CREATE TABLE cms_entities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 key text NOT NULL UNIQUE CHECK(key ~ '^[a-z0-9][a-z0-9:._-]{0,119}$'),
 kind text NOT NULL CHECK(kind IN ('page','home','settings','navigation','event','venue','post')),
 row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
 draft_revision_id uuid NOT NULL,
 published_revision_id uuid,
 seed_key text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cms_singleton_kinds ON cms_entities(kind) WHERE kind IN ('home','settings','navigation');
CREATE TABLE cms_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_id uuid NOT NULL REFERENCES cms_entities(id),
 revision_number integer NOT NULL CHECK(revision_number>0),
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object' AND octet_length(content::text)<=2000000),
 actor text NOT NULL CHECK(length(actor) BETWEEN 1 AND 200),
 source_revision_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(entity_id,revision_number),UNIQUE(entity_id,id),
 FOREIGN KEY(entity_id,source_revision_id) REFERENCES cms_revisions(entity_id,id) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE cms_entities ADD CONSTRAINT cms_draft_owned_revision FOREIGN KEY(id,draft_revision_id) REFERENCES cms_revisions(entity_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE cms_entities ADD CONSTRAINT cms_published_owned_revision FOREIGN KEY(id,published_revision_id) REFERENCES cms_revisions(entity_id,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE cms_routes (
 path text PRIMARY KEY CHECK(path LIKE '/%' AND path NOT LIKE '//%'),
 entity_id uuid NOT NULL REFERENCES cms_entities(id),
 status smallint NOT NULL CHECK(status IN(200,301,410)),
 target_path text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status IN(200,410) AND target_path IS NULL) OR(status=301 AND target_path LIKE '/%' AND target_path NOT LIKE '//%' AND target_path<>path))
);
CREATE UNIQUE INDEX cms_one_canonical_route ON cms_routes(entity_id) WHERE status=200;
CREATE INDEX cms_routes_target_idx ON cms_routes(target_path) WHERE status=301;
CREATE INDEX cms_revisions_history_idx ON cms_revisions(entity_id,revision_number DESC);
CREATE FUNCTION protect_cms_revisions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CMS revisions are immutable; restore creates a new draft revision'; END;
$$;
CREATE TRIGGER cms_revisions_immutable BEFORE UPDATE OR DELETE ON cms_revisions FOR EACH ROW EXECUTE FUNCTION protect_cms_revisions();
COMMENT ON TABLE cms_entities IS 'Versioned church website content only. Never stores or grants sermon publication or review authority.';
COMMENT ON TABLE cms_revisions IS 'Immutable content versions; draft and published pointers are independent. PostgreSQL JSONB contains validated structured modules with stable IDs, order and visibility.';
COMMIT;

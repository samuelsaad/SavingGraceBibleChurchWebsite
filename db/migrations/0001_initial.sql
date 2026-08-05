BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_provider text NOT NULL,
  storage_key text NOT NULL,
  original_filename text,
  content_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  width_pixels integer CHECK (width_pixels IS NULL OR width_pixels > 0),
  height_pixels integer CHECK (height_pixels IS NULL OR height_pixels > 0),
  checksum_sha256 text CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  alt_text text,
  source_url text,
  source_attachment_id bigint,
  availability_status text NOT NULL DEFAULT 'unknown'
    CHECK (availability_status IN ('unknown', 'available', 'missing', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_provider, storage_key)
);

CREATE TABLE sermons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 240),
  slug text NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 200),
  summary text,
  body text,
  status text NOT NULL CHECK (status IN ('draft', 'pending', 'scheduled', 'published', 'unpublished', 'archived')),
  service_date date NOT NULL,
  published_at timestamptz,
  scheduled_for timestamptz,
  featured_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  source_wordpress_id bigint UNIQUE,
  source_status text,
  source_created_local timestamp without time zone,
  source_created_gmt timestamptz,
  source_modified_local timestamp without time zone,
  source_modified_gmt timestamptz,
  search_terms text NOT NULL DEFAULT '',
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(search_terms, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(summary, '')), 'C') ||
    setweight(to_tsvector('english'::regconfig, coalesce(body, '')), 'D')
  ) STORED,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (status <> 'scheduled' OR scheduled_for IS NOT NULL),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX sermons_active_slug_lower_uq
  ON sermons (lower(slug))
  WHERE deleted_at IS NULL;
CREATE INDEX sermons_public_date_idx
  ON sermons (service_date DESC, id)
  WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX sermons_search_vector_idx ON sermons USING gin (search_vector);
CREATE INDEX sermons_status_idx ON sermons (status, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE sermon_legacy_metrics (
  sermon_id uuid PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  source_view_count bigint NOT NULL CHECK (source_view_count >= 0),
  source_meta_key text NOT NULL DEFAULT 'post_views_count'
    CHECK (source_meta_key = 'post_views_count'),
  captured_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE sermon_legacy_metrics IS
  'Private migration audit only. Never expose legacy counters through public API responses.';

CREATE TABLE speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  slug text NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 200),
  biography text,
  image_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  source_term_id bigint,
  source_term_taxonomy_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_term_taxonomy_id)
);
CREATE UNIQUE INDEX speakers_slug_lower_uq ON speakers (lower(slug));

CREATE TABLE series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 240),
  slug text NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 200),
  description text,
  image_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  source_term_id bigint,
  source_term_taxonomy_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_term_taxonomy_id)
);
CREATE UNIQUE INDEX series_slug_lower_uq ON series (lower(slug));

CREATE TABLE bible_books (
  id smallint PRIMARY KEY,
  canonical_name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  testament text NOT NULL CHECK (testament IN ('old', 'new')),
  canonical_order smallint NOT NULL UNIQUE CHECK (canonical_order BETWEEN 1 AND 66)
);

CREATE TABLE book_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  slug text NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 200),
  canonical_book_id smallint REFERENCES bible_books(id) ON DELETE SET NULL,
  classification_type text NOT NULL DEFAULT 'source'
    CHECK (classification_type IN ('canonical', 'source', 'selected_text', 'unresolved')),
  review_status text NOT NULL DEFAULT 'unreviewed'
    CHECK (review_status IN ('unreviewed', 'approved', 'rejected')),
  source_term_id bigint,
  source_term_taxonomy_id bigint UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX book_classifications_slug_lower_uq ON book_classifications (lower(slug));

CREATE TABLE source_taxonomy_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  taxonomy text NOT NULL,
  source_term_id bigint NOT NULL,
  source_term_taxonomy_id bigint NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL DEFAULT '',
  source_parent_id bigint,
  source_order integer,
  source_stored_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, taxonomy, source_term_taxonomy_id)
);

CREATE TABLE sermon_speakers (
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES speakers(id) ON DELETE RESTRICT,
  role text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sermon_id, speaker_id)
);
CREATE INDEX sermon_speakers_filter_idx ON sermon_speakers (speaker_id, sermon_id);

CREATE TABLE sermon_series_map (
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE RESTRICT,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sermon_id, series_id)
);
CREATE INDEX sermon_series_filter_idx ON sermon_series_map (series_id, sermon_id);

CREATE TABLE sermon_book_classifications (
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  book_classification_id uuid NOT NULL REFERENCES book_classifications(id) ON DELETE RESTRICT,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sermon_id, book_classification_id)
);
CREATE INDEX sermon_book_filter_idx
  ON sermon_book_classifications (book_classification_id, sermon_id);

CREATE TABLE sermon_source_terms (
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  source_taxonomy_term_id uuid NOT NULL REFERENCES source_taxonomy_terms(id) ON DELETE RESTRICT,
  source_relationship_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sermon_id, source_taxonomy_term_id)
);
CREATE INDEX sermon_source_terms_filter_idx
  ON sermon_source_terms (source_taxonomy_term_id, sermon_id);

CREATE TABLE scripture_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  display_text text NOT NULL CHECK (char_length(trim(display_text)) > 0),
  canonical_book_id smallint REFERENCES bible_books(id) ON DELETE SET NULL,
  start_chapter integer CHECK (start_chapter IS NULL OR start_chapter > 0),
  start_verse integer CHECK (start_verse IS NULL OR start_verse > 0),
  end_chapter integer CHECK (end_chapter IS NULL OR end_chapter > 0),
  end_verse integer CHECK (end_verse IS NULL OR end_verse > 0),
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  parse_status text NOT NULL DEFAULT 'unparsed'
    CHECK (parse_status IN ('unparsed', 'exact', 'partial', 'unresolved', 'curated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sermon_id, display_order)
);
CREATE INDEX scripture_references_sermon_idx ON scripture_references (sermon_id, display_order);

CREATE TABLE scripture_reference_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scripture_reference_id uuid NOT NULL REFERENCES scripture_references(id) ON DELETE CASCADE,
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('postmeta', 'taxonomy', 'curated')),
  source_meta_key text,
  source_postmeta_id bigint,
  source_term_id bigint,
  source_term_taxonomy_id bigint,
  original_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    source_kind = 'curated' OR
    (source_kind = 'postmeta' AND source_meta_key IS NOT NULL) OR
    (source_kind = 'taxonomy' AND source_term_taxonomy_id IS NOT NULL)
  )
);
CREATE INDEX scripture_sources_sermon_idx ON scripture_reference_sources (sermon_id, source_kind);

CREATE TABLE sermon_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('video', 'audio')),
  provider text NOT NULL
    CHECK (provider IN ('youtube', 'sermonaudio', 'vimeo', 'facebook', 'soundcloud', 'hosted', 'approved_embed')),
  external_id text,
  source_url text,
  canonical_url text,
  embed_configuration jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(embed_configuration) = 'object'),
  title text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  thumbnail_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  is_primary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  availability_status text NOT NULL DEFAULT 'unknown'
    CHECK (availability_status IN ('unknown', 'available', 'unavailable', 'invalid', 'review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sermon_id, display_order),
  CHECK (external_id IS NOT NULL OR canonical_url IS NOT NULL)
);
CREATE INDEX sermon_media_sermon_idx ON sermon_media (sermon_id, display_order);
CREATE INDEX sermon_media_provider_idx ON sermon_media (provider, external_id);

CREATE TABLE sermon_media_source_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_media_id uuid NOT NULL REFERENCES sermon_media(id) ON DELETE CASCADE,
  source_meta_key text NOT NULL,
  original_value text NOT NULL,
  source_value_sha256 text NOT NULL CHECK (source_value_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE sermon_media_source_audit IS
  'Private migration provenance. Never expose original_value through application API responses.';

CREATE TABLE sermon_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  resource_type text NOT NULL
    CHECK (resource_type IN ('notes', 'bulletin', 'study_guide', 'transcript', 'other')),
  label text NOT NULL,
  asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  external_url text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((asset_id IS NOT NULL)::integer + (external_url IS NOT NULL)::integer = 1),
  UNIQUE (sermon_id, display_order)
);

CREATE TABLE sermon_extensions (
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  namespace text NOT NULL CHECK (namespace ~ '^[a-z][a-z0-9_.-]{1,63}$'),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sermon_id, namespace)
);
COMMENT ON TABLE sermon_extensions IS
  'Versioned, application-allowlisted extensions only; not a WordPress-style arbitrary metadata store.';

CREATE TABLE migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_version text NOT NULL,
  source_snapshot_id text NOT NULL,
  dry_run boolean NOT NULL DEFAULT true,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(summary) = 'object')
);

CREATE TABLE migration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_run_id uuid NOT NULL REFERENCES migration_runs(id) ON DELETE CASCADE,
  source_system text NOT NULL,
  source_entity_type text NOT NULL,
  source_id text NOT NULL,
  source_status text,
  source_url text,
  source_checksum_sha256 text CHECK (
    source_checksum_sha256 IS NULL OR source_checksum_sha256 ~ '^[a-f0-9]{64}$'
  ),
  target_entity_type text,
  target_id uuid,
  outcome text NOT NULL CHECK (outcome IN ('included', 'excluded', 'rejected')),
  reason_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (migration_run_id, source_system, source_entity_type, source_id)
);
CREATE INDEX migration_records_source_idx
  ON migration_records (source_system, source_entity_type, source_id);

CREATE TABLE migration_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_record_id uuid NOT NULL REFERENCES migration_records(id) ON DELETE CASCADE,
  code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  field_name text,
  safe_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX migration_warnings_record_idx ON migration_warnings (migration_record_id, severity);

CREATE TABLE redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_path text NOT NULL,
  new_path text NOT NULL,
  status_code smallint NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  reason text NOT NULL,
  migration_record_id uuid REFERENCES migration_records(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (old_path LIKE '/%' AND new_path LIKE '/%' AND old_path <> new_path),
  UNIQUE (old_path)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_subject text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('content_manager', 'administrator', 'system')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(changed_fields) = 'array'),
  request_correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id, created_at DESC);

COMMIT;

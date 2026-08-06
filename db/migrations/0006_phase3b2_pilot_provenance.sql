BEGIN;

CREATE TABLE sermon_enrichment_sources (
  sermon_id uuid PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'youtube'),
  video_id text NOT NULL UNIQUE CHECK (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  canonical_url text NOT NULL CHECK (
    canonical_url = 'https://www.youtube.com/watch?v=' || video_id
  ),
  caption_language text NOT NULL CHECK (
    caption_language ~ '^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$'
  ),
  caption_track_type text NOT NULL
    CHECK (caption_track_type IN ('manual', 'automatic', 'unknown')),
  original_filename text NOT NULL CHECK (
    char_length(original_filename) BETWEEN 1 AND 255
    AND original_filename !~ '[\\/]'
  ),
  source_content_sha256 text NOT NULL
    CHECK (source_content_sha256 ~ '^[0-9a-f]{64}$'),
  retrieval_attribution text NOT NULL
    CHECK (retrieval_attribution = 'authorised_youtube_studio_export'),
  source_character_count integer NOT NULL CHECK (source_character_count > 0),
  cleaned_character_count integer NOT NULL CHECK (cleaned_character_count > 0),
  apparent_completeness text NOT NULL
    CHECK (apparent_completeness IN ('apparently_complete', 'requires_manual_review')),
  uncertainty_marker_count integer NOT NULL CHECK (uncertainty_marker_count >= 0),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(warnings) = 'array'),
  unresolved_passages jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(unresolved_passages) = 'array'),
  processing_version text NOT NULL CHECK (char_length(processing_version) BETWEEN 1 AND 100),
  imported_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL,
  processing_duration_ms integer NOT NULL CHECK (processing_duration_ms >= 0),
  estimated_review_minutes integer NOT NULL CHECK (estimated_review_minutes > 0),
  manual_attention_required boolean NOT NULL DEFAULT true,
  accuracy_review_status text NOT NULL DEFAULT 'required'
    CHECK (accuracy_review_status = 'required'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sermon_enrichment_sources IS
  'Private Phase 3B.2 caption provenance and safe warnings. Never expose through public APIs.';

CREATE INDEX sermon_enrichment_sources_review_idx
  ON sermon_enrichment_sources (manual_attention_required, processed_at DESC);

COMMIT;

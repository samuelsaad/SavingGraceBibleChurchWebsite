BEGIN;

DROP VIEW IF EXISTS sermon_content_readiness;
DROP TRIGGER IF EXISTS sermon_question_answers_refresh_enrichment ON sermon_question_answers;
DROP TRIGGER IF EXISTS sermon_transcripts_refresh_enrichment ON sermon_transcripts;
DROP FUNCTION IF EXISTS refresh_sermon_enrichment_from_child();
DROP FUNCTION IF EXISTS refresh_sermon_enrichment(uuid);
DROP TABLE IF EXISTS sermon_enrichment_draft_imports;

DROP INDEX sermons_search_vector_idx;
ALTER TABLE sermons DROP COLUMN search_vector;
ALTER TABLE sermons ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce(search_terms, '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(summary, '')), 'C') ||
  setweight(to_tsvector('english'::regconfig, coalesce(body, '')), 'D')
) STORED;
CREATE INDEX sermons_search_vector_idx ON sermons USING gin (search_vector);

DROP TABLE IF EXISTS sermon_question_answers;
DROP TABLE IF EXISTS sermon_transcripts;

CREATE TABLE sermon_speakers (
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES speakers(id) ON DELETE RESTRICT,
  role text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sermon_id, speaker_id)
);

INSERT INTO sermon_speakers (sermon_id, speaker_id, display_order, is_primary)
SELECT id, speaker_id, 0, true
FROM sermons
WHERE speaker_id IS NOT NULL;

CREATE INDEX sermon_speakers_filter_idx ON sermon_speakers (speaker_id, sermon_id);

DROP INDEX IF EXISTS sermons_speaker_filter_idx;
ALTER TABLE sermons
  DROP CONSTRAINT IF EXISTS sermons_speaker_id_fkey,
  DROP COLUMN speaker_id,
  DROP COLUMN historical_backfill_required,
  DROP COLUMN transcript_search_document,
  DROP COLUMN question_answer_search_document;

COMMIT;

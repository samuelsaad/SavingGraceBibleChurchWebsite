BEGIN;

ALTER TABLE sermon_transcripts
  ADD COLUMN grounding_revision_id uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX sermon_transcripts_grounding_revision_uq
  ON sermon_transcripts (sermon_id, grounding_revision_id);

CREATE TABLE sermon_transcript_legacy_grounding_bindings (
  sermon_id uuid NOT NULL REFERENCES sermon_transcripts(sermon_id) ON DELETE CASCADE,
  transcript_row_version integer NOT NULL CHECK (transcript_row_version > 0),
  transcript_sha256 text NOT NULL CHECK (transcript_sha256 ~ '^[a-f0-9]{64}$'),
  grounding_revision_id uuid NOT NULL,
  source_identity_sha256 text NOT NULL CHECK (source_identity_sha256 ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sermon_id, transcript_row_version, transcript_sha256),
  FOREIGN KEY (sermon_id, grounding_revision_id)
    REFERENCES sermon_transcripts(sermon_id, grounding_revision_id) ON DELETE CASCADE
);

COMMENT ON TABLE sermon_transcript_legacy_grounding_bindings IS
  'Compatibility evidence for legacy grounded references. Approval metadata and mutable row versions do not define transcript identity.';

WITH grounded_references AS (
  SELECT s.id AS sermon_id, s.summary_source_reference AS source_reference
  FROM sermons s
  JOIN sermon_enrichment_sources source ON source.sermon_id = s.id
  WHERE s.summary_source_reference LIKE 'sermon-enrichment:v1:%'
  UNION
  SELECT qa.sermon_id, qa.source_reference
  FROM sermon_question_answers qa
  JOIN sermon_enrichment_sources source ON source.sermon_id = qa.sermon_id
  WHERE qa.source_reference LIKE 'sermon-enrichment:v1:%'
), parsed AS (
  SELECT reference.sermon_id,
         (parts)[1] AS transcript_sha256,
         (parts)[2]::integer AS transcript_row_version
  FROM grounded_references reference
  CROSS JOIN LATERAL regexp_match(
    reference.source_reference,
    '^sermon-enrichment:v1:([a-f0-9]{64}):([1-9][0-9]*):[a-f0-9]{64}$'
  ) parts
)
INSERT INTO sermon_transcript_legacy_grounding_bindings (
  sermon_id, transcript_row_version, transcript_sha256,
  grounding_revision_id, source_identity_sha256
)
SELECT DISTINCT transcript.sermon_id, parsed.transcript_row_version,
       parsed.transcript_sha256, transcript.grounding_revision_id,
       encode(digest(convert_to(
         transcript.sermon_id::text || E'\n' || transcript.source_kind || E'\n' ||
         COALESCE(transcript.source_reference, ''), 'UTF8'
       ), 'sha256'), 'hex')
FROM parsed
JOIN sermon_transcripts transcript ON transcript.sermon_id = parsed.sermon_id
WHERE parsed.transcript_sha256 =
  encode(digest(convert_to(transcript.body_text, 'UTF8'), 'sha256'), 'hex')
ON CONFLICT DO NOTHING;

CREATE FUNCTION rotate_sermon_transcript_grounding_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.body_text IS DISTINCT FROM OLD.body_text
     OR NEW.source_kind IS DISTINCT FROM OLD.source_kind
     OR NEW.source_reference IS DISTINCT FROM OLD.source_reference THEN
    NEW.grounding_revision_id = gen_random_uuid();
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER sermon_transcripts_rotate_grounding_revision
BEFORE UPDATE OF body_text, source_kind, source_reference ON sermon_transcripts
FOR EACH ROW EXECUTE FUNCTION rotate_sermon_transcript_grounding_revision();

ALTER TABLE scripture_references
  DROP CONSTRAINT scripture_references_primary_structure_check;

ALTER TABLE scripture_references
  ADD CONSTRAINT scripture_references_primary_structure_check CHECK (
    relationship_role <> 'primary' OR canonical_book_id IS NOT NULL
  ),
  ADD CONSTRAINT scripture_references_structured_parentage_check CHECK (
    (start_chapter IS NULL) = (end_chapter IS NULL)
    AND (start_verse IS NULL OR start_chapter IS NOT NULL)
    AND (end_verse IS NULL OR (start_verse IS NOT NULL AND end_chapter IS NOT NULL))
  );

CREATE OR REPLACE FUNCTION enforce_primary_passage_review_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_sermon_id uuid;
  decision_status text;
  confirmed_primary_count integer;
  confirmed_lead_count integer;
BEGIN
  target_sermon_id := COALESCE(NEW.sermon_id, OLD.sermon_id);
  SELECT review_status INTO decision_status
  FROM sermon_primary_passage_reviews
  WHERE sermon_id = target_sermon_id;
  SELECT
    count(*) FILTER (WHERE relationship_role = 'primary' AND review_status = 'confirmed'),
    count(*) FILTER (WHERE relationship_role = 'primary' AND review_status = 'confirmed' AND is_lead)
  INTO confirmed_primary_count, confirmed_lead_count
  FROM scripture_references
  WHERE sermon_id = target_sermon_id;
  IF confirmed_primary_count > 0 AND decision_status IS DISTINCT FROM 'confirmed_passage' THEN
    RAISE EXCEPTION 'confirmed_primary_passage_requires_explicit_review_decision';
  END IF;
  IF decision_status = 'confirmed_passage' AND
     (confirmed_primary_count < 1 OR confirmed_lead_count <> 1) THEN
    RAISE EXCEPTION 'confirmed_passage_decision_requires_exactly_one_lead_primary';
  END IF;
  IF decision_status = 'confirmed_none' AND confirmed_primary_count <> 0 THEN
    RAISE EXCEPTION 'confirmed_no_primary_passage_cannot_have_confirmed_coordinates';
  END IF;
  RETURN NULL;
END
$$;

DROP VIEW sermon_content_readiness;

CREATE OR REPLACE FUNCTION refresh_sermon_enrichment(target_sermon_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE sermons s
  SET summary_search_document = CASE
        WHEN s.summary_status = 'approved' THEN COALESCE(s.summary, '')
        ELSE ''
      END,
      transcript_search_document = COALESCE((
        SELECT transcript.body_text
        FROM sermon_transcripts transcript
        WHERE transcript.sermon_id = s.id AND transcript.status = 'approved'
      ), ''),
      question_answer_search_document = COALESCE((
        SELECT string_agg(qa.question_text || ' ' || qa.answer_text, ' ' ORDER BY qa.display_order)
        FROM sermon_question_answers qa
        WHERE qa.sermon_id = s.id AND qa.status = 'approved'
      ), ''),
      historical_backfill_required = s.source_wordpress_id IS NOT NULL AND NOT (
        s.speaker_id IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM sermon_primary_passage_reviews review
            WHERE review.sermon_id = s.id AND review.review_status = 'confirmed_none'
          )
          OR EXISTS (
            SELECT 1
            FROM sermon_primary_passage_reviews review
            JOIN scripture_references passage ON passage.sermon_id = review.sermon_id
            WHERE review.sermon_id = s.id
              AND review.review_status = 'confirmed_passage'
              AND passage.relationship_role = 'primary'
              AND passage.review_status = 'confirmed'
              AND passage.is_lead
              AND passage.canonical_book_id IS NOT NULL
          )
        )
        AND s.summary_status = 'approved'
        AND char_length(trim(s.summary)) BETWEEN 80 AND 2000
        AND EXISTS (
          SELECT 1 FROM sermon_transcripts transcript
          WHERE transcript.sermon_id = s.id
            AND transcript.status = 'approved'
            AND char_length(trim(transcript.body_text)) > 0
        )
        AND (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) BETWEEN 5 AND 10
        AND NOT EXISTS (
          SELECT 1 FROM sermon_question_answers qa
          WHERE qa.sermon_id = s.id AND qa.status <> 'approved'
        )
        AND EXISTS (
          SELECT 1 FROM sermon_media media
          WHERE media.sermon_id = s.id
            AND media.provider IN ('youtube', 'sermonaudio')
            AND media.canonical_url IS NOT NULL
            AND char_length(trim(media.title)) > 0
        )
        AND NOT EXISTS (
          SELECT 1 FROM sermon_media media
          WHERE media.sermon_id = s.id
            AND (
              media.provider NOT IN ('youtube', 'sermonaudio')
              OR media.canonical_url IS NULL
              OR media.title IS NULL
              OR char_length(trim(media.title)) = 0
            )
        )
      )
  WHERE s.id = target_sermon_id;
$$;

CREATE VIEW sermon_content_readiness AS
SELECT
  s.id AS sermon_id,
  s.source_wordpress_id,
  (s.speaker_id IS NOT NULL) AS has_one_speaker,
  EXISTS (
    SELECT 1 FROM sermon_book_classifications classification
    JOIN book_classifications book ON book.id = classification.book_classification_id
    WHERE classification.sermon_id = s.id
      AND book.canonical_book_id IS NOT NULL
  ) AS has_required_bible_book,
  (
    EXISTS (
      SELECT 1 FROM sermon_primary_passage_reviews review
      WHERE review.sermon_id = s.id AND review.review_status = 'confirmed_none'
    )
    OR EXISTS (
      SELECT 1
      FROM sermon_primary_passage_reviews review
      JOIN scripture_references passage ON passage.sermon_id = review.sermon_id
      WHERE review.sermon_id = s.id
        AND review.review_status = 'confirmed_passage'
        AND passage.relationship_role = 'primary'
        AND passage.review_status = 'confirmed'
        AND passage.is_lead
        AND passage.canonical_book_id IS NOT NULL
    )
  ) AS has_required_passage_decision,
  (
    s.summary_status = 'approved'
    AND char_length(trim(s.summary)) BETWEEN 80 AND 2000
  ) AS has_approved_description,
  EXISTS (
    SELECT 1 FROM sermon_transcripts transcript
    WHERE transcript.sermon_id = s.id
      AND transcript.status = 'approved'
      AND char_length(trim(transcript.body_text)) > 0
  ) AS has_approved_transcript,
  (SELECT count(*)::integer FROM sermon_question_answers qa
   WHERE qa.sermon_id = s.id AND qa.status = 'approved') AS approved_question_count,
  (SELECT count(*)::integer FROM sermon_question_answers qa
   WHERE qa.sermon_id = s.id) AS total_question_count,
  (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) > 0
  AND NOT EXISTS (
    SELECT 1 FROM sermon_question_answers qa
    WHERE qa.sermon_id = s.id AND qa.status <> 'approved'
  ) AS all_questions_approved,
  EXISTS (
    SELECT 1 FROM sermon_media media
    WHERE media.sermon_id = s.id
      AND media.provider IN ('youtube', 'sermonaudio')
      AND media.canonical_url IS NOT NULL
      AND char_length(trim(media.title)) > 0
  ) AND NOT EXISTS (
    SELECT 1 FROM sermon_media media
    WHERE media.sermon_id = s.id
      AND (
        media.provider NOT IN ('youtube', 'sermonaudio')
        OR media.canonical_url IS NULL
        OR media.title IS NULL
        OR char_length(trim(media.title)) = 0
      )
  ) AS has_valid_controlled_media,
  (
    s.speaker_id IS NOT NULL
    AND s.summary_status = 'approved'
    AND char_length(trim(s.summary)) BETWEEN 80 AND 2000
    AND EXISTS (
      SELECT 1 FROM sermon_transcripts transcript
      WHERE transcript.sermon_id = s.id
        AND transcript.status = 'approved'
        AND char_length(trim(transcript.body_text)) > 0
    )
    AND (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) BETWEEN 5 AND 10
    AND NOT EXISTS (
      SELECT 1 FROM sermon_question_answers qa
      WHERE qa.sermon_id = s.id AND qa.status <> 'approved'
    )
    AND EXISTS (
      SELECT 1 FROM sermon_media media
      WHERE media.sermon_id = s.id
        AND media.provider IN ('youtube', 'sermonaudio')
        AND media.canonical_url IS NOT NULL
        AND char_length(trim(media.title)) > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM sermon_media media
      WHERE media.sermon_id = s.id
        AND (
          media.provider NOT IN ('youtube', 'sermonaudio')
          OR media.canonical_url IS NULL
          OR media.title IS NULL
          OR char_length(trim(media.title)) = 0
        )
    )
  ) AS is_content_complete,
  (
    s.speaker_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM sermon_primary_passage_reviews review
        WHERE review.sermon_id = s.id AND review.review_status = 'confirmed_none'
      )
      OR EXISTS (
        SELECT 1
        FROM sermon_primary_passage_reviews review
        JOIN scripture_references passage ON passage.sermon_id = review.sermon_id
        WHERE review.sermon_id = s.id
          AND review.review_status = 'confirmed_passage'
          AND passage.relationship_role = 'primary'
          AND passage.review_status = 'confirmed'
          AND passage.is_lead
          AND passage.canonical_book_id IS NOT NULL
      )
    )
    AND s.summary_status = 'approved'
    AND char_length(trim(s.summary)) BETWEEN 80 AND 2000
    AND EXISTS (
      SELECT 1 FROM sermon_transcripts transcript
      WHERE transcript.sermon_id = s.id
        AND transcript.status = 'approved'
        AND char_length(trim(transcript.body_text)) > 0
    )
    AND (SELECT count(*) FROM sermon_question_answers qa WHERE qa.sermon_id = s.id) BETWEEN 5 AND 10
    AND NOT EXISTS (
      SELECT 1 FROM sermon_question_answers qa
      WHERE qa.sermon_id = s.id AND qa.status <> 'approved'
    )
    AND EXISTS (
      SELECT 1 FROM sermon_media media
      WHERE media.sermon_id = s.id
        AND media.provider IN ('youtube', 'sermonaudio')
        AND media.canonical_url IS NOT NULL
        AND char_length(trim(media.title)) > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM sermon_media media
      WHERE media.sermon_id = s.id
        AND (
          media.provider NOT IN ('youtube', 'sermonaudio')
          OR media.canonical_url IS NULL
          OR media.title IS NULL
          OR char_length(trim(media.title)) = 0
        )
    )
  ) AS is_complete
FROM sermons s
WHERE s.deleted_at IS NULL;

SELECT refresh_sermon_enrichment(id) FROM sermons WHERE deleted_at IS NULL;

COMMENT ON VIEW sermon_content_readiness IS
  'Separates editorial content completeness from the required reviewed primary-passage decision; an explicit confirmed-none decision is complete.';

COMMIT;

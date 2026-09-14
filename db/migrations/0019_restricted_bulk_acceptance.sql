BEGIN;

-- New bulk authority; original human/AI lifecycle records remain untouched.
CREATE TABLE sermon_restricted_acceptances (
  sermon_id uuid PRIMARY KEY REFERENCES sermons(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision = 'D-158'),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  content_dependency_sha256 text NOT NULL CHECK (content_dependency_sha256 ~ '^[a-f0-9]{64}$'),
  fingerprint_format text NOT NULL CHECK (fingerprint_format = 'd158-utc-jsonb-v1'),
  previous_row_version integer NOT NULL CHECK (previous_row_version > 0),
  published_row_version integer NOT NULL CHECK (published_row_version = previous_row_version + 1),
  authorized_by text NOT NULL CHECK (authorized_by = 'samuel-saad-bulk-authorization'),
  executed_by text NOT NULL CHECK (executed_by = 'codex-d158-restricted-acceptance'),
  manual_review_claimed boolean NOT NULL CHECK (manual_review_claimed = false),
  passage_basis text NOT NULL CHECK (passage_basis IN ('primary_passage','no_single_primary')),
  environment text NOT NULL CHECK (environment IN ('local_loopback','sealed_staging')),
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sermon_restricted_acceptance_withdrawals (
  sermon_id uuid PRIMARY KEY REFERENCES sermon_restricted_acceptances(sermon_id) ON DELETE CASCADE,
  authorization_reference text NOT NULL CHECK (char_length(authorization_reference) BETWEEN 8 AND 200),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  executed_by text NOT NULL CHECK (executed_by = 'codex-d158-restricted-acceptance'),
  withdrawn_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION protect_restricted_acceptance_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1
    AND COALESCE(current_setting('savinggrace.application_request', true),'') = 'on'
    AND NOT EXISTS (SELECT 1 FROM sermons WHERE id=OLD.sermon_id)
    AND EXISTS (SELECT 1 FROM sermon_deletion_tombstones WHERE former_sermon_id=OLD.sermon_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'restricted_acceptance_history_is_immutable';
END
$$;
CREATE TRIGGER sermon_restricted_acceptances_immutable BEFORE UPDATE OR DELETE ON sermon_restricted_acceptances
  FOR EACH ROW EXECUTE FUNCTION protect_restricted_acceptance_history();
CREATE TRIGGER sermon_restricted_acceptance_withdrawals_immutable BEFORE UPDATE OR DELETE ON sermon_restricted_acceptance_withdrawals
  FOR EACH ROW EXECUTE FUNCTION protect_restricted_acceptance_history();

-- Versioned new hash format, explicitly UTC irrespective of session defaults.
-- Publication fields/version are checked separately. Only navigation, not review
-- decisions, is omitted from workflow dependencies.
CREATE FUNCTION restricted_acceptance_dependency(target uuid) RETURNS text
LANGUAGE sql STABLE SET timezone='UTC' SET datestyle='ISO, YMD' AS $$
  SELECT encode(digest(jsonb_build_object(
    'format','d158-utc-jsonb-v1',
    'sermon',to_jsonb(s)-ARRAY['status','published_at','row_version','updated_at','updated_by_subject'],
    'speaker',(SELECT to_jsonb(sp) FROM speakers sp WHERE sp.id=s.speaker_id),
    'transcript',(SELECT to_jsonb(t) FROM sermon_transcripts t WHERE t.sermon_id=s.id),
    'source',(SELECT to_jsonb(e) FROM sermon_enrichment_sources e WHERE e.sermon_id=s.id),
    'workflow',(SELECT to_jsonb(w)-ARRAY['current_stage','row_version','updated_at','updated_by_subject'] FROM sermon_enrichment_reviews w WHERE w.sermon_id=s.id),
    'questions',(SELECT jsonb_agg(to_jsonb(q) ORDER BY q.display_order,q.id) FROM sermon_question_answers q WHERE q.sermon_id=s.id),
    'findings',(SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM sermon_enrichment_review_items f WHERE f.sermon_id=s.id),
    'passage_review',(SELECT to_jsonb(p) FROM sermon_primary_passage_reviews p WHERE p.sermon_id=s.id),
    'passages',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM scripture_references p WHERE p.sermon_id=s.id),
    'media',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM sermon_media m WHERE m.sermon_id=s.id),
    'series',(SELECT jsonb_agg(jsonb_build_object('map',to_jsonb(m),'series',to_jsonb(sr)) ORDER BY m.series_id) FROM sermon_series_map m JOIN series sr ON sr.id=m.series_id WHERE m.sermon_id=s.id),
    'books',(SELECT jsonb_agg(jsonb_build_object('map',to_jsonb(m),'book',to_jsonb(b)) ORDER BY m.book_classification_id) FROM sermon_book_classifications m JOIN book_classifications b ON b.id=m.book_classification_id WHERE m.sermon_id=s.id),
    'terms',(SELECT jsonb_agg(jsonb_build_object('map',to_jsonb(m),'term',to_jsonb(t)) ORDER BY m.source_taxonomy_term_id) FROM sermon_source_terms m JOIN source_taxonomy_terms t ON t.id=m.source_taxonomy_term_id WHERE m.sermon_id=s.id),
    'd156',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM sermon_ai_content_reviews r WHERE r.sermon_id=s.id),
    'd157',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM sermon_ai_component_reviews r WHERE r.sermon_id=s.id),
    'd156_scope',(SELECT to_jsonb(sc) FROM delegated_ai_review_scopes sc WHERE sc.id='D-156'),
    'd157_scope',(SELECT to_jsonb(sc) FROM remaining_ai_review_scopes sc WHERE sc.id='D-157')
  )::text,'sha256'),'hex') FROM sermons s WHERE s.id=target;
$$;
COMMENT ON TABLE sermon_restricted_acceptances IS 'D-158 restricted-environment bulk acceptance; not individual human review or internet-publication authority.';
COMMIT;

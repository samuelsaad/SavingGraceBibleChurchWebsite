import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";
import { bibleBookBySlug } from "../../domain/bible-passage";
import { previewDatasetSourceStatus } from "../../development-data/preview-sermon-dataset";

export interface ParameterizedQuery {
  text: string;
  values: Array<string | number>;
}

interface PublishedConditions {
  conditions: string[];
  values: Array<string | number>;
  searchExpression: string | null;
}

export type FrontendSermonScope = "public" | "completed_preview";

const previewProcessingVersions = [
  "phase3b2-caption-v1",
  "phase3b2b-punctuation-v2",
  "phase3b2c-wave1-extractive-drafts-v2"
] as const;

function groundedReferenceIsCurrentSql(
  sermonAlias: string,
  transcriptAlias: string,
  sourceKindSql: string,
  sourceReferenceSql: string
): string {
  const transcriptHash = `encode(digest(convert_to(${transcriptAlias}.body_text, 'UTF8'), 'sha256'), 'hex')`;
  return `(
    ${sourceKindSql} IS DISTINCT FROM 'generated_draft'
    OR ${sourceReferenceSql} !~ '^sermon-enrichment:v[12]:'
    OR ${sourceReferenceSql} ~ ('^sermon-enrichment:v2:' || ${transcriptAlias}.grounding_revision_id::text || ':' || ${transcriptHash} || ':[a-f0-9]{64}$')
    OR (
      ${sourceReferenceSql} ~ '^sermon-enrichment:v1:[a-f0-9]{64}:[1-9][0-9]*:[a-f0-9]{64}$'
      AND EXISTS (
        SELECT 1
        FROM sermon_transcript_legacy_grounding_bindings grounding_binding
        WHERE grounding_binding.sermon_id = ${sermonAlias}.id
          AND grounding_binding.transcript_sha256 = ${transcriptHash}
          AND grounding_binding.grounding_revision_id = ${transcriptAlias}.grounding_revision_id
          AND grounding_binding.transcript_row_version = split_part(${sourceReferenceSql}, ':', 4)::integer
          AND split_part(${sourceReferenceSql}, ':', 3) = grounding_binding.transcript_sha256
      )
    )
  )`;
}

export function frontendSermonEligibilitySql(
  sermonAlias: string,
  scope: FrontendSermonScope
): string {
  const transcriptAlias = `${sermonAlias}_eligible_transcript`;
  const summaryCurrent = groundedReferenceIsCurrentSql(
    sermonAlias,
    transcriptAlias,
    `${sermonAlias}.summary_source_kind`,
    `${sermonAlias}.summary_source_reference`
  );
  const qaCurrent = groundedReferenceIsCurrentSql(
    sermonAlias,
    transcriptAlias,
    `${sermonAlias}_eligible_qa.source_kind`,
    `${sermonAlias}_eligible_qa.source_reference`
  );
  const lifecycle = scope === "public"
    ? `${sermonAlias}.status = 'published'`
    : `${sermonAlias}.status = 'draft'
      AND ${sermonAlias}.published_at IS NULL
      AND (
        ${sermonAlias}.source_status = '${previewDatasetSourceStatus}'
        OR (
          EXISTS (
            SELECT 1
            FROM sermon_enrichment_reviews preview_review
            WHERE preview_review.sermon_id = ${sermonAlias}.id
              AND preview_review.current_stage = 6
              AND preview_review.completed_at IS NOT NULL
          )
          AND EXISTS (
            SELECT 1
            FROM sermon_enrichment_sources preview_source
            WHERE preview_source.sermon_id = ${sermonAlias}.id
              AND preview_source.processing_version IN (${previewProcessingVersions.map((value) => `'${value}'`).join(", ")})
          )
        )
      )`;

  return `(
    ${sermonAlias}.deleted_at IS NULL
    AND ${lifecycle}
    AND EXISTS (
      SELECT 1 FROM sermon_content_readiness frontend_readiness
      WHERE frontend_readiness.sermon_id = ${sermonAlias}.id
        AND frontend_readiness.is_complete
        AND frontend_readiness.has_required_passage_decision
    )
    AND ${sermonAlias}.summary_status = 'approved'
    AND ${sermonAlias}.summary IS NOT NULL
    AND (
      ${sermonAlias}.summary_source_reference IS NULL
      OR ${sermonAlias}.summary_source_reference NOT LIKE '%:phase3b2c-wave1-extractive-drafts-v2'
    )
    AND EXISTS (
      SELECT 1
      FROM sermon_transcripts ${transcriptAlias}
      WHERE ${transcriptAlias}.sermon_id = ${sermonAlias}.id
        AND ${transcriptAlias}.status = 'approved'
        AND char_length(trim(${transcriptAlias}.body_text)) > 0
        AND ${summaryCurrent}
        AND NOT EXISTS (
          SELECT 1
          FROM sermon_question_answers ${sermonAlias}_eligible_qa
          WHERE ${sermonAlias}_eligible_qa.sermon_id = ${sermonAlias}.id
            AND (
              ${sermonAlias}_eligible_qa.status <> 'approved'
              OR ${sermonAlias}_eligible_qa.source_reference LIKE '%:phase3b2c-wave1-extractive-drafts-v2'
              OR NOT ${qaCurrent}
            )
        )
    )
  )`;
}

function buildPublishedConditions(
  input: PublicSermonListQuery,
  scope: FrontendSermonScope = "public"
): PublishedConditions {
  const values: Array<string | number> = [];
  const conditions = [frontendSermonEligibilitySql("s", scope)];
  let searchExpression: string | null = null;

  const parameter = (value: string | number): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (input.query) {
    const queryParameter = parameter(input.query);
    const escapedTitle = input.query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
    const titlePattern = parameter(`%${escapedTitle}%`);
    searchExpression = `websearch_to_tsquery('english', ${queryParameter})`;
    conditions.push(`(
      s.search_vector @@ ${searchExpression}
      OR s.title ILIKE ${titlePattern} ESCAPE '\\'
    )`);
  }
  if (input.speaker) {
    const speaker = parameter(input.speaker);
    conditions.push(`EXISTS (
      SELECT 1 FROM speakers sp_filter
      WHERE sp_filter.id = s.speaker_id AND lower(sp_filter.slug) = lower(${speaker})
    )`);
  }
  if (input.series) {
    const series = parameter(input.series);
    conditions.push(`EXISTS (
      SELECT 1 FROM sermon_series_map sm_filter
      JOIN series sr_filter ON sr_filter.id = sm_filter.series_id
      WHERE sm_filter.sermon_id = s.id AND lower(sr_filter.slug) = lower(${series})
    )`);
  }
  if (input.passage) {
    const passage = parameter(input.passage);
    conditions.push(`EXISTS (
      SELECT 1 FROM sermon_source_terms sst_filter
      JOIN source_taxonomy_terms st_filter ON st_filter.id = sst_filter.source_taxonomy_term_id
      WHERE sst_filter.sermon_id = s.id
        AND st_filter.taxonomy = 'sermon_topics'
        AND lower(st_filter.slug) = lower(${passage})
    )`);
  }
  if (input.book) {
    const book = parameter(input.book);
    conditions.push(`EXISTS (
      SELECT 1 FROM sermon_book_classifications sbc_filter
      JOIN book_classifications bc_filter ON bc_filter.id = sbc_filter.book_classification_id
      WHERE sbc_filter.sermon_id = s.id
        AND bc_filter.review_status = 'approved'
        AND lower(bc_filter.slug) = lower(${book})
    )`);
  }
  if (input.passageBook) {
    const book = bibleBookBySlug(input.passageBook);
    if (!book) throw new Error("Validated passage book was not found in the canonical catalogue");
    const bookId = parameter(book.id);
    const passageConditions = [
      "primary_filter.sermon_id = s.id",
      "primary_filter.relationship_role = 'primary'",
      "primary_filter.review_status = 'confirmed'",
      `primary_filter.canonical_book_id = ${bookId}`
    ];
    if (input.passageChapter !== undefined) {
      const queryStart = input.passageChapter * 1_000 + (input.passageVerse ?? 0);
      const queryEnd = input.passageChapter * 1_000 + (input.passageEndVerse ?? input.passageVerse ?? 999);
      const start = parameter(queryStart);
      const end = parameter(queryEnd);
      passageConditions.push(
        `(primary_filter.start_chapter * 1000 + COALESCE(primary_filter.start_verse, 0)) <= ${end}`,
        `(primary_filter.end_chapter * 1000 + COALESCE(primary_filter.end_verse, 999)) >= ${start}`
      );
    }
    conditions.push(`EXISTS (
      SELECT 1 FROM scripture_references primary_filter
      WHERE ${passageConditions.join("\n        AND ")}
    )`);
  }
  if (input.dateFrom) conditions.push(`s.service_date >= ${parameter(input.dateFrom)}::date`);
  if (input.dateTo) conditions.push(`s.service_date <= ${parameter(input.dateTo)}::date`);

  return { conditions, values, searchExpression };
}

export function publicRelationshipProjection(alias = "s"): string {
  return `
  (
    SELECT jsonb_build_object('name', sp.name, 'slug', sp.slug)
    FROM speakers sp
    WHERE sp.id = ${alias}.speaker_id
  ) AS speaker,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('name', sr.name, 'slug', sr.slug)
      ORDER BY sm.display_order, sr.id
    )
    FROM sermon_series_map sm
    JOIN series sr ON sr.id = sm.series_id
    WHERE sm.sermon_id = ${alias}.id
  ), '[]'::jsonb) AS series,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('displayText', ref.display_text, 'parseStatus', ref.parse_status)
      ORDER BY ref.display_order, ref.id
    )
    FROM scripture_references ref
    WHERE ref.sermon_id = ${alias}.id
      AND ref.review_status IN ('unreviewed', 'confirmed')
      AND NOT (ref.relationship_role = 'primary' AND ref.review_status = 'confirmed')
  ), '[]'::jsonb) AS scripture_references,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('displayText', primary_ref.display_text, 'isLead', primary_ref.is_lead)
      ORDER BY primary_ref.is_lead DESC, primary_ref.display_order, primary_ref.id
    )
    FROM scripture_references primary_ref
    WHERE primary_ref.sermon_id = ${alias}.id
      AND primary_ref.relationship_role = 'primary'
      AND primary_ref.review_status = 'confirmed'
  ), '[]'::jsonb) AS primary_passages,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM sermon_primary_passage_reviews passage_state
      WHERE passage_state.sermon_id = ${alias}.id AND passage_state.review_status = 'confirmed_none'
    ) THEN 'none'
    WHEN EXISTS (
      SELECT 1 FROM scripture_references assigned_passage
      WHERE assigned_passage.sermon_id = ${alias}.id
        AND assigned_passage.relationship_role = 'primary'
        AND assigned_passage.review_status = 'confirmed'
    ) THEN 'assigned'
    ELSE 'unresolved'
  END AS primary_passage_state,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('name', bc.name, 'slug', bc.slug)
      ORDER BY sbc.display_order, bc.id
    )
    FROM sermon_book_classifications sbc
    JOIN book_classifications bc ON bc.id = sbc.book_classification_id
    WHERE sbc.sermon_id = ${alias}.id
      AND bc.review_status = 'approved'
  ), '[]'::jsonb) AS books,
  (
    SELECT jsonb_build_object(
      'provider', media.provider,
      'mediaType', media.media_type,
      'externalId', media.external_id,
      'canonicalUrl', media.canonical_url,
      'title', media.title
    )
    FROM sermon_media media
    WHERE media.sermon_id = ${alias}.id
      AND media.provider IN ('youtube', 'sermonaudio')
      AND media.canonical_url IS NOT NULL
      AND media.title IS NOT NULL
    ORDER BY media.is_primary DESC, media.display_order, media.id
    LIMIT 1
  ) AS primary_media`;
}

export function buildPublishedSermonListQuery(
  input: PublicSermonListQuery,
  scope: FrontendSermonScope = "public"
): ParameterizedQuery {
  const state = buildPublishedConditions(input, scope);
  const parameter = (value: string | number): string => {
    state.values.push(value);
    return `$${state.values.length}`;
  };
  const limit = parameter(input.pageSize);
  const offset = parameter((input.page - 1) * input.pageSize);
  const dateDirection = input.order === "ASC" ? "ASC" : "DESC";
  const searchPriority = state.searchExpression ? `CASE
      WHEN to_tsvector('english'::regconfig, coalesce(s.title, '')) @@ ${state.searchExpression} THEN 4
      WHEN EXISTS (
        SELECT 1 FROM scripture_references priority_reference
        WHERE priority_reference.sermon_id = s.id
          AND priority_reference.review_status IN ('unreviewed', 'confirmed')
          AND to_tsvector('english'::regconfig, priority_reference.display_text) @@ ${state.searchExpression}
      ) OR EXISTS (
        SELECT 1 FROM sermon_book_classifications priority_book_map
        JOIN book_classifications priority_book
          ON priority_book.id = priority_book_map.book_classification_id
        WHERE priority_book_map.sermon_id = s.id
          AND priority_book.review_status = 'approved'
          AND to_tsvector('english'::regconfig, priority_book.name) @@ ${state.searchExpression}
      ) THEN 3
      WHEN EXISTS (
        SELECT 1 FROM speakers priority_speaker
        WHERE priority_speaker.id = s.speaker_id
          AND to_tsvector('english'::regconfig, priority_speaker.name) @@ ${state.searchExpression}
      ) OR EXISTS (
        SELECT 1 FROM sermon_series_map priority_series_map
        JOIN series priority_series ON priority_series.id = priority_series_map.series_id
        WHERE priority_series_map.sermon_id = s.id
          AND to_tsvector('english'::regconfig, priority_series.name) @@ ${state.searchExpression}
      ) THEN 2
      WHEN to_tsvector('english'::regconfig, coalesce(s.summary_search_document, '')) @@ ${state.searchExpression} THEN 1
      ELSE 0
    END` : null;
  const orderBy = state.searchExpression
    ? `${searchPriority} DESC,
       ts_rank_cd(ARRAY[0.1, 0.2, 0.4, 1.0]::real[], s.search_vector, ${state.searchExpression}) DESC,
       s.service_date ${dateDirection}, s.id`
    : `s.service_date ${dateDirection}, s.id`;

  return {
    text: `
      SELECT s.id, s.title, s.slug, to_char(s.service_date, 'YYYY-MM-DD') AS service_date,
             CASE WHEN s.summary_status = 'approved' THEN s.summary ELSE NULL END AS summary,
             count(*) OVER ()::integer AS total_items,
             ${publicRelationshipProjection()}
      FROM sermons s
      WHERE ${state.conditions.join("\n        AND ")}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `.trim(),
    values: state.values
  };
}

export function buildPublishedSermonCountQuery(
  input: PublicSermonListQuery,
  scope: FrontendSermonScope = "public"
): ParameterizedQuery {
  const state = buildPublishedConditions(input, scope);
  return {
    text: `
      SELECT count(*)::integer AS total_items
      FROM sermons s
      WHERE ${state.conditions.join("\n        AND ")}
    `.trim(),
    values: state.values
  };
}

export function buildPublishedSeriesRepresentativesQuery(
  scope: FrontendSermonScope = "public"
): ParameterizedQuery {
  return {
    text: `
      WITH ranked_series AS (
        SELECT sermon_series.id AS series_id,
               sermon_series.name AS series_name,
               sermon_series.slug AS series_slug,
               sermon.id AS sermon_id,
               row_number() OVER (
                 PARTITION BY sermon_series.id
                 ORDER BY sermon.service_date DESC, sermon.id
               ) AS representative_rank
        FROM series sermon_series
        JOIN sermon_series_map series_map ON series_map.series_id = sermon_series.id
        JOIN sermons sermon ON sermon.id = series_map.sermon_id
        WHERE ${frontendSermonEligibilitySql("sermon", scope)}
      )
      SELECT s.id, s.title, s.slug, to_char(s.service_date, 'YYYY-MM-DD') AS service_date,
             CASE WHEN s.summary_status = 'approved' THEN s.summary ELSE NULL END AS summary,
             jsonb_build_object('name', ranked.series_name, 'slug', ranked.series_slug)
               AS representative_series,
             ${publicRelationshipProjection("s")}
      FROM ranked_series ranked
      JOIN sermons s ON s.id = ranked.sermon_id
      WHERE ranked.representative_rank = 1
      ORDER BY lower(ranked.series_name), ranked.series_slug, s.id
    `.trim(),
    values: []
  };
}

export function buildPublishedSermonDetailQuery(
  slug: string,
  scope: FrontendSermonScope = "public"
): ParameterizedQuery {
  return {
    text: `
      SELECT s.id, s.title, s.slug, to_char(s.service_date, 'YYYY-MM-DD') AS service_date,
             CASE WHEN s.summary_status = 'approved' THEN s.summary ELSE NULL END AS summary,
             CASE WHEN s.summary_status = 'approved' THEN s.seo_description ELSE NULL END AS seo_description,
             s.body,
             ${publicRelationshipProjection()},
             COALESCE((
               SELECT jsonb_agg(
                 jsonb_build_object(
                   'provider', media.provider,
                   'mediaType', media.media_type,
                   'externalId', media.external_id,
                   'canonicalUrl', media.canonical_url,
                   'title', media.title
                 ) ORDER BY media.display_order, media.id
               )
               FROM sermon_media media
               WHERE media.sermon_id = s.id
                 AND media.provider IN ('youtube', 'sermonaudio')
                 AND media.canonical_url IS NOT NULL
                 AND media.title IS NOT NULL
             ), '[]'::jsonb) AS media,
             (
               SELECT jsonb_build_object('bodyText', transcript.body_text)
               FROM sermon_transcripts transcript
               WHERE transcript.sermon_id = s.id AND transcript.status = 'approved'
             ) AS transcript,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'question', qa.question_text,
                 'answer', qa.answer_text,
                 'displayOrder', qa.display_order
               ) ORDER BY qa.display_order, qa.id)
               FROM sermon_question_answers qa
               WHERE qa.sermon_id = s.id AND qa.status = 'approved'
             ), '[]'::jsonb) AS question_answers
      FROM sermons s
      WHERE ${frontendSermonEligibilitySql("s", scope)}
        AND lower(s.slug) = lower($1)
      LIMIT 1
    `.trim(),
    values: [slug]
  };
}

export function buildRelatedPublishedSermonsQuery(
  sermonId: string,
  limit: number,
  scope: FrontendSermonScope = "public"
): ParameterizedQuery {
  return {
    text: `
      WITH current_sermon AS (
        SELECT id, speaker_id
        FROM sermons
        WHERE id = $1::uuid AND ${frontendSermonEligibilitySql("sermons", scope)}
      ), candidate_scores AS (
        SELECT candidate.id,
          EXISTS (
            SELECT 1
            FROM sermon_series_map current_series
            JOIN sermon_series_map candidate_series
              ON candidate_series.series_id = current_series.series_id
            WHERE current_series.sermon_id = current_sermon.id
              AND candidate_series.sermon_id = candidate.id
          ) AS same_series,
          EXISTS (
            SELECT 1
            FROM scripture_references current_reference
            JOIN scripture_references candidate_reference
              ON candidate_reference.sermon_id = candidate.id
            WHERE current_reference.sermon_id = current_sermon.id
              AND current_reference.review_status IN ('unreviewed', 'confirmed')
              AND candidate_reference.review_status IN ('unreviewed', 'confirmed')
              AND (
                lower(regexp_replace(trim(current_reference.display_text), '[[:space:]]+', ' ', 'g')) =
                  lower(regexp_replace(trim(candidate_reference.display_text), '[[:space:]]+', ' ', 'g'))
                OR (
                  current_reference.canonical_book_id IS NOT NULL
                  AND current_reference.canonical_book_id = candidate_reference.canonical_book_id
                  AND current_reference.start_chapter IS NOT NULL
                  AND candidate_reference.start_chapter IS NOT NULL
                  AND (
                    current_reference.start_chapter * 1000
                      + COALESCE(current_reference.start_verse, 1)
                  ) <= (
                    COALESCE(candidate_reference.end_chapter, candidate_reference.start_chapter) * 1000
                      + COALESCE(candidate_reference.end_verse, candidate_reference.start_verse, 999)
                  )
                  AND (
                    candidate_reference.start_chapter * 1000
                      + COALESCE(candidate_reference.start_verse, 1)
                  ) <= (
                    COALESCE(current_reference.end_chapter, current_reference.start_chapter) * 1000
                      + COALESCE(current_reference.end_verse, current_reference.start_verse, 999)
                  )
                )
              )
          ) AS overlapping_scripture,
          EXISTS (
            SELECT 1
            FROM sermon_book_classifications current_book
            JOIN book_classifications current_classification
              ON current_classification.id = current_book.book_classification_id
             AND current_classification.review_status = 'approved'
             AND current_classification.canonical_book_id IS NOT NULL
            JOIN sermon_book_classifications candidate_book
              ON candidate_book.sermon_id = candidate.id
            JOIN book_classifications candidate_classification
              ON candidate_classification.id = candidate_book.book_classification_id
             AND candidate_classification.review_status = 'approved'
             AND candidate_classification.canonical_book_id = current_classification.canonical_book_id
            WHERE current_book.sermon_id = current_sermon.id
          ) AS same_bible_book,
          current_sermon.speaker_id IS NOT NULL
            AND candidate.speaker_id = current_sermon.speaker_id AS same_speaker
        FROM sermons candidate
        CROSS JOIN current_sermon
        WHERE candidate.id <> current_sermon.id
          AND ${frontendSermonEligibilitySql("candidate", scope)}
      ), ranked AS (
        SELECT candidate.*,
          (CASE WHEN score.same_series THEN 100 ELSE 0 END
           + CASE WHEN score.overlapping_scripture THEN 70 ELSE 0 END
           + CASE WHEN score.same_bible_book THEN 35 ELSE 0 END
           + CASE WHEN score.same_speaker THEN 15 ELSE 0 END) AS related_score,
          array_remove(ARRAY[
            CASE WHEN score.same_series THEN 'same_series' END,
            CASE WHEN score.overlapping_scripture THEN 'overlapping_scripture' END,
            CASE WHEN score.same_bible_book THEN 'same_bible_book' END,
            CASE WHEN score.same_speaker THEN 'same_speaker' END
          ], NULL) AS relationship_reasons
        FROM candidate_scores score
        JOIN sermons candidate ON candidate.id = score.id
      )
      SELECT s.id, s.title, s.slug, to_char(s.service_date, 'YYYY-MM-DD') AS service_date,
             CASE WHEN s.summary_status = 'approved' THEN s.summary ELSE NULL END AS summary,
             s.relationship_reasons,
             ${publicRelationshipProjection()}
      FROM ranked s
      WHERE s.related_score > 0
      ORDER BY s.related_score DESC, s.service_date DESC, s.id
      LIMIT $2
    `.trim(),
    values: [sermonId, limit]
  };
}

export function buildPublishedSermonFilterOptionsQuery(
  scope: FrontendSermonScope = "public"
): ParameterizedQuery {
  return {
    text: `
      SELECT
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('name', options.name, 'slug', options.slug)
                           ORDER BY lower(options.name), options.slug)
          FROM (
            SELECT DISTINCT speaker.name, speaker.slug
            FROM speakers speaker
            JOIN sermons sermon ON sermon.speaker_id = speaker.id
            WHERE ${frontendSermonEligibilitySql("sermon", scope)}
          ) options
        ), '[]'::jsonb) AS speakers,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('name', options.name, 'slug', options.slug)
                           ORDER BY lower(options.name), options.slug)
          FROM (
            SELECT DISTINCT sermon_series.name, sermon_series.slug
            FROM series sermon_series
            JOIN sermon_series_map series_map ON series_map.series_id = sermon_series.id
            JOIN sermons sermon ON sermon.id = series_map.sermon_id
            WHERE ${frontendSermonEligibilitySql("sermon", scope)}
          ) options
        ), '[]'::jsonb) AS series,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('name', options.name, 'slug', options.slug)
                           ORDER BY lower(options.name), options.slug)
          FROM (
            SELECT DISTINCT source_term.name, source_term.slug
            FROM source_taxonomy_terms source_term
            JOIN sermon_source_terms source_map
              ON source_map.source_taxonomy_term_id = source_term.id
            JOIN sermons sermon ON sermon.id = source_map.sermon_id
            WHERE source_term.taxonomy = 'sermon_topics'
              AND ${frontendSermonEligibilitySql("sermon", scope)}
          ) options
        ), '[]'::jsonb) AS passages,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('name', options.name, 'slug', options.slug)
                           ORDER BY lower(options.name), options.slug)
          FROM (
            SELECT DISTINCT classification.name, classification.slug
            FROM book_classifications classification
            JOIN sermon_book_classifications book_map
              ON book_map.book_classification_id = classification.id
            JOIN sermons sermon ON sermon.id = book_map.sermon_id
            WHERE classification.review_status = 'approved'
              AND ${frontendSermonEligibilitySql("sermon", scope)}
          ) options
        ), '[]'::jsonb) AS books,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'bookSlug', availability.book_slug,
              'chapter', availability.chapter,
              'verses', availability.verses
            ) ORDER BY availability.canonical_order, availability.chapter
          )
          FROM (
            SELECT canonical_book.slug AS book_slug,
                   canonical_book.canonical_order,
                   primary_passage.start_chapter AS chapter,
                   jsonb_agg(DISTINCT covered_verse.verse ORDER BY covered_verse.verse) AS verses
            FROM scripture_references primary_passage
            JOIN bible_books canonical_book ON canonical_book.id = primary_passage.canonical_book_id
            JOIN sermons sermon ON sermon.id = primary_passage.sermon_id
            CROSS JOIN LATERAL generate_series(
              primary_passage.start_verse,
              primary_passage.end_verse
            ) AS covered_verse(verse)
            WHERE primary_passage.relationship_role = 'primary'
              AND primary_passage.review_status = 'confirmed'
              AND primary_passage.start_chapter = primary_passage.end_chapter
              AND primary_passage.start_verse IS NOT NULL
              AND primary_passage.end_verse IS NOT NULL
              AND ${frontendSermonEligibilitySql("sermon", scope)}
            GROUP BY canonical_book.slug, canonical_book.canonical_order,
                     primary_passage.start_chapter
          ) availability
        ), '[]'::jsonb) AS passage_verse_availability
    `.trim(),
    values: []
  };
}

export function buildPublishedSermonSitemapQuery(): ParameterizedQuery {
  return {
    text: `
      SELECT slug, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS last_modified
      FROM sermons
      WHERE ${frontendSermonEligibilitySql("sermons", "public")}
      ORDER BY slug, id
    `.trim(),
    values: []
  };
}

export function buildPublicSermonPathDispositionQuery(path: string): ParameterizedQuery {
  return {
    text: `
      SELECT redirect.status_code, redirect.new_path
      FROM redirects redirect
      WHERE redirect.old_path = $1
        AND (
          redirect.status_code = 410
          OR (
            redirect.status_code = 301
            AND redirect.new_path ~ '^/sermons/[a-z0-9]+(-[a-z0-9]+)*/$'
            AND EXISTS (
              SELECT 1
              FROM sermons target
              WHERE ${frontendSermonEligibilitySql("target", "public")}
                AND '/sermons/' || target.slug || '/' = redirect.new_path
            )
          )
        )
      LIMIT 1
    `.trim(),
    values: [path]
  };
}

import type { PublicSermonListQuery } from "../../api/contracts/public-sermons";

export interface ParameterizedQuery {
  text: string;
  values: Array<string | number>;
}

interface PublishedConditions {
  conditions: string[];
  values: Array<string | number>;
  searchExpression: string | null;
}

function buildPublishedConditions(input: PublicSermonListQuery): PublishedConditions {
  const values: Array<string | number> = [];
  const conditions = ["s.status = 'published'", "s.deleted_at IS NULL"];
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
  if (input.dateFrom) conditions.push(`s.service_date >= ${parameter(input.dateFrom)}::date`);
  if (input.dateTo) conditions.push(`s.service_date <= ${parameter(input.dateTo)}::date`);

  return { conditions, values, searchExpression };
}

function publicRelationshipProjection(alias = "s"): string {
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
  ), '[]'::jsonb) AS scripture_references,
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

export function buildPublishedSermonListQuery(input: PublicSermonListQuery): ParameterizedQuery {
  const state = buildPublishedConditions(input);
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

export function buildPublishedSermonCountQuery(input: PublicSermonListQuery): ParameterizedQuery {
  const state = buildPublishedConditions(input);
  return {
    text: `
      SELECT count(*)::integer AS total_items
      FROM sermons s
      WHERE ${state.conditions.join("\n        AND ")}
    `.trim(),
    values: state.values
  };
}

export function buildPublishedSermonDetailQuery(slug: string): ParameterizedQuery {
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
      WHERE s.status = 'published'
        AND s.deleted_at IS NULL
        AND lower(s.slug) = lower($1)
      LIMIT 1
    `.trim(),
    values: [slug]
  };
}

export function buildRelatedPublishedSermonsQuery(
  sermonId: string,
  limit: number
): ParameterizedQuery {
  return {
    text: `
      WITH current_sermon AS (
        SELECT id, speaker_id
        FROM sermons
        WHERE id = $1::uuid AND status = 'published' AND deleted_at IS NULL
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
          AND candidate.status = 'published'
          AND candidate.deleted_at IS NULL
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

export function buildPublishedSermonFilterOptionsQuery(): ParameterizedQuery {
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
            WHERE sermon.status = 'published' AND sermon.deleted_at IS NULL
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
            WHERE sermon.status = 'published' AND sermon.deleted_at IS NULL
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
              AND sermon.status = 'published' AND sermon.deleted_at IS NULL
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
              AND sermon.status = 'published' AND sermon.deleted_at IS NULL
          ) options
        ), '[]'::jsonb) AS books
    `.trim(),
    values: []
  };
}

export function buildPublishedSermonSitemapQuery(): ParameterizedQuery {
  return {
    text: `
      SELECT slug, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS last_modified
      FROM sermons
      WHERE status = 'published' AND deleted_at IS NULL
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
              WHERE target.status = 'published'
                AND target.deleted_at IS NULL
                AND '/sermons/' || target.slug || '/' = redirect.new_path
            )
          )
        )
      LIMIT 1
    `.trim(),
    values: [path]
  };
}

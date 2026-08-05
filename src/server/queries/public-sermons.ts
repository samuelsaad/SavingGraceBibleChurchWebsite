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
      SELECT 1 FROM sermon_speakers ss_filter
      JOIN speakers sp_filter ON sp_filter.id = ss_filter.speaker_id
      WHERE ss_filter.sermon_id = s.id AND lower(sp_filter.slug) = lower(${speaker})
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
      WHERE sbc_filter.sermon_id = s.id AND lower(bc_filter.slug) = lower(${book})
    )`);
  }
  if (input.dateFrom) conditions.push(`s.service_date >= ${parameter(input.dateFrom)}::date`);
  if (input.dateTo) conditions.push(`s.service_date <= ${parameter(input.dateTo)}::date`);

  return { conditions, values, searchExpression };
}

const publicRelationshipProjection = `
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('name', sp.name, 'slug', sp.slug)
      ORDER BY ss.display_order, sp.id
    )
    FROM sermon_speakers ss
    JOIN speakers sp ON sp.id = ss.speaker_id
    WHERE ss.sermon_id = s.id
  ), '[]'::jsonb) AS speakers,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('name', sr.name, 'slug', sr.slug)
      ORDER BY sm.display_order, sr.id
    )
    FROM sermon_series_map sm
    JOIN series sr ON sr.id = sm.series_id
    WHERE sm.sermon_id = s.id
  ), '[]'::jsonb) AS series,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('displayText', ref.display_text, 'parseStatus', ref.parse_status)
      ORDER BY ref.display_order, ref.id
    )
    FROM scripture_references ref
    WHERE ref.sermon_id = s.id
  ), '[]'::jsonb) AS scripture_references,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('name', bc.name, 'slug', bc.slug)
      ORDER BY sbc.display_order, bc.id
    )
    FROM sermon_book_classifications sbc
    JOIN book_classifications bc ON bc.id = sbc.book_classification_id
    WHERE sbc.sermon_id = s.id
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
    WHERE media.sermon_id = s.id
      AND media.provider IN ('youtube', 'sermonaudio')
      AND media.canonical_url IS NOT NULL
      AND media.title IS NOT NULL
    ORDER BY media.is_primary DESC, media.display_order, media.id
    LIMIT 1
  ) AS primary_media`;

export function buildPublishedSermonListQuery(input: PublicSermonListQuery): ParameterizedQuery {
  const state = buildPublishedConditions(input);
  const parameter = (value: string | number): string => {
    state.values.push(value);
    return `$${state.values.length}`;
  };
  const limit = parameter(input.pageSize);
  const offset = parameter((input.page - 1) * input.pageSize);
  const dateDirection = input.order === "ASC" ? "ASC" : "DESC";
  const orderBy = state.searchExpression
    ? `ts_rank_cd(s.search_vector, ${state.searchExpression}) DESC, s.service_date ${dateDirection}, s.id`
    : `s.service_date ${dateDirection}, s.id`;

  return {
    text: `
      SELECT s.id, s.title, s.slug, to_char(s.service_date, 'YYYY-MM-DD') AS service_date,
             s.summary, count(*) OVER ()::integer AS total_items,
             ${publicRelationshipProjection}
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
             s.summary, s.body,
             ${publicRelationshipProjection},
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
             ), '[]'::jsonb) AS media
      FROM sermons s
      WHERE s.status = 'published'
        AND s.deleted_at IS NULL
        AND lower(s.slug) = lower($1)
      LIMIT 1
    `.trim(),
    values: [slug]
  };
}

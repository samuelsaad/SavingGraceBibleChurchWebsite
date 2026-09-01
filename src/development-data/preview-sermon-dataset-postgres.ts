import type { PoolClient } from "pg";
import {
  previewDatasetAllowedSlugs,
  previewSermonDatasetSchema,
  previewDatasetVersion,
  type PreviewSermonDataset,
  type PreviewSermonDatasetRecord
} from "./preview-sermon-dataset";

interface BaseRow {
  id: string;
  title: string;
  slug: PreviewSermonDatasetRecord["slug"];
  service_date: string;
  description: string;
  transcript: string;
  speaker_name: string;
  speaker_slug: string;
  sermon_status: string;
  published_at: Date | string | null;
  deleted_at: Date | string | null;
  source_status: string | null;
  summary_status: string;
  transcript_status: string;
  body_present: boolean;
  completed_review: boolean;
  content_ready: boolean;
  passage_ready: boolean;
}

function mapPush<T>(map: Map<string, T[]>, key: string, value: T): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

export async function readPreviewDatasetRecords(
  client: PoolClient,
  options: { requireCompletedSourceReview: boolean }
): Promise<{ dataset: PreviewSermonDataset; sourceStatuses: Map<string, string | null> }> {
  const base = await client.query<BaseRow>(`SELECT
      sermon.id,
      sermon.title,
      sermon.slug,
      to_char(sermon.service_date, 'YYYY-MM-DD') AS service_date,
      sermon.summary AS description,
      transcript.body_text AS transcript,
      speaker.name AS speaker_name,
      speaker.slug AS speaker_slug,
      sermon.status AS sermon_status,
      sermon.published_at,
      sermon.deleted_at,
      sermon.source_status,
      sermon.summary_status,
      transcript.status AS transcript_status,
      (sermon.body IS NOT NULL AND char_length(trim(sermon.body)) > 0) AS body_present,
      EXISTS (
        SELECT 1 FROM sermon_enrichment_reviews review
        WHERE review.sermon_id = sermon.id
          AND review.current_stage = 6
          AND review.completed_at IS NOT NULL
      ) AS completed_review,
      readiness.is_content_complete AS content_ready,
      readiness.has_required_passage_decision AS passage_ready
    FROM sermons sermon
    JOIN speakers speaker ON speaker.id = sermon.speaker_id
    JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
    JOIN sermon_content_readiness readiness ON readiness.sermon_id = sermon.id
    WHERE sermon.slug = ANY($1::text[])
    ORDER BY array_position($1::text[], sermon.slug)`, [previewDatasetAllowedSlugs]);

  if (base.rows.length !== previewDatasetAllowedSlugs.length) {
    throw new Error("The authorised development-dataset scope did not resolve to exactly 15 sermons");
  }
  const actualSlugs = base.rows.map((row) => row.slug);
  if (actualSlugs.some((slug, index) => slug !== previewDatasetAllowedSlugs[index])) {
    throw new Error("The authorised development-dataset scope is missing or ambiguous");
  }
  for (const row of base.rows) {
    if (
      row.sermon_status !== "draft" || row.published_at !== null || row.deleted_at !== null ||
      row.summary_status !== "approved" || row.transcript_status !== "approved" ||
      row.body_present || !row.content_ready || !row.passage_ready ||
      (options.requireCompletedSourceReview && !row.completed_review)
    ) {
      throw new Error(`The authorised development record ${row.slug} is not in the required private reviewed state`);
    }
  }

  const ids = base.rows.map((row) => row.id);
  const series = await client.query<{
      sermon_id: string; name: string; slug: string; display_order: number;
    }>(`SELECT map.sermon_id, item.name, item.slug, map.display_order
        FROM sermon_series_map map JOIN series item ON item.id = map.series_id
        WHERE map.sermon_id = ANY($1::uuid[])
        ORDER BY map.sermon_id, map.display_order, item.id`, [ids]);
  const books = await client.query<{
      sermon_id: string; canonical_book_id: number; name: string; slug: string; display_order: number;
    }>(`SELECT map.sermon_id, item.canonical_book_id, item.name, item.slug, map.display_order
        FROM sermon_book_classifications map
        JOIN book_classifications item ON item.id = map.book_classification_id
        WHERE map.sermon_id = ANY($1::uuid[])
          AND item.canonical_book_id IS NOT NULL
          AND item.review_status = 'approved'
        ORDER BY map.sermon_id, map.display_order, item.id`, [ids]);
  const terms = await client.query<{
      sermon_id: string; name: string; slug: string; display_order: number;
    }>(`SELECT map.sermon_id, item.name, item.slug,
              map.source_relationship_order AS display_order
        FROM sermon_source_terms map
        JOIN source_taxonomy_terms item ON item.id = map.source_taxonomy_term_id
        WHERE map.sermon_id = ANY($1::uuid[])
          AND item.taxonomy = 'sermon_topics'
        ORDER BY map.sermon_id, map.source_relationship_order, item.id`, [ids]);
  const references = await client.query<{
      sermon_id: string;
      display_text: string;
      canonical_book_id: number | null;
      start_chapter: number | null;
      start_verse: number | null;
      end_chapter: number | null;
      end_verse: number | null;
      display_order: number;
      relationship_role: "primary" | "supporting" | "unclassified";
      is_lead: boolean;
      review_status: "unreviewed" | "confirmed";
    }>(`SELECT sermon_id, display_text, canonical_book_id, start_chapter, start_verse,
              end_chapter, end_verse, display_order, relationship_role, is_lead, review_status
        FROM scripture_references
        WHERE sermon_id = ANY($1::uuid[])
          AND review_status IN ('unreviewed', 'confirmed')
        ORDER BY sermon_id, display_order, id`, [ids]);
  const media = await client.query<{
      sermon_id: string;
      media_type: "video" | "audio";
      provider: "youtube" | "sermonaudio";
      external_id: string;
      canonical_url: string;
      title: string;
      duration_seconds: number | null;
      is_primary: boolean;
      display_order: number;
      availability_status: "unknown" | "available" | "unavailable" | "invalid" | "review";
    }>(`SELECT sermon_id, media_type, provider, external_id, canonical_url, title,
              duration_seconds, is_primary, display_order, availability_status
        FROM sermon_media
        WHERE sermon_id = ANY($1::uuid[])
          AND provider IN ('youtube', 'sermonaudio')
          AND external_id IS NOT NULL AND canonical_url IS NOT NULL AND title IS NOT NULL
        ORDER BY sermon_id, display_order, id`, [ids]);
  const questionAnswers = await client.query<{
      sermon_id: string; display_order: number; question_text: string; answer_text: string; status: string;
    }>(`SELECT sermon_id, display_order, question_text, answer_text, status
        FROM sermon_question_answers
        WHERE sermon_id = ANY($1::uuid[])
        ORDER BY sermon_id, display_order, id`, [ids]);
  const passageDecisions = await client.query<{ sermon_id: string; review_status: "confirmed_passage" | "confirmed_none" }>(
      `SELECT sermon_id, review_status
       FROM sermon_primary_passage_reviews
       WHERE sermon_id = ANY($1::uuid[])
         AND review_status IN ('confirmed_passage', 'confirmed_none')
       ORDER BY sermon_id`, [ids]
    );
  const rawRelationshipCounts = await client.query<{
    books: number; terms: number; references: number; media: number; passage_decisions: number;
  }>(`SELECT
    (SELECT count(*)::integer FROM sermon_book_classifications WHERE sermon_id = ANY($1::uuid[])) AS books,
    (SELECT count(*)::integer FROM sermon_source_terms WHERE sermon_id = ANY($1::uuid[])) AS terms,
    (SELECT count(*)::integer FROM scripture_references WHERE sermon_id = ANY($1::uuid[])) AS references,
    (SELECT count(*)::integer FROM sermon_media WHERE sermon_id = ANY($1::uuid[])) AS media,
    (SELECT count(*)::integer FROM sermon_primary_passage_reviews WHERE sermon_id = ANY($1::uuid[])) AS passage_decisions`, [ids]);
  const raw = rawRelationshipCounts.rows[0];
  // The approved source snapshot contains one source-only/noncanonical mapping
  // that is not a public Bible-book display relationship. The portable seed
  // deliberately excludes it, while a re-export still verifies its exact count.
  const expectedRawBookCount = books.rows.length + (options.requireCompletedSourceReview ? 1 : 0);
  if (!raw || raw.books !== expectedRawBookCount || raw.terms !== terms.rows.length ||
      raw.references !== references.rows.length || raw.media !== media.rows.length ||
      raw.passage_decisions !== passageDecisions.rows.length) {
    throw new Error("The authorised development scope contains a relationship outside the public seed contract");
  }

  const seriesBySermon = new Map<string, PreviewSermonDatasetRecord["series"]>();
  for (const row of series.rows) mapPush(seriesBySermon, row.sermon_id, {
    name: row.name, slug: row.slug, displayOrder: row.display_order
  });
  const booksBySermon = new Map<string, PreviewSermonDatasetRecord["bibleBooks"]>();
  for (const row of books.rows) mapPush(booksBySermon, row.sermon_id, {
    canonicalBookId: row.canonical_book_id,
    name: row.name,
    slug: row.slug,
    displayOrder: row.display_order
  });
  const termsBySermon = new Map<string, PreviewSermonDatasetRecord["passageTerms"]>();
  for (const row of terms.rows) mapPush(termsBySermon, row.sermon_id, {
    name: row.name, slug: row.slug, displayOrder: row.display_order
  });
  const referencesBySermon = new Map<string, PreviewSermonDatasetRecord["scriptureReferences"]>();
  for (const row of references.rows) mapPush(referencesBySermon, row.sermon_id, {
    displayText: row.display_text,
    canonicalBookId: row.canonical_book_id,
    startChapter: row.start_chapter,
    startVerse: row.start_verse,
    endChapter: row.end_chapter,
    endVerse: row.end_verse,
    displayOrder: row.display_order,
    relationshipRole: row.relationship_role,
    isLead: row.is_lead,
    reviewStatus: row.review_status
  });
  const mediaBySermon = new Map<string, PreviewSermonDatasetRecord["media"]>();
  for (const row of media.rows) mapPush(mediaBySermon, row.sermon_id, {
    mediaType: row.media_type,
    provider: row.provider,
    externalId: row.external_id,
    canonicalUrl: row.canonical_url,
    title: row.title,
    durationSeconds: row.duration_seconds,
    isPrimary: row.is_primary,
    displayOrder: row.display_order,
    availabilityStatus: row.availability_status
  });
  const qaBySermon = new Map<string, PreviewSermonDatasetRecord["questionAnswers"]>();
  for (const row of questionAnswers.rows) {
    if (row.status !== "approved") {
      throw new Error("The authorised development dataset contains a non-approved Q&A item");
    }
    mapPush(qaBySermon, row.sermon_id, {
      displayOrder: row.display_order,
      question: row.question_text,
      answer: row.answer_text
    });
  }
  const passageDecisionBySermon = new Map(
    passageDecisions.rows.map((row) => [row.sermon_id, row.review_status] as const)
  );

  const records = base.rows.map((row): PreviewSermonDatasetRecord => ({
    title: row.title,
    slug: row.slug,
    serviceDate: row.service_date,
    description: row.description,
    transcript: row.transcript,
    speaker: { name: row.speaker_name, slug: row.speaker_slug },
    series: seriesBySermon.get(row.id) ?? [],
    bibleBooks: booksBySermon.get(row.id) ?? [],
    passageTerms: termsBySermon.get(row.id) ?? [],
    scriptureReferences: referencesBySermon.get(row.id) ?? [],
    primaryPassageDecision: passageDecisionBySermon.get(row.id) ?? "confirmed_none",
    media: mediaBySermon.get(row.id) ?? [],
    questionAnswers: qaBySermon.get(row.id) ?? []
  }));
  if (passageDecisionBySermon.size !== records.length) {
    throw new Error("Every authorised development sermon must have one reviewed passage outcome");
  }

  return {
    dataset: previewSermonDatasetSchema.parse({ schemaVersion: previewDatasetVersion, sermons: records }),
    sourceStatuses: new Map(base.rows.map((row) => [row.slug, row.source_status]))
  };
}

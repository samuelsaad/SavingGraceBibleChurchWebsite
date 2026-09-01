import type { Pool, PoolClient } from "pg";
import {
  assertDisposableIntegrationTestDatabase,
  assertDisposableLocalDatabase
} from "../migration/local-database-safety";
import { deterministicSourceUuid } from "../migration/identity";
import {
  loadSchemaMigrations,
  validateSchemaMigrationJournal,
  type SchemaMigrationJournalRow
} from "../migration/schema-migrations";
import { protestantBibleBooks, savingGraceSpeakers } from "../migration/reference-catalogue";
import { frontendSermonEligibilitySql } from "../server/queries/public-sermons";
import { readPreviewDatasetRecords } from "./preview-sermon-dataset-postgres";
import {
  loadTrackedPreviewDataset,
  previewDatasetAllowedSlugs,
  previewDatasetSourceStatus,
  previewDatasetSyntheticSubject,
  previewDatasetVersion,
  serializePublicDataset,
  sha256,
  type PreviewSermonDataset,
  type PreviewSermonDatasetRecord
} from "./preview-sermon-dataset";

export interface PreviewDatasetImportOptions {
  connectionString: string;
  writeOptIn?: string | undefined;
  testRunToken?: string | undefined;
}

export interface PreviewDatasetImportResult {
  outcome: "imported" | "unchanged";
  sermons: number;
  questionAnswers: number;
  publicEligible: number;
  previewEligible: number;
  semanticEligible: number;
  contentSha256: string;
  manifestSha256: string;
}

function expectedDatabaseName(options: PreviewDatasetImportOptions): string {
  if (options.testRunToken) {
    return assertDisposableIntegrationTestDatabase(
      options.connectionString,
      options.testRunToken,
      options.writeOptIn
    );
  }
  assertDisposableLocalDatabase(options.connectionString, options.writeOptIn);
  return "savinggrace_sermons_test";
}

async function verifyTarget(client: PoolClient, databaseName: string): Promise<void> {
  const identity = await client.query<{
    server_16: boolean; loopback: boolean; port_5432: boolean; target_database: boolean;
  }>(`SELECT
      current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
      inet_server_addr() = '127.0.0.1'::inet AS loopback,
      inet_server_port() = 5432 AS port_5432,
      current_database() = $1 AS target_database`, [databaseName]);
  if (!Object.values(identity.rows[0] ?? {}).every(Boolean)) {
    throw new Error("The public development-dataset importer refused the PostgreSQL target identity");
  }
  const migrations = await loadSchemaMigrations();
  const journal = await client.query<SchemaMigrationJournalRow>(
    "SELECT migration_order, migration_id, checksum_sha256, applied_at FROM schema_migrations ORDER BY migration_order"
  );
  if (validateSchemaMigrationJournal(migrations, journal.rows) !== migrations.length) {
    throw new Error("The public development-dataset importer requires every current schema migration");
  }
  const catalogue = await client.query<{ books: number; classifications: number }>(`SELECT
    (SELECT count(*)::integer FROM bible_books WHERE id = ANY($1::smallint[])) AS books,
    (SELECT count(*)::integer FROM book_classifications
      WHERE id = ANY($2::uuid[]) AND review_status = 'approved') AS classifications`, [
    protestantBibleBooks.map((book) => book.id),
    protestantBibleBooks.map((book) => book.classificationId)
  ]);
  if (catalogue.rows[0]?.books !== 66 || catalogue.rows[0]?.classifications !== 66) {
    throw new Error("Apply the canonical reference catalogue before importing the development dataset");
  }
}

function deterministicNumericIdentity(namespace: string, value: string): string {
  return BigInt(`0x${sha256(`${namespace}:${value}`).slice(0, 12)}`).toString();
}

async function requireSpeaker(client: PoolClient, sermon: PreviewSermonDatasetRecord): Promise<string> {
  const expected = savingGraceSpeakers.find((speaker) => speaker.slug === sermon.speaker.slug);
  if (!expected || expected.name !== sermon.speaker.name) {
    throw new Error(`The dataset speaker catalogue does not recognise ${sermon.slug}`);
  }
  const present = await client.query<{ id: string }>(
    "SELECT id FROM speakers WHERE id = $1 AND name = $2 AND slug = $3",
    [expected.id, expected.name, expected.slug]
  );
  if (present.rows.length !== 1) throw new Error("The seeded speaker catalogue is incomplete");
  return expected.id;
}

async function upsertSeries(client: PoolClient, item: PreviewSermonDatasetRecord["series"][number]): Promise<string> {
  const id = deterministicSourceUuid("public-development-series", item.slug);
  const conflicts = await client.query<{ id: string; name: string; slug: string }>(
    "SELECT id, name, slug FROM series WHERE id = $1 OR lower(slug) = lower($2)",
    [id, item.slug]
  );
  if (conflicts.rows.length === 0) {
    await client.query("INSERT INTO series (id, name, slug) VALUES ($1, $2, $3)", [id, item.name, item.slug]);
  } else if (
    conflicts.rows.length !== 1 || conflicts.rows[0]!.id !== id ||
    conflicts.rows[0]!.name !== item.name || conflicts.rows[0]!.slug !== item.slug
  ) {
    throw new Error("A development dataset series conflicts with existing local data");
  }
  return id;
}

async function upsertPassageTerm(
  client: PoolClient,
  item: PreviewSermonDatasetRecord["passageTerms"][number]
): Promise<string> {
  const id = deterministicSourceUuid("public-development-passage-term", item.slug);
  const numericId = deterministicNumericIdentity("public-development-passage-term", item.slug);
  const conflicts = await client.query<{ id: string; name: string; slug: string }>(
    `SELECT id, name, slug FROM source_taxonomy_terms
     WHERE id = $1 OR (source_system = $2 AND taxonomy = 'sermon_topics' AND source_term_taxonomy_id = $3)`,
    [id, previewDatasetSourceStatus, numericId]
  );
  if (conflicts.rows.length === 0) {
    await client.query(`INSERT INTO source_taxonomy_terms (
        id, source_system, taxonomy, source_term_id, source_term_taxonomy_id,
        name, slug, source_order
      ) VALUES ($1, $2, 'sermon_topics', $3, $3, $4, $5, $6)`, [
      id, previewDatasetSourceStatus, numericId, item.name, item.slug, item.displayOrder
    ]);
  } else if (
    conflicts.rows.length !== 1 || conflicts.rows[0]!.id !== id ||
    conflicts.rows[0]!.name !== item.name || conflicts.rows[0]!.slug !== item.slug
  ) {
    throw new Error("A development dataset passage term conflicts with existing local data");
  }
  return id;
}

async function insertSermon(client: PoolClient, sermon: PreviewSermonDatasetRecord): Promise<void> {
  const sermonId = deterministicSourceUuid("public-development-sermon", sermon.slug);
  const speakerId = await requireSpeaker(client, sermon);
  const lifecycleTimestamp = `${sermon.serviceDate}T00:00:00.000Z`;
  await client.query(`INSERT INTO sermons (
      id, title, slug, summary, summary_status, summary_source_kind,
      summary_created_at, summary_updated_at, summary_reviewed_by_subject,
      summary_approved_by_subject, summary_reviewed_at, summary_approved_at,
      status, service_date, published_at, source_status, speaker_id,
      historical_backfill_required
    ) VALUES (
      $1, $2, $3, $4, 'approved', 'imported',
      $5, $5, $6, $6, $5, $5,
      'draft', $7::date, NULL, $8, $9, false
    )`, [
    sermonId,
    sermon.title,
    sermon.slug,
    sermon.description,
    lifecycleTimestamp,
    previewDatasetSyntheticSubject,
    sermon.serviceDate,
    previewDatasetSourceStatus,
    speakerId
  ]);

  for (const item of sermon.series) {
    const seriesId = await upsertSeries(client, item);
    await client.query(`INSERT INTO sermon_series_map (sermon_id, series_id, display_order, is_primary)
      VALUES ($1, $2, $3, $4)`, [sermonId, seriesId, item.displayOrder, item.displayOrder === 0]);
  }
  for (const item of sermon.bibleBooks) {
    const expected = protestantBibleBooks.find((book) => book.id === item.canonicalBookId);
    if (!expected || expected.canonicalName !== item.name || expected.slug !== item.slug) {
      throw new Error(`The dataset Bible-book identity is invalid for ${sermon.slug}`);
    }
    await client.query(`INSERT INTO sermon_book_classifications (
      sermon_id, book_classification_id, display_order
    ) VALUES ($1, $2, $3)`, [sermonId, expected.classificationId, item.displayOrder]);
  }
  for (const item of sermon.passageTerms) {
    const termId = await upsertPassageTerm(client, item);
    await client.query(`INSERT INTO sermon_source_terms (
      sermon_id, source_taxonomy_term_id, source_relationship_order
    ) VALUES ($1, $2, $3)`, [sermonId, termId, item.displayOrder]);
  }

  await client.query(`INSERT INTO sermon_primary_passage_reviews (
      sermon_id, proposal_outcome, evidence_source, evidence_sha256, parser_version,
      review_status, reviewed_by_subject, reviewed_at, proposed_at
    ) VALUES ($1, $2, 'administrator', $3, $4, $5, $6, $7, $7)`, [
    sermonId,
    sermon.primaryPassageDecision === "confirmed_none" ? "no_reference" : "administrator_entered",
    sha256(`${previewDatasetVersion}\n${sermon.slug}\n${sermon.primaryPassageDecision}`),
    previewDatasetVersion,
    sermon.primaryPassageDecision,
    previewDatasetSyntheticSubject,
    lifecycleTimestamp
  ]);
  for (const item of sermon.scriptureReferences) {
    const id = deterministicSourceUuid(
      "public-development-scripture-reference",
      `${sermon.slug}:${item.displayOrder}`
    );
    const reviewed = item.reviewStatus === "confirmed";
    await client.query(`INSERT INTO scripture_references (
        id, sermon_id, display_text, canonical_book_id, start_chapter, start_verse,
        end_chapter, end_verse, display_order, parse_status, relationship_role,
        is_lead, provenance, review_status, reviewer_subject, reviewed_at, parser_version
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        CASE WHEN $4::smallint IS NULL THEN 'unparsed' ELSE 'curated' END,
        $10, $11, $12, $13, $14, $15, $16
      )`, [
      id,
      sermonId,
      item.displayText,
      item.canonicalBookId,
      item.startChapter,
      item.startVerse,
      item.endChapter,
      item.endVerse,
      item.displayOrder,
      item.relationshipRole,
      item.isLead,
      reviewed ? "administrator" : "legacy_import",
      item.reviewStatus,
      reviewed ? previewDatasetSyntheticSubject : null,
      reviewed ? lifecycleTimestamp : null,
      reviewed ? previewDatasetVersion : null
    ]);
  }
  for (const item of sermon.media) {
    const id = deterministicSourceUuid("public-development-media", `${sermon.slug}:${item.displayOrder}`);
    await client.query(`INSERT INTO sermon_media (
        id, sermon_id, media_type, provider, external_id, canonical_url, title,
        duration_seconds, is_primary, display_order, availability_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
      id, sermonId, item.mediaType, item.provider, item.externalId, item.canonicalUrl,
      item.title, item.durationSeconds, item.isPrimary, item.displayOrder, item.availabilityStatus
    ]);
  }
  await client.query(`INSERT INTO sermon_transcripts (
      sermon_id, body_text, status, source_kind, reviewed_by_subject,
      approved_by_subject, reviewed_at, approved_at
    ) VALUES ($1, $2, 'approved', 'imported', $3, $3, $4, $4)`, [
    sermonId, sermon.transcript, previewDatasetSyntheticSubject, lifecycleTimestamp
  ]);
  for (const item of sermon.questionAnswers) {
    const id = deterministicSourceUuid("public-development-question-answer", `${sermon.slug}:${item.displayOrder}`);
    await client.query(`INSERT INTO sermon_question_answers (
        id, sermon_id, question_text, answer_text, display_order, status, source_kind,
        reviewed_by_subject, approved_by_subject, reviewed_at, approved_at
      ) VALUES ($1, $2, $3, $4, $5, 'approved', 'imported', $6, $6, $7, $7)`, [
      id,
      sermonId,
      item.question,
      item.answer,
      item.displayOrder,
      previewDatasetSyntheticSubject,
      lifecycleTimestamp
    ]);
  }
  await client.query(`UPDATE sermons sermon SET search_terms = concat_ws(' ',
      $2::text,
      (SELECT string_agg(item.name, ' ' ORDER BY map.display_order, item.id)
       FROM sermon_series_map map JOIN series item ON item.id = map.series_id
       WHERE map.sermon_id = sermon.id),
      (SELECT string_agg(reference.display_text, ' ' ORDER BY reference.display_order, reference.id)
       FROM scripture_references reference WHERE reference.sermon_id = sermon.id),
      (SELECT string_agg(item.name, ' ' ORDER BY map.display_order, item.id)
       FROM sermon_book_classifications map
       JOIN book_classifications item ON item.id = map.book_classification_id
       WHERE map.sermon_id = sermon.id)
    ) WHERE sermon.id = $1`, [sermonId, sermon.speaker.name]);
  await client.query("SELECT refresh_sermon_enrichment($1)", [sermonId]);
}

async function verifyImportedState(client: PoolClient, dataset: PreviewSermonDataset) {
  const { dataset: stored, sourceStatuses } = await readPreviewDatasetRecords(
    client,
    { requireCompletedSourceReview: false }
  );
  if (serializePublicDataset(stored) !== serializePublicDataset(dataset)) {
    throw new Error("The stored development dataset does not match the tracked content byte-for-byte");
  }
  if ([...sourceStatuses.values()].some((value) => value !== previewDatasetSourceStatus)) {
    throw new Error("The stored development records do not have the exact private seed marker");
  }
  const expected = {
    transcripts: dataset.sermons.length,
    questionAnswers: dataset.sermons.reduce((count, sermon) => count + sermon.questionAnswers.length, 0),
    series: dataset.sermons.reduce((count, sermon) => count + sermon.series.length, 0),
    books: dataset.sermons.reduce((count, sermon) => count + sermon.bibleBooks.length, 0),
    terms: dataset.sermons.reduce((count, sermon) => count + sermon.passageTerms.length, 0),
    references: dataset.sermons.reduce((count, sermon) => count + sermon.scriptureReferences.length, 0),
    media: dataset.sermons.reduce((count, sermon) => count + sermon.media.length, 0),
    passageReviews: dataset.sermons.length
  };
  const shape = await client.query<{
    transcripts: number; question_answers: number; series: number; books: number;
    terms: number; references: number; media: number; passage_reviews: number;
    private_provenance: number; guided_reviews: number; audit_events: number;
    semantic_relationships: number; attribution_mismatches: number;
  }>(`SELECT
    (SELECT count(*)::integer FROM sermon_transcripts transcript
      JOIN sermons seed ON seed.id = transcript.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS transcripts,
    (SELECT count(*)::integer FROM sermon_question_answers qa
      JOIN sermons seed ON seed.id = qa.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS question_answers,
    (SELECT count(*)::integer FROM sermon_series_map map
      JOIN sermons seed ON seed.id = map.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS series,
    (SELECT count(*)::integer FROM sermon_book_classifications map
      JOIN sermons seed ON seed.id = map.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS books,
    (SELECT count(*)::integer FROM sermon_source_terms map
      JOIN sermons seed ON seed.id = map.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS terms,
    (SELECT count(*)::integer FROM scripture_references reference
      JOIN sermons seed ON seed.id = reference.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS references,
    (SELECT count(*)::integer FROM sermon_media item
      JOIN sermons seed ON seed.id = item.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS media,
    (SELECT count(*)::integer FROM sermon_primary_passage_reviews review
      JOIN sermons seed ON seed.id = review.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS passage_reviews,
    (SELECT count(*)::integer FROM sermon_enrichment_sources source
      JOIN sermons seed ON seed.id = source.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS private_provenance,
    (SELECT count(*)::integer FROM sermon_enrichment_reviews review
      JOIN sermons seed ON seed.id = review.sermon_id
      WHERE seed.slug = ANY($1::text[])) AS guided_reviews,
    (SELECT count(*)::integer FROM audit_events audit
      JOIN sermons seed ON seed.id = audit.entity_id
      WHERE seed.slug = ANY($1::text[])) AS audit_events,
    (SELECT count(*)::integer FROM description_semantic_relationships relationship
      JOIN sermons seed ON seed.id = relationship.source_sermon_id
      WHERE seed.slug = ANY($1::text[])) AS semantic_relationships,
    (
      (SELECT count(*) FROM sermons seed WHERE seed.slug = ANY($1::text[]) AND (
        seed.summary_status <> 'approved'
        OR seed.summary_reviewed_by_subject IS DISTINCT FROM $2
        OR seed.summary_approved_by_subject IS DISTINCT FROM $2
      ))
      + (SELECT count(*) FROM sermon_transcripts transcript JOIN sermons seed ON seed.id = transcript.sermon_id
        WHERE seed.slug = ANY($1::text[]) AND (
          transcript.status <> 'approved'
          OR transcript.reviewed_by_subject IS DISTINCT FROM $2
          OR transcript.approved_by_subject IS DISTINCT FROM $2
        ))
      + (SELECT count(*) FROM sermon_question_answers qa JOIN sermons seed ON seed.id = qa.sermon_id
        WHERE seed.slug = ANY($1::text[]) AND (
          qa.status <> 'approved'
          OR qa.reviewed_by_subject IS DISTINCT FROM $2
          OR qa.approved_by_subject IS DISTINCT FROM $2
        ))
      + (SELECT count(*) FROM sermon_primary_passage_reviews review JOIN sermons seed ON seed.id = review.sermon_id
        WHERE seed.slug = ANY($1::text[]) AND review.reviewed_by_subject IS DISTINCT FROM $2)
      + (SELECT count(*) FROM scripture_references reference JOIN sermons seed ON seed.id = reference.sermon_id
        WHERE seed.slug = ANY($1::text[]) AND (
          (reference.review_status = 'confirmed' AND reference.reviewer_subject IS DISTINCT FROM $2)
          OR (reference.review_status = 'unreviewed' AND reference.reviewer_subject IS NOT NULL)
        ))
    )::integer AS attribution_mismatches`, [previewDatasetAllowedSlugs, previewDatasetSyntheticSubject]);
  const storedShape = shape.rows[0];
  if (!storedShape ||
      storedShape.transcripts !== expected.transcripts ||
      storedShape.question_answers !== expected.questionAnswers ||
      storedShape.series !== expected.series ||
      storedShape.books !== expected.books ||
      storedShape.terms !== expected.terms ||
      storedShape.references !== expected.references ||
      storedShape.media !== expected.media ||
      storedShape.passage_reviews !== expected.passageReviews ||
      storedShape.private_provenance !== 0 || storedShape.guided_reviews !== 0 ||
      storedShape.audit_events !== 0 || storedShape.semantic_relationships !== 0 ||
      storedShape.attribution_mismatches !== 0) {
    throw new Error("The stored development dataset has unexpected relationships or private provenance");
  }
  const visibility = await client.query<{
    public_eligible: number; preview_eligible: number; semantic_eligible: number;
  }>(`SELECT
    (SELECT count(*)::integer FROM sermons s
      WHERE s.slug = ANY($1::text[]) AND ${frontendSermonEligibilitySql("s", "public")}) AS public_eligible,
    (SELECT count(*)::integer FROM sermons s
      WHERE s.slug = ANY($1::text[]) AND ${frontendSermonEligibilitySql("s", "completed_preview")}) AS preview_eligible,
    (SELECT count(*)::integer FROM sermon_description_semantic_eligibility semantic
      JOIN sermons s ON s.id = semantic.sermon_id WHERE s.slug = ANY($1::text[])) AS semantic_eligible`, [
    previewDatasetAllowedSlugs
  ]);
  const row = visibility.rows[0];
  if (!row || row.public_eligible !== 0 ||
      row.preview_eligible !== previewDatasetAllowedSlugs.length || row.semantic_eligible !== 0) {
    throw new Error("The imported development dataset failed its preview/public/semantic isolation checks");
  }
  return row;
}

export async function importTrackedPreviewDataset(
  pool: Pool,
  options: PreviewDatasetImportOptions
): Promise<PreviewDatasetImportResult> {
  const expectedName = expectedDatabaseName(options);
  const tracked = await loadTrackedPreviewDataset();
  const questionAnswers = tracked.dataset.sermons.reduce(
    (count, sermon) => count + sermon.questionAnswers.length,
    0
  );
  const client = await pool.connect();
  let outcome: PreviewDatasetImportResult["outcome"] = "unchanged";
  try {
    await client.query("BEGIN");
    await verifyTarget(client, expectedName);
    await client.query("SELECT pg_advisory_xact_lock($1)", [1_397_047_177]);
    const existing = await client.query<{ slug: string; id: string; source_status: string | null }>(
      `SELECT slug, id, source_status FROM sermons WHERE slug = ANY($1::text[]) ORDER BY slug`,
      [previewDatasetAllowedSlugs]
    );
    if (existing.rows.length !== 0 && existing.rows.length !== previewDatasetAllowedSlugs.length) {
      throw new Error("The target contains a partial development dataset; no-clobber import refused it");
    }
    if (existing.rows.length === previewDatasetAllowedSlugs.length) {
      for (const row of existing.rows) {
        const expectedId = deterministicSourceUuid("public-development-sermon", row.slug);
        if (row.id !== expectedId || row.source_status !== previewDatasetSourceStatus) {
          throw new Error("An authorised development slug already belongs to non-seed local data");
        }
      }
      await verifyImportedState(client, tracked.dataset);
    } else {
      for (const sermon of tracked.dataset.sermons) await insertSermon(client, sermon);
      const state = await verifyImportedState(client, tracked.dataset);
      if (state.public_eligible !== 0 || state.semantic_eligible !== 0) {
        throw new Error("Development dataset import unexpectedly created public or semantic eligibility");
      }
      outcome = "imported";
    }
    await client.query("COMMIT");
    const state = await verifyImportedState(client, tracked.dataset);
    return {
      outcome,
      sermons: tracked.dataset.sermons.length,
      questionAnswers,
      publicEligible: state.public_eligible,
      previewEligible: state.preview_eligible,
      semanticEligible: state.semantic_eligible,
      contentSha256: tracked.contentSha256,
      manifestSha256: tracked.manifestSha256
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

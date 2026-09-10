import type { Pool, PoolClient } from "pg";
import { resolveExplicitPassage } from "../domain/primary-book-resolution";
import { deterministicSourceUuid } from "./identity";
import { resolveCanonicalBibleBook } from "./reference-catalogue";
import type {
  ImportedSermon,
  LegacyTerm,
  MigrationDryRunResult,
  PrivateMigrationSourceAudit
} from "./types";

async function upsertSpeaker(client: PoolClient, term: LegacyTerm): Promise<string> {
  const existing = await client.query<{
    id: string;
    name: string;
    slug: string;
    source_term_id: string | null;
    source_term_taxonomy_id: string | null;
  }>(
    `SELECT id, name, slug, source_term_id, source_term_taxonomy_id
     FROM speakers
     WHERE source_term_taxonomy_id = $1 OR slug = $2 OR lower(trim(name)) = lower(trim($3))
     ORDER BY CASE WHEN source_term_taxonomy_id = $1 THEN 0 ELSE 1 END, id`,
    [term.termTaxonomyId, term.slug, term.name]
  );
  if (existing.rows.length > 0) {
    const exact = existing.rows.find((row) =>
      row.slug === term.slug && row.name.trim().toLocaleLowerCase("en-AU") === term.name.trim().toLocaleLowerCase("en-AU")
    );
    if (!exact || existing.rows.some((row) => row.id !== exact.id)) {
      throw new Error("A speaker source mapping conflicts with an existing catalogue identity.");
    }
    if (
      (exact.source_term_id !== null && Number(exact.source_term_id) !== term.termId) ||
      (exact.source_term_taxonomy_id !== null && Number(exact.source_term_taxonomy_id) !== term.termTaxonomyId)
    ) {
      throw new Error("A speaker source mapping conflicts with existing provenance.");
    }
    await client.query(
      `UPDATE speakers
       SET source_term_id = $2, source_term_taxonomy_id = $3,
           updated_at = CASE
             WHEN source_term_id IS DISTINCT FROM $2 OR source_term_taxonomy_id IS DISTINCT FROM $3
             THEN now() ELSE updated_at END
       WHERE id = $1`,
      [exact.id, term.termId, term.termTaxonomyId]
    );
    return exact.id;
  }
  const id = deterministicSourceUuid("wordpress-speaker", term.termTaxonomyId);
  await client.query(
    `INSERT INTO speakers (id, name, slug, source_term_id, source_term_taxonomy_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source_term_taxonomy_id) DO UPDATE
       SET name = EXCLUDED.name, slug = EXCLUDED.slug, updated_at = now()`,
    [id, term.name, term.slug, term.termId, term.termTaxonomyId]
  );
  return id;
}

async function upsertSeries(client: PoolClient, term: LegacyTerm): Promise<string> {
  const id = deterministicSourceUuid("wordpress-series", term.termTaxonomyId);
  await client.query(
    `INSERT INTO series (id, name, slug, source_term_id, source_term_taxonomy_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source_term_taxonomy_id) DO UPDATE
       SET name = EXCLUDED.name, slug = EXCLUDED.slug, updated_at = now()`,
    [id, term.name, term.slug, term.termId, term.termTaxonomyId]
  );
  return id;
}

async function upsertBook(client: PoolClient, term: LegacyTerm): Promise<string> {
  const canonical = resolveCanonicalBibleBook(term.name) ?? resolveCanonicalBibleBook(term.slug);
  if (canonical) {
    const seeded = await client.query<{ present: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM bible_books book
         JOIN book_classifications classification
           ON classification.canonical_book_id = book.id
         WHERE book.id = $1
           AND book.canonical_name = $2
           AND book.slug = $3
           AND classification.id = $4
           AND classification.name = $2
           AND classification.slug = $3
           AND classification.classification_type = 'canonical'
           AND classification.review_status = 'approved'
       ) AS present`,
      [canonical.id, canonical.canonicalName, canonical.slug, canonical.classificationId]
    );
    if (seeded.rows[0]?.present) {
      const mapped = await client.query(
        `UPDATE book_classifications
         SET source_term_id = $2,
             source_term_taxonomy_id = $3,
             updated_at = CASE
               WHEN source_term_id IS DISTINCT FROM $2
                 OR source_term_taxonomy_id IS DISTINCT FROM $3
               THEN now()
               ELSE updated_at
             END
         WHERE id = $1
           AND (source_term_id IS NULL OR source_term_id = $2)
           AND (source_term_taxonomy_id IS NULL OR source_term_taxonomy_id = $3)`,
        [canonical.classificationId, term.termId, term.termTaxonomyId]
      );
      if (mapped.rowCount !== 1) {
        throw new Error("A canonical Bible-book source mapping conflicts with existing provenance.");
      }
      return canonical.classificationId;
    }
  }
  const id = deterministicSourceUuid("wordpress-book", term.termTaxonomyId);
  const classificationType = term.name.trim().toLowerCase() === "selected text"
    ? "selected_text"
    : "source";
  await client.query(
    `INSERT INTO book_classifications (
       id, name, slug, classification_type, source_term_id, source_term_taxonomy_id
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source_term_taxonomy_id) DO UPDATE
       SET name = EXCLUDED.name, slug = EXCLUDED.slug,
           classification_type = EXCLUDED.classification_type, updated_at = now()`,
    [id, term.name, term.slug, classificationType, term.termId, term.termTaxonomyId]
  );
  return id;
}

async function upsertPassageTerm(client: PoolClient, term: LegacyTerm): Promise<string> {
  const id = deterministicSourceUuid("wordpress-passage-term", term.termTaxonomyId);
  await client.query(
    `INSERT INTO source_taxonomy_terms (
       id, source_system, taxonomy, source_term_id, source_term_taxonomy_id,
       name, slug, source_order
     ) VALUES ($1, 'wordpress', 'sermon_topics', $2, $3, $4, $5, $6)
     ON CONFLICT (source_system, taxonomy, source_term_taxonomy_id) DO UPDATE
       SET name = EXCLUDED.name, slug = EXCLUDED.slug,
           source_order = EXCLUDED.source_order, updated_at = now()`,
    [id, term.termId, term.termTaxonomyId, term.name, term.slug, term.order]
  );
  return id;
}

async function upsertSermon(
  client: PoolClient,
  sermon: ImportedSermon,
  privateAudit: PrivateMigrationSourceAudit | undefined,
  forcePrivateDraft = false
): Promise<void> {
  // Editorial ownership wins over old source snapshots. Fail the entire import
  // before replacing any relationships, rather than silently restoring a title.
  const currentTitle = await client.query<{ title: string; protected: boolean }>(
    `SELECT s.title, (s.updated_by_subject IS NOT NULL OR EXISTS (
       SELECT 1 FROM audit_events a WHERE a.entity_id=s.id AND a.entity_type='sermon'
       AND a.outcome='succeeded' AND a.changed_fields ? 'title'
     )) AS protected FROM sermons s WHERE s.source_wordpress_id=$1 FOR UPDATE`,
    [sermon.sourceWordPressId]
  );
  if (currentTitle.rows.some((row) => row.protected && row.title !== sermon.title)) {
    throw new Error("A source import cannot overwrite an editorially owned sermon title.");
  }
  const protectedPassage = await client.query(`SELECT 1 FROM sermons s WHERE s.source_wordpress_id=$1 AND (
    EXISTS(SELECT 1 FROM sermon_primary_passage_reviews p WHERE p.sermon_id=s.id) OR
    EXISTS(SELECT 1 FROM scripture_references r WHERE r.sermon_id=s.id AND (r.provenance<>'legacy_import' OR r.review_status<>'unreviewed')) OR
    EXISTS(SELECT 1 FROM audit_events a WHERE a.entity_id=s.id AND a.outcome='succeeded'
      AND (a.changed_fields ? 'bookClassificationIds' OR a.changed_fields ? 'primaryPassageReview')))`, [sermon.sourceWordPressId]);
  if (protectedPassage.rowCount) throw new Error("A source import cannot replace editorially owned passage relationships.");
  const speakerId = sermon.speaker ? await upsertSpeaker(client, sermon.speaker) : null;
  await client.query(
    `INSERT INTO sermons (
       id, title, slug, summary, summary_status, summary_source_kind,
       summary_created_at, summary_updated_at, body, status, service_date, published_at,
       source_wordpress_id, source_status, source_created_local, source_created_gmt,
       source_modified_local, source_modified_gmt, speaker_id, historical_backfill_required
     ) VALUES (
       $1, $2, $3, $4,
       CASE WHEN $4::text IS NULL THEN 'missing' ELSE 'draft' END,
       'imported',
       CASE WHEN $4::text IS NULL THEN NULL ELSE now() END,
       CASE WHEN $4::text IS NULL THEN NULL ELSE now() END,
       $5, $6, $7::date, $8::timestamptz,
       $9, $10, $11::timestamp, $12::timestamptz, $13::timestamp, $14::timestamptz,
       $15, true
     )
     ON CONFLICT (source_wordpress_id) DO UPDATE SET
       title = EXCLUDED.title, slug = EXCLUDED.slug,
       summary = CASE
         WHEN sermons.summary_status = 'approved' THEN sermons.summary
         WHEN sermons.summary_status = 'missing' AND EXCLUDED.summary IS NOT NULL THEN EXCLUDED.summary
         ELSE sermons.summary
       END,
       summary_status = CASE
         WHEN sermons.summary_status = 'missing' AND EXCLUDED.summary IS NOT NULL THEN 'draft'
         ELSE sermons.summary_status
       END,
       summary_source_kind = CASE
         WHEN sermons.summary_status = 'missing' AND EXCLUDED.summary IS NOT NULL THEN 'imported'
         ELSE sermons.summary_source_kind
       END,
       summary_created_at = CASE
         WHEN sermons.summary_status = 'missing' AND EXCLUDED.summary IS NOT NULL THEN now()
         ELSE sermons.summary_created_at
       END,
       summary_updated_at = CASE
         WHEN sermons.summary_status = 'missing' AND EXCLUDED.summary IS NOT NULL THEN now()
         ELSE sermons.summary_updated_at
       END,
       body = EXCLUDED.body, status = EXCLUDED.status, service_date = EXCLUDED.service_date,
       published_at = EXCLUDED.published_at, source_status = EXCLUDED.source_status,
       source_created_local = EXCLUDED.source_created_local,
       source_created_gmt = EXCLUDED.source_created_gmt,
       source_modified_local = EXCLUDED.source_modified_local,
       source_modified_gmt = EXCLUDED.source_modified_gmt,
       speaker_id = EXCLUDED.speaker_id,
       historical_backfill_required = true,
       updated_at = now(), row_version = sermons.row_version + 1
     WHERE (
       sermons.title, sermons.slug, sermons.body, sermons.status,
       sermons.service_date, sermons.published_at, sermons.source_status,
       sermons.source_created_local, sermons.source_created_gmt,
       sermons.source_modified_local, sermons.source_modified_gmt, sermons.speaker_id
     ) IS DISTINCT FROM (
       EXCLUDED.title, EXCLUDED.slug, EXCLUDED.body, EXCLUDED.status,
       EXCLUDED.service_date, EXCLUDED.published_at, EXCLUDED.source_status,
       EXCLUDED.source_created_local, EXCLUDED.source_created_gmt,
       EXCLUDED.source_modified_local, EXCLUDED.source_modified_gmt, EXCLUDED.speaker_id
     ) OR (
       sermons.summary_status = 'missing' AND EXCLUDED.summary IS NOT NULL
     )`,
    [
      sermon.id,
      sermon.title,
      sermon.slug,
      sermon.summary,
      sermon.body,
      forcePrivateDraft ? "draft" : sermon.status,
      sermon.serviceDate,
      forcePrivateDraft ? null : sermon.publishedAt,
      sermon.sourceWordPressId,
      sermon.sourceStatus,
      sermon.sourceCreatedLocal,
      sermon.sourceCreatedGmt,
      sermon.sourceModifiedLocal,
      sermon.sourceModifiedGmt,
      speakerId
    ]
  );

  // The fixture/source record is authoritative for its owned relationships.
  // Clear only this target sermon's replaceable child sets before rebuilding
  // them, so a changed rerun cannot leave stale taxonomy or media rows behind.
  for (const table of [
    "sermon_series_map",
    "sermon_book_classifications",
    "sermon_source_terms",
    "scripture_references",
    "sermon_media"
  ]) {
    await client.query(`DELETE FROM ${table} WHERE sermon_id = $1`, [sermon.id]);
  }

  if (privateAudit?.legacyViewCount !== null && privateAudit?.legacyViewCount !== undefined) {
    await client.query(
      `INSERT INTO sermon_legacy_metrics (sermon_id, source_view_count)
       VALUES ($1, $2)
       ON CONFLICT (sermon_id) DO UPDATE
         SET source_view_count = EXCLUDED.source_view_count, captured_at = now()`,
      [sermon.id, privateAudit.legacyViewCount]
    );
  } else {
    await client.query("DELETE FROM sermon_legacy_metrics WHERE sermon_id = $1", [sermon.id]);
  }

  if (sermon.sourceSpeakerCount > 1) {
    const auditId = deterministicSourceUuid(
      "migration-speaker-anomaly-audit",
      sermon.sourceWordPressId
    );
    await client.query(
      `INSERT INTO audit_events (
         id, actor_subject, actor_role, action, entity_type, entity_id,
         changed_fields, request_correlation_id
       ) VALUES (
         $1, 'wordpress-importer', 'system', 'sermon.import_speaker_anomaly',
         'sermon', $2, '["speaker"]'::jsonb, $3
       )
       ON CONFLICT (id) DO NOTHING`,
      [auditId, sermon.id, `migration-speaker-anomaly-${sermon.sourceWordPressId}`]
    );
  }

  for (const [index, term] of sermon.series.entries()) {
    const seriesId = await upsertSeries(client, term);
    await client.query(
      `INSERT INTO sermon_series_map (sermon_id, series_id, display_order, is_primary)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (sermon_id, series_id) DO UPDATE
         SET display_order = EXCLUDED.display_order, is_primary = EXCLUDED.is_primary`,
      [sermon.id, seriesId, index, index === 0]
    );
  }

  for (const [index, term] of sermon.books.entries()) {
    const bookId = await upsertBook(client, term);
    await client.query(
      `INSERT INTO sermon_book_classifications (
         sermon_id, book_classification_id, display_order
       ) VALUES ($1, $2, $3)
       ON CONFLICT (sermon_id, book_classification_id) DO UPDATE
         SET display_order = EXCLUDED.display_order`,
      [sermon.id, bookId, index]
    );
  }

  for (const term of sermon.passageTerms) {
    const termId = await upsertPassageTerm(client, term);
    await client.query(
      `INSERT INTO sermon_source_terms (
         sermon_id, source_taxonomy_term_id, source_relationship_order
       ) VALUES ($1, $2, $3)
       ON CONFLICT (sermon_id, source_taxonomy_term_id) DO UPDATE
         SET source_relationship_order = EXCLUDED.source_relationship_order`,
      [sermon.id, termId, term.order]
    );
  }

  const parsedReferences = sermon.scriptureReferences.map(reference => resolveExplicitPassage(reference.displayText));
  const unambiguousPrimary = parsedReferences.length > 0 && parsedReferences.every(reference => reference !== null &&
    JSON.stringify(reference.passage) === JSON.stringify(parsedReferences[0]!.passage));
  for (const [referenceIndex, reference] of sermon.scriptureReferences.entries()) {
    const referenceId = deterministicSourceUuid(
      "wordpress-scripture-reference",
      `${sermon.sourceWordPressId}:${referenceIndex}`
    );
    await client.query(
      `INSERT INTO scripture_references (
         id, sermon_id, display_text, display_order, parse_status, canonical_book_id,
         start_chapter,start_verse,end_chapter,end_verse,relationship_role,is_lead
       ) VALUES ($1, $2, $3, $4, $5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (sermon_id, display_order) DO UPDATE
         SET display_text = EXCLUDED.display_text,
             parse_status = EXCLUDED.parse_status, updated_at = now()`,
      [referenceId, sermon.id, reference.displayText, referenceIndex, reference.parseStatus,
        parsedReferences[referenceIndex]?.passage.canonicalBookId ?? null,
        parsedReferences[referenceIndex]?.passage.startChapter ?? null,
        parsedReferences[referenceIndex]?.passage.startVerse ?? null,
        parsedReferences[referenceIndex]?.passage.endChapter ?? null,
        parsedReferences[referenceIndex]?.passage.endVerse ?? null,
        unambiguousPrimary && referenceIndex===0 ? 'primary' : 'unclassified', unambiguousPrimary && referenceIndex===0]
    );

    for (const [sourceIndex, source] of reference.sources.entries()) {
      const sourceId = deterministicSourceUuid(
        "wordpress-scripture-source",
        `${sermon.sourceWordPressId}:${referenceIndex}:${sourceIndex}`
      );
      await client.query(
        `INSERT INTO scripture_reference_sources (
           id, scripture_reference_id, sermon_id, source_kind, source_meta_key,
           source_term_id, source_term_taxonomy_id, original_value
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET original_value = EXCLUDED.original_value`,
        [
          sourceId,
          referenceId,
          sermon.id,
          source.kind,
          source.kind === "postmeta" ? "asp_sermon_bible_passage" : null,
          source.sourceTermId ?? null,
          source.sourceTermTaxonomyId ?? null,
          source.originalValue
        ]
      );
    }
  }

  for (const [mediaIndex, media] of sermon.media.entries()) {
    const mediaId = deterministicSourceUuid(
      "wordpress-sermon-media",
      `${sermon.sourceWordPressId}:${mediaIndex}`
    );
    await client.query(
      `INSERT INTO sermon_media (
         id, sermon_id, media_type, provider, external_id, canonical_url,
         title, is_primary, display_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (sermon_id, display_order) DO UPDATE SET
         media_type = EXCLUDED.media_type, provider = EXCLUDED.provider,
         external_id = EXCLUDED.external_id, canonical_url = EXCLUDED.canonical_url,
         title = EXCLUDED.title, is_primary = EXCLUDED.is_primary, updated_at = now()`,
      [
        mediaId,
        sermon.id,
        media.mediaType,
        media.provider,
        media.externalId,
        media.canonicalUrl,
        media.title,
        mediaIndex === 0,
        mediaIndex
      ]
    );

    const source = privateAudit?.mediaSources[mediaIndex];
    if (source) {
      const sourceId = deterministicSourceUuid(
        "wordpress-sermon-media-source",
        `${sermon.sourceWordPressId}:${mediaIndex}`
      );
      await client.query(
        `INSERT INTO sermon_media_source_audit (
           id, sermon_media_id, source_meta_key, original_value, source_value_sha256
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           original_value = EXCLUDED.original_value,
           source_value_sha256 = EXCLUDED.source_value_sha256`,
        [sourceId, mediaId, source.sourceMetaKey, source.originalValue, source.sourceValueSha256]
      );
    }
  }

  await client.query(
    `UPDATE sermons s SET search_terms = search.value
     FROM (SELECT concat_ws(' ',
       (SELECT sp.name FROM sermons source_sermon
        JOIN speakers sp ON sp.id = source_sermon.speaker_id
        WHERE source_sermon.id = $1),
       (SELECT string_agg(sr.name, ' ' ORDER BY sm.display_order, sr.id)
        FROM sermon_series_map sm JOIN series sr ON sr.id = sm.series_id
        WHERE sm.sermon_id = $1),
       (SELECT string_agg(ref.display_text, ' ' ORDER BY ref.display_order, ref.id)
        FROM scripture_references ref WHERE ref.sermon_id = $1),
       (SELECT string_agg(bc.name, ' ' ORDER BY sbc.display_order, bc.id)
        FROM sermon_book_classifications sbc
        JOIN book_classifications bc ON bc.id = sbc.book_classification_id
        WHERE sbc.sermon_id = $1)
     ) AS value) AS search
     WHERE s.id = $1 AND s.search_terms IS DISTINCT FROM search.value`,
    [sermon.id]
  );
  await client.query("SELECT refresh_sermon_enrichment($1)", [sermon.id]);
}

export async function loadMigrationResult(
  pool: Pool,
  result: MigrationDryRunResult,
  sourceSnapshotId = "anonymised-local-fixture",
  options: { forcePrivateDraft?: boolean } = {}
): Promise<{ runId: string; imported: number }> {
  const client = await pool.connect();
  const runId = deterministicSourceUuid("migration-run", sourceSnapshotId);
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO migration_runs (
         id, migration_version, source_snapshot_id, dry_run, status, summary
       ) VALUES ($1, '0004', $2, false, 'running', $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         status = 'running', completed_at = NULL, summary = EXCLUDED.summary`,
      [runId, sourceSnapshotId, JSON.stringify(result.summary)]
    );

    const audits = new Map(
      result.privateSourceAudit.map((audit) => [audit.targetSermonId, audit])
    );
    for (const sermon of result.candidates) {
      await upsertSermon(client, sermon, audits.get(sermon.id), options.forcePrivateDraft === true);
    }

    for (const record of result.records) {
      const candidate = result.candidates.find(
        (sermon) => sermon.sourceWordPressId === record.sourceId
      );
      const recordId = deterministicSourceUuid(
        "migration-record",
        `${runId}:${record.sourceTable}:${record.sourceId}`
      );
      await client.query(
        `INSERT INTO migration_records (
           id, migration_run_id, source_system, source_entity_type, source_id,
           source_status, source_checksum_sha256, target_entity_type, target_id,
           outcome, reason_code
         ) VALUES ($1, $2, 'wordpress', $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (migration_run_id, source_system, source_entity_type, source_id)
         DO UPDATE SET outcome = EXCLUDED.outcome, reason_code = EXCLUDED.reason_code,
                       target_id = EXCLUDED.target_id`,
        [
          recordId,
          runId,
          record.sourceTable,
          String(record.sourceId),
          record.sourceStatus,
          candidate?.sourceChecksumSha256 ?? null,
          candidate ? "sermon" : null,
          candidate?.id ?? null,
          record.outcome,
          record.reasonCode
        ]
      );

      await client.query("DELETE FROM migration_warnings WHERE migration_record_id = $1", [
        recordId
      ]);

      for (const [warningIndex, warning] of record.warnings.entries()) {
        const warningId = deterministicSourceUuid(
          "migration-warning",
          `${recordId}:${warningIndex}:${warning.code}`
        );
        await client.query(
          `INSERT INTO migration_warnings (
             id, migration_record_id, code, severity, field_name, safe_detail
           ) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             severity = EXCLUDED.severity,
             field_name = EXCLUDED.field_name,
             safe_detail = EXCLUDED.safe_detail`,
          [
            warningId,
            recordId,
            warning.code,
            warning.severity,
            warning.field ?? null,
            warning.safeDetail
          ]
        );
      }
    }

    await client.query(
      `UPDATE migration_runs
       SET status = 'succeeded', completed_at = now(), summary = $2::jsonb
       WHERE id = $1`,
      [runId, JSON.stringify(result.summary)]
    );
    await client.query("COMMIT");
    return { runId, imported: result.candidates.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

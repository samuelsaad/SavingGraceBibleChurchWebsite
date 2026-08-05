import type { Pool, PoolClient } from "pg";
import { deterministicSourceUuid } from "./identity";
import type {
  ImportedSermon,
  LegacyTerm,
  MigrationDryRunResult,
  PrivateMigrationSourceAudit
} from "./types";

async function upsertSpeaker(client: PoolClient, term: LegacyTerm): Promise<string> {
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
  privateAudit: PrivateMigrationSourceAudit | undefined
): Promise<void> {
  await client.query(
    `INSERT INTO sermons (
       id, title, slug, summary, body, status, service_date, published_at,
       source_wordpress_id, source_status, source_created_local, source_created_gmt,
       source_modified_local, source_modified_gmt
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7::date, $8::timestamptz,
       $9, $10, $11::timestamp, $12::timestamptz, $13::timestamp, $14::timestamptz
     )
     ON CONFLICT (source_wordpress_id) DO UPDATE SET
       title = EXCLUDED.title, slug = EXCLUDED.slug, summary = EXCLUDED.summary,
       body = EXCLUDED.body, status = EXCLUDED.status, service_date = EXCLUDED.service_date,
       published_at = EXCLUDED.published_at, source_status = EXCLUDED.source_status,
       source_created_local = EXCLUDED.source_created_local,
       source_created_gmt = EXCLUDED.source_created_gmt,
       source_modified_local = EXCLUDED.source_modified_local,
       source_modified_gmt = EXCLUDED.source_modified_gmt,
       updated_at = now(), row_version = sermons.row_version + 1
     WHERE (
       sermons.title, sermons.slug, sermons.summary, sermons.body, sermons.status,
       sermons.service_date, sermons.published_at, sermons.source_status,
       sermons.source_created_local, sermons.source_created_gmt,
       sermons.source_modified_local, sermons.source_modified_gmt
     ) IS DISTINCT FROM (
       EXCLUDED.title, EXCLUDED.slug, EXCLUDED.summary, EXCLUDED.body, EXCLUDED.status,
       EXCLUDED.service_date, EXCLUDED.published_at, EXCLUDED.source_status,
       EXCLUDED.source_created_local, EXCLUDED.source_created_gmt,
       EXCLUDED.source_modified_local, EXCLUDED.source_modified_gmt
     )`,
    [
      sermon.id,
      sermon.title,
      sermon.slug,
      sermon.summary,
      sermon.body,
      sermon.status,
      sermon.serviceDate,
      sermon.publishedAt,
      sermon.sourceWordPressId,
      sermon.sourceStatus,
      sermon.sourceCreatedLocal,
      sermon.sourceCreatedGmt,
      sermon.sourceModifiedLocal,
      sermon.sourceModifiedGmt
    ]
  );

  // The fixture/source record is authoritative for its owned relationships.
  // Clear only this target sermon's replaceable child sets before rebuilding
  // them, so a changed rerun cannot leave stale taxonomy or media rows behind.
  for (const table of [
    "sermon_speakers",
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

  for (const [index, term] of sermon.speakers.entries()) {
    const speakerId = await upsertSpeaker(client, term);
    await client.query(
      `INSERT INTO sermon_speakers (sermon_id, speaker_id, display_order, is_primary)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (sermon_id, speaker_id) DO UPDATE
         SET display_order = EXCLUDED.display_order, is_primary = EXCLUDED.is_primary`,
      [sermon.id, speakerId, index, index === 0]
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

  for (const [referenceIndex, reference] of sermon.scriptureReferences.entries()) {
    const referenceId = deterministicSourceUuid(
      "wordpress-scripture-reference",
      `${sermon.sourceWordPressId}:${referenceIndex}`
    );
    await client.query(
      `INSERT INTO scripture_references (
         id, sermon_id, display_text, display_order, parse_status
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sermon_id, display_order) DO UPDATE
         SET display_text = EXCLUDED.display_text,
             parse_status = EXCLUDED.parse_status, updated_at = now()`,
      [referenceId, sermon.id, reference.displayText, referenceIndex, reference.parseStatus]
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
       (SELECT string_agg(sp.name, ' ' ORDER BY ss.display_order, sp.id)
        FROM sermon_speakers ss JOIN speakers sp ON sp.id = ss.speaker_id
        WHERE ss.sermon_id = $1),
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
}

export async function loadMigrationResult(
  pool: Pool,
  result: MigrationDryRunResult,
  sourceSnapshotId = "anonymised-local-fixture"
): Promise<{ runId: string; imported: number }> {
  const client = await pool.connect();
  const runId = deterministicSourceUuid("migration-run", sourceSnapshotId);
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO migration_runs (
         id, migration_version, source_snapshot_id, dry_run, status, summary
       ) VALUES ($1, '0001', $2, false, 'running', $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         status = 'running', completed_at = NULL, summary = EXCLUDED.summary`,
      [runId, sourceSnapshotId, JSON.stringify(result.summary)]
    );

    const audits = new Map(
      result.privateSourceAudit.map((audit) => [audit.targetSermonId, audit])
    );
    for (const sermon of result.candidates) {
      await upsertSermon(client, sermon, audits.get(sermon.id));
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

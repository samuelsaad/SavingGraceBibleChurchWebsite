import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { Pool, PoolClient } from "pg";
import { authorisedLocalDatabaseName } from "../migration/local-database-safety";
import { enrichmentDraftBundleSchema, type EnrichmentDraftBundle } from "./contracts";
import {
  phase3b2PilotManifestSchema,
  type Phase3b2PilotManifest,
  type Phase3b2SafeOutcome
} from "./pilot-contracts";
import {
  canonicalYouTubeIdentity,
  phase3b2ProcessingVersion,
  prepareExistingCaptionText
} from "./pilot-caption";
import { importEnrichmentDraftBundle } from "./postgres-enrichment";
import {
  PunctuationWorkflowError,
  assertSafeDirectory,
  ensureSafeDirectory,
  persistNoClobber,
  readSafeFile,
  resolveSafeDirectChild
} from "./pilot-punctuation";

const pilotActorSubject = "local-phase3b2-pilot-importer";
export const remainingAuthorisedPilotVideoId = "RAMFOAOWwMA" as const;

export function deterministicPilotUuid(videoId: string): string {
  const bytes = createHash("sha256").update(`saving-grace-phase3b2:${videoId}`, "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function pathInside(root: string, filename: string): string {
  return resolveSafeDirectChild(root, filename, "file", ".txt");
}

export async function verifyPilotDatabase(client: PoolClient): Promise<void> {
  const databaseName = authorisedLocalDatabaseName();
  const result = await client.query<{
    server_16: boolean;
    loopback: boolean;
    port_5432: boolean;
    target_database: boolean;
    postgres_server: boolean;
    provenance_table: boolean;
  }>(
    `SELECT
       current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
       inet_server_addr() = '127.0.0.1'::inet AS loopback,
       inet_server_port() = 5432 AS port_5432,
       current_database() = $1 AS target_database,
       version() LIKE 'PostgreSQL%' AS postgres_server,
       to_regclass('public.sermon_enrichment_sources') IS NOT NULL AS provenance_table`,
    [databaseName]
  );
  if (!Object.values(result.rows[0] ?? {}).every(Boolean)) {
    throw new PunctuationWorkflowError(
      "database_verification_failure",
      "Phase 3B.2 database identity or migration safety verification failed."
    );
  }
}

async function ensurePilotMigrationRecord(
  client: PoolClient,
  manifest: Phase3b2PilotManifest,
  record: Phase3b2PilotManifest["records"][number],
  sermonId: string,
  sourceSha256: string,
  canonicalUrl: string
): Promise<void> {
  const existingRun = await client.query<{ id: string }>(
    `SELECT id FROM migration_runs
     WHERE migration_version = 'phase3b2-pilot-v1'
       AND source_snapshot_id = $1
     ORDER BY started_at LIMIT 1`,
    [manifest.sourceSnapshotId]
  );
  let migrationRunId = existingRun.rows[0]?.id;
  if (!migrationRunId) {
    migrationRunId = (
      await client.query<{ id: string }>(
        `INSERT INTO migration_runs (
           migration_version, source_snapshot_id, dry_run, status, completed_at, summary
         ) VALUES ('phase3b2-pilot-v1', $1, false, 'succeeded', now(),
           '{"scope":"private_three_video_rehearsal"}'::jsonb)
         RETURNING id`,
        [manifest.sourceSnapshotId]
      )
    ).rows[0]!.id;
  }
  await client.query(
    `INSERT INTO migration_records (
       migration_run_id, source_system, source_entity_type, source_id,
       source_status, source_url, source_checksum_sha256,
       target_entity_type, target_id, outcome, reason_code
     ) VALUES ($1, 'phase3b2_pilot', 'private_caption', $2, 'draft', $3, $4,
       'sermon', $5, 'included', 'authorised_private_pilot')
     ON CONFLICT (migration_run_id, source_system, source_entity_type, source_id)
     DO NOTHING`,
    [migrationRunId, String(record.sourceWordPressId), canonicalUrl, sourceSha256, sermonId]
  );
  const exactRecord = await client.query<{ matches: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM migration_records
       WHERE migration_run_id = $1 AND source_system = 'phase3b2_pilot'
         AND source_entity_type = 'private_caption' AND source_id = $2
         AND source_status = 'draft' AND source_url = $3
         AND source_checksum_sha256 = $4 AND target_entity_type = 'sermon'
         AND target_id = $5 AND outcome = 'included'
         AND reason_code = 'authorised_private_pilot'
     ) AS matches`,
    [migrationRunId, String(record.sourceWordPressId), canonicalUrl, sourceSha256, sermonId]
  );
  if (!exactRecord.rows[0]?.matches) {
    throw new PunctuationWorkflowError(
      "persistence_conflict",
      "An existing private pilot migration receipt differs from the trusted source identity."
    );
  }
}

export async function ensurePrivatePilotSermon(
  pool: Pool,
  manifest: Phase3b2PilotManifest,
  record: Phase3b2PilotManifest["records"][number],
  sourceSha256: string,
  canonicalUrl: string
): Promise<{ id: string; rowVersion: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await verifyPilotDatabase(client);
    const sermonId = deterministicPilotUuid(record.videoId);
    const existing = await client.query<{
      id: string;
      row_version: number;
      source_status: string | null;
    }>(
      `SELECT id, row_version, source_status
       FROM sermons WHERE source_wordpress_id = $1 FOR UPDATE`,
      [record.sourceWordPressId]
    );
    const found = existing.rows[0];
    if (found && (found.id !== sermonId || found.source_status !== "phase3b2_pilot")) {
      throw new Error("Local pilot source identifier collides with a non-pilot sermon");
    }
    if (!found) {
      await client.query(
        `INSERT INTO sermons (
           id, title, slug, status, service_date, source_wordpress_id, source_status,
           historical_backfill_required, created_by_subject, updated_by_subject
         ) VALUES ($1, $2, $3, 'draft', $4::date, $5, 'phase3b2_pilot', true, $6, $6)`,
        [sermonId, record.title, record.slug, record.serviceDate, record.sourceWordPressId, pilotActorSubject]
      );
      await client.query(
        `INSERT INTO sermon_media (
           sermon_id, media_type, provider, external_id, canonical_url,
           title, is_primary, display_order, availability_status
         ) VALUES ($1, 'video', 'youtube', $2, $3, $4, true, 0, 'available')`,
        [sermonId, record.videoId, canonicalUrl, `${record.title} — private pilot source`]
      );
    } else {
      const identity = await client.query<{ matches: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM sermon_media
           WHERE sermon_id = $1 AND provider = 'youtube'
             AND external_id = $2 AND canonical_url = $3
         ) AS matches`,
        [sermonId, record.videoId, canonicalUrl]
      );
      if (!identity.rows[0]?.matches) {
        throw new Error("Existing private pilot sermon does not match the mapped YouTube identity");
      }
    }
    await ensurePilotMigrationRecord(client, manifest, record, sermonId, sourceSha256, canonicalUrl);
    const current = await client.query<{ row_version: number }>(
      "SELECT row_version FROM sermons WHERE id = $1",
      [sermonId]
    );
    await client.query("COMMIT");
    return { id: sermonId, rowVersion: current.rows[0]!.row_version };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function sourceReference(videoId: string, sha256: string, processingVersion = phase3b2ProcessingVersion): string {
  return `youtube-studio:${videoId}:${sha256}:${processingVersion}`;
}

async function initialiseZeroFindingReview(
  pool: Pool,
  sermonId: string,
  sourceRecordKey: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await verifyPilotDatabase(client);
    const state = await client.query<{
      transcript_sha256: string;
      transcript_row_version: number;
      item_count: number;
      unresolved_count: number;
      non_draft_content_count: number;
      existing_source_record_key: string | null;
    }>(
      `SELECT
         encode(digest(convert_to(transcript.body_text, 'UTF8'), 'sha256'), 'hex') AS transcript_sha256,
         transcript.row_version AS transcript_row_version,
         (SELECT count(*)::integer FROM sermon_enrichment_review_items item
          WHERE item.sermon_id = sermon.id) AS item_count,
         jsonb_array_length(source.unresolved_passages) AS unresolved_count,
         (CASE WHEN sermon.summary_status = 'draft' THEN 0 ELSE 1 END
          + CASE WHEN transcript.status = 'draft' THEN 0 ELSE 1 END
          + (SELECT count(*)::integer FROM sermon_question_answers qa
             WHERE qa.sermon_id = sermon.id AND qa.status <> 'draft')) AS non_draft_content_count,
         review.source_record_key AS existing_source_record_key
       FROM sermons sermon
       JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
       JOIN sermon_enrichment_sources source ON source.sermon_id = sermon.id
       JOIN sermon_enrichment_reviews review ON review.sermon_id = sermon.id
       WHERE sermon.id = $1 AND sermon.status = 'draft'
       FOR UPDATE OF sermon, transcript, review`,
      [sermonId]
    );
    const row = state.rows[0];
    if (
      !row ||
      row.item_count !== 0 ||
      row.unresolved_count !== 0 ||
      row.non_draft_content_count !== 0 ||
      (row.existing_source_record_key !== null && row.existing_source_record_key !== sourceRecordKey)
    ) {
      throw new PunctuationWorkflowError(
        "persistence_conflict",
        "The remaining pilot cannot be represented as a zero-finding private draft without changing existing review state."
      );
    }
    await client.query(
      `UPDATE sermon_enrichment_reviews
       SET source_record_key = $2,
           expected_item_count = 0,
           expected_item_set_sha256 = encode(digest(convert_to('', 'UTF8'), 'sha256'), 'hex'),
           expected_transcript_sha256 = $3,
           expected_transcript_row_version = $4,
           atomic_schema_version = 1,
           updated_at = now(),
           updated_by_subject = $5,
           row_version = row_version + 1
       WHERE sermon_id = $1
         AND (
           source_record_key IS DISTINCT FROM $2
           OR expected_item_count IS DISTINCT FROM 0
           OR expected_item_set_sha256 IS DISTINCT FROM encode(digest(convert_to('', 'UTF8'), 'sha256'), 'hex')
           OR expected_transcript_sha256 IS DISTINCT FROM $3
           OR expected_transcript_row_version IS DISTINCT FROM $4
           OR atomic_schema_version IS DISTINCT FROM 1
         )`,
      [sermonId, sourceRecordKey, row.transcript_sha256, row.transcript_row_version, pilotActorSubject]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function existingOrWriteBundle(
  bundlePath: string,
  candidate: EnrichmentDraftBundle
): Promise<EnrichmentDraftBundle> {
  try {
    const existingBytes = await readSafeFile(bundlePath);
    let existing: EnrichmentDraftBundle;
    try {
      existing = enrichmentDraftBundleSchema.parse(JSON.parse(existingBytes.toString("utf8")));
    } catch (error) {
      throw new PunctuationWorkflowError(
        "persistence_conflict",
        "An existing private pilot bundle is corrupt or does not match the required schema.",
        { cause: error }
      );
    }
    if (
      existing.schemaVersion !== 3 ||
      candidate.schemaVersion !== 3 ||
      existing.sourceProvenance.videoId !== candidate.sourceProvenance.videoId ||
      existing.sourceProvenance.sourceContentSha256 !== candidate.sourceProvenance.sourceContentSha256 ||
      existing.targetSermonId !== candidate.targetSermonId ||
      existing.sourceWordPressId !== candidate.sourceWordPressId ||
      existing.description.bodyText !== candidate.description.bodyText ||
      existing.transcript.bodyText !== candidate.transcript.bodyText ||
      JSON.stringify(existing.questionAnswers) !== JSON.stringify(candidate.questionAnswers) ||
      JSON.stringify(existing.sourceProvenance.warnings) !== JSON.stringify(candidate.sourceProvenance.warnings) ||
      JSON.stringify(existing.sourceProvenance.unresolvedPassages) !==
        JSON.stringify(candidate.sourceProvenance.unresolvedPassages)
    ) {
      throw new PunctuationWorkflowError(
        "persistence_conflict",
        "An existing private pilot bundle differs from the expected mapped source and drafts."
      );
    }
    const byteComparableCandidate = enrichmentDraftBundleSchema.parse({
      ...candidate,
      expectedRowVersion: existing.expectedRowVersion,
      sourceProvenance: {
        ...candidate.sourceProvenance,
        importedAt: existing.sourceProvenance.importedAt,
        processedAt: existing.sourceProvenance.processedAt,
        processingDurationMs: existing.sourceProvenance.processingDurationMs
      }
    });
    const expectedBytes = Buffer.from(`${JSON.stringify(byteComparableCandidate, null, 2)}\n`, "utf8");
    if (!existingBytes.equals(expectedBytes)) {
      throw new PunctuationWorkflowError(
        "persistence_conflict",
        "An existing private pilot bundle is not byte-for-byte identical to the expected artifact."
      );
    }
    return existing;
  } catch (error) {
    if (!(error instanceof PunctuationWorkflowError && error.code === "missing_input")) throw error;
    await persistNoClobber(bundlePath, `${JSON.stringify(candidate, null, 2)}\n`);
    return candidate;
  }
}

async function runPhase3b2PilotRecords(
  pool: Pool,
  pilotRootInput: string,
  manifestInput: unknown,
  exactVideoId: string | null
): Promise<Phase3b2SafeOutcome[]> {
  const manifest = phase3b2PilotManifestSchema.parse(manifestInput);
  const pilotRoot = resolve(pilotRootInput);
  await assertSafeDirectory(pilotRoot);
  const preparedRoot = resolveSafeDirectChild(pilotRoot, "prepared-private", "directory");
  await ensureSafeDirectory(preparedRoot);
  const outcomes: Phase3b2SafeOutcome[] = [];

  const selectedRecords = manifest.records
    .map((record, recordIndex) => ({ record, recordIndex }))
    .filter(({ record }) => exactVideoId === null || record.videoId === exactVideoId);
  if (exactVideoId !== null && selectedRecords.length !== 1) {
    throw new PunctuationWorkflowError(
      "persistence_conflict",
      "The trusted private manifest does not contain exactly the authorised restoration identity."
    );
  }

  for (const { record, recordIndex } of selectedRecords) {
    const started = performance.now();
    const identity = canonicalYouTubeIdentity(record.videoUrl, manifest.allowlistedVideoIds);
    if (identity.videoId !== record.videoId) {
      throw new Error(`Explicit mapping mismatch for private pilot video ID ${record.videoId}`);
    }
    const captionPath = pathInside(pilotRoot, record.captionFilename);
    let captionBytes: Buffer;
    try {
      captionBytes = await readSafeFile(captionPath);
    } catch (error) {
      if (!(error instanceof PunctuationWorkflowError && error.code === "missing_input")) throw error;
      outcomes.push({
        videoId: record.videoId,
        captionSupplied: false,
        captionLanguage: record.captionLanguage,
        captionTrackType: record.captionTrackType,
        sourceCharacterCount: 0,
        cleanedCharacterCount: null,
        apparentCompleteness: "unusable",
        uncertaintyMarkerCount: 0,
        warningCodes: ["caption_file_missing"],
        descriptionDraftProduced: false,
        questionAnswerCount: 0,
        importedOutcome: "not_imported",
        manualAttentionRequired: true,
        processingDurationMs: Math.max(0, Math.round(performance.now() - started)),
        estimatedAdministratorReviewMinutes: 10,
        failure: {
          code: "caption_file_missing",
          safeDetail: "The explicitly mapped local caption file was not supplied."
        }
      });
      continue;
    }
    const sourceText = new TextDecoder("utf-8", { fatal: true }).decode(captionBytes);
    const preparation = prepareExistingCaptionText(sourceText);
    const elapsed = Math.max(0, Math.round(performance.now() - started));
    if (!preparation.usable) {
      if (record.descriptionDraft !== null || record.questionAnswers.length !== 0) {
        throw new Error(`Unusable caption ${record.videoId} must not have generated description or Q&A drafts`);
      }
      outcomes.push({
        videoId: record.videoId,
        captionSupplied: true,
        captionLanguage: record.captionLanguage,
        captionTrackType: record.captionTrackType,
        sourceCharacterCount: preparation.metrics.sourceCharacterCount,
        cleanedCharacterCount: null,
        apparentCompleteness: "unusable",
        uncertaintyMarkerCount: preparation.metrics.uncertaintyMarkerCount,
        warningCodes: preparation.warnings.map((warning) => warning.code),
        descriptionDraftProduced: false,
        questionAnswerCount: 0,
        importedOutcome: "not_imported",
        manualAttentionRequired: true,
        processingDurationMs: elapsed,
        estimatedAdministratorReviewMinutes: Math.max(60, Math.ceil(preparation.metrics.sourceWordCount / 90)),
        failure: preparation.failure
      });
      continue;
    }
    if (record.descriptionDraft === null || record.questionAnswers.length < 5 || record.questionAnswers.length > 10) {
      throw new Error(`Usable caption ${record.videoId} requires one description and five to ten Q&A drafts`);
    }
    const target = await ensurePrivatePilotSermon(
      pool,
      manifest,
      record,
      preparation.metrics.sourceContentSha256,
      identity.canonicalUrl
    );
    const now = new Date().toISOString();
    const reviewMinutes = Math.max(45, Math.ceil(preparation.metrics.cleanedWordCount / 150) + 20);
    const reference = sourceReference(record.videoId, preparation.metrics.sourceContentSha256);
    const warnings = [
      ...preparation.warnings,
      ...(record.captionTrackType === "unknown"
        ? [{
            code: "caption_track_type_unresolved",
            safeDetail: "The plain-text export does not identify whether the YouTube caption track was manual or automatic."
          }]
        : []),
      {
        code: "service_date_placeholder",
        safeDetail: "The private pilot record uses a local placeholder service date pending administrator verification."
      }
    ];
    const candidate = enrichmentDraftBundleSchema.parse({
      schemaVersion: 3,
      sourceWordPressId: record.sourceWordPressId,
      targetSermonId: target.id,
      expectedRowVersion: target.rowVersion,
      description: {
        bodyText: record.descriptionDraft,
        provenance: { sourceKind: "generated_draft", sourceReference: reference }
      },
      transcript: {
        bodyText: preparation.cleanedText,
        provenance: { sourceKind: "caption", sourceReference: reference }
      },
      questionAnswers: record.questionAnswers.map((item) => ({
        ...item,
        provenance: { sourceKind: "generated_draft", sourceReference: reference }
      })),
      sourceProvenance: {
        provider: "youtube",
        videoId: record.videoId,
        canonicalUrl: identity.canonicalUrl,
        captionLanguage: record.captionLanguage,
        captionTrackType: record.captionTrackType,
        originalFilename: record.captionFilename,
        sourceContentSha256: preparation.metrics.sourceContentSha256,
        retrievalAttribution: "authorised_youtube_studio_export",
        sourceCharacterCount: preparation.metrics.sourceCharacterCount,
        cleanedCharacterCount: preparation.metrics.cleanedCharacterCount,
        apparentCompleteness: preparation.apparentCompleteness,
        uncertaintyMarkerCount: preparation.metrics.uncertaintyMarkerCount,
        warnings,
        unresolvedPassages: preparation.unresolvedPassages,
        processingVersion: phase3b2ProcessingVersion,
        importedAt: now,
        processedAt: now,
        processingDurationMs: elapsed,
        estimatedReviewMinutes: reviewMinutes,
        manualAttentionRequired: true,
        accuracyReviewStatus: "required"
      }
    });
    const bundlePath = resolveSafeDirectChild(
      preparedRoot,
      `${record.videoId}.private.json`,
      "file",
      ".private.json"
    );
    const bundle = await existingOrWriteBundle(bundlePath, candidate);
    const imported = await importEnrichmentDraftBundle(pool, bundle, pilotActorSubject);
    if (exactVideoId !== null) {
      await initialiseZeroFindingReview(pool, target.id, `authorised-record-${recordIndex + 1}`);
    }
    outcomes.push({
      videoId: record.videoId,
      captionSupplied: true,
      captionLanguage: record.captionLanguage,
      captionTrackType: record.captionTrackType,
      sourceCharacterCount: preparation.metrics.sourceCharacterCount,
      cleanedCharacterCount: preparation.metrics.cleanedCharacterCount,
      apparentCompleteness: preparation.apparentCompleteness,
      uncertaintyMarkerCount: preparation.metrics.uncertaintyMarkerCount,
      warningCodes: warnings.map((warning) => warning.code),
      descriptionDraftProduced: true,
      questionAnswerCount: record.questionAnswers.length,
      importedOutcome: imported.outcome,
      manualAttentionRequired: true,
      processingDurationMs: bundle.schemaVersion === 3
        ? bundle.sourceProvenance.processingDurationMs
        : elapsed,
      estimatedAdministratorReviewMinutes: bundle.schemaVersion === 3
        ? bundle.sourceProvenance.estimatedReviewMinutes
        : reviewMinutes,
      failure: null
    });
  }
  if (exactVideoId === null) {
    await persistNoClobber(
      resolveSafeDirectChild(preparedRoot, "safe-outcomes.private.json", "file", ".private.json"),
      `${JSON.stringify({ schemaVersion: 1, outcomes }, null, 2)}\n`
    );
  }
  return outcomes;
}

export function runPhase3b2Pilot(
  pool: Pool,
  pilotRootInput: string,
  manifestInput: unknown
): Promise<Phase3b2SafeOutcome[]> {
  return runPhase3b2PilotRecords(pool, pilotRootInput, manifestInput, null);
}

export function restoreRemainingPhase3b2Pilot(
  pool: Pool,
  pilotRootInput: string,
  manifestInput: unknown,
  exactVideoId: string
): Promise<Phase3b2SafeOutcome[]> {
  if (exactVideoId !== remainingAuthorisedPilotVideoId) {
    throw new PunctuationWorkflowError(
      "persistence_conflict",
      "The requested pilot identity is outside the exact remaining-restoration allowlist."
    );
  }
  return runPhase3b2PilotRecords(pool, pilotRootInput, manifestInput, exactVideoId);
}

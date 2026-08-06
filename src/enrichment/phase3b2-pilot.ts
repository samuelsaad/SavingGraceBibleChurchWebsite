import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import type { Pool, PoolClient } from "pg";
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

const pilotActorSubject = "local-phase3b2-pilot-importer";

function deterministicPilotUuid(videoId: string): string {
  const bytes = createHash("sha256").update(`saving-grace-phase3b2:${videoId}`, "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function pathInside(root: string, filename: string): string {
  const target = resolve(root, filename);
  const relationship = relative(root, target);
  if (!relationship || relationship.startsWith("..") || relationship.includes(":") || basename(target) !== filename) {
    throw new Error("Pilot caption files must be direct children of the private pilot directory");
  }
  return target;
}

async function verifyPilotDatabase(client: PoolClient): Promise<void> {
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
       current_database() = 'savinggrace_sermons_test' AS target_database,
       version() LIKE 'PostgreSQL%' AS postgres_server,
       to_regclass('public.sermon_enrichment_sources') IS NOT NULL AS provenance_table`
  );
  if (!Object.values(result.rows[0] ?? {}).every(Boolean)) {
    throw new Error("Phase 3B.2 database identity or migration safety verification failed");
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
     DO UPDATE SET source_checksum_sha256 = EXCLUDED.source_checksum_sha256,
       source_url = EXCLUDED.source_url, target_id = EXCLUDED.target_id`,
    [migrationRunId, String(record.sourceWordPressId), canonicalUrl, sourceSha256, sermonId]
  );
}

async function ensurePrivatePilotSermon(
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

function sourceReference(videoId: string, sha256: string): string {
  return `youtube-studio:${videoId}:${sha256}:phase3b2-caption-v1`;
}

async function existingOrWriteBundle(
  bundlePath: string,
  candidate: EnrichmentDraftBundle
): Promise<EnrichmentDraftBundle> {
  try {
    const existing = enrichmentDraftBundleSchema.parse(JSON.parse(await readFile(bundlePath, "utf8")));
    if (
      existing.schemaVersion !== 3 ||
      candidate.schemaVersion !== 3 ||
      existing.sourceProvenance.videoId !== candidate.sourceProvenance.videoId ||
      existing.sourceProvenance.sourceContentSha256 !== candidate.sourceProvenance.sourceContentSha256 ||
      existing.targetSermonId !== candidate.targetSermonId ||
      existing.sourceWordPressId !== candidate.sourceWordPressId ||
      existing.description.bodyText !== candidate.description.bodyText ||
      JSON.stringify(existing.questionAnswers) !== JSON.stringify(candidate.questionAnswers)
    ) {
      throw new Error("Existing private pilot bundle does not match the current mapped source and drafts");
    }
    return existing;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(bundlePath, `${JSON.stringify(candidate, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return candidate;
  }
}

export async function runPhase3b2Pilot(
  pool: Pool,
  pilotRootInput: string,
  manifestInput: unknown
): Promise<Phase3b2SafeOutcome[]> {
  const manifest = phase3b2PilotManifestSchema.parse(manifestInput);
  const pilotRoot = resolve(pilotRootInput);
  const preparedRoot = resolve(pilotRoot, "prepared-private");
  if (!relative(pilotRoot, preparedRoot) || relative(pilotRoot, preparedRoot).startsWith("..")) {
    throw new Error("Private pilot output must remain inside the pilot directory");
  }
  await mkdir(preparedRoot, { recursive: true });
  const outcomes: Phase3b2SafeOutcome[] = [];

  for (const record of manifest.records) {
    const started = performance.now();
    const identity = canonicalYouTubeIdentity(record.videoUrl, manifest.allowlistedVideoIds);
    if (identity.videoId !== record.videoId) {
      throw new Error(`Explicit mapping mismatch for private pilot video ID ${record.videoId}`);
    }
    const captionPath = pathInside(pilotRoot, record.captionFilename);
    let captionBytes: Buffer;
    try {
      captionBytes = await readFile(captionPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
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
    const bundlePath = resolve(preparedRoot, `${record.videoId}.private.json`);
    const bundle = await existingOrWriteBundle(bundlePath, candidate);
    const imported = await importEnrichmentDraftBundle(pool, bundle, pilotActorSubject);
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
  await writeFile(
    resolve(preparedRoot, "safe-outcomes.private.json"),
    `${JSON.stringify({ schemaVersion: 1, outcomes }, null, 2)}\n`,
    "utf8"
  );
  return outcomes;
}

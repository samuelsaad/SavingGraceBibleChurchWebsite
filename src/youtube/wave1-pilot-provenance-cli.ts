import { lstat, mkdir, open, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { prepareExistingCaptionText } from "../enrichment/pilot-caption";
import { analyzeStudioExport, alignCaptionAnalyses, parseVttBytes, sha256 } from "./pilot-caption-proof";

const targetVideoId = "RAMFOAOWwMA";
const evidenceVersion = "phase3b2c-pilot-provenance-v1";
const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(sourceDirectory, "..", "..");
const pilotRoot = join(repositoryRoot, "phase-3b2-pilot");
const manifestPath = join(pilotRoot, "phase3b2-manifest.private.json");
const bundlePath = join(pilotRoot, "prepared-private", `${targetVideoId}.private.json`);
const proofDirectory = join(pilotRoot, "youtube-api-caption-proof", targetVideoId);
const evidencePath = join(repositoryRoot, "private", "phase-3b2c-wave1", "pilot-provenance.private.json");

class SafeProvenanceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function assertLocalReadOnlyTarget(connectionString: string): void {
  const value = new URL(connectionString);
  if (!new Set(["127.0.0.1", "localhost", "::1", "[::1]"]).has(value.hostname) ||
    value.port !== "5432" || decodeURIComponent(value.pathname.slice(1)) !== "savinggrace_sermons_test") {
    throw new SafeProvenanceError("postgres_target_mismatch", "Pilot provenance requires the exact approved loopback PostgreSQL target");
  }
}

async function readPrivateJson(path: string): Promise<Record<string, unknown>> {
  const file = await lstat(path).catch(() => null);
  if (!file?.isFile() || file.isSymbolicLink()) throw new SafeProvenanceError("private_source_invalid", "A required private pilot artifact is unavailable");
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

async function persistNoClobber(value: unknown, stable: unknown): Promise<"created" | "unchanged"> {
  await mkdir(dirname(evidencePath), { recursive: true, mode: 0o700 });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    const handle = await open(evidencePath, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return "created";
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    const existing = JSON.parse(await readFile(evidencePath, "utf8")) as Record<string, unknown>;
    const existingStable = { ...existing };
    delete existingStable.checkedAt;
    if (sha256(JSON.stringify(existingStable)) !== sha256(JSON.stringify(stable))) {
      throw new SafeProvenanceError("private_evidence_conflict", "Existing private pilot provenance evidence differs");
    }
    return "unchanged";
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new SafeProvenanceError("postgres_configuration_missing", "DATABASE_URL is required");
  assertLocalReadOnlyTarget(connectionString);
  const manifest = await readPrivateJson(manifestPath) as {
    allowlistedVideoIds?: unknown;
    records?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(manifest.allowlistedVideoIds) || !manifest.allowlistedVideoIds.includes(targetVideoId) ||
    !Array.isArray(manifest.records)) {
    throw new SafeProvenanceError("pilot_identity_mismatch", "The accepted pilot manifest does not contain the required provenance identity");
  }
  const record = manifest.records.find((item) => item.videoId === targetVideoId);
  if (!record || typeof record.captionFilename !== "string" || !Number.isSafeInteger(record.sourceWordPressId)) {
    throw new SafeProvenanceError("pilot_identity_mismatch", "The accepted pilot source mapping is invalid");
  }
  const sourcePath = resolve(pilotRoot, record.captionFilename);
  if (resolve(sourcePath, "..") !== pilotRoot) throw new SafeProvenanceError("pilot_source_path_invalid", "The pilot Studio source path escaped private storage");
  const sourceFile = await lstat(sourcePath).catch(() => null);
  if (!sourceFile?.isFile() || sourceFile.isSymbolicLink()) throw new SafeProvenanceError("pilot_source_missing", "The untouched Studio source is unavailable");
  const studioBytes = await readFile(sourcePath);
  const studioText = new TextDecoder("utf-8", { fatal: true }).decode(studioBytes);
  const prepared = prepareExistingCaptionText(studioText);
  const bundle = await readPrivateJson(bundlePath) as {
    transcript?: { bodyText?: unknown };
    sourceProvenance?: { sourceContentSha256?: unknown; importedAt?: unknown };
  };
  if (!bundle.transcript || typeof bundle.transcript.bodyText !== "string" ||
    typeof bundle.sourceProvenance?.sourceContentSha256 !== "string" ||
    typeof bundle.sourceProvenance.importedAt !== "string") {
    throw new SafeProvenanceError("pilot_bundle_invalid", "The accepted pilot bundle lacks provenance evidence");
  }
  const studioSourceHashMatchesOriginal = prepared.metrics.sourceContentSha256 === bundle.sourceProvenance.sourceContentSha256;
  const proofEntries = (await readdir(proofDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".provenance.private.json"));
  if (proofEntries.length === 0) throw new SafeProvenanceError("pilot_comparison_missing", "The official pilot comparison evidence is unavailable");
  const proofArtifacts = await Promise.all(proofEntries.map(async (entry) =>
    await readPrivateJson(join(proofDirectory, entry.name)) as {
      videoId?: unknown;
      sha256?: unknown;
      sourceRelativePath?: unknown;
      studioComparison?: { normalizedWordSequenceMatches?: unknown; totalChangedTokenCount?: unknown };
    }
  ));
  const proof = proofArtifacts.find((item) => item.videoId === targetVideoId &&
    typeof item.sourceRelativePath === "string" && item.studioComparison?.normalizedWordSequenceMatches === false);
  if (!proof || typeof proof.sourceRelativePath !== "string" || typeof proof.sha256 !== "string") {
    throw new SafeProvenanceError("pilot_comparison_invalid", "The required official comparison did not match the pilot identity");
  }
  const officialPath = resolve(pilotRoot, proof.sourceRelativePath);
  if (!officialPath.startsWith(resolve(proofDirectory))) throw new SafeProvenanceError("pilot_comparison_invalid", "Official comparison source escaped private pilot storage");
  const officialBytes = await readFile(officialPath);
  if (sha256(officialBytes) !== proof.sha256) throw new SafeProvenanceError("pilot_source_integrity_problem", "Official comparison bytes failed their recorded hash");
  const official = parseVttBytes(officialBytes);
  const studio = analyzeStudioExport(studioText);
  const originalComparison = alignCaptionAnalyses(official, studio).comparison;

  const pool = new Pool({ connectionString, max: 1, application_name: "saving-grace-wave1-provenance-read-only" });
  let databaseEvidence: {
    transcriptBody: string;
    transcriptStatus: string;
    transcriptRowVersion: number;
    transcriptUpdatedAt: string;
    editCountAfterImport: number;
    editActors: string[];
    editTimestamps: string[];
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity = await client.query<{ database_ok: boolean; version_ok: boolean }>(
      `SELECT current_database() = 'savinggrace_sermons_test' AS database_ok,
              current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS version_ok`
    );
    if (!identity.rows[0]?.database_ok || !identity.rows[0]?.version_ok) {
      throw new SafeProvenanceError("postgres_target_mismatch", "Local PostgreSQL identity did not match the approved test database and version");
    }
    const result = await client.query<{
      body_text: string;
      status: string;
      row_version: number;
      updated_at: Date;
      edit_count: number;
      edit_actors: string[] | null;
      edit_timestamps: Date[] | null;
    }>(
      `SELECT transcript.body_text, transcript.status, transcript.row_version, transcript.updated_at,
              count(audit.id)::integer AS edit_count,
              array_remove(array_agg(audit.actor_subject ORDER BY audit.created_at), NULL) AS edit_actors,
              array_remove(array_agg(audit.created_at ORDER BY audit.created_at), NULL) AS edit_timestamps
       FROM sermons sermon
       JOIN sermon_transcripts transcript ON transcript.sermon_id = sermon.id
       LEFT JOIN audit_events audit ON audit.entity_id = sermon.id
         AND audit.action = 'sermon.update'
         AND audit.changed_fields ? 'transcript'
         AND audit.created_at > $2::timestamptz
       WHERE sermon.source_wordpress_id = $1
       GROUP BY transcript.body_text, transcript.status, transcript.row_version, transcript.updated_at`,
      [record.sourceWordPressId, bundle.sourceProvenance.importedAt]
    );
    if (result.rows.length !== 1) throw new SafeProvenanceError("pilot_database_identity_mismatch", "The local pilot transcript did not resolve uniquely");
    const row = result.rows[0]!;
    databaseEvidence = {
      transcriptBody: row.body_text,
      transcriptStatus: row.status,
      transcriptRowVersion: row.row_version,
      transcriptUpdatedAt: row.updated_at.toISOString(),
      editCountAfterImport: row.edit_count,
      editActors: row.edit_actors ?? [],
      editTimestamps: (row.edit_timestamps ?? []).map((value) => value.toISOString())
    };
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  const current = analyzeStudioExport(databaseEvidence.transcriptBody);
  const currentComparison = alignCaptionAnalyses(official, current).comparison;
  const bundleAnalysis = analyzeStudioExport(bundle.transcript.bodyText);
  const bundleToCurrent = alignCaptionAnalyses(bundleAnalysis, current).comparison;
  const administratorEdited = databaseEvidence.editCountAfterImport > 0 && !bundleToCurrent.normalizedWordSequenceMatches;
  const editsMoveTowardOfficial = currentComparison.totalChangedTokenCount < originalComparison.totalChangedTokenCount;
  const conclusion = !studioSourceHashMatchesOriginal
    ? "source_integrity_problem"
    : administratorEdited && editsMoveTowardOfficial
      ? "dashboard_edit_explains_comparison"
      : originalComparison.requiresManualReview
        ? "raw_source_version_difference"
        : "comparison_provenance_uncertain";
  const stable = {
    schemaVersion: 1,
    privateContent: true,
    evidenceVersion,
    videoId: targetVideoId,
    sourceWordPressId: record.sourceWordPressId,
    studioSourceRelativePath: relative(repositoryRoot, sourcePath).replaceAll("\\", "/"),
    studioSourceSha256: sha256(studioBytes),
    normalizedStudioSourceSha256: prepared.metrics.sourceContentSha256,
    recordedOriginalSourceSha256: bundle.sourceProvenance.sourceContentSha256,
    studioSourceHashMatchesOriginal,
    officialSourceSha256: sha256(officialBytes),
    officialSourceHashMatchesComparison: sha256(officialBytes) === proof.sha256,
    originalComparison: {
      normalizedWordSequenceMatches: originalComparison.normalizedWordSequenceMatches,
      totalChangedTokenCount: originalComparison.totalChangedTokenCount,
      differenceRegionCount: originalComparison.differenceRegionCount
    },
    databaseEvidence: {
      transcriptBodySha256: sha256(databaseEvidence.transcriptBody),
      transcriptStatus: databaseEvidence.transcriptStatus,
      transcriptRowVersion: databaseEvidence.transcriptRowVersion,
      transcriptUpdatedAt: databaseEvidence.transcriptUpdatedAt,
      editCountAfterImport: databaseEvidence.editCountAfterImport,
      editActors: databaseEvidence.editActors,
      editTimestamps: databaseEvidence.editTimestamps,
      differsFromImportedBundle: !bundleToCurrent.normalizedWordSequenceMatches
    },
    currentComparison: {
      normalizedWordSequenceMatches: currentComparison.normalizedWordSequenceMatches,
      totalChangedTokenCount: currentComparison.totalChangedTokenCount,
      differenceRegionCount: currentComparison.differenceRegionCount,
      editsMoveTowardOfficial
    },
    conclusion
  };
  const artifact = { ...stable, checkedAt: new Date().toISOString() };
  const persistence = await persistNoClobber(artifact, stable);
  process.stdout.write(`${JSON.stringify({
    outcome: "pilot_provenance_complete",
    conclusion,
    studioSourceHashMatchesOriginal,
    administratorTranscriptEditsRecorded: administratorEdited,
    editsMoveTowardOfficial,
    privatePersistence: persistence,
    contentDisplayed: false
  })}\n`);
}

main().catch((error: unknown) => {
  const safe = error instanceof SafeProvenanceError
    ? { code: error.code, message: error.message }
    : { code: "unexpected_failure", message: "The pilot provenance check failed safely" };
  process.stderr.write(`${JSON.stringify({ outcome: "failed", error: safe })}\n`);
  process.exitCode = 1;
});

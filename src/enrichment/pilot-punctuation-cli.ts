import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { ZodError, type ZodType } from "zod";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { createPostgresPool } from "../server/database";
import {
  assemblePhase3b2AtomicReviewManifest,
  importPhase3b2AtomicReviewManifest,
  readPhase3b2AtomicReviewManifest,
  verifyPhase3b2AtomicReviewManifest
} from "./atomic-review";
import { phase3b2PilotManifestSchema, type Phase3b2PilotManifest } from "./pilot-contracts";
import {
  phase3b2PunctuationCompletionManifestSchema,
  punctuationWorkspaceTemplateSchema,
  type Phase3b2PunctuationCompletionManifest
} from "./pilot-punctuation-contracts";
import {
  PunctuationWorkflowError,
  assertSafeDirectory,
  buildPunctuationPack,
  createPunctuationWorkspaceTemplate,
  ensureSafeDirectory,
  persistNoClobber,
  punctuationFailure,
  readSafeFile,
  resolveSafeDirectChild,
  validatePunctuationPack,
  type PunctuationFailureCode
} from "./pilot-punctuation";
import {
  assertExactCompletionScope,
  loadTrustedPunctuationSources,
  runPhase3b2PunctuationCompletion,
  verifyPhase3b2PunctuationCompletion
} from "./phase3b2b-pilot";

interface LoadedBaseManifest {
  manifestPath: string;
  pilotRoot: string;
  manifest: Phase3b2PilotManifest;
}

async function parseJsonFile<T>(path: string, schema: ZodType<T>, label: string): Promise<T> {
  const bytes = await readSafeFile(path);
  let input: unknown;
  try {
    input = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new PunctuationWorkflowError("corrupt_json", `${label} is not valid JSON.`, { cause: error });
  }
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new PunctuationWorkflowError("schema_failure", `${label} failed schema validation.`, { cause: error });
    }
    throw error;
  }
}

async function readBaseManifest(pathInput: string): Promise<LoadedBaseManifest> {
  const manifestPath = resolve(pathInput);
  const pilotRoot = dirname(manifestPath);
  await assertSafeDirectory(pilotRoot);
  const expectedPath = resolveSafeDirectChild(pilotRoot, basename(manifestPath), "file", ".json");
  if (expectedPath !== manifestPath) {
    throw new PunctuationWorkflowError(
      "path_safety_failure",
      "The base manifest must be a direct regular JSON file in the private pilot directory."
    );
  }
  return {
    manifestPath,
    pilotRoot,
    manifest: await parseJsonFile(manifestPath, phase3b2PilotManifestSchema, "The base pilot manifest")
  };
}

async function trustedSourceForRecord(base: LoadedBaseManifest, videoId: string) {
  const trusted = await loadTrustedPunctuationSources(base.pilotRoot, base.manifest);
  const source = trusted.sources.find((candidate) => candidate.record.videoId === videoId);
  if (!source) {
    throw new PunctuationWorkflowError(
      "unauthorised_record",
      "The requested record is not one of the two trusted manual-punctuation records."
    );
  }
  return { trusted, source };
}

export async function prepareWorkspace(
  manifestPath: string,
  videoId: string,
  workspaceName: string
): Promise<Record<string, unknown>> {
  const base = await readBaseManifest(manifestPath);
  const { source } = await trustedSourceForRecord(base, videoId);
  const workspacePath = resolveSafeDirectChild(base.pilotRoot, workspaceName, "directory");
  const workspaceState = await ensureSafeDirectory(workspacePath);
  const template = createPunctuationWorkspaceTemplate(videoId, source.sourceText);
  const manifestState = await persistNoClobber(
    resolveSafeDirectChild(workspacePath, "chunk-manifest.private.json", "file", ".private.json"),
    `${JSON.stringify(template, null, 2)}\n`
  );
  for (const chunk of template.chunks) {
    const sourceChunk = source.sourceText.slice(chunk.sourceStart, chunk.sourceEnd);
    await persistNoClobber(
      resolveSafeDirectChild(workspacePath, chunk.sourceFilename, "file", ".source.txt"),
      sourceChunk
    );
    await persistNoClobber(
      resolveSafeDirectChild(workspacePath, chunk.cleanedFilename, "file", ".cleaned.txt"),
      sourceChunk
    );
  }
  return {
    outcome: "punctuation_workspace_prepared",
    recordKey: source.recordKey,
    workspaceState,
    manifestState,
    chunkTokenLimit: template.chunkTokenLimit,
    chunkCount: template.chunks.length,
    sourceTokenCount: template.chunks.at(-1)?.tokenEndExclusive ?? 0
  };
}

export async function finalizeWorkspace(
  manifestPath: string,
  videoId: string,
  workspaceName: string,
  packFilename: string
): Promise<Record<string, unknown>> {
  const base = await readBaseManifest(manifestPath);
  const { source } = await trustedSourceForRecord(base, videoId);
  const workspacePath = resolveSafeDirectChild(base.pilotRoot, workspaceName, "directory");
  await assertSafeDirectory(workspacePath);
  const template = await parseJsonFile(
    resolveSafeDirectChild(workspacePath, "chunk-manifest.private.json", "file", ".private.json"),
    punctuationWorkspaceTemplateSchema,
    "The punctuation workspace manifest"
  );
  const cleanedTexts: string[] = [];
  for (const chunk of template.chunks) {
    const expectedSource = source.sourceText.slice(chunk.sourceStart, chunk.sourceEnd);
    const storedSource = (
      await readSafeFile(resolveSafeDirectChild(workspacePath, chunk.sourceFilename, "file", ".source.txt"))
    ).toString("utf8");
    if (storedSource !== expectedSource) {
      throw new PunctuationWorkflowError(
        "lexical_preservation_failure",
        "A private source chunk no longer matches its stable source range."
      );
    }
    cleanedTexts.push((
      await readSafeFile(resolveSafeDirectChild(workspacePath, chunk.cleanedFilename, "file", ".cleaned.txt"))
    ).toString("utf8"));
  }
  const pack = buildPunctuationPack(videoId, source.sourceText, template, cleanedTexts);
  const validated = validatePunctuationPack(videoId, source.sourceText, pack);
  const packPath = resolveSafeDirectChild(base.pilotRoot, packFilename, "file", ".private.json");
  const persistence = await persistNoClobber(packPath, `${JSON.stringify(pack, null, 2)}\n`);
  return {
    outcome: "punctuation_pack_validated",
    recordKey: source.recordKey,
    persistence,
    tokenSequencesMatch: validated.metrics.tokenSequencesMatch,
    sourceTokenCount: validated.metrics.sourceTokenCount,
    cleanedTokenCount: validated.metrics.cleanedTokenCount,
    chunkCount: validated.metrics.chunkCount,
    punctuationChangeCount: validated.metrics.punctuationChangeCount,
    capitalizationChangeCount: validated.metrics.capitalizationChangeCount,
    paragraphCount: validated.metrics.paragraphCount
  };
}

async function loadCompletionFromDirectChild(
  base: LoadedBaseManifest,
  pathInput: string
): Promise<Phase3b2PunctuationCompletionManifest> {
  const path = resolve(pathInput);
  const name = basename(path);
  const expected = resolveSafeDirectChild(base.pilotRoot, name, "file", ".private.json");
  if (path !== expected) {
    throw new PunctuationWorkflowError(
      "path_safety_failure",
      "The completion manifest must be a direct private JSON file in the pilot directory."
    );
  }
  return parseJsonFile(path, phase3b2PunctuationCompletionManifestSchema, "The completion manifest");
}

export async function assembleCompletion(
  baseManifestPathInput: string,
  firstRecordFilename: string,
  secondRecordFilename: string,
  completionFilename: string
): Promise<Record<string, unknown>> {
  const base = await readBaseManifest(baseManifestPathInput);
  const trusted = await loadTrustedPunctuationSources(base.pilotRoot, base.manifest);
  const recordInputs = await Promise.all([firstRecordFilename, secondRecordFilename].map(async (filename) => {
    const path = resolveSafeDirectChild(base.pilotRoot, filename, "file", ".private.json");
    const bytes = await readSafeFile(path);
    try {
      return JSON.parse(bytes.toString("utf8")) as unknown;
    } catch (error) {
      throw new PunctuationWorkflowError("corrupt_json", "A completion record is not valid JSON.", { cause: error });
    }
  }));
  let completion: Phase3b2PunctuationCompletionManifest;
  try {
    completion = phase3b2PunctuationCompletionManifestSchema.parse({
      schemaVersion: 2,
      sourceSnapshotId: base.manifest.sourceSnapshotId,
      records: recordInputs
    });
  } catch (error) {
    throw new PunctuationWorkflowError(
      "schema_failure",
      "The assembled completion manifest failed schema validation.",
      { cause: error }
    );
  }
  assertExactCompletionScope(completion, base.manifest, trusted.sources);
  const persistence = await persistNoClobber(
    resolveSafeDirectChild(base.pilotRoot, completionFilename, "file", ".private.json"),
    `${JSON.stringify(completion, null, 2)}\n`
  );
  return {
    outcome: "punctuation_completion_manifest_assembled",
    persistence,
    authorisedRecordCount: completion.records.length,
    descriptionDraftCount: completion.records.length,
    questionAnswerDraftCount: completion.records.reduce(
      (count, record) => count + record.questionAnswers.length,
      0
    )
  };
}

export async function importCompletion(
  baseManifestPathInput: string,
  completionManifestPathInput: string,
  poolOverride?: Pool
): Promise<Record<string, unknown>> {
  const connectionString = process.env.DATABASE_URL;
  if (!poolOverride) {
    if (!connectionString) {
      throw new PunctuationWorkflowError("missing_input", "DATABASE_URL is required for import.");
    }
    assertDisposableLocalDatabase(connectionString);
  }
  const base = await readBaseManifest(baseManifestPathInput);
  const completion = await loadCompletionFromDirectChild(base, completionManifestPathInput);
  const pool = poolOverride ?? createPostgresPool(connectionString!);
  try {
    const outcomes = await runPhase3b2PunctuationCompletion(
      pool,
      base.pilotRoot,
      base.manifest,
      completion
    );
    if (outcomes.length !== 2 || outcomes.some((outcome) => outcome.failure !== null)) {
      const failureCode = (
        outcomes.find((outcome) => outcome.failure)?.failure?.code ?? "unexpected_failure"
      ) as PunctuationFailureCode;
      throw new PunctuationWorkflowError(
        failureCode,
        "The Phase 3B.2b import did not complete both authorised records."
      );
    }
    return { schemaVersion: 2, outcomes };
  } finally {
    if (!poolOverride) await pool.end();
  }
}

export async function verifyCompletion(
  baseManifestPathInput: string,
  completionManifestPathInput: string,
  poolOverride?: Pool
): Promise<Record<string, unknown>> {
  const connectionString = process.env.DATABASE_URL;
  if (!poolOverride) {
    if (!connectionString) {
      throw new PunctuationWorkflowError("missing_input", "DATABASE_URL is required for verification.");
    }
    assertDisposableLocalDatabase(connectionString);
  }
  const base = await readBaseManifest(baseManifestPathInput);
  const completion = await loadCompletionFromDirectChild(base, completionManifestPathInput);
  const pool = poolOverride ?? createPostgresPool(connectionString!);
  try {
    return { ...(await verifyPhase3b2PunctuationCompletion(
      pool,
      base.pilotRoot,
      base.manifest,
      completion
    )) };
  } finally {
    if (!poolOverride) await pool.end();
  }
}

function usageFailure(): PunctuationWorkflowError {
  return new PunctuationWorkflowError(
    "missing_input",
    "Use prepare, finalize, assemble, import, verify, atomic-assemble, atomic-import or atomic-verify with all required private-file arguments."
  );
}

async function atomicDatabasePool(): Promise<Pool> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new PunctuationWorkflowError("missing_input", "DATABASE_URL is required for atomic review work.");
  }
  assertDisposableLocalDatabase(connectionString, process.env.ALLOW_LOCAL_DB_WRITE);
  return createPostgresPool(connectionString);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const [action, manifestPath, videoIdOrCompletionPath, workspaceName, packFilename] = args;
  let report: Record<string, unknown>;
  if (action === "atomic-assemble" && manifestPath && videoIdOrCompletionPath) {
    const pool = await atomicDatabasePool();
    try {
      const result = await assemblePhase3b2AtomicReviewManifest(
        pool,
        manifestPath,
        videoIdOrCompletionPath
      );
      report = { outcome: "atomic_review_manifest_assembled", ...result };
    } finally {
      await pool.end();
    }
  } else if (action === "atomic-import" && manifestPath) {
    const pool = await atomicDatabasePool();
    try {
      const manifest = await readPhase3b2AtomicReviewManifest(manifestPath);
      report = {
        outcome: "atomic_review_items_imported",
        ...(await importPhase3b2AtomicReviewManifest(pool, manifest))
      };
    } finally {
      await pool.end();
    }
  } else if (action === "atomic-verify" && manifestPath) {
    const pool = await atomicDatabasePool();
    try {
      const manifest = await readPhase3b2AtomicReviewManifest(manifestPath);
      report = {
        outcome: "atomic_review_items_verified",
        ...(await verifyPhase3b2AtomicReviewManifest(pool, manifest))
      };
    } finally {
      await pool.end();
    }
  } else if (action === "prepare" && manifestPath && videoIdOrCompletionPath && workspaceName) {
    report = await prepareWorkspace(manifestPath, videoIdOrCompletionPath, workspaceName);
  } else if (
    (action === "finalize" || action === "finalise") &&
    manifestPath && videoIdOrCompletionPath && workspaceName && packFilename
  ) {
    report = await finalizeWorkspace(manifestPath, videoIdOrCompletionPath, workspaceName, packFilename);
  } else if (action === "assemble" && manifestPath && videoIdOrCompletionPath && workspaceName && packFilename) {
    report = await assembleCompletion(manifestPath, videoIdOrCompletionPath, workspaceName, packFilename);
  } else if (action === "import" && manifestPath && videoIdOrCompletionPath) {
    report = await importCompletion(manifestPath, videoIdOrCompletionPath);
  } else if (action === "verify" && manifestPath && videoIdOrCompletionPath) {
    report = await verifyCompletion(manifestPath, videoIdOrCompletionPath);
  } else {
    throw usageFailure();
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error: unknown) => {
    const failure = punctuationFailure(error);
    process.stderr.write(`${JSON.stringify({
      outcome: "failed",
      failure: { code: failure.code, safeDetail: failure.safeDetail }
    })}\n`);
    process.exitCode = 1;
  });
}

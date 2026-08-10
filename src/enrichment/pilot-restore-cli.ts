import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { createPostgresPool } from "../server/database";
import {
  remainingAuthorisedPilotVideoId,
  restoreRemainingPhase3b2Pilot
} from "./phase3b2-pilot";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const manifestPath = process.argv[2] ?? process.env.PILOT_RESTORE_MANIFEST;
  if (!manifestPath) {
    throw new Error("Use enrichment:restore-remaining-pilot-local -- <private-manifest-path>");
  }
  const absoluteManifestPath = resolve(manifestPath);
  const pilotRoot = resolve(absoluteManifestPath, "..");
  const manifest = JSON.parse(await readFile(absoluteManifestPath, "utf8")) as unknown;
  const pool = createPostgresPool(connectionString);
  try {
    const outcomes = await restoreRemainingPhase3b2Pilot(
      pool,
      pilotRoot,
      manifest,
      remainingAuthorisedPilotVideoId
    );
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, outcomes }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown pilot restoration error";
  process.stderr.write(`Remaining Phase 3B.2 pilot restoration failed safely: ${message}\n`);
  process.exitCode = 1;
});

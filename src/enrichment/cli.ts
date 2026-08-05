import { readFile } from "node:fs/promises";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { createPostgresPool } from "../server/database";
import { buildEnrichmentQueue, importEnrichmentDraftBundle } from "./postgres-enrichment";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const pool = createPostgresPool(connectionString);
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--export-queue") {
      const sourceSnapshotId = args[1] ?? "anonymised-local-fixture";
      const manifest = await buildEnrichmentQueue(pool, sourceSnapshotId);
      process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
      return;
    }
    if (args[0] === "--import-bundle" && args[1]) {
      const input = JSON.parse(await readFile(args[1], "utf8")) as unknown;
      const result = await importEnrichmentDraftBundle(pool, input);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }
    throw new Error("Use --export-queue [snapshot-id] or --import-bundle <local-json-path>");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown enrichment error";
  process.stderr.write(`Enrichment command failed: ${message}\n`);
  process.exitCode = 1;
});

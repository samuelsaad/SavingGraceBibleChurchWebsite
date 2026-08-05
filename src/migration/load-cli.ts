import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../server/database";
import { runMigrationDryRun } from "./importer";
import { assertDisposableLocalDatabase } from "./local-database-safety";
import { loadMigrationResult } from "./postgres-loader";
import { legacySermonRecordSchema } from "./types";

function argumentValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main(): Promise<void> {
  const inputPath = argumentValue("--input");
  const connectionString = process.env.DATABASE_URL;
  if (!inputPath) throw new Error("Provide --input <anonymised-fixture.json>");
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);

  const raw = await readFile(resolve(inputPath), "utf8");
  const records = legacySermonRecordSchema.array().parse(JSON.parse(raw));
  const result = runMigrationDryRun(records);
  if (result.summary.rejected > 0) throw new Error("Fixture dry run contains rejected records");

  const pool = createPostgresPool(connectionString);
  try {
    const loaded = await loadMigrationResult(pool, result);
    process.stdout.write(`Loaded ${loaded.imported} anonymised sermon candidate(s).\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown fixture load error";
  process.stderr.write(`Fixture load failed: ${message}\n`);
  process.exitCode = 1;
});

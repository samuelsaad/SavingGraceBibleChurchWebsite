import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { legacySermonRecordSchema } from "./types";
import { runMigrationDryRun } from "./importer";

function argumentValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main(): Promise<void> {
  if (!process.argv.includes("--dry-run")) {
    throw new Error("Only --dry-run mode is implemented and permitted in this milestone");
  }

  const inputPath = argumentValue("--input");
  if (!inputPath) {
    throw new Error("Provide an anonymised JSON fixture with --input <path>");
  }

  const raw = await readFile(resolve(inputPath), "utf8");
  const records = legacySermonRecordSchema.array().parse(JSON.parse(raw));
  const result = runMigrationDryRun(records);

  // Deliberately emit only the safe report. Candidate rows and private source
  // values, including original embed markup, never go to stdout.
  process.stdout.write(`${JSON.stringify({ summary: result.summary, records: result.records }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown dry-run error";
  process.stderr.write(`Migration dry run failed: ${message}\n`);
  process.exitCode = 1;
});

import { Pool } from "pg";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import {
  importSermonEnrichmentCanary,
  prepareSermonEnrichmentCanary,
  SermonEnrichmentCanaryError,
  validateSermonEnrichmentCanary,
  verifySermonEnrichmentCanary
} from "./sermon-enrichment-canary";

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (rest.length !== 0 || !new Set(["prepare", "validate", "import", "verify"]).has(command ?? "")) {
    throw new SermonEnrichmentCanaryError("command_invalid", "Use exactly one canary command: prepare, validate, import or verify");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new SermonEnrichmentCanaryError("database_configuration_missing", "DATABASE_URL is required");
  if (command === "import" || command === "verify") {
    assertDisposableLocalDatabase(connectionString);
  }
  const pool = new Pool({
    connectionString,
    max: 1,
    application_name: `saving-grace-sermon-enrichment-canary-${command}`
  });
  try {
    const result = command === "prepare"
      ? await prepareSermonEnrichmentCanary(pool)
      : command === "validate"
        ? await validateSermonEnrichmentCanary(pool)
        : command === "import"
          ? await importSermonEnrichmentCanary(pool)
          : await verifySermonEnrichmentCanary(pool);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const safe = error instanceof SermonEnrichmentCanaryError
    ? { code: error.code, message: error.message }
    : { code: "sermon_enrichment_canary_failed", message: "The private sermon-enrichment canary failed safely" };
  process.stderr.write(`${JSON.stringify({ outcome: "failed", error: safe })}\n`);
  process.exitCode = 1;
});

import { createPostgresPool } from "../server/database";
import { assertDisposableLocalDatabase } from "./local-database-safety";
import {
  runSchemaMigrations,
  type SchemaMigrationScope
} from "./schema-migrations";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);

  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--rollback");
  const phase3bOnly = process.argv.includes("--phase3b-only");
  const phase3b1Only = process.argv.includes("--phase3b1-only");
  const phase3b1aOnly = process.argv.includes("--phase3b1a-only");
  const phase3b2Only = process.argv.includes("--phase3b2-only");
  const atomicReviewOnly = process.argv.includes("--atomic-review-only");
  const primaryPassageOnly = process.argv.includes("--primary-passage-only");
  if (apply === rollback) throw new Error("Choose exactly one of --apply or --rollback");
  if ([phase3bOnly, phase3b1Only, phase3b1aOnly, phase3b2Only, atomicReviewOnly, primaryPassageOnly].filter(Boolean).length > 1) {
    throw new Error("Choose at most one phase-only migration");
  }

  const scope: SchemaMigrationScope = primaryPassageOnly
    ? "0014_primary_preaching_passages"
    : atomicReviewOnly
      ? "0008_atomic_sermon_review_items"
      : phase3b2Only
        ? "0006_phase3b2_pilot_provenance"
        : phase3b1aOnly
          ? "0005_approved_sermon_descriptions"
          : phase3b1Only
            ? "0004_sermon_enrichment_readiness"
            : phase3bOnly
              ? "0003_single_admin_deletion_seo"
              : "all";
  const pool = createPostgresPool(connectionString);
  try {
    const result = await runSchemaMigrations(pool, {
      direction: apply ? "apply" : "rollback",
      scope,
      connectionString,
      writeOptIn: process.env.ALLOW_LOCAL_DB_WRITE
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown local schema error";
  process.stderr.write(`Local schema command failed: ${message}\n`);
  process.exitCode = 1;
});

import { readFile } from "node:fs/promises";
import { createPostgresPool } from "../server/database";
import { assertDisposableLocalDatabase } from "./local-database-safety";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);

  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--rollback");
  const phase3bOnly = process.argv.includes("--phase3b-only");
  if (apply === rollback) throw new Error("Choose exactly one of --apply or --rollback");

  const migrationPaths = phase3bOnly
    ? [
        apply
          ? "db/migrations/0003_single_admin_deletion_seo.sql"
          : "db/migrations/0003_single_admin_deletion_seo.down.sql"
      ]
    : apply
      ? [
          "db/migrations/0001_initial.sql",
          "db/migrations/0002_admin_foundation.sql",
          "db/migrations/0003_single_admin_deletion_seo.sql"
        ]
      : [
          "db/migrations/0003_single_admin_deletion_seo.down.sql",
          "db/migrations/0002_admin_foundation.down.sql",
          "db/migrations/0001_initial.down.sql"
        ];
  const pool = createPostgresPool(connectionString);
  try {
    for (const migrationPath of migrationPaths) {
      await pool.query(await readFile(migrationPath, "utf8"));
    }
    process.stdout.write(
      `${apply ? "Applied" : "Rolled back"} local ${phase3bOnly ? "migration 0003" : "migrations 0001-0003"}.\n`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown local schema error";
  process.stderr.write(`Local schema command failed: ${message}\n`);
  process.exitCode = 1;
});

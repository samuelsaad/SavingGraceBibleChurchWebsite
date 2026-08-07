import { createPostgresPool } from "../server/database";
import {
  applyReferenceCatalogue,
  rollbackReferenceCatalogue
} from "./reference-catalogue";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const apply = process.argv.includes("--apply");
  const rollback = process.argv.includes("--rollback");
  if (apply === rollback) throw new Error("Choose exactly one of --apply or --rollback");
  const pool = createPostgresPool(connectionString);
  try {
    const options = { connectionString, writeOptIn: process.env.ALLOW_LOCAL_DB_WRITE };
    const result = apply
      ? await applyReferenceCatalogue(pool, options)
      : await rollbackReferenceCatalogue(pool, options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown reference-catalogue error";
  process.stderr.write(`Local reference-catalogue command failed: ${message}\n`);
  process.exitCode = 1;
});

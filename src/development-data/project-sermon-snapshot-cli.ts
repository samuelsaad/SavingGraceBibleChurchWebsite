import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import { exportProjectSermonSnapshot } from "./export-project-sermon-snapshot";
import { importTrackedProjectSermonSnapshot } from "./import-project-sermon-snapshot";
import { loadTrackedProjectSermonSnapshot } from "./project-sermon-snapshot";

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "export") {
    await exportProjectSermonSnapshot();
    return;
  }
  const tracked = await loadTrackedProjectSermonSnapshot();
  if (command === "verify" || command === "dry-run") {
    process.stdout.write(`${JSON.stringify({
      outcome: command === "verify" ? "verified" : "dry-run-valid",
      counts: tracked.manifest.counts,
      contentSha256: tracked.contentSha256,
      manifestSha256: tracked.manifestSha256,
      importMode: tracked.manifest.importMode
    })}\n`);
    return;
  }
  if (command !== "import") throw new Error("Choose export, verify, dry-run, or import");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const url = new URL(connectionString);
  const pool = new Pool({
    host: url.hostname,
    port: Number(url.port),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: url.username ? decodeURIComponent(url.username) : protectedLocalPostgresUser,
    password: url.password ? decodeURIComponent(url.password) : protectedLocalPostgresPassword,
    max: 1,
    application_name: "saving-grace-project-sermon-snapshot-import"
  });
  try {
    const result = await importTrackedProjectSermonSnapshot(pool, {
      connectionString,
      ...(process.env.ALLOW_LOCAL_DB_WRITE !== undefined ? { writeOptIn: process.env.ALLOW_LOCAL_DB_WRITE } : {}),
      ...(process.env.DISPOSABLE_TEST_DATABASE_TOKEN !== undefined ? { testRunToken: process.env.DISPOSABLE_TEST_DATABASE_TOKEN } : {})
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  process.stderr.write(`Project sermon snapshot command failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
});

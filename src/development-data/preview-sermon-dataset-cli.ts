import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import { importTrackedPreviewDataset } from "./import-preview-sermon-dataset";
import { loadTrackedPreviewDataset } from "./preview-sermon-dataset";

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "verify") {
    const result = await loadTrackedPreviewDataset();
    process.stdout.write(JSON.stringify({
      outcome: "verified",
      sermons: result.dataset.sermons.length,
      questionAnswers: result.manifest.expectedQuestionAnswerCount,
      contentSha256: result.contentSha256,
      manifestSha256: result.manifestSha256
    }) + "\n");
    return;
  }
  if (command !== "import") throw new Error("Choose verify or import");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const url = new URL(connectionString);
  const explicitUser = url.username ? decodeURIComponent(url.username) : null;
  const explicitPassword = url.password ? decodeURIComponent(url.password) : null;
  const pool = new Pool({
    host: url.hostname,
    port: Number(url.port),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: explicitUser ?? protectedLocalPostgresUser,
    ...(explicitPassword !== null
      ? { password: explicitPassword }
      : explicitUser === null ? { password: protectedLocalPostgresPassword } : {}),
    max: 1,
    application_name: "saving-grace-public-development-dataset-import"
  });
  try {
    const result = await importTrackedPreviewDataset(pool, {
      connectionString,
      writeOptIn: process.env.ALLOW_LOCAL_DB_WRITE,
      testRunToken: process.env.DISPOSABLE_TEST_DATABASE_TOKEN
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown public dataset command error";
  process.stderr.write(`Public development-dataset command failed: ${message}\n`);
  process.exitCode = 1;
});

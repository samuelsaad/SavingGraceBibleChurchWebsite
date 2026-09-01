import { mkdir, writeFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { assertReadOnlyLocalDatabase } from "../migration/local-database-safety";
import {
  protectedLocalPostgresPassword,
  protectedLocalPostgresUser
} from "../migration/protected-local-postgres";
import { readPreviewDatasetRecords } from "./preview-sermon-dataset-postgres";
import {
  loadTrackedPreviewDataset,
  previewDatasetAllowedSlugs,
  previewDatasetContentPath,
  previewDatasetDirectory,
  previewDatasetManifestPath,
  previewDatasetVersion,
  serializePublicDataset,
  sha256,
  type PreviewSermonDatasetManifest
} from "./preview-sermon-dataset";

const sourceConnectionString = "postgresql://127.0.0.1:5432/savinggrace_sermons_test";

async function verifySource(client: PoolClient): Promise<void> {
  const result = await client.query<{
    database_name: string;
    server_16: boolean;
    loopback: boolean;
    port_5432: boolean;
    read_only: boolean;
  }>(`SELECT
      current_database() AS database_name,
      current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
      inet_server_addr() = '127.0.0.1'::inet AS loopback,
      inet_server_port() = 5432 AS port_5432,
      current_setting('transaction_read_only') = 'on' AS read_only`);
  const state = result.rows[0];
  if (!state || state.database_name !== "savinggrace_sermons_test" ||
      !state.server_16 || !state.loopback || !state.port_5432 || !state.read_only) {
    throw new Error("The public development-dataset exporter refused the PostgreSQL source identity");
  }
}

async function exportDataset(): Promise<void> {
  assertReadOnlyLocalDatabase(sourceConnectionString);
  const pool = new Pool({
    host: "127.0.0.1",
    port: 5432,
    database: "savinggrace_sermons_test",
    user: protectedLocalPostgresUser,
    password: protectedLocalPostgresPassword,
    max: 1,
    application_name: "saving-grace-public-development-dataset-export",
    options: "-c default_transaction_read_only=on"
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await verifySource(client);
    const { dataset } = await readPreviewDatasetRecords(client, { requireCompletedSourceReview: true });
    const content = serializePublicDataset(dataset);
    const questionAnswerCount = dataset.sermons.reduce(
      (count, sermon) => count + sermon.questionAnswers.length,
      0
    );
    const manifest: PreviewSermonDatasetManifest = {
      schemaVersion: previewDatasetVersion,
      contentFile: "sermons.json",
      contentSha256: sha256(content),
      expectedSermonCount: previewDatasetAllowedSlugs.length,
      expectedQuestionAnswerCount: questionAnswerCount,
      allowedSlugs: [...previewDatasetAllowedSlugs]
    };
    await mkdir(previewDatasetDirectory, { recursive: true });
    await writeFile(previewDatasetContentPath, content, { encoding: "utf8", flag: "w" });
    await writeFile(previewDatasetManifestPath, serializePublicDataset(manifest), {
      encoding: "utf8",
      flag: "w"
    });
    await client.query("ROLLBACK");
  } finally {
    client.release();
    await pool.end();
  }
  const verified = await loadTrackedPreviewDataset();
  process.stdout.write(JSON.stringify({
    outcome: "exported",
    sermons: verified.dataset.sermons.length,
    questionAnswers: verified.manifest.expectedQuestionAnswerCount,
    contentSha256: verified.contentSha256,
    manifestSha256: verified.manifestSha256
  }) + "\n");
}

exportDataset().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown public dataset export error";
  process.stderr.write(`Public development-dataset export failed: ${message}\n`);
  process.exitCode = 1;
});

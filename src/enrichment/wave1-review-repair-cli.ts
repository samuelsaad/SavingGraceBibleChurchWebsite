import { Pool } from "pg";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import {
  repairWave1GuidedReviewMetadata,
  verifyWave1GuidedReviewApplication,
  Wave1ReviewRepairError
} from "./wave1-review-repair";

async function main(): Promise<void> {
  if (process.argv.slice(2).length !== 0) throw new Error("The Wave 1 review repair accepts no arguments");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const pool = new Pool({
    connectionString,
    max: 1,
    application_name: "saving-grace-wave1-review-metadata-repair"
  });
  try {
    const result = await repairWave1GuidedReviewMetadata(pool);
    const application = await verifyWave1GuidedReviewApplication(pool);
    process.stdout.write(`${JSON.stringify({
      ...result,
      ...application
    })}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const safe = error instanceof Wave1ReviewRepairError
    ? { code: error.code, message: error.message }
    : { code: "wave1_review_repair_failed", message: "The Wave 1 guided-review repair failed safely" };
  process.stderr.write(`${JSON.stringify({ outcome: "failed", error: safe })}\n`);
  process.exitCode = 1;
});

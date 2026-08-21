import { Pool } from "pg";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import {
  OfficialTitlePassageRepairError,
  repairCurrent15FromOfficialTitles
} from "./primary-passage-official-title-repair";

async function main(): Promise<void> {
  if (process.argv.slice(2).length !== 0) throw new Error("The official-title passage repair accepts no arguments");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const pool = new Pool({
    connectionString,
    user: protectedLocalPostgresUser,
    password: protectedLocalPostgresPassword,
    max: 1,
    application_name: "saving-grace-current15-official-title-passage-repair"
  });
  try {
    process.stdout.write(`${JSON.stringify(await repairCurrent15FromOfficialTitles(pool))}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const safe = error instanceof OfficialTitlePassageRepairError
    ? { code: error.code, message: error.message }
    : { code: "official_title_passage_repair_failed", message: "The bounded official-title passage repair failed safely" };
  process.stderr.write(`${JSON.stringify({ outcome: "failed", error: safe })}\n`);
  process.exitCode = 1;
});

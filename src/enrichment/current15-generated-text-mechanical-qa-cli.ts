import { Pool } from "pg";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import {
  Current15MechanicalQaError,
  repairCurrent15GeneratedTextMechanicalQa
} from "./current15-generated-text-mechanical-qa";

async function main(): Promise<void> {
  if (process.argv.slice(2).length !== 0) throw new Error("The current-15 mechanical QA command accepts no arguments");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const pool = new Pool({
    connectionString,
    user: protectedLocalPostgresUser,
    password: protectedLocalPostgresPassword,
    max: 1,
    application_name: "saving-grace-current15-generated-text-mechanical-qa"
  });
  try {
    process.stdout.write(`${JSON.stringify(await repairCurrent15GeneratedTextMechanicalQa(pool))}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const safe = error instanceof Current15MechanicalQaError
    ? { code: error.code, message: error.message }
    : { code: "current15_generated_text_mechanical_qa_failed", message: "The bounded current-15 mechanical QA failed safely" };
  process.stderr.write(`${JSON.stringify({ outcome: "failed", error: safe })}\n`);
  process.exitCode = 1;
});

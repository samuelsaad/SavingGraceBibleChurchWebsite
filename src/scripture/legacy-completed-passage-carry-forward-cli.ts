import { Pool } from "pg";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import {
  carryForwardLegacyCompletedPassageReviews,
  LegacyPassageCarryForwardError
} from "./legacy-completed-passage-carry-forward";

async function main(): Promise<void> {
  if (process.argv.slice(2).length !== 0) {
    throw new Error("The legacy passage carry-forward command accepts no arguments");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const pool = new Pool({
    connectionString,
    user: protectedLocalPostgresUser,
    password: protectedLocalPostgresPassword,
    max: 1,
    application_name: "saving-grace-legacy-completed-passage-carry-forward"
  });
  try {
    process.stdout.write(`${JSON.stringify(await carryForwardLegacyCompletedPassageReviews(pool))}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const safe = error instanceof LegacyPassageCarryForwardError
    ? { code: error.code, message: error.message }
    : { code: "legacy_passage_carry_forward_failed", message: "The bounded legacy passage carry-forward failed safely" };
  process.stderr.write(`${JSON.stringify({ outcome: "failed", error: safe })}\n`);
  process.exitCode = 1;
});

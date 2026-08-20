import { Pool } from "pg";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import {
  prepareCurrent15PrimaryPassages,
  PrimaryPassagePreparationError
} from "./primary-passage-preparation";

async function main(): Promise<void> {
  if (process.argv.slice(2).length !== 0) throw new Error("The primary-passage preparation command accepts no arguments");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const pool = new Pool({
    connectionString,
    user: protectedLocalPostgresUser,
    password: protectedLocalPostgresPassword,
    max: 1,
    application_name: "saving-grace-current15-primary-passage-preparation"
  });
  try {
    const result = await prepareCurrent15PrimaryPassages(pool);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const databaseCode = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code.replace(/[^A-Za-z0-9_-]/gu, "")
    : null;
  const errorName = error instanceof Error ? error.name.replace(/[^A-Za-z0-9_-]/gu, "") : null;
  const constraint = error && typeof error === "object" && "constraint" in error && typeof error.constraint === "string"
    ? error.constraint.replace(/[^A-Za-z0-9_-]/gu, "")
    : null;
  const safe = error instanceof PrimaryPassagePreparationError
    ? { code: error.code, message: error.message }
    : {
        code: `primary_passage_preparation_failed${databaseCode ? `_${databaseCode}` : ""}${constraint ? `_${constraint}` : ""}${errorName ? `_${errorName}` : ""}`,
        message: "The bounded primary-passage preparation failed safely"
      };
  process.stderr.write(`${JSON.stringify({ outcome: "failed", error: safe })}\n`);
  process.exitCode = 1;
});

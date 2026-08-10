import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  assertDisposableIntegrationTestDatabase,
  disposableIntegrationDatabaseName
} from "../src/migration/local-database-safety";
import {
  protectedLocalPostgresPassword,
  protectedLocalPostgresUser
} from "../src/migration/protected-local-postgres";

function runToken(): string {
  const timestamp = new Date().toISOString().replace(/\D/gu, "").toLowerCase();
  return `${timestamp}${randomBytes(8).toString("hex")}`;
}

function runVitest(environment: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolveExit, reject) => {
    const child = spawn(
      process.execPath,
      [resolve("node_modules/vitest/vitest.mjs"), "run"],
      { cwd: process.cwd(), env: environment, stdio: "inherit", windowsHide: true }
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`The PostgreSQL test process ended with signal ${signal}`));
      else resolveExit(code ?? 1);
    });
  });
}

async function verifyAdministratorConnection(pool: Pool): Promise<void> {
  const identity = await pool.query<{
    server_16: boolean;
    loopback: boolean;
    port_5432: boolean;
    admin_database: boolean;
    postgres_server: boolean;
  }>(`SELECT
      current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
      inet_server_addr() = '127.0.0.1'::inet AS loopback,
      inet_server_port() = 5432 AS port_5432,
      current_database() = 'postgres' AS admin_database,
      version() LIKE 'PostgreSQL%' AS postgres_server`);
  if (!Object.values(identity.rows[0] ?? {}).every(Boolean)) {
    throw new Error("The disposable PostgreSQL test runner refused the local server identity");
  }
}

async function main(): Promise<void> {
  const token = runToken();
  const databaseName = disposableIntegrationDatabaseName(token);
  const testConnectionString = `postgresql://127.0.0.1:5432/${databaseName}`;
  assertDisposableIntegrationTestDatabase(testConnectionString, token, "1");

  const admin = new Pool({
    host: "127.0.0.1",
    port: 5432,
    database: "postgres",
    user: protectedLocalPostgresUser,
    password: protectedLocalPostgresPassword,
    max: 1,
    application_name: "saving-grace-disposable-test-runner"
  });
  let created = false;
  let cleanupAuthorised = false;
  let testExitCode = 1;
  try {
    await verifyAdministratorConnection(admin);
    const existing = await admin.query<{ present: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS present",
      [databaseName]
    );
    if (existing.rows[0]?.present) {
      throw new Error("The unique disposable PostgreSQL test database already exists");
    }
    cleanupAuthorised = true;
    await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`);
    created = true;
    process.stdout.write("Created one verified disposable loopback PostgreSQL test database.\n");
    testExitCode = await runVitest({
      ...process.env,
      RUN_POSTGRES_INTEGRATION: "1",
      ALLOW_LOCAL_DB_WRITE: "1",
      TEST_DATABASE_URL: testConnectionString,
      DISPOSABLE_TEST_DATABASE_TOKEN: token
    });
  } finally {
    try {
      if (cleanupAuthorised) {
        assertDisposableIntegrationTestDatabase(testConnectionString, token, "1");
        const present = await admin.query<{ present: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS present",
          [databaseName]
        );
        if (present.rows[0]?.present) {
          await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
        }
        const remaining = await admin.query<{ present: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS present",
          [databaseName]
        );
        if (remaining.rows[0]?.present) {
          throw new Error("The verified disposable PostgreSQL test database was not removed");
        }
        if (created) process.stdout.write("Removed the exact disposable PostgreSQL test database.\n");
      }
    } finally {
      await admin.end();
    }
  }
  if (testExitCode !== 0) process.exitCode = testExitCode;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown disposable PostgreSQL test failure";
  process.stderr.write(`Disposable PostgreSQL test runner failed: ${message}\n`);
  process.exitCode = 1;
});

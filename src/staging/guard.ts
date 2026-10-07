import { readFileSync, lstatSync } from "node:fs";
import type { PoolClient } from "pg";

export const stagingDatabase = "savinggrace_staging";
// Freshness selectors contain many correlated receipt checks. LLVM compilation
// of those small-inventory plans can exceed the sealed database memory budget
// under concurrent archive requests. Disable JIT only for application reader
// sessions; all predicates, read-only guards and statement limits still run.
const stagingReaderOptions = "-c default_transaction_read_only=on -c timezone=UTC -c jit=off";
export function stagingDraftPreviewConfiguration(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== "production" || env.STAGING_SEALED !== "1"
    || env.DB_HOST !== "127.0.0.1" || env.DB_PORT !== "5433" || env.DB_NAME !== stagingDatabase
    || env.ENABLE_LOCAL_TEST_IDENTITIES || env.ENABLE_LOCAL_DASHBOARD || env.DATABASE_URL
    || env.PGHOST || env.PGUSER || env.PGPASSWORD || env.PGSERVICE || env.PGOPTIONS
    || !/^[0-9a-f]{40}$/.test(env.RELEASE_COMMIT ?? "")) throw new Error("staging_draft_preview_configuration_refused");
  return { host: "127.0.0.1", port: 5433, database: stagingDatabase, user: "staging_reader",
    passwordFile: "/run/secrets/db_reader_password", max: 2, connectionTimeoutMillis: 5000,
    statement_timeout: 15000, application_name: "sealed-staging-d160-draft-preview",
    options: stagingReaderOptions };
}

export function stagingConfiguration(env: NodeJS.ProcessEnv, maintenance = false) {
  if (env.NODE_ENV !== "production" || env.STAGING_SEALED !== "1"
    || env.DB_HOST !== "db" || env.DB_PORT !== "5432" || env.DB_NAME !== stagingDatabase
    || env.ENABLE_LOCAL_TEST_IDENTITIES || env.ENABLE_LOCAL_DASHBOARD || env.DATABASE_URL
    || env.PGHOST || env.PGUSER || env.PGPASSWORD || env.PGSERVICE || env.PGOPTIONS
    || !/^[0-9a-f]{40}$/.test(env.RELEASE_COMMIT ?? "")) throw new Error("staging_configuration_refused");
  const user = maintenance ? "postgres" : "staging_reader";
  const path = maintenance ? "/run/secrets/db_owner_password" : "/run/secrets/db_reader_password";
  return { host: "db", port: 5432, database: stagingDatabase, user, passwordFile: path,
    max: 4, connectionTimeoutMillis: 5000, statement_timeout: 15000,
    application_name: maintenance ? "sealed-staging-maintenance" : "sealed-staging-read-only",
    options: maintenance ? "-c timezone=UTC" : stagingReaderOptions };
}

export function stagingPassword(path: string): string {
  if (!["/run/secrets/db_owner_password", "/run/secrets/db_reader_password"].includes(path)
    || !lstatSync(path).isFile()) throw new Error("staging_secret_refused");
  const password = readFileSync(path, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(password)) throw new Error("staging_secret_refused");
  return password;
}

export async function verifyStagingIdentity(client: Pick<PoolClient, "query">, maintenance = false) {
  const result = await client.query(`SELECT current_database() AS database,
    current_user AS role, current_setting('server_version_num')::integer AS version,
    inet_server_port() AS port, inet_server_addr() IS NOT NULL AS tcp,
    current_setting('transaction_read_only') AS read_only,
    (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser`);
  const row = result.rows[0];
  if (!row || row.database !== stagingDatabase || row.port !== 5432 || !row.tcp
    || row.version < 160000 || row.version >= 170000
    || row.role !== (maintenance ? "postgres" : "staging_reader")
    || (!maintenance && (row.superuser || row.read_only !== "on"))) throw new Error("staging_target_refused");
}

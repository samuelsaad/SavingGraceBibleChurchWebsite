/** Existing development identity, loopback only. No migrations or data setup. */
import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../src/migration/protected-local-postgres";
import { assertDisposableLocalDatabase } from "../src/migration/local-database-safety";

async function start() {
  const url = new URL("postgresql://127.0.0.1:5432/savinggrace_sermons_test");
  url.username = protectedLocalPostgresUser;
  url.password = await protectedLocalPostgresPassword();
  process.env.ALLOW_LOCAL_DB_WRITE = "1";
  assertDisposableLocalDatabase(url.href);
  const probe = new Pool({ connectionString: url.href, max: 1, options: "-c default_transaction_read_only=on" });
  try {
    const { rows } = await probe.query("SELECT current_database() db, current_setting('server_version_num')::int version, inet_server_addr()::text host, inet_server_port() port");
    if (rows[0]?.db !== "savinggrace_sermons_test" || rows[0].version < 160000 || rows[0].version >= 170000 || rows[0].host !== "127.0.0.1/32" && rows[0].host !== "127.0.0.1" || rows[0].port !== 5432) throw Error("local_target_mismatch");
  } finally { await probe.end(); }
  process.env.DATABASE_URL = url.href;
  process.env.API_HOST = "127.0.0.1";
  process.env.API_PORT ??= "4406";
  process.env.ENABLE_LOCAL_TEST_IDENTITIES = "1";
  process.env.ENABLE_LOCAL_DASHBOARD = "1";
  await import("../src/server/local-api");
}
start().catch(() => { process.stderr.write("Local workbench startup failed; protected configuration or target check did not pass.\n"); process.exitCode=1; });

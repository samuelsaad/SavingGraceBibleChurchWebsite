import { createServer } from "node:http";
import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../src/migration/protected-local-postgres";
import { authorisedReadOnlyPreviewDatabaseName } from "../src/migration/local-database-safety";
import { PostgresAdminSermonRepository } from "../src/server/repositories/postgres-admin-sermon-repository";
import { PostgresSermonRepository } from "../src/server/repositories/postgres-sermon-repository";
import { LocalTestIdentityProvider } from "../src/server/auth/local-test-identity-provider";
import { LocalFrontendPreviewSession } from "../src/server/auth/local-frontend-preview-session";
import { createApplicationApiRouter } from "../src/server/http/application-api-router";
import { createLocalFrontendPreviewHandler } from "../src/server/http/local-frontend-preview";
import { serveLocalDashboard } from "../src/server/http/local-dashboard-static";
import { toWebRequest } from "../src/server/http/node-request-adapter";
import { readOnlyVerificationHandler } from "./read-only-handler";

// Verification only: existing read-only target guard; no database-write opt-in.
async function main() {
  const database = authorisedReadOnlyPreviewDatabaseName("postgresql://127.0.0.1:5432/savinggrace_sermons_test");
  const pool = new Pool({ host: "127.0.0.1", port: 5432, database, user: protectedLocalPostgresUser,
    password: protectedLocalPostgresPassword, options: "-c default_transaction_read_only=on", max: 3 });
  const identity = await pool.query(`SELECT current_database()='savinggrace_sermons_test' database,
    inet_server_addr()='127.0.0.1'::inet loopback, inet_server_port()=5432 port,
    current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 version,
    current_setting('transaction_read_only')='on' read_only`);
  if (!Object.values(identity.rows[0]).every(Boolean)) throw new Error("verification_target_refused");
  const identityProvider = new LocalTestIdentityProvider(true, "development");
  const session = new LocalFrontendPreviewSession();
  const preview = createLocalFrontendPreviewHandler(new PostgresSermonRepository(pool, "completed_preview"), session);
  const api = createApplicationApiRouter(new PostgresSermonRepository(pool), new PostgresAdminSermonRepository(pool), identityProvider);
  const handler = readOnlyVerificationHandler(request => session.issue(request, identityProvider),
    async request => (await preview(request)) ?? (await serveLocalDashboard(request, true)) ?? await api(request));
  const server = createServer(async (incoming, outgoing) => {
    try {
      const response = await handler(await toWebRequest(incoming, "http://127.0.0.1:4361", 16384));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(503); outgoing.end("verification_unavailable"); }
  });
  server.listen(4361, "127.0.0.1", () => process.stdout.write("read_only_integrated_verification_ready\n"));
  const stop = () => server.close(() => { void pool.end().then(() => process.exit(0)); });
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
}
main().catch(() => { process.stderr.write("read_only_verification_server_refused\n"); process.exitCode = 1; });

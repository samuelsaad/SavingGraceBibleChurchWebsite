import { createServer } from "node:http";
import { authorisedReadOnlyPreviewDatabaseName } from "../migration/local-database-safety";
import { LocalFrontendPreviewSession } from "./auth/local-frontend-preview-session";
import { LocalTestIdentityProvider } from "./auth/local-test-identity-provider";
import { createPostgresPool } from "./database";
import { createLocalFrontendPreviewHandler } from "./http/local-frontend-preview";
import { serveLocalDashboard } from "./http/local-dashboard-static";
import { siteAssetResponse } from "./http/site-assets";
import { IncomingRequestTooLargeError, toWebRequest } from "./http/node-request-adapter";
import { assertLoopbackApiHost } from "./local-api-safety";
import { PostgresSermonRepository } from "./repositories/postgres-sermon-repository";
import { localFrontendPreviewScope } from "./restricted-preview-scope";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const expectedDatabaseName = authorisedReadOnlyPreviewDatabaseName(connectionString);

const hostname = process.env.API_HOST ?? "127.0.0.1";
assertLoopbackApiHost(hostname);
const port = Number(process.env.API_PORT ?? "4322");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("API_PORT must be a valid TCP port");
}

const pool = createPostgresPool(connectionString, { readOnly: true, max: 2 });
const identity = await pool.query<{
  database_ok: boolean;
  loopback_ok: boolean;
  port_ok: boolean;
  postgres_16: boolean;
  read_only: boolean;
}>(`SELECT
  current_database() = $1 AS database_ok,
  inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet) AS loopback_ok,
  inet_server_port() = 5432 AS port_ok,
  current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS postgres_16,
  current_setting('transaction_read_only') = 'on' AS read_only`, [expectedDatabaseName]);
if (!Object.values(identity.rows[0] ?? {}).every(Boolean)) {
  await pool.end();
  throw new Error("The local frontend preview database identity or read-only guard did not match");
}

const session = new LocalFrontendPreviewSession();
const identityProvider = new LocalTestIdentityProvider(
  process.env.ENABLE_LOCAL_TEST_IDENTITIES === "1"
);
const preview = createLocalFrontendPreviewHandler(
  new PostgresSermonRepository(pool, localFrontendPreviewScope(process.env)),
  session
);

const server = createServer(async (incoming, outgoing) => {
  try {
    const originHostname = hostname.includes(":") ? `[${hostname}]` : hostname;
    const request = await toWebRequest(incoming, `http://${originHostname}:${port}`);
    const pathname = new URL(request.url).pathname;
    const response = pathname === "/api/v1/admin/frontend-preview-session"
      ? await session.issue(request, identityProvider)
      : siteAssetResponse(request)
        ?? (await preview(request))
        ?? (await serveLocalDashboard(request, true))
        ?? new Response("Not found", {
          status: 404,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow, noarchive"
          }
        });
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.statusCode = error instanceof IncomingRequestTooLargeError ? 413 : 500;
    outgoing.setHeader("Content-Type", "application/json; charset=utf-8");
    outgoing.setHeader("Cache-Control", "no-store");
    outgoing.end(JSON.stringify({
      error: {
        code: error instanceof IncomingRequestTooLargeError
          ? "request_too_large"
          : "internal_error"
      }
    }));
  }
});

server.listen(port, hostname, () => {
  process.stdout.write(`Read-only local frontend preview listening on http://${hostname}:${port}\n`);
});

async function shutdown(): Promise<void> {
  server.close();
  await pool.end();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

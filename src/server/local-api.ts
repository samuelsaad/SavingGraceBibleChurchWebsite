import { createServer } from "node:http";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import { LocalTestIdentityProvider } from "./auth/local-test-identity-provider";
import { createPostgresPool } from "./database";
import { createApplicationApiRouter } from "./http/application-api-router";
import { IncomingRequestTooLargeError, toWebRequest } from "./http/node-request-adapter";
import { serveLocalDashboard } from "./http/local-dashboard-static";
import { PostgresAdminSermonRepository } from "./repositories/postgres-admin-sermon-repository";
import { PostgresSermonRepository } from "./repositories/postgres-sermon-repository";
import { assertLoopbackApiHost } from "./local-api-safety";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
assertDisposableLocalDatabase(connectionString);

const hostname = process.env.API_HOST ?? "127.0.0.1";
assertLoopbackApiHost(hostname);
const port = Number(process.env.API_PORT ?? "4322");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("API_PORT must be a valid TCP port");
}

const pool = createPostgresPool(connectionString);
const route = createApplicationApiRouter(
  new PostgresSermonRepository(pool),
  new PostgresAdminSermonRepository(pool),
  new LocalTestIdentityProvider(process.env.ENABLE_LOCAL_TEST_IDENTITIES === "1")
);
const server = createServer(async (incoming, outgoing) => {
  try {
    const originHostname = hostname.includes(":") ? `[${hostname}]` : hostname;
    const request = await toWebRequest(incoming, `http://${originHostname}:${port}`);
    const response =
      (await serveLocalDashboard(
        request,
        process.env.ENABLE_LOCAL_DASHBOARD === "1"
      )) ?? (await route(request));
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.statusCode = error instanceof IncomingRequestTooLargeError ? 413 : 500;
    outgoing.setHeader("Content-Type", "application/json; charset=utf-8");
    outgoing.end(
      JSON.stringify({
        error: {
          code: error instanceof IncomingRequestTooLargeError ? "request_too_large" : "internal_error"
        }
      })
    );
  }
});

server.listen(port, hostname, () => {
  const dashboard = process.env.ENABLE_LOCAL_DASHBOARD === "1" ? " and dashboard" : "";
  process.stdout.write(`Local sermon API${dashboard} listening on http://${hostname}:${port}\n`);
});

async function shutdown(): Promise<void> {
  server.close();
  await pool.end();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

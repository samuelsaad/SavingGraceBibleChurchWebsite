import { createServer } from "node:http";
import { authorisedReadOnlyPreviewDatabaseName } from "../migration/local-database-safety";
import { LocalFrontendPreviewSession } from "./auth/local-frontend-preview-session";
import { LocalTestIdentityProvider } from "./auth/local-test-identity-provider";
import { createPostgresPool } from "./database";
import { createLocalFrontendPreviewHandler } from "./http/local-frontend-preview";
import { frontendResponseHeaders } from "./http/frontend-response";
import { IncomingRequestTooLargeError, toWebRequest } from "./http/node-request-adapter";
import { assertLoopbackApiHost } from "./local-api-safety";
import { PostgresSermonRepository } from "./repositories/postgres-sermon-repository";
import { d160DraftProcessingVersion, d160DraftSourceStatus } from "./queries/public-sermons";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const expectedDatabaseName = authorisedReadOnlyPreviewDatabaseName(connectionString);
const hostname = process.env.API_HOST ?? "127.0.0.1";
assertLoopbackApiHost(hostname);
const port = Number(process.env.API_PORT ?? "4392");
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("API_PORT must be valid");

const pool = createPostgresPool(connectionString, { readOnly: true, max: 2 });
const verified = await pool.query<{ identity_ok: boolean; records: number }>(`SELECT
  current_database() = $1
    AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet)
    AND inet_server_port() = 5432
    AND current_setting('server_version_num')::integer BETWEEN 160000 AND 169999
    AND current_setting('transaction_read_only') = 'on' AS identity_ok,
  (SELECT count(*)::integer FROM sermons s
   WHERE s.source_status = $2
     AND EXISTS (SELECT 1 FROM sermon_enrichment_sources source
       WHERE source.sermon_id=s.id AND source.processing_version=$3)) AS records`,
  [expectedDatabaseName, d160DraftSourceStatus, d160DraftProcessingVersion]);
if (!verified.rows[0]?.identity_ok || verified.rows[0].records !== 36) {
  await pool.end();
  throw new Error("d160_local_preview_identity_refused");
}

const session = new LocalFrontendPreviewSession();
const identityProvider = new LocalTestIdentityProvider(process.env.ENABLE_LOCAL_TEST_IDENTITIES === "1");
const preview = createLocalFrontendPreviewHandler(
  new PostgresSermonRepository(pool, "d160_draft_preview"),
  session,
  { root: "/draft-preview" }
);
const landing = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow,noarchive"><title>D-160 private draft preview</title></head><body><main><h1>D-160 private draft preview</h1><p>Read-only local access to 36 private drafts awaiting administrator review.</p><button id="open" type="button">Open protected preview</button><p id="status" role="status"></p></main><script>document.getElementById("open").addEventListener("click",async()=>{const r=await fetch("/api/v1/admin/d160-preview-session",{method:"POST",headers:{"x-local-identity":"admin"}});if(r.ok)location.href="/draft-preview/";else document.getElementById("status").textContent="The local administrator preview session could not be started.";});</script></body></html>`;

const server = createServer(async (incoming, outgoing) => {
  try {
    const request = await toWebRequest(incoming, `http://${hostname}:${port}`);
    const pathname = new URL(request.url).pathname;
    const response = pathname === "/api/v1/admin/d160-preview-session"
      ? await session.issue(request, identityProvider)
      : pathname === "/"
        ? new Response(landing, { headers: frontendResponseHeaders(landing, { privatePreview: true }) })
        : (await preview(request)) ?? new Response("Not found", { status: 404 });
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.statusCode = error instanceof IncomingRequestTooLargeError ? 413 : 500;
    outgoing.setHeader("Cache-Control", "no-store");
    outgoing.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    outgoing.end("request_refused");
  }
});

server.listen(port, hostname, () => process.stdout.write(`d160_local_draft_preview_ready:${port}\n`));
const shutdown = () => server.close(() => { void pool.end().then(() => process.exit(0)); });
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

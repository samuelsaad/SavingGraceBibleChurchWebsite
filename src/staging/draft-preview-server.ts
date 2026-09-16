import { createServer } from "node:http";
import { Pool } from "pg";
import { createLocalFrontendPreviewHandler } from "../server/http/local-frontend-preview";
import { frontendResponseHeaders } from "../server/http/frontend-response";
import { toWebRequest } from "../server/http/node-request-adapter";
import { d160DraftProcessingVersion, d160DraftSourceStatus } from "../server/queries/public-sermons";
import { PostgresSermonRepository } from "../server/repositories/postgres-sermon-repository";
import { TunnelDraftPreviewSession } from "./draft-preview-session";
import { stagingDraftPreviewConfiguration, stagingPassword, verifyStagingIdentity } from "./guard";

async function main() {
  const config = stagingDraftPreviewConfiguration(process.env);
  const pool = new Pool({ ...config, password: stagingPassword(config.passwordFile) });
  const verify = async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await verifyStagingIdentity(client);
      const result = await client.query(`SELECT count(*)::integer AS records FROM sermons s
        WHERE s.source_status=$1
          AND EXISTS (SELECT 1 FROM sermon_enrichment_sources source
            WHERE source.sermon_id=s.id AND source.processing_version=$2)`,
        [d160DraftSourceStatus, d160DraftProcessingVersion]);
      if (result.rows[0]?.records !== 36) throw new Error("d160_staging_preview_scope_refused");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  };
  await verify();
  const session = new TunnelDraftPreviewSession();
  const preview = createLocalFrontendPreviewHandler(
    new PostgresSermonRepository(pool, "d160_draft_preview"),
    session,
    { root: "/draft-preview" }
  );
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = await toWebRequest(incoming, "http://127.0.0.1:8081", 16_384);
      const url = new URL(request.url);
      let response: Response;
      if (url.pathname === "/health/ready") {
        await verify();
        response = new Response("ready", { headers: { "Cache-Control": "no-store" } });
      } else if (url.pathname === "/" || url.pathname === "/draft-preview/login/") {
        const page = session.loginPage();
        response = new Response(page, { headers: frontendResponseHeaders(page, { privatePreview: true }) });
      } else if (url.pathname === "/draft-preview/session") {
        response = await session.issue(request);
      } else {
        response = (await preview(request)) ?? new Response("Not found", { status: 404 });
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(400, { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
      outgoing.end("request_refused");
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.listen(8081, "127.0.0.1", () => process.stdout.write("d160_staging_draft_preview_ready\n"));
  const shutdown = () => server.close(() => { void pool.end().then(() => process.exit(0)); });
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

main().catch(() => {
  process.stderr.write("d160_staging_draft_preview_startup_refused\n");
  process.exitCode = 1;
});

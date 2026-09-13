import { createServer } from "node:http";
import { Pool } from "pg";
import { PostgresSermonRepository } from "../server/repositories/postgres-sermon-repository";
import { toWebRequest } from "../server/http/node-request-adapter";
import { stagingConfiguration, stagingPassword, verifyStagingIdentity } from "./guard";
import { verifyReleaseSchema } from "./database-verification";
import { createSealedStagingHandler } from "./handler";

async function main() {
  const config = stagingConfiguration(process.env);
  const pool = new Pool({ ...config, password: stagingPassword(config.passwordFile) });
  const ready = async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await verifyStagingIdentity(client);
      await verifyReleaseSchema(client);
      const state = await client.query("SELECT count(*)::integer AS n FROM sermons WHERE status='published' OR published_at IS NOT NULL");
      if (state.rows[0].n !== 0) throw new Error("sealed_publication_state_refused");
    } finally { await client.query("ROLLBACK"); client.release(); }
  };
  await ready();
  const handler = createSealedStagingHandler(new PostgresSermonRepository(pool), ready, process.env.RELEASE_COMMIT!);
  const server = createServer(async (incoming, outgoing) => {
    try {
      const response = await handler(await toWebRequest(incoming, "http://127.0.0.1:8080", 16_384));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(400, { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }); outgoing.end("request_refused"); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  // Container-only listener: Compose publishes exclusively to host loopback.
  server.listen(8080, "0.0.0.0", () => process.stdout.write("sealed_staging_ready\n"));
  const shutdown = () => server.close(() => { void pool.end().then(() => process.exit(0)); });
  process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
}
main().catch(() => { process.stderr.write("sealed_staging_startup_refused\n"); process.exitCode = 1; });

import { createServer } from "node:http";
import { Pool } from "pg";
import { PostgresSermonRepository } from "../server/repositories/postgres-sermon-repository";
import { toWebRequest } from "../server/http/node-request-adapter";
import { stagingConfiguration, stagingPassword, verifyStagingIdentity } from "./guard";
import { verifyReleaseSchema } from "./database-verification";
import { createSealedStagingHandler } from "./handler";
import { verifyRestrictedPublicationBoundary } from "./restricted-publication-boundary";

async function main() {
  const config = stagingConfiguration(process.env);
  const pool = new Pool({ ...config, password: stagingPassword(config.passwordFile) });
  const ready = async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await verifyStagingIdentity(client);
      await verifyReleaseSchema(client);
      await verifyRestrictedPublicationBoundary(client,"sealed_staging");
    } finally { await client.query("ROLLBACK"); client.release(); }
  };
  await ready();
  const d161Enabled=process.env.D161_RESTRICTED_ACCEPTANCE_ENABLED==="1";
  const handler = createSealedStagingHandler(new PostgresSermonRepository(pool,d161Enabled?"d161_restricted_accepted":"restricted_accepted"), ready,
    process.env.RELEASE_COMMIT!, process.env.RESTRICTED_FRONTEND_DISABLED === "1");
  const server = createServer(async (incoming, outgoing) => {
    try {
      const response = await handler(await toWebRequest(incoming, "http://127.0.0.1:8080", 16_384));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch { outgoing.writeHead(400, { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }); outgoing.end("request_refused"); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  // Internal-only container listener; the guarded host socket exposes loopback.
  server.listen(8080, "0.0.0.0", () => process.stdout.write("sealed_staging_ready\n"));
  const shutdown = () => server.close(() => { void pool.end().then(() => process.exit(0)); });
  process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
}
main().catch(() => { process.stderr.write("sealed_staging_startup_refused\n"); process.exitCode = 1; });

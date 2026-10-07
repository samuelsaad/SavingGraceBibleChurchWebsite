import { createServer } from "node:http";
import { Pool } from "pg";
import { PostgresSermonRepository } from "../server/repositories/postgres-sermon-repository";
import { toWebRequest } from "../server/http/node-request-adapter";
import { stagingConfiguration, stagingPassword, verifyStagingIdentity } from "./guard";
import { stagingSchemaExpectation, verifyReleaseSchema } from "./database-verification";
import { createSealedStagingHandler } from "./handler";
import { verifyRestrictedPublicationBoundary } from "./restricted-publication-boundary";
import {loadCompletedCohort} from './completed-cohort';
import {stagingFrontendScope} from './frontend-scope';
import {verifyAcceptedSemanticSchema} from '../semantic/accepted-semantic-migration';
import {PostgresAcceptedSemanticRepository} from '../server/repositories/postgres-accepted-semantic-repository';
import {createRelatedThemesRuntime} from '../semantic/related-themes-runtime';
import {createRelatedThemesEvaluationHandler} from '../server/http/related-themes-evaluation';

async function main() {
  const config = stagingConfiguration(process.env);
  const scope=stagingFrontendScope(process.env);
  const completed = process.env.D171_COMPLETED_ENABLED === '1';
  if(completed)await loadCompletedCohort(process.env.D171_COHORT_FILE??'');
  const expectedSchema = completed ? 25 : stagingSchemaExpectation(process.env);
  const pool = new Pool({ ...config, password: stagingPassword(config.passwordFile) });
  const ready = async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await verifyStagingIdentity(client);
      if(completed)await verifyAcceptedSemanticSchema(client,{allowPreMigration:true});
      else await verifyReleaseSchema(client, expectedSchema as 21|22);
      await verifyRestrictedPublicationBoundary(client,"sealed_staging");
    } finally { await client.query("ROLLBACK"); client.release(); }
  };
  await ready();
  const environment=process.env.RELATED_THEMES_ENVIRONMENT??'staging_public';
  if(!['staging_public','staging_protected'].includes(environment))throw Error('semantic_environment_refused');
  const runtime=scope==='d175_completed'?await createRelatedThemesRuntime(new PostgresAcceptedSemanticRepository(pool,{environment:environment as 'staging_public'|'staging_protected',scope}),process.env):{};
  const handler = createSealedStagingHandler(new PostgresSermonRepository(pool,scope,runtime.reader), ready,
    process.env.RELEASE_COMMIT!, process.env.RESTRICTED_FRONTEND_DISABLED === "1",createRelatedThemesEvaluationHandler(runtime,''));
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

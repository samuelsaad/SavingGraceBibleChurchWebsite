import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../src/migration/protected-local-postgres";
import { databaseFingerprint, verifyReleaseSchema } from "../src/staging/database-verification";
import { PostgresAdminSermonRepository } from "../src/server/repositories/postgres-admin-sermon-repository";
import { PostgresSermonRepository } from "../src/server/repositories/postgres-sermon-repository";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";

async function main() {
  const pool = new Pool({ host: "127.0.0.1", port: 5432, database: "savinggrace_sermons_test",
    user: protectedLocalPostgresUser, password: protectedLocalPostgresPassword, max: 2,
    options: "-c default_transaction_read_only=on" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity = await client.query(`SELECT current_database()='savinggrace_sermons_test' database,
      inet_server_addr()='127.0.0.1'::inet loopback, inet_server_port()=5432 port,
      current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 version,
      current_setting('transaction_read_only')='on' read_only`);
    if (!Object.values(identity.rows[0]).every(Boolean)) throw new Error("local_target_mismatch");
    const schema = await verifyReleaseSchema(client);
    const snapshot = await databaseFingerprint(client);
    const review = await new PostgresAdminSermonRepository(pool).listRemainingAiReviews();
    const query = publicSermonListQuerySchema.parse({ pageSize: 1 });
    const preview = await new PostgresSermonRepository(pool, "completed_preview").listPublished(query);
    const publicResult = await new PostgresSermonRepository(pool).listPublished(query);
    process.stdout.write(JSON.stringify({ schema, fingerprint: snapshot.sha256, tableCount: snapshot.tables.length,
      counts: snapshot.counts, reviewRecords: review.length,
      aiCurrentPrivateComplete: review.filter(r => r.review.privateComplete).length,
      completedFrontendSelectorCount: preview.totalItems, publicSelectorCount: publicResult.totalItems }) + "\n");
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
}
main().catch(() => { process.stderr.write("local_read_only_verification_failed\n"); process.exitCode = 1; });

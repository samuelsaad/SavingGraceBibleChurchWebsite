import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { stagingConfiguration, stagingPassword, verifyStagingIdentity } from "./guard";
import { databaseFingerprint, verifyReleaseSchema } from "./database-verification";
import { runRestrictedAcceptanceCommand } from "../application/restricted-acceptance-command";

async function main() {
  const operation = process.argv[2];
  if (!["assert-empty", "verify", "fingerprint", "inspect", "capture-preservation", "verify-accepted", "apply-0019", "accept", "withdraw"].includes(operation ?? "")) throw new Error("operation_refused");
  const config = stagingConfiguration(process.env, true);
  const pool = new Pool({ ...config, password: stagingPassword(config.passwordFile), max: 1 });
  if (["inspect","capture-preservation","verify-accepted","apply-0019","accept","withdraw"].includes(operation!)) {
    try { process.stdout.write(JSON.stringify(await runRestrictedAcceptanceCommand(pool,"sealed_staging","/verification",operation!))+"\n"); }
    finally { await pool.end(); }
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await verifyStagingIdentity(client, true);
    if (operation === "assert-empty") {
      const state = await client.query("SELECT count(*)::integer AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'");
      if (state.rows[0].n !== 0) throw new Error("restore_target_not_empty");
      process.stdout.write(JSON.stringify({ status: "verified_empty_staging_target" }) + "\n");
    } else {
      const schema = await verifyReleaseSchema(client);
      const fingerprint = await databaseFingerprint(client);
      if (operation === "verify") {
        const expected = JSON.parse(readFileSync("/verification/snapshot.json", "utf8"));
        if (expected.sha256 !== fingerprint.sha256 || JSON.stringify(expected.counts) !== JSON.stringify(fingerprint.counts)) throw new Error("restore_fingerprint_mismatch");
      }
      process.stdout.write(JSON.stringify({ ...schema, ...fingerprint }) + "\n");
    }
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
}
main().catch(() => { process.stderr.write("staging_database_verification_refused\n"); process.exitCode = 1; });

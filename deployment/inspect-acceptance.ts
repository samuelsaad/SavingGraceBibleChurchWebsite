import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../src/migration/protected-local-postgres";
import { stagingConfiguration, stagingPassword, verifyStagingIdentity } from "../src/staging/guard";
import { inspectRestrictedAcceptance } from "../src/application/restricted-acceptance-evidence";
import { remainingDependencyHash } from "../src/domain/remaining-ai-review";
import { canonicalReviewJson } from "../src/domain/delegated-ai-review";

async function main() {
  const remote = process.env.STAGING_SEALED === "1";
  const config = remote ? stagingConfiguration(process.env, true) : null;
  const pool = new Pool(config ? { ...config, password: stagingPassword(config.passwordFile), max: 1 }
    : { host: "127.0.0.1", port: 5432, database: "savinggrace_sermons_test", user: protectedLocalPostgresUser,
      password: protectedLocalPostgresPassword, max: 1, options: "-c default_transaction_read_only=on" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    if (remote) await verifyStagingIdentity(client, true);
    else if (!(await client.query(`SELECT current_database()='savinggrace_sermons_test' AND inet_server_addr()='127.0.0.1'::inet
      AND inet_server_port()=5432 AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AS ok`)).rows[0].ok) throw new Error("wrong_target");
    const timezone = (await client.query("SHOW timezone")).rows[0].TimeZone;
    if (process.argv[2] === "diagnose-timezone") {
      const observations = [];
      for (const zone of ["UTC", "Australia/Sydney"]) {
        await client.query("SELECT set_config('TimeZone',$1,true)", [zone]);
        const candidate = await inspectRestrictedAcceptance(client);
        const reasons: Record<string, number> = {};
        for (const item of candidate.blocked) for (const reason of item.reasons) reasons[reason]=(reasons[reason]??0)+1;
        observations.push({ zone, eligible: candidate.members.length, blocked: candidate.blocked.length,
          manifestSha256: remainingDependencyHash(candidate), reasons });
      }
      process.stdout.write(JSON.stringify({ defaultTimezone: timezone, observations, readOnly: true, filesChanged: false })+"\n");
      return;
    }
    const manifest = await inspectRestrictedAcceptance(client);
    const bytes = canonicalReviewJson(manifest);
    const path = resolve(remote ? "/verification/acceptance-candidate.private.json" : "private/restricted-acceptance/candidate.private.json");
    if (!remote) mkdirSync(resolve("private/restricted-acceptance"), { recursive: true });
    if (existsSync(path)) {
      if (readFileSync(path, "utf8") !== bytes) throw new Error("preserved_candidate_differs");
    } else writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
    if (readFileSync(path, "utf8") !== bytes) throw new Error("reread_failed");
    process.stdout.write(JSON.stringify({ records: manifest.members.length + manifest.blocked.length,
      eligible: manifest.members.length, human: manifest.members.filter(m=>m.completionKind==="human").length,
      ai: manifest.members.filter(m=>m.completionKind==="ai").length, blocked: manifest.blocked.length,
      manifestSha256: remainingDependencyHash(manifest), rereadVerified: true, timezone }) + "\n");
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
}
main().catch(()=>{ process.stderr.write("restricted_acceptance_inspection_failed\n"); process.exitCode=1; });

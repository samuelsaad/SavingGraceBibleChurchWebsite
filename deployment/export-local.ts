import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, realpath, writeFile } from "node:fs/promises";
import { resolve, dirname, isAbsolute, relative } from "node:path";
import { spawn } from "node:child_process";
import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../src/migration/protected-local-postgres";
import { databaseFingerprint, verifyReleaseSchema } from "../src/staging/database-verification";

async function hashFile(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
async function main() {
  const exportDirectory = process.env.STAGING_EXPORT_DIRECTORY;
  if (!exportDirectory || !isAbsolute(exportDirectory)) throw new Error("export_directory_required");
  const directory = await realpath(exportDirectory);
  if (!relative(process.cwd(), directory).startsWith("..")) throw new Error("export_inside_repository_refused");
  for (let parent = directory; ; parent = dirname(parent)) {
    for (const marker of [".git", "Dockerfile"]) {
      if (await access(resolve(parent, marker)).then(() => true, () => false)) throw new Error("export_inside_build_or_git_context_refused");
    }
    if (dirname(parent) === parent) break;
  }
  const dumpPath = resolve(directory, "database.dump");
  const snapshotPath = resolve(directory, "snapshot.json");
  if (await access(dumpPath).then(() => true, () => false) || await access(snapshotPath).then(() => true, () => false)) throw new Error("existing_export_preserved");
  const password = await protectedLocalPostgresPassword();
  const pool = new Pool({ host: "127.0.0.1", port: 5432, database: "savinggrace_sermons_test",
    user: protectedLocalPostgresUser, password, max: 1, options: "-c default_transaction_read_only=on" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity = await client.query(`SELECT current_database()='savinggrace_sermons_test' AS database,
      inet_server_addr()='127.0.0.1'::inet AS loopback, inet_server_port()=5432 AS port,
      current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS version,
      current_setting('transaction_read_only')='on' AS read_only`);
    if (!Object.values(identity.rows[0]).every(Boolean)) throw new Error("local_export_target_refused");
    // This exporter freezes the pre-D-158 backup, never an already-mutated DB.
    await verifyReleaseSchema(client,18);
    const snapshot = await databaseFingerprint(client);
    const expected = { sermons: 155, transcripts: 155, descriptions: 155, qa: 1084, d156: 1121,
      d157_components: 847, ai_completions: 132, human_completions: 12, published: 0, publication_timestamps: 0 };
    if (JSON.stringify(snapshot.counts) !== JSON.stringify(expected)) {
      process.stdout.write(JSON.stringify({ status: "baseline_changed", counts: snapshot.counts }) + "\n");
      throw new Error("snapshot_baseline_changed");
    }
    const exported = await client.query("SELECT pg_export_snapshot() AS snapshot");
    const pgDump = process.env.PG_DUMP_BIN;
    if (!pgDump || !isAbsolute(pgDump)) throw new Error("explicit_pg_dump_required");
    await new Promise<void>((done, fail) => {
      const child = spawn(pgDump, ["--format=custom", "--no-owner", "--no-acl", "--no-password",
        "--host=127.0.0.1", "--port=5432", `--username=${protectedLocalPostgresUser}`,
        "--dbname=savinggrace_sermons_test", `--snapshot=${exported.rows[0].snapshot}`, `--file=${dumpPath}`],
      { windowsHide: true, stdio: "ignore", env: { ...process.env, PGPASSWORD: password } });
      child.once("error", () => fail(new Error("logical_dump_failed")));
      child.once("exit", (code) => code === 0 ? done() : fail(new Error("logical_dump_failed")));
    });
    const dumpSha256 = await hashFile(dumpPath);
    await writeFile(snapshotPath, JSON.stringify({ ...snapshot, dumpSha256, createdAt: new Date().toISOString() }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    process.stdout.write(JSON.stringify({ status: "consistent_logical_dump_created", counts: snapshot.counts,
      tableCount: snapshot.tables.length, fingerprint: snapshot.sha256, dumpSha256 }) + "\n");
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
}
main().catch(() => { process.stderr.write("protected_export_refused_or_failed\n"); process.exitCode = 1; });

import { execFileSync } from "node:child_process";
import { readFile, lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../src/migration/protected-local-postgres";

const words = (value: string) => value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const shingles = (value: string) => { const w = words(value); return w.slice(0, Math.max(0, w.length - 7)).map((_, i) => w.slice(i, i + 8).join(" ")); };
async function main() {
  const pool = new Pool({ host: "127.0.0.1", port: 5432, database: "savinggrace_sermons_test",
    user: protectedLocalPostgresUser, password: protectedLocalPostgresPassword,
    max: 1, options: "-c default_transaction_read_only=on" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const identity = await client.query(`SELECT current_database()='savinggrace_sermons_test' database,
      inet_server_addr()='127.0.0.1'::inet loopback, inet_server_port()=5432 port,
      current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 version`);
    if (!Object.values(identity.rows[0]).every(Boolean)) throw new Error("scan_target_refused");
    const content = await client.query(`SELECT summary AS body FROM sermons WHERE summary IS NOT NULL
      UNION ALL SELECT body_text FROM sermon_transcripts
      UNION ALL SELECT question_text FROM sermon_question_answers
      UNION ALL SELECT answer_text FROM sermon_question_answers`);
    const protectedWords = new Set(content.rows.flatMap(row => shingles(row.body)));
    const identities = await client.query("SELECT id::text, slug FROM sermons");
    const protectedIdentities = identities.rows.flatMap(row => [row.id, row.slug]);
    const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\r?\n/).filter(Boolean);
    const paths = new Set([...git("diff", "--name-only", "HEAD", "--diff-filter=ACMR"), ...git("ls-files", "--others", "--exclude-standard")]);
    const outputs: string[] = [];
    async function collect(path: string) {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        const child = join(path, entry.name);
        if (entry.isSymbolicLink()) throw new Error("output_symlink_refused");
        if (entry.isDirectory()) await collect(child); else outputs.push(child);
      }
    }
    await collect("dist"); await collect("dist-staging");
    const findings: Array<{ path: string; kind: string; count: number }> = [];
    for (const path of [...paths, ...outputs]) {
      if (!(await lstat(path)).isFile()) { findings.push({ path, kind: "non_regular_path", count: 1 }); continue; }
      const value = await readFile(path, "utf8");
      const output = outputs.includes(path);
      let baseline = "";
      if (!output) {
        for (const commit of ["ae8755ab93e446fa8c6da1f7ad32a39218a0fd45", "eae2954a1d749d2fde0341c173866c8adcf0776e"]) {
          try { baseline += execFileSync("git", ["show", `${commit}:${path.replace(/\\/g, "/")}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* New safe file. */ }
        }
      }
      const prior = new Set(shingles(baseline));
      const hits = new Set(shingles(value).filter(s => protectedWords.has(s) && !prior.has(s)));
      if (hits.size) findings.push({ path, kind: "new_private_prose_shingle", count: hits.size });
      const ids = protectedIdentities.filter(id => value.includes(id) && !baseline.includes(id));
      if (ids.length) findings.push({ path, kind: "new_protected_identity", count: ids.length });
      const secretPatterns = [ /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{40,}?-----END/g,
        /(?:AKIA|ASIA)[A-Z0-9]{16}/g, /(?:postgres(?:ql)?|mysql):\/\/[^\s:/]+:[^\s@]+@/g,
        /\bya29\.[a-zA-Z0-9_-]{30,}/g, /\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g ];
      for (const pattern of secretPatterns) {
        const newHits = [...value.matchAll(pattern)].filter(hit => !baseline.includes(hit[0]));
        if (newHits.length) findings.push({ path, kind: "credential_or_key_pattern", count: newHits.length });
      }
      if (/(?:\.pem$|\.key$|\.dump$|\.private\.|(^|[/\\])private[/\\]|\.env(?:\.|$)|youtube-oath)/i.test(path)) {
        findings.push({ path, kind: "prohibited_path", count: 1 });
      }
    }
    const stagingOutputs = await Promise.all(["server", "database"].map(name => readFile(`dist-staging/${name}.cjs`, "utf8")));
    if (stagingOutputs.some(value => value.includes("local-admin-0001") || value.includes("x-local-identity"))) findings.push({ path: "dist-staging", kind: "development_identity_in_runtime", count: 1 });
    process.stdout.write(JSON.stringify({ files: paths.size, outputs: outputs.length, sermonRecords: identities.rowCount,
      protectedShingles: protectedWords.size, findings, comparedAgainstBothSourceCommits: true }) + "\n");
    if (findings.length) process.exitCode = 1;
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
}
main().catch(() => { process.stderr.write("private_content_scan_failed_no_raw_output\n"); process.exitCode = 1; });

import { mkdir, readFile, writeFile, lstat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { protectedLocalPostgresPassword, protectedLocalPostgresUser } from "../migration/protected-local-postgres";
import { createTitlePlan, summarizeTitlePlan, applyTitlePlan, preservationSnapshot, guardedTitleTransaction, titleHash, type TitlePlan } from "./sermon-title-correction";

const planPath = resolve("private/title-corrections/before-after.private.json");
const receiptPath = resolve("private/title-corrections/applied.private.json");
interface FrozenPlan { plan: TitlePlan; fingerprints: Record<string, string> }
const changedIds = (plan: TitlePlan) => plan.records.filter((r) => r.assessment.outcome === "correctable").map((r) => r.id);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function privateStorage() {
  for (const path of [planPath, receiptPath]) {
    execFileSync("git", ["check-ignore", "--quiet", "--no-index", path], { stdio: "ignore" });
    const tracked = execFileSync("git", ["ls-files", "--", path], { encoding: "utf8" });
    if (tracked.trim()) throw Error("title_private_path_tracked");
  }
  for (const path of [resolve("private"), dirname(planPath), planPath, receiptPath]) {
    const stat = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw Error("title_private_storage_unavailable");
    });
    if (stat?.isSymbolicLink()) throw Error("title_private_path_symlink");
  }
  await mkdir(dirname(planPath), { recursive: true });
}

async function main() {
  const mode = process.argv[2];
  if (!["plan", "apply", "verify"].includes(mode ?? "")) throw Error("title_command_invalid");
  await privateStorage();
  const pool = new Pool({ host: "127.0.0.1", port: 5432, database: "savinggrace_sermons_test",
    user: protectedLocalPostgresUser, password: protectedLocalPostgresPassword, max: 1 });
  try {
    if (mode === "plan") {
      const result = await guardedTitleTransaction(pool, false, async (client) => {
        const plan = await createTitlePlan(client);
        return { plan, fingerprints: await preservationSnapshot(client, changedIds(plan)) };
      });
      const bytes = JSON.stringify(result, null, 2) + "\n";
      await writeFile(planPath, bytes, { flag: "wx", mode: 0o600 });
      await writeFile(`${planPath}.sha256`, titleHash(bytes), { flag: "wx", mode: 0o600 });
      console.log(JSON.stringify({ status: "private_plan_frozen", sha256: titleHash(bytes), ...summarizeTitlePlan(result.plan) }));
      return;
    }
    const bytes = await readFile(planPath, "utf8");
    const hash = titleHash(bytes);
    if ((await readFile(`${planPath}.sha256`, "utf8")) !== hash) throw Error("title_plan_integrity_failed");
    const saved = JSON.parse(bytes) as FrozenPlan;
    const result = await guardedTitleTransaction(pool, mode === "apply", async (client) => {
      if (!equal(await preservationSnapshot(client, changedIds(saved.plan)), saved.fingerprints)) throw Error("title_baseline_changed");
      const current = await createTitlePlan(client);
      if (!equal(current.records.map((r) => r.id), saved.plan.records.map((r) => r.id))) throw Error("title_scope_changed");
      for (const record of saved.plan.records) {
        const now = current.records.find((r) => r.id === record.id)!;
        if (!equal(record.sourceEvidence, now.sourceEvidence)) throw Error("title_evidence_changed");
      }
      const before = await preservationSnapshot(client, []);
      const applied = mode === "apply" ? await applyTitlePlan(client, saved.plan, hash) : null;
      const after = await createTitlePlan(client);
      if (!equal(await preservationSnapshot(client, changedIds(saved.plan)), saved.fingerprints)) throw Error("title_preservation_failed");
      for (const record of saved.plan.records) {
        const now = after.records.find((r) => r.id === record.id)!;
        const changed = record.assessment.outcome === "correctable";
        if (now.originalTitle !== (changed ? record.assessment.title : record.originalTitle) ||
            now.rowVersion !== record.rowVersion + (changed ? 1 : 0) ||
            (changed && (now.identityConfirmed || now.completedReview))) throw Error("title_postcondition_failed");
      }
      const afterHashes = await preservationSnapshot(client, []);
      if (applied?.corrected === 0 && !equal(before, afterHashes)) throw Error("title_idempotency_failed");
      return { status: "verified", applied, baselinePreserved: true,
        idempotent: applied?.corrected === 0, afterHashes, after };
    });
    if (mode === "apply" && result.applied!.corrected > 0) {
      await writeFile(receiptPath, JSON.stringify({ planSha256: hash, appliedAt: new Date().toISOString(), ...result }, null, 2), { flag: "wx", mode: 0o600 });
    }
    console.log(JSON.stringify({ status: result.status, applied: result.applied,
      preservation: result.baselinePreserved, idempotent: result.idempotent, ...summarizeTitlePlan(result.after) }));
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const code = /^title_[a-z_]+$/.test(message) ? message : "title_operation_failed_details_withheld";
  console.error(JSON.stringify({ status: "blocked", code }));
  process.exitCode = 1;
});

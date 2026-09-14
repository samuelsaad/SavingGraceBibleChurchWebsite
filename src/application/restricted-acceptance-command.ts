import { readFileSync, lstatSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { applyRestrictedAcceptance, withdrawRestrictedAcceptance, verifyAcceptanceTarget, type AcceptanceEnvironment } from "./restricted-acceptance-service";
import { applyRestrictedAcceptanceSchema } from "./restricted-acceptance-schema";
import { restrictedAcceptanceManifest } from "../domain/restricted-acceptance";
import { inspectRestrictedAcceptance } from "./restricted-acceptance-evidence";
import { remainingDependencyHash } from "../domain/remaining-ai-review";
import { restrictedPreservationFingerprint,verifyRestrictedAcceptedState } from "./restricted-acceptance-verification";

/** No HTTP caller. Private input location is fixed by the guarded entry point. */
export async function runRestrictedAcceptanceCommand(pool:Pool, environment:AcceptanceEnvironment, directory:string, operation:string) {
  if(!["inspect","capture-preservation","verify-accepted","apply-0019","accept","withdraw"].includes(operation)) throw new Error("restricted_operation_refused");
  if(operation==="capture-preservation"||operation==="verify-accepted"){
    const c=await pool.connect();try{
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await verifyAcceptanceTarget(c,environment,false);
      const raw=JSON.parse(readFileSync(resolve(directory,"acceptance-manifest.private.json"),"utf8"));
      const path=resolve(directory,"preservation.private.json");
      if(operation==="verify-accepted")return await verifyRestrictedAcceptedState(c,raw,JSON.parse(readFileSync(path,"utf8")));
      const evidence=await restrictedPreservationFingerprint(c,raw);
      if(evidence.counts.published!==0||evidence.counts.sermons!==155)throw new Error("restricted_baseline_mismatch");
      // A read-only maintenance container returns only aggregate fingerprints;
      // its host operator persists them in protected storage, never a directory mount.
      if(environment==="sealed_staging")return {status:"preservation_captured",evidence};
      if(existsSync(path)){if(readFileSync(path,"utf8")!==JSON.stringify(evidence))throw new Error("restricted_preserved_baseline_mismatch");}
      else writeFileSync(path,JSON.stringify(evidence),{flag:"wx",mode:0o600});
      return {status:"preservation_captured",sha256:evidence.sha256,fullFingerprint:evidence.fullFingerprint,counts:evidence.counts};
    }finally{await c.query("ROLLBACK");c.release();}
  }
  if(operation==="inspect") {
    const c=await pool.connect();try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await verifyAcceptanceTarget(c,environment,false);
      const candidate=await inspectRestrictedAcceptance(c);
      return {eligible:candidate.members.length,excluded:candidate.blocked.length,sha256:remainingDependencyHash(candidate)};
    } finally{await c.query("ROLLBACK");c.release();}
  }
  if(process.env.D158_OPERATION_AUTHORIZATION!==`D-158:${restrictedAcceptanceManifest}`) throw new Error("restricted_operation_authorization_required");
  // The pre-change backup is retained outside the package and must match its
  // protected verification receipt. A filename alone is not backup evidence.
  const backupPath=resolve(directory,"before.dump"), receiptPath=resolve(directory,"backup-integrity.private.json");
  if(!lstatSync(backupPath).isFile() || !lstatSync(receiptPath).isFile()) throw new Error("restricted_backup_missing");
  const backup=readFileSync(backupPath), receipt=JSON.parse(readFileSync(receiptPath,"utf8"));
  if(backup.subarray(0,5).toString()!=="PGDMP" || receipt.sha256!==createHash("sha256").update(backup).digest("hex") ||
    receipt.environment!==environment || receipt.verified!==true) throw new Error("restricted_backup_unverified");
  if(operation==="apply-0019") return applyRestrictedAcceptanceSchema(pool,environment);
  if(operation==="withdraw") {
    if(process.env.D158_WITHDRAWAL_AUTHORIZED!=="1") throw new Error("restricted_withdrawal_authorization_required");
    return withdrawRestrictedAcceptance(pool,JSON.parse(readFileSync(resolve(directory,"withdrawal-request.private.json"),"utf8")),environment);
  }
  return applyRestrictedAcceptance(pool,JSON.parse(readFileSync(resolve(directory,"acceptance-manifest.private.json"),"utf8")),environment);
}

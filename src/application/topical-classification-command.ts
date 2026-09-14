import { readFileSync, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { databaseFingerprint } from "../staging/database-verification";
import { parseTopicalManifest, topicalManifestHash, topicalAuthorization, topicalNamespace, topicalAuditAction } from "../domain/topical-classification";
import { applyTopicalClassification } from "./topical-classification-service";
import type { AcceptanceEnvironment } from "./restricted-acceptance-service";

/** Hash every original row, including original extension/audit rows. Omit only
 * this exact new operation's nine extension/audit inserts from the comparison. */
export async function topicalPreservationFingerprint(client: PoolClient, ids: string[]) {
  const proxy = { query: async (sql: string, args?: unknown[]) => {
    if (sql.includes('FROM public."sermon_extensions" t')) {
      return client.query(sql.replace('FROM public."sermon_extensions" t',
        'FROM public."sermon_extensions" t WHERE NOT (t.namespace=$1 AND t.sermon_id=ANY($2::uuid[]))'), [topicalNamespace, ids]);
    }
    if (sql.includes('FROM public."audit_events" t')) {
      return client.query(sql.replace('FROM public."audit_events" t',
        'FROM public."audit_events" t WHERE NOT (t.action=$1 AND t.entity_id=ANY($2::uuid[]))'), [topicalAuditAction, ids]);
    }
    return client.query(sql, args);
  }} as PoolClient;
  return databaseFingerprint(proxy);
}

/** Non-HTTP operator entry point. Scope and verified pre-change backup are fixed;
 * no database/identity/config values or content are accepted on a command line. */
export async function runTopicalClassificationCommand(pool: Pool, environment: AcceptanceEnvironment, directory: string) {
  if (process.env.TOPICAL_OPERATION_AUTHORIZATION !== `${topicalAuthorization}:${topicalManifestHash}`) throw new Error("topical_authorization_required");
  const read = (name: string) => {
    const path = resolve(directory, name), stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("topical_private_file_refused");
    return readFileSync(path);
  };
  const manifest = parseTopicalManifest(JSON.parse(read("manifest.private.json").toString("utf8")));
  const backup = read("before.dump"), receipt = JSON.parse(read("backup-integrity.private.json").toString("utf8"));
  if (backup.subarray(0, 5).toString() !== "PGDMP" || receipt.sha256 !== createHash("sha256").update(backup).digest("hex") ||
      receipt.environment !== environment || receipt.verified !== true || !/^[a-f0-9]{64}$/.test(receipt.fingerprint ?? "") ||
      receipt.manifestSha256 !== topicalManifestHash) throw new Error("topical_backup_unverified");
  return applyTopicalClassification(pool, manifest, environment, async c => {
    if ((await topicalPreservationFingerprint(c, manifest.sermonIds)).sha256 !== receipt.fingerprint) throw new Error("topical_original_record_conflict");
  });
}

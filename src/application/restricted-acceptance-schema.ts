import type { Pool } from "pg";
import { loadSchemaMigrations, validateSchemaMigrationJournal } from "../migration/schema-migrations";
import { verifyAcceptanceTarget, type AcceptanceEnvironment } from "./restricted-acceptance-service";

/** Exact additive migration only; cannot apply a different or earlier migration. */
export async function applyRestrictedAcceptanceSchema(pool:Pool, environment:AcceptanceEnvironment) {
  const migrations=await loadSchemaMigrations();
  if(migrations.length!==19 || migrations[18]?.id!=="0019_restricted_bulk_acceptance") throw new Error("restricted_schema_release_mismatch");
  const c=await pool.connect();let discard=false;
  try {
    await verifyAcceptanceTarget(c,environment);
    await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await c.query("SELECT pg_advisory_xact_lock(1397176899,1397111885)");
    const rows=(await c.query("SELECT migration_order,migration_id,checksum_sha256 FROM schema_migrations ORDER BY migration_order")).rows;
    const count=validateSchemaMigrationJournal(migrations,rows);
    if(count!==18 && count!==19) throw new Error("restricted_schema_baseline_mismatch");
    if(count===19) { await c.query("COMMIT"); return {outcome:"unchanged",applied:0}; }
    await c.query(migrations[18].upBody);
    await c.query("INSERT INTO schema_migrations(migration_order,migration_id,checksum_sha256) VALUES(19,$1,$2)",
      [migrations[18].id,migrations[18].checksumSha256]);
    if(environment==="sealed_staging") await c.query("GRANT SELECT ON sermon_restricted_acceptances,sermon_restricted_acceptance_withdrawals TO staging_reader");
    await c.query("COMMIT");return {outcome:"applied",applied:1};
  } catch {
    try{await c.query("ROLLBACK");}catch{discard=true;}
    throw new Error("restricted_schema_apply_refused");
  } finally {c.release(discard);}
}

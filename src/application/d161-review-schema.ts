import type{Pool}from"pg";
import{loadSchemaMigrations,validateSchemaMigrationJournal}from"../migration/schema-migrations";
import{verifyAcceptanceTarget,type AcceptanceEnvironment}from"./restricted-acceptance-service";

/** Applies only migration 0020 to an already verified 0019/0020 database. */
export async function applyD161ReviewSchema(pool:Pool,environment:AcceptanceEnvironment){
  const migrations=await loadSchemaMigrations();if(migrations.length<20||migrations[19]?.id!=="0020_d160_delegated_review_acceptance")throw new Error("d161_schema_release_mismatch");
  const c=await pool.connect();let discard=false;try{await verifyAcceptanceTarget(c,environment);await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await c.query("SELECT pg_advisory_xact_lock(1397176899,1397111886)");const rows=(await c.query("SELECT migration_order,migration_id,checksum_sha256 FROM schema_migrations ORDER BY migration_order")).rows;
    const count=validateSchemaMigrationJournal(migrations,rows);if(count!==19&&count!==20)throw new Error("d161_schema_baseline_mismatch");
    if(count===19){await c.query(migrations[19].upBody);await c.query("INSERT INTO schema_migrations(migration_order,migration_id,checksum_sha256) VALUES(20,$1,$2)",[migrations[19].id,migrations[19].checksumSha256]);}
    if(environment==="sealed_staging")await c.query(`GRANT SELECT ON delegated_ai_review_scopes,remaining_ai_review_scopes,sermon_ai_content_reviews,
      sermon_ai_component_reviews,sermon_ai_metadata_assignments,sermon_d161_restricted_acceptances,sermon_d161_restricted_acceptance_withdrawals TO staging_reader`);
    await c.query("COMMIT");return{outcome:count===19?"applied":"unchanged",applied:count===19?1:0};
  }catch{try{await c.query("ROLLBACK");}catch{discard=true;}throw new Error("d161_schema_apply_refused");}finally{c.release(discard);}
}

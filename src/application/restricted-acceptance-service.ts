import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { authorisedLocalDatabaseName, assertDisposableIntegrationTestDatabase } from "../migration/local-database-safety";
import { verifyStagingIdentity, stagingConfiguration } from "../staging/guard";
import { verifyReleaseSchema } from "../staging/database-verification";
import { inspectRestrictedAcceptance } from "./restricted-acceptance-evidence";
import { remainingDependencyHash } from "../domain/remaining-ai-review";
import { canonicalReviewJson } from "../domain/delegated-ai-review";
import { parseRestrictedManifest, restrictedAcceptanceAuthorizer, restrictedAcceptanceExecutor,
  restrictedAcceptanceFormat, restrictedAcceptanceManifest } from "../domain/restricted-acceptance";

export type AcceptanceEnvironment = "local_loopback" | "sealed_staging";
const fail = (code = "restricted_acceptance_evidence_or_concurrency_conflict"): never => { throw new Error(code); };

export async function verifyAcceptanceTarget(c: PoolClient, environment: AcceptanceEnvironment, write = true) {
  if (write && process.env.ALLOW_LOCAL_DB_WRITE!=="1") fail("restricted_acceptance_write_gate_required");
  if (environment === "sealed_staging") {
    stagingConfiguration(process.env, true);
    await verifyStagingIdentity(c,true);
  } else if (environment === "local_loopback") {
    const name = authorisedLocalDatabaseName();
    if (!(await c.query(`SELECT current_database()=$1 AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5432
      AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AS ok`,[name])).rows[0]?.ok) fail("restricted_acceptance_target_mismatch");
  } else fail("restricted_acceptance_target_mismatch");
}
function fixtureAllowed(): boolean {
  if (process.env.RUN_POSTGRES_INTEGRATION!=="1") return false;
  assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL??"",process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE);
  return true;
}
async function transaction<T>(pool:Pool, environment:AcceptanceEnvironment, work:(c:PoolClient)=>Promise<T>) {
  const c=await pool.connect(); let discard=false;
  try {
    await verifyAcceptanceTarget(c,environment);
    await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await c.query("SET LOCAL savinggrace.application_request='on'");
    await c.query("SET LOCAL statement_timeout='120s'");
    await c.query("SET LOCAL lock_timeout='10s'");
    // Freeze dependent metadata/decisions as well as parent versions while the
    // exact operation validates and writes. Never mutate the excluded records.
    const names=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename as string);
    if (names.some(n=>!/^[_a-z]+$/.test(n))) fail();
    await c.query(`LOCK TABLE ${names.map(n=>`public."${n}"`).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
    await verifyReleaseSchema(c);
    const result=await work(c); await c.query("COMMIT"); return result;
  } catch(error) {
    try { await c.query("ROLLBACK"); } catch { discard=true; }
    const code=error instanceof Error && /^restricted_acceptance_[a-z_]+$/.test(error.message) ? error.message : "restricted_acceptance_transaction_refused";
    return fail(code);
  } finally { c.release(discard); }
}

export async function applyRestrictedAcceptance(pool:Pool, raw:unknown, environment:AcceptanceEnvironment) {
  const manifest=parseRestrictedManifest(raw,fixtureAllowed()), hash=remainingDependencyHash(manifest);
  return transaction(pool,environment,async c=>{
    const receipts=(await c.query("SELECT * FROM sermon_restricted_acceptances ORDER BY sermon_id")).rows;
    if (receipts.length) {
      if (receipts.length!==manifest.members.length) fail();
      for (const member of manifest.members) {
        const prior=receipts.find(r=>r.sermon_id===member.sermonId);
        const current=(await c.query(`SELECT s.status,s.published_at,s.row_version,
          restricted_acceptance_dependency(s.id) AS digest,
          EXISTS(SELECT 1 FROM sermon_restricted_acceptance_withdrawals w WHERE w.sermon_id=s.id) AS withdrawn
          FROM sermons s WHERE s.id=$1`,[member.sermonId])).rows[0];
        if (!prior || !current || prior.manifest_sha256!==hash || prior.environment!==environment ||
          prior.evidence_sha256!==member.dependencySha256 || prior.previous_row_version!==member.rowVersion ||
          current.status!=="published" || current.withdrawn || current.row_version!==prior.published_row_version ||
          current.published_at?.getTime()!==prior.accepted_at.getTime() || current.digest!==prior.content_dependency_sha256) fail();
      }
      return { outcome:"unchanged" as const, accepted:0, unchanged:receipts.length, manifestSha256:hash };
    }
    const current=await inspectRestrictedAcceptance(c);
    if (canonicalReviewJson(current)!==canonicalReviewJson(manifest)) fail();
    const actual=(await c.query("SELECT id FROM sermons WHERE deleted_at IS NULL ORDER BY id")).rows.map(r=>r.id);
    const expected=[...manifest.members,...manifest.blocked].map(m=>m.sermonId).sort();
    if (canonicalReviewJson(actual)!==canonicalReviewJson(expected)) fail();
    const timestamp=(await c.query("SELECT clock_timestamp() AS at")).rows[0].at;
    for (const member of manifest.members) {
      const dependency=(await c.query("SELECT restricted_acceptance_dependency($1) AS digest",[member.sermonId])).rows[0].digest;
      const updated=await c.query(`UPDATE sermons SET status='published',published_at=$3,row_version=row_version+1,
        updated_at=$3,updated_by_subject=$4 WHERE id=$1 AND row_version=$2 AND status='draft' AND published_at IS NULL AND deleted_at IS NULL`,
        [member.sermonId,member.rowVersion,timestamp,restrictedAcceptanceExecutor]);
      if(updated.rowCount!==1) fail();
      await c.query(`INSERT INTO sermon_restricted_acceptances(sermon_id,decision,manifest_sha256,evidence_sha256,content_dependency_sha256,
        fingerprint_format,previous_row_version,published_row_version,authorized_by,executed_by,manual_review_claimed,passage_basis,environment,accepted_at)
        VALUES($1,'D-158',$2,$3,$4,$5,$6,$6+1,$7,$8,false,$9,$10,$11)`,
        [member.sermonId,hash,member.dependencySha256,dependency,restrictedAcceptanceFormat,member.rowVersion,
          restrictedAcceptanceAuthorizer,restrictedAcceptanceExecutor,member.passageBasis,environment,timestamp]);
      await c.query(`INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id)
        VALUES($1,'system','sermon.d158.restricted_bulk_acceptance','sermon',$2,'succeeded',$3::jsonb,$4)`,
        [restrictedAcceptanceExecutor,member.sermonId,JSON.stringify(["restrictedBulkAcceptance","status","publishedAt"]),hash]);
      if ((await c.query("SELECT restricted_acceptance_dependency($1) AS digest",[member.sermonId])).rows[0].digest!==dependency) fail();
    }
    return { outcome:"accepted" as const, accepted:manifest.members.length, unchanged:0, manifestSha256:hash };
  });
}

// Separate operator action, never called by a reader or acceptance rerun. Real
// use requires a new explicit withdrawal instruction; tests use guarded fixtures.
export async function withdrawRestrictedAcceptance(pool:Pool, raw:unknown, environment:AcceptanceEnvironment) {
  const parsed=z.object({ sermonId:z.uuid(), rowVersion:z.number().int().positive(), authorizationReference:z.string().min(8).max(200),
    reason:z.string().min(3).max(500), manifestSha256:z.literal(restrictedAcceptanceManifest) }).strict().safeParse(raw);
  if(!parsed.success) return fail("restricted_acceptance_withdrawal_invalid");
  const request=parsed.data;
  return transaction(pool,environment,async c=>{
    const prior=(await c.query("SELECT * FROM sermon_restricted_acceptance_withdrawals WHERE sermon_id=$1",[request.sermonId])).rows[0];
    if(prior) {
      if(prior.authorization_reference!==request.authorizationReference || prior.reason!==request.reason) fail();
      const s=(await c.query("SELECT status,row_version FROM sermons WHERE id=$1",[request.sermonId])).rows[0];
      if(s?.status!=="unpublished" || s.row_version!==request.rowVersion+1) fail();
      return "unchanged" as const;
    }
    const receipt=(await c.query("SELECT environment,manifest_sha256 FROM sermon_restricted_acceptances WHERE sermon_id=$1",[request.sermonId])).rows[0];
    if(!receipt || receipt.environment!==environment || (!fixtureAllowed() && receipt.manifest_sha256!==request.manifestSha256)) fail();
    const update=await c.query(`UPDATE sermons SET status='unpublished',row_version=row_version+1,updated_at=now(),updated_by_subject=$3
      WHERE id=$1 AND row_version=$2 AND status='published'`,[request.sermonId,request.rowVersion,restrictedAcceptanceExecutor]);
    if(update.rowCount!==1) fail();
    await c.query(`INSERT INTO sermon_restricted_acceptance_withdrawals(sermon_id,authorization_reference,reason,executed_by)
      VALUES($1,$2,$3,$4)`,[request.sermonId,request.authorizationReference,request.reason,restrictedAcceptanceExecutor]);
    await c.query(`INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id)
      VALUES($1,'system','sermon.d158.acceptance_withdrawn','sermon',$2,'succeeded','["restrictedAcceptanceWithdrawal","status"]',$3)`,
      [restrictedAcceptanceExecutor,request.sermonId,remainingDependencyHash(request)]);
    return "withdrawn" as const;
  });
}

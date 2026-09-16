import type { Pool, PoolClient } from "pg";
import { assertDisposableIntegrationTestDatabase } from "../migration/local-database-safety";
import { verifyAcceptanceTarget, type AcceptanceEnvironment } from "./restricted-acceptance-service";
import { verifyReleaseSchema } from "../staging/database-verification";
import { restrictedAcceptanceManifest, restrictedEligibilitySql } from "../domain/restricted-acceptance";
import { remainingDependencyHash } from "../domain/remaining-ai-review";
import { parseTopicalManifest, topicalNamespace, topicalPayloadSql, topicalExecutor, topicalAuditAction } from "../domain/topical-classification";

function fixtureAllowed() {
  if (process.env.RUN_POSTGRES_INTEGRATION !== "1") return false;
  assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL ?? "", process.env.DISPOSABLE_TEST_DATABASE_TOKEN, process.env.ALLOW_LOCAL_DB_WRITE);
  return true;
}
export async function applyTopicalClassification(pool: Pool, raw: unknown, environment: AcceptanceEnvironment,
  preserve?: (client: PoolClient) => Promise<void>) {
  const fixture = fixtureAllowed(), manifest = parseTopicalManifest(raw, fixture), hash = remainingDependencyHash(manifest);
  const c = await pool.connect(); let discard = false;
  try {
    await verifyAcceptanceTarget(c, environment);
    await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await c.query("SET LOCAL savinggrace.application_request='on'");
    await c.query("SET LOCAL lock_timeout='10s'");
    await c.query("SET LOCAL statement_timeout='120s'");
    const names = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename as string);
    if (names.some(n => !/^[a-z_]+$/.test(n))) throw new Error("topical_table_guard");
    await c.query(`LOCK TABLE ${names.map(n => `public."${n}"`).join(",")} IN SHARE ROW EXCLUSIVE MODE`);
    await verifyReleaseSchema(c);
    // The fixture exception exists only inside the guarded disposable runner.
    // It cannot change production identity scope or the renderer's fixed hash.
    const acceptanceHash = fixture ? (await c.query("SELECT manifest_sha256 FROM sermon_restricted_acceptances LIMIT 1")).rows[0]?.manifest_sha256 : restrictedAcceptanceManifest;
    const eligible = restrictedEligibilitySql("s").replaceAll(restrictedAcceptanceManifest, acceptanceHash ?? "");
    const rows = (await c.query(`SELECT s.id,a.content_dependency_sha256,${eligible} AS eligible,
      a.passage_basis, NOT EXISTS(SELECT 1 FROM scripture_references p WHERE p.sermon_id=s.id
        AND p.relationship_role='primary' AND p.review_status IN ('proposed','confirmed')) AS no_primary,
      NOT EXISTS(SELECT 1 FROM sermon_book_classifications b JOIN book_classifications bc ON bc.id=b.book_classification_id
        WHERE b.sermon_id=s.id AND bc.review_status='approved') AS no_book
      FROM sermons s LEFT JOIN sermon_restricted_acceptances a ON a.sermon_id=s.id ORDER BY s.id`)).rows;
    if (!fixture && (rows.length !== 155 || rows.filter(r => r.eligible).length !== 144)) throw new Error("topical_baseline_conflict");
    const members = rows.filter(r => r.eligible && r.passage_basis === "no_single_primary");
    if (JSON.stringify(members.map(r => r.id)) !== JSON.stringify(manifest.sermonIds) || members.some(r => !r.no_primary || !r.no_book)) throw new Error("topical_scope_conflict");
    const existing = (await c.query("SELECT sermon_id FROM sermon_extensions WHERE namespace=$1 ORDER BY sermon_id", [topicalNamespace])).rows;
    if (existing.some(r => !manifest.sermonIds.includes(r.sermon_id))) throw new Error("topical_existing_scope_conflict");
    if (preserve) await preserve(c);
    let inserted = 0;
    for (const member of members) {
      const expected = (await c.query(`SELECT ${topicalPayloadSql("$1::text", "$2::text")} AS payload`, [member.content_dependency_sha256, hash])).rows[0].payload;
      const prior = (await c.query("SELECT schema_version,payload FROM sermon_extensions WHERE sermon_id=$1 AND namespace=$2", [member.id, topicalNamespace])).rows[0];
      const correlation = (await c.query("SELECT $1::text || ':' || encode(digest($2::jsonb::text,'sha256'),'hex') AS value", [hash, JSON.stringify(expected)])).rows[0].value;
      const audits = (await c.query("SELECT request_correlation_id FROM audit_events WHERE entity_id=$1 AND action=$2", [member.id, topicalAuditAction])).rows;
      if (prior) {
        if (prior.schema_version !== 1 || remainingDependencyHash(prior.payload) !== remainingDependencyHash(expected) || audits.length !== 1 || audits[0].request_correlation_id !== correlation) throw new Error("topical_existing_decision_conflict");
      } else {
        if (audits.length) throw new Error("topical_orphan_audit_conflict");
        await c.query("INSERT INTO sermon_extensions(sermon_id,namespace,schema_version,payload) VALUES($1,$2,1,$3::jsonb)", [member.id, topicalNamespace, JSON.stringify(expected)]);
        await c.query(`INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,outcome,changed_fields,request_correlation_id)
          VALUES($1,'system',$2,'sermon',$3,'succeeded','["websiteClassification","samuelEditorialAuthorization"]'::jsonb,$4)`, [topicalExecutor, topicalAuditAction, member.id, correlation]);
        inserted++;
      }
      if ((await c.query("SELECT restricted_acceptance_dependency($1) AS digest", [member.id])).rows[0].digest !== member.content_dependency_sha256) throw new Error("topical_acceptance_changed");
    }
    if (preserve) await preserve(c);
    await c.query("COMMIT");
    return { outcome: inserted ? "classified" : "unchanged", inserted, unchanged: members.length - inserted, manifestSha256: hash, acceptanceSupersessions: 0 };
  } catch (error) {
    try { await c.query("ROLLBACK"); } catch { discard = true; }
    throw new Error(error instanceof Error && /^topical_[a-z_]+$/.test(error.message) ? error.message : "topical_transaction_refused");
  } finally { c.release(discard); }
}

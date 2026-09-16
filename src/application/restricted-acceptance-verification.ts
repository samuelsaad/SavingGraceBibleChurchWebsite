import type { PoolClient } from "pg";
import { databaseFingerprint } from "../staging/database-verification";
import { parseRestrictedManifest,restrictedAcceptanceManifest,restrictedEligibilitySql } from "../domain/restricted-acceptance";
import { remainingDependencyHash } from "../domain/remaining-ai-review";

/** Independent metadata-only preservation proof. No sermon prose is returned. */
export async function restrictedPreservationFingerprint(c:PoolClient,raw:unknown) {
  const manifest=parseRestrictedManifest(raw);
  const full=await databaseFingerprint(c);
  const unchangedTables=full.tables.filter(t=>!["sermons","audit_events","schema_migrations","sermon_restricted_acceptances","sermon_restricted_acceptance_withdrawals"].includes(t.table));
  const digests=(await c.query(`SELECT
    (SELECT encode(digest(COALESCE(string_agg((to_jsonb(s)-ARRAY['status','published_at','row_version','updated_at','updated_by_subject'])::text,'' ORDER BY id),''),'sha256'),'hex') FROM sermons s) AS sermon_content,
    (SELECT encode(digest(COALESCE(string_agg(to_jsonb(s)::text,'' ORDER BY id),''),'sha256'),'hex') FROM sermons s WHERE id=ANY($1::uuid[])) AS excluded_rows,
    (SELECT encode(digest(COALESCE(string_agg(to_jsonb(a)::text,'' ORDER BY id),''),'sha256'),'hex') FROM audit_events a WHERE action NOT LIKE 'sermon.d158.%') AS old_audit,
    (SELECT encode(digest(COALESCE(string_agg(to_jsonb(m)::text,'' ORDER BY migration_order),''),'sha256'),'hex') FROM schema_migrations m WHERE migration_order<=18) AS old_migrations
    `,[manifest.blocked.map(m=>m.sermonId)])).rows[0];
  return {unchangedTables,sequenceHash:full.sequenceHash,digests,sha256:remainingDependencyHash({unchangedTables,sequenceHash:full.sequenceHash,digests}),
    fullFingerprint:full.sha256,counts:full.counts};
}

export async function verifyRestrictedAcceptedState(c:PoolClient,raw:unknown,before:Awaited<ReturnType<typeof restrictedPreservationFingerprint>>) {
  const manifest=parseRestrictedManifest(raw),after=await restrictedPreservationFingerprint(c,manifest);
  if(after.sha256!==before.sha256)throw new Error("restricted_preservation_mismatch");
  const rows=(await c.query(`SELECT s.id,s.status,s.row_version,s.published_at,a.previous_row_version,a.published_row_version,a.accepted_at,
    a.manifest_sha256,a.authorized_by,a.executed_by,a.manual_review_claimed,${restrictedEligibilitySql("s")} AS eligible
    FROM sermons s LEFT JOIN sermon_restricted_acceptances a ON a.sermon_id=s.id ORDER BY s.id`)).rows;
  if(rows.length!==155)throw new Error("restricted_record_count_mismatch");
  for(const member of manifest.members){const row=rows.find(r=>r.id===member.sermonId);
    if(!row?.eligible||row.row_version!==member.rowVersion+1||row.previous_row_version!==member.rowVersion||
      row.manifest_sha256!==restrictedAcceptanceManifest||row.authorized_by!=="samuel-saad-bulk-authorization"||
      row.executed_by!=="codex-d158-restricted-acceptance"||row.manual_review_claimed!==false)throw new Error("restricted_receipt_verification_failed");}
  for(const excluded of manifest.blocked){const row=rows.find(r=>r.id===excluded.sermonId);
    if(!row||row.eligible||row.manifest_sha256||row.status!=="draft"||row.published_at!==null)throw new Error("restricted_exclusion_failed");}
  const audit=(await c.query(`SELECT count(*)::int total,count(*) FILTER(WHERE action='sermon.d158.restricted_bulk_acceptance'
    AND actor_subject='codex-d158-restricted-acceptance' AND actor_role='system' AND outcome='succeeded' AND request_correlation_id=$1)::int valid
    FROM audit_events WHERE action LIKE 'sermon.d158.%'`,[restrictedAcceptanceManifest])).rows[0];
  if(audit.total!==144||audit.valid!==144)throw new Error("restricted_audit_verification_failed");
  return {accepted:144,excluded:11,preserved:true,preservationSha256:after.sha256,fullFingerprint:after.fullFingerprint,counts:after.counts};
}

import type { PoolClient } from "pg";
import { restrictedAcceptanceManifest } from "../domain/restricted-acceptance";

/** No arbitrary published record is admitted to this restricted deployment.
 * Freshness is evaluated independently by every content query: one stale item
 * is hidden without concealing otherwise valid accepted items. */
export async function verifyRestrictedPublicationBoundary(c: Pick<PoolClient,"query">, environment:"local_loopback"|"sealed_staging") {
  const row=(await c.query(`SELECT
    (SELECT count(*)::int FROM sermon_restricted_acceptances) AS accepted,
    (SELECT count(*)::int FROM sermon_restricted_acceptances WHERE manifest_sha256<>$1 OR environment<>$2) AS wrong_receipts,
    (SELECT count(*)::int FROM sermons s WHERE (s.status='published' OR s.published_at IS NOT NULL)
      AND NOT EXISTS(SELECT 1 FROM sermon_restricted_acceptances a WHERE a.sermon_id=s.id AND a.manifest_sha256=$1 AND a.environment=$2)) AS outside
    `,[restrictedAcceptanceManifest,environment])).rows[0];
  if(!row || ![0,144].includes(row.accepted) || row.wrong_receipts!==0 || row.outside!==0) throw new Error("restricted_publication_boundary_refused");
}

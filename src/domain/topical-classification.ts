import { z } from "zod";
import { remainingDependencyHash } from "./remaining-ai-review";
import { restrictedAcceptanceManifest } from "./restricted-acceptance";

export const topicalNamespace = "website.topical-classification";
export const topicalAuthorization = "SAMUEL-NINE-TOPICAL-2026-09-14";
export const topicalManifestHash = "b1016476118bb3029a42658c78cc38e97897970b6adc553511f7cae06c7f8b56";
export const topicalExecutor = "codex-topical-classification";
export const topicalAuditAction = "sermon.website.topical_classification";
export const topicalManifestSchema = z.object({
  version: z.literal(1), authorization: z.literal(topicalAuthorization),
  sourceAcceptanceManifest: z.literal(restrictedAcceptanceManifest),
  sermonIds: z.array(z.uuid()).min(1).max(9)
}).strict();
export function parseTopicalManifest(raw: unknown, disposableFixture = false) {
  const parsed = topicalManifestSchema.safeParse(raw);
  if (!parsed.success) throw new Error("topical_manifest_invalid");
  const m = parsed.data;
  if (m.sermonIds.some((id, i) => i > 0 && m.sermonIds[i - 1]! >= id) ||
      (!disposableFixture && (m.sermonIds.length !== 9 || remainingDependencyHash(m) !== topicalManifestHash))) {
    throw new Error("topical_manifest_invalid");
  }
  return m;
}

/** One allowlisted, versioned extension: an editorial decision, not source truth.
 * Timestamp lives in the extension/audit rows; no sermon or review is rewritten. */
export function topicalPayloadSql(dependency: string, manifest: string): string {
  return `jsonb_build_object('classification','topical','authorization','${topicalAuthorization}',
    'authorizedBy','samuel-saad-editorial-authorization','executedBy','${topicalExecutor}',
    'manifestSha256',${manifest},'acceptanceDependencySha256',${dependency},
    'source','samuel_editorial_decision','manualContentReviewClaimed',false)`;
}

/** Called only within the unchanged restricted-acceptance selector. Exact schema,
 * current dependency and matching audited payload are all necessary. */
export function topicalClassificationSql(alias: string): string {
  if (!/^[a-z][a-z_]*$/.test(alias)) throw new Error("invalid_sql_alias");
  return `EXISTS (SELECT 1 FROM sermon_extensions tx
    JOIN sermon_restricted_acceptances ta ON ta.sermon_id=tx.sermon_id
    WHERE tx.sermon_id=${alias}.id AND tx.namespace='${topicalNamespace}' AND tx.schema_version=1
      AND ta.passage_basis='no_single_primary'
      AND tx.payload=${topicalPayloadSql("ta.content_dependency_sha256", `'${topicalManifestHash}'`)}
      AND EXISTS (SELECT 1 FROM audit_events te WHERE te.entity_id=tx.sermon_id
        AND te.entity_type='sermon' AND te.action='${topicalAuditAction}'
        AND te.actor_subject='${topicalExecutor}' AND te.actor_role='system' AND te.outcome='succeeded'
        AND te.request_correlation_id='${topicalManifestHash}:' || encode(digest(tx.payload::text,'sha256'),'hex')))`;
}

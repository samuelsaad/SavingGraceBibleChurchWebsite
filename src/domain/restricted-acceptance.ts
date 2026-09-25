import { z } from "zod";
import { remainingDependencyHash } from "./remaining-ai-review";

export const restrictedAcceptanceManifest = "4759449bbbaed97238968d2fd4621d4137b8b4e41b73a20aeda319dc1212617c";
export const restrictedAcceptanceExecutor = "codex-d158-restricted-acceptance";
export const restrictedAcceptanceAuthorizer = "samuel-saad-bulk-authorization";
export const restrictedAcceptanceFormat = "d158-utc-jsonb-v1";
export const d161SourceManifest = "0390f2b94252270821f9079159482a18e17051399cad654818905b1f1de20c94";
export const d161AcceptanceFormat = "d161-utc-jsonb-v1";
export const d161AcceptanceExecutor = "codex-d161-d160-private-review";
export const d162SourceManifest = "e47da706e8b458bed6f8198570cc4a51e4b9604049e394d71a02cc84f79ea17f";
export const d162AcceptanceFormat = "d162-utc-jsonb-v1";
export const d162AcceptanceExecutor = "codex-d162-private-review";
export const d167SourceManifest = "0218989d1c09224ed301caecb915cefc787a5017f28f6253aee3020a7c3b3ae5";
export const d167AcceptanceFormat = "d167-utc-jsonb-v1";
export const d167AcceptanceExecutor = "codex-d167-private-review";
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const restrictedManifestSchema = z.object({ decision: z.literal("D-158"), version: z.literal(1),
  members: z.array(z.object({ sermonId: z.uuid(), rowVersion: z.number().int().positive(),
    dependencySha256: digest, completionKind: z.enum(["human","ai"]),
    passageBasis: z.enum(["primary_passage","no_single_primary"]) }).strict()).min(1).max(144),
  blocked: z.array(z.object({ sermonId: z.uuid(), reasons: z.array(z.string()) }).strict()).max(155)
}).strict();
export type RestrictedManifest = z.infer<typeof restrictedManifestSchema>;
export function parseRestrictedManifest(raw: unknown, disposableFixture = false): RestrictedManifest {
  const parsed = restrictedManifestSchema.safeParse(raw);
  if (!parsed.success) throw new Error("restricted_acceptance_manifest_invalid");
  const manifest = parsed.data;
  const ids = [...manifest.members, ...manifest.blocked].map(m=>m.sermonId);
  const ordered = (rows: Array<{sermonId:string}>) => rows.every((r,i)=>i===0 || rows[i-1]!.sermonId < r.sermonId);
  if (new Set(ids).size !== ids.length || !ordered(manifest.members) || !ordered(manifest.blocked) ||
    (!disposableFixture && (remainingDependencyHash(manifest)!==restrictedAcceptanceManifest ||
      manifest.members.length!==144 || manifest.blocked.length!==11))) throw new Error("restricted_acceptance_manifest_invalid");
  return manifest;
}

/** This selector is used only by the guarded loopback/sealed read-only runtime.
 * Normal public and administrator publication selectors are not weakened. */
export function restrictedEligibilitySql(alias: string): string {
  if (!/^[a-z][a-z_]*$/.test(alias)) throw new Error("invalid_sql_alias");
  return `(${alias}.status='published' AND ${alias}.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM sermon_restricted_acceptances accepted
    WHERE accepted.sermon_id=${alias}.id AND accepted.decision='D-158'
      AND accepted.manifest_sha256='${restrictedAcceptanceManifest}'
      AND accepted.fingerprint_format='${restrictedAcceptanceFormat}'
      AND accepted.published_row_version=${alias}.row_version
      AND accepted.accepted_at=${alias}.published_at
      AND accepted.content_dependency_sha256=restricted_acceptance_dependency(${alias}.id)
      AND NOT EXISTS (SELECT 1 FROM sermon_restricted_acceptance_withdrawals withdrawn WHERE withdrawn.sermon_id=${alias}.id)
  ))`;
}

/** D-161 is intentionally a separate selector. Callers must opt into the
 * guarded loopback/sealed-staging runtime; no public/default scope uses it. */
export function d161RestrictedEligibilitySql(alias:string):string{
  if(!/^[a-z][a-z_]*$/.test(alias))throw new Error("invalid_sql_alias");
  return `(${alias}.status='draft' AND ${alias}.published_at IS NULL AND ${alias}.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM sermon_d161_restricted_acceptances accepted
    WHERE accepted.sermon_id=${alias}.id AND accepted.decision='D-161'
      AND accepted.source_manifest_sha256='${d161SourceManifest}'
      AND accepted.fingerprint_format='${d161AcceptanceFormat}'
      AND accepted.accepted_row_version=${alias}.row_version
      AND accepted.content_dependency_sha256=d161_restricted_acceptance_dependency(${alias}.id)
      AND NOT EXISTS (SELECT 1 FROM sermon_d161_restricted_acceptance_withdrawals withdrawn WHERE withdrawn.sermon_id=${alias}.id)
  ))`;
}
export function d161CombinedRestrictedEligibilitySql(alias:string):string{
  return `(${restrictedEligibilitySql(alias)} OR ${d161RestrictedEligibilitySql(alias)})`;
}

/** D-162 remains separate from public/default eligibility and is available only
 * through the explicitly enabled loopback/sealed-staging selector. */
export function d162RestrictedEligibilitySql(alias:string):string{
  if(!/^[a-z][a-z_]*$/.test(alias))throw new Error("invalid_sql_alias");
  return `(${alias}.status='draft' AND ${alias}.published_at IS NULL AND ${alias}.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM sermon_d162_restricted_acceptances accepted
    WHERE accepted.sermon_id=${alias}.id AND accepted.decision='D-162'
      AND accepted.source_manifest_sha256='${d162SourceManifest}'
      AND accepted.fingerprint_format='${d162AcceptanceFormat}'
      AND accepted.accepted_row_version=${alias}.row_version
      AND accepted.content_dependency_sha256=d162_restricted_acceptance_dependency(${alias}.id)
      AND NOT EXISTS (SELECT 1 FROM sermon_d162_restricted_acceptance_withdrawals withdrawn WHERE withdrawn.sermon_id=${alias}.id)
  ))`;
}
export function d162CombinedRestrictedEligibilitySql(alias:string):string{
  return `(${d161CombinedRestrictedEligibilitySql(alias)} OR ${d162RestrictedEligibilitySql(alias)})`;
}

/** D-167 is excluded from all ordinary public/default selectors. */
export function d167RestrictedEligibilitySql(alias:string):string{
  if(!/^[a-z][a-z_]*$/.test(alias))throw new Error("invalid_sql_alias");
  return `(${alias}.status='draft' AND ${alias}.published_at IS NULL AND ${alias}.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM sermon_d167_restricted_acceptances accepted
    WHERE accepted.sermon_id=${alias}.id AND accepted.decision='D-167'
      AND accepted.source_manifest_sha256='${d167SourceManifest}'
      AND accepted.fingerprint_format='${d167AcceptanceFormat}'
      AND accepted.accepted_row_version=${alias}.row_version
      AND accepted.content_dependency_sha256=d167_restricted_acceptance_dependency(${alias}.id)
      AND NOT EXISTS (SELECT 1 FROM sermon_d167_restricted_acceptance_withdrawals withdrawn WHERE withdrawn.sermon_id=${alias}.id)
  ))`;
}
export function d167CombinedRestrictedEligibilitySql(alias:string):string{
  return `(${d162CombinedRestrictedEligibilitySql(alias)} OR ${d167RestrictedEligibilitySql(alias)})`;
}

export function restrictedPassageAcceptanceSql(sermonExpression:string,basis?:"primary_passage"|"no_single_primary"):string {
  if(!/^[a-z][a-z_]*\.(?:id|sermon_id)$/.test(sermonExpression)) throw new Error("invalid_sql_sermon_expression");
  const clause=basis?` AND accepted.passage_basis='${basis}'`:"";
  return `(EXISTS (SELECT 1 FROM sermon_restricted_acceptances accepted WHERE accepted.sermon_id=${sermonExpression}${clause})
    OR EXISTS (SELECT 1 FROM sermon_d161_restricted_acceptances accepted WHERE accepted.sermon_id=${sermonExpression}${clause})
    OR EXISTS (SELECT 1 FROM sermon_d162_restricted_acceptances accepted WHERE accepted.sermon_id=${sermonExpression}${clause}))`;
}

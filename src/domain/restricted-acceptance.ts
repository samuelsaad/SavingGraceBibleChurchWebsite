import { z } from "zod";
import { remainingDependencyHash } from "./remaining-ai-review";

export const restrictedAcceptanceManifest = "4759449bbbaed97238968d2fd4621d4137b8b4e41b73a20aeda319dc1212617c";
export const restrictedAcceptanceExecutor = "codex-d158-restricted-acceptance";
export const restrictedAcceptanceAuthorizer = "samuel-saad-bulk-authorization";
export const restrictedAcceptanceFormat = "d158-utc-jsonb-v1";
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

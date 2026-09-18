import {z} from "zod";
import {d161Hash,d161SourceManifest} from "./d161-review";
const sha=z.string().regex(/^[a-f0-9]{64}$/u);
export const d161RestrictedManifestSchema=z.object({decision:z.literal("D-161"),version:z.literal(1),sourceManifestSha256:z.literal(d161SourceManifest),
  members:z.array(z.object({sequence:z.number().int().min(1).max(36),sermonId:z.uuid(),rowVersion:z.number().int().positive(),dependencySha256:sha,
    passageBasis:z.enum(["primary_passage","no_single_primary"])}).strict()).max(36),
  blocked:z.array(z.object({sequence:z.number().int().min(1).max(36),sermonId:z.uuid(),reasons:z.array(z.string().regex(/^[a-z][a-z0-9_]{0,119}$/u)).min(1).max(30)}).strict()).max(36)
}).strict();
export type D161RestrictedManifest=z.infer<typeof d161RestrictedManifestSchema>;
export function parseD161RestrictedManifest(raw:unknown):D161RestrictedManifest{
  const parsed=d161RestrictedManifestSchema.safeParse(raw);if(!parsed.success)throw new Error("d161_acceptance_manifest_invalid");
  const m=parsed.data,all=[...m.members,...m.blocked].sort((a,b)=>a.sequence-b.sequence);
  if(all.length!==36||new Set(all.map(v=>v.sermonId)).size!==36||all.some((v,i)=>v.sequence!==i+1))throw new Error("d161_acceptance_manifest_invalid");
  return m;
}
export function d161AcceptanceManifestHash(m:D161RestrictedManifest):string{return d161Hash(m);}

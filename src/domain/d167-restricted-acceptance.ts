import {z} from "zod";
import {d167Hash,d167SourceManifest} from "./d167-review";
const sha=z.string().regex(/^[a-f0-9]{64}$/u);
export const d167RestrictedManifestSchema=z.object({decision:z.literal("D-167"),version:z.literal(1),sourceManifestSha256:z.literal(d167SourceManifest),
  members:z.array(z.object({sequence:z.number().int().min(1).max(36),sermonId:z.uuid(),rowVersion:z.number().int().positive(),dependencySha256:sha,
    passageBasis:z.enum(["primary_passage","no_single_primary"])}).strict()).max(36),
  blocked:z.array(z.object({sequence:z.number().int().min(1).max(36),sermonId:z.uuid(),reasons:z.array(z.string().regex(/^[a-z][a-z0-9_]{0,119}$/u)).min(1).max(30)}).strict()).max(36)
}).strict();
export type D167RestrictedManifest=z.infer<typeof d167RestrictedManifestSchema>;
export function parseD167RestrictedManifest(raw:unknown):D167RestrictedManifest{
  const parsed=d167RestrictedManifestSchema.safeParse(raw);if(!parsed.success)throw new Error("d167_acceptance_manifest_invalid");
  const m=parsed.data,all=[...m.members,...m.blocked].sort((a,b)=>a.sequence-b.sequence);
  if(all.length!==36||new Set(all.map(v=>v.sermonId)).size!==36||all.some((v,i)=>v.sequence!==i+1))throw new Error("d167_acceptance_manifest_invalid");
  return m;
}
export function d167AcceptanceManifestHash(m:D167RestrictedManifest):string{return d167Hash(m);}

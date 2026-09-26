import {describe,it,expect} from "vitest";
import {protectedTables,protectedPacketHash,validateProtectedPacket,type ProtectedPacket} from "../deployment/d167-protected-sync";
import {d167SourceManifest} from "../src/domain/d167-review";
import {canonicalReviewJson,reviewHash} from "../src/domain/delegated-ai-review";
const id="00000000-0000-4000-8000-000000000001";
function packet():ProtectedPacket{
 const p:ProtectedPacket={schemaVersion:1,decision:"D-167",processingManifestSha256:d167SourceManifest,exportedAt:"2026-01-01T00:00:00Z",eligibleIds:[id],membershipSha256:reviewHash(canonicalReviewJson([id])),tables:Object.fromEntries(protectedTables.map(t=>[t,{primaryKey:["id"],rows:t==="sermons"?[{id,status:"draft"}]:[]}])) as unknown as ProtectedPacket["tables"],packageSha256:""};
 p.packageSha256=protectedPacketHash(p);return p;
}
describe("D-167 isolated protected transfer",()=>{
 it("accepts an exact hash-bound scoped package",()=>expect(validateProtectedPacket(packet()).eligibleIds).toEqual([id]));
 it("rejects another processing manifest",()=>{const p=packet();p.processingManifestSha256="0".repeat(64) as typeof d167SourceManifest;p.packageSha256=protectedPacketHash(p);expect(()=>validateProtectedPacket(p)).toThrow();});
 it("rejects drift and duplicate identities",()=>{const p=packet();p.eligibleIds.push(id);expect(()=>validateProtectedPacket(p)).toThrow();});
 it("rejects an unrelated linked record even with a recomputed hash",()=>{const p=packet();p.tables.sermon_transcripts.rows.push({id,sermon_id:"00000000-0000-4000-8000-000000000002"});p.packageSha256=protectedPacketHash(p);expect(()=>validateProtectedPacket(p)).toThrow();});
 it("cannot carry accounts or sessions",()=>{const p=packet();(p.tables as any).sessions={primaryKey:["id"],rows:[]};p.packageSha256=protectedPacketHash(p);expect(()=>validateProtectedPacket(p)).toThrow();});
 it("excludes raw captions, credentials and semantic stores from the table allowlist",()=>expect(protectedTables.join(" ")).not.toMatch(/caption_exports|credentials|session|description_semantic/));
 it("rejects a missing table and malformed identifier",()=>{const p=packet();p.tables.audit_events.primaryKey=["id;DROP"];p.packageSha256=protectedPacketHash(p);expect(()=>validateProtectedPacket(p)).toThrow();});
});

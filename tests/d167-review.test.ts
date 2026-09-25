import{describe,expect,it}from"vitest";
import{contentHash,reviewHash}from"../src/domain/delegated-ai-review";
import{d167CanonicalSpeakerInMediaTitle,d167ContentReviewSchema,d167Hash,d167RuntimeModel,d167SourceManifest,validateD167ContentReview}from"../src/domain/d167-review";
import{d167AcceptanceManifestHash,parseD167RestrictedManifest}from"../src/domain/d167-restricted-acceptance";
import{d167CombinedRestrictedEligibilitySql,d167RestrictedEligibilitySql,restrictedEligibilitySql}from"../src/domain/restricted-acceptance";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const provenance={reviewer_kind:"ai",provider:"OpenAI",execution_surface:"Codex",model:d167RuntimeModel,mode:"interactive Codex session",
  immutable_revision:"not_exposed_by_runtime",session_id:"not_exposed_by_runtime",privacy_details:"not_exposed_by_runtime",separately_billed_api_used:false,external_api_cost_aud:0}as const;
describe("D-167 exact D-167 review boundary",()=>{
  it("validates one current Q&A decision with truthful unavailable runtime metadata",()=>{
    const transcript="The invented sermon explains grace, patient faith, and careful service without adding an outside claim.";
    const output={question:"How does this sermon connect patient faith with careful service?",answer:"It explains that grace shapes patient faith and careful service together."};
    const r={decision:"D-167",scopeSha256:d167SourceManifest,policySha256:"a".repeat(64),sermonId:id(1),artifactKey:`qa:${id(2)}`,
      expectedSermonVersion:1,inputVersion:1,displayOrder:1,transcriptSha256:reviewHash(transcript),groundingRevisionId:id(3),sourceSha256:"b".repeat(64),sourceProvenanceSha256:"c".repeat(64),
      inputSha256:contentHash(output),outputSha256:contentHash(output),original:output,output,outcome:"accepted",correctionRound:0,reviewedAt:"2026-09-18T00:00:00.000Z",provenance,
      evidence:[{start:0,end:transcript.length,sha256:reviewHash(transcript),purpose:"claim"}],coverage:[{start:0,end:transcript.length,sha256:reviewHash(transcript)}],
      assessment:{fullArtifactRead:true,centralArgumentChecked:true,substantiveClaimsSupported:true,qualificationsPreserved:true,questionAnswersDirectly:true,scriptureAttributionChecked:true,readabilityChecked:true,orderingChecked:true,integrity:"verified",rationale:"The synthetic answer is directly supported by the complete synthetic transcript.",exceptionCode:null,informationNeeded:null,standingWarnings:[],audioVerified:false,completeSemanticTranscriptReview:true}};
    expect(d167ContentReviewSchema.safeParse(r).success).toBe(true);
    expect(validateD167ContentReview(r,transcript).outcome).toBe("accepted");
    expect(()=>validateD167ContentReview({...r,transcriptSha256:"d".repeat(64)},transcript)).toThrow("d167_content_review_invalid");
  });
  it("requires an exact 36-position manifest and hashes accepted plus blocked outcomes",()=>{
    const members=Array.from({length:31},(_,i)=>({sequence:i+1,sermonId:id(i+1),rowVersion:2,dependencySha256:`${(i%9)+1}`.repeat(64),passageBasis:"primary_passage"as const}));
    const blocked=Array.from({length:5},(_,i)=>({sequence:i+32,sermonId:id(i+32),reasons:["provider_redaction_requires_human"]}));
    const raw={decision:"D-167",version:1,sourceManifestSha256:d167SourceManifest,members,blocked};
    const parsed=parseD167RestrictedManifest(raw);expect(parsed.members).toHaveLength(31);expect(parsed.blocked).toHaveLength(5);
    expect(d167AcceptanceManifestHash(parsed)).toMatch(/^[a-f0-9]{64}$/u);
    expect(()=>parseD167RestrictedManifest({...raw,blocked:blocked.slice(1)})).toThrow("d167_acceptance_manifest_invalid");
  });
  it("keeps D-158 unchanged and exposes D-167 drafts only through the explicit combined selector",()=>{
    expect(restrictedEligibilitySql("s")).not.toContain("sermon_d167_restricted_acceptances");
    expect(d167RestrictedEligibilitySql("s")).toContain("s.status='draft'");
    expect(d167RestrictedEligibilitySql("s")).toContain("s.published_at IS NULL");
    expect(d167CombinedRestrictedEligibilitySql("s")).toContain("sermon_restricted_acceptances");
    expect(d167CombinedRestrictedEligibilitySql("s")).toContain("sermon_d167_restricted_acceptances");
    expect(()=>d167RestrictedEligibilitySql("s;drop")).toThrow("invalid_sql_alias");
  });
  it("does not confuse generated-candidate provenance with D-167 review provenance",()=>{
    expect(d167Hash(provenance)).toMatch(/^[a-f0-9]{64}$/u);expect(provenance.model).toBe("not_exposed_by_runtime");
  });
  it("requires the existing canonical full speaker name in retained media metadata",()=>{
    expect(d167CanonicalSpeakerInMediaTitle("A fictional sermon | Alex Example — private source","Alex Example")).toBe(true);
    expect(d167CanonicalSpeakerInMediaTitle("A fictional sermon | Alex — private source","Alex Example")).toBe(false);
    expect(d167CanonicalSpeakerInMediaTitle("A fictional sermon | Alexander Example — private source","Alex Example")).toBe(false);
  });
});

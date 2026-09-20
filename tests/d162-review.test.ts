import{describe,expect,it}from"vitest";
import{contentHash,reviewHash}from"../src/domain/delegated-ai-review";
import{d162CanonicalSpeakerInMediaTitle,d162ContentReviewSchema,d162Hash,d162RuntimeModel,d162SourceManifest,validateD162ContentReview}from"../src/domain/d162-review";
import{d162AcceptanceManifestHash,parseD162RestrictedManifest}from"../src/domain/d162-restricted-acceptance";
import{d162CombinedRestrictedEligibilitySql,d162RestrictedEligibilitySql,restrictedEligibilitySql}from"../src/domain/restricted-acceptance";

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const provenance={reviewer_kind:"ai",provider:"OpenAI",execution_surface:"Codex",model:d162RuntimeModel,mode:"interactive Codex session",
  immutable_revision:"not_exposed_by_runtime",session_id:"not_exposed_by_runtime",privacy_details:"not_exposed_by_runtime",separately_billed_api_used:false,external_api_cost_aud:0}as const;
describe("D-162 exact D-162 review boundary",()=>{
  it("validates one current Q&A decision with truthful unavailable runtime metadata",()=>{
    const transcript="The invented sermon explains grace, patient faith, and careful service without adding an outside claim.";
    const output={question:"How does this sermon connect patient faith with careful service?",answer:"It explains that grace shapes patient faith and careful service together."};
    const r={decision:"D-162",scopeSha256:d162SourceManifest,policySha256:"a".repeat(64),sermonId:id(1),artifactKey:`qa:${id(2)}`,
      expectedSermonVersion:1,inputVersion:1,displayOrder:1,transcriptSha256:reviewHash(transcript),groundingRevisionId:id(3),sourceSha256:"b".repeat(64),sourceProvenanceSha256:"c".repeat(64),
      inputSha256:contentHash(output),outputSha256:contentHash(output),original:output,output,outcome:"accepted",correctionRound:0,reviewedAt:"2026-09-18T00:00:00.000Z",provenance,
      evidence:[{start:0,end:transcript.length,sha256:reviewHash(transcript),purpose:"claim"}],coverage:[{start:0,end:transcript.length,sha256:reviewHash(transcript)}],
      assessment:{fullArtifactRead:true,centralArgumentChecked:true,substantiveClaimsSupported:true,qualificationsPreserved:true,questionAnswersDirectly:true,scriptureAttributionChecked:true,readabilityChecked:true,orderingChecked:true,integrity:"verified",rationale:"The synthetic answer is directly supported by the complete synthetic transcript.",exceptionCode:null,informationNeeded:null,standingWarnings:[],audioVerified:false,completeSemanticTranscriptReview:true}};
    expect(d162ContentReviewSchema.safeParse(r).success).toBe(true);
    expect(validateD162ContentReview(r,transcript).outcome).toBe("accepted");
    expect(()=>validateD162ContentReview({...r,transcriptSha256:"d".repeat(64)},transcript)).toThrow("d162_content_review_invalid");
  });
  it("requires an exact 36-position manifest and hashes accepted plus blocked outcomes",()=>{
    const members=Array.from({length:31},(_,i)=>({sequence:i+1,sermonId:id(i+1),rowVersion:2,dependencySha256:`${(i%9)+1}`.repeat(64),passageBasis:"primary_passage"as const}));
    const blocked=Array.from({length:5},(_,i)=>({sequence:i+32,sermonId:id(i+32),reasons:["provider_redaction_requires_human"]}));
    const raw={decision:"D-162",version:1,sourceManifestSha256:d162SourceManifest,members,blocked};
    const parsed=parseD162RestrictedManifest(raw);expect(parsed.members).toHaveLength(31);expect(parsed.blocked).toHaveLength(5);
    expect(d162AcceptanceManifestHash(parsed)).toMatch(/^[a-f0-9]{64}$/u);
    expect(()=>parseD162RestrictedManifest({...raw,blocked:blocked.slice(1)})).toThrow("d162_acceptance_manifest_invalid");
  });
  it("keeps D-158 unchanged and exposes D-162 drafts only through the explicit combined selector",()=>{
    expect(restrictedEligibilitySql("s")).not.toContain("sermon_d162_restricted_acceptances");
    expect(d162RestrictedEligibilitySql("s")).toContain("s.status='draft'");
    expect(d162RestrictedEligibilitySql("s")).toContain("s.published_at IS NULL");
    expect(d162CombinedRestrictedEligibilitySql("s")).toContain("sermon_restricted_acceptances");
    expect(d162CombinedRestrictedEligibilitySql("s")).toContain("sermon_d162_restricted_acceptances");
    expect(()=>d162RestrictedEligibilitySql("s;drop")).toThrow("invalid_sql_alias");
  });
  it("does not confuse generated-candidate provenance with D-162 review provenance",()=>{
    expect(d162Hash(provenance)).toMatch(/^[a-f0-9]{64}$/u);expect(provenance.model).toBe("not_exposed_by_runtime");
  });
  it("requires the existing canonical full speaker name in retained media metadata",()=>{
    expect(d162CanonicalSpeakerInMediaTitle("A fictional sermon | Alex Example — private source","Alex Example")).toBe(true);
    expect(d162CanonicalSpeakerInMediaTitle("A fictional sermon | Alex — private source","Alex Example")).toBe(false);
    expect(d162CanonicalSpeakerInMediaTitle("A fictional sermon | Alexander Example — private source","Alex Example")).toBe(false);
  });
});

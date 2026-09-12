import { describe, expect, it } from "vitest";
import { reviewHash } from "../src/domain/delegated-ai-review";
import { remainingComponents, remainingDependencyHash, remainingReviewPacketSchema, validateRemainingComponent,
  type RemainingComponentDecision, type RemainingReviewValidationContext } from "../src/domain/remaining-ai-review";

const body="An invented carpenter checks the bridge before inviting the village to cross. An unresolved word remains [uncertain].";
const transcriptHash=reviewHash(body), sourceHash=reviewHash("Invented caption source only");
const whole={start:0,end:body.length,sha256:transcriptHash};
function context():RemainingReviewValidationContext {
  return {dependencies:Object.fromEntries(remainingComponents.map(k=>[k,reviewHash(`invented ${k}`)])) as RemainingReviewValidationContext["dependencies"],
    transcript:{body,sha256:transcriptHash,humanApproved:false},sourceSha256:sourceHash,sourceProvenanceSha256:reviewHash("invented provenance"),
    metadataSha256:reviewHash("invented metadata"),priorEvidence:[],officialEvidenceHashes:[],identityAvailable:true,speakerAvailable:true,
    passageAvailable:true,mediaAvailable:true,findingsVerified:true,findings:[],humanConflicts:{identity:false,speaker:false,findings:false,transcript:false,passage:false,media:false}};
}
function decision(component:RemainingComponentDecision["component"]):RemainingComponentDecision {
  const c=context();return {component,dependencySha256:c.dependencies[component],outcome:"accepted",rationale:"The invented retained evidence supports this bounded component.",
    exceptionCode:null,informationNeeded:null,warnings:[],
    evidence:[{source:"transcript",sha256:transcriptHash,reference:"invented_transcript",range:whole}],
    semanticCoverage:[{origin:"current_context",priorReviewId:null,ranges:[whole]}],completeSemanticTranscriptReview:true,
    deterministicComparison:{sourceSha256:sourceHash,transcriptSha256:transcriptHash,algorithm:"retained-caption-word-preservation-v1",outcome:"exact_word_sequence",completeSourceCompared:true,comparisonReceiptSha256:reviewHash("invented comparison")},
    checks:{stableIdentityVerified:true,dateVerified:true,titleProjectionVerified:true,explicitSpeakerVerified:true,primaryPassageSupported:true,
      emptySetVerified:true,mediaIdentityVerified:true,captionFidelityVerified:true,uncertaintyPreserved:true},findingDispositions:[],audioVerified:false};
}

describe("D-157 independent remaining-review evidence",()=>{
  it.each(remainingComponents)("accepts independently supported %s without creating human approval",component=>{
    expect(validateRemainingComponent(decision(component),context()).outcome).toBe("accepted");
  });
  it("binds each component separately instead of to a generic row-version",()=>{
    const c=context(),r=decision("speaker");c.dependencies.passage=reviewHash("changed unrelated passage");
    expect(validateRemainingComponent(r,c).outcome).toBe("accepted");
    c.dependencies.speaker=reviewHash("changed speaker");expect(()=>validateRemainingComponent(r,c)).toThrow("remaining_review_evidence_invalid");
  });
  it("rejects unsupported identity, speaker, passage, media and finding-set assertions",()=>{
    for(const [component,field] of [["identity","identityAvailable"],["speaker","speakerAvailable"],["passage","passageAvailable"],["media","mediaAvailable"],["findings","findingsVerified"]] as const){
      const c=context();c[field]=false;expect(()=>validateRemainingComponent(decision(component),c)).toThrow("remaining_review_evidence_invalid");
    }
  });
  it("never treats a deterministic full comparison as complete semantic reading",()=>{
    const r=decision("transcript");r.semanticCoverage=[];
    expect(()=>validateRemainingComponent(r,context())).toThrow("remaining_review_evidence_invalid");
    r.completeSemanticTranscriptReview=false;
    expect(()=>validateRemainingComponent(r,context())).toThrow("remaining_review_evidence_invalid");
  });
  it("verifies exact prior semantic ranges rather than inventing rereading",()=>{
    const c=context(),r=decision("transcript"),id="99999999-9999-4999-8999-999999999157";
    r.semanticCoverage=[{origin:"prior_d156",priorReviewId:id,ranges:[whole]}];
    expect(()=>validateRemainingComponent(r,c)).toThrow("remaining_review_evidence_invalid");
    c.priorEvidence=[{id,sha256:reviewHash("prior review"),ranges:[whole]}];
    expect(validateRemainingComponent(r,c).semanticCoverage[0]?.origin).toBe("prior_d156");
    c.priorEvidence[0]!.ranges=[{start:1,end:body.length}];expect(()=>validateRemainingComponent(r,c)).toThrow("remaining_review_evidence_invalid");
  });
  it("keeps missing-source acceptance limited to preserved human-approved transcripts",()=>{
    const c=context(),r=decision("transcript");r.outcome="accepted_source_limitation";r.warnings=["retained_source_unavailable"];
    r.deterministicComparison!.outcome="source_unavailable";r.deterministicComparison!.completeSourceCompared=false;
    r.checks.captionFidelityVerified=false;r.semanticCoverage=[];r.completeSemanticTranscriptReview=false;
    r.evidence=[{source:"source_provenance",sha256:c.sourceProvenanceSha256,reference:"preserved_source_metadata"}];
    expect(()=>validateRemainingComponent(r,c)).toThrow("remaining_review_evidence_invalid");
    c.transcript.humanApproved=true;expect(validateRemainingComponent(r,c).outcome).toBe("accepted_source_limitation");
    r.checks.captionFidelityVerified=true;expect(()=>validateRemainingComponent(r,c)).toThrow("remaining_review_evidence_invalid");
    r.checks.captionFidelityVerified=false;r.completeSemanticTranscriptReview=true;expect(()=>validateRemainingComponent(r,c)).toThrow("remaining_review_evidence_invalid");
  });
  it("rejects mismatch, partial comparison and fabricated source hashes",()=>{
    for(const override of [{sourceSha256:reviewHash("another source")},{transcriptSha256:reviewHash("another transcript")},{completeSourceCompared:false},{outcome:"unexplained_difference" as const}]){
      const r=decision("transcript");Object.assign(r.deterministicComparison!,override);expect(()=>validateRemainingComponent(r,context())).toThrow("remaining_review_evidence_invalid");
    }
  });
  it("requires exact individual findings and preserves unresolved human decisions",()=>{
    const c=context(),r=decision("findings"),identity=reviewHash("one invented finding");c.findings=[{identitySha256:identity,humanStatus:"pending"}];
    expect(()=>validateRemainingComponent(r,c)).toThrow("remaining_review_evidence_invalid");
    r.findingDispositions=[{identitySha256:identity,disposition:"accepted_source_limitation",rationale:"The source limitation remains visible without a guessed word.",evidenceSha256:transcriptHash}];
    expect(validateRemainingComponent(r,c).findingDispositions).toHaveLength(1);
    c.findings[0]!.humanStatus="left_unresolved";expect(()=>validateRemainingComponent(r,c)).toThrow("remaining_review_evidence_invalid");
    r.outcome="needs_human";r.exceptionCode="human_finding_unresolved";r.informationNeeded="A separately attributable human decision is still needed.";
    expect(validateRemainingComponent(r,c).outcome).toBe("needs_human");
  });
  it("requires explicit verified empty-set acknowledgement",()=>{
    const r=decision("findings");r.checks.emptySetVerified=false;expect(()=>validateRemainingComponent(r,context())).toThrow("remaining_review_evidence_invalid");
  });
  it("keeps true exceptions distinct from acceptance and rejects HTML or invented source evidence",()=>{
    const r=decision("speaker");r.outcome="needs_human";expect(()=>validateRemainingComponent(r,context())).toThrow("remaining_review_evidence_invalid");
    r.exceptionCode="source_name_unavailable";r.informationNeeded="Provide the explicit source speaker identification.";
    expect(validateRemainingComponent(r,context()).outcome).toBe("needs_human");
    r.rationale="<script>private source</script>";expect(()=>validateRemainingComponent(r,context())).toThrow("remaining_review_evidence_invalid");
    r.rationale="Safe invented evidence.";r.evidence[0]!.sha256=reviewHash("unverified source");expect(()=>validateRemainingComponent(r,context())).toThrow("remaining_review_evidence_invalid");
  });
  it("permits only truthful Astra/AI zero-cost provenance and no human approval fields",()=>{
    const p={decision:"D-157",scopeSha256:reviewHash("scope"),policySha256:reviewHash("policy"),sermonId:"99999999-9999-4999-8999-999999999157",expectedSermonVersion:1,
      reviewedAt:"2026-09-12T00:00:00.000Z",components:[decision("identity")],requestPrivateCompletion:true,
      provenance:{reviewer_kind:"ai",provider:"OpenAI",execution_surface:"Codex",model:"gpt-6-astra",mode:"interactive Codex session",immutable_revision:"not_exposed_by_runtime",session_id:"not_exposed_by_runtime",privacy_details:"not_exposed_by_runtime",separately_billed_api_used:false,external_api_cost_aud:0}};
    expect(remainingReviewPacketSchema.safeParse(p).success).toBe(true);
    expect(remainingReviewPacketSchema.safeParse({...p,approvedBy:"local-admin-0001"}).success).toBe(false);
    expect(remainingReviewPacketSchema.safeParse({...p,provenance:{...p.provenance,model:"another-model"}}).success).toBe(false);
    expect(remainingDependencyHash({b:2,a:1})).toBe(remainingDependencyHash({a:1,b:2}));
  });
});

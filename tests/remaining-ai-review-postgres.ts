import type { Pool } from "pg";
import { expect, it } from "vitest";
import { applyDelegatedReview, bindDelegatedReviewScope } from "../src/application/delegated-ai-review-service";
import { applyRemainingPassageProposal, applyRemainingReview, applyRemainingSpeakerAssignment, applyRemainingSourceTermSpeakerAssignment, bindRemainingReviewScope,
  listRemainingReviews, readRemainingReviewSnapshot, type RemainingReviewSnapshot } from "../src/application/remaining-ai-review-service";
import { remainingComponents, remainingDependencyHash, remainingReviewerSubject, type RemainingReviewPacket } from "../src/domain/remaining-ai-review";
import { canonicalReviewJson, reviewHash } from "../src/domain/delegated-ai-review";
import { assertDisposableIntegrationTestDatabase } from "../src/migration/local-database-safety";
import type { SchemaMigrationScope } from "../src/migration/schema-migrations";
import { AdminSermonService } from "../src/application/admin-sermon-service";
import { PostgresAdminSermonRepository } from "../src/server/repositories/postgres-admin-sermon-repository";
import { PostgresSermonRepository } from "../src/server/repositories/postgres-sermon-repository";
import { fixtureRequest, readyPrivateFixture, seedFixture, snapshot } from "./delegated-ai-review-postgres";

const id="99999999-9999-4999-8999-999999999156", policy=reviewHash("invented remaining-review policy"),migration="0018_remaining_private_ai_review";
type RunSchema=(direction:"apply"|"rollback",scope?:SchemaMigrationScope)=>Promise<unknown>;
const provenance={reviewer_kind:"ai",provider:"OpenAI",execution_surface:"Codex",model:"gpt-6-astra",mode:"interactive Codex session",
  immutable_revision:"not_exposed_by_runtime",session_id:"not_exposed_by_runtime",privacy_details:"not_exposed_by_runtime",separately_billed_api_used:false,external_api_cost_aud:0} as const;
const at="2026-09-12T00:00:00.000Z";
function packet(s:RemainingReviewSnapshot):RemainingReviewPacket {
  const whole={start:0,end:s.transcript.body.length,sha256:s.transcript.sha256};
  return {decision:"D-157",scopeSha256:s.scopeSha256,policySha256:s.policySha256,sermonId:id,expectedSermonVersion:s.rowVersion,
    reviewedAt:at,provenance,requestPrivateCompletion:true,components:remainingComponents.map(component=>({component,dependencySha256:s.dependencies[component],
      outcome:"accepted",rationale:"The invented fixture context independently supports this private component.",exceptionCode:null,informationNeeded:null,warnings:[],
      evidence:[{source:"transcript",sha256:s.transcript.sha256,reference:"invented_transcript",range:whole}],
      semanticCoverage:[{origin:"current_context",priorReviewId:null,ranges:[whole]}],completeSemanticTranscriptReview:true,
      deterministicComparison:{sourceSha256:s.sourceSha256!,transcriptSha256:s.transcript.sha256,algorithm:"retained-caption-word-preservation-v1",outcome:"exact_word_sequence",completeSourceCompared:true,comparisonReceiptSha256:reviewHash("invented complete comparison")},
      checks:{stableIdentityVerified:true,dateVerified:true,titleProjectionVerified:true,explicitSpeakerVerified:true,primaryPassageSupported:false,noSinglePrimarySupported:true,emptySetVerified:true,mediaIdentityVerified:true,captionFidelityVerified:true,uncertaintyPreserved:true},
      findingDispositions:[],audioVerified:false}))};
}

export function registerRemainingAiReviewPostgresTests(getPool:()=>Pool,runSchema:RunSchema):void{
  async function fixture(work:(p:Pool,s:RemainingReviewSnapshot)=>Promise<void>):Promise<void>{
    assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL??"",process.env.DISPOSABLE_TEST_DATABASE_TOKEN);
    const p=getPool();
    try{
      await seedFixture(p);await readyPrivateFixture(p);
      await p.query("UPDATE sermon_transcripts SET status='draft',approved_at=NULL,approved_by_subject=NULL WHERE sermon_id=$1",[id]);
      await p.query("UPDATE sermon_primary_passage_reviews SET review_status='pending',reviewed_at=NULL,reviewed_by_subject=NULL WHERE sermon_id=$1",[id]);
      await p.query("UPDATE sermon_enrichment_reviews SET identity_status='pending',empty_item_set_acknowledged_at=NULL,empty_item_set_acknowledged_by_subject=NULL WHERE sermon_id=$1",[id]);
      const ids=(await p.query("SELECT id FROM sermons WHERE deleted_at IS NULL ORDER BY id")).rows.map(r=>r.id);
      const d156=await bindDelegatedReviewScope(p,ids,reviewHash("anonymised-delegated-review-policy-v1"));
      for(const order of [null,1,2,3,4,5])await applyDelegatedReview(p,await fixtureRequest(p,d156.scopeSha256,order));
      const manifest={schemaVersion:1,decision:"D-157",memberCount:ids.length,members:ids.map((sermonId,sequence)=>({sequence:sequence+1,sermonId}))};
      const bound=await bindRemainingReviewScope(p,ids,policy,manifest);
      expect(bound.scopeSha256).toBe(reviewHash(canonicalReviewJson(manifest)));
      const s=await readRemainingReviewSnapshot(p,id);expect(s).not.toBeNull();await work(p,s!);
    }finally{
      await runSchema("rollback",migration);await runSchema("rollback","0017_delegated_private_ai_review");
      await p.query("DELETE FROM audit_events WHERE entity_id=$1",[id]);
      await p.query("DELETE FROM sermons WHERE id=$1",[id]);await p.query("DELETE FROM sermon_deletion_tombstones WHERE former_sermon_id=$1",[id]);
      await p.query("DELETE FROM audit_events WHERE entity_id IN(SELECT id FROM speakers WHERE slug IN('d157-fixture-preacher','d157-fixture-conflict'))");
      await p.query("DELETE FROM speakers WHERE slug IN('d157-fixture-preacher','d157-fixture-conflict')");
      await runSchema("apply","0017_delegated_private_ai_review");await runSchema("apply",migration);
    }
  }
  it("records independent AI components and final private completion without human-field mutation, publication or replay churn",async()=>fixture(async(p,s)=>{
    const before=await snapshot(p,["sermon_ai_component_reviews","audit_events"]),r=packet(s);
    expect(await applyRemainingReview(p,r)).toEqual({outcome:"recorded",recordedComponents:7,privateComplete:true});
    const status=(await listRemainingReviews(p,[id])).get(id)!;
    expect(status.privateComplete).toBe(true);expect(status.completionReviewerSubject).toBe(remainingReviewerSubject);
    expect(status.passageBasis).toBe("no_single_primary");
    expect(Object.values(status.components).every(c=>c.state==="ai_accepted")).toBe(true);
    expect(await snapshot(p,["sermon_ai_component_reviews","audit_events"])).toEqual(before);
    const after=await snapshot(p);expect(await applyRemainingReview(p,r)).toEqual({outcome:"unchanged",recordedComponents:0,privateComplete:true});expect(await snapshot(p)).toEqual(after);
    expect((await p.query("SELECT status,completed_at FROM sermons s JOIN sermon_enrichment_reviews w ON w.sermon_id=s.id WHERE s.id=$1",[id])).rows[0]).toEqual({status:"draft",completed_at:null});
    const service=new AdminSermonService(new PostgresAdminSermonRepository(p));
    for(const action of ["schedule","publish"] as const)await expect(service.transition(id,action,{rowVersion:s.rowVersion,...(action==="schedule"?{scheduledFor:"2099-01-01T00:00:00.000Z"}:{})},{subject:"anonymised-human-reviewer",role:"admin"},"invented-public-guard")).rejects.toMatchObject({status:400});
    expect(await new PostgresSermonRepository(p).findPublishedBySlug("delegated-review-anonymised-fixture")).toBeNull();
  }));
  it.each(["pending","archived","prior_publication"])("retains hard private status guard for %s",async(kind)=>fixture(async(p,s)=>{
    await p.query(kind==="prior_publication"?"UPDATE sermons SET published_at='2020-01-01' WHERE id=$1":"UPDATE sermons SET status=$2 WHERE id=$1",kind==="prior_publication"?[id]:[id,kind]);
    const before=await snapshot(p);await expect(applyRemainingReview(p,packet(s))).rejects.toThrow("remaining_review_scope_evidence_or_concurrency_conflict");expect(await snapshot(p)).toEqual(before);
  }));
  it.each(["missing_qa","stale_qa","missing_speaker","findings_changed","human_passage_rejection"])("blocks completion for independent %s",async(kind)=>fixture(async(p,s)=>{
    if(kind==="missing_qa"){
      // One new current pair has no D-156 decision. Preserve existing reviewed pairs.
      await p.query("INSERT INTO sermon_question_answers(sermon_id,question_text,answer_text,display_order,status,source_kind,source_reference)VALUES($1,'What remains uncertain?','The invented source does not settle this point.',6,'draft','generated_draft','invented-extra')",[id]);
    }
    if(kind==="stale_qa")await p.query("UPDATE sermon_transcripts SET body_text=body_text||' A new invented sentence.' WHERE sermon_id=$1",[id]);
    if(kind==="missing_speaker")await p.query("UPDATE sermons SET speaker_id=NULL WHERE id=$1",[id]);
    if(kind==="findings_changed")await p.query("UPDATE sermon_enrichment_reviews SET expected_item_count=1 WHERE sermon_id=$1",[id]);
    if(kind==="human_passage_rejection")await p.query("UPDATE sermon_primary_passage_reviews SET review_status='rejected',reviewed_at=now(),reviewed_by_subject='anonymised-human-reviewer' WHERE sermon_id=$1",[id]);
    if(kind==="missing_qa")expect((await applyRemainingReview(p,packet(s))).privateComplete).toBe(false);
    else await expect(applyRemainingReview(p,packet(s))).rejects.toThrow("remaining_review_scope_evidence_or_concurrency_conflict");
    expect((await listRemainingReviews(p,[id])).get(id)?.privateComplete).toBe(false);
  }));
  it("preserves mixed existing human approval and rejects concurrent requests without partial decisions",async()=>fixture(async(p,s)=>{
    await p.query("UPDATE sermon_transcripts SET status='approved',reviewed_at=now(),approved_at=now(),reviewed_by_subject='anonymised-human-reviewer',approved_by_subject='anonymised-human-reviewer' WHERE sermon_id=$1",[id]);
    const next=await readRemainingReviewSnapshot(p,id),r=packet(next!);
    const human=(await p.query("SELECT to_jsonb(t) AS row FROM sermon_transcripts t WHERE sermon_id=$1",[id])).rows[0];
    expect((await applyRemainingReview(p,r)).privateComplete).toBe(true);
    expect((await listRemainingReviews(p,[id])).get(id)?.components.transcript.state).toBe("human_approved");
    expect((await p.query("SELECT to_jsonb(t) AS row FROM sermon_transcripts t WHERE sermon_id=$1",[id])).rows[0]).toEqual(human);
    const stale=packet(s),before=await snapshot(p);await expect(applyRemainingReview(p,stale)).rejects.toThrow();expect(await snapshot(p)).toEqual(before);
  }));
  it("retains visible source limitations separately from human approval without claiming new semantic reading",async()=>fixture(async(p)=>{
    await p.query("UPDATE sermon_transcripts SET status='approved',reviewed_at=now(),approved_at=now(),reviewed_by_subject='anonymised-human-reviewer',approved_by_subject='anonymised-human-reviewer' WHERE sermon_id=$1",[id]);
    const s=(await readRemainingReviewSnapshot(p,id))!,r=packet(s),component=r.components.find(x=>x.component==="transcript")!;
    component.outcome="accepted_source_limitation";component.warnings=["retained_source_unavailable"];
    component.semanticCoverage=[];component.completeSemanticTranscriptReview=false;component.checks.captionFidelityVerified=false;
    component.evidence=[{source:"source_provenance",sha256:s.sourceProvenanceSha256,reference:"preserved_source_metadata"}];
    component.deterministicComparison!.outcome="source_unavailable";component.deterministicComparison!.completeSourceCompared=false;
    r.components=[component];r.requestPrivateCompletion=false;
    const before=await snapshot(p,["sermon_ai_component_reviews","audit_events"]);
    expect((await applyRemainingReview(p,r)).recordedComponents).toBe(1);
    expect(await snapshot(p,["sermon_ai_component_reviews","audit_events"])).toEqual(before);
    expect((await listRemainingReviews(p,[id])).get(id)?.components.transcript).toMatchObject({state:"human_approved",accepted:true,reviewerSubject:"anonymised-human-reviewer",model:null,warnings:["retained_source_unavailable"],sourceLimitation:true});
    const after=await snapshot(p);expect((await applyRemainingReview(p,r)).outcome).toBe("unchanged");expect(await snapshot(p)).toEqual(after);
  }));
  it("allows irrelevant version-only replay but stale relevant changes invalidate private completion",async()=>fixture(async(p,s)=>{
    const r=packet(s);await applyRemainingReview(p,r);await p.query("UPDATE sermons SET row_version=row_version+1 WHERE id=$1",[id]);
    const before=await snapshot(p);expect((await applyRemainingReview(p,r)).outcome).toBe("unchanged");expect(await snapshot(p)).toEqual(before);
    await p.query("UPDATE sermons SET title='An edited invented title' WHERE id=$1",[id]);
    expect((await listRemainingReviews(p,[id])).get(id)?.components.identity.state).toBe("stale");expect((await listRemainingReviews(p,[id])).get(id)?.privateComplete).toBe(false);
  }));
  it("serializes identical concurrent packets into a single decision set",async()=>fixture(async(p,s)=>{
    const results=await Promise.allSettled([applyRemainingReview(p,packet(s)),applyRemainingReview(p,packet(s))]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect((await p.query("SELECT count(*)::int AS n FROM sermon_ai_component_reviews WHERE sermon_id=$1",[id])).rows[0].n).toBe(7);
  }));
  it("keeps scope, member and decision history immutable with guarded deletion and tombstone protection",async()=>fixture(async(p,s)=>{
    await applyRemainingReview(p,packet(s));
    for(const sql of ["UPDATE remaining_ai_review_scopes SET member_count=1","DELETE FROM remaining_ai_review_members WHERE sermon_id=$1","DELETE FROM sermon_ai_component_reviews WHERE sermon_id=$1","DELETE FROM sermons WHERE id=$1"]){
      await expect(p.query(sql,sql.includes("$1")?[id]:[])).rejects.toThrow();
    }
    await p.query("UPDATE sermons SET status='archived',row_version=row_version+1 WHERE id=$1",[id]);
    const row=(await p.query("SELECT title,slug,row_version FROM sermons WHERE id=$1",[id])).rows[0];
    const service=new AdminSermonService(new PostgresAdminSermonRepository(p));
    await service.permanentlyDelete(id,{rowVersion:row.row_version,confirmation:row.slug,reason:"Delete only the invented guarded fixture",seoDisposition:null},{subject:"anonymised-human-reviewer",role:"admin"},"invented-d157-delete");
    expect((await p.query("SELECT count(*)::int AS n FROM sermon_ai_component_reviews WHERE sermon_id=$1",[id])).rows[0].n).toBe(0);
    expect((await p.query("SELECT count(*)::int AS n FROM sermon_deletion_tombstones WHERE former_sermon_id=$1",[id])).rows[0].n).toBe(1);
  }));
  it("fills an explicit canonical source speaker only while missing and retains immutable assignment evidence on replay",async()=>fixture(async(p,s)=>{
    await p.query("UPDATE sermons SET speaker_id=NULL WHERE id=$1",[id]);
    const speaker=(await p.query("SELECT id,name FROM speakers ORDER BY id LIMIT 1")).rows[0],media=s.mediaRows[0]!;
    await p.query("UPDATE sermon_media SET title=$2 WHERE id=$1",[media.id,`Invented source sermon by ${speaker.name}`]);
    const current=(await readRemainingReviewSnapshot(p,id))!,m=current.mediaRows[0]!;
    const r={decision:"D-157" as const,scopeSha256:s.scopeSha256,policySha256:policy,sermonId:id,expectedSermonVersion:current.rowVersion,sourceSha256:s.sourceSha256!,reviewedAt:at,provenance,rationale:"The exact full canonical name is explicit in the invented source title.",component:"speaker" as const,speakerId:speaker.id,mediaId:m.id,mediaTitleSha256:reviewHash(m.title)};
    expect(await applyRemainingSpeakerAssignment(p,r)).toBe("recorded");const after=await snapshot(p);expect(await applyRemainingSpeakerAssignment(p,r)).toBe("unchanged");expect(await snapshot(p)).toEqual(after);
    const other=(await p.query("SELECT id FROM speakers WHERE id<>$1 LIMIT 1",[speaker.id])).rows[0];await expect(applyRemainingSpeakerAssignment(p,{...r,speakerId:other.id})).rejects.toThrow();
  }));
  it("creates only an unapproved private supported passage proposal and preserves previous evidence",async()=>fixture(async(p,s)=>{
    const r={decision:"D-157" as const,scopeSha256:s.scopeSha256,policySha256:policy,sermonId:id,expectedSermonVersion:s.rowVersion,sourceSha256:s.sourceSha256!,reviewedAt:at,provenance,rationale:"Invented test context supports a canonical book-only proposal.",component:"passage" as const,transcriptSha256:s.transcript.sha256,
      passage:{canonicalBookId:41,startChapter:null,startVerse:null,endChapter:null,endVerse:null,relationshipRole:"primary" as const,isLead:true},support:[{start:0,end:s.transcript.body.length,sha256:s.transcript.sha256}],primaryRatherThanIncidental:true as const,exactGranularitySupported:true as const};
    expect(await applyRemainingPassageProposal(p,r)).toBe("recorded");const after=await snapshot(p);expect(await applyRemainingPassageProposal(p,r)).toBe("unchanged");expect(await snapshot(p)).toEqual(after);
    expect((await readRemainingReviewSnapshot(p,id))?.passageReview?.review_status).toBe("pending");
    expect((await p.query("SELECT review_status,reviewer_subject FROM scripture_references WHERE sermon_id=$1",[id])).rows[0]).toEqual({review_status:"proposed",reviewer_subject:null});
    await expect(applyRemainingPassageProposal(p,{...r,passage:{...r.passage,canonicalBookId:42}})).rejects.toThrow();
  }));
  it.each(["valid","stale_metadata","stale_reference_version","human_confirmed","human_authored","unexpected_parser"])("refines only an exact current machine passage proposal: %s",async(kind)=>fixture(async(p,s)=>{
    await p.query(`INSERT INTO scripture_references(sermon_id,display_text,canonical_book_id,start_chapter,start_verse,end_chapter,end_verse,
      display_order,parse_status,relationship_role,is_lead,original_reference_text,provenance,review_status,parser_version)
      VALUES($1,'Mark 1:1',41,1,1,1,1,0,'exact','primary',true,'Invented retained source: Mark 1:1 through 3','title_proposal','proposed','explicit-primary-book-v1')`,[id]);
    const current=(await readRemainingReviewSnapshot(p,id))!,ref=current.passageRows[0]!;
    const r={decision:"D-157" as const,scopeSha256:s.scopeSha256,policySha256:policy,sermonId:id,expectedSermonVersion:current.rowVersion,sourceSha256:s.sourceSha256!,reviewedAt:at,provenance,
      rationale:"The invented contextual source supports the complete range in place of a truncated machine proposal.",component:"passage" as const,transcriptSha256:s.transcript.sha256,
      passage:{canonicalBookId:41,startChapter:1,startVerse:1,endChapter:1,endVerse:3,relationshipRole:"primary" as const,isLead:true},
      replacePendingProposal:{referenceId:ref.id,referenceVersion:ref.row_version,metadataSha256:remainingDependencyHash({passages:current.passageRows,review:current.passageReview})},
      support:[{start:0,end:s.transcript.body.length,sha256:s.transcript.sha256}],primaryRatherThanIncidental:true as const,exactGranularitySupported:true as const};
    if(kind==="stale_metadata")await p.query("UPDATE scripture_references SET end_verse=2 WHERE id=$1",[ref.id]);
    if(kind==="stale_reference_version")r.replacePendingProposal.referenceVersion++;
    if(kind==="human_confirmed"){
      const c=await p.connect();try{await c.query("BEGIN");await c.query("UPDATE scripture_references SET review_status='confirmed',reviewer_subject='anonymised-human-reviewer',reviewed_at=now() WHERE id=$1",[ref.id]);
        await c.query("UPDATE sermon_primary_passage_reviews SET review_status='confirmed_passage',reviewed_by_subject='anonymised-human-reviewer',reviewed_at=now() WHERE sermon_id=$1",[id]);await c.query("COMMIT");}finally{c.release();}
    }
    if(kind==="human_authored")await p.query("UPDATE scripture_references SET provenance='administrator_correction',review_status='unreviewed' WHERE id=$1",[ref.id]);
    if(kind==="unexpected_parser")await p.query("UPDATE scripture_references SET parser_version='another-unverified-path' WHERE id=$1",[ref.id]);
    const before=await snapshot(p);
    if(kind!=="valid"){await expect(applyRemainingPassageProposal(p,r)).rejects.toThrow();expect(await snapshot(p)).toEqual(before);return;}
    const protectedBefore=await snapshot(p,["sermons","scripture_references","sermon_primary_passage_reviews","sermon_ai_metadata_assignments","audit_events"]);
    expect(await applyRemainingPassageProposal(p,r)).toBe("recorded");
    const after=await snapshot(p);expect(await applyRemainingPassageProposal(p,r)).toBe("unchanged");expect(await snapshot(p)).toEqual(after);
    expect(await snapshot(p,["sermons","scripture_references","sermon_primary_passage_reviews","sermon_ai_metadata_assignments","audit_events"])).toEqual(protectedBefore);
    const updated=(await readRemainingReviewSnapshot(p,id))!,kept=updated.passageRows[0]!;
    expect(kept).toMatchObject({id:ref.id,original_reference_text:ref.original_reference_text,start_verse:1,end_verse:3,review_status:"proposed",reviewer_subject:null});
    expect(updated.passageReview?.review_status).toBe("pending");
    const history=(await p.query("SELECT previous_metadata,current_metadata FROM sermon_ai_metadata_assignments WHERE sermon_id=$1 AND component='passage'",[id])).rows[0];
    expect(history.previous_metadata.passages[0]).toMatchObject({end_verse:1,parser_version:"explicit-primary-book-v1"});
    expect(history.current_metadata.passages[0]).toMatchObject({end_verse:3,parser_version:"d157-context-supported-private-proposal-v1"});
  }));
  it.each(["create","reuse_exact_name","term_conflict","name_conflict","missing_name","stale_title","inventory_hash","wrong_anchor_scope","human_clear","human_metadata_clear","unrelated_metadata","unchanged_metadata","existing_selection","stale_anchor_source"])("keeps canonical source-term speaker assignment bounded: %s",async(kind)=>fixture(async(p,s)=>{
    const name="D157 Fixture Preacher",termId=987654321;
    if(kind!=="existing_selection")await p.query("UPDATE sermons SET speaker_id=NULL WHERE id=$1",[id]);
    await p.query("UPDATE sermon_enrichment_sources SET retrieval_attribution='authorised_youtube_data_api' WHERE sermon_id=$1",[id]);
    const media=s.mediaRows[0]!;
    await p.query("UPDATE sermon_media SET title=$2 WHERE id=$1",[media.id,kind==="missing_name"?"An invented source without an identified speaker":`Invented source message — ${name} — private evaluation source`]);
    if(kind==="reuse_exact_name"||kind==="name_conflict")await p.query("INSERT INTO speakers(name,slug,source_term_id)VALUES($1,'d157-fixture-preacher',$2)",[name,kind==="name_conflict"?termId+1:null]);
    if(kind==="term_conflict")await p.query("INSERT INTO speakers(name,slug,source_term_id)VALUES('D157 Fixture Conflict','d157-fixture-conflict',$1)",[termId]);
    const current=(await readRemainingReviewSnapshot(p,id))!,m=current.mediaRows[0]!;
    const payload={rows:[{sourceId:Number(current.metadata.source_wordpress_id),speaker:{relationshipCount:1,relationshipTermIds:String(termId)}}]};
    const inventoryContentSha256=reviewHash(JSON.stringify(payload)),inventoryBytes=JSON.stringify({...payload,integrity:{contentSha256:inventoryContentSha256}});
    const r={decision:"D-157" as const,scopeSha256:s.scopeSha256,policySha256:policy,sermonId:id,expectedSermonVersion:current.rowVersion,sourceSha256:s.sourceSha256!,reviewedAt:at,provenance,
      rationale:"One explicit invented source full name and exact taxonomy term support this missing canonical relationship.",component:"speaker" as const,
      sourceTermId:termId,canonicalName:name,inventoryContentSha256,anchor:{sermonId:id,sourceSha256:s.sourceSha256!,mediaId:m.id,mediaTitleSha256:reviewHash(m.title)}};
    if(kind==="stale_title")r.anchor.mediaTitleSha256=reviewHash("stale invented title");
    if(kind==="inventory_hash")r.inventoryContentSha256=reviewHash("unverified inventory");
    if(kind==="wrong_anchor_scope")r.anchor.sermonId="99999999-9999-4999-8999-999999999199";
    if(kind==="stale_anchor_source")r.anchor.sourceSha256=reviewHash("stale invented source");
    if(kind==="human_clear")await p.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id,outcome)VALUES('anonymised-human-reviewer','admin','sermon.speaker_assignment_updated','sermon',$1,'[\"speakerId\"]','invented-human-clear','succeeded')",[id]);
    if(["human_metadata_clear","unrelated_metadata","unchanged_metadata"].includes(kind))await p.query("INSERT INTO audit_events(actor_subject,actor_role,action,entity_type,entity_id,changed_fields,request_correlation_id,outcome)VALUES('anonymised-human-reviewer','admin',$2,'sermon',$1,$3::jsonb,'invented-metadata-save','succeeded')",[id,kind==="unchanged_metadata"?"sermon.update":"sermon.metadata_updated",JSON.stringify([kind==="unrelated_metadata"?"title":"speakerId"])]);
    const before=await snapshot(p),allowed=["create","reuse_exact_name","unrelated_metadata","unchanged_metadata"].includes(kind);
    if(!allowed){await expect(applyRemainingSourceTermSpeakerAssignment(p,r,inventoryBytes)).rejects.toThrow();expect(await snapshot(p)).toEqual(before);return;}
    const protectedBefore=await snapshot(p,["sermons","speakers","sermon_ai_metadata_assignments","audit_events"]);
    expect(await applyRemainingSourceTermSpeakerAssignment(p,r,inventoryBytes)).toBe("recorded");
    const after=await snapshot(p);expect(await applyRemainingSourceTermSpeakerAssignment(p,r,inventoryBytes)).toBe("unchanged");expect(await snapshot(p)).toEqual(after);
    expect(await snapshot(p,["sermons","speakers","sermon_ai_metadata_assignments","audit_events"])).toEqual(protectedBefore);
    const speaker=(await p.query("SELECT name,source_term_id FROM speakers WHERE id=(SELECT speaker_id FROM sermons WHERE id=$1)",[id])).rows[0];
    expect(speaker).toEqual({name,source_term_id:kind==="reuse_exact_name"?null:String(termId)});
    expect((await p.query("SELECT count(*)::int AS n FROM audit_events WHERE action='speaker.d157_source_reference_created' AND actor_subject=$1 AND actor_role='system'",[remainingReviewerSubject])).rows[0].n).toBe(kind==="reuse_exact_name"?0:1);
  }));
  it("roundtrips additive migration 0018 and no-op rerun without altering preceding migration meaning",async()=>{
    const p=getPool();await expect(runSchema("rollback",migration)).resolves.toMatchObject({outcome:"rolled_back",journalReceiptCount:17});
    expect((await p.query("SELECT to_regclass('public.sermon_ai_component_reviews') AS relation")).rows[0].relation).toBeNull();
    await expect(runSchema("apply",migration)).resolves.toMatchObject({outcome:"applied",journalReceiptCount:18});
    const before=await snapshot(p);await expect(runSchema("apply",migration)).resolves.toMatchObject({outcome:"no_op",journalReceiptCount:18});expect(await snapshot(p)).toEqual(before);
  });
}

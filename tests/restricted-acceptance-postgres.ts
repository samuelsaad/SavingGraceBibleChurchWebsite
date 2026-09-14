import type { Pool } from "pg";
import { expect,it } from "vitest";
import { seedFixture,readyPrivateFixture,fixtureRequest,snapshot } from "./delegated-ai-review-postgres";
import { packet } from "./remaining-ai-review-postgres";
import { applyDelegatedReview,bindDelegatedReviewScope } from "../src/application/delegated-ai-review-service";
import { applyRemainingReview,bindRemainingReviewScope,readRemainingReviewSnapshot } from "../src/application/remaining-ai-review-service";
import { applyRestrictedAcceptance,withdrawRestrictedAcceptance } from "../src/application/restricted-acceptance-service";
import { inspectRestrictedAcceptance } from "../src/application/restricted-acceptance-evidence";
import { restrictedAcceptanceManifest } from "../src/domain/restricted-acceptance";
import { remainingDependencyHash } from "../src/domain/remaining-ai-review";
import { reviewHash } from "../src/domain/delegated-ai-review";
import { assertDisposableIntegrationTestDatabase } from "../src/migration/local-database-safety";
import type { SchemaMigrationScope } from "../src/migration/schema-migrations";
import { PostgresSermonRepository } from "../src/server/repositories/postgres-sermon-repository";
import { AdminSermonService } from "../src/application/admin-sermon-service";
import { PostgresAdminSermonRepository } from "../src/server/repositories/postgres-admin-sermon-repository";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import { withLegacyReviewTimezone } from "../src/application/legacy-review-timezone";
import { applyRestrictedAcceptanceSchema } from "../src/application/restricted-acceptance-schema";
import { applyTopicalClassification } from "../src/application/topical-classification-service";
import { topicalAuthorization, topicalManifestHash, topicalNamespace } from "../src/domain/topical-classification";
import { topicalPreservationFingerprint } from "../src/application/topical-classification-command";
const id="99999999-9999-4999-8999-999999999156",migration="0019_restricted_bulk_acceptance",slug="delegated-review-anonymised-fixture";
type RunSchema=(direction:"apply"|"rollback",scope?:SchemaMigrationScope)=>Promise<unknown>;
export function registerRestrictedAcceptancePostgresTests(getPool:()=>Pool,runSchema:RunSchema) {
  async function fixture(work:(p:Pool,m:Awaited<ReturnType<typeof inspectRestrictedAcceptance>>)=>Promise<void>, primary=false) {
    assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL??"",process.env.DISPOSABLE_TEST_DATABASE_TOKEN);
    const p=getPool();
    try {
      await seedFixture(p);await readyPrivateFixture(p);
      if(primary){
        await p.query("INSERT INTO bible_books(id,canonical_name,slug,testament,canonical_order) VALUES(60,'1 Peter','1-peter','new',60) ON CONFLICT DO NOTHING");
        await p.query("UPDATE sermon_primary_passage_reviews SET review_status='pending',reviewed_at=NULL,reviewed_by_subject=NULL WHERE sermon_id=$1",[id]);
        await p.query(`INSERT INTO scripture_references(sermon_id,display_text,canonical_book_id,start_chapter,end_chapter,start_verse,end_verse,parse_status,relationship_role,review_status,is_lead,provenance,parser_version,original_reference_text)
          VALUES($1,'1 Peter 2:1-3',60,2,2,1,3,'exact','primary','proposed',true,'title_proposal','invented-v1','1 Peter 2:1-3')`,[id]);
      }
      const ids=(await p.query("SELECT id FROM sermons WHERE deleted_at IS NULL ORDER BY id")).rows.map(r=>r.id);
      const scope=await bindDelegatedReviewScope(p,ids,reviewHash("anonymised-delegated-review-policy-v1"));
      for(const order of [null,1,2,3,4,5]) await applyDelegatedReview(p,await fixtureRequest(p,scope.scopeSha256,order));
      const manifest={schemaVersion:1,decision:"D-157",memberCount:ids.length,members:ids.map((sermonId,sequence)=>({sequence:sequence+1,sermonId}))};
      await bindRemainingReviewScope(p,ids,reviewHash("invented remaining-review policy"),manifest);
      const review=packet((await readRemainingReviewSnapshot(p,id))!);
      if(primary) for(const component of review.components){component.checks.primaryPassageSupported=true;component.checks.noSinglePrimarySupported=false;}
      await applyRemainingReview(p,review);
      const c=await p.connect();let m;
      try{await c.query("BEGIN READ ONLY");m=await inspectRestrictedAcceptance(c);}finally{await c.query("ROLLBACK");c.release();}
      expect(m.members).toHaveLength(1);expect(m.members[0]!.sermonId).toBe(id);
      await work(p,m);
    } finally {
      // Cleanup exercises the real archived/tombstone lifecycle; never disables
      // immutable-history triggers or performs a destructive down after acceptance.
      const s=(await p.query("SELECT id,title,slug,row_version,published_at FROM sermons WHERE id=$1",[id])).rows[0];
      if(s){await p.query("UPDATE sermons SET status='archived',row_version=row_version+1 WHERE id=$1",[id]);
        await new AdminSermonService(new PostgresAdminSermonRepository(p)).permanentlyDelete(id,{rowVersion:s.row_version+1,confirmation:s.slug,
          reason:"Remove only the invented D158 disposable fixture",seoDisposition:s.published_at?{kind:"gone"}:null},{subject:"anonymised-human-reviewer",role:"admin"},"invented-d158-cleanup");}
      await runSchema("rollback","0018_remaining_private_ai_review");await runSchema("rollback","0017_delegated_private_ai_review");
      await p.query("DELETE FROM audit_events WHERE entity_id=$1",[id]);await p.query("DELETE FROM sermon_deletion_tombstones WHERE former_sermon_id=$1",[id]);
      await runSchema("apply","0017_delegated_private_ai_review");
    }
  }
  // Test-only SQL literal projection. Production has no configurable manifest
  // override and never admits this invented fixture's different canonical hash.
  const fixtureRepository=(p:Pool,hash:string)=>new PostgresSermonRepository({query:(sql:string,args:unknown[])=>p.query(sql.replaceAll(restrictedAcceptanceManifest,hash),args)} as unknown as Pool,"restricted_accepted");
  const topicalManifest = () => ({version:1,authorization:topicalAuthorization,sourceAcceptanceManifest:restrictedAcceptanceManifest,sermonIds:[id]});
  const topicalRepository = (p:Pool,hash:string) => new PostgresSermonRepository({query:(sql:string,args:unknown[])=>p.query(
    sql.replaceAll(restrictedAcceptanceManifest,hash).replaceAll(topicalManifestHash,remainingDependencyHash(topicalManifest())),args)} as unknown as Pool,"restricted_accepted");
  it("persists only Samuel's explicit topical extension/audit, preserving all content and immutable acceptance, with idempotent discovery",async()=>fixture(async(p,m)=>{
    await applyRestrictedAcceptance(p,m,"local_loopback");
    const before=await snapshot(p,["sermon_extensions","audit_events"]);
    const c=await p.connect();let preserved;
    try {await c.query("BEGIN READ ONLY");preserved=(await topicalPreservationFingerprint(c,[id])).sha256;}finally{await c.query("ROLLBACK");c.release();}
    const protect=async(client:typeof c)=>{expect((await topicalPreservationFingerprint(client,[id])).sha256).toBe(preserved);};
    expect((await applyTopicalClassification(p,topicalManifest(),"local_loopback",protect)).inserted).toBe(1);
    expect(await snapshot(p,["sermon_extensions","audit_events"])).toEqual(before);
    const after=await snapshot(p);expect((await applyTopicalClassification(p,topicalManifest(),"local_loopback",protect)).outcome).toBe("unchanged");expect(await snapshot(p)).toEqual(after);
    const repo=topicalRepository(p,remainingDependencyHash(m));
    expect((await repo.listPublishedTopicalSermons()).map(s=>s.id)).toEqual([id]);
    expect((await repo.listPublished(publicSermonListQuerySchema.parse({}))).data[0]!.isTopical).toBe(true);
    expect((await repo.findPublishedBySlug(slug))!.isTopical).toBe(true);
    expect((await repo.findPublishedBySlug(slug))!.books).toEqual([]);
    expect(await new PostgresSermonRepository(p).listPublishedTopicalSermons()).toEqual([]);
    const payload=(await p.query("SELECT payload FROM sermon_extensions WHERE sermon_id=$1 AND namespace=$2",[id,topicalNamespace])).rows[0].payload;
    expect(payload.authorizedBy).toBe("samuel-saad-editorial-authorization");expect(payload.source).toBe("samuel_editorial_decision");expect(payload.manualContentReviewClaimed).toBe(false);
  }));
  it("does not infer topical from absence of a book or accept a primary-book sermon",async()=>fixture(async(p,m)=>{
    await applyRestrictedAcceptance(p,m,"local_loopback");const repo=topicalRepository(p,remainingDependencyHash(m));
    expect(await repo.listPublishedTopicalSermons()).toEqual([]);const before=await snapshot(p);
    await expect(applyTopicalClassification(p,topicalManifest(),"local_loopback")).rejects.toThrow("topical_scope_conflict");expect(await snapshot(p)).toEqual(before);
  },true));
  it.each(["changed_dependency","missing_audit","modified_payload"])("rejects stale or unaudited topical evidence: %s",async(kind)=>fixture(async(p,m)=>{
    await applyRestrictedAcceptance(p,m,"local_loopback");await applyTopicalClassification(p,topicalManifest(),"local_loopback");
    if(kind==="changed_dependency")await p.query("UPDATE sermons SET row_version=row_version+1 WHERE id=$1",[id]);
    if(kind==="missing_audit")await p.query("DELETE FROM audit_events WHERE entity_id=$1 AND action='sermon.website.topical_classification'",[id]);
    if(kind==="modified_payload")await p.query("UPDATE sermon_extensions SET payload=payload||'{\"source\":\"invented\"}'::jsonb WHERE sermon_id=$1 AND namespace=$2",[id,topicalNamespace]);
    expect(await topicalRepository(p,remainingDependencyHash(m)).listPublishedTopicalSermons()).toEqual([]);
    const before=await snapshot(p);await expect(applyTopicalClassification(p,topicalManifest(),"local_loopback")).rejects.toThrow();expect(await snapshot(p)).toEqual(before);
  }));
  it("rolls back the complete classification transaction if preservation fails after insert",async()=>fixture(async(p,m)=>{
    await applyRestrictedAcceptance(p,m,"local_loopback");const before=await snapshot(p);let calls=0;
    await expect(applyTopicalClassification(p,topicalManifest(),"local_loopback",async()=>{if(++calls===2)throw new Error("topical_original_record_conflict");})).rejects.toThrow();
    expect(calls).toBe(2);expect(await snapshot(p)).toEqual(before);
  }));
  it("projects accepted primary books without legacy mappings and reconciles counts, alias filters, pagination and stale exclusion",async()=>fixture(async(p,m)=>{
    await applyRestrictedAcceptance(p,m,"local_loopback");
    const repo=fixtureRepository(p,remainingDependencyHash(m));
    const all=publicSermonListQuerySchema.parse({pageSize:1});
    expect((await repo.listPublished(all)).data[0]!.books).toEqual([{name:"1 Peter",slug:"1-peter"}]);
    expect((await repo.findPublishedBySlug(slug))!.books).toEqual([{name:"1 Peter",slug:"1-peter"}]);
    expect((await repo.listPublishedFilterOptions()).books).toEqual([{name:"1 Peter",slug:"1-peter",sermonCount:1}]);
    for(const book of ["1-peter","first-peter"]){
      const q=publicSermonListQuerySchema.parse({book,pageSize:1});
      expect((await repo.listPublished(q)).totalItems).toBe(1);
      expect((await repo.listPublished({...q,page:2}))).toEqual({data:[],totalItems:1});
      expect((await repo.listPublishedFilterOptions(q)).books[0]!.sermonCount).toBe(1);
      expect((await repo.listPublishedFilterOptions({...q,query:"unmatchedfixtureword"})).books).toEqual([]);
    }
    const q=publicSermonListQuerySchema.parse({passageBook:"1-peter",passageChapter:2,passageVerse:2});
    expect((await repo.listPublished(q)).totalItems).toBe(1);
    await p.query("UPDATE sermons SET row_version=row_version+1 WHERE id=$1",[id]);
    expect((await repo.listPublishedFilterOptions()).books).toEqual([]);
    expect((await repo.listPublished(all)).totalItems).toBe(0);
  },true));
  it("accepts current mixed human/AI evidence once, preserves content/history and exposes only the accepted fixture",async()=>fixture(async(p,m)=>{
    const before=await snapshot(p,["sermons","audit_events","sermon_restricted_acceptances"]);
    const hash=remainingDependencyHash(m),r=await applyRestrictedAcceptance(p,m,"local_loopback");expect(r.accepted).toBe(1);
    expect(await snapshot(p,["sermons","audit_events","sermon_restricted_acceptances"])).toEqual(before);
    const after=await snapshot(p);expect((await applyRestrictedAcceptance(p,m,"local_loopback")).outcome).toBe("unchanged");expect(await snapshot(p)).toEqual(after);
    const row=(await p.query("SELECT authorized_by,executed_by,manual_review_claimed FROM sermon_restricted_acceptances WHERE sermon_id=$1",[id])).rows[0];
    expect(row).toEqual({authorized_by:"samuel-saad-bulk-authorization",executed_by:"codex-d158-restricted-acceptance",manual_review_claimed:false});
    expect(await new PostgresSermonRepository(p).findPublishedBySlug(slug)).toBeNull();
    expect(await new PostgresSermonRepository(p,"restricted_accepted").findPublishedBySlug(slug)).toBeNull();
    const repo=fixtureRepository(p,hash),detail=await repo.findPublishedBySlug(slug);expect(detail).not.toBeNull();expect(detail!.questionAnswers).toHaveLength(5);
    expect((await repo.listPublished(publicSermonListQuerySchema.parse({page:1,pageSize:50}))).totalItems).toBe(1);
    expect((await repo.listPublished(publicSermonListQuerySchema.parse({query:"carpenter"}))).totalItems).toBe(1);
    expect((await repo.listPublished(publicSermonListQuerySchema.parse({query:"nonexistentfixtureword"}))).totalItems).toBe(0);
    await expect(runSchema("rollback",migration)).rejects.toThrow();expect(await snapshot(p)).toEqual(after);
  }));
  it.each(["title","question","transcript","finding","media","passage","version"])("hides accepted content on a genuine dependency change: %s",async(kind)=>fixture(async(p,m)=>{
    await applyRestrictedAcceptance(p,m,"local_loopback");
    const sql={title:"UPDATE sermons SET title=title||' edited' WHERE id=$1",question:"UPDATE sermon_question_answers SET answer_text=answer_text||' Edited.' WHERE sermon_id=$1",
      transcript:"UPDATE sermon_transcripts SET body_text=body_text||' Edited.' WHERE sermon_id=$1",finding:"UPDATE sermon_enrichment_reviews SET empty_item_set_acknowledged_at=NULL,empty_item_set_acknowledged_by_subject=NULL WHERE sermon_id=$1",
      media:"UPDATE sermon_media SET title=title||' edited' WHERE sermon_id=$1",passage:"UPDATE sermon_primary_passage_reviews SET parser_version='edited-fixture' WHERE sermon_id=$1",
      version:"UPDATE sermons SET row_version=row_version+1 WHERE id=$1"}[kind]!;
    const c=await p.connect();try{await c.query("BEGIN");await c.query("SET LOCAL savinggrace.application_request='on'");await c.query(sql,[id]);await c.query("COMMIT");}
    catch(error){await c.query("ROLLBACK");throw error;}finally{c.release();}
    expect(await fixtureRepository(p,remainingDependencyHash(m)).findPublishedBySlug(slug)).toBeNull();
    const before=await snapshot(p);await expect(applyRestrictedAcceptance(p,m,"local_loopback")).rejects.toThrow();expect(await snapshot(p)).toEqual(before);
  }));
  it("rejects stale manifest or concurrent metadata with no partial acceptance",async()=>fixture(async(p,m)=>{
    await p.query("UPDATE sermons SET row_version=row_version+1 WHERE id=$1",[id]);const before=await snapshot(p);
    await expect(applyRestrictedAcceptance(p,m,"local_loopback")).rejects.toThrow();expect(await snapshot(p)).toEqual(before);
  }));
  it("withdraws through append-only audit, preserves original acceptance, hides content and replays without churn",async()=>fixture(async(p,m)=>{
    await applyRestrictedAcceptance(p,m,"local_loopback");const original=(await p.query("SELECT to_jsonb(a) AS row FROM sermon_restricted_acceptances a")).rows;
    const request={sermonId:id,rowVersion:m.members[0]!.rowVersion+1,authorizationReference:"INVENTED-WITHDRAWAL-ONLY",reason:"Anonymised history-preserving recovery",manifestSha256:restrictedAcceptanceManifest};
    expect(await withdrawRestrictedAcceptance(p,request,"local_loopback")).toBe("withdrawn");const after=await snapshot(p);
    expect(await withdrawRestrictedAcceptance(p,request,"local_loopback")).toBe("unchanged");expect(await snapshot(p)).toEqual(after);
    expect((await p.query("SELECT to_jsonb(a) AS row FROM sermon_restricted_acceptances a")).rows).toEqual(original);
    expect(await fixtureRepository(p,remainingDependencyHash(m)).findPublishedBySlug(slug)).toBeNull();
    await expect(p.query("DELETE FROM sermon_restricted_acceptances")).rejects.toThrow();await expect(p.query("UPDATE sermon_restricted_acceptance_withdrawals SET reason='erase'")).rejects.toThrow();
    await expect(runSchema("rollback",migration)).rejects.toThrow();
  }));
  it("preserves legacy evidence across UTC/Sydney and gives new hashes identical DST-boundary instants",async()=>fixture(async(p,m)=>{
    const c=await p.connect();try{
      await c.query("BEGIN");const hashes=[];
      for(const zone of ["UTC","Australia/Sydney"]){await c.query("SELECT set_config('TimeZone',$1,true)",[zone]);
        hashes.push(remainingDependencyHash(await inspectRestrictedAcceptance(c)));expect((await c.query("SHOW timezone")).rows[0].TimeZone).toBe(zone);}
      expect(hashes).toEqual([remainingDependencyHash(m),remainingDependencyHash(m)]);
      for(const instant of ["2026-04-04T15:59:59Z","2026-04-04T16:00:00Z","2026-10-03T15:59:59Z","2026-10-03T16:00:00Z"]){
        await c.query("UPDATE sermon_transcripts SET updated_at=$2 WHERE sermon_id=$1",[id,instant]);const raw=[],canonical=[];
        for(const zone of ["UTC","Australia/Sydney"]){await c.query("SELECT set_config('TimeZone',$1,true)",[zone]);
          raw.push((await c.query("SELECT to_jsonb(t)->>'updated_at' AS ts FROM sermon_transcripts t WHERE sermon_id=$1",[id])).rows[0].ts);
          canonical.push((await c.query("SELECT restricted_acceptance_dependency($1) AS h",[id])).rows[0].h);}
        expect(raw[0]).not.toBe(raw[1]);expect(new Date(raw[0]).getTime()).toBe(new Date(raw[1]).getTime());expect(canonical[0]).toBe(canonical[1]);
      }
      await c.query("SET LOCAL timezone='UTC'");await expect(withLegacyReviewTimezone(c,async()=>{throw new Error("invented failure");})).rejects.toThrow();
      expect((await c.query("SHOW timezone")).rows[0].TimeZone).toBe("UTC");
    }finally{await c.query("ROLLBACK");c.release();}
  }));
  it("roundtrips empty schema 0019, reapplies cleanly and keeps the migration journal idempotent",async()=>{
    await runSchema("rollback",migration);const p=getPool();
    expect(await applyRestrictedAcceptanceSchema(p,"local_loopback")).toEqual({outcome:"applied",applied:1});
    const before=await snapshot(p);
    expect(await applyRestrictedAcceptanceSchema(p,"local_loopback")).toEqual({outcome:"unchanged",applied:0});expect(await snapshot(p)).toEqual(before);
    await runSchema("apply",migration);expect(await snapshot(p)).toEqual(before);
    const count=(await p.query("SELECT count(*)::int n FROM pg_constraint WHERE conrelid='sermon_restricted_acceptances'::regclass")).rows[0].n;
    expect(count).toBeGreaterThanOrEqual(13);
  });
}

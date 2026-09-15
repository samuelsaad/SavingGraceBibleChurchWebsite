import type { Pool } from "pg";
import { expect, it } from "vitest";
import { fifthBatchFixture } from "./fixtures/fifth-batch";
import { importFifthFixedBatchPrivateDraft, deterministicFifthFixedBatchSermonId } from "../src/enrichment/fifth-fixed-batch-import";
import { preservationSnapshot } from "../src/metadata/sermon-title-correction";
import { assertDisposableIntegrationTestDatabase } from "../src/migration/local-database-safety";

export function registerFifthBatchPostgresTests(getPool:()=>Pool) {
  it("D-159 atomically imports private drafts with pending redactions, protects human edits and has a no-churn second import", async()=>{
    assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL!,process.env.DISPOSABLE_TEST_DATABASE_TOKEN,process.env.ALLOW_LOCAL_DB_WRITE);
    const pool=getPool(),f=fifthBatchFixture(true),id=deterministicFifthFixedBatchSermonId(f.artifact.target.videoId);
    const run=()=>importFifthFixedBatchPrivateDraft(pool,f.artifact,f.authorization,f.transcript,f.metadata);
    const snapshot=async()=>{const c=await pool.connect();try{return await preservationSnapshot(c,[]);}finally{c.release();}};
    const previous=await pool.query("SELECT id FROM migration_runs");
    try {
      expect((await run()).outcome).toBe("imported_as_private_draft");
      expect((await pool.query("SELECT status,summary_status,published_at FROM sermons WHERE id=$1",[id])).rows[0])
        .toEqual({status:"draft",summary_status:"draft",published_at:null});
      expect((await pool.query("SELECT status,body_text FROM sermon_transcripts WHERE sermon_id=$1",[id])).rows[0])
        .toEqual({status:"draft",body_text:f.transcript});
      expect((await pool.query("SELECT count(*)::int n FROM sermon_question_answers WHERE sermon_id=$1 AND status='draft' AND approved_at IS NULL",[id])).rows[0].n).toBe(7);
      expect((await pool.query("SELECT current_stage,identity_status,completed_at,empty_item_set_acknowledged_at,expected_item_count FROM sermon_enrichment_reviews WHERE sermon_id=$1",[id])).rows[0])
        .toEqual({current_stage:1,identity_status:"pending",completed_at:null,empty_item_set_acknowledged_at:null,expected_item_count:1});
      const after=await snapshot();
      expect((await run()).outcome).toBe("unchanged");
      expect(await snapshot()).toEqual(after);
      await pool.query("UPDATE sermons SET title='Human edited fixture',row_version=row_version+1,updated_by_subject='fixture-admin' WHERE id=$1",[id]);
      const edited=await snapshot();
      await expect(run()).rejects.toThrow("existing_identity_or_content_conflict");
      expect(await snapshot()).toEqual(edited);
    } finally {
      await pool.query("DELETE FROM sermons WHERE id=$1",[id]);
      await pool.query("DELETE FROM audit_events WHERE entity_id=$1",[id]);
      await pool.query("DELETE FROM migration_runs WHERE id <> ALL($1::uuid[])",[previous.rows.map(r=>r.id)]);
    }
  });
}

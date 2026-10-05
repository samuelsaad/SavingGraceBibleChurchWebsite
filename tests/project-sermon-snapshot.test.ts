import { describe, expect, it } from "vitest";
import {completedDevelopmentProjection} from '../src/development-data/import-project-sermon-snapshot';
import {validateCompletedIds} from '../src/domain/completed-staging';
import {
  loadTrackedProjectSermonSnapshot,
  sha256,
  validateProjectSermonSnapshot
} from "../src/development-data/project-sermon-snapshot";

describe("tracked project sermon snapshot", () => {
  it('D-171 includes only the exact completed cohort and restores no review authority',async()=>{
    const {snapshot}=await loadTrackedProjectSermonSnapshot();
    expect(validateCompletedIds(snapshot.tables.sermons.map(r=>r.id)).length).toBe(279);
    const projection=completedDevelopmentProjection(snapshot);
    expect(projection.tables.sermons.every(r=>r.summary_status==='draft'&&r.summary_approved_at===null)).toBe(true);
    expect([...projection.tables.transcripts,...projection.tables.questionAnswers].every(r=>r.status==='draft'&&r.approved_at===null)).toBe(true);
    expect(projection.tables.scriptureReferences.every(r=>r.review_status!=='confirmed')).toBe(true);
    for(const key of ['guidedReviews','guidedReviewItems','primaryPassageReviews','aiContentReviews','aiComponentReviews','aiMetadataAssignments','restrictedAcceptances'] as const)expect(projection.tables[key].length).toBe(0);
    expect(snapshot.tables.sermons.some(r=>r.summary_status!=='draft')).toBe(true);
  });
  it("has a complete, hash-bound collection with contiguous ordered Q&A", async () => {
    const loaded = await loadTrackedProjectSermonSnapshot();
    expect(loaded.snapshot.tables.sermons.length).toBeGreaterThan(15);
    expect(loaded.snapshot.tables.transcripts).toHaveLength(loaded.snapshot.tables.sermons.length);
    expect(loaded.snapshot.tables.questionAnswers.length).toBeGreaterThan(loaded.snapshot.tables.sermons.length * 4);
    expect(loaded.manifest.counts).toEqual(Object.fromEntries(
      Object.entries(loaded.snapshot.tables).map(([name, rows]) => [name, rows.length])
    ));
  });

  it("rejects operational identities and transcript or Q&A hash drift", async () => {
    const loaded = await loadTrackedProjectSermonSnapshot();
    const actorLeak = structuredClone(loaded.snapshot) as typeof loaded.snapshot & { reviewer_subject?: string };
    actorLeak.reviewer_subject = "private-administrator";
    expect(() => validateProjectSermonSnapshot(actorLeak)).toThrow("Forbidden operational field");

    const transcriptDrift = structuredClone(loaded.snapshot);
    transcriptDrift.tables.transcripts[0]!.body_text = `${transcriptDrift.tables.transcripts[0]!.body_text} changed`;
    expect(() => validateProjectSermonSnapshot(transcriptDrift)).toThrow("Transcript content hash mismatch");

    const qaDrift = structuredClone(loaded.snapshot);
    qaDrift.tables.questionAnswers[0]!.content_sha256 = sha256("wrong");
    expect(() => validateProjectSermonSnapshot(qaDrift)).toThrow("Q&A content hash mismatch");
  });

  it("contains no V3 application projection and documents private import semantics", async () => {
    const loaded = await loadTrackedProjectSermonSnapshot();
    expect(loaded.manifest.importMode).toBe("private-development-projection");
    expect(JSON.stringify(loaded.manifest.operationalDataExcluded)).toContain("accounts");
  });
});

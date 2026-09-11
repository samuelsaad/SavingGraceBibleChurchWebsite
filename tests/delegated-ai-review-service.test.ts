import type { Pool, PoolClient } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyDelegatedReview, bindDelegatedReviewScope, listDelegatedReviews } from "../src/application/delegated-ai-review-service";
import { contentHash, delegatedReviewerSubject, reviewHash, sourceProvenanceHash, type DelegatedReviewResult } from "../src/domain/delegated-ai-review";

const ids = Array.from({ length: 155 }, (_, index) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const policySha256 = reviewHash("fictional service policy");

function guardedEnvironment(): void {
  vi.stubEnv("ALLOW_LOCAL_DB_WRITE", "1");
  vi.stubEnv("RUN_POSTGRES_INTEGRATION", undefined);
  vi.stubEnv("TEST_DATABASE_URL", undefined);
  vi.stubEnv("DISPOSABLE_TEST_DATABASE_TOKEN", undefined);
}

function fakePool(query: ReturnType<typeof vi.fn>) {
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const connect = vi.fn().mockResolvedValue(client);
  return { pool: { connect } as unknown as Pool, connect, release };
}

afterEach(() => vi.unstubAllEnvs());

describe("delegated review service failure isolation without a database", () => {
  it("refuses malformed private input before opening any connection", async () => {
    const { pool, connect } = fakePool(vi.fn());
    await expect(applyDelegatedReview(pool, {} as DelegatedReviewResult)).rejects.toThrow(/^delegated_review_validation_or_concurrency_conflict$/u);
    expect(connect).not.toHaveBeenCalled();
  });

  it("requires the write gate before connecting", async () => {
    guardedEnvironment(); vi.stubEnv("ALLOW_LOCAL_DB_WRITE", undefined);
    const { pool, connect } = fakePool(vi.fn());
    await expect(bindDelegatedReviewScope(pool, ids, policySha256)).rejects.toThrow(/^delegated_review_write_gate_required$/u);
    expect(connect).not.toHaveBeenCalled();
  });

  it("keeps raw connection diagnostics outside its error contract", async () => {
    guardedEnvironment();
    const { pool, connect } = fakePool(vi.fn());
    connect.mockRejectedValue(new Error("fictional private connection diagnostic"));
    await expect(bindDelegatedReviewScope(pool, ids, policySha256)).rejects.toThrow(/^delegated_review_connection_failed$/u);
  });

  it("does not begin a transaction for a mismatched database", async () => {
    guardedEnvironment();
    const query = vi.fn().mockResolvedValue({ rows: [{ verified: false }] });
    const { pool, release } = fakePool(query);
    await expect(bindDelegatedReviewScope(pool, ids, policySha256)).rejects.toThrow(/^delegated_review_target_or_transaction_failed$/u);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("BEGIN"))).toBe(false);
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledExactlyOnceWith();
  });

  it("rolls back transaction setup failure before releasing the pooled connection", async () => {
    guardedEnvironment();
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.startsWith("SET LOCAL")) throw new Error("fictional private setup error");
      return { rows: [{ verified: true }] };
    });
    const { pool, release } = fakePool(query);
    await expect(bindDelegatedReviewScope(pool, ids, policySha256)).rejects.toThrow(/^delegated_review_target_or_transaction_failed$/u);
    expect(query).toHaveBeenCalledWith("BEGIN ISOLATION LEVEL SERIALIZABLE");
    expect(query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(release).toHaveBeenCalledExactlyOnceWith();
  });

  it("destroys the connection when setup rollback fails", async () => {
    guardedEnvironment();
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.startsWith("SET LOCAL") || sql === "ROLLBACK") throw new Error("fictional private setup error");
      return { rows: [{ verified: true }] };
    });
    const { pool, release } = fakePool(query);
    await expect(bindDelegatedReviewScope(pool, ids, policySha256)).rejects.toThrow(/^delegated_review_target_or_transaction_failed$/u);
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("retains safe scope errors and destroys a connection after failed conflict rollback", async () => {
    guardedEnvironment();
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("fictional private rollback error");
      if (sql.includes("current_database()")) return { rows: [{ verified: true }] };
      return { rows: [] };
    });
    const { pool, release } = fakePool(query);
    await expect(bindDelegatedReviewScope(pool, ids, policySha256)).rejects.toThrow(/^delegated_review_scope_conflict$/u);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("INSERT"))).toBe(false);
    expect(release).toHaveBeenCalledExactlyOnceWith(true);
  });
});

describe("private review status projection", () => {
  function reviewedRow() {
    const body = "A fictional source transcript kept out of the status projection.";
    const sourceRow = { source_kind: "fictional", source_content_sha256: reviewHash("fictional source") };
    return {
      sequence: 1, sermon_id: ids[0], title: "Fictional example", artifact_key: "description",
      review_id: "40000000-0000-4000-8000-000000000001", outcome: "accepted", output_version: 3,
      transcript_sha256: reviewHash(body), grounding_revision_id: "grounding-fixture", source_sha256: sourceRow.source_content_sha256,
      policy_sha256: policySha256, current_content: { description: "A fictional private description." },
      assessment: { artifactDisplayOrder: null },
      provenance: { source_provenance_sha256: sourceProvenanceHash(sourceRow), model: "gpt-6-astra", reviewer_kind:"ai" },
      reviewer_subject:delegatedReviewerSubject,output_sha256:contentHash({description:"A fictional private description."}),
      workflow:null,review_items:[],stored_item_count:0,transcript_version:1,speaker_id:null,service_date:"2025-01-01",
      reviewed_at: "2026-09-10T00:00:00Z", body_text: body, current_grounding: "grounding-fixture",
      source_content_sha256: sourceRow.source_content_sha256, current_source_provenance: sourceRow, current_policy_sha256: policySha256,
      summary: "A fictional private description.", summary_row_version: 3, summary_status: "draft",
      display_order: null
    };
  }

  async function project(row: unknown) {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    return (await listDelegatedReviews({ query } as unknown as Pool))[0];
  }

  it("does not mark a current unreviewed artifact stale or hide its identity", async () => {
    const row = { ...reviewedRow(), review_id: null, outcome: null, current_content: null, assessment: null, provenance: null };
    expect(await project(row)).toMatchObject({ artifactKey: "description", outcome: "incomplete" });
  });

  it("excludes source, content, evidence and provenance bodies from its returned status", async () => {
    const result = await project(reviewedRow());
    expect(result).toMatchObject({ outcome: "accepted", reviewerKind: "ai" });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("fictional private description");
    expect(serialized).not.toContain("fictional source transcript");
    expect(result).not.toHaveProperty("current_content");
    expect(result).not.toHaveProperty("evidence");
    expect(result).not.toHaveProperty("provenance");
  });

  it.each([
    { summary_row_version: 4 },
    { current_policy_sha256: reviewHash("changed policy") },
    { current_source_provenance: { source_kind: "changed fixture" } },
    { current_grounding: "changed grounding" },
    { body_text: "A changed fictional source." }
  ])("marks a decision stale when a bound current input changes", async change => {
    expect(await project({ ...reviewedRow(), ...change })).toMatchObject({ outcome: "stale" });
  });

  it("marks reordered Q&A stale even when body and row version are unchanged", async () => {
    const content = { question: "A fictional question?", answer: "A fictional answer." };
    const row = {
      ...reviewedRow(), artifact_key: "qa:20000000-0000-4000-8000-000000000001",
      current_content: content, output_sha256:contentHash(content), question_text: content.question, answer_text: content.answer, qa_version: 3,
      qa_status: "draft", display_order: 2, assessment: { artifactDisplayOrder: 1 }
    };
    expect(await project(row)).toMatchObject({ outcome: "stale", displayOrder: 2 });
  });
});

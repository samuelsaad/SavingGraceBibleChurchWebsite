import type { Pool } from "pg";
import { expect, it } from "vitest";
import { permanentlyDeleteSermonInputSchema, updateSermonInputSchema } from "../src/api/contracts/admin-sermons";
import { AdminSermonService } from "../src/application/admin-sermon-service";
import {
  applyDelegatedReview,
  bindDelegatedReviewScope,
  listDelegatedReviews
} from "../src/application/delegated-ai-review-service";
import {
  canonicalReviewJson,
  contentHash,
  delegatedReviewerSubject,
  reviewHash,
  type AiContent,
  type DelegatedReviewResult
} from "../src/domain/delegated-ai-review";
import { importEnrichmentDraftBundle } from "../src/enrichment/postgres-enrichment";
import { assertDisposableIntegrationTestDatabase } from "../src/migration/local-database-safety";
import type { SchemaMigrationScope } from "../src/migration/schema-migrations";
import { PostgresAdminSermonRepository } from "../src/server/repositories/postgres-admin-sermon-repository";
import { PostgresSermonRepository } from "../src/server/repositories/postgres-sermon-repository";

// Entirely invented fixture prose: no retained church source, caption or review data.
const description = `The speaker uses an imagined village to explain how patient attention supports a community through an ordinary difficulty. A damaged bridge creates inconvenience for every household, yet the villagers disagree about who should begin repairing it. The opening distinguishes listening from making quick promises. Each neighbour has information that the others lack, and their first useful action is to hear those different accounts before deciding which work can safely proceed.

The central example follows a carpenter who admits the limits of her experience and asks another worker to inspect the damaged supports. Her request does not remove her responsibility. It helps her understand what she can contribute and where assistance is needed. The speaker contrasts this cooperation with a hurried attempt that overlooks a loose plank, showing why confidence alone cannot establish that a proposed repair will help everyone.

The conclusion invites listeners to practise the same careful attention in familiar responsibilities. They can ask a direct question, acknowledge an uncertainty, and follow through on an appropriate commitment. These modest actions develop trust over time. The village remains an illustrative example, and the speaker does not promise that every disagreement will disappear after one conversation.`;
const transcript = `${description}\n\nThe carpenter asks for help before moving the loose plank. Listening includes checking that another person's concern has been understood. The final invitation concerns ordinary cooperation, with no promise of immediate agreement.`;
const fixtureId = "99999999-9999-4999-8999-999999999156";
const outsideId = "99999999-9999-4999-8999-999999999157";
const sourceId = 9999156;
const fixtureSlug = "delegated-review-anonymised-fixture";
const sourceReference = "anonymised-delegated-review-source-v1";
const policySha256 = reviewHash("anonymised-delegated-review-policy-v1");
const migrationId = "0017_delegated_private_ai_review";
const reviewError = "delegated_review_validation_or_concurrency_conflict";
type RunSchema = (direction: "apply" | "rollback", scope?: SchemaMigrationScope) => Promise<unknown>;

/** Hash every complete application table, including timestamps, versions and audit rows. */
async function snapshot(pool: Pool, excluded: string[] = []): Promise<Record<string, string>> {
  const tables = (await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  )).rows;
  const result: Record<string, string> = {};
  for (const { tablename } of tables) {
    if (excluded.includes(tablename)) continue;
    const identifier = `"${tablename.replaceAll('"', '""')}"`;
    const row = (await pool.query<{ hash: string }>(
      `SELECT encode(digest(COALESCE(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text), ''), 'sha256'), 'hex') AS hash FROM public.${identifier} t`
    )).rows[0]!;
    result[tablename] = row.hash;
  }
  return result;
}

async function seedFixture(pool: Pool, id = fixtureId): Promise<void> {
  const sibling = id === outsideId;
  const videoId = sibling ? "AiReview002" : "AiReview001";
  await pool.query(
    `INSERT INTO sermons (id, title, slug, status, service_date, source_wordpress_id,
       summary, summary_status, summary_source_kind, summary_source_reference,
       summary_created_at, summary_updated_at)
     VALUES ($1, 'Anonymised delegated review', $2, 'draft', '2025-01-05', $3,
       $4, 'draft', 'generated_draft', $5, now(), now())`,
    [id, sibling ? `${fixtureSlug}-sibling` : fixtureSlug, sourceId + Number(sibling), description, sourceReference]
  );
  await pool.query(
    `INSERT INTO sermon_transcripts (sermon_id, body_text, status, source_kind, source_reference)
     VALUES ($1, $2, 'draft', 'caption', $3)`,
    [id, transcript, sourceReference]
  );
  for (let order = 1; order <= 5; order += 1) {
    await pool.query(
      `INSERT INTO sermon_question_answers (sermon_id, question_text, answer_text,
         display_order, status, source_kind, source_reference)
       VALUES ($1, $2, $3, $4, 'draft', 'generated_draft', $5)`,
      [id, `Why does the carpenter ask for help in example ${order}?`,
        `The carpenter recognises a limit in her experience and asks another worker to inspect the supports in example ${order}.`,
        order, sourceReference]
    );
  }
  await pool.query(
    `INSERT INTO sermon_enrichment_sources (sermon_id, provider, video_id, canonical_url,
       caption_language, caption_track_type, original_filename, source_content_sha256,
       retrieval_attribution, source_character_count, cleaned_character_count,
       apparent_completeness, uncertainty_marker_count, warnings, processing_version,
       imported_at, processed_at, processing_duration_ms, estimated_review_minutes)
     VALUES ($1, 'youtube', $4, 'https://www.youtube.com/watch?v=' || $4,
       'en', 'automatic', 'anonymised-fixture.vtt', $2, 'authorised_youtube_studio_export',
       $3, $3, 'apparently_complete', 0, '[{"code":"audio_track_type_unverified","safeDetail":"Anonymised source association remains unconfirmed."}]',
       'anonymised-delegated-review-v1', now(), now(), 1, 1)`,
    [id, reviewHash(transcript), transcript.length, videoId]
  );
  await pool.query("INSERT INTO sermon_enrichment_reviews (sermon_id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
  await pool.query(
    `INSERT INTO sermon_primary_passage_reviews (sermon_id, proposal_outcome, evidence_source,
       evidence_sha256, parser_version) VALUES ($1, 'manual_review_required', 'local_youtube_title', $2, 'anonymised-v1')`,
    [id, reviewHash("anonymised unresolved passage")]
  );
}

async function fixtureRequest(pool: Pool, scopeSha256: string, order: number | null = 1, id = fixtureId): Promise<DelegatedReviewResult> {
  const sermon = (await pool.query("SELECT * FROM sermons WHERE id=$1", [id])).rows[0]!;
  const source = (await pool.query("SELECT to_jsonb(es) AS value FROM sermon_enrichment_sources es WHERE sermon_id=$1", [id])).rows[0]!.value;
  const sourceTranscript = (await pool.query("SELECT * FROM sermon_transcripts WHERE sermon_id=$1", [id])).rows[0]!;
  const qa = order === null ? null : (await pool.query(
    "SELECT * FROM sermon_question_answers WHERE sermon_id=$1 AND display_order=$2", [id, order]
  )).rows[0]!;
  const original: AiContent = qa
    ? { question: qa.question_text, answer: qa.answer_text }
    : { description: sermon.summary };
  return {
    decision: "D-156", scopeSha256, policySha256, sermonId: id,
    artifactKey: qa ? `qa:${qa.id}` : "description", displayOrder: order,
    expectedSermonVersion: sermon.row_version,
    inputVersion: qa ? qa.row_version : sermon.summary_row_version,
    transcriptSha256: reviewHash(sourceTranscript.body_text),
    groundingRevisionId: sourceTranscript.grounding_revision_id,
    sourceSha256: source.source_content_sha256,
    sourceProvenanceSha256: reviewHash(canonicalReviewJson(source)),
    inputSha256: contentHash(original), outputSha256: contentHash(original),
    original, output: original, outcome: "accepted", correctionRound: 0,
    reviewedAt: "2026-09-10T00:00:00.000Z",
    provenance: {
      reviewer_kind: "ai", provider: "OpenAI", execution_surface: "Codex",
      model: "gpt-6-astra", mode: "interactive Codex session",
      immutable_revision: "not_exposed_by_runtime", session_id: "not_exposed_by_runtime",
      privacy_details: "not_exposed_by_runtime", separately_billed_api_used: false,
      external_api_cost_aud: 0
    },
    evidence: [{ start: 0, end: sourceTranscript.body_text.length,
      sha256: reviewHash(sourceTranscript.body_text), purpose: "claim" }],
    coverage: [{ start: 0, end: sourceTranscript.body_text.length }],
    assessment: {
      fullArtifactRead: true, centralArgumentChecked: true, substantiveClaimsSupported: true,
      qualificationsPreserved: true, questionAnswersDirectly: true, scriptureAttributionChecked: true,
      readabilityChecked: true, orderingChecked: true, integrity: "verified",
      rationale: "The anonymised assertion matches the stated limits of the village illustration.",
      exceptionCode: null, informationNeeded: null,
      standingWarnings: ["audio_track_type_unverified"], audioVerified: false,
      completeSemanticTranscriptReview: true
    }
  };
}

function correction(request: DelegatedReviewResult): DelegatedReviewResult {
  const output: AiContent = "description" in request.output
    ? { description: request.output.description.replace("imagined village", "fictional village") }
    : { ...request.output, question: request.output.question.replace("ask for help", "seek another worker's help") };
  return { ...request, output, outputSha256: contentHash(output), outcome: "corrected_accepted", correctionRound: 1 };
}

export function registerDelegatedAiReviewPostgresTests(getPool: () => Pool, runSchema: RunSchema): void {
  async function withFixture(work: (pool: Pool, ids: string[]) => Promise<void>): Promise<void> {
    // This helper must never independently select or fall back to the persistent local collection.
    assertDisposableIntegrationTestDatabase(process.env.TEST_DATABASE_URL ?? "", process.env.DISPOSABLE_TEST_DATABASE_TOKEN);
    const pool = getPool();
    try {
      await seedFixture(pool);
      const ids = (await pool.query<{ id: string }>("SELECT id FROM sermons WHERE deleted_at IS NULL ORDER BY id")).rows.map(row => row.id);
      await work(pool, ids);
    } finally {
      // History is immutable. Exercise the actual reversible migration instead of disabling its triggers.
      await runSchema("rollback", migrationId);
      await pool.query("DELETE FROM audit_events WHERE entity_id=ANY($1::uuid[])", [[fixtureId, outsideId]]);
      await pool.query("DELETE FROM sermons WHERE id=ANY($1::uuid[])", [[fixtureId, outsideId]]);
      await pool.query("DELETE FROM sermon_deletion_tombstones WHERE former_sermon_id=ANY($1::uuid[])", [[fixtureId, outsideId]]);
      await runSchema("apply", migrationId);
    }
  }

  it("freezes the exact existing delegated scope, refuses changed membership or policy, and binds identically without churn", async () => {
    await withFixture(async (pool, ids) => {
      const before = await snapshot(pool);
      await expect(bindDelegatedReviewScope(pool, [fixtureId], policySha256)).rejects.toThrow("delegated_review_scope_conflict");
      await expect(bindDelegatedReviewScope(pool, [...ids, fixtureId], policySha256)).rejects.toThrow("delegated_review_invalid_scope");
      expect(await snapshot(pool)).toEqual(before);
      const bound = await bindDelegatedReviewScope(pool, ids, policySha256);
      expect(bound).toEqual({ outcome: "created", scopeSha256: reviewHash(canonicalReviewJson(ids)) });
      expect((await pool.query("SELECT member_count FROM delegated_ai_review_scopes")).rows).toEqual([{ member_count: ids.length }]);
      expect((await pool.query("SELECT sermon_id, sequence FROM delegated_ai_review_members ORDER BY sequence")).rows)
        .toEqual(ids.map((sermon_id, index) => ({ sermon_id, sequence: index + 1 })));
      const frozen = await snapshot(pool);
      await expect(bindDelegatedReviewScope(pool, ids, policySha256)).resolves.toEqual({ ...bound, outcome: "unchanged" });
      for (const [changedIds, changedPolicy] of [[ids.toReversed(), policySha256], [ids, "a".repeat(64)]] as const) {
        await expect(bindDelegatedReviewScope(pool, changedIds, changedPolicy)).rejects.toThrow("delegated_review_scope_conflict");
      }
      await expect(pool.query("UPDATE delegated_ai_review_scopes SET member_count=member_count+1")).rejects.toThrow("delegated_ai_review_history_is_immutable");
      await expect(pool.query("DELETE FROM delegated_ai_review_members WHERE sermon_id=$1", [fixtureId])).rejects.toThrow("delegated_ai_review_history_is_immutable");
      expect(await snapshot(pool)).toEqual(frozen);
    });
  });

  it("records accepted descriptions and individual Q&A as private AI decisions while preserving human approvals and unrelated stages", async () => {
    await withFixture(async (pool, ids) => {
      await pool.query(`UPDATE sermon_question_answers SET status='approved', reviewed_at=now(), approved_at=now(),
        reviewed_by_subject='anonymised-human-reviewer', approved_by_subject='anonymised-human-reviewer'
        WHERE sermon_id=$1 AND display_order=5`, [fixtureId]);
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, ids, policySha256);
      const protectedBefore = await snapshot(pool, ["sermon_ai_content_reviews", "audit_events"]);
      const requests = [await fixtureRequest(pool, scopeSha256, null), await fixtureRequest(pool, scopeSha256)];
      for (const request of requests) await expect(applyDelegatedReview(pool, request)).resolves.toBe("recorded");
      expect(await snapshot(pool, ["sermon_ai_content_reviews", "audit_events"])).toEqual(protectedBefore);
      expect((await pool.query("SELECT actor_subject, actor_role, action FROM audit_events WHERE entity_id=$1 ORDER BY action", [fixtureId])).rows)
        .toEqual(Array.from({ length: 2 }, () => ({ actor_subject: delegatedReviewerSubject, actor_role: "system", action: "sermon.ai_review.accepted" })));
      expect((await pool.query("SELECT reviewer_subject, outcome, input_version, output_version, provenance->>'reviewer_kind' AS kind FROM sermon_ai_content_reviews WHERE sermon_id=$1", [fixtureId])).rows)
        .toEqual(Array.from({ length: 2 }, () => ({ reviewer_subject: delegatedReviewerSubject, outcome: "accepted", input_version: 1, output_version: 1, kind: "ai" })));
      expect((await pool.query(`SELECT s.status, s.published_at, s.summary_status, s.summary_approved_at,
        t.status AS transcript_status, t.approved_at AS transcript_approved_at,
        r.identity_status, r.current_stage, r.completed_at, p.review_status AS passage_status,
        readiness.is_complete, s.summary_search_document, s.transcript_search_document,
        s.question_answer_search_document = (SELECT qa.question_text || ' ' || qa.answer_text
          FROM sermon_question_answers qa WHERE qa.sermon_id=s.id AND qa.display_order=5) AS preserves_human_search_document
        FROM sermons s JOIN sermon_transcripts t ON t.sermon_id=s.id
        JOIN sermon_enrichment_reviews r ON r.sermon_id=s.id JOIN sermon_primary_passage_reviews p ON p.sermon_id=s.id
        JOIN sermon_content_readiness readiness ON readiness.sermon_id=s.id WHERE s.id=$1`, [fixtureId])).rows[0]).toEqual({
        status: "draft", published_at: null, summary_status: "draft", summary_approved_at: null,
        transcript_status: "draft", transcript_approved_at: null, identity_status: "pending", current_stage: 1,
        completed_at: null, passage_status: "pending", is_complete: false,
        summary_search_document: "", transcript_search_document: "", preserves_human_search_document: true
      });
      const listed = (await listDelegatedReviews(pool)).filter(row => row.sermonId === fixtureId);
      expect(listed).toHaveLength(6);
      const accepted = listed.filter(row => row.outcome === "accepted");
      expect(accepted.map(row => row.artifactKey).sort()).toEqual(requests.map(request => request.artifactKey).sort());
      expect(accepted.every(row => row.reviewerKind === "ai" && !row.humanApprovalPreserved)).toBe(true);
      const incomplete = listed.filter(row => row.outcome === "incomplete");
      expect(incomplete.map(row => row.displayOrder).sort()).toEqual([2, 3, 4, 5]);
      expect(incomplete.find(row => row.displayOrder === 5)?.humanApprovalPreserved).toBe(true);
      const publicRepository = new PostgresSermonRepository(pool);
      expect(await publicRepository.findPublishedBySlug(fixtureSlug)).toBeNull();
      expect((await publicRepository.listPublishedSitemapEntries()).some(row => row.slug === fixtureSlug)).toBe(false);
      expect((await pool.query("SELECT count(*)::int AS n FROM description_semantic_relationships WHERE source_sermon_id=$1 OR neighbour_sermon_id=$1", [fixtureId])).rows[0]).toEqual({ n: 0 });
      const recorded = await snapshot(pool);
      for (const request of requests) await expect(applyDelegatedReview(pool, request)).resolves.toBe("unchanged");
      expect(await snapshot(pool)).toEqual(recorded);
    });
  });

  it("preserves correction lineage and source receipts, increments only the corrected artifact version, and never resets its one-round allowance", async () => {
    await withFixture(async (pool, ids) => {
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, ids, policySha256);
      const request = correction(await fixtureRequest(pool, scopeSha256));
      const protectedBefore = await snapshot(pool, ["sermons", "sermon_question_answers", "sermon_ai_content_reviews", "audit_events"]);
      const siblings = (await pool.query("SELECT to_jsonb(q) AS value FROM sermon_question_answers q WHERE sermon_id=$1 AND display_order>1 ORDER BY display_order", [fixtureId])).rows;
      await expect(applyDelegatedReview(pool, request)).resolves.toBe("recorded");
      expect(await snapshot(pool, ["sermons", "sermon_question_answers", "sermon_ai_content_reviews", "audit_events"])).toEqual(protectedBefore);
      expect((await pool.query("SELECT to_jsonb(q) AS value FROM sermon_question_answers q WHERE sermon_id=$1 AND display_order>1 ORDER BY display_order", [fixtureId])).rows).toEqual(siblings);
      expect((await pool.query(`SELECT original_content, current_content, input_version, output_version, correction_round,
        reviewer_subject FROM sermon_ai_content_reviews WHERE sermon_id=$1`, [fixtureId])).rows).toEqual([{
        original_content: request.original, current_content: request.output, input_version: request.inputVersion,
        output_version: request.inputVersion + 1, correction_round: 1, reviewer_subject: delegatedReviewerSubject
      }]);
      const current = await fixtureRequest(pool, scopeSha256);
      expect(current.original).toEqual(request.output);
      expect(current.inputVersion).toBe(request.inputVersion + 1);
      expect(current.expectedSermonVersion).toBe(request.expectedSermonVersion + 1);
      expect(current.sourceProvenanceSha256).toBe(request.sourceProvenanceSha256);
      const unchanged = await snapshot(pool);
      await expect(applyDelegatedReview(pool, request)).resolves.toBe("unchanged");
      const secondOutput = { ...current.output, answer: "Another attempted correction would exceed the preserved allowance." };
      await expect(applyDelegatedReview(pool, { ...current, output: secondOutput, outputSha256: contentHash(secondOutput),
        outcome: "corrected_accepted", correctionRound: 1 })).rejects.toThrow(reviewError);
      await expect(pool.query("UPDATE sermon_ai_content_reviews SET reviewed_at=now() WHERE sermon_id=$1", [fixtureId])).rejects.toThrow("delegated_ai_review_history_is_immutable");
      await expect(pool.query("DELETE FROM sermon_ai_content_reviews WHERE sermon_id=$1", [fixtureId])).rejects.toThrow("delegated_ai_review_history_is_immutable");
      expect(await snapshot(pool)).toEqual(unchanged);
    });
  });

  it("versions an accepted description correction without altering its transcript, provenance, Q&A or human lifecycle", async () => {
    await withFixture(async (pool, ids) => {
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, ids, policySha256);
      const request = correction(await fixtureRequest(pool, scopeSha256, null));
      const before = await snapshot(pool, ["sermons", "sermon_ai_content_reviews", "audit_events"]);
      await expect(applyDelegatedReview(pool, request)).resolves.toBe("recorded");
      expect(await snapshot(pool, ["sermons", "sermon_ai_content_reviews", "audit_events"])).toEqual(before);
      const current = await fixtureRequest(pool, scopeSha256, null);
      expect(current.original).toEqual(request.output);
      expect(current.inputVersion).toBe(request.inputVersion + 1);
      expect(current.expectedSermonVersion).toBe(request.expectedSermonVersion + 1);
      expect((await pool.query("SELECT status,summary_status,summary_approved_at,summary_approved_by_subject FROM sermons WHERE id=$1", [fixtureId])).rows[0])
        .toEqual({ status: "draft", summary_status: "draft", summary_approved_at: null, summary_approved_by_subject: null });
      const recorded = await snapshot(pool);
      await expect(applyDelegatedReview(pool, request)).resolves.toBe("unchanged");
      expect(await snapshot(pool)).toEqual(recorded);
    });
  });

  it("retains an unsuccessful correction as a private human exception and consumes its allowance without applying rejected prose", async () => {
    await withFixture(async (pool, ids) => {
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, ids, policySha256);
      const original = await fixtureRequest(pool, scopeSha256);
      const rejectedContent = { question: "An unsupported replacement question?", answer: "An unsupported replacement answer." };
      const request: DelegatedReviewResult = {
        ...original, outcome: "needs_human", correctionRound: 1,
        assessment: { ...original.assessment, substantiveClaimsSupported: false,
          exceptionCode: "source_meaning_uncertain", informationNeeded: "Clarify the intended meaning of the anonymised source sentence.",
          rejectedCorrection: { content: rejectedContent, sha256: contentHash(rejectedContent), failureCodes: ["claim_not_supported"] }
        }
      };
      const protectedBefore = await snapshot(pool, ["sermon_ai_content_reviews", "audit_events"]);
      await expect(applyDelegatedReview(pool, request)).resolves.toBe("recorded");
      expect(await snapshot(pool, ["sermon_ai_content_reviews", "audit_events"])).toEqual(protectedBefore);
      expect((await pool.query(`SELECT original_content, current_content, input_version, output_version,
        assessment->'rejectedCorrection' AS rejected FROM sermon_ai_content_reviews WHERE sermon_id=$1`, [fixtureId])).rows).toEqual([{
        original_content: original.original, current_content: original.original,
        input_version: original.inputVersion, output_version: original.inputVersion,
        rejected: request.assessment.rejectedCorrection
      }]);
      const listed = (await listDelegatedReviews(pool)).find(row => row.sermonId === fixtureId && row.artifactKey === request.artifactKey);
      expect(listed).toMatchObject({ outcome: "needs_human", exceptionCode: "source_meaning_uncertain", reviewerKind: "ai", humanApprovalPreserved: false });
      const recorded = await snapshot(pool);
      await expect(applyDelegatedReview(pool, request)).resolves.toBe("unchanged");
      await expect(applyDelegatedReview(pool, correction(original))).rejects.toThrow(reviewError);
      expect(await snapshot(pool)).toEqual(recorded);
    });
  });

  it("rejects stale content, transcript, provenance, policy, scope and approved artifacts without partial writes", async () => {
    await withFixture(async (pool, ids) => {
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, ids, policySha256);
      const request = await fixtureRequest(pool, scopeSha256);
      const before = await snapshot(pool);
      const invalid: DelegatedReviewResult[] = [
        { ...request, scopeSha256: "a".repeat(64) }, { ...request, policySha256: "a".repeat(64) },
        { ...request, sermonId: outsideId }, { ...request, inputVersion: request.inputVersion + 1 },
        { ...request, expectedSermonVersion: request.expectedSermonVersion + 1 },
        { ...request, inputSha256: "a".repeat(64) }, { ...request, transcriptSha256: "a".repeat(64) },
        { ...request, groundingRevisionId: outsideId }, { ...request, sourceSha256: "a".repeat(64) },
        { ...request, sourceProvenanceSha256: "a".repeat(64) }, { ...request, displayOrder: 2 }
      ];
      for (const item of invalid) await expect(applyDelegatedReview(pool, item)).rejects.toThrow(reviewError);
      expect(await snapshot(pool)).toEqual(before);
      await pool.query(`UPDATE sermon_question_answers SET status='approved', reviewed_at=now(), approved_at=now(),
        reviewed_by_subject='anonymised-human-reviewer', approved_by_subject='anonymised-human-reviewer'
        WHERE sermon_id=$1 AND display_order=1`, [fixtureId]);
      await pool.query(`UPDATE sermons SET summary_status='approved', summary_reviewed_at=now(), summary_approved_at=now(),
        summary_reviewed_by_subject='anonymised-human-reviewer', summary_approved_by_subject='anonymised-human-reviewer' WHERE id=$1`, [fixtureId]);
      const approved = await snapshot(pool);
      await expect(applyDelegatedReview(pool, request)).rejects.toThrow(reviewError);
      await expect(applyDelegatedReview(pool, await fixtureRequest(pool, scopeSha256, null))).rejects.toThrow(reviewError);
      expect(await snapshot(pool)).toEqual(approved);
    });
  });

  it("rolls back corrected content and immutable evidence together when the final audit write fails", async () => {
    await withFixture(async (pool, ids) => {
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, ids, policySha256);
      const request = correction(await fixtureRequest(pool, scopeSha256));
      await pool.query(`CREATE FUNCTION delegated_review_fixture_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.action LIKE 'sermon.ai_review.%' THEN RAISE EXCEPTION 'anonymised_audit_failure'; END IF; RETURN NEW; END $$`);
      try {
        await pool.query(`CREATE TRIGGER delegated_review_fixture_reject_audit BEFORE INSERT ON audit_events
          FOR EACH ROW EXECUTE FUNCTION delegated_review_fixture_reject_audit()`);
        const before = await snapshot(pool);
        await expect(applyDelegatedReview(pool, request)).rejects.toThrow(reviewError);
        expect(await snapshot(pool)).toEqual(before);
      } finally {
        await pool.query("DROP TRIGGER IF EXISTS delegated_review_fixture_reject_audit ON audit_events");
        await pool.query("DROP FUNCTION delegated_review_fixture_reject_audit()");
      }
      await expect(applyDelegatedReview(pool, request)).resolves.toBe("recorded");
    });
  });

  it("blocks a real draft importer from restoring corrected Q&A and permits a normal administrator edit that makes AI evidence stale", async () => {
    await withFixture(async (pool, ids) => {
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, ids, policySha256);
      const original = await fixtureRequest(pool, scopeSha256);
      const originalQuestions = (await pool.query("SELECT question_text,answer_text FROM sermon_question_answers WHERE sermon_id=$1 ORDER BY display_order", [fixtureId])).rows;
      const request = correction(original);
      await applyDelegatedReview(pool, request);
      const current = await fixtureRequest(pool, scopeSha256);
      const recorded = await snapshot(pool);
      await expect(importEnrichmentDraftBundle(pool, {
        schemaVersion: 2, sourceWordPressId: sourceId, targetSermonId: fixtureId,
        expectedRowVersion: current.expectedSermonVersion,
        description: { bodyText: description, provenance: { sourceKind: "generated_draft", sourceReference } },
        transcript: { bodyText: transcript, provenance: { sourceKind: "caption", sourceReference } },
        questionAnswers: originalQuestions.map(qa => ({ question: qa.question_text, answer: qa.answer_text,
          provenance: { sourceKind: "generated_draft", sourceReference } }))
      })).rejects.toThrow("import_conflicts_with_ai_reviewed_content");
      expect(await snapshot(pool)).toEqual(recorded);
      const service = new AdminSermonService(new PostgresAdminSermonRepository(pool));
      const humanAnswer = "The carpenter asks an experienced worker to check the supports before starting the repair.";
      await service.update(fixtureId, updateSermonInputSchema.parse({ rowVersion: current.expectedSermonVersion,
        questionAnswers: originalQuestions.map((qa, index) => ({ question: qa.question_text,
          answer: index === 0 ? humanAnswer : qa.answer_text, status: "draft", sourceKind: "manual", sourceReference: null }))
      }), { subject: "anonymised-human-editor", role: "admin" }, "anonymised-delegated-review-human-edit");
      expect((await listDelegatedReviews(pool)).find(row => row.sermonId === fixtureId && row.artifactKey === request.artifactKey)?.outcome).toBe("stale");
      expect((await fixtureRequest(pool, scopeSha256)).original).toMatchObject({ answer: humanAnswer });
      const edited = await snapshot(pool);
      await expect(applyDelegatedReview(pool, request)).rejects.toThrow(reviewError);
      expect(await snapshot(pool)).toEqual(edited);
    });
  });

  it("makes an accepted review stale when retained source provenance changes without changing the transcript bytes", async () => {
    await withFixture(async (pool, ids) => {
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, ids, policySha256);
      const request = await fixtureRequest(pool, scopeSha256);
      await applyDelegatedReview(pool, request);
      await pool.query("UPDATE sermon_enrichment_sources SET manual_attention_required=false WHERE sermon_id=$1", [fixtureId]);
      const current = await fixtureRequest(pool, scopeSha256);
      expect(current.transcriptSha256).toBe(request.transcriptSha256);
      expect(current.sourceSha256).toBe(request.sourceSha256);
      expect(current.sourceProvenanceSha256).not.toBe(request.sourceProvenanceSha256);
      expect((await listDelegatedReviews(pool)).find(row => row.sermonId === fixtureId && row.artifactKey === request.artifactKey)?.outcome).toBe("stale");
      const changed = await snapshot(pool);
      await expect(applyDelegatedReview(pool, request)).rejects.toThrow(reviewError);
      expect(await snapshot(pool)).toEqual(changed);
    });
  });

  it("refuses direct delegated-history deletion and parent deletion without every guarded cascade condition", async () => {
    await withFixture(async (pool, ids) => {
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, ids, policySha256);
      await applyDelegatedReview(pool, await fixtureRequest(pool, scopeSha256, null));
      const before = await snapshot(pool);
      const attempts = [
        { application: false, tombstone: false, table: "sermon_ai_content_reviews", column: "sermon_id" },
        { application: false, tombstone: false, table: "delegated_ai_review_members", column: "sermon_id" },
        { application: false, tombstone: false, table: "sermons", column: "id" },
        { application: true, tombstone: false, table: "sermons", column: "id" },
        { application: false, tombstone: true, table: "sermons", column: "id" },
        { application: true, tombstone: true, table: "sermon_ai_content_reviews", column: "sermon_id" },
        { application: true, tombstone: true, table: "delegated_ai_review_members", column: "sermon_id" }
      ] as const;
      for (const attempt of attempts) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          if (attempt.application) await client.query("SET LOCAL savinggrace.application_request='on'");
          if (attempt.tombstone) {
            // A disposable probe proves that a tombstone alone cannot bypass the
            // parent-presence/depth/application checks. This transaction always rolls back.
            await client.query(`INSERT INTO sermon_deletion_tombstones (
              former_sermon_id,former_slug,actor_subject,reason,was_previously_published,request_correlation_id)
              VALUES ($1,$2,'anonymised-incomplete-delete','Incomplete synthetic deletion probe',false,'anonymised-delete-probe')`,
            [fixtureId, fixtureSlug]);
          }
          await expect(client.query(`DELETE FROM ${attempt.table} WHERE ${attempt.column}=$1`, [fixtureId]))
            .rejects.toThrow("delegated_ai_review_history_is_immutable");
        } finally {
          await client.query("ROLLBACK");
          client.release();
        }
        expect(await snapshot(pool)).toEqual(before);
      }
    });
  });

  it("removes only a guarded permanently deleted sermon's delegated content while retaining minimal tombstone and audit evidence", async () => {
    await withFixture(async (pool, ids) => {
      await seedFixture(pool, outsideId);
      const { scopeSha256 } = await bindDelegatedReviewScope(pool, [...ids, outsideId].sort(), policySha256);
      await applyDelegatedReview(pool, correction(await fixtureRequest(pool, scopeSha256, null)));
      await applyDelegatedReview(pool, correction(await fixtureRequest(pool, scopeSha256)));
      const siblingRequest = await fixtureRequest(pool, scopeSha256, 1, outsideId);
      await applyDelegatedReview(pool, siblingRequest);
      await applyDelegatedReview(pool, await fixtureRequest(pool, scopeSha256, null, outsideId));
      expect((await pool.query("SELECT count(*)::int AS n FROM sermon_ai_content_reviews WHERE sermon_id=$1", [fixtureId])).rows[0]).toEqual({ n: 2 });

      const service = new AdminSermonService(new PostgresAdminSermonRepository(pool));
      const admin = { subject: "anonymised-deletion-administrator", role: "admin" } as const;
      const current = await fixtureRequest(pool, scopeSha256);
      const reason = "Synthetic fixture entered in error";
      const draftInput = permanentlyDeleteSermonInputSchema.parse({ rowVersion: current.expectedSermonVersion, confirmation: fixtureSlug, reason });
      const draft = await snapshot(pool);
      await expect(service.permanentlyDelete(fixtureId, draftInput, admin, "anonymised-delete-before-archive"))
        .rejects.toMatchObject({ status: 400, code: "invalid_request" });
      expect(await snapshot(pool)).toEqual(draft);
      const archived = await service.transition(fixtureId, "archive", { rowVersion: current.expectedSermonVersion }, admin, "anonymised-delete-archive");
      const input = permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion, confirmation: archived.slug, reason });
      const archivedSnapshot = await snapshot(pool);
      await expect(service.permanentlyDelete(fixtureId, { ...input, confirmation: "wrong confirmation" }, admin, "anonymised-delete-wrong-confirmation"))
        .rejects.toMatchObject({ status: 400, code: "invalid_request" });
      await expect(service.permanentlyDelete(fixtureId, { ...input, rowVersion: archived.rowVersion - 1 }, admin, "anonymised-delete-stale"))
        .rejects.toMatchObject({ status: 409, code: "stale_write" });
      await expect(service.permanentlyDelete(fixtureId, { ...input, seoDisposition: { kind: "gone" } }, admin, "anonymised-delete-never-public"))
        .rejects.toMatchObject({ status: 400, code: "invalid_request" });
      expect(permanentlyDeleteSermonInputSchema.safeParse({ ...input, reason: "" }).success).toBe(false);
      expect(await snapshot(pool)).toEqual(archivedSnapshot);

      // Compare every other row in every table, including the original immutable
      // scope receipt, other members, sibling source/prose/evidence and audit history.
      const affectedTables = [
        ["sermons", "id"], ["sermon_transcripts", "sermon_id"], ["sermon_question_answers", "sermon_id"],
        ["sermon_enrichment_sources", "sermon_id"], ["sermon_enrichment_reviews", "sermon_id"],
        ["sermon_enrichment_review_items", "sermon_id"], ["sermon_primary_passage_reviews", "sermon_id"],
        ["delegated_ai_review_members", "sermon_id"], ["sermon_ai_content_reviews", "sermon_id"],
        ["audit_events", "entity_id"], ["sermon_deletion_tombstones", "former_sermon_id"]
      ] as const;
      const otherRows = async () => {
        const hashes = await snapshot(pool, affectedTables.map(([table]) => table));
        for (const [table, column] of affectedTables) {
          hashes[table] = (await pool.query<{ hash: string }>(`SELECT encode(digest(COALESCE(
            string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text),''),'sha256'),'hex') AS hash
            FROM ${table} t WHERE ${column} IS DISTINCT FROM $1::uuid`, [fixtureId])).rows[0]!.hash;
        }
        return hashes;
      };
      const otherBefore = await otherRows();
      const priorAudit = (await pool.query("SELECT to_jsonb(a) AS value FROM audit_events a WHERE entity_id=$1 ORDER BY id", [fixtureId])).rows;
      await expect(service.permanentlyDelete(fixtureId, input, admin, "anonymised-delegated-permanent-delete"))
        .resolves.toEqual({ deleted: true, sermonId: fixtureId, formerSlug: fixtureSlug, seoDisposition: null });
      expect(await otherRows()).toEqual(otherBefore);
      expect((await pool.query(`SELECT
        (SELECT count(*)::int FROM sermons WHERE id=$1) AS sermons,
        (SELECT count(*)::int FROM sermon_transcripts WHERE sermon_id=$1) AS transcripts,
        (SELECT count(*)::int FROM sermon_question_answers WHERE sermon_id=$1) AS question_answers,
        (SELECT count(*)::int FROM sermon_enrichment_sources WHERE sermon_id=$1) AS sources,
        (SELECT count(*)::int FROM sermon_enrichment_reviews WHERE sermon_id=$1) AS guided_reviews,
        (SELECT count(*)::int FROM delegated_ai_review_members WHERE sermon_id=$1) AS membership,
        (SELECT count(*)::int FROM sermon_ai_content_reviews WHERE sermon_id=$1) AS ai_content_reviews,
        (SELECT count(*)::int FROM sermon_deletion_tombstones WHERE former_sermon_id=$1) AS tombstones,
        (SELECT count(*)::int FROM redirects WHERE source_sermon_id=$1) AS public_dispositions`, [fixtureId])).rows[0]).toEqual({
        sermons: 0, transcripts: 0, question_answers: 0, sources: 0, guided_reviews: 0,
        membership: 0, ai_content_reviews: 0, tombstones: 1, public_dispositions: 0
      });
      expect((await pool.query("SELECT to_jsonb(a) AS value FROM audit_events a WHERE entity_id=$1 AND action<>'sermon.permanent_delete' ORDER BY id", [fixtureId])).rows).toEqual(priorAudit);
      const tombstone = (await pool.query("SELECT to_jsonb(t) AS value FROM sermon_deletion_tombstones t WHERE former_sermon_id=$1", [fixtureId])).rows[0]!.value;
      expect(tombstone).toMatchObject({ former_sermon_id: fixtureId, former_slug: fixtureSlug,
        actor_subject: admin.subject, actor_role: "admin", action: "sermon.permanent_delete", reason,
        was_previously_published: false, seo_disposition: null, redirect_target_path: null,
        request_correlation_id: "anonymised-delegated-permanent-delete" });
      expect(Object.keys(tombstone).sort()).toEqual(["id", "former_sermon_id", "former_slug", "actor_subject", "actor_role", "action",
        "reason", "was_previously_published", "seo_disposition", "redirect_target_path", "request_correlation_id", "created_at"].sort());
      expect((await pool.query(`SELECT actor_subject,actor_role,action,changed_fields,outcome FROM audit_events
        WHERE entity_id=$1 AND action='sermon.permanent_delete'`, [fixtureId])).rows).toEqual([{
        actor_subject: admin.subject, actor_role: "admin", action: "sermon.permanent_delete",
        changed_fields: ["permanentDeletion"], outcome: "succeeded"
      }]);
      expect(JSON.stringify(tombstone)).not.toContain(description);
      expect(JSON.stringify(tombstone)).not.toContain(sourceReference);
      const publicRepository = new PostgresSermonRepository(pool);
      expect(await publicRepository.findPublishedBySlug(fixtureSlug)).toBeNull();
      const listed = await listDelegatedReviews(pool);
      expect(listed.some(row => row.sermonId === fixtureId)).toBe(false);
      expect(listed.filter(row => row.sermonId === outsideId && row.outcome === "accepted")).toHaveLength(2);
      const after = await snapshot(pool);
      await expect(applyDelegatedReview(pool, siblingRequest)).resolves.toBe("unchanged");
      await expect(service.permanentlyDelete(fixtureId, input, admin, "anonymised-delete-repeated"))
        .rejects.toMatchObject({ status: 404, code: "not_found" });
      expect(await snapshot(pool)).toEqual(after);
    });
  });

  it("independently rolls back and reapplies the delegated schema with its constraints, indexes and triggers", async () => {
    const pool = getPool();
    const objects = async () => (await pool.query(`SELECT
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public'
        AND table_name IN ('delegated_ai_review_scopes','delegated_ai_review_members','sermon_ai_content_reviews')) AS tables,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public' AND indexname='sermon_ai_content_reviews_current_idx') AS indexes,
      (SELECT count(*)::int FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
        ('delegated_ai_review_scopes_immutable','delegated_ai_review_members_immutable','sermon_ai_content_reviews_immutable',
         'sermons_protect_ai_content','qa_protect_ai_content')) AS triggers,
      (SELECT count(*)::int FROM pg_constraint WHERE conrelid IN
        (to_regclass('public.delegated_ai_review_scopes'),to_regclass('public.delegated_ai_review_members'),to_regclass('public.sermon_ai_content_reviews'))) AS constraints`)).rows[0];
    const original = await objects();
    expect(original).toMatchObject({ tables: 3, indexes: 1, triggers: 5 });
    expect(original.constraints).toBeGreaterThan(15);
    const readinessView = (await pool.query("SELECT pg_get_viewdef('sermon_content_readiness'::regclass, true) AS value")).rows;
    await expect(runSchema("rollback", migrationId)).resolves.toMatchObject({ outcome: "rolled_back", journalReceiptCount: 16 });
    expect(await objects()).toEqual({ tables: 0, indexes: 0, triggers: 0, constraints: 0 });
    expect((await pool.query("SELECT pg_get_viewdef('sermon_content_readiness'::regclass, true) AS value")).rows).toEqual(readinessView);
    await expect(runSchema("apply", migrationId)).resolves.toMatchObject({ outcome: "applied", journalReceiptCount: 17 });
    expect(await objects()).toEqual(original);
    const reapplied = await snapshot(pool);
    await expect(runSchema("apply", migrationId)).resolves.toMatchObject({ outcome: "no_op", journalReceiptCount: 17 });
    expect(await snapshot(pool)).toEqual(reapplied);
  });
}

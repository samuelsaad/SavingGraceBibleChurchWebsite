import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createSermonInputSchema,
  enrichmentReviewItemDecisionInputSchema,
  enrichmentReviewProgressInputSchema,
  finishEnrichmentReviewInputSchema,
  permanentlyDeleteSermonInputSchema,
  sermonTransitionInputSchema,
  taxonomyWriteInputSchema,
  updateSermonInputSchema
} from "../src/api/contracts/admin-sermons";
import { publicSermonListQuerySchema } from "../src/api/contracts/public-sermons";
import { AdminSermonService } from "../src/application/admin-sermon-service";
import type { ApplicationIdentity } from "../src/application/authorization";
import { ApplicationError } from "../src/application/errors";
import type { SermonStatus } from "../src/domain/sermon";
import { runMigrationDryRun } from "../src/migration/importer";
import { loadMigrationResult } from "../src/migration/postgres-loader";
import {
  applyReferenceCatalogue,
  protestantBibleBooks,
  rollbackReferenceCatalogue,
  savingGraceSpeakers
} from "../src/migration/reference-catalogue";
import {
  loadSchemaMigrations,
  runSchemaMigrations,
  type SchemaMigrationScope
} from "../src/migration/schema-migrations";
import { legacySermonRecordSchema } from "../src/migration/types";
import {
  buildEnrichmentQueue,
  importEnrichmentDraftBundle
} from "../src/enrichment/postgres-enrichment";
import {
  atomicReviewItemSetSha256,
  buildAtomicReviewItems
} from "../src/enrichment/atomic-review-contracts";
import {
  assemblePhase3b2AtomicReviewManifest,
  importPhase3b2AtomicReviewManifest,
  verifyPhase3b2AtomicReviewManifest
} from "../src/enrichment/atomic-review";
import {
  runPhase3b2PunctuationCompletion,
  verifyPhase3b2PunctuationCompletion
} from "../src/enrichment/phase3b2b-pilot";
import {
  buildPunctuationPack,
  createPunctuationWorkspaceTemplate,
  phase3b2PunctuationProcessingVersion
} from "../src/enrichment/pilot-punctuation";
import { LocalTestIdentityProvider } from "../src/server/auth/local-test-identity-provider";
import { createApplicationApiRouter } from "../src/server/http/application-api-router";
import { PostgresAdminSermonRepository } from "../src/server/repositories/postgres-admin-sermon-repository";
import { PostgresSermonRepository } from "../src/server/repositories/postgres-sermon-repository";
import { anonymisedAtomicManifest } from "./fixtures/atomic-review";

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1";
const integration = enabled ? describe : describe.skip;

function disposableConnectionString(): string {
  if (process.env.ALLOW_LOCAL_DB_WRITE !== "1") {
    throw new Error("PostgreSQL integration tests require ALLOW_LOCAL_DB_WRITE=1");
  }
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");
  const url = new URL(value);
  if (
    !new Set(["127.0.0.1", "localhost", "[::1]", "::1"]).has(url.hostname) ||
    url.port !== "5432" ||
    url.pathname.slice(1) !== "savinggrace_sermons_test"
  ) {
    throw new Error("Integration tests require savinggrace_sermons_test on loopback port 5432");
  }
  return value;
}

function approvedEnrichment() {
  return {
    summary: "This approved local description explains the sermon message and prepares a visitor to engage with its scripture-grounded application.",
    summaryStatus: "approved" as const,
    summarySourceKind: "manual" as const,
    summarySourceReference: null,
    transcript: {
      bodyText: "A complete anonymised transcript reviewed for local integration testing.",
      status: "approved" as const,
      sourceKind: "manual" as const,
      sourceReference: null
    },
    questionAnswers: Array.from({ length: 5 }, (_, index) => ({
      question: `What truth should be considered in question ${index + 1}?`,
      answer: `This reviewed answer applies the sermon and scripture in example ${index + 1}.`,
      status: "approved" as const,
      sourceKind: "manual" as const,
      sourceReference: null
    }))
  };
}

integration("disposable PostgreSQL Phase 3B application", () => {
  let pool: Pool;

  function runSchema(direction: "apply" | "rollback", scope: SchemaMigrationScope = "all") {
    return runSchemaMigrations(pool, {
      direction,
      scope,
      connectionString: disposableConnectionString(),
      writeOptIn: process.env.ALLOW_LOCAL_DB_WRITE
    });
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: disposableConnectionString(), max: 4 });
    const identity = await pool.query<{
      server_16: boolean;
      loopback: boolean;
      port_5432: boolean;
      target_database: boolean;
      postgres_server: boolean;
    }>(
      `SELECT
         current_setting('server_version_num')::integer BETWEEN 160000 AND 169999 AS server_16,
         inet_server_addr() = '127.0.0.1'::inet AS loopback,
         inet_server_port() = 5432 AS port_5432,
         current_database() = 'savinggrace_sermons_test' AS target_database,
         version() LIKE 'PostgreSQL%' AS postgres_server`
    );
    expect(identity.rows[0]).toEqual({
      server_16: true,
      loopback: true,
      port_5432: true,
      target_database: true,
      postgres_server: true
    });

    await runSchema("rollback");
    await runSchema("apply");
    await applyReferenceCatalogue(pool, {
      connectionString: disposableConnectionString(),
      writeOptIn: process.env.ALLOW_LOCAL_DB_WRITE
    });

    const fixture = legacySermonRecordSchema.array().parse(
      JSON.parse(await readFile("tests/fixtures/dry-run.json", "utf8"))
    );
    const transformed = runMigrationDryRun(fixture);
    await loadMigrationResult(pool, transformed, "anonymised-phase3b-fixture");
    await loadMigrationResult(pool, transformed, "anonymised-phase3b-fixture");
  });

  afterAll(async () => {
    if (!pool) return;
    await runSchema("rollback");
    await pool.end();
  });

  it("applies 0001-0008 and loads anonymised fixtures idempotently", async () => {
    const counts = await pool.query<{
      sermons: number;
      views: number;
      unowned: number;
      tombstone_table: string | null;
      source_sermon_column: number;
      transcript_table: string | null;
      source_table: string | null;
      review_table: string | null;
      review_item_table: string | null;
      speaker_join_removed: boolean;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM sermons) AS sermons,
         (SELECT count(*)::integer FROM sermon_legacy_metrics) AS views,
         (SELECT count(*)::integer FROM sermons WHERE created_by_subject IS NULL) AS unowned,
         to_regclass('public.sermon_deletion_tombstones')::text AS tombstone_table,
         (SELECT count(*)::integer FROM information_schema.columns
          WHERE table_name = 'redirects' AND column_name = 'source_sermon_id') AS source_sermon_column,
         to_regclass('public.sermon_transcripts')::text AS transcript_table,
         to_regclass('public.sermon_enrichment_sources')::text AS source_table,
         to_regclass('public.sermon_enrichment_reviews')::text AS review_table,
         to_regclass('public.sermon_enrichment_review_items')::text AS review_item_table,
         to_regclass('public.sermon_speakers') IS NULL AS speaker_join_removed`
    );
    expect(counts.rows[0]).toEqual({
      sermons: 3,
      views: 3,
      unowned: 3,
      tombstone_table: "sermon_deletion_tombstones",
      source_sermon_column: 1,
      transcript_table: "sermon_transcripts",
      source_table: "sermon_enrichment_sources",
      review_table: "sermon_enrichment_reviews",
      review_item_table: "sermon_enrichment_review_items",
      speaker_join_removed: true
    });
  });

  it("seeds reference catalogues idempotently, orders selectors, and derives scoped counts", async () => {
    await expect(applyReferenceCatalogue(pool, {
      connectionString: disposableConnectionString(),
      writeOptIn: process.env.ALLOW_LOCAL_DB_WRITE
    })).resolves.toMatchObject({ outcome: "unchanged" });

    const catalogue = await pool.query<{
      seeded_speakers: number;
      bible_books: number;
      old_testament: number;
      new_testament: number;
      canonical_classifications: number;
      min_order: number;
      max_order: number;
      distinct_orders: number;
    }>(`SELECT
      (SELECT count(*)::integer FROM speakers WHERE id = ANY($1::uuid[])) AS seeded_speakers,
      (SELECT count(*)::integer FROM bible_books) AS bible_books,
      (SELECT count(*)::integer FROM bible_books WHERE testament = 'old') AS old_testament,
      (SELECT count(*)::integer FROM bible_books WHERE testament = 'new') AS new_testament,
      (SELECT count(*)::integer FROM book_classifications
       WHERE id = ANY($2::uuid[]) AND classification_type = 'canonical') AS canonical_classifications,
      (SELECT min(canonical_order)::integer FROM bible_books) AS min_order,
      (SELECT max(canonical_order)::integer FROM bible_books) AS max_order,
      (SELECT count(DISTINCT canonical_order)::integer FROM bible_books) AS distinct_orders`, [
      savingGraceSpeakers.map((speaker) => speaker.id),
      protestantBibleBooks.map((book) => book.classificationId)
    ]);
    expect(catalogue.rows[0]).toEqual({
      seeded_speakers: 7,
      bible_books: 66,
      old_testament: 39,
      new_testament: 27,
      canonical_classifications: 66,
      min_order: 1,
      max_order: 66,
      distinct_orders: 66
    });

    const repository = new PostgresAdminSermonRepository(pool);
    const speakers = await repository.listTaxonomies("speakers");
    const books = await repository.listTaxonomies("books");
    expect(speakers.filter((speaker) => savingGraceSpeakers.some((seed) => seed.id === speaker.id))
      .map((speaker) => speaker.name)).toEqual(savingGraceSpeakers.map((speaker) => speaker.name));
    expect(books.filter((book) => protestantBibleBooks.some((seed) => seed.classificationId === book.id))
      .map((book) => book.name)).toEqual(protestantBibleBooks.map((book) => book.canonicalName));

    const target = (await pool.query<{ id: string; original_speaker_id: string | null }>(
      "SELECT id, speaker_id AS original_speaker_id FROM sermons ORDER BY id LIMIT 1"
    )).rows[0]!;
    await pool.query("UPDATE sermons SET speaker_id = $2 WHERE id = $1", [target.id, savingGraceSpeakers[0]!.id]);
    try {
      await expect(rollbackReferenceCatalogue(pool, {
        connectionString: disposableConnectionString(),
        writeOptIn: process.env.ALLOW_LOCAL_DB_WRITE
      })).rejects.toThrow("reference catalogue is in use");
    } finally {
      await pool.query("UPDATE sermons SET speaker_id = $2 WHERE id = $1", [target.id, target.original_speaker_id]);
    }

    const draftTarget = (await pool.query<{ id: string; original_speaker_id: string | null }>(
      "SELECT id, speaker_id AS original_speaker_id FROM sermons WHERE status <> 'published' ORDER BY id LIMIT 1"
    )).rows[0]!;
    await pool.query("UPDATE sermons SET speaker_id = $2 WHERE id = $1", [draftTarget.id, savingGraceSpeakers[0]!.id]);
    await pool.query(
      `INSERT INTO sermon_book_classifications (sermon_id, book_classification_id)
       VALUES ($1, $2)`,
      [draftTarget.id, protestantBibleBooks[0]!.classificationId]
    );
    const dynamicSpeakers = await repository.listTaxonomies("speakers");
    const dynamicBooks = await repository.listTaxonomies("books");
    expect(dynamicSpeakers.find((speaker) => speaker.id === savingGraceSpeakers[0]!.id))
      .toMatchObject({ administratorSermonCount: 1, publicSermonCount: 0 });
    expect(dynamicBooks.find((book) => book.id === protestantBibleBooks[0]!.classificationId))
      .toMatchObject({ administratorSermonCount: 1, publicSermonCount: 0 });
    await pool.query("DELETE FROM sermon_book_classifications WHERE sermon_id = $1 AND book_classification_id = $2", [
      draftTarget.id,
      protestantBibleBooks[0]!.classificationId
    ]);
    await pool.query("UPDATE sermons SET speaker_id = $2 WHERE id = $1", [draftTarget.id, draftTarget.original_speaker_id]);
    expect((await repository.listTaxonomies("speakers")).find((speaker) => speaker.id === savingGraceSpeakers[0]!.id))
      .toMatchObject({ administratorSermonCount: 0, publicSermonCount: 0 });
    expect((await repository.listTaxonomies("books")).find((book) => book.id === protestantBibleBooks[0]!.classificationId))
      .toMatchObject({ administratorSermonCount: 0, publicSermonCount: 0 });
  });

  it("aborts the one-speaker migration with affected IDs and cleanly reapplies", async () => {
    await runSchema("rollback", "0008_atomic_sermon_review_items");
    await runSchema("rollback", "0007_guided_sermon_review");
    await runSchema("rollback", "0006_phase3b2_pilot_provenance");
    await runSchema("rollback", "0005_approved_sermon_descriptions");
    await runSchema("rollback", "0004_sermon_enrichment_readiness");
    const target = await pool.query<{ sermon_id: string; other_speaker_id: string }>(
      `SELECT s.id AS sermon_id, sp.id AS other_speaker_id
       FROM sermons s
       CROSS JOIN LATERAL (
         SELECT id FROM speakers WHERE id <> (
           SELECT speaker_id FROM sermon_speakers WHERE sermon_id = s.id LIMIT 1
         ) ORDER BY id LIMIT 1
       ) sp
       WHERE EXISTS (SELECT 1 FROM sermon_speakers ss WHERE ss.sermon_id = s.id)
       ORDER BY s.id LIMIT 1`
    );
    const anomaly = target.rows[0]!;
    await pool.query(
      `INSERT INTO sermon_speakers (sermon_id, speaker_id, display_order)
       VALUES ($1, $2, 1)`,
      [anomaly.sermon_id, anomaly.other_speaker_id]
    );
    await expect(runSchema("apply", "0004_sermon_enrichment_readiness"))
      .rejects.toMatchObject({ code: "migration_transaction_failure" });
    expect((await pool.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM schema_migrations WHERE migration_order = 4"
    )).rows[0]).toEqual({ count: 0 });
    expect(
      (await pool.query("SELECT to_regclass('public.sermon_speakers')::text AS value")).rows[0]
    ).toEqual({ value: "sermon_speakers" });
    await pool.query(
      "DELETE FROM sermon_speakers WHERE sermon_id = $1 AND speaker_id = $2",
      [anomaly.sermon_id, anomaly.other_speaker_id]
    );
    await runSchema("apply", "0004_sermon_enrichment_readiness");
    await runSchema("apply", "0005_approved_sermon_descriptions");
    await runSchema("apply", "0006_phase3b2_pilot_provenance");
    await runSchema("apply", "0007_guided_sermon_review");
    await runSchema("apply", "0008_atomic_sermon_review_items");
    expect(
      (await pool.query("SELECT to_regclass('public.sermon_speakers') IS NULL AS removed")).rows[0]
    ).toEqual({ removed: true });
  });

  it("preserves published-only public list, search, filters, pagination, and safe detail", async () => {
    const repository = new PostgresSermonRepository(pool);
    const page = await repository.listPublished(publicSermonListQuerySchema.parse({ pageSize: 1 }));
    expect(page).toMatchObject({ totalItems: 2 });
    expect(page.data).toHaveLength(1);

    const filtered = await repository.listPublished(
      publicSermonListQuerySchema.parse({
        query: "grace",
        speaker: "example-speaker",
        series: "example-series",
        passage: "romans-8-1-4",
        book: "romans",
        dateFrom: "2026-08-02",
        dateTo: "2026-08-02"
      })
    );
    expect(filtered.data.map((sermon) => sermon.slug)).toEqual([
      "grace-for-an-anonymised-congregation"
    ]);
    expect(
      await repository.listPublished(
        publicSermonListQuerySchema.parse({
          series: "example-series",
          speaker: "second-speaker"
        })
      )
    ).toMatchObject({ data: [], totalItems: 0 });

    expect(await repository.findPublishedBySlug("an-anonymised-pending-sermon")).toBeNull();
    const searchableId = (
      await pool.query<{ id: string }>(
        "SELECT id FROM sermons WHERE slug = 'grace-for-an-anonymised-congregation'"
      )
    ).rows[0]!.id;
    const approvedDescription = "This approved description contains intermediateweighttoken and clearly explains the sermon message before a visitor chooses its media.";
    await pool.query(
      `UPDATE sermons
       SET summary = $2, summary_status = 'approved', summary_source_kind = 'manual',
           summary_created_at = now(), summary_updated_at = now(),
           summary_reviewed_by_subject = 'local-admin-0001',
           summary_approved_by_subject = 'local-admin-0001',
           summary_reviewed_at = now(), summary_approved_at = now()
       WHERE id = $1`,
      [searchableId, approvedDescription]
    );
    const draftDescriptionId = (
      await pool.query<{ id: string }>(
        "SELECT id FROM sermons WHERE status = 'published' AND id <> $1 ORDER BY id LIMIT 1",
        [searchableId]
      )
    ).rows[0]!.id;
    await pool.query(
      `UPDATE sermons
       SET summary = 'This private draft contains draftonlydescriptiontoken and remains unavailable to public response and search consumers.',
           summary_status = 'draft', summary_source_kind = 'manual',
           summary_created_at = now(), summary_updated_at = now()
       WHERE id = $1`,
      [draftDescriptionId]
    );
    await pool.query(
      `INSERT INTO sermon_transcripts (
         sermon_id, body_text, status, source_kind, reviewed_by_subject,
         approved_by_subject, reviewed_at, approved_at
       ) VALUES ($1, 'An approved transcript with eschatologicalneologism.', 'approved',
         'manual', 'local-admin-0001', 'local-admin-0001', now(), now())`,
      [searchableId]
    );
    for (let index = 1; index <= 5; index += 1) {
      await pool.query(
        `INSERT INTO sermon_question_answers (
           sermon_id, question_text, answer_text, display_order, status, source_kind,
           reviewed_by_subject, approved_by_subject, reviewed_at, approved_at
         ) VALUES ($1, $2, $3, $4, 'approved', 'manual',
           'local-admin-0001', 'local-admin-0001', now(), now())`,
        [
          searchableId,
          `How does covenantalthoughtword ${index} shape this passage?`,
          `It grounds reflection ${index} in the sermon and scripture.`,
          index
        ]
      );
    }
    expect(
      (
        await repository.listPublished(
          publicSermonListQuerySchema.parse({ query: "eschatologicalneologism" })
        )
      ).data.map((item) => item.id)
    ).toEqual([searchableId]);
    expect(
      (
        await repository.listPublished(
          publicSermonListQuerySchema.parse({ query: "intermediateweighttoken" })
        )
      ).data.map((item) => item.id)
    ).toEqual([searchableId]);
    expect(
      await repository.listPublished(
        publicSermonListQuerySchema.parse({ query: "draftonlydescriptiontoken" })
      )
    ).toMatchObject({ data: [], totalItems: 0 });
    expect(
      (
        await repository.listPublished(
          publicSermonListQuerySchema.parse({ query: "covenantalthoughtword" })
        )
      ).data.map((item) => item.id)
    ).toEqual([searchableId]);
    const sermon = await repository.findPublishedBySlug(
      "grace-for-an-anonymised-congregation"
    );
    const json = JSON.stringify(sermon);
    expect(sermon?.media.map((media) => media.provider)).toEqual(["youtube", "sermonaudio"]);
    expect(sermon?.transcript?.bodyText).toContain("eschatologicalneologism");
    expect(sermon?.summary).toBe(approvedDescription);
    expect(sermon?.questionAnswers).toHaveLength(5);
    expect(json).not.toMatch(/<iframe|legacyViewCount|originalValue|source_wordpress/i);
    const publicList = await repository.listPublished(
      publicSermonListQuerySchema.parse({ pageSize: 50 })
    );
    expect(publicList.data.find((item) => item.id === searchableId)?.summary).toBe(approvedDescription);
    expect(publicList.data.find((item) => item.id === draftDescriptionId)?.summary).toBeNull();
    expect(JSON.stringify(publicList)).not.toMatch(/transcript|questionAnswers|draftonlydescriptiontoken/);
  });

  it("exports deterministic work and imports enrichment drafts idempotently without approval", async () => {
    const firstQueue = await buildEnrichmentQueue(pool, "anonymised-phase3b-fixture");
    const secondQueue = await buildEnrichmentQueue(pool, "anonymised-phase3b-fixture");
    expect(firstQueue).toEqual(secondQueue);
    const target = firstQueue.records.find((record) => record.sourceWordPressId === 9003)!;
    const bundle = {
      schemaVersion: 3 as const,
      sourceWordPressId: target.sourceWordPressId,
      targetSermonId: target.targetSermonId,
      expectedRowVersion: target.rowVersion,
      description: {
        bodyText: "This imported local description draft explains the anonymised sermon context for later human review.",
        provenance: { sourceKind: "generated_draft" as const, sourceReference: "safe-local-job-9003" }
      },
      transcript: {
        bodyText: "A local anonymised transcript draft.",
        provenance: { sourceKind: "caption" as const, sourceReference: "safe-local-job-9003" }
      },
      questionAnswers: Array.from({ length: 5 }, (_, index) => ({
        question: `What should the listener consider in example ${index + 1}?`,
        answer: `The draft answer remains subject to human review ${index + 1}.`,
        provenance: { sourceKind: "generated_draft" as const, sourceReference: "safe-local-job-9003" }
      })),
      sourceProvenance: {
        provider: "youtube" as const,
        videoId: "aaaaaaaaaaa",
        canonicalUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
        captionLanguage: "en-AU",
        captionTrackType: "unknown" as const,
        originalFilename: "anonymised-caption.txt",
        sourceContentSha256: "a".repeat(64),
        retrievalAttribution: "authorised_youtube_studio_export" as const,
        sourceCharacterCount: 10_000,
        cleanedCharacterCount: 10_020,
        apparentCompleteness: "apparently_complete" as const,
        uncertaintyMarkerCount: 0,
        warnings: [{ code: "administrator_accuracy_review_required", safeDetail: "Human review remains required." }],
        unresolvedPassages: [],
        processingVersion: "phase3b2-test-v1",
        importedAt: "2026-08-06T00:00:00.000Z",
        processedAt: "2026-08-06T00:00:01.000Z",
        processingDurationMs: 1_000,
        estimatedReviewMinutes: 60,
        manualAttentionRequired: true as const,
        accuracyReviewStatus: "required" as const
      }
    };
    expect((await importEnrichmentDraftBundle(pool, bundle)).outcome).toBe("imported_as_draft");
    expect((await importEnrichmentDraftBundle(pool, bundle)).outcome).toBe("unchanged");
    const stored = await pool.query<{
      description_status: string;
      transcript_status: string;
      questions: number;
      approved_questions: number;
      audits: number;
      provenance: number;
    }>(
      `SELECT
         (SELECT summary_status FROM sermons WHERE id = $1) AS description_status,
         (SELECT status FROM sermon_transcripts WHERE sermon_id = $1) AS transcript_status,
         (SELECT count(*)::integer FROM sermon_question_answers WHERE sermon_id = $1) AS questions,
         (SELECT count(*)::integer FROM sermon_question_answers WHERE sermon_id = $1 AND status = 'approved') AS approved_questions,
         (SELECT count(*)::integer FROM audit_events WHERE entity_id = $1 AND action = 'sermon.enrichment_draft_imported') AS audits,
         (SELECT count(*)::integer FROM sermon_enrichment_sources WHERE sermon_id = $1) AS provenance`,
      [target.targetSermonId]
    );
    expect(stored.rows[0]).toEqual({
      description_status: "draft",
      transcript_status: "draft",
      questions: 5,
      approved_questions: 0,
      audits: 1,
      provenance: 1
    });
    expect((await new PostgresAdminSermonRepository(pool).findSermon(target.targetSermonId))?.enrichmentSource)
      .toMatchObject({
        videoId: "aaaaaaaaaaa",
        captionTrackType: "unknown",
        accuracyReviewStatus: "required"
      });
    const approvedText = "This administrator-approved description must remain intact when a later draft import contains different proposed wording.";
    await pool.query(
      `UPDATE sermons
       SET summary = $2, summary_status = 'approved', summary_source_kind = 'manual',
           summary_updated_at = now(), summary_reviewed_by_subject = 'local-admin-0001',
           summary_approved_by_subject = 'local-admin-0001', summary_reviewed_at = now(),
           summary_approved_at = now(), row_version = row_version + 1
       WHERE id = $1`,
      [target.targetSermonId, approvedText]
    );
    const currentVersion = (
      await pool.query<{ row_version: number }>("SELECT row_version FROM sermons WHERE id = $1", [target.targetSermonId])
    ).rows[0]!.row_version;
    await expect(
      importEnrichmentDraftBundle(pool, {
        ...bundle,
        expectedRowVersion: currentVersion,
        description: {
          ...bundle.description,
          bodyText: "This conflicting draft description must never replace an already approved administrator description."
        }
      })
    ).rejects.toThrow("approved_description_conflict");
    expect(
      (await pool.query<{ summary: string }>("SELECT summary FROM sermons WHERE id = $1", [target.targetSermonId])).rows[0]!.summary
    ).toBe(approvedText);
    await pool.query(
      `UPDATE sermon_transcripts
       SET status = 'approved', reviewed_by_subject = 'local-admin-0001',
           approved_by_subject = 'local-admin-0001', reviewed_at = now(), approved_at = now()
       WHERE sermon_id = $1`,
      [target.targetSermonId]
    );
    await pool.query(
      `UPDATE sermon_question_answers
       SET status = 'approved', reviewed_by_subject = 'local-admin-0001',
           approved_by_subject = 'local-admin-0001', reviewed_at = now(), approved_at = now()
       WHERE sermon_id = $1`,
      [target.targetSermonId]
    );
    await expect(
      importEnrichmentDraftBundle(pool, {
        ...bundle,
        expectedRowVersion: currentVersion,
        description: { ...bundle.description, bodyText: approvedText },
        transcript: { ...bundle.transcript, bodyText: "A different draft must not replace an approved transcript." }
      })
    ).rejects.toThrow("approved_transcript_conflict");
    await expect(
      importEnrichmentDraftBundle(pool, {
        ...bundle,
        expectedRowVersion: currentVersion,
        description: { ...bundle.description, bodyText: approvedText },
        questionAnswers: bundle.questionAnswers.map((item, index) =>
          index === 0 ? { ...item, answer: "A conflicting answer must not replace approved Q&A." } : item
        )
      })
    ).rejects.toThrow("approved_question_answers_conflict");
    expect(await new PostgresSermonRepository(pool).findPublishedBySlug("an-anonymised-pending-sermon")).toBeNull();
  });

  it("runs the real Phase 3B.2b filesystem, orchestration, importer and fail-closed verifier paths", async () => {
    const roots: string[] = [];
    const makeCaption = (punctuated: boolean) => Array.from(
      { length: 110 },
      () => punctuated
        ? "The anonymised speaker explains a local example and invites careful review."
        : "the anonymised speaker explains a local example and invites careful review [unclear]"
    ).join(" ");
    const completionRecord = (videoId: string, punctuationPackFilename: string) => ({
      videoId,
      punctuationPackFilename,
      descriptionDraft: "This anonymised local description is grounded in the test transcript and remains a private draft for explicit administrator review.",
      descriptionSupportingParagraphs: [1],
      questionAnswers: Array.from({ length: 7 }, (_, index) => ({
        question: `What should be considered in anonymised question ${index + 1}?`,
        answer: "This transcript-grounded anonymised answer remains a private draft for administrator review.",
        supportingParagraphs: [1]
      })),
      possibleCaptionErrors: [{
        detail: "An anonymised source uncertainty remains for review.",
        supportingParagraphs: [1]
      }],
      apparentNamesAndScriptureReferences: []
    });
    const createFixture = async (
      videoIds: readonly [string, string, string],
      sourceIdBase: number
    ) => {
      const root = await mkdtemp(join(tmpdir(), "phase3b2b-postgres-"));
      roots.push(root);
      const records = videoIds.map((videoId, index) => ({
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}&list=ignored&index=${index + 1}`,
        captionFilename: `anonymised-${index + 1}.txt`,
        captionLanguage: "en-AU",
        captionTrackType: "unknown" as const,
        sourceWordPressId: sourceIdBase + index,
        title: `Anonymised punctuation pilot ${sourceIdBase + index}`,
        slug: `anonymised-punctuation-pilot-${sourceIdBase + index}`,
        serviceDate: "1970-01-01",
        descriptionDraft: null,
        questionAnswers: []
      }));
      const manifest = {
        schemaVersion: 1 as const,
        sourceSnapshotId: `anonymised-phase3b2b-${sourceIdBase}`,
        allowlistedVideoIds: [...videoIds],
        records
      };
      await Promise.all(records.map((record, index) =>
        writeFile(join(root, record.captionFilename), makeCaption(index === 0), "utf8")
      ));
      const completionRecords = [];
      for (const [index, record] of records.slice(1).entries()) {
        const sourceText = await readFile(join(root, record.captionFilename), "utf8");
        const template = createPunctuationWorkspaceTemplate(record.videoId, sourceText);
        const pack = buildPunctuationPack(
          record.videoId,
          sourceText,
          template,
          template.chunks.map((chunk) => sourceText.slice(chunk.sourceStart, chunk.sourceEnd))
        );
        const packFilename = `anonymised-${index + 1}.pack.private.json`;
        await writeFile(join(root, packFilename), `${JSON.stringify(pack, null, 2)}\n`, "utf8");
        completionRecords.push(completionRecord(record.videoId, packFilename));
      }
      const completion = {
        schemaVersion: 2 as const,
        sourceSnapshotId: manifest.sourceSnapshotId,
        records: completionRecords
      };
      return { root, manifest, completion, records };
    };

    const successfulIds = ["ddddddddddd", "eeeeeeeeeee", "fffffffffff"] as const;
    const successful = await createFixture(successfulIds, 991_000);
    const successfulSourceIds = successful.records.slice(1).map((record) => record.sourceWordPressId);
    try {
      const first = await runPhase3b2PunctuationCompletion(
        pool,
        successful.root,
        successful.manifest,
        successful.completion
      );
      expect(first).toHaveLength(2);
      expect(first.every((outcome) => outcome.importedOutcome === "imported_as_draft" && outcome.failure === null))
        .toBe(true);
      expect(first.every((outcome) => outcome.uncertaintyMarkerCount > 0)).toBe(true);

      const second = await runPhase3b2PunctuationCompletion(
        pool,
        successful.root,
        successful.manifest,
        successful.completion
      );
      expect(second.every((outcome) => outcome.importedOutcome === "unchanged" && outcome.failure === null))
        .toBe(true);

      const retained = await pool.query<{
        records: number;
        draft_sermons: number;
        draft_descriptions: number;
        draft_transcripts: number;
        draft_questions: number;
        uncertainty_records: number;
        unresolved_records: number;
        warning_records: number;
        language_records: number;
        track_type_records: number;
      }>(
        `SELECT
           (SELECT count(*)::integer FROM sermons WHERE source_wordpress_id = ANY($1::bigint[])) AS records,
           (SELECT count(*)::integer FROM sermons WHERE source_wordpress_id = ANY($1::bigint[]) AND status = 'draft') AS draft_sermons,
           (SELECT count(*)::integer FROM sermons WHERE source_wordpress_id = ANY($1::bigint[]) AND summary_status = 'draft') AS draft_descriptions,
           (SELECT count(*)::integer FROM sermon_transcripts t JOIN sermons s ON s.id = t.sermon_id
             WHERE s.source_wordpress_id = ANY($1::bigint[]) AND t.status = 'draft') AS draft_transcripts,
           (SELECT count(*)::integer FROM sermon_question_answers q JOIN sermons s ON s.id = q.sermon_id
             WHERE s.source_wordpress_id = ANY($1::bigint[]) AND q.status = 'draft') AS draft_questions,
           (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN sermons s ON s.id = source.sermon_id
             WHERE s.source_wordpress_id = ANY($1::bigint[]) AND source.uncertainty_marker_count > 0) AS uncertainty_records,
           (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN sermons s ON s.id = source.sermon_id
             WHERE s.source_wordpress_id = ANY($1::bigint[]) AND jsonb_array_length(source.unresolved_passages) > 0) AS unresolved_records,
           (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN sermons s ON s.id = source.sermon_id
             WHERE s.source_wordpress_id = ANY($1::bigint[]) AND source.warnings @> '[{"code":"source_uncertainties_retained"}]'::jsonb) AS warning_records,
           (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN sermons s ON s.id = source.sermon_id
             WHERE s.source_wordpress_id = ANY($1::bigint[]) AND source.caption_language = 'en-AU') AS language_records,
           (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN sermons s ON s.id = source.sermon_id
             WHERE s.source_wordpress_id = ANY($1::bigint[]) AND source.caption_track_type = 'unknown') AS track_type_records`,
        [successfulSourceIds]
      );
      expect(retained.rows[0]).toEqual({
        records: 2,
        draft_sermons: 2,
        draft_descriptions: 2,
        draft_transcripts: 2,
        draft_questions: 14,
        uncertainty_records: 2,
        unresolved_records: 2,
        warning_records: 2,
        language_records: 2,
        track_type_records: 2
      });

      await expect(verifyPhase3b2PunctuationCompletion(
        pool,
        successful.root,
        successful.manifest,
        successful.completion
      )).resolves.toMatchObject({
        authorisedRecordCount: 2,
        idempotentRerunCount: 2,
        everySermonDraft: true,
        publicRoutesIsolated: true,
        historicalReadinessIsolated: true
      });

      const invalidStates = [
        {
          apply: "UPDATE sermons SET status = 'published', published_at = now() WHERE source_wordpress_id = $1",
          restore: "UPDATE sermons SET status = 'draft', published_at = NULL WHERE source_wordpress_id = $1"
        },
        {
          apply: `UPDATE sermons SET summary_status = 'approved', summary_reviewed_by_subject = 'local-admin-0001',
                    summary_approved_by_subject = 'local-admin-0001', summary_reviewed_at = now(), summary_approved_at = now()
                  WHERE source_wordpress_id = $1`,
          restore: `UPDATE sermons SET summary_status = 'draft', summary_reviewed_by_subject = NULL,
                    summary_approved_by_subject = NULL, summary_reviewed_at = NULL, summary_approved_at = NULL
                  WHERE source_wordpress_id = $1`
        },
        {
          apply: `UPDATE sermon_question_answers SET status = 'approved', reviewed_by_subject = 'local-admin-0001',
                    approved_by_subject = 'local-admin-0001', reviewed_at = now(), approved_at = now()
                  WHERE sermon_id = (SELECT id FROM sermons WHERE source_wordpress_id = $1)`,
          restore: `UPDATE sermon_question_answers SET status = 'draft', reviewed_by_subject = NULL,
                    approved_by_subject = NULL, reviewed_at = NULL, approved_at = NULL
                  WHERE sermon_id = (SELECT id FROM sermons WHERE source_wordpress_id = $1)`
        },
        {
          apply: "UPDATE sermons SET source_status = 'unexpected_source' WHERE source_wordpress_id = $1",
          restore: "UPDATE sermons SET source_status = 'phase3b2_pilot' WHERE source_wordpress_id = $1"
        }
      ];
      for (const state of invalidStates) {
        await pool.query(state.apply, [successfulSourceIds[0]]);
        try {
          await expect(verifyPhase3b2PunctuationCompletion(
            pool,
            successful.root,
            successful.manifest,
            successful.completion
          )).rejects.toMatchObject({ code: "database_verification_failure" });
        } finally {
          await pool.query(state.restore, [successfulSourceIds[0]]);
        }
      }

      const originalStoredValues = await pool.query<{
        summary: string;
        caption_language: string;
      }>(
        `SELECT s.summary, source.caption_language
         FROM sermons s JOIN sermon_enrichment_sources source ON source.sermon_id = s.id
         WHERE s.source_wordpress_id = $1`,
        [successfulSourceIds[0]]
      );
      const originalStored = originalStoredValues.rows[0]!;
      await pool.query(
        "UPDATE sermons SET summary = summary || ' An anonymised verifier mutation.' WHERE source_wordpress_id = $1",
        [successfulSourceIds[0]]
      );
      try {
        await expect(verifyPhase3b2PunctuationCompletion(
          pool,
          successful.root,
          successful.manifest,
          successful.completion
        )).rejects.toMatchObject({ code: "database_verification_failure" });
      } finally {
        await pool.query(
          "UPDATE sermons SET summary = $2 WHERE source_wordpress_id = $1",
          [successfulSourceIds[0], originalStored.summary]
        );
      }
      await pool.query(
        `UPDATE sermon_enrichment_sources SET caption_language = 'en'
         WHERE sermon_id = (SELECT id FROM sermons WHERE source_wordpress_id = $1)`,
        [successfulSourceIds[0]]
      );
      try {
        await expect(verifyPhase3b2PunctuationCompletion(
          pool,
          successful.root,
          successful.manifest,
          successful.completion
        )).rejects.toMatchObject({ code: "database_verification_failure" });
      } finally {
        await pool.query(
          `UPDATE sermon_enrichment_sources SET caption_language = $2
           WHERE sermon_id = (SELECT id FROM sermons WHERE source_wordpress_id = $1)`,
          [successfulSourceIds[0], originalStored.caption_language]
        );
      }

      const fixtureProvenance = await pool.query<{ processing_version: string }>(
        `SELECT source.processing_version FROM sermon_enrichment_sources source
         JOIN sermons s ON s.id = source.sermon_id WHERE s.source_wordpress_id = 9003`
      );
      if (fixtureProvenance.rows[0]) {
        await pool.query(
          `UPDATE sermon_enrichment_sources SET processing_version = $1
           WHERE sermon_id = (SELECT id FROM sermons WHERE source_wordpress_id = 9003)`,
          [phase3b2PunctuationProcessingVersion]
        );
        try {
          await expect(verifyPhase3b2PunctuationCompletion(
            pool,
            successful.root,
            successful.manifest,
            successful.completion
          )).rejects.toMatchObject({ code: "database_verification_failure" });
        } finally {
          await pool.query(
            `UPDATE sermon_enrichment_sources SET processing_version = $1
             WHERE sermon_id = (SELECT id FROM sermons WHERE source_wordpress_id = 9003)`,
            [fixtureProvenance.rows[0].processing_version]
          );
        }
      }

      const failedIds = ["ggggggggggg", "hhhhhhhhhhh", "iiiiiiiiiii"] as const;
      const failed = await createFixture(failedIds, 992_000);
      const firstPackPath = join(failed.root, failed.completion.records[0]!.punctuationPackFilename);
      const firstPack = JSON.parse(await readFile(firstPackPath, "utf8")) as {
        chunks: Array<{ cleanedText: string; cleanedOutputSha256: string }>;
      };
      firstPack.chunks[0]!.cleanedText = firstPack.chunks[0]!.cleanedText.replace(
        /anonymised/i,
        "substituted"
      );
      firstPack.chunks[0]!.cleanedOutputSha256 = createHash("sha256")
        .update(firstPack.chunks[0]!.cleanedText, "utf8")
        .digest("hex");
      await writeFile(firstPackPath, `${JSON.stringify(firstPack, null, 2)}\n`, "utf8");
      const failedOutcomes = await runPhase3b2PunctuationCompletion(
        pool,
        failed.root,
        failed.manifest,
        failed.completion
      );
      expect(failedOutcomes.map((outcome) => outcome.failure?.code)).toEqual([
        "lexical_preservation_failure",
        "not_attempted_prior_failure"
      ]);
      expect((await pool.query<{ count: number }>(
        "SELECT count(*)::integer AS count FROM sermons WHERE source_wordpress_id = ANY($1::bigint[])",
        [failed.records.slice(1).map((record) => record.sourceWordPressId)]
      )).rows[0]?.count).toBe(0);
    } finally {
      await pool.query(
        "DELETE FROM migration_records WHERE source_system = 'phase3b2_pilot' AND source_id = ANY($1::text[])",
        [successfulSourceIds.map(String)]
      );
      await pool.query("DELETE FROM sermons WHERE source_wordpress_id = ANY($1::bigint[])", [successfulSourceIds]);
      await pool.query(
        `DELETE FROM migration_runs run WHERE migration_version = 'phase3b2-pilot-v1'
         AND NOT EXISTS (SELECT 1 FROM migration_records record WHERE record.migration_run_id = run.id)`
      );
      await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
    }
  });

  it("restores exact 42/44 atomic findings and fails closed on missing, extra, stale, or sibling state", async () => {
    const manifest = anonymisedAtomicManifest();
    const targetIds = manifest.records.map((record) => record.draftBundle.targetSermonId);
    const sourceIds = manifest.records.map((record) => String(record.draftBundle.sourceWordPressId));
    const root = await mkdtemp(join(tmpdir(), "sgbc-atomic-review-"));
    const preparedRoot = join(root, "prepared-private");
    const repository = new PostgresAdminSermonRepository(pool);
    const service = new AdminSermonService(repository, () => new Date("2026-08-07T00:00:00.000Z"));
    const admin = { subject: "local-admin-0001", role: "admin" } satisfies ApplicationIdentity;
    try {
      const imported = await importPhase3b2AtomicReviewManifest(pool, manifest);
      expect(imported).toEqual({
        contentOutcomes: ["imported_as_draft", "imported_as_draft"],
        atomicOutcomes: ["imported_atomic_items", "imported_atomic_items"],
        totalItemCount: 86
      });
      await expect(verifyPhase3b2AtomicReviewManifest(pool, manifest)).resolves.toEqual({
        recordCounts: [42, 44],
        totalItemCount: 86,
        pendingItemCount: 86,
        decisionCount: 0,
        approvalCount: 0,
        publicSearchCharacters: 0,
        exactIdentitySets: true
      });

      const rerun = await importPhase3b2AtomicReviewManifest(pool, manifest);
      expect(rerun).toEqual({
        contentOutcomes: ["unchanged", "unchanged"],
        atomicOutcomes: ["unchanged", "unchanged"],
        totalItemCount: 86
      });

      await mkdir(preparedRoot);
      const completionRecords = manifest.records.map((record, index) => ({
        videoId: record.draftBundle.sourceProvenance.videoId,
        punctuationPackFilename: `anonymised-pack-${index + 1}.private.json`,
        descriptionDraft: record.draftBundle.description.bodyText,
        descriptionSupportingParagraphs: [1],
        questionAnswers: record.draftBundle.questionAnswers.map((item) => ({
          question: item.question,
          answer: item.answer,
          supportingParagraphs: [1]
        })),
        possibleCaptionErrors: record.reviewItems
          .filter((item) => item.category === "caption_error")
          .map((item) => ({ detail: item.detail, supportingParagraphs: item.supportingParagraphs })),
        apparentNamesAndScriptureReferences: record.reviewItems
          .filter((item) => item.category === "name_or_scripture_reference")
          .map((item) => ({ detail: item.detail, supportingParagraphs: item.supportingParagraphs }))
      }));
      for (const record of manifest.records) {
        const videoId = record.draftBundle.sourceProvenance.videoId;
        await writeFile(
          join(preparedRoot, `${videoId}.phase3b2b-v2.private.json`),
          `${JSON.stringify(record.draftBundle, null, 2)}\n`,
          "utf8"
        );
        await writeFile(
          join(preparedRoot, `${videoId}.phase3b2b-v2.review.private.json`),
          `${JSON.stringify({
            schemaVersion: 2,
            recordKey: record.recordKey,
            tokenSequenceComparison: {
              sourceSha256: record.transcriptEvidence.sourceTokenSequenceSha256,
              cleanedSha256: record.transcriptEvidence.cleanedTokenSequenceSha256,
              match: true
            },
            preservation: {
              zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens: true,
              whitespaceBoundariesPreserved: true,
              sourceSegmentsCompleteAndUnique: true,
              chunkReassemblyComplete: true,
              sourceTokenCount: record.transcriptEvidence.sourceTokenCount,
              cleanedTokenCount: record.transcriptEvidence.cleanedTokenCount
            },
            possibleCaptionErrors: completionRecords.find((item) => item.videoId === videoId)!
              .possibleCaptionErrors,
            apparentNamesAndScriptureReferences: completionRecords.find((item) => item.videoId === videoId)!
              .apparentNamesAndScriptureReferences
          }, null, 2)}\n`,
          "utf8"
        );
      }
      const completionPath = join(root, "completion.private.json");
      await writeFile(completionPath, `${JSON.stringify({
        schemaVersion: 2,
        sourceSnapshotId: manifest.sourceSnapshotId,
        records: completionRecords
      }, null, 2)}\n`, "utf8");
      await expect(assemblePhase3b2AtomicReviewManifest(
        pool,
        completionPath,
        "atomic-completion.private.json"
      )).resolves.toEqual({ persistence: "created", recordCounts: [42, 44], totalItemCount: 86 });
      await expect(assemblePhase3b2AtomicReviewManifest(
        pool,
        completionPath,
        "atomic-completion.private.json"
      )).resolves.toEqual({ persistence: "unchanged", recordCounts: [42, 44], totalItemCount: 86 });

      const firstRecord = manifest.records[0]!;
      const removed = firstRecord.reviewItems.at(-1)!;
      await pool.query("DELETE FROM sermon_enrichment_review_items WHERE id = $1", [removed.id]);
      const missing = await service.enrichmentReviewDetail(firstRecord.draftBundle.targetSermonId, admin);
      expect(missing.progress).toMatchObject({
        totalItemCount: 42,
        presentItemCount: 41,
        itemSetMatches: false,
        canFinish: false
      });
      await pool.query(
        `INSERT INTO sermon_enrichment_review_items (
           id, sermon_id, item_key, category, display_order, label, guidance,
           source_marker, transcript_row_version, item_identity_sha256,
           source_record_key, category_ordinal, finding_detail,
           supporting_paragraphs, source_transcript_sha256, atomic_schema_version
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::integer[],$15,1)`,
        [
          removed.id,
          firstRecord.draftBundle.targetSermonId,
          removed.itemKey,
          removed.category,
          removed.displayOrder,
          `Anonymised item ${removed.displayOrder}`,
          removed.detail,
          removed.sourceMarker,
          removed.expectedTranscriptRowVersion,
          removed.identitySha256,
          removed.sourceRecordKey,
          removed.categoryOrdinal,
          removed.detail,
          removed.supportingParagraphs,
          removed.sourceTranscriptSha256
        ]
      );

      await pool.query(
        `INSERT INTO sermon_enrichment_review_items (
           sermon_id, item_key, category, display_order, label, guidance,
           transcript_row_version
         ) VALUES ($1, 'unexpected-aggregate', 'caption_error', 99,
           'Unexpected aggregate', 'Anonymised unexpected aggregate.', $2)`,
        [firstRecord.draftBundle.targetSermonId, firstRecord.transcriptEvidence.expectedRowVersion]
      );
      const extra = await service.enrichmentReviewDetail(firstRecord.draftBundle.targetSermonId, admin);
      expect(extra.progress).toMatchObject({ presentItemCount: 43, itemSetMatches: false, canFinish: false });
      expect(await repository.transaction((transaction) =>
        transaction.hasBlockingEnrichmentReviewItems(
          firstRecord.draftBundle.targetSermonId,
          firstRecord.transcriptEvidence.expectedRowVersion
        )
      )).toBe(true);
      await pool.query(
        "DELETE FROM sermon_enrichment_review_items WHERE sermon_id = $1 AND item_key = 'unexpected-aggregate'",
        [firstRecord.draftBundle.targetSermonId]
      );

      const staleItem = firstRecord.reviewItems[1]!;
      await pool.query(
        "UPDATE sermon_enrichment_review_items SET transcript_row_version = transcript_row_version + 1 WHERE id = $1",
        [staleItem.id]
      );
      expect(await repository.transaction((transaction) =>
        transaction.hasBlockingEnrichmentReviewItems(
          firstRecord.draftBundle.targetSermonId,
          firstRecord.transcriptEvidence.expectedRowVersion
        )
      )).toBe(true);
      await pool.query(
        "UPDATE sermon_enrichment_review_items SET transcript_row_version = $2 WHERE id = $1",
        [staleItem.id, staleItem.expectedTranscriptRowVersion]
      );

      const beforeDecision = await service.enrichmentReviewDetail(
        firstRecord.draftBundle.targetSermonId,
        admin
      );
      const decided = await service.decideEnrichmentReviewItem(
        firstRecord.draftBundle.targetSermonId,
        beforeDecision.items[0]!.id,
        enrichmentReviewItemDecisionInputSchema.parse({
          decision: "accepted",
          sermonRowVersion: beforeDecision.sermon.rowVersion,
          reviewRowVersion: beforeDecision.review.rowVersion,
          itemRowVersion: beforeDecision.items[0]!.rowVersion,
          transcriptRowVersion: beforeDecision.sermon.transcript!.rowVersion
        }),
        admin,
        "anonymised-atomic-single-decision"
      );
      expect(decided.progress).toMatchObject({
        resolvedItemCount: 1,
        unresolvedItemCount: 41,
        totalItemCount: 42,
        itemSetMatches: true,
        canFinish: false
      });
      expect(decided.items.filter((item) => item.decisionStatus === "pending")).toHaveLength(41);
    } finally {
      await pool.query("DELETE FROM audit_events WHERE entity_id = ANY($1::uuid[])", [targetIds]);
      await pool.query(
        "DELETE FROM migration_records WHERE source_system = 'phase3b2_pilot' AND source_id = ANY($1::text[])",
        [sourceIds]
      );
      await pool.query("DELETE FROM sermons WHERE id = ANY($1::uuid[])", [targetIds]);
      await pool.query(
        `DELETE FROM migration_runs run WHERE migration_version = 'phase3b2-pilot-v1'
         AND NOT EXISTS (SELECT 1 FROM migration_records record WHERE record.migration_run_id = run.id)`
      );
      await rm(root, { recursive: true, force: true });
    }
  });

  it("guides an explicit private enrichment review with concurrency, audit, and reopen safeguards", async () => {
    const admin = { subject: "local-admin-0001", role: "admin" } satisfies ApplicationIdentity;
    const repository = new PostgresAdminSermonRepository(pool);
    const publicRepository = new PostgresSermonRepository(pool);
    const service = new AdminSermonService(repository, () => new Date("2026-08-05T00:00:00.000Z"));
    let sermonId: string | null = null;
    try {
      const speakerId = (
        await pool.query<{ id: string }>("SELECT id FROM speakers ORDER BY id LIMIT 1")
      ).rows[0]!.id;
      const created = await service.create(
        createSermonInputSchema.parse({
          title: "Anonymised guided review",
          slug: "anonymised-guided-review",
          serviceDate: "1970-01-01",
          summary: "This private draft description explains an anonymised sermon and remains unavailable to public visitors until reviewed.",
          summaryStatus: "draft",
          summarySourceKind: "generated_draft",
          transcript: {
            bodyText: "Opening context includes mistaken caption wording for review. The remainder is anonymised local fixture text.",
            status: "draft",
            sourceKind: "caption",
            sourceReference: null
          },
          questionAnswers: Array.from({ length: 5 }, (_, index) => ({
            question: `What anonymised point is reviewed in question ${index + 1}?`,
            answer: `This private fixture answer explains anonymised point ${index + 1} without real sermon content.`,
            status: "draft",
            sourceKind: "generated_draft",
            sourceReference: null
          })),
          media: [{
            provider: "youtube",
            mediaType: "video",
            externalId: "review00001",
            canonicalUrl: "https://www.youtube.com/watch?v=review00001",
            title: "Anonymised controlled video"
          }]
        }),
        admin,
        "guided-review-create"
      );
      sermonId = created.id;
      await pool.query(
        `INSERT INTO sermon_enrichment_sources (
           sermon_id, provider, video_id, canonical_url, caption_language,
           caption_track_type, original_filename, source_content_sha256,
           retrieval_attribution, source_character_count, cleaned_character_count,
           apparent_completeness, uncertainty_marker_count, warnings,
           unresolved_passages, processing_version, imported_at, processed_at,
           processing_duration_ms, estimated_review_minutes,
           manual_attention_required, accuracy_review_status
         ) VALUES (
           $1, 'youtube', 'review00001',
           'https://www.youtube.com/watch?v=review00001', 'en-AU', 'unknown',
           'anonymised-review.txt', $2, 'authorised_youtube_studio_export',
           101, 101, 'requires_manual_review', 1, $3::jsonb, $4::jsonb,
           'anonymised-guided-review-v1', '2026-08-05T00:00:00.000Z',
           '2026-08-05T00:00:00.000Z', 10, 1, true, 'required'
         )`,
        [
          sermonId,
          "a".repeat(64),
          JSON.stringify([{
            code: "names_and_scripture_references_require_verification",
            safeDetail: "Verify anonymised names and scripture references."
          }]),
          JSON.stringify([{
            marker: "mistaken caption wording",
            safeReason: "Check the anonymised caption phrase."
          }])
        ]
      );

      const transcriptState = await pool.query<{ body_text: string; row_version: number }>(
        "SELECT body_text, row_version FROM sermon_transcripts WHERE sermon_id = $1",
        [sermonId]
      );
      const transcriptBody = transcriptState.rows[0]!.body_text;
      const transcriptRowVersion = transcriptState.rows[0]!.row_version;
      const transcriptSha256 = createHash("sha256").update(transcriptBody, "utf8").digest("hex");
      const atomicItems = buildAtomicReviewItems({
        sourceRecordKey: "authorised-record-2",
        transcriptSermonId: sermonId,
        sourceTranscriptSha256: transcriptSha256,
        expectedTranscriptRowVersion: transcriptRowVersion,
        captionErrors: [{
          detail: "Check the anonymised caption phrase.",
          supportingParagraphs: [1],
          sourceMarker: "mistaken caption wording"
        }],
        namesOrScriptureReferences: [
          { detail: "Verify an anonymised name.", supportingParagraphs: [1] },
          { detail: "Verify an anonymised Scripture reference.", supportingParagraphs: [1] }
        ]
      });
      for (const item of atomicItems) {
        await pool.query(
          `INSERT INTO sermon_enrichment_review_items (
             id, sermon_id, item_key, category, display_order, label, guidance,
             source_marker, transcript_row_version, item_identity_sha256,
             source_record_key, category_ordinal, finding_detail,
             supporting_paragraphs, source_transcript_sha256, atomic_schema_version
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::integer[],$15,1)`,
          [
            item.id,
            sermonId,
            item.itemKey,
            item.category,
            item.displayOrder,
            `Anonymised item ${item.displayOrder}`,
            item.detail,
            item.sourceMarker,
            item.expectedTranscriptRowVersion,
            item.identitySha256,
            item.sourceRecordKey,
            item.categoryOrdinal,
            item.detail,
            item.supportingParagraphs,
            item.sourceTranscriptSha256
          ]
        );
      }
      await pool.query(
        `UPDATE sermon_enrichment_reviews
         SET source_record_key = 'authorised-record-2',
             expected_item_count = $2,
             expected_item_set_sha256 = $3,
             expected_transcript_sha256 = $4,
             expected_transcript_row_version = $5,
             atomic_schema_version = 1
         WHERE sermon_id = $1`,
        [
          sermonId,
          atomicItems.length,
          atomicReviewItemSetSha256(atomicItems),
          transcriptSha256,
          transcriptRowVersion
        ]
      );

      const auditBeforeRead = (await service.listAudit(sermonId, admin)).length;
      const initial = await service.enrichmentReviewDetail(sermonId, admin);
      const repeatedRead = await service.enrichmentReviewDetail(sermonId, admin);
      expect(repeatedRead.review).toEqual(initial.review);
      expect((await service.listAudit(sermonId, admin)).length).toBe(auditBeforeRead);
      expect(initial).toMatchObject({
        sermon: { status: "draft", serviceDate: "1970-01-01" },
        review: { identityStatus: "pending", currentStage: 1, completedAt: null },
        progress: { resolvedItemCount: 0, unresolvedItemCount: 3, canFinish: false }
      });
      expect(initial.items.map((item) => item.category)).toEqual([
        "caption_error",
        "name_or_scripture_reference",
        "name_or_scripture_reference"
      ]);
      expect(initial.items[0]?.context?.flagged).toBe("mistaken caption wording");
      expect(initial.items.every((item) => item.decisionStatus === "pending")).toBe(true);

      await expect(service.updateEnrichmentReviewProgress(
        sermonId,
        enrichmentReviewProgressInputSchema.parse({
          sermonRowVersion: initial.sermon.rowVersion,
          reviewRowVersion: initial.review.rowVersion,
          currentStage: 2,
          identityStatus: "confirmed"
        }),
        admin,
        "guided-review-invalid-identity"
      )).rejects.toMatchObject({ status: 400, code: "invalid_request" });

      const identifiedSermon = await service.update(
        sermonId,
        updateSermonInputSchema.parse({
          rowVersion: initial.sermon.rowVersion,
          title: "Anonymised guided review",
          speakerId,
          serviceDate: "2026-08-05"
        }),
        admin,
        "guided-review-identity-save"
      );
      let review = await service.enrichmentReviewDetail(sermonId, admin);
      review = await service.updateEnrichmentReviewProgress(
        sermonId,
        enrichmentReviewProgressInputSchema.parse({
          sermonRowVersion: identifiedSermon.rowVersion,
          reviewRowVersion: review.review.rowVersion,
          currentStage: 2,
          identityStatus: "confirmed"
        }),
        admin,
        "guided-review-identity-confirm"
      );
      expect(review.review.identityStatus).toBe("confirmed");

      const caption = review.items.find((item) => item.category === "caption_error")!;
      const combinedItems = review.items.filter(
        (item) => item.category === "name_or_scripture_reference"
      );
      const name = combinedItems[0]!;
      const scripture = combinedItems[1]!;
      review = await service.decideEnrichmentReviewItem(
        sermonId,
        name.id,
        enrichmentReviewItemDecisionInputSchema.parse({
          sermonRowVersion: review.sermon.rowVersion,
          reviewRowVersion: review.review.rowVersion,
          itemRowVersion: name.rowVersion,
          transcriptRowVersion: review.sermon.transcript!.rowVersion,
          decision: "left_unresolved"
        }),
        admin,
        "guided-review-left-unresolved"
      );
      expect(review.progress.unresolvedItemCount).toBe(3);
      await expect(service.decideEnrichmentReviewItem(
        sermonId,
        name.id,
        enrichmentReviewItemDecisionInputSchema.parse({
          sermonRowVersion: review.sermon.rowVersion,
          reviewRowVersion: initial.review.rowVersion,
          itemRowVersion: name.rowVersion,
          transcriptRowVersion: review.sermon.transcript!.rowVersion,
          decision: "accepted"
        }),
        admin,
        "guided-review-stale-item"
      )).rejects.toMatchObject({ status: 409, code: "stale_write" });

      for (const itemId of [name.id, scripture.id]) {
        const item = review.items.find((candidate) => candidate.id === itemId)!;
        review = await service.decideEnrichmentReviewItem(
          sermonId,
          item.id,
          enrichmentReviewItemDecisionInputSchema.parse({
            sermonRowVersion: review.sermon.rowVersion,
            reviewRowVersion: review.review.rowVersion,
            itemRowVersion: item.rowVersion,
            transcriptRowVersion: review.sermon.transcript!.rowVersion,
            decision: "accepted"
          }),
          admin,
          `guided-review-accept-${item.category}`
        );
      }
      const currentCaption = review.items.find((item) => item.id === caption.id)!;
      review = await service.decideEnrichmentReviewItem(
        sermonId,
        currentCaption.id,
        enrichmentReviewItemDecisionInputSchema.parse({
          sermonRowVersion: review.sermon.rowVersion,
          reviewRowVersion: review.review.rowVersion,
          itemRowVersion: currentCaption.rowVersion,
          transcriptRowVersion: review.sermon.transcript!.rowVersion,
          decision: "corrected",
          correctionText: "reviewed caption wording"
        }),
        admin,
        "guided-review-correction"
      );
      expect(review.sermon.transcript?.bodyText).toContain("reviewed caption wording");
      expect(review.progress).toMatchObject({ resolvedItemCount: 1, unresolvedItemCount: 2 });
      expect(review.items.filter((item) => item.id !== caption.id).every(
        (item) => item.decisionStatus === "pending"
      )).toBe(true);

      for (const item of review.items.filter((candidate) => candidate.id !== caption.id)) {
        const current = review.items.find((candidate) => candidate.id === item.id)!;
        review = await service.decideEnrichmentReviewItem(
          sermonId,
          current.id,
          enrichmentReviewItemDecisionInputSchema.parse({
            sermonRowVersion: review.sermon.rowVersion,
            reviewRowVersion: review.review.rowVersion,
            itemRowVersion: current.rowVersion,
            transcriptRowVersion: review.sermon.transcript!.rowVersion,
            decision: "accepted"
          }),
          admin,
          `guided-review-reaccept-${current.category}`
        );
      }
      expect(review.progress.unresolvedItemCount).toBe(0);

      let sermon = await service.update(
        sermonId,
        updateSermonInputSchema.parse({
          rowVersion: review.sermon.rowVersion,
          transcript: {
            bodyText: review.sermon.transcript!.bodyText,
            status: "approved",
            sourceKind: "caption",
            sourceReference: null
          }
        }),
        admin,
        "guided-review-transcript-approve"
      );
      sermon = await service.update(
        sermonId,
        updateSermonInputSchema.parse({
          rowVersion: sermon.rowVersion,
          summary: sermon.summary,
          summaryStatus: "approved",
          summarySourceKind: sermon.summarySourceKind,
          summarySourceReference: sermon.summarySourceReference
        }),
        admin,
        "guided-review-description-approve"
      );
      sermon = await service.update(
        sermonId,
        updateSermonInputSchema.parse({
          rowVersion: sermon.rowVersion,
          questionAnswers: sermon.questionAnswers.map((item) => ({
            question: item.question,
            answer: item.answer,
            status: "approved",
            sourceKind: item.sourceKind,
            sourceReference: item.sourceReference
          }))
        }),
        admin,
        "guided-review-qa-approve"
      );
      review = await service.enrichmentReviewDetail(sermonId, admin);
      expect(review.items.every(
        (item) => item.transcriptRowVersion === review.sermon.transcript!.rowVersion
      )).toBe(true);
      review = await service.updateEnrichmentReviewProgress(
        sermonId,
        enrichmentReviewProgressInputSchema.parse({
          sermonRowVersion: sermon.rowVersion,
          reviewRowVersion: review.review.rowVersion,
          currentStage: 6
        }),
        admin,
        "guided-review-resume-stage"
      );
      expect((await service.enrichmentReviewDetail(sermonId, admin)).review.currentStage).toBe(6);
      review = await service.finishEnrichmentReview(
        sermonId,
        finishEnrichmentReviewInputSchema.parse({
          sermonRowVersion: review.sermon.rowVersion,
          reviewRowVersion: review.review.rowVersion
        }),
        admin,
        "guided-review-finish"
      );
      expect(review).toMatchObject({
        sermon: { status: "draft" },
        review: { currentStage: 6 },
        progress: { canFinish: true, percentReviewed: 100 }
      });
      expect(review.review.completedAt).not.toBeNull();
      expect(await publicRepository.findPublishedBySlug("anonymised-guided-review")).toBeNull();
      expect((await publicRepository.listPublished(
        publicSermonListQuerySchema.parse({ query: "anonymised-guided-review" })
      )).data).toHaveLength(0);

      await expect(service.update(
        sermonId,
        updateSermonInputSchema.parse({
          rowVersion: review.sermon.rowVersion,
          transcript: {
            bodyText: `${review.sermon.transcript!.bodyText} Changed after completion.`,
            status: "approved",
            sourceKind: "caption",
            sourceReference: null
          }
        }),
        admin,
        "guided-review-unsafe-direct-approval"
      )).rejects.toMatchObject({ status: 400, code: "invalid_request" });
      const reopenedSermon = await service.update(
        sermonId,
        updateSermonInputSchema.parse({
          rowVersion: review.sermon.rowVersion,
          transcript: {
            bodyText: `${review.sermon.transcript!.bodyText} Changed after completion.`,
            status: "draft",
            sourceKind: "caption",
            sourceReference: null
          }
        }),
        admin,
        "guided-review-reopen"
      );
      const reopened = await service.enrichmentReviewDetail(sermonId, admin);
      expect(reopened).toMatchObject({
        sermon: { rowVersion: reopenedSermon.rowVersion, status: "draft" },
        review: { currentStage: 2, completedAt: null },
        progress: { resolvedItemCount: 0, unresolvedItemCount: 3, canFinish: false }
      });
      expect(reopened.items.every((item) => item.decisionStatus === "pending")).toBe(true);
      expect((await service.listAudit(sermonId, admin)).map((event) => event.action)).toEqual(
        expect.arrayContaining([
          "sermon.enrichment_identity_confirmed",
          "sermon.enrichment_review_item_corrected",
          "sermon.enrichment_review_finished"
        ])
      );
    } finally {
      if (sermonId) {
        await pool.query("DELETE FROM audit_events WHERE entity_id = $1", [sermonId]);
        await pool.query("DELETE FROM sermons WHERE id = $1", [sermonId]);
      }
    }
  });

  it("supports admin filters, counts, every state transition, and transactional edits", async () => {
    const admin = { subject: "local-admin-0001", role: "admin" } satisfies ApplicationIdentity;
    const repository = new PostgresAdminSermonRepository(pool);
    const publicRepository = new PostgresSermonRepository(pool);
    const service = new AdminSermonService(repository, () => new Date("2026-08-05T00:00:00.000Z"));
    const taxonomyIds: string[] = [];
    const sermonIds: string[] = [];
    try {
      const speaker = await service.createTaxonomy(
        "speakers",
        taxonomyWriteInputSchema.parse({ name: "Phase 3B Speaker", slug: "phase-3b-speaker" }),
        admin,
        "phase3b-speaker"
      );
      const series = await service.createTaxonomy(
        "series",
        taxonomyWriteInputSchema.parse({ name: "Phase 3B Series", slug: "phase-3b-series" }),
        admin,
        "phase3b-series"
      );
      taxonomyIds.push(speaker.id, series.id);

      const created = await service.create(
        createSermonInputSchema.parse({
          title: "Phase 3B Controlled Sermon",
          slug: "phase-3b-controlled-sermon",
          serviceDate: "2026-08-05",
          speakerId: speaker.id,
          seriesIds: [series.id],
          scriptureReferences: [{ displayText: "Romans 8:1-4" }],
          media: [{
            provider: "youtube",
            mediaType: "video",
            externalId: null,
            canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
            title: "Controlled sermon video"
          }]
        }),
        admin,
        "phase3b-create"
      );
      sermonIds.push(created.id);
      expect(created).toMatchObject({ status: "draft" });
      expect(created.readiness.isComplete).toBe(false);
      expect(created.readiness.hasApprovedDescription).toBe(false);
      expect(created).not.toHaveProperty("ownership");

      const list = await service.list(
        { query: "Controlled", speakerId: speaker.id, seriesId: series.id, page: 1, pageSize: 20 },
        admin
      ) as ListResponseShape;
      expect(list.data).toHaveLength(1);
      expect(list.countsByStatus.draft).toBeGreaterThanOrEqual(1);
      expect(list.data[0]?.speaker?.name).toBe("Phase 3B Speaker");
      const missingDescriptions = await service.list(
        { contentIssue: "missing_description", page: 1, pageSize: 20 },
        admin
      ) as ListResponseShape;
      expect(missingDescriptions.data.some((item) => item.id === created.id)).toBe(true);

      await expect(
        service.transition(
          created.id,
          "withdraw",
          sermonTransitionInputSchema.parse({ rowVersion: created.rowVersion }),
          admin,
          "phase3b-invalid-transition"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });
      await expect(
        service.transition(
          created.id,
          "schedule",
          sermonTransitionInputSchema.parse({ rowVersion: created.rowVersion, scheduledFor: "2026-08-04T00:00:00.000Z" }),
          admin,
          "phase3b-invalid-schedule"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });

      await expect(
        service.transition(
          created.id,
          "schedule",
          { rowVersion: created.rowVersion, scheduledFor: "2027-08-05T00:00:00.000Z" },
          admin,
          "phase3b-incomplete-schedule"
        )
      ).rejects.toMatchObject({ status: 400, code: "content_incomplete" });

      const completed = await service.update(
        created.id,
        updateSermonInputSchema.parse({ rowVersion: created.rowVersion, ...approvedEnrichment() }),
        admin,
        "phase3b-complete-content"
      );
      expect(completed.readiness.isComplete).toBe(true);
      expect(completed).toMatchObject({
        summaryStatus: "approved",
        summarySourceKind: "manual",
        readiness: { hasApprovedDescription: true }
      });
      expect(completed.summaryReviewedAt).not.toBeNull();
      expect(completed.summaryApprovedAt).not.toBeNull();
      expect(completed.summaryRowVersion).toBeGreaterThan(created.summaryRowVersion);
      const descriptionAudit = (await service.listAudit(created.id, admin)).find(
        (event) => event.requestCorrelationId === "phase3b-complete-content"
      );
      expect(descriptionAudit?.changedFields).toEqual(
        expect.arrayContaining(["summary", "summaryStatus", "transcript", "questionAnswers"])
      );

      const pending = await service.transition(created.id, "submit", { rowVersion: completed.rowVersion }, admin, "phase3b-submit");
      const withdrawn = await service.transition(created.id, "withdraw", { rowVersion: pending.rowVersion }, admin, "phase3b-withdraw");
      const scheduled = await service.transition(
        created.id,
        "schedule",
        { rowVersion: withdrawn.rowVersion, scheduledFor: "2027-08-05T00:00:00.000Z" },
        admin,
        "phase3b-schedule"
      );
      const published = await service.transition(created.id, "publish", { rowVersion: scheduled.rowVersion }, admin, "phase3b-publish");
      expect(published.publishedAt).toBe("2026-08-05T00:00:00.000Z");
      expect((await publicRepository.findPublishedBySlug(published.slug))?.id).toBe(created.id);
      const unpublished = await service.transition(created.id, "unpublish", { rowVersion: published.rowVersion }, admin, "phase3b-unpublish");
      const archived = await service.transition(created.id, "archive", { rowVersion: unpublished.rowVersion }, admin, "phase3b-archive");
      const restored = await service.transition(created.id, "restore", { rowVersion: archived.rowVersion }, admin, "phase3b-restore");
      expect(restored).toMatchObject({ status: "draft", publishedAt: published.publishedAt });
      expect(await publicRepository.findPublishedBySlug(restored.slug)).toBeNull();

      const current = await service.update(
        created.id,
        updateSermonInputSchema.parse({ rowVersion: restored.rowVersion, summary: "Current edit", summaryStatus: "draft" }),
        admin,
        "phase3b-current"
      );
      await expect(
        service.update(
          created.id,
          updateSermonInputSchema.parse({ rowVersion: restored.rowVersion, summary: "Stale edit", summaryStatus: "draft" }),
          admin,
          "phase3b-stale"
        )
      ).rejects.toMatchObject({ status: 409, code: "stale_write" });

      await expect(
        service.update(
          created.id,
          updateSermonInputSchema.parse({
            rowVersion: current.rowVersion,
            title: "Must roll back",
            seriesIds: ["00000000-0000-4000-8000-000000000099"]
          }),
          admin,
          "phase3b-rollback"
        )
      ).rejects.toBeInstanceOf(ApplicationError);
      expect((await service.detail(created.id, admin)).title).not.toBe("Must roll back");

      const importedId = (await pool.query<{ id: string }>("SELECT id FROM sermons WHERE source_wordpress_id = 9003")).rows[0]!.id;
      expect((await service.detail(importedId, admin)).id).toBe(importedId);
    } finally {
      await pool.query("DELETE FROM audit_events WHERE actor_subject = 'local-admin-0001'");
      if (sermonIds.length) await pool.query("DELETE FROM sermons WHERE id = ANY($1::uuid[])", [sermonIds]);
      if (taxonomyIds.length) {
        await pool.query("DELETE FROM speakers WHERE id = ANY($1::uuid[])", [taxonomyIds]);
        await pool.query("DELETE FROM series WHERE id = ANY($1::uuid[])", [taxonomyIds]);
      }
    }
  });

  it("records slug redirects and enforces permanent deletion safeguards with minimal tombstones", async () => {
    const admin = { subject: "local-admin-0001", role: "admin" } satisfies ApplicationIdentity;
    const repository = new PostgresAdminSermonRepository(pool);
    const service = new AdminSermonService(repository, () => new Date("2026-08-05T00:00:00.000Z"));
    const createdIds: string[] = [];
    try {
      const existingSpeakerId = (
        await pool.query<{ id: string }>("SELECT id FROM speakers ORDER BY id LIMIT 1")
      ).rows[0]!.id;
      const created = await service.create(
        createSermonInputSchema.parse({
          title: "Delete Safeguard Sermon",
          slug: "delete-safeguard-sermon",
          serviceDate: "2026-08-05",
          speakerId: existingSpeakerId,
          ...approvedEnrichment(),
          scriptureReferences: [{ displayText: "John 3:16" }],
          media: [{
            provider: "sermonaudio",
            mediaType: "audio",
            externalId: null,
            canonicalUrl: "https://www.sermonaudio.com/sermons/example",
            title: "Controlled audio"
          }]
        }),
        admin,
        "delete-create"
      );
      createdIds.push(created.id);
      const published = await service.transition(created.id, "publish", { rowVersion: created.rowVersion }, admin, "delete-publish");
      const renamed = await service.update(
        created.id,
        updateSermonInputSchema.parse({ rowVersion: published.rowVersion, slug: "delete-safeguard-renamed" }),
        admin,
        "delete-rename"
      );
      expect(
        (await pool.query("SELECT new_path, status_code FROM redirects WHERE old_path = '/sermons/delete-safeguard-sermon/'")).rows[0]
      ).toEqual({ new_path: "/sermons/delete-safeguard-renamed/", status_code: 301 });

      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: renamed.rowVersion, confirmation: renamed.slug, reason: "Incorrect state", seoDisposition: { kind: "gone" } }),
          admin,
          "delete-wrong-state"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });

      const archived = await service.transition(created.id, "archive", { rowVersion: renamed.rowVersion }, admin, "delete-archive");
      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion, confirmation: "wrong", reason: "Mismatch", seoDisposition: { kind: "gone" } }),
          admin,
          "delete-confirmation"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });
      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion - 1, confirmation: archived.slug, reason: "Stale", seoDisposition: { kind: "gone" } }),
          admin,
          "delete-stale"
        )
      ).rejects.toMatchObject({ status: 409, code: "stale_write" });
      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion, confirmation: archived.slug, reason: "Missing disposition" }),
          admin,
          "delete-missing-seo"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });
      await expect(
        service.permanentlyDelete(
          created.id,
          permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion, confirmation: archived.slug, reason: "Invalid target", seoDisposition: { kind: "redirect", targetPath: "/sermons/not-a-published-target/" } }),
          admin,
          "delete-invalid-target"
        )
      ).rejects.toMatchObject({ status: 400, code: "invalid_request" });

      const result = await service.permanentlyDelete(
        created.id,
        permanentlyDeleteSermonInputSchema.parse({ rowVersion: archived.rowVersion, confirmation: archived.slug, reason: "Duplicate content retired", seoDisposition: { kind: "gone" } }),
        admin,
        "delete-success"
      );
      expect(result).toMatchObject({ deleted: true, formerSlug: "delete-safeguard-renamed", seoDisposition: { kind: "gone" } });
      createdIds.splice(createdIds.indexOf(created.id), 1);

      const dependent = await pool.query<{
        sermon: number;
        scripture: number;
        media: number;
        media_source: number;
        tombstone: number;
        audit: number;
      }>(
        `SELECT
           (SELECT count(*)::integer FROM sermons WHERE id = $1) AS sermon,
           (SELECT count(*)::integer FROM scripture_references WHERE sermon_id = $1) AS scripture,
           (SELECT count(*)::integer FROM sermon_media WHERE sermon_id = $1) AS media,
           (SELECT count(*)::integer FROM sermon_media_source_audit a JOIN sermon_media m ON m.id = a.sermon_media_id WHERE m.sermon_id = $1) AS media_source,
           (SELECT count(*)::integer FROM sermon_deletion_tombstones WHERE former_sermon_id = $1) AS tombstone,
           (SELECT count(*)::integer FROM audit_events WHERE entity_id = $1 AND action = 'sermon.permanent_delete') AS audit`,
        [created.id]
      );
      expect(dependent.rows[0]).toEqual({ sermon: 0, scripture: 0, media: 0, media_source: 0, tombstone: 1, audit: 1 });
      const dispositions = await pool.query("SELECT old_path, new_path, status_code FROM redirects WHERE source_sermon_id = $1 ORDER BY old_path", [created.id]);
      expect(dispositions.rows).toEqual([
        { old_path: "/sermons/delete-safeguard-renamed/", new_path: null, status_code: 410 },
        { old_path: "/sermons/delete-safeguard-sermon/", new_path: null, status_code: 410 }
      ]);
      const history = await service.auditHistory(admin);
      const tombstone = history.deletionTombstones.find((item) => item.formerSermonId === created.id);
      expect(tombstone).toMatchObject({ formerSlug: "delete-safeguard-renamed", reason: "Duplicate content retired", seoDisposition: "gone" });
      expect(JSON.stringify(tombstone)).not.toMatch(/body|media|iframe|originalValue|password|token|secret/i);
      expect((await service.listAudit(created.id, admin)).some((event) => event.action === "sermon.permanent_delete")).toBe(true);

      const neverPublished = await service.create(
        createSermonInputSchema.parse({ title: "Never Public", slug: "never-public", serviceDate: "2026-08-05" }),
        admin,
        "never-public-create"
      );
      const neverArchived = await service.transition(neverPublished.id, "archive", { rowVersion: neverPublished.rowVersion }, admin, "never-public-archive");
      await service.permanentlyDelete(
        neverPublished.id,
        permanentlyDeleteSermonInputSchema.parse({ rowVersion: neverArchived.rowVersion, confirmation: "Never Public", reason: "Draft entered in error" }),
        admin,
        "never-public-delete"
      );
      expect((await pool.query("SELECT count(*)::integer AS count FROM redirects WHERE source_sermon_id = $1", [neverPublished.id])).rows[0].count).toBe(0);

      const redirectSource = await service.create(
        createSermonInputSchema.parse({
          title: "Redirect Retired Sermon",
          slug: "redirect-retired-sermon",
          serviceDate: "2026-08-05",
          speakerId: existingSpeakerId,
          ...approvedEnrichment(),
          media: [{
            provider: "sermonaudio",
            mediaType: "audio",
            externalId: null,
            canonicalUrl: "https://www.sermonaudio.com/sermons/redirect-example",
            title: "Controlled redirect example audio"
          }]
        }),
        admin,
        "redirect-delete-create"
      );
      const redirectPublished = await service.transition(redirectSource.id, "publish", { rowVersion: redirectSource.rowVersion }, admin, "redirect-delete-publish");
      const redirectArchived = await service.transition(redirectSource.id, "archive", { rowVersion: redirectPublished.rowVersion }, admin, "redirect-delete-archive");
      await service.permanentlyDelete(
        redirectSource.id,
        permanentlyDeleteSermonInputSchema.parse({
          rowVersion: redirectArchived.rowVersion,
          confirmation: redirectArchived.title,
          reason: "Consolidated with retained sermon",
          seoDisposition: {
            kind: "redirect",
            targetPath: "/sermons/grace-for-an-anonymised-congregation/"
          }
        }),
        admin,
        "redirect-delete-success"
      );
      expect(
        (await pool.query("SELECT new_path, status_code FROM redirects WHERE old_path = '/sermons/redirect-retired-sermon/'")).rows[0]
      ).toEqual({
        new_path: "/sermons/grace-for-an-anonymised-congregation/",
        status_code: 301
      });
    } finally {
      if (createdIds.length) await pool.query("DELETE FROM sermons WHERE id = ANY($1::uuid[])", [createdIds]);
      await pool.query("DELETE FROM redirects WHERE source_sermon_id IS NOT NULL");
      await pool.query("DELETE FROM sermon_deletion_tombstones");
      await pool.query("DELETE FROM audit_events WHERE actor_subject = 'local-admin-0001'");
    }
  });

  it("requires the one approved local admin on every admin route", async () => {
    const route = createApplicationApiRouter(
      new PostgresSermonRepository(pool),
      new PostgresAdminSermonRepository(pool),
      new LocalTestIdentityProvider(true, "development")
    );
    expect((await route(new Request("http://127.0.0.1/api/v1/admin/sermons"))).status).toBe(401);
    expect((await route(new Request(
      "http://127.0.0.1/api/v1/admin/sermons/75df2144-b557-50f6-98bd-011cd696bfb9/review"
    ))).status).toBe(401);
    expect((await route(new Request("http://127.0.0.1/api/v1/admin/sermons", { headers: { "x-local-identity": "admin" } }))).status).toBe(200);
    for (const selector of ["editor", "contributor", "unknown"]) {
      expect((await route(new Request("http://127.0.0.1/api/v1/admin/sermons", { headers: { "x-local-identity": selector, "x-actor-role": "admin" } }))).status).toBe(401);
    }
    expect((await route(new Request("http://127.0.0.1/api/v1/admin/audit", { headers: { "x-local-identity": "admin" } }))).status).toBe(200);
  });

  it("keeps eight schema receipts separate from content-import receipts and verifies a no-op", async () => {
    const migrations = await loadSchemaMigrations();
    const journal = await pool.query<{
      migration_order: number;
      migration_id: string;
      checksum_sha256: string;
      applied_at: Date;
    }>(
      `SELECT migration_order, migration_id, checksum_sha256, applied_at
       FROM schema_migrations ORDER BY migration_order`
    );
    expect(journal.rows).toEqual(migrations.map((migration) => ({
      migration_order: migration.order,
      migration_id: migration.id,
      checksum_sha256: migration.checksumSha256,
      applied_at: expect.any(Date)
    })));
    const before = await pool.query<{
      schema_receipts: number;
      content_records: number;
      draft_import_receipts: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM schema_migrations) AS schema_receipts,
         (SELECT count(*)::integer FROM migration_records) AS content_records,
         (SELECT count(*)::integer FROM sermon_enrichment_draft_imports) AS draft_import_receipts`
    );
    expect(before.rows[0]?.schema_receipts).toBe(8);
    expect(before.rows[0]?.content_records).toBe(5);
    expect(before.rows[0]?.draft_import_receipts).toBeGreaterThanOrEqual(0);
    await expect(runSchema("apply")).resolves.toEqual({
      direction: "apply",
      outcome: "no_op",
      appliedMigrationIds: [],
      rolledBackMigrationIds: [],
      journalReceiptCount: 8
    });
    expect((await pool.query<{
      schema_receipts: number;
      content_records: number;
      draft_import_receipts: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM schema_migrations) AS schema_receipts,
         (SELECT count(*)::integer FROM migration_records) AS content_records,
         (SELECT count(*)::integer FROM sermon_enrichment_draft_imports) AS draft_import_receipts`
    )).rows[0]).toEqual(before.rows[0]);
  });

  it("applies only the pending canonical suffix from a valid partial journal", async () => {
    await runSchema("rollback", "0008_atomic_sermon_review_items");
    await runSchema("rollback", "0007_guided_sermon_review");
    await runSchema("rollback", "0006_phase3b2_pilot_provenance");
    await runSchema("rollback", "0005_approved_sermon_descriptions");
    await runSchema("rollback", "0004_sermon_enrichment_readiness");
    expect((await pool.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM schema_migrations"
    )).rows[0]).toEqual({ count: 3 });
    await expect(runSchema("apply")).resolves.toEqual({
      direction: "apply",
      outcome: "applied",
      appliedMigrationIds: [
        "0004_sermon_enrichment_readiness",
        "0005_approved_sermon_descriptions",
        "0006_phase3b2_pilot_provenance",
        "0007_guided_sermon_review",
        "0008_atomic_sermon_review_items"
      ],
      rolledBackMigrationIds: [],
      journalReceiptCount: 8
    });
  });

  it("fails before apply or rollback on changed and unknown receipts", async () => {
    const migrations = await loadSchemaMigrations();
    const eighth = migrations[7]!;
    await pool.query(
      "UPDATE schema_migrations SET checksum_sha256 = $1 WHERE migration_order = 8",
      ["f".repeat(64)]
    );
    await expect(runSchema("rollback", "0008_atomic_sermon_review_items"))
      .rejects.toMatchObject({ code: "migration_checksum_mismatch" });
    expect((await pool.query<{ receipt: number; atomic_present: boolean }>(
      `SELECT
         (SELECT count(*)::integer FROM schema_migrations WHERE migration_order = 8) AS receipt,
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'sermon_enrichment_review_items'
                   AND column_name = 'item_identity_sha256') AS atomic_present`
    )).rows[0]).toEqual({ receipt: 1, atomic_present: true });
    await pool.query(
      "UPDATE schema_migrations SET checksum_sha256 = $1 WHERE migration_order = 8",
      [eighth.checksumSha256]
    );

    await pool.query(
      `ALTER TABLE sermon_enrichment_review_items
       ADD COLUMN atomic_review_rollback_probe text
       GENERATED ALWAYS AS (item_identity_sha256) STORED`
    );
    await expect(runSchema("rollback", "0008_atomic_sermon_review_items"))
      .rejects.toMatchObject({ code: "migration_transaction_failure" });
    expect((await pool.query<{ receipt: number; atomic_present: boolean }>(
      `SELECT
         (SELECT count(*)::integer FROM schema_migrations WHERE migration_order = 8) AS receipt,
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'sermon_enrichment_review_items'
                   AND column_name = 'item_identity_sha256') AS atomic_present`
    )).rows[0]).toEqual({ receipt: 1, atomic_present: true });
    await pool.query(
      "ALTER TABLE sermon_enrichment_review_items DROP COLUMN atomic_review_rollback_probe"
    );

    await expect(runSchema("rollback", "0008_atomic_sermon_review_items"))
      .resolves.toMatchObject({ outcome: "rolled_back", journalReceiptCount: 7 });
    expect((await pool.query<{ receipt: number; atomic_present: boolean }>(
      `SELECT
         (SELECT count(*)::integer FROM schema_migrations WHERE migration_order = 8) AS receipt,
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'sermon_enrichment_review_items'
                   AND column_name = 'item_identity_sha256') AS atomic_present`
    )).rows[0]).toEqual({ receipt: 0, atomic_present: false });

    await pool.query(
      `INSERT INTO schema_migrations (migration_order, migration_id, checksum_sha256)
       VALUES (8, '0009_unknown', $1)`,
      [eighth.checksumSha256]
    );
    await expect(runSchema("apply")).rejects.toMatchObject({ code: "journal_state_failure" });
    expect((await pool.query<{ present: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'sermon_enrichment_review_items'
                        AND column_name = 'item_identity_sha256') AS present`
    )).rows[0]).toEqual({ present: false });
    await pool.query("DELETE FROM schema_migrations WHERE migration_order = 8");
    await expect(runSchema("apply", "0008_atomic_sermon_review_items"))
      .resolves.toMatchObject({ outcome: "applied", journalReceiptCount: 8 });
  });

  it("refuses unjournalled objects and serialises concurrent fresh application", async () => {
    await expect(runSchema("rollback")).resolves.toMatchObject({
      outcome: "rolled_back",
      journalReceiptCount: 0
    });
    await pool.query("DROP TABLE schema_migrations");
    await pool.query("CREATE TABLE sermons (id integer PRIMARY KEY)");
    await expect(runSchema("apply")).rejects.toMatchObject({ code: "schema_drift_failure" });
    expect((await pool.query<{ journal_present: boolean; sermon_present: boolean }>(
      `SELECT
         to_regclass('public.schema_migrations') IS NOT NULL AS journal_present,
         to_regclass('public.sermons') IS NOT NULL AS sermon_present`
    )).rows[0]).toEqual({ journal_present: false, sermon_present: true });
    await pool.query("DROP TABLE sermons");

    const results = await Promise.all([runSchema("apply"), runSchema("apply")]);
    expect(results.map((result) => result.outcome).sort()).toEqual(["applied", "no_op"]);
    expect(results.reduce((count, result) => count + result.appliedMigrationIds.length, 0)).toBe(8);
    expect((await pool.query<{ receipts: number; distinct_receipts: number }>(
      `SELECT count(*)::integer AS receipts,
              count(DISTINCT migration_id)::integer AS distinct_receipts
       FROM schema_migrations`
    )).rows[0]).toEqual({ receipts: 8, distinct_receipts: 8 });

    await expect(runSchema("rollback")).resolves.toMatchObject({
      outcome: "rolled_back",
      journalReceiptCount: 0
    });
    await expect(runSchema("apply")).resolves.toMatchObject({
      outcome: "applied",
      journalReceiptCount: 8
    });
  });
});

interface ListResponseShape {
  data: Array<{ id: string; speaker: RelationshipShape | null }>;
  countsByStatus: Record<SermonStatus, number>;
}

interface RelationshipShape {
  name: string;
}
